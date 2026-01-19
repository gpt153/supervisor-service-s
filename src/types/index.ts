/**
 * Type definitions for supervisor-service
 */

import { z } from 'zod';

// Tool execution context
export interface ToolContext {
  requestId: string;
  timestamp: Date;
}

// Tool definition
export interface Tool {
  name: string;
  description: string;
  inputSchema: z.ZodType<any>;
  handler: (input: any, context: ToolContext) => Promise<any>;
}

// MCP Protocol types
export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: MCPError;
}

export interface MCPError {
  code: number;
  message: string;
  data?: any;
}

// Server state (in-memory for now)
export interface ServerState {
  startTime: Date;
  requestCount: number;
  errorCount: number;
  tools: Map<string, Tool>;
}

// Health check response
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  uptime: number;
  timestamp: string;
  version: string;
  requestCount: number;
  errorCount: number;
}

// Tool registration
export interface ToolRegistration {
  endpoint: string; // e.g., '/mcp/meta'
  tools: Tool[];
}

// Error types
export enum ErrorCode {
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
  TOOL_NOT_FOUND = -32001,
  TOOL_EXECUTION_ERROR = -32002,
}
