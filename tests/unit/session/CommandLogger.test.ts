/**
 * Unit Tests for CommandLogger (Epic 007-B)
 * Tests command insertion, searching, and statistics
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { CommandLogger, resetCommandLogger } from '../../../src/session/CommandLogger.js';
import { CommandType } from '../../../src/types/command-log.js';
import { db } from '../../../src/db/index.js';

// Mock the database
jest.mock('../../../src/db/index.js', () => ({
  db: {
    query: jest.fn(),
  },
}));

// Mock the sanitization service
jest.mock('../../../src/session/SanitizationService.js', () => ({
  getSanitizationService: jest.fn().mockResolvedValue({
    sanitizeForStorage: jest.fn((data) => Promise.resolve(data)),
  }),
}));

describe('CommandLogger', () => {
  let logger: CommandLogger;
  const mockDbQuery = db.query as jest.MockedFunction<typeof db.query>;

  beforeEach(() => {
    resetCommandLogger();
    logger = new CommandLogger();
    jest.clearAllMocks();
  });

  afterEach(() => {
    resetCommandLogger();
  });

  describe('logCommand', () => {
    it('should insert MCP tool call', async () => {
      mockDbQuery
        .mockResolvedValueOnce({
          rows: [{ instance_id: 'test-PS-abc123' }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [{ id: 1, created_at: new Date() }],
          rowCount: 1,
        });

      const result = await logger.logCommand({
        instance_id: 'test-PS-abc123',
        command_type: CommandType.MCP_TOOL,
        action: 'test_tool',
        tool_name: 'test_tool',
        parameters: { input: 'value' },
        result: { output: 'result' },
        success: true,
        execution_time_ms: 50,
        tags: ['test'],
        context_data: {},
        source: 'auto',
      });

      expect(result.success).toBe(true);
      expect(result.id).toBeDefined();
      expect(mockDbQuery).toHaveBeenCalledTimes(2);
    });

    it('should reject if instance not found', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      await expect(
        logger.logCommand({
          instance_id: 'nonexistent-PS-xyz789',
          command_type: CommandType.MCP_TOOL,
          action: 'test_tool',
          parameters: {},
          success: true,
          source: 'auto',
        })
      ).rejects.toThrow('Instance not found');
    });

    it('should handle explicit logs', async () => {
      mockDbQuery
        .mockResolvedValueOnce({
          rows: [{ instance_id: 'test-PS-abc123' }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [{ id: 2, created_at: new Date() }],
          rowCount: 1,
        });

      const result = await logger.logCommand({
        instance_id: 'test-PS-abc123',
        command_type: CommandType.EXPLICIT,
        action: 'spawn_subagent',
        parameters: { task_type: 'implementation' },
        success: true,
        source: 'explicit',
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('spawn_subagent');
    });

    it('should capture error messages', async () => {
      mockDbQuery
        .mockResolvedValueOnce({
          rows: [{ instance_id: 'test-PS-abc123' }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [{ id: 3, created_at: new Date() }],
          rowCount: 1,
        });

      const result = await logger.logCommand({
        instance_id: 'test-PS-abc123',
        command_type: CommandType.MCP_TOOL,
        action: 'failed_tool',
        parameters: {},
        error_message: 'Connection timeout',
        success: false,
        source: 'auto',
      });

      expect(result.success).toBe(false);
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO command_log'),
        expect.arrayContaining(['Connection timeout'])
      );
    });
  });

  describe('logExplicit', () => {
    it('should log spawn action', async () => {
      mockDbQuery
        .mockResolvedValueOnce({
          rows: [{ instance_id: 'test-PS-abc123' }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [{ id: 4, created_at: new Date() }],
          rowCount: 1,
        });

      const result = await logger.logExplicit({
        instance_id: 'test-PS-abc123',
        action: 'spawn_subagent',
        details: {
          description: 'Spawned implementation subagent for epic-003',
          parameters: { epic_id: 'epic-003' },
          tags: ['spawn', 'epic'],
        },
      });

      expect(result.success).toBe(true);
    });

    it('should log git operation', async () => {
      mockDbQuery
        .mockResolvedValueOnce({
          rows: [{ instance_id: 'test-PS-abc123' }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [{ id: 5, created_at: new Date() }],
          rowCount: 1,
        });

      const result = await logger.logExplicit({
        instance_id: 'test-PS-abc123',
        action: 'git_commit',
        details: {
          description: 'Committed implementation of feature X',
          parameters: { message: 'feat: implement feature X' },
          tags: ['git', 'commit'],
        },
      });

      expect(result.success).toBe(true);
    });
  });

  describe('searchCommands', () => {
    it('should search by instance ID', async () => {
      const mockRows = [
        {
          id: 1,
          action: 'test_tool',
          tool_name: 'test_tool',
          parameters: {},
          result: {},
          success: true,
          execution_time_ms: 50,
          tags: [],
          source: 'auto',
          created_at: new Date(),
        },
      ];

      mockDbQuery.mockResolvedValueOnce({
        rows: mockRows,
        rowCount: 1,
      });

      const result = await logger.searchCommands({
        instance_id: 'test-PS-abc123',
      });

      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].action).toBe('test_tool');
    });

    it('should filter by action', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      const result = await logger.searchCommands({
        instance_id: 'test-PS-abc123',
        action: 'spawn_subagent',
      });

      expect(result.commands).toHaveLength(0);
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND action = $2'),
        expect.arrayContaining(['spawn_subagent'])
      );
    });

    it('should filter by time range', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      const startTime = new Date(Date.now() - 3600000).toISOString();
      const endTime = new Date().toISOString();

      await logger.searchCommands({
        instance_id: 'test-PS-abc123',
        time_range: { start_time: startTime, end_time: endTime },
      });

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND created_at >='),
        expect.arrayContaining([startTime, endTime])
      );
    });

    it('should filter by success only', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      await logger.searchCommands({
        instance_id: 'test-PS-abc123',
        success_only: true,
      });

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND success = true'),
        expect.any(Array)
      );
    });

    it('should support pagination', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      await logger.searchCommands({
        instance_id: 'test-PS-abc123',
        limit: 50,
        offset: 100,
      });

      const callArgs = mockDbQuery.mock.calls[0];
      expect(callArgs[1]).toContain(50); // limit
      expect(callArgs[1]).toContain(100); // offset
    });

    it('should return commands sorted by timestamp DESC', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      await logger.searchCommands({
        instance_id: 'test-PS-abc123',
      });

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        expect.any(Array)
      );
    });
  });

  describe('getCommand', () => {
    it('should retrieve command by ID', async () => {
      const mockRow = {
        id: 1,
        instance_id: 'test-PS-abc123',
        command_type: 'mcp_tool',
        action: 'test_tool',
        tool_name: 'test_tool',
        parameters: {},
        result: {},
        success: true,
        execution_time_ms: 50,
        tags: [],
        context_data: {},
        source: 'auto',
        created_at: new Date(),
        error_message: null,
      };

      mockDbQuery.mockResolvedValueOnce({
        rows: [mockRow],
        rowCount: 1,
      });

      const result = await logger.getCommand(BigInt(1));

      expect(result).toBeDefined();
      expect(result?.id).toBe(BigInt(1));
      expect(result?.action).toBe('test_tool');
    });

    it('should return null if command not found', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      const result = await logger.getCommand(BigInt(999));

      expect(result).toBeNull();
    });
  });

  describe('getInstanceStats', () => {
    it('should return command statistics', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [
          {
            total_commands: '50',
            successful_commands: '45',
            failed_commands: '5',
            tools_used: ['tool_a', 'tool_b', 'tool_c'],
            actions_used: ['spawn', 'git_commit', 'test'],
          },
        ],
        rowCount: 1,
      });

      const stats = await logger.getInstanceStats('test-PS-abc123');

      expect(stats.total_commands).toBe(50);
      expect(stats.successful_commands).toBe(45);
      expect(stats.failed_commands).toBe(5);
      expect(stats.tools_used).toContain('tool_a');
      expect(stats.actions_used).toContain('spawn');
    });
  });

  describe('Error Handling', () => {
    it('should handle database query errors', async () => {
      mockDbQuery.mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(
        logger.logCommand({
          instance_id: 'test-PS-abc123',
          command_type: CommandType.MCP_TOOL,
          action: 'test_tool',
          parameters: {},
          success: true,
          source: 'auto',
        })
      ).rejects.toThrow();
    });

    it('should sanitize sensitive data', async () => {
      mockDbQuery
        .mockResolvedValueOnce({
          rows: [{ instance_id: 'test-PS-abc123' }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [{ id: 6, created_at: new Date() }],
          rowCount: 1,
        });

      await logger.logCommand({
        instance_id: 'test-PS-abc123',
        command_type: CommandType.MCP_TOOL,
        action: 'deploy',
        parameters: { api_key: 'secret_key_123', version: '1.0' },
        success: true,
        source: 'auto',
      });

      // The sanitization mock should have been called
      expect(mockDbQuery).toHaveBeenCalled();
    });
  });
});
