/**
 * Main entry point for supervisor-service
 */

import { config } from 'dotenv';
import { createApp } from './server/app.js';
import { logger } from './utils/logger.js';
import { registerTool } from './mcp/state.js';
import { metaTools } from './tools/example.js';
import { pool } from './db/client.js';
import { initializeTimingTools } from './mcp/tools/timing-tools.js';

// Load environment variables
config();

const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = process.env.HOST || '0.0.0.0';

/**
 * Initialize tools
 */
function initializeTools(): void {
  logger.info('Registering tools...');

  // Initialize timing tools with database pool
  initializeTimingTools(pool);
  logger.info('Timing tools initialized');

  // Register meta endpoint tools
  for (const tool of metaTools) {
    registerTool(tool);
    logger.info({ toolName: tool.name }, 'Tool registered');
  }
}

/**
 * Start the server
 */
async function start(): Promise<void> {
  try {
    // Initialize tools
    initializeTools();

    // Create and start Fastify app
    const app = await createApp();

    await app.listen({
      port: PORT,
      host: HOST,
    });

    logger.info(
      {
        port: PORT,
        host: HOST,
        nodeEnv: process.env.NODE_ENV,
      },
      'Server started successfully'
    );

    // Handle graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Received shutdown signal');

      try {
        await app.close();
        logger.info('Server closed gracefully');
        process.exit(0);
      } catch (error) {
        logger.error({ error }, 'Error during shutdown');
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

// Start the server
start();
