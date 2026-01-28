/**
 * Unit Tests for ToolCallLogger (Epic 007-B)
 * Tests MCP tool auto-wrapping and logging
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  ToolCallLogger,
  getToolCallLogger,
  resetToolCallLogger,
  createToolCallLoggingMiddleware,
} from '../../../src/session/ToolCallLogger.js';
import { getCommandLogger, resetCommandLogger } from '../../../src/session/CommandLogger.js';

// Mock the command logger
jest.mock('../../../src/session/CommandLogger.js', () => ({
  getCommandLogger: jest.fn().mockReturnValue({
    logCommand: jest.fn().mockResolvedValue({
      id: BigInt(1),
      timestamp: new Date().toISOString(),
      instance_id: 'test-PS-abc123',
      action: 'test_tool',
      success: true,
    }),
  }),
  resetCommandLogger: jest.fn(),
}));

describe('ToolCallLogger', () => {
  let logger: ToolCallLogger;
  let mockCommandLogger: any;

  beforeEach(() => {
    resetToolCallLogger();
    resetCommandLogger();
    logger = new ToolCallLogger();
    mockCommandLogger = getCommandLogger();
  });

  afterEach(() => {
    resetToolCallLogger();
    jest.clearAllMocks();
  });

  describe('wrapToolCall', () => {
    it('should execute tool and log successful call', async () => {
      const mockExecutor = jest.fn().mockResolvedValue({ data: 'result' });

      const result = await logger.wrapToolCall(
        {
          instanceId: 'test-PS-abc123',
          toolName: 'test_tool',
          parameters: { input: 'value' },
        },
        mockExecutor
      );

      expect(result).toEqual({ data: 'result' });
      expect(mockExecutor).toHaveBeenCalledTimes(1);
      expect(mockCommandLogger.logCommand).toHaveBeenCalled();
    });

    it('should log tool call with execution time', async () => {
      const mockExecutor = jest.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { success: true };
      });

      await logger.wrapToolCall(
        {
          instanceId: 'test-PS-abc123',
          toolName: 'test_tool',
          parameters: {},
        },
        mockExecutor
      );

      const logCall = mockCommandLogger.logCommand.mock.calls[0][0];
      expect(logCall.execution_time_ms).toBeGreaterThanOrEqual(50);
    });

    it('should propagate executor errors', async () => {
      const testError = new Error('Tool execution failed');
      const mockExecutor = jest.fn().mockRejectedValue(testError);

      await expect(
        logger.wrapToolCall(
          {
            instanceId: 'test-PS-abc123',
            toolName: 'failing_tool',
            parameters: {},
          },
          mockExecutor
        )
      ).rejects.toThrow('Tool execution failed');
    });

    it('should log failed tool calls', async () => {
      const testError = new Error('Database error');
      const mockExecutor = jest.fn().mockRejectedValue(testError);

      try {
        await logger.wrapToolCall(
          {
            instanceId: 'test-PS-abc123',
            toolName: 'failing_tool',
            parameters: { action: 'update' },
          },
          mockExecutor
        );
      } catch (e) {
        // Expected
      }

      const logCall = mockCommandLogger.logCommand.mock.calls[0][0];
      expect(logCall.success).toBe(false);
      expect(logCall.error_message).toBe('Database error');
    });

    it('should not block if logging fails', async () => {
      const mockExecutor = jest.fn().mockResolvedValue({ data: 'result' });

      // Mock logging to fail
      mockCommandLogger.logCommand.mockRejectedValueOnce(
        new Error('Logging failed')
      );

      // Should not throw
      const result = await logger.wrapToolCall(
        {
          instanceId: 'test-PS-abc123',
          toolName: 'test_tool',
          parameters: {},
        },
        mockExecutor
      );

      expect(result).toEqual({ data: 'result' });
    });

    it('should include parameters in log', async () => {
      const mockExecutor = jest.fn().mockResolvedValue(null);
      const testParams = { user_id: 123, action: 'create', tags: ['important'] };

      await logger.wrapToolCall(
        {
          instanceId: 'test-PS-abc123',
          toolName: 'create_resource',
          parameters: testParams,
        },
        mockExecutor
      );

      const logCall = mockCommandLogger.logCommand.mock.calls[0][0];
      expect(logCall.parameters).toEqual(testParams);
    });

    it('should mark as auto source', async () => {
      const mockExecutor = jest.fn().mockResolvedValue(null);

      await logger.wrapToolCall(
        {
          instanceId: 'test-PS-abc123',
          toolName: 'test_tool',
          parameters: {},
        },
        mockExecutor
      );

      const logCall = mockCommandLogger.logCommand.mock.calls[0][0];
      expect(logCall.source).toBe('auto');
      expect(logCall.command_type).toBe('mcp_tool');
    });
  });

  describe('Middleware Integration', () => {
    it('should create middleware factory', () => {
      const middleware = createToolCallLoggingMiddleware();
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });

    it('should execute tool through middleware', async () => {
      const middleware = createToolCallLoggingMiddleware();
      const mockExecutor = jest.fn().mockResolvedValue({ data: 'test' });

      const result = await middleware(
        'test_tool',
        { param: 'value' },
        'test-PS-abc123',
        mockExecutor
      );

      expect(result).toEqual({ data: 'test' });
      expect(mockExecutor).toHaveBeenCalledTimes(1);
    });

    it('should skip logging for internal tools', async () => {
      const middleware = createToolCallLoggingMiddleware();
      const mockExecutor = jest.fn().mockResolvedValue({ success: true });

      // Clear previous calls
      mockCommandLogger.logCommand.mockClear();

      // Call with internal tool
      await middleware(
        'mcp_meta_log_command',
        { action: 'test' },
        'test-PS-abc123',
        mockExecutor
      );

      // Should execute but not log
      expect(mockExecutor).toHaveBeenCalledTimes(1);
      // Check if logging was skipped (no new log calls)
      expect(mockCommandLogger.logCommand).not.toHaveBeenCalled();
    });

    it('should skip logging for search commands tool', async () => {
      const middleware = createToolCallLoggingMiddleware();
      const mockExecutor = jest.fn().mockResolvedValue({ commands: [] });

      mockCommandLogger.logCommand.mockClear();

      await middleware(
        'mcp_meta_search_commands',
        { instance_id: 'test' },
        'test-PS-abc123',
        mockExecutor
      );

      expect(mockExecutor).toHaveBeenCalledTimes(1);
      expect(mockCommandLogger.logCommand).not.toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    it('should have minimal overhead', async () => {
      const mockExecutor = jest.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { success: true };
      });

      const start = Date.now();
      await logger.wrapToolCall(
        {
          instanceId: 'test-PS-abc123',
          toolName: 'test_tool',
          parameters: {},
        },
        mockExecutor
      );
      const duration = Date.now() - start;

      // Should not add more than 50ms overhead on top of executor time
      expect(duration).toBeLessThan(200);
    });

    it('should handle rapid successive calls', async () => {
      const mockExecutor = jest.fn().mockResolvedValue({ success: true });

      for (let i = 0; i < 10; i++) {
        await logger.wrapToolCall(
          {
            instanceId: 'test-PS-abc123',
            toolName: `tool_${i}`,
            parameters: { index: i },
          },
          mockExecutor
        );
      }

      expect(mockExecutor).toHaveBeenCalledTimes(10);
      expect(mockCommandLogger.logCommand).toHaveBeenCalledTimes(10);
    });
  });

  describe('Context Handling', () => {
    it('should preserve tool name in log', async () => {
      const mockExecutor = jest.fn().mockResolvedValue(null);

      const toolName = 'mcp_meta_deploy_service';
      await logger.wrapToolCall(
        {
          instanceId: 'test-PS-abc123',
          toolName,
          parameters: {},
        },
        mockExecutor
      );

      const logCall = mockCommandLogger.logCommand.mock.calls[0][0];
      expect(logCall.tool_name).toBe(toolName);
      expect(logCall.action).toBe(toolName);
    });

    it('should preserve instance ID in log', async () => {
      const mockExecutor = jest.fn().mockResolvedValue(null);

      const instanceId = 'odin-PS-abc123';
      await logger.wrapToolCall(
        {
          instanceId,
          toolName: 'test_tool',
          parameters: {},
        },
        mockExecutor
      );

      const logCall = mockCommandLogger.logCommand.mock.calls[0][0];
      expect(logCall.instance_id).toBe(instanceId);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance on multiple calls', () => {
      const instance1 = getToolCallLogger();
      const instance2 = getToolCallLogger();
      expect(instance1).toBe(instance2);
    });

    it('should reset and create new instance', () => {
      const instance1 = getToolCallLogger();
      resetToolCallLogger();
      const instance2 = getToolCallLogger();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Error Messages', () => {
    it('should include error message in log', async () => {
      const errorMsg = 'Connection timed out after 30s';
      const mockExecutor = jest.fn().mockRejectedValue(new Error(errorMsg));

      try {
        await logger.wrapToolCall(
          {
            instanceId: 'test-PS-abc123',
            toolName: 'slow_tool',
            parameters: {},
          },
          mockExecutor
        );
      } catch (e) {
        // Expected
      }

      const logCall = mockCommandLogger.logCommand.mock.calls[0][0];
      expect(logCall.error_message).toBe(errorMsg);
    });

    it('should handle errors without stack traces', async () => {
      const mockExecutor = jest.fn().mockRejectedValue('String error');

      try {
        await logger.wrapToolCall(
          {
            instanceId: 'test-PS-abc123',
            toolName: 'test_tool',
            parameters: {},
          },
          mockExecutor
        );
      } catch (e) {
        // Expected
      }

      const logCall = mockCommandLogger.logCommand.mock.calls[0][0];
      expect(logCall.success).toBe(false);
    });
  });
});
