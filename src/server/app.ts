/**
 * Fastify application setup
 */

import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { logger } from '../utils/logger.js';
import { registerRoutes } from './routes.js';

/**
 * Create and configure Fastify application
 */
export async function createApp(): Promise<FastifyInstance> {
  const isDevelopment = process.env.NODE_ENV !== 'production';

  const app = Fastify({
    logger: isDevelopment
      ? {
          level: 'debug',
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          },
        }
      : {
          level: 'info',
        },
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    disableRequestLogging: false,
    bodyLimit: 1048576, // 1MB
  });

  // Register CORS
  await app.register(cors, {
    origin: true, // Allow all origins for now
    credentials: true,
  });

  // Error handler
  app.setErrorHandler(async (error, request, reply) => {
    request.log.error(
      {
        error,
        url: request.url,
        method: request.method,
      },
      'Request error'
    );

    const statusCode = (error as any).statusCode || 500;
    const message = error instanceof Error ? error.message : 'Internal Server Error';

    return reply.status(statusCode).send({
      error: {
        message,
        statusCode,
        requestId: request.id,
      },
    });
  });

  // Register routes
  await registerRoutes(app);

  // Graceful shutdown hook
  app.addHook('onClose', async (instance) => {
    instance.log.info('Server shutting down...');
  });

  return app;
}
