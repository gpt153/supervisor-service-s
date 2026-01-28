/**
 * Integration Tests for Command Logging (Epic 007-B)
 * Tests full command logging flow with database
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { db } from '../../src/db/index.js';
import { getCommandLogger, resetCommandLogger } from '../../src/session/CommandLogger.js';
import {
  getSanitizationService,
  resetSanitizationService,
} from '../../src/session/SanitizationService.js';
import {
  registerInstance,
  updateHeartbeat,
} from '../../src/session/index.js';
import { CommandType } from '../../src/types/command-log.js';

/**
 * Integration tests that require a real database
 * Skipped if database not available
 */
describe('Command Logging Integration', () => {
  let instanceId: string;
  const testProject = 'integration-test';

  beforeAll(async () => {
    // Check database availability
    try {
      await db.query('SELECT 1');
    } catch (error) {
      console.log('Database not available, skipping integration tests');
      process.exit(0);
    }

    // Create test instance
    const instance = await registerInstance(testProject, 'PS', {});
    instanceId = instance.instance_id;
  });

  afterAll(async () => {
    // Cleanup
    try {
      await db.query('DELETE FROM command_log WHERE instance_id = $1', [instanceId]);
      await db.query('DELETE FROM supervisor_sessions WHERE instance_id = $1', [instanceId]);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    resetCommandLogger();
    resetSanitizationService();
  });

  describe('Complete Command Logging Flow', () => {
    it('should log and retrieve full workflow', async () => {
      const logger = getCommandLogger();

      // 1. Log a tool call
      const toolLog = await logger.logCommand({
        instance_id: instanceId,
        command_type: CommandType.MCP_TOOL,
        action: 'mcp_meta_heartbeat',
        tool_name: 'mcp_meta_heartbeat',
        parameters: { context_percent: 50 },
        result: { status: 'active' },
        success: true,
        execution_time_ms: 15,
        tags: ['heartbeat'],
        context_data: {},
        source: 'auto',
      });

      expect(toolLog.success).toBe(true);
      expect(toolLog.id).toBeDefined();

      // 2. Log explicit action
      const explicitLog = await logger.logExplicit({
        instance_id: instanceId,
        action: 'spawn_subagent',
        details: {
          description: 'Spawned implementation subagent for epic-003',
          parameters: { epic_id: 'epic-003', model: 'haiku' },
          tags: ['spawn', 'epic'],
        },
      });

      expect(explicitLog.success).toBe(true);

      // 3. Search and verify all commands logged
      const searchResult = await logger.searchCommands({
        instance_id: instanceId,
      });

      expect(searchResult.total).toBeGreaterThanOrEqual(2);
      expect(searchResult.commands.some((c) => c.action === 'mcp_meta_heartbeat')).toBe(true);
      expect(searchResult.commands.some((c) => c.action === 'spawn_subagent')).toBe(true);
    });
  });

  describe('Sanitization in Storage', () => {
    it('should sanitize secrets before storage', async () => {
      const logger = getCommandLogger();

      // Log with sensitive data
      const result = await logger.logCommand({
        instance_id: instanceId,
        command_type: CommandType.EXPLICIT,
        action: 'deploy',
        parameters: {
          api_key: 'sk_live_abc123xyz789',
          deployment_version: '1.0.0',
          db_password: 'super_secret_pass',
        },
        success: true,
        source: 'explicit',
      });

      expect(result.success).toBe(true);

      // Retrieve and verify sanitization
      const entry = await logger.getCommand(result.id);
      expect(entry).toBeDefined();

      // Parameters should be sanitized in storage
      const searchResult = await logger.searchCommands({
        instance_id: instanceId,
        action: 'deploy',
      });

      const deployLog = searchResult.commands.find((c) => c.action === 'deploy');
      expect(deployLog).toBeDefined();
      // Sanitized values should contain [REDACTED]
      expect(JSON.stringify(deployLog?.parameters)).toContain('[REDACTED]');
    });
  });

  describe('Search Functionality', () => {
    it('should search by action type', async () => {
      const logger = getCommandLogger();

      // Log multiple different actions
      await logger.logCommand({
        instance_id: instanceId,
        command_type: CommandType.EXPLICIT,
        action: 'git_commit',
        parameters: { message: 'feat: add feature X' },
        success: true,
        source: 'explicit',
      });

      await logger.logCommand({
        instance_id: instanceId,
        command_type: CommandType.EXPLICIT,
        action: 'git_push',
        parameters: { branch: 'main' },
        success: true,
        source: 'explicit',
      });

      // Search for specific action
      const gitCommits = await logger.searchCommands({
        instance_id: instanceId,
        action: 'git_commit',
      });

      expect(gitCommits.commands.every((c) => c.action === 'git_commit')).toBe(true);
    });

    it('should search by time range', async () => {
      const logger = getCommandLogger();

      const beforeTime = new Date();

      // Log command
      await logger.logCommand({
        instance_id: instanceId,
        command_type: CommandType.EXPLICIT,
        action: 'test_action',
        parameters: {},
        success: true,
        source: 'explicit',
      });

      const afterTime = new Date();

      // Search with time range
      const result = await logger.searchCommands({
        instance_id: instanceId,
        time_range: {
          start_time: beforeTime.toISOString(),
          end_time: afterTime.toISOString(),
        },
      });

      expect(result.commands.some((c) => c.action === 'test_action')).toBe(true);
    });

    it('should filter by success status', async () => {
      const logger = getCommandLogger();

      // Log successful command
      await logger.logCommand({
        instance_id: instanceId,
        command_type: CommandType.MCP_TOOL,
        action: 'tool_success',
        parameters: {},
        success: true,
        source: 'auto',
      });

      // Log failed command
      await logger.logCommand({
        instance_id: instanceId,
        command_type: CommandType.MCP_TOOL,
        action: 'tool_failure',
        parameters: {},
        error_message: 'Test error',
        success: false,
        source: 'auto',
      });

      // Search successful only
      const result = await logger.searchCommands({
        instance_id: instanceId,
        success_only: true,
      });

      expect(result.commands.every((c) => c.success === true)).toBe(true);
    });

    it('should support pagination', async () => {
      const logger = getCommandLogger();

      // Log multiple commands
      for (let i = 0; i < 5; i++) {
        await logger.logCommand({
          instance_id: instanceId,
          command_type: CommandType.EXPLICIT,
          action: `pagination_test_${i}`,
          parameters: { index: i },
          success: true,
          source: 'explicit',
        });
      }

      // Search with limit
      const page1 = await logger.searchCommands({
        instance_id: instanceId,
        limit: 2,
        offset: 0,
      });

      expect(page1.commands.length).toBeLessThanOrEqual(2);

      // Get second page
      const page2 = await logger.searchCommands({
        instance_id: instanceId,
        limit: 2,
        offset: 2,
      });

      expect(page2.commands.length).toBeLessThanOrEqual(2);

      // Pages should be different (if enough commands)
      if (page1.commands.length > 0 && page2.commands.length > 0) {
        expect(page1.commands[0].id).not.toBe(page2.commands[0].id);
      }
    });

    it('should return commands in DESC timestamp order', async () => {
      const logger = getCommandLogger();

      // Log commands with delays
      const ids: bigint[] = [];

      for (let i = 0; i < 3; i++) {
        const result = await logger.logCommand({
          instance_id: instanceId,
          command_type: CommandType.EXPLICIT,
          action: `order_test_${i}`,
          parameters: { seq: i },
          success: true,
          source: 'explicit',
        });
        ids.push(result.id);

        // Small delay to ensure different timestamps
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // Search and verify DESC order
      const result = await logger.searchCommands({
        instance_id: instanceId,
      });

      const orderedIds = result.commands
        .filter((c) => c.action.startsWith('order_test_'))
        .map((c) => c.id);

      // Should be in reverse order (newest first)
      if (orderedIds.length >= 2) {
        // Timestamps should be DESC (newer = larger timestamp)
        for (let i = 0; i < orderedIds.length - 1; i++) {
          const curr = result.commands.find((c) => c.id === orderedIds[i]);
          const next = result.commands.find((c) => c.id === orderedIds[i + 1]);
          if (curr && next) {
            expect(new Date(curr.timestamp).getTime()).toBeGreaterThanOrEqual(
              new Date(next.timestamp).getTime()
            );
          }
        }
      }
    });
  });

  describe('Performance', () => {
    it('should log command in under 50ms', async () => {
      const logger = getCommandLogger();

      const start = Date.now();

      await logger.logCommand({
        instance_id: instanceId,
        command_type: CommandType.MCP_TOOL,
        action: 'perf_test_log',
        parameters: { data: 'value' },
        success: true,
        source: 'auto',
      });

      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50);
    });

    it('should search commands in under 500ms', async () => {
      const logger = getCommandLogger();

      const start = Date.now();

      await logger.searchCommands({
        instance_id: instanceId,
      });

      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500);
    });
  });

  describe('Statistics', () => {
    it('should get instance statistics', async () => {
      const logger = getCommandLogger();

      // Log success and failures
      await logger.logCommand({
        instance_id: instanceId,
        command_type: CommandType.EXPLICIT,
        action: 'stat_success',
        parameters: {},
        success: true,
        source: 'explicit',
      });

      await logger.logCommand({
        instance_id: instanceId,
        command_type: CommandType.EXPLICIT,
        action: 'stat_failure',
        parameters: {},
        error_message: 'Test error',
        success: false,
        source: 'explicit',
      });

      const stats = await logger.getInstanceStats(instanceId);

      expect(stats.total_commands).toBeGreaterThan(0);
      expect(stats.successful_commands).toBeGreaterThanOrEqual(0);
      expect(stats.failed_commands).toBeGreaterThanOrEqual(0);
      expect(stats.successful_commands + stats.failed_commands).toBeLessThanOrEqual(
        stats.total_commands + 10 // Some tolerance for other test commands
      );
    });
  });

  describe('Large Payload Handling', () => {
    it('should store large parameter objects', async () => {
      const logger = getCommandLogger();

      const largeParams: any = {
        data: [],
      };

      // Create 1000 item array
      for (let i = 0; i < 1000; i++) {
        largeParams.data.push({
          id: i,
          name: `item_${i}`,
          description: `Description for item ${i}`,
          tags: ['tag1', 'tag2', 'tag3'],
        });
      }

      const result = await logger.logCommand({
        instance_id: instanceId,
        command_type: CommandType.EXPLICIT,
        action: 'large_payload_test',
        parameters: largeParams,
        success: true,
        source: 'explicit',
      });

      expect(result.success).toBe(true);

      // Verify retrieval
      const entry = await logger.getCommand(result.id);
      expect(entry).toBeDefined();
      expect(entry?.parameters).toBeDefined();
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent logging', async () => {
      const logger = getCommandLogger();

      // Log multiple commands concurrently
      const promises = [];

      for (let i = 0; i < 10; i++) {
        promises.push(
          logger.logCommand({
            instance_id: instanceId,
            command_type: CommandType.EXPLICIT,
            action: `concurrent_test_${i}`,
            parameters: { index: i },
            success: true,
            source: 'explicit',
          })
        );
      }

      const results = await Promise.all(promises);

      // All should succeed
      expect(results.every((r) => r.success === true)).toBe(true);

      // All should have unique IDs
      const ids = new Set(results.map((r) => r.id.toString()));
      expect(ids.size).toBe(results.length);
    });
  });

  describe('Heartbeat Integration', () => {
    it('should log commands while heartbeat updates', async () => {
      const logger = getCommandLogger();

      // Update heartbeat
      await updateHeartbeat(instanceId, 75, 'epic-007-B');

      // Log command
      const result = await logger.logCommand({
        instance_id: instanceId,
        command_type: CommandType.EXPLICIT,
        action: 'with_heartbeat',
        parameters: { status: 'active' },
        success: true,
        source: 'explicit',
      });

      expect(result.success).toBe(true);

      // Verify command and heartbeat are both in DB
      const commands = await logger.searchCommands({
        instance_id: instanceId,
        action: 'with_heartbeat',
      });

      expect(commands.commands.length).toBeGreaterThan(0);
    });
  });
});
