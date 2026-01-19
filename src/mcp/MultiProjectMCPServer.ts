/**
 * MultiProjectMCPServer - Main MCP server supporting multiple project endpoints
 */

import { ProjectContextManager } from './ProjectContextManager.js';
import { ToolRegistry } from './ToolRegistry.js';
import { ProjectEndpoint } from './ProjectEndpoint.js';
import { MCPRequest, MCPResponse, MCPErrorCodes } from '../types/mcp.js';
import { ToolDefinition } from '../types/project.js';

export interface ServerConfig {
  configPath?: string;
  port?: number;
  host?: string;
}

export class MultiProjectMCPServer {
  private contextManager: ProjectContextManager;
  private toolRegistry: ToolRegistry;
  private endpoints: Map<string, ProjectEndpoint> = new Map();
  private config: ServerConfig;

  constructor(config: ServerConfig = {}) {
    this.config = {
      configPath: config.configPath || 'config/projects.json',
      port: config.port || 3000,
      host: config.host || 'localhost',
    };

    this.contextManager = new ProjectContextManager(this.config.configPath);
    this.toolRegistry = new ToolRegistry();
  }

  /**
   * Initialize the server and create all endpoints
   */
  async initialize(): Promise<void> {
    console.log('Initializing MultiProjectMCPServer...');

    // Load project configurations and create contexts
    await this.contextManager.initialize();

    // Create endpoints for each enabled project
    await this.createEndpoints();

    console.log(`Server initialized with ${this.endpoints.size} endpoints`);
  }

  /**
   * Register tools that will be available globally
   */
  registerTools(tools: ToolDefinition[]): void {
    this.toolRegistry.registerTools(tools);
  }

  /**
   * Register a single tool
   */
  registerTool(tool: ToolDefinition): void {
    this.toolRegistry.registerTool(tool);
  }

  /**
   * Create endpoints for all enabled projects
   */
  private async createEndpoints(): Promise<void> {
    const contexts = this.contextManager.getAllContexts();

    for (const [projectName, context] of contexts) {
      // Set up tool scoping for this project
      this.toolRegistry.setProjectTools(projectName, context.project.tools);

      // Create endpoint
      const endpoint = new ProjectEndpoint(context, this.toolRegistry);

      // Register endpoint for each path
      for (const path of context.project.endpoints) {
        this.endpoints.set(path, endpoint);
        console.log(`Created endpoint: ${path} -> ${projectName}`);
      }
    }
  }

  /**
   * Route a request to the appropriate endpoint
   */
  async routeRequest(endpointPath: string, request: MCPRequest): Promise<MCPResponse> {
    const endpoint = this.endpoints.get(endpointPath);

    if (!endpoint) {
      return this.createErrorResponse(
        request.id,
        MCPErrorCodes.ProjectNotFound,
        `Endpoint not found: ${endpointPath}`,
        { availableEndpoints: Array.from(this.endpoints.keys()) }
      );
    }

    return endpoint.handleRequest(request);
  }

  /**
   * Get an endpoint by path
   */
  getEndpoint(endpointPath: string): ProjectEndpoint | undefined {
    return this.endpoints.get(endpointPath);
  }

  /**
   * Get all endpoint paths
   */
  getEndpointPaths(): string[] {
    return Array.from(this.endpoints.keys());
  }

  /**
   * Get all endpoints
   */
  getEndpoints(): Map<string, ProjectEndpoint> {
    return new Map(this.endpoints);
  }

  /**
   * Detect project name from endpoint path
   */
  detectProject(endpointPath: string): string | null {
    return this.contextManager.detectProjectFromPath(endpointPath);
  }

  /**
   * Handle a generic MCP request (with automatic routing based on project context)
   */
  async handleRequest(request: MCPRequest, projectContext?: string): Promise<MCPResponse> {
    // If project context is provided, route to that endpoint
    if (projectContext) {
      const endpointPath = `/mcp/${projectContext}`;
      return this.routeRequest(endpointPath, request);
    }

    // Otherwise, return error - project context required
    return this.createErrorResponse(
      request.id,
      MCPErrorCodes.InvalidRequest,
      'Project context required. Specify endpoint path or project name.',
      {
        availableProjects: this.contextManager.getEnabledProjects().map(p => p.name),
      }
    );
  }

  /**
   * Get server statistics
   */
  getStats(): {
    server: {
      endpoints: number;
      tools: number;
      projects: any;
    };
    endpoints: Record<string, any>;
  } {
    const projectStats = this.contextManager.getStats();
    const toolStats = this.toolRegistry.getStats();

    const endpointStats: Record<string, any> = {};
    for (const [path, endpoint] of this.endpoints) {
      endpointStats[path] = endpoint.getStats();
    }

    return {
      server: {
        endpoints: this.endpoints.size,
        tools: toolStats.totalTools,
        projects: projectStats,
      },
      endpoints: endpointStats,
    };
  }

  /**
   * Reload the server configuration
   */
  async reload(): Promise<void> {
    console.log('Reloading server configuration...');

    // Clear existing endpoints
    this.endpoints.clear();

    // Reload context manager
    await this.contextManager.reload();

    // Recreate endpoints
    await this.createEndpoints();

    console.log('Server configuration reloaded');
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    timestamp: string;
    endpoints: number;
    projects: number;
  }> {
    const stats = this.contextManager.getStats();

    return {
      status: this.endpoints.size > 0 ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      endpoints: this.endpoints.size,
      projects: stats.enabled,
    };
  }

  /**
   * Create an error response
   */
  private createErrorResponse(
    id: string | number,
    code: number,
    message: string,
    data?: any
  ): MCPResponse {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message,
        data,
      },
    };
  }

  /**
   * Shutdown the server
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down MultiProjectMCPServer...');
    this.endpoints.clear();
    console.log('Server shutdown complete');
  }
}
