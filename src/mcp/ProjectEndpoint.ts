/**
 * ProjectEndpoint - Represents a single MCP endpoint for a project
 */

import { ProjectContext, ToolDefinition } from '../types/project.js';
import { MCPRequest, MCPResponse, MCPErrorCodes, MCPToolResponse } from '../types/mcp.js';
import { ToolRegistry } from './ToolRegistry.js';

export class ProjectEndpoint {
  private context: ProjectContext;
  private toolRegistry: ToolRegistry;
  private requestLog: Array<{ timestamp: Date; method: string; success: boolean }> = [];

  constructor(context: ProjectContext, toolRegistry: ToolRegistry) {
    this.context = context;
    this.toolRegistry = toolRegistry;
  }

  /**
   * Get the project name
   */
  getProjectName(): string {
    return this.context.project.name;
  }

  /**
   * Get the endpoint paths for this project
   */
  getEndpointPaths(): string[] {
    return this.context.project.endpoints;
  }

  /**
   * Get the project context
   */
  getContext(): ProjectContext {
    return this.context;
  }

  /**
   * List all tools available for this endpoint
   */
  listTools(): ToolDefinition[] {
    return this.toolRegistry.getProjectTools(this.context.project.name);
  }

  /**
   * Handle an MCP request
   */
  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    const startTime = Date.now();

    try {
      let result: any;

      switch (request.method) {
        case 'initialize':
          result = await this.handleInitialize(request.params);
          break;

        case 'tools/list':
          result = await this.handleToolsList();
          break;

        case 'tools/call':
          result = await this.handleToolCall(request.params);
          break;

        case 'ping':
          result = { status: 'ok', project: this.context.project.name };
          break;

        default:
          return this.createErrorResponse(
            request.id,
            MCPErrorCodes.MethodNotFound,
            `Method not found: ${request.method}`
          );
      }

      this.logRequest(request.method, true);

      return {
        jsonrpc: '2.0',
        id: request.id,
        result,
      };
    } catch (error) {
      this.logRequest(request.method, false);

      return this.createErrorResponse(
        request.id,
        MCPErrorCodes.InternalError,
        error instanceof Error ? error.message : 'Unknown error',
        { duration: Date.now() - startTime }
      );
    }
  }

  /**
   * Handle initialize request
   */
  private async handleInitialize(params: any): Promise<any> {
    return {
      protocolVersion: '2024-11-05',
      serverInfo: {
        name: `supervisor-${this.context.project.name}`,
        version: '1.0.0',
      },
      capabilities: {
        tools: {
          listChanged: false,
        },
      },
      project: {
        name: this.context.project.name,
        displayName: this.context.project.displayName,
        description: this.context.project.description,
      },
    };
  }

  /**
   * Handle tools/list request
   */
  private async handleToolsList(): Promise<any> {
    const tools = this.listTools();

    return {
      tools: tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    };
  }

  /**
   * Handle tools/call request
   */
  private async handleToolCall(params: any): Promise<MCPToolResponse> {
    const { name: toolName, arguments: toolArgs } = params;

    if (!toolName) {
      throw new Error('Tool name is required');
    }

    try {
      const result = await this.toolRegistry.executeTool(
        toolName,
        toolArgs || {},
        this.context
      );

      return {
        content: [
          {
            type: 'text',
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error executing tool: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
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
   * Log a request
   */
  private logRequest(method: string, success: boolean): void {
    this.requestLog.push({
      timestamp: new Date(),
      method,
      success,
    });

    // Keep only last 100 requests
    if (this.requestLog.length > 100) {
      this.requestLog.shift();
    }
  }

  /**
   * Get request statistics
   */
  getStats(): {
    projectName: string;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    recentRequests: Array<{ timestamp: Date; method: string; success: boolean }>;
  } {
    return {
      projectName: this.context.project.name,
      totalRequests: this.requestLog.length,
      successfulRequests: this.requestLog.filter(r => r.success).length,
      failedRequests: this.requestLog.filter(r => !r.success).length,
      recentRequests: this.requestLog.slice(-10),
    };
  }
}
