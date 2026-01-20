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
  // Agent quota status table
  pgm.createTable('agent_quota_status', {
    id: 'id',
    agent_type: {
      type: 'varchar(20)',
      notNull: true,
      unique: true,
      comment: 'Agent type: gemini, codex, claude',
    },
    remaining: {
      type: 'integer',
      notNull: true,
      default: 0,
      comment: 'Remaining quota count',
    },
    limit: {
      type: 'integer',
      notNull: true,
      comment: 'Total quota limit',
    },
    resets_at: {
      type: 'timestamp',
      notNull: true,
      comment: 'When quota resets',
    },
    available: {
      type: 'boolean',
      notNull: true,
      default: true,
      comment: 'Whether agent is currently available',
    },
    last_updated: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  // Agent execution history table
  pgm.createTable('agent_executions', {
    id: 'id',
    agent_type: {
      type: 'varchar(20)',
      notNull: true,
      comment: 'Agent type used',
    },
    task_type: {
      type: 'varchar(50)',
      comment: 'Type of task executed',
    },
    complexity: {
      type: 'varchar(20)',
      comment: 'Task complexity: simple, medium, complex',
    },
    success: {
      type: 'boolean',
      notNull: true,
      comment: 'Whether execution succeeded',
    },
    duration_ms: {
      type: 'integer',
      notNull: true,
      comment: 'Execution duration in milliseconds',
    },
    cost: {
      type: 'decimal(10, 4)',
      default: 0,
      comment: 'Estimated cost in USD',
    },
    error_message: {
      type: 'text',
      comment: 'Error message if failed',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  // Routing decisions table
  pgm.createTable('agent_routing_decisions', {
    id: 'id',
    selected_agent: {
      type: 'varchar(20)',
      notNull: true,
      comment: 'Agent selected for task',
    },
    reason: {
      type: 'text',
      notNull: true,
      comment: 'Reason for selection',
    },
    task_type: {
      type: 'varchar(50)',
      comment: 'Task type',
    },
    complexity: {
      type: 'varchar(20)',
      comment: 'Classified complexity',
    },
    confidence: {
      type: 'decimal(3, 2)',
      comment: 'Classification confidence score',
    },
    fallback_agents: {
      type: 'text[]',
      comment: 'Array of fallback agents',
    },
    execution_id: {
      type: 'integer',
      references: 'agent_executions',
      onDelete: 'SET NULL',
      comment: 'Link to execution result',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  // Indexes for performance
  pgm.createIndex('agent_executions', 'agent_type');
  pgm.createIndex('agent_executions', 'created_at');
  pgm.createIndex('agent_executions', ['agent_type', 'success']);
  pgm.createIndex('agent_routing_decisions', 'selected_agent');
  pgm.createIndex('agent_routing_decisions', 'created_at');

  // Initialize quota status for all agents
  pgm.sql(`
    INSERT INTO agent_quota_status (agent_type, remaining, "limit", resets_at)
    VALUES
      ('gemini', 1000, 1000, NOW() + INTERVAL '24 hours'),
      ('codex', 150, 150, NOW() + INTERVAL '5 hours'),
      ('claude', 1000, 1000, NOW() + INTERVAL '24 hours')
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.dropTable('agent_routing_decisions');
  pgm.dropTable('agent_executions');
  pgm.dropTable('agent_quota_status');
};
