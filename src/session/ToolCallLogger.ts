/**
 * Tool Call Logger (Epic 007-B)
 * Wraps MCP tool calls to automatically log them
 * Transparent logging with minimal overhead (<10ms per call)
 */

import { CommandType } from '../types/command-log.js';
import { getCommandLogger } from './CommandLogger.js';

/**
 * Tool call logging context
 */
interface ToolCallContext {
  instanceId: string;
  toolName: string;
  parameters: Record<string, any>;
}

/**
 * Tool call executor function signature
 */
type ToolExecutor = () => Promise<any>;

/**
 * Tool call logger for wrapping MCP tool calls
 */
export class ToolCallLogger {
  private logger = getCommandLogger();

  /**
   * Wrap a tool call to automatically log it
   * Returns the result if successful, throws if executor throws
   * Logging failures never break the main tool call (fire-and-forget)
   */
  async wrapToolCall(
    context: ToolCallContext,
    executor: ToolExecutor
  ): Promise<any> {
    const startTime = Date.now();
    let result: any;
    let error: Error | null = null;
    let success = true;

    try {
      // Execute the actual tool
      result = await executor();
    } catch (e) {
      error = e as Error;
      success = false;
      // Re-throw after logging
    }

    const executionTimeMs = Date.now() - startTime;

    // Log asynchronously (fire-and-forget) to avoid blocking
    // Even if logging fails, the tool call succeeds
    this.logAsync(context, result, error, executionTimeMs, success).catch((err) => {
      console.error(`Failed to log tool call ${context.toolName}:`, err);
    });

    // If executor threw, re-throw the error
    if (!success) {
      throw error;
    }

    return result;
  }

  /**
   * Log the tool call asynchronously (non-blocking)
   */
  private async logAsync(
    context: ToolCallContext,
    result: any,
    error: Error | null,
    executionTimeMs: number,
    success: boolean
  ): Promise<void> {
    try {
      await this.logger.logCommand({
        instance_id: context.instanceId,
        command_type: CommandType.MCP_TOOL,
        action: context.toolName,
        tool_name: context.toolName,
        parameters: context.parameters,
        result: success ? result : null,
        error_message: error?.message,
        success,
        execution_time_ms: executionTimeMs,
        tags: [],
        context_data: {},
        source: 'auto',
      });
    } catch (logError) {
      // Silently fail - logging errors should never affect tool execution
      console.error(`Tool call logging error: ${(logError as Error).message}`);
    }
  }
}

/**
 * Global instance (singleton)
 */
let globalToolLogger: ToolCallLogger | null = null;

/**
 * Get or create the global tool call logger
 */
export function getToolCallLogger(): ToolCallLogger {
  if (!globalToolLogger) {
    globalToolLogger = new ToolCallLogger();
  }
  return globalToolLogger;
}

/**
 * Reset the global instance (for testing)
 */
export function resetToolCallLogger(): void {
  globalToolLogger = null;
}

/**
 * Middleware factory for auto-wrapping tool calls
 * Integrates with MCP server tool handling
 */
export function createToolCallLoggingMiddleware() {
  const logger = getToolCallLogger();

  return async (
    toolName: string,
    parameters: Record<string, any>,
    instanceId: string,
    executor: ToolExecutor
  ): Promise<any> => {
    // Skip logging for certain internal tools
    const excludeLogging = ['mcp_meta_log_command', 'mcp_meta_search_commands'];

    if (excludeLogging.includes(toolName)) {
      // Execute without logging
      return executor();
    }

    // Wrap with logging
    return logger.wrapToolCall(
      {
        instanceId,
        toolName,
        parameters,
      },
      executor
    );
  };
}
