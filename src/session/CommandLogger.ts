/**
 * Command Logger Service (Epic 007-B)
 * Inserts and queries logged commands from the database
 * Handles both auto-wrapped MCP calls and explicit logs
 */

import { query as dbQuery } from '../db/index.js';
import {
  CommandLogEntry,
  LogCommandInput,
  ExplicitLogInput,
  LogCommandOutput,
  SearchCommandsInput,
  SearchCommandsOutput,
  CommandSearchResult,
  CommandType,
} from '../types/command-log.js';
import { getSanitizationService } from './SanitizationService.js';

/**
 * Command logger service
 */
export class CommandLogger {
  /**
   * Log a command to the database
   * Handles sanitization before storage
   */
  async logCommand(input: LogCommandInput): Promise<LogCommandOutput> {
    const start = Date.now();

    try {
      // Sanitize data before storage
      const sanitizer = await getSanitizationService();
      const sanitizedParams = await sanitizer.sanitizeForStorage(input.parameters);
      const sanitizedResult = input.result
        ? await sanitizer.sanitizeForStorage(input.result)
        : null;

      // Validate instance exists
      const instanceCheck = await dbQuery(
        `SELECT instance_id FROM supervisor_sessions WHERE instance_id = $1`,
        [input.instance_id]
      );

      if (instanceCheck.rows.length === 0) {
        throw new Error(`Instance not found: ${input.instance_id}`);
      }

      // Insert command log
      const result = await dbQuery(
        `INSERT INTO command_log (
          instance_id, command_type, action, tool_name,
          parameters, result, error_message,
          success, execution_time_ms, tags, context_data, source, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
        RETURNING id, created_at`,
        [
          input.instance_id,
          input.command_type,
          input.action,
          input.tool_name || null,
          JSON.stringify(sanitizedParams),
          sanitizedResult ? JSON.stringify(sanitizedResult) : null,
          input.error_message || null,
          input.success,
          input.execution_time_ms || null,
          JSON.stringify(input.tags || []),
          JSON.stringify(input.context_data || {}),
          input.source,
        ]
      );

      const duration = Date.now() - start;

      if (duration > 50) {
        console.warn(`Command logging slow: ${duration}ms for ${input.action}`);
      }

      const row = result.rows[0];

      return {
        id: BigInt(row.id),
        timestamp: row.created_at.toISOString(),
        instance_id: input.instance_id,
        action: input.action,
        success: input.success,
      };
    } catch (error) {
      console.error('Failed to log command:', error);
      throw error;
    }
  }

  /**
   * Log an explicit command with rich context
   * Handles user-facing API for spawns, git operations, planning
   */
  async logExplicit(input: ExplicitLogInput): Promise<LogCommandOutput> {
    return this.logCommand({
      instance_id: input.instance_id,
      command_type: CommandType.EXPLICIT,
      action: input.details.description || input.action,
      parameters: input.details.parameters || {},
      result: input.details.result,
      success: true,
      tags: input.details.tags || [],
      context_data: input.details.context_data || {},
      source: 'explicit',
    });
  }

  /**
   * Search command history with filters
   */
  async searchCommands(input: SearchCommandsInput): Promise<SearchCommandsOutput> {
    const start = Date.now();

    try {
      // Build dynamic query
      const { sql, params } = this.buildSearchQuery(input);

      const result = await dbQuery(sql, params);

      const duration = Date.now() - start;

      if (duration > 500) {
        console.warn(`Search commands slow: ${duration}ms for instance ${input.instance_id}`);
      }

      const commands: CommandSearchResult[] = result.rows.map((row) => ({
        id: BigInt(row.id),
        action: row.action,
        tool_name: row.tool_name,
        timestamp: row.created_at.toISOString(),
        parameters: row.parameters,
        result: row.result,
        success: row.success,
        execution_time_ms: row.execution_time_ms,
        tags: row.tags,
        source: row.source,
      }));

      return {
        commands,
        total: result.rows.length,
        instance_id: input.instance_id,
      };
    } catch (error) {
      console.error('Failed to search commands:', error);
      throw error;
    }
  }

