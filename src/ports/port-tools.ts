/**
 * MCP Tools for Port Allocation System
 *
 * Provides tools for:
 * - Getting/allocating ports for services
 * - Listing port allocations
 * - Auditing port usage
 * - Getting port range summaries
 */

import { ToolDefinition, ProjectContext } from '../types/project.js';
import { PortManager } from './PortManager.js';
import { pool } from '../db/client.js';

// Singleton port manager instance
let portManager: PortManager | null = null;

function getPortManager(): PortManager {
  if (!portManager) {
    portManager = new PortManager(pool);
  }
  return portManager;
}

/**
 * Get or allocate port for a service
 * If service already has a port, returns it. Otherwise allocates next available port.
 */
export const getPortTool: ToolDefinition = {
  name: 'get-port',
  description: 'Get allocated port for a service, or allocate next available port if not exists',
  inputSchema: {
    type: 'object',
    properties: {
      projectName: {
        type: 'string',
        description: 'Name of the project (e.g., consilio, openhorizon, odin, health-agent)',
      },
      serviceName: {
        type: 'string',
        description: 'Name of the service (e.g., web, api, websocket)',
      },
      serviceType: {
        type: 'string',
        description: 'Type of service (e.g., mcp, api, websocket, database)',
      },
      description: {
        type: 'string',
        description: 'Description of the service',
      },
      cloudflareHostname: {
        type: 'string',
        description: 'Cloudflare tunnel hostname (e.g., api.consilio.153.se)',
      },
      hostname: {
        type: 'string',
        description: 'Hostname to bind to (default: localhost)',
      },
      protocol: {
        type: 'string',
        description: 'Protocol to use (default: tcp)',
        enum: ['tcp', 'udp'],
      },
    },
    required: ['projectName', 'serviceName'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const manager = getPortManager();

      const port = await manager.getOrAllocate(
        params.projectName,
        params.serviceName,
        {
          serviceType: params.serviceType,
          description: params.description,
          cloudflareHostname: params.cloudflareHostname,
          hostname: params.hostname,
          protocol: params.protocol,
        }
      );

      return {
        success: true,
        port,
        projectName: params.projectName,
        serviceName: params.serviceName,
        message: `Port ${port} allocated to ${params.projectName}/${params.serviceName}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        projectName: params.projectName,
        serviceName: params.serviceName,
      };
    }
  },
};

/**
 * Allocate a new port for a service
 * Always allocates a new port, even if service already has one
 */
export const allocatePortTool: ToolDefinition = {
  name: 'allocate-port',
  description: 'Allocate next available port for a service (always allocates new port)',
  inputSchema: {
    type: 'object',
    properties: {
      projectName: {
        type: 'string',
        description: 'Name of the project (e.g., consilio, openhorizon, odin, health-agent)',
      },
      serviceName: {
        type: 'string',
        description: 'Name of the service (e.g., web, api, websocket)',
      },
      serviceType: {
        type: 'string',
        description: 'Type of service (e.g., mcp, api, websocket, database)',
      },
      description: {
        type: 'string',
        description: 'Description of the service',
      },
      cloudflareHostname: {
        type: 'string',
        description: 'Cloudflare tunnel hostname (e.g., api.consilio.153.se)',
      },
      hostname: {
        type: 'string',
        description: 'Hostname to bind to (default: localhost)',
      },
      protocol: {
        type: 'string',
        description: 'Protocol to use (default: tcp)',
        enum: ['tcp', 'udp'],
      },
    },
    required: ['projectName', 'serviceName'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const manager = getPortManager();

      const port = await manager.allocate(
        params.projectName,
        params.serviceName,
        {
          serviceType: params.serviceType,
          description: params.description,
          cloudflareHostname: params.cloudflareHostname,
          hostname: params.hostname,
          protocol: params.protocol,
        }
      );

      return {
        success: true,
        port,
        projectName: params.projectName,
        serviceName: params.serviceName,
        message: `Port ${port} allocated to ${params.projectName}/${params.serviceName}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        projectName: params.projectName,
        serviceName: params.serviceName,
      };
    }
  },
};

/**
 * List all port allocations (optionally filtered by project)
 */
