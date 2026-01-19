/**
 * MCP Protocol handler
 */

import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { MCPRequest, MCPResponse, ToolContext, ErrorCode } from '../types/index.js';
import { MCPServerError, handleError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import {
  getTool,
  getAllTools,
  incrementRequestCount,
  incrementErrorCount,
} from './state.js';

// Request validation schema
const MCPRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  method: z.string(),
  params: z.any().optional(),
});

/**
 * Process an MCP request and return a response
 */
export async function processMCPRequest(
  request: unknown
): Promise<MCPResponse> {
  incrementRequestCount();

  try {
    // Validate request structure
    const validatedRequest = MCPRequestSchema.parse(request) as MCPRequest;

    logger.debug({ request: validatedRequest }, 'Processing MCP request');

    // Route to appropriate handler
    const result = await routeRequest(validatedRequest);

    return {
      jsonrpc: '2.0',
      id: validatedRequest.id,
      result,
    };
  } catch (error) {
    incrementErrorCount();
    logger.error({ error }, 'Error processing MCP request');

    const mcpError = handleError(error);

    return {
      jsonrpc: '2.0',
      id: typeof request === 'object' && request !== null && 'id' in request
        ? (request as any).id
        : null,
      error: mcpError,
    };
  }
}

/**
 * Route request to appropriate handler based on method
 */
async function routeRequest(request: MCPRequest): Promise<any> {
  switch (request.method) {
    case 'tools/list':
      return handleListTools();

    case 'tools/call':
      return handleToolCall(request.params);

    case 'initialize':
      return handleInitialize(request.params);

    case 'ping':
      return { pong: true };

    default:
      throw new MCPServerError(
        ErrorCode.METHOD_NOT_FOUND,
        `Method not found: ${request.method}`
      );
  }
}

/**
 * Handle initialize request
 */
function handleInitialize(params?: any): any {
  return {
    protocolVersion: '2024-11-05',
    serverInfo: {
      name: 'supervisor-service',
      version: '1.0.0',
    },
    capabilities: {
      tools: {},
    },
  };
}

/**
 * Handle tools/list request
 */
function handleListTools(): any {
  const tools = getAllTools();

  return {
    tools: tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema._def,
    })),
  };
}

/**
 * Handle tools/call request
 */
async function handleToolCall(params?: any): Promise<any> {
  if (!params || !params.name) {
    throw new MCPServerError(
      ErrorCode.INVALID_PARAMS,
      'Tool name is required'
    );
  }

  const { name, arguments: args } = params;

  // Find the tool
  const tool = getTool(name);
  if (!tool) {
    throw new MCPServerError(
      ErrorCode.TOOL_NOT_FOUND,
      `Tool not found: ${name}`
    );
  }

  // Validate input
  let validatedInput;
  try {
    validatedInput = tool.inputSchema.parse(args || {});
  } catch (error) {
    throw new MCPServerError(
      ErrorCode.INVALID_PARAMS,
      'Invalid tool parameters',
      { validationError: error }
    );
  }

  // Create execution context
  const context: ToolContext = {
    requestId: uuidv4(),
    timestamp: new Date(),
  };

  // Execute tool
  try {
    const result = await tool.handler(validatedInput, context);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    logger.error({ error, toolName: name }, 'Tool execution failed');
    throw new MCPServerError(
      ErrorCode.TOOL_EXECUTION_ERROR,
      `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
      { originalError: error }
    );
  }
}
