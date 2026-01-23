/**
 * Unit tests for Design System functionality
 * Epic: UI-002 - Design System Foundation
 *
 * Tests the design_systems table CRUD operations and MCP tools
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { pool } from '../src/db/client.js';
import { DesignSystemManager } from '../src/ui/DesignSystemManager.js';
import type { CreateDesignSystemParams, StyleConfig } from '../src/types/design-system.js';

describe('Design System Database Operations', () => {
  const manager = new DesignSystemManager();
  const testProjectName = 'test-project';

  beforeEach(async () => {
    // Clean up test data before each test
    await pool.query(`DELETE FROM design_systems WHERE project_name LIKE 'test-%'`);
  });

  afterAll(async () => {
    // Final cleanup
    await pool.query(`DELETE FROM design_systems WHERE project_name LIKE 'test-%'`);
    await pool.end();
  });

  // Sample valid style config for testing
  const validStyleConfig: StyleConfig = {
    colors: {
      primary: '#3B82F6',
      secondary: '#10B981',
      background: '#FFFFFF',
      surface: '#F9FAFB',
      text: {
        primary: '#1F2937',
        secondary: '#6B7280',
      },
    },
    typography: {
      fontFamily: {
        body: 'Inter, sans-serif',
        heading: 'Inter, sans-serif',
      },
      fontSize: {
        xs: '0.75rem',
        sm: '0.875rem',
        base: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
      },
      fontWeight: {
        normal: 400,
        medium: 500,
        semibold: 600,
        bold: 700,
      },
      lineHeight: {
        tight: '1.25',
        normal: '1.5',
        relaxed: '1.75',
        loose: '2',
      },
    },
    spacing: {
      xs: '0.25rem',
      sm: '0.5rem',
      md: '1rem',
      lg: '1.5rem',
      xl: '2rem',
      '2xl': '3rem',
    },
  };

  describe('createDesignSystem', () => {
    it('should create a design system with valid data', async () => {
      const params: CreateDesignSystemParams = {
        projectName: testProjectName,
        name: 'default',
        description: 'Default design system',
        styleConfig: validStyleConfig,
      };

      const result = await manager.createDesignSystem(params);

      expect(result.success).toBe(true);
      expect(result.designSystem).toBeDefined();
      expect(result.designSystem?.project_name).toBe(testProjectName);
      expect(result.designSystem?.name).toBe('default');
      expect(result.designSystem?.description).toBe('Default design system');
      expect(result.designSystem?.style_config).toEqual(validStyleConfig);
      expect(result.designSystem?.component_library).toEqual({
        components: [],
        version: '1.0.0',
      });
    });

    it('should validate required fields', async () => {
      const params: any = {
        projectName: '',
        name: 'default',
        styleConfig: validStyleConfig,
      };

      const result = await manager.createDesignSystem(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('projectName and name are required');
    });

    it('should validate style config structure', async () => {
      const invalidStyleConfig: any = {
        colors: {
          primary: '#3B82F6',
          // Missing required fields
        },
      };

      const params: CreateDesignSystemParams = {
        projectName: testProjectName,
        name: 'invalid',
        styleConfig: invalidStyleConfig,
      };

      const result = await manager.createDesignSystem(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('styleConfig');
    });

    it('should enforce unique constraint on project_name + name', async () => {
      const params: CreateDesignSystemParams = {
        projectName: testProjectName,
        name: 'duplicate-test',
        styleConfig: validStyleConfig,
      };

      // Create first design system
      const result1 = await manager.createDesignSystem(params);
      expect(result1.success).toBe(true);

      // Try to create duplicate
      const result2 = await manager.createDesignSystem(params);
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('already exists');
    });

    it('should store JSONB data correctly', async () => {
      const params: CreateDesignSystemParams = {
        projectName: testProjectName,
        name: 'jsonb-test',
        styleConfig: validStyleConfig,
        componentLibrary: {
          components: [
            {
              name: 'Button',
              category: 'button',
              description: 'Primary button component',
            },
          ],
          version: '1.0.0',
        },
      };

      const result = await manager.createDesignSystem(params);
      expect(result.success).toBe(true);

      // Query database directly to verify JSONB storage
      const dbResult = await pool.query(
        `SELECT style_config, component_library FROM design_systems WHERE id = $1`,
        [result.designSystem?.id]
      );

      expect(dbResult.rows[0].style_config).toEqual(validStyleConfig);
      expect(dbResult.rows[0].component_library.components).toHaveLength(1);
      expect(dbResult.rows[0].component_library.components[0].name).toBe('Button');
    });
  });

  describe('getDesignSystem', () => {
    beforeEach(async () => {
      // Create test design systems
      await manager.createDesignSystem({
        projectName: testProjectName,
        name: 'default',
        styleConfig: validStyleConfig,
      });
      await manager.createDesignSystem({
        projectName: testProjectName,
        name: 'admin-theme',
        styleConfig: validStyleConfig,
      });
    });

    it('should get a specific design system by name', async () => {
      const result = await manager.getDesignSystem({
        projectName: testProjectName,
        name: 'default',
      });

      expect(result).not.toBeNull();
      expect(Array.isArray(result)).toBe(false);
      if (!Array.isArray(result) && result) {
        expect(result.name).toBe('default');
        expect(result.project_name).toBe(testProjectName);
      }
    });

    it('should get all design systems for a project', async () => {
      const result = await manager.getDesignSystem({
        projectName: testProjectName,
      });

      expect(result).not.toBeNull();
      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        expect(result.length).toBe(2);
        expect(result.map(ds => ds.name)).toContain('default');
        expect(result.map(ds => ds.name)).toContain('admin-theme');
      }
    });

    it('should return null for non-existent design system', async () => {
      const result = await manager.getDesignSystem({
        projectName: testProjectName,
        name: 'non-existent',
      });

      expect(result).toBeNull();
    });

    it('should return null for project with no design systems', async () => {
      const result = await manager.getDesignSystem({
        projectName: 'non-existent-project',
      });

      expect(result).toBeNull();
    });
  });

  describe('getDesignSystemById', () => {
    it('should get design system by ID', async () => {
      const created = await manager.createDesignSystem({
        projectName: testProjectName,
        name: 'id-test',
        styleConfig: validStyleConfig,
      });

      expect(created.success).toBe(true);
      expect(created.designSystem).toBeDefined();

      const result = await manager.getDesignSystemById(created.designSystem!.id);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(created.designSystem!.id);
      expect(result?.name).toBe('id-test');
    });

    it('should return null for non-existent ID', async () => {
      const result = await manager.getDesignSystemById(999999);
      expect(result).toBeNull();
    });
  });

  describe('updateDesignSystem', () => {
    it('should update design system name', async () => {
      const created = await manager.createDesignSystem({
        projectName: testProjectName,
        name: 'original-name',
        styleConfig: validStyleConfig,
      });

      expect(created.success).toBe(true);

      const updated = await manager.updateDesignSystem({
        id: created.designSystem!.id,
        name: 'updated-name',
      });

      expect(updated).not.toBeNull();
      expect(updated?.name).toBe('updated-name');
      expect(updated?.id).toBe(created.designSystem!.id);
    });

    it('should update style config', async () => {
      const created = await manager.createDesignSystem({
        projectName: testProjectName,
        name: 'style-update-test',
        styleConfig: validStyleConfig,
      });

      expect(created.success).toBe(true);

      const updatedStyleConfig = {
        ...validStyleConfig,
        colors: {
          ...validStyleConfig.colors,
          primary: '#EF4444', // Red instead of blue
        },
      };

      const updated = await manager.updateDesignSystem({
        id: created.designSystem!.id,
        styleConfig: updatedStyleConfig,
      });

      expect(updated).not.toBeNull();
      expect(updated?.style_config.colors.primary).toBe('#EF4444');
    });

    it('should update component library', async () => {
      const created = await manager.createDesignSystem({
        projectName: testProjectName,
        name: 'component-update-test',
        styleConfig: validStyleConfig,
      });

      expect(created.success).toBe(true);

      const updated = await manager.updateDesignSystem({
        id: created.designSystem!.id,
        componentLibrary: {
          components: [
            { name: 'Button', category: 'button' },
            { name: 'Input', category: 'input' },
          ],
          version: '1.1.0',
        },
      });

      expect(updated).not.toBeNull();
      expect(updated?.component_library.components).toHaveLength(2);
      expect(updated?.component_library.version).toBe('1.1.0');
    });

    it('should return null for non-existent design system', async () => {
      const updated = await manager.updateDesignSystem({
        id: 999999,
        name: 'new-name',
      });

      expect(updated).toBeNull();
    });

    it('should validate style config on update', async () => {
      const created = await manager.createDesignSystem({
        projectName: testProjectName,
        name: 'validation-test',
        styleConfig: validStyleConfig,
      });

      expect(created.success).toBe(true);

      const invalidStyleConfig: any = {
        colors: { primary: '#000000' }, // Missing required fields
      };

      await expect(
        manager.updateDesignSystem({
          id: created.designSystem!.id,
          styleConfig: invalidStyleConfig,
        })
      ).rejects.toThrow();
    });

    it('should update updated_at timestamp automatically', async () => {
      const created = await manager.createDesignSystem({
        projectName: testProjectName,
        name: 'timestamp-test',
        styleConfig: validStyleConfig,
      });

      expect(created.success).toBe(true);

      const originalUpdatedAt = created.designSystem!.updated_at;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 100));

      const updated = await manager.updateDesignSystem({
        id: created.designSystem!.id,
        name: 'timestamp-test-updated',
      });

      expect(updated).not.toBeNull();
      expect(new Date(updated!.updated_at).getTime()).toBeGreaterThan(
        new Date(originalUpdatedAt).getTime()
      );
    });
  });

  describe('deleteDesignSystem', () => {
    it('should delete existing design system', async () => {
      const created = await manager.createDesignSystem({
        projectName: testProjectName,
        name: 'delete-test',
        styleConfig: validStyleConfig,
      });

      expect(created.success).toBe(true);

      const deleted = await manager.deleteDesignSystem({
        id: created.designSystem!.id,
      });

      expect(deleted).toBe(true);

      // Verify deletion
      const result = await manager.getDesignSystemById(created.designSystem!.id);
      expect(result).toBeNull();
    });

    it('should return false for non-existent design system', async () => {
      const deleted = await manager.deleteDesignSystem({ id: 999999 });
      expect(deleted).toBe(false);
    });
  });

  describe('updateStorybookInfo', () => {
    it('should update Storybook port and URL', async () => {
      const created = await manager.createDesignSystem({
        projectName: testProjectName,
        name: 'storybook-test',
        styleConfig: validStyleConfig,
      });

      expect(created.success).toBe(true);

      const updated = await manager.updateStorybookInfo(
        created.designSystem!.id,
        5173,
        'http://localhost:5173'
      );

      expect(updated).not.toBeNull();
      expect(updated?.storybook_port).toBe(5173);
      expect(updated?.storybook_url).toBe('http://localhost:5173');
    });

    it('should return null for non-existent design system', async () => {
      const updated = await manager.updateStorybookInfo(999999, 5173, 'http://localhost:5173');
      expect(updated).toBeNull();
    });
  });
});

describe('Design System Style Config Validation', () => {
  const manager = new DesignSystemManager();

  it('should require colors section', async () => {
    const invalidConfig: any = {
      typography: {},
      spacing: {},
    };

    const result = await manager.createDesignSystem({
      projectName: 'test-validation',
      name: 'missing-colors',
      styleConfig: invalidConfig,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('colors');
  });

  it('should require typography section', async () => {
    const invalidConfig: any = {
      colors: {
        primary: '#000',
        secondary: '#000',
        background: '#fff',
        surface: '#fff',
        text: { primary: '#000', secondary: '#666' },
      },
      spacing: {},
    };

    const result = await manager.createDesignSystem({
      projectName: 'test-validation',
      name: 'missing-typography',
      styleConfig: invalidConfig,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('typography');
  });

  it('should require spacing section', async () => {
    const invalidConfig: any = {
      colors: {
        primary: '#000',
        secondary: '#000',
        background: '#fff',
        surface: '#fff',
        text: { primary: '#000', secondary: '#666' },
      },
      typography: {
        fontFamily: {},
        fontSize: {},
        fontWeight: {},
        lineHeight: {},
      },
    };

    const result = await manager.createDesignSystem({
      projectName: 'test-validation',
      name: 'missing-spacing',
      styleConfig: invalidConfig,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('spacing');
  });
});