export const listPortsTool: ToolDefinition = {
  name: 'list-ports',
  description: 'List all port allocations, optionally filtered by project',
  inputSchema: {
    type: 'object',
    properties: {
      projectName: {
        type: 'string',
        description: 'Optional: Filter by project name',
      },
    },
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const manager = getPortManager();

      const allocations = params.projectName
        ? await manager.listByProject(params.projectName)
        : await manager.listAll();

      return {
        success: true,
        count: allocations.length,
        allocations: allocations.map(a => ({
          port: a.portNumber,
          projectName: a.projectName,
          serviceName: a.serviceName,
          serviceType: a.serviceType,
          status: a.status,
          cloudflareHostname: a.cloudflareHostname,
          hostname: a.hostname,
          protocol: a.protocol,
          allocatedAt: a.allocatedAt,
        })),
        projectFilter: params.projectName || 'all',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

/**
 * Audit all allocated ports to verify they match running services
 */
export const auditPortsTool: ToolDefinition = {
  name: 'audit-ports',
  description: 'Verify all allocated ports match running services (health check)',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const manager = getPortManager();

      const audit = await manager.auditPorts();

      return {
        success: true,
        summary: {
          allocated: audit.allocated,
          inUse: audit.inUse,
          notRunning: audit.notRunning,
          healthPercentage: audit.allocated > 0
            ? Math.round((audit.inUse / audit.allocated) * 100)
            : 100,
        },
        conflicts: audit.conflicts,
        message: audit.conflicts.length === 0
          ? 'All ports healthy'
          : `${audit.conflicts.length} ports not running`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

/**
 * Get port usage summary for a project
 */
export const portSummaryTool: ToolDefinition = {
  name: 'port-summary',
  description: 'Get port usage summary for a project',
  inputSchema: {
    type: 'object',
    properties: {
      projectName: {
        type: 'string',
        description: 'Name of the project',
      },
    },
    required: ['projectName'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const manager = getPortManager();

      const summary = await manager.getProjectSummary(params.projectName);

      return {
        success: true,
        projectName: params.projectName,
        summary: {
          rangeStart: summary.rangeStart,
          rangeEnd: summary.rangeEnd,
          totalPorts: summary.totalPorts,
          allocatedPorts: summary.allocatedPorts,
          availablePorts: summary.availablePorts,
          utilizationPercent: summary.utilization,
        },
        message: `${summary.allocatedPorts}/${summary.totalPorts} ports allocated (${summary.utilization}% utilization)`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        projectName: params.projectName,
      };
    }
  },
};

/**
 * Release a port allocation
 */
export const releasePortTool: ToolDefinition = {
  name: 'release-port',
  description: 'Release a port allocation for a service',
  inputSchema: {
    type: 'object',
    properties: {
      projectName: {
        type: 'string',
        description: 'Name of the project',
      },
      serviceName: {
        type: 'string',
        description: 'Name of the service',
      },
      hostname: {
        type: 'string',
        description: 'Hostname (default: localhost)',
      },
    },
    required: ['projectName', 'serviceName'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const manager = getPortManager();

      const released = await manager.release(
        params.projectName,
        params.serviceName,
        params.hostname
      );

      return {
        success: true,
        released,
        projectName: params.projectName,
        serviceName: params.serviceName,
        message: released
          ? `Port released for ${params.projectName}/${params.serviceName}`
          : `No active port found for ${params.projectName}/${params.serviceName}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        projectName: params.projectName,
        serviceName: params.serviceName,
      };
    }
  },
};

/**
 * Update port metadata
 */
export const updatePortTool: ToolDefinition = {
  name: 'update-port',
  description: 'Update port metadata (Cloudflare hostname, description, etc.)',
  inputSchema: {
    type: 'object',
    properties: {
      projectName: {
        type: 'string',
        description: 'Name of the project',
      },
      serviceName: {
        type: 'string',
        description: 'Name of the service',
      },
      cloudflareHostname: {
        type: 'string',
        description: 'Cloudflare tunnel hostname',
      },
      description: {
        type: 'string',
        description: 'Service description',
      },
      serviceType: {
        type: 'string',
        description: 'Type of service',
      },
    },
    required: ['projectName', 'serviceName'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const manager = getPortManager();

      const updated = await manager.updatePort(
        params.projectName,
        params.serviceName,
        {
          cloudflareHostname: params.cloudflareHostname,
          description: params.description,
          serviceType: params.serviceType,
        }
      );

      return {
        success: true,
        updated,
        projectName: params.projectName,
        serviceName: params.serviceName,
        message: updated
          ? `Port updated for ${params.projectName}/${params.serviceName}`
          : `No active port found for ${params.projectName}/${params.serviceName}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        projectName: params.projectName,
        serviceName: params.serviceName,
      };
    }
  },
};

/**
 * Get all port tools
 */
export function getPortTools(): ToolDefinition[] {
  return [
    getPortTool,
    allocatePortTool,
    listPortsTool,
    auditPortsTool,
    portSummaryTool,
    releasePortTool,
    updatePortTool,
  ];
}
