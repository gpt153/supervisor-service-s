/**
 * Command Logging types for Epic 007-B
 * Defines types for command logging, sanitization, and search
 */

import { z } from 'zod';

/**
 * Command type enumeration
 */
export enum CommandType {
  MCP_TOOL = 'mcp_tool',     // Auto-wrapped MCP tool call
  EXPLICIT = 'explicit',      // Manual explicit log
}

/**
 * Command log entry from database
 */
export interface CommandLogEntry {
  id: bigint;
  instance_id: string;
  command_type: CommandType;
  action: string;
  tool_name?: string;
  parameters: Record<string, any>;
  result?: Record<string, any>;
  error_message?: string;
  success: boolean;
  execution_time_ms?: number;
  tags: string[];
  context_data: Record<string, any>;
  created_at: Date;
  source: 'auto' | 'explicit';
}

/**
 * Input for logging a command
 */
export interface LogCommandInput {
  instance_id: string;
  command_type: CommandType;
  action: string;
  tool_name?: string;
  parameters: Record<string, any>;
  result?: Record<string, any>;
  error_message?: string;
  success: boolean;
  execution_time_ms?: number;
  tags?: string[];
  context_data?: Record<string, any>;
  source: 'auto' | 'explicit';
}

/**
 * Input for explicit logging (user-facing API)
 */
export interface ExplicitLogInput {
  instance_id: string;
  action: string;
  details: {
    description?: string;
    parameters?: Record<string, any>;
    result?: Record<string, any>;
    tags?: string[];
    context_data?: Record<string, any>;
  };
}

/**
 * Output from logging a command
 */
export interface LogCommandOutput {
  id: bigint;
  timestamp: string; // ISO 8601
  instance_id: string;
  action: string;
  success: boolean;
}

/**
 * Search filters for command history
 */
export interface SearchCommandsInput {
  instance_id: string;
  action?: string;
  tool_name?: string;
  time_range?: {
    start_time?: string; // ISO 8601
    end_time?: string;   // ISO 8601
  };
  success_only?: boolean;
  limit?: number;         // Max 1000, default 100
  offset?: number;        // Default 0
}

/**
 * Command item in search results
 */
export interface CommandSearchResult {
  id: bigint;
  action: string;
  tool_name?: string;
  timestamp: string; // ISO 8601
  parameters: Record<string, any>;
  result?: Record<string, any>;
  success: boolean;
  execution_time_ms?: number;
  tags: string[];
  source: 'auto' | 'explicit';
}

/**
 * Output from searching commands
 */
export interface SearchCommandsOutput {
  commands: CommandSearchResult[];
  total: number;
  instance_id: string;
}

/**
 * Secret pattern configuration
 */
export interface SecretPattern {
  id: number;
  pattern_name: string;
  regex_pattern: string;
  enabled: boolean;
  replacement_text: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Tool call wrapper context
 */
export interface ToolCallContext {
  instance_id: string;
  tool_name: string;
  parameters: Record<string, any>;
}

/**
 * Zod validation schemas
 */

export const CommandTypeSchema = z.enum(['mcp_tool', 'explicit']);

export const LogCommandInputSchema = z.object({
  instance_id: z.string().min(1),
  command_type: CommandTypeSchema,
  action: z.string().min(1).max(128),
  tool_name: z.string().optional(),
  parameters: z.record(z.string(), z.any()).default({}),
  result: z.record(z.string(), z.any()).optional(),
  error_message: z.string().optional(),
  success: z.boolean().default(true),
  execution_time_ms: z.number().int().min(0).optional(),
  tags: z.array(z.string()).default([]),
  context_data: z.record(z.string(), z.any()).default({}),
  source: z.enum(['auto', 'explicit']),
});

export const ExplicitLogInputSchema = z.object({
  instance_id: z.string().min(1),
  action: z.string().min(1),
  details: z.object({
    description: z.string().optional(),
    parameters: z.record(z.string(), z.any()).optional(),
    result: z.record(z.string(), z.any()).optional(),
    tags: z.array(z.string()).optional(),
    context_data: z.record(z.string(), z.any()).optional(),
  }),
});

export const SearchCommandsInputSchema = z.object({
  instance_id: z.string().min(1),
  action: z.string().optional(),
  tool_name: z.string().optional(),
  time_range: z.object({
    start_time: z.string().optional(),
    end_time: z.string().optional(),
  }).optional(),
  success_only: z.boolean().optional(),
  limit: z.number().int().min(1).max(1000).default(100),
  offset: z.number().int().min(0).default(0),
});
