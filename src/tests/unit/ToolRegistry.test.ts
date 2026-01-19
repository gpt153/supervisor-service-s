/**
 * Unit tests for ToolRegistry
 */

import { ToolRegistry } from '../../mcp/ToolRegistry.js';
import { ToolDefinition, ProjectContext } from '../../types/project.js';
import * as assert from 'assert';
import { describe, it, beforeEach } from 'node:test';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;
  let mockContext: ProjectContext;

  const createMockTool = (name: string): ToolDefinition => ({
    name,
    description: `Test tool: ${name}`,
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async (params: any, context: ProjectContext) => {
      return { success: true, toolName: name };
    },
  });

  beforeEach(() => {
    registry = new ToolRegistry();
    mockContext = {
      project: {
        name: 'test-project',
        displayName: 'Test Project',
        path: '/test',
        description: 'Test project',
        endpoints: ['/mcp/test'],
        tools: ['tool1', 'tool2'],
        enabled: true,
      },
      workingDirectory: '/test',
      isolatedState: new Map(),
    };
  });

  describe('registerTool', () => {
    it('should register a tool', () => {
      const tool = createMockTool('testTool');
      registry.registerTool(tool);

      const retrieved = registry.getTool('testTool');
      assert.ok(retrieved);
      assert.strictEqual(retrieved?.name, 'testTool');
    });

    it('should overwrite existing tool', () => {
      const tool1 = createMockTool('testTool');
      const tool2 = createMockTool('testTool');

      registry.registerTool(tool1);
      registry.registerTool(tool2);

      const tools = registry.getAllToolNames();
      assert.strictEqual(tools.length, 1);
    });
  });

  describe('registerTools', () => {
    it('should register multiple tools', () => {
      const tools = [
        createMockTool('tool1'),
        createMockTool('tool2'),
        createMockTool('tool3'),
      ];

      registry.registerTools(tools);

      const allTools = registry.getAllToolNames();
      assert.strictEqual(allTools.length, 3);
    });
  });

  describe('setProjectTools', () => {
    it('should associate tools with project', () => {
      const tools = [createMockTool('tool1'), createMockTool('tool2')];
      registry.registerTools(tools);

      registry.setProjectTools('test-project', ['tool1', 'tool2']);

      const projectTools = registry.getProjectTools('test-project');
      assert.strictEqual(projectTools.length, 2);
    });

    it('should warn about missing tools', () => {
      registry.setProjectTools('test-project', ['nonexistent']);

      const projectTools = registry.getProjectTools('test-project');
      assert.strictEqual(projectTools.length, 0);
    });
  });

  describe('getProjectTools', () => {
    it('should return only scoped tools', () => {
      const tools = [
        createMockTool('tool1'),
        createMockTool('tool2'),
        createMockTool('tool3'),
      ];
      registry.registerTools(tools);

      registry.setProjectTools('test-project', ['tool1', 'tool2']);

      const projectTools = registry.getProjectTools('test-project');
      assert.strictEqual(projectTools.length, 2);

      const names = projectTools.map(t => t.name);
      assert.ok(names.includes('tool1'));
      assert.ok(names.includes('tool2'));
      assert.ok(!names.includes('tool3'));
    });

    it('should return empty array for unknown project', () => {
      const projectTools = registry.getProjectTools('unknown');
      assert.strictEqual(projectTools.length, 0);
    });
  });

  describe('isToolAvailableForProject', () => {
    it('should return true for available tools', () => {
      const tool = createMockTool('tool1');
      registry.registerTool(tool);
      registry.setProjectTools('test-project', ['tool1']);

      const isAvailable = registry.isToolAvailableForProject('test-project', 'tool1');
      assert.strictEqual(isAvailable, true);
    });

    it('should return false for unavailable tools', () => {
      const tool = createMockTool('tool1');
      registry.registerTool(tool);

      const isAvailable = registry.isToolAvailableForProject('test-project', 'tool1');
      assert.strictEqual(isAvailable, false);
    });
  });

  describe('executeTool', () => {
    it('should execute tool with context', async () => {
      const tool = createMockTool('tool1');
      registry.registerTool(tool);
      registry.setProjectTools('test-project', ['tool1']);

      const result = await registry.executeTool('tool1', {}, mockContext);

      assert.ok(result);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.toolName, 'tool1');
    });

    it('should throw error for missing tool', async () => {
      await assert.rejects(
        async () => {
          await registry.executeTool('nonexistent', {}, mockContext);
        },
        /Tool not found/
      );
    });

    it('should throw error for unscoped tool', async () => {
      const tool = createMockTool('tool1');
      registry.registerTool(tool);
      // Don't scope it to the project

      await assert.rejects(
        async () => {
          await registry.executeTool('tool1', {}, mockContext);
        },
        /not available for project/
      );
    });
  });

  describe('unregisterTool', () => {
    it('should remove tool from registry', () => {
      const tool = createMockTool('tool1');
      registry.registerTool(tool);

      const removed = registry.unregisterTool('tool1');
      assert.strictEqual(removed, true);

      const retrieved = registry.getTool('tool1');
      assert.strictEqual(retrieved, undefined);
    });

    it('should remove tool from project scopes', () => {
      const tool = createMockTool('tool1');
      registry.registerTool(tool);
      registry.setProjectTools('test-project', ['tool1']);

      registry.unregisterTool('tool1');

      const isAvailable = registry.isToolAvailableForProject('test-project', 'tool1');
      assert.strictEqual(isAvailable, false);
    });
  });

  describe('getStats', () => {
    it('should return accurate statistics', () => {
      const tools = [createMockTool('tool1'), createMockTool('tool2')];
      registry.registerTools(tools);
      registry.setProjectTools('project1', ['tool1']);
      registry.setProjectTools('project2', ['tool2']);

      const stats = registry.getStats();

      assert.strictEqual(stats.totalTools, 2);
      assert.strictEqual(stats.projectsWithTools, 2);
      assert.strictEqual(stats.toolsPerProject.get('project1'), 1);
      assert.strictEqual(stats.toolsPerProject.get('project2'), 1);
    });
  });

  describe('clear', () => {
    it('should clear all tools and scopes', () => {
      const tools = [createMockTool('tool1'), createMockTool('tool2')];
      registry.registerTools(tools);
      registry.setProjectTools('test-project', ['tool1']);

      registry.clear();

      const stats = registry.getStats();
      assert.strictEqual(stats.totalTools, 0);
      assert.strictEqual(stats.projectsWithTools, 0);
    });
  });
});
