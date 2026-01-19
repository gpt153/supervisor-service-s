/**
 * Unit tests for ProjectContextManager
 */

import { ProjectContextManager } from '../../mcp/ProjectContextManager.js';
import * as assert from 'assert';
import { describe, it, before } from 'node:test';

describe('ProjectContextManager', () => {
  let manager: ProjectContextManager;

  before(async () => {
    manager = new ProjectContextManager('config/projects.json');
    await manager.initialize();
  });

  describe('initialization', () => {
    it('should load project configurations', async () => {
      const stats = manager.getStats();
      assert.ok(stats.total > 0, 'Should have loaded projects');
      assert.ok(stats.enabled > 0, 'Should have enabled projects');
    });

    it('should create contexts for enabled projects', () => {
      const contexts = manager.getAllContexts();
      assert.ok(contexts.size > 0, 'Should have created contexts');
    });
  });

  describe('getContext', () => {
    it('should return context for valid project', () => {
      const context = manager.getContext('meta');
      assert.ok(context, 'Should return context for meta project');
      assert.strictEqual(context?.project.name, 'meta');
    });

    it('should return undefined for invalid project', () => {
      const context = manager.getContext('nonexistent');
      assert.strictEqual(context, undefined);
    });
  });

  describe('detectProjectFromPath', () => {
    it('should detect project from valid path', () => {
      const project = manager.detectProjectFromPath('/mcp/consilio');
      assert.strictEqual(project, 'consilio');
    });

    it('should return null for invalid path', () => {
      const project = manager.detectProjectFromPath('/invalid/path');
      assert.strictEqual(project, null);
    });

    it('should return null for nonexistent project', () => {
      const project = manager.detectProjectFromPath('/mcp/nonexistent');
      assert.strictEqual(project, null);
    });
  });

  describe('validateProject', () => {
    it('should validate enabled projects', () => {
      const isValid = manager.validateProject('meta');
      assert.strictEqual(isValid, true);
    });

    it('should reject invalid projects', () => {
      const isValid = manager.validateProject('nonexistent');
      assert.strictEqual(isValid, false);
    });
  });

  describe('state management', () => {
    it('should set and get state', () => {
      manager.setState('meta', 'testKey', 'testValue');
      const value = manager.getState('meta', 'testKey');
      assert.strictEqual(value, 'testValue');
    });

    it('should clear state', () => {
      manager.setState('meta', 'testKey', 'testValue');
      manager.clearState('meta');
      const value = manager.getState('meta', 'testKey');
      assert.strictEqual(value, undefined);
    });

    it('should throw error for invalid project state operations', () => {
      assert.throws(() => {
        manager.setState('nonexistent', 'key', 'value');
      });
    });
  });

  describe('getStats', () => {
    it('should return accurate statistics', () => {
      const stats = manager.getStats();
      assert.ok(stats.total >= stats.enabled);
      assert.ok(stats.enabled >= 0);
      assert.ok(stats.disabled >= 0);
      assert.ok(stats.contexts >= 0);
    });
  });
});