  /**
   * Build dynamic search query with optional filters
   */
  private buildSearchQuery(
    input: SearchCommandsInput
  ): { sql: string; params: any[] } {
    let sql = `
      SELECT id, action, tool_name, parameters, result, success,
             execution_time_ms, tags, source, created_at
      FROM command_log
      WHERE instance_id = $1
    `;
    const params: any[] = [input.instance_id];
    let paramIndex = 2;

    if (input.action) {
      sql += ` AND action = $${paramIndex}`;
      params.push(input.action);
      paramIndex++;
    }

    if (input.tool_name) {
      sql += ` AND tool_name = $${paramIndex}`;
      params.push(input.tool_name);
      paramIndex++;
    }

    if (input.time_range?.start_time) {
      sql += ` AND created_at >= $${paramIndex}::TIMESTAMP`;
      params.push(input.time_range.start_time);
      paramIndex++;
    }

    if (input.time_range?.end_time) {
      sql += ` AND created_at <= $${paramIndex}::TIMESTAMP`;
      params.push(input.time_range.end_time);
      paramIndex++;
    }

    if (input.success_only) {
      sql += ` AND success = true`;
    }

    sql += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(input.limit || 100);
    params.push(input.offset || 0);

    return { sql, params };
  }

  /**
   * Get command by ID
   */
  async getCommand(id: bigint): Promise<CommandLogEntry | null> {
    try {
      const result = await dbQuery(
        `SELECT * FROM command_log WHERE id = $1`,
        [id.toString()]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0] as any;
      return this.rowToEntry(row);
    } catch (error) {
      console.error('Failed to get command:', error);
      throw error;
    }
  }

  /**
   * Get command statistics for an instance
   */
  async getInstanceStats(instanceId: string): Promise<{
    total_commands: number;
    successful_commands: number;
    failed_commands: number;
    tools_used: string[];
    actions_used: string[];
  }> {
    try {
      const result = await dbQuery(
        `SELECT
          COUNT(*) as total_commands,
          COUNT(CASE WHEN success = true THEN 1 END) as successful_commands,
          COUNT(CASE WHEN success = false THEN 1 END) as failed_commands,
          ARRAY_AGG(DISTINCT tool_name) FILTER (WHERE tool_name IS NOT NULL) as tools_used,
          ARRAY_AGG(DISTINCT action) as actions_used
        FROM command_log
        WHERE instance_id = $1`,
        [instanceId]
      );

      const row = result.rows[0];
      return {
        total_commands: parseInt(row.total_commands, 10),
        successful_commands: parseInt(row.successful_commands, 10),
        failed_commands: parseInt(row.failed_commands, 10),
        tools_used: row.tools_used || [],
        actions_used: row.actions_used || [],
      };
    } catch (error) {
      console.error('Failed to get instance stats:', error);
      throw error;
    }
  }

  /**
   * Convert database row to CommandLogEntry
   */
  private rowToEntry(row: any): CommandLogEntry {
    return {
      id: BigInt(row.id),
      instance_id: row.instance_id,
      command_type: row.command_type as any,
      action: row.action,
      tool_name: row.tool_name,
      parameters: row.parameters || {},
      result: row.result,
      error_message: row.error_message,
      success: row.success,
      execution_time_ms: row.execution_time_ms,
      tags: row.tags || [],
      context_data: row.context_data || {},
      created_at: new Date(row.created_at),
      source: row.source,
    };
  }
}

/**
 * Global instance (singleton)
 */
let globalLogger: CommandLogger | null = null;

/**
 * Get or create the global command logger
 */
export function getCommandLogger(): CommandLogger {
  if (!globalLogger) {
    globalLogger = new CommandLogger();
  }
  return globalLogger;
}

/**
 * Reset the global instance (for testing)
 */
export function resetCommandLogger(): void {
  globalLogger = null;
}
