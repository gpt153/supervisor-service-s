/**
 * Integration tests for MultiProjectMCPServer
 */

import { MultiProjectMCPServer } from '../../mcp/MultiProjectMCPServer.js';
import { getAllTools } from '../../mcp/tools/index.js';
import { MCPRequest } from '../../types/mcp.js';
import * as assert from 'assert';
import { describe, it, before, after } from 'node:test';

describe('MultiProjectMCPServer Integration', () => {
  let server: MultiProjectMCPServer;

  const createRequest = (method: string, params?: any): MCPRequest => ({
    jsonrpc: '2.0',
    id: 1,
    method,
    params,
  });

  before(async () => {
    server = new MultiProjectMCPServer({
      configPath: 'config/projects.json',
    });

    const tools = getAllTools();
    server.registerTools(tools);

    await server.initialize();
  });

  after(async () => {
    await server.shutdown();
  });

  describe('initialization', () => {
    it('should create endpoints for all enabled projects', () => {
      const endpoints = server.getEndpointPaths();
      assert.ok(endpoints.length > 0, 'Should have created endpoints');
      assert.ok(endpoints.includes('/mcp/meta'), 'Should include meta endpoint');
    });

    it('should have healthy status', async () => {
      const health = await server.healthCheck();
      assert.strictEqual(health.status, 'healthy');
      assert.ok(health.endpoints > 0);
    });
  });

  describe('routing', () => {
    it('should route initialize request to meta endpoint', async () => {
      const request = createRequest('initialize');
      const response = await server.routeRequest('/mcp/meta', request);

      assert.ok(!response.error, 'Should not have error');
      assert.ok(response.result);
      assert.strictEqual(response.result.protocolVersion, '2024-11-05');
      assert.strictEqual(response.result.project.name, 'meta');
    });

    it('should route tools/list request to consilio endpoint', async () => {
      const request = createRequest('tools/list');
      const response = await server.routeRequest('/mcp/consilio', request);

      assert.ok(!response.error, 'Should not have error');
      assert.ok(response.result);
      assert.ok(response.result.tools);
      assert.ok(Array.isArray(response.result.tools));
    });

    it('should return error for invalid endpoint', async () => {
      const request = createRequest('ping');
      const response = await server.routeRequest('/mcp/invalid', request);

      assert.ok(response.error);
      assert.strictEqual(response.error.code, -32000); // ProjectNotFound
    });
  });

  describe('context isolation', () => {
    it('should maintain separate contexts for different projects', async () => {
      const pingRequest = createRequest('ping');

      // Ping meta endpoint
      const metaResponse = await server.routeRequest('/mcp/meta', pingRequest);
      assert.ok(metaResponse.result);
      assert.strictEqual(metaResponse.result.project, 'meta');

      // Ping consilio endpoint
      const consilioResponse = await server.routeRequest('/mcp/consilio', pingRequest);
      assert.ok(consilioResponse.result);
      assert.strictEqual(consilioResponse.result.project, 'consilio');
    });
  });

  describe('tool scoping', () => {
    it('should list only project-scoped tools', async () => {
      const request = createRequest('tools/list');

      // Get tools for meta
      const metaResponse = await server.routeRequest('/mcp/meta', request);
      const metaTools = metaResponse.result?.tools || [];

      // Get tools for consilio
      const consilioResponse = await server.routeRequest('/mcp/consilio', request);
      const consilioTools = consilioResponse.result?.tools || [];

      // Meta should have different tools than consilio
      const metaToolNames = metaTools.map((t: any) => t.name);
      const consilioToolNames = consilioTools.map((t: any) => t.name);

      // Meta should have service tools
      assert.ok(metaToolNames.includes('service-status'));

      // Consilio should have project tools
      assert.ok(consilioToolNames.includes('task-status'));

      // Consilio should NOT have service tools
      assert.ok(!consilioToolNames.includes('service-status'));
    });
  });

  describe('multiple concurrent requests', () => {
    it('should handle concurrent requests to different endpoints', async () => {
      const request = createRequest('ping');

      const responses = await Promise.all([
        server.routeRequest('/mcp/meta', request),
        server.routeRequest('/mcp/consilio', request),
        server.routeRequest('/mcp/odin', request),
      ]);

      // All should succeed
      responses.forEach(response => {
        assert.ok(!response.error, 'Should not have error');
        assert.ok(response.result);
      });

      // Each should have correct project
      assert.strictEqual(responses[0].result.project, 'meta');
      assert.strictEqual(responses[1].result.project, 'consilio');
      assert.strictEqual(responses[2].result.project, 'odin');
    });
  });

  describe('statistics', () => {
    it('should track request statistics per endpoint', async () => {
      const request = createRequest('ping');

      // Make some requests
      await server.routeRequest('/mcp/meta', request);
      await server.routeRequest('/mcp/meta', request);
      await server.routeRequest('/mcp/consilio', request);

      const stats = server.getStats();

      assert.ok(stats.server);
      assert.ok(stats.endpoints);
      assert.ok(stats.endpoints['/mcp/meta']);
      assert.ok(stats.endpoints['/mcp/consilio']);

      // Meta should have more requests
      assert.ok(stats.endpoints['/mcp/meta'].totalRequests >= 2);
    });
  });

  describe('error handling', () => {
    it('should handle invalid method', async () => {
      const request = createRequest('invalid-method');
      const response = await server.routeRequest('/mcp/meta', request);

      assert.ok(response.error);
      assert.strictEqual(response.error.code, -32601); // MethodNotFound
    });

    it('should handle malformed tool call', async () => {
      const request = createRequest('tools/call', {
        // Missing 'name' parameter
        arguments: {},
      });

      const response = await server.routeRequest('/mcp/meta', request);

      assert.ok(response.error || response.result?.isError);
    });
  });

  describe('detectProject', () => {
    it('should detect project from endpoint path', () => {
      const project = server.detectProject('/mcp/consilio');
      assert.strictEqual(project, 'consilio');
    });

    it('should return null for invalid path', () => {
      const project = server.detectProject('/invalid/path');
      assert.strictEqual(project, null);
    });
  });
});
