/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  // Design systems table for UI-First Development Workflow
  // Epic: UI-002 - Design System Foundation
  pgm.createTable('design_systems', {
    id: 'id',
    project_name: {
      type: 'varchar(100)',
      notNull: true,
      comment: 'Project name (e.g., consilio, odin)',
    },
    name: {
      type: 'varchar(100)',
      notNull: true,
      comment: 'Design system name (e.g., default, admin-theme)',
    },
    description: {
      type: 'text',
      comment: 'Optional description of the design system',
    },
    style_config: {
      type: 'jsonb',
      notNull: true,
      comment: 'Design tokens: colors, typography, spacing, etc.',
    },
    component_library: {
      type: 'jsonb',
      notNull: true,
      default: '{"components": [], "version": "1.0.0"}',
      comment: 'Component definitions with variants and props',
    },
    storybook_port: {
      type: 'integer',
      comment: 'Port where Storybook is deployed',
    },
    storybook_url: {
      type: 'varchar(255)',
      comment: 'Public URL for Storybook instance',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  // Unique constraint: one design system name per project
  pgm.addConstraint('design_systems', 'design_systems_project_name_name_key', {
    unique: ['project_name', 'name'],
  });

  // Indexes for performance
  pgm.createIndex('design_systems', 'project_name');
  pgm.createIndex('design_systems', ['project_name', 'name']);
  pgm.createIndex('design_systems', 'created_at');

  // GIN index for JSONB queries (style_config and component_library)
  pgm.createIndex('design_systems', 'style_config', {
    method: 'gin',
  });
  pgm.createIndex('design_systems', 'component_library', {
    method: 'gin',
  });

  // Trigger to auto-update updated_at timestamp
  pgm.sql(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ language 'plpgsql';
  `);

  pgm.sql(`
    CREATE TRIGGER update_design_systems_updated_at
    BEFORE UPDATE ON design_systems
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.dropTable('design_systems', { cascade: true });
  pgm.sql('DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;');
};
