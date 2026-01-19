/**
 * HTTP routes for the MCP server
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { processMCPRequest } from '../mcp/protocol.js';
import { getState, getUptime } from '../mcp/state.js';
import { HealthCheckResponse } from '../types/index.js';
import { MultiProjectMCPServer } from '../mcp/MultiProjectMCPServer.js';
import { getAllTools } from '../mcp/tools/index.js';

// Global multi-project MCP server instance
let multiProjectServer: MultiProjectMCPServer | null = null;

/**
 * Initialize the multi-project MCP server
 */
async function initializeMultiProjectServer(): Promise<MultiProjectMCPServer> {
  if (!multiProjectServer) {
    console.log('Initializing multi-project MCP server');

    multiProjectServer = new MultiProjectMCPServer({
      configPath: 'config/projects.json',
    });

    // Register tools
    const tools = getAllTools();
    multiProjectServer.registerTools(tools);
    console.log(`Registered ${tools.length} tools`);

    // Initialize server
    await multiProjectServer.initialize();

    console.log('Multi-project MCP server initialized');
  }

  return multiProjectServer;
}

/**
 * Register all routes
 */
export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // Initialize multi-project server
  const mcpServer = await initializeMultiProjectServer();

  // Health check endpoint
  app.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
    const state = getState();
    const uptime = getUptime();

    // Get multi-project server health
    const mcpHealth = await mcpServer.healthCheck();

    const response: HealthCheckResponse = {
      status: 'healthy',
      uptime,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      requestCount: state.requestCount,
      errorCount: state.errorCount,
    };

    request.log.debug({ response, mcpHealth }, 'Health check');
    return reply.send({
      ...response,
      multiProject: mcpHealth,
    });
  });

  // Stats endpoint
  app.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    const stats = mcpServer.getStats();
    return reply.send(stats);
  });

  // List endpoints
  app.get('/endpoints', async (request: FastifyRequest, reply: FastifyReply) => {
    const endpoints = mcpServer.getEndpointPaths();
    return reply.send({ endpoints });
  });

  // MCP meta endpoint (legacy compatibility)
  app.post(
    '/mcp/meta',
    async (request: FastifyRequest, reply: FastifyReply) => {
      request.log.info({ body: request.body }, 'MCP request received at /mcp/meta');

      // Route through multi-project server
      const response = await mcpServer.routeRequest('/mcp/meta', request.body as any);

      return reply.send(response);
    }
  );

  // Dynamic project endpoints
  app.post(
    '/mcp/:project',
    async (request: FastifyRequest<{ Params: { project: string } }>, reply: FastifyReply) => {
      const project = request.params.project;
      const endpointPath = `/mcp/${project}`;

      request.log.info(
        { project, body: request.body },
        'MCP request received for project'
      );

      // Route through multi-project server
      const response = await mcpServer.routeRequest(endpointPath, request.body as any);

      return reply.send(response);
    }
  );

  // Root endpoint
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const endpoints = mcpServer.getEndpointPaths();

    return reply.send({
      name: 'supervisor-service',
      version: '1.0.0',
      status: 'running',
      description: 'Multi-Project MCP Server',
      endpoints: {
        health: '/health',
        stats: '/stats',
        endpointsList: '/endpoints',
        mcp: endpoints,
      },
    });
  });

  // Shutdown hook
  app.addHook('onClose', async () => {
    if (multiProjectServer) {
      console.log('Shutting down multi-project MCP server');
      await multiProjectServer.shutdown();
    }
  });
}
