#!/usr/bin/env node
/**
 * MCP Daemon - HTTP server for Multi-Project MCP Server
 *
 * This daemon starts a Fastify HTTP server on port 8081 that provides
 * MCP (Model Context Protocol) endpoints for all configured projects.
 *
 * Usage:
 *   node --import tsx/esm src/mcp/mcp-daemon.ts
 *   npm run mcp:daemon
 *
 * Environment:
 *   PORT - HTTP port (default: 8081)
 *   HOST - Bind host (default: 0.0.0.0)
 *   NODE_ENV - Environment (production, development)
 */

import { createApp } from '../server/app.js';
import { logger } from '../utils/logger.js';

const PORT = parseInt(process.env.PORT || '8081', 10);
const HOST = process.env.HOST || '0.0.0.0';

/**
 * Start the MCP daemon
 */
async function main(): Promise<void> {
  try {
    logger.info('Starting MCP Daemon...');
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);

    // Create Fastify application
    const app = await createApp();

    // Start server
    await app.listen({
      port: PORT,
      host: HOST,
    });

    logger.info(`✅ MCP Daemon started successfully`);
    logger.info(`   HTTP Server: http://${HOST}:${PORT}`);
    logger.info(`   Health Check: http://${HOST}:${PORT}/health`);
    logger.info(`   Endpoints: http://${HOST}:${PORT}/endpoints`);
    logger.info(`   MCP Meta: http://${HOST}:${PORT}/mcp/meta`);

    // Handle shutdown signals
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);

      try {
        await app.close();
        logger.info('Server closed');
        process.exit(0);
      } catch (error) {
        logger.error({ error }, 'Error during shutdown');
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error({ error }, 'Uncaught exception');
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error({ reason, promise }, 'Unhandled rejection');
      process.exit(1);
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start MCP Daemon');
    process.exit(1);
  }
}

// Start the daemon
main();
