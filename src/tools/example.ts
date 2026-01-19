/**
 * Example tools for the meta endpoint
 */

import { z } from 'zod';
import { Tool } from '../types/index.js';
import { logger } from '../utils/logger.js';

// Example: Echo tool
export const echoTool: Tool = {
  name: 'echo',
  description: 'Echoes back the input message',
  inputSchema: z.object({
    message: z.string().describe('The message to echo'),
  }),
  handler: async (input, context) => {
    logger.info({ input, context }, 'Echo tool called');
    return {
      message: input.message,
      timestamp: context.timestamp.toISOString(),
      requestId: context.requestId,
    };
  },
};

// Example: Get server info tool
export const serverInfoTool: Tool = {
  name: 'get_server_info',
  description: 'Get information about the supervisor service',
  inputSchema: z.object({}),
  handler: async (input, context) => {
    logger.info({ context }, 'Server info tool called');
    return {
      name: 'supervisor-service',
      version: '1.0.0',
      description: 'Centralized service manager for AI supervisor system',
      timestamp: context.timestamp.toISOString(),
    };
  },
};

// Example tools array for meta endpoint
export const metaTools: Tool[] = [echoTool, serverInfoTool];
