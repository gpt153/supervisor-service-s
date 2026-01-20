/**
 * MCP tools for Cloudflare Tunnel management
 *
 * Provides autonomous CNAME creation, health monitoring, and tunnel management.
 */

import { ToolDefinition, ProjectContext } from '../../types/project.js';
import { TunnelManager } from '../../tunnel/TunnelManager.js';
import { PortManager } from '../../ports/PortManager.js';
import { SecretsManager } from '../../secrets/SecretsManager.js';
import { pool } from '../../db/client.js';

// Singleton instances
let tunnelManagerInstance: TunnelManager | null = null;
let portManagerInstance: PortManager | null = null;
let secretsManagerInstance: SecretsManager | null = null;

/**
 * Get or create PortManager singleton
 */
function getPortManager(): PortManager {
  if (!portManagerInstance) {
    portManagerInstance = new PortManager(pool);
  }
  return portManagerInstance;
}

/**
 * Get or create SecretsManager singleton
 */
function getSecretsManager(): SecretsManager {
  if (!secretsManagerInstance) {
    secretsManagerInstance = new SecretsManager();
  }
  return secretsManagerInstance;
}

/**
 * Get or create TunnelManager instance
 */
async function getTunnelManager(): Promise<TunnelManager> {
  if (!tunnelManagerInstance) {
    const portManager = getPortManager();
    const secretsManager = getSecretsManager();
    tunnelManagerInstance = new TunnelManager(portManager, secretsManager);
    await tunnelManagerInstance.initialize();
  }
  return tunnelManagerInstance;
}

/**
 * Get tunnel status
 */
export const getTunnelStatusTool: ToolDefinition = {
  name: 'tunnel_get_status',
  description: 'Get current Cloudflare tunnel health status, uptime, and restart count',
  inputSchema: {
    type: 'object',
    properties: {},
    required: []
  },
  handler: async (params: any, context?: ProjectContext) => {
    try {
      const manager = await getTunnelManager();
      const status = manager.getStatus();

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: status.status,
            uptime_seconds: status.uptime_seconds,
            restart_count: status.restart_count,
            last_check: status.last_check,
            cloudflared_location: status.cloudflared_location
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error getting tunnel status: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }
};

/**
 * Request a new CNAME
 */
export const requestCNAMETool: ToolDefinition = {
  name: 'tunnel_request_cname',
  description: 'Create a new CNAME record with automatic DNS + ingress configuration. Validates port allocation and determines optimal routing (localhost vs container).',
  inputSchema: {
    type: 'object',
    properties: {
      subdomain: {
        type: 'string',
        description: 'Subdomain to create (e.g., "api" for api.153.se)'
      },
      domain: {
        type: 'string',
        description: 'Domain to use (defaults to 153.se)',
        default: '153.se'
      },
      targetPort: {
        type: 'number',
        description: 'Port number where service is listening'
      },
      projectName: {
        type: 'string',
        description: 'Project name (auto-detected from context if not provided)'
      }
    },
    required: ['subdomain', 'targetPort']
  },
  handler: async (params: any, context?: ProjectContext) => {
    try {
      const projectName = params.projectName || context?.project?.name || 'unknown';

      const manager = await getTunnelManager();

      const result = await manager.requestCNAME({
        subdomain: params.subdomain,
        domain: params.domain,
        targetPort: params.targetPort,
        projectName
      });

      if (result.success) {
        // Generate deployment documentation for PS auto-update
        const deploymentDocs = {
          quick_start_entry: `**Production:** ${result.url} (Tunnel: ${params.subdomain}-153-se → localhost:${params.targetPort})`,
          deployment_status_entry: {
            public_url: result.url,
            tunnel_name: `${params.subdomain}-153-se`,
            internal_port: params.targetPort,
            target_type: result.target_type,
            container_name: result.container_name || null
          },
          instructions_for_ps: [
            '1. Update .supervisor-specific/QUICK-START.md: Add quick_start_entry to "Production (Docker)" section',
            '2. Update .supervisor-specific/02-deployment-status.md: Update "Production Environment" with deployment_status_entry details',
            '3. Regenerate CLAUDE.md: cd /home/samuel/sv/supervisor-service-s && npm run init-projects -- --project ' + projectName + ' --verbose',
            '4. Commit: git add .supervisor-specific/ CLAUDE.md && git commit -m "docs: update deployment config with tunnel ' + result.url + '" && git push origin main'
          ].join('\n')
        };

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              cname: result.url.replace('https://', ''),
              url: result.url,
              tunnel_name: `${params.subdomain}-153-se`,
              local_port: params.targetPort,
              target_type: result.target_type,
              container_name: result.container_name,
              deployment_documentation: deploymentDocs
            }, null, 2)
          }]
        };
      } else {
        return {
          content: [{
            type: 'text',
            text: `❌ Failed to create CNAME:\n\nError: ${result.error}\n\n${result.recommendation ? `Recommendation: ${result.recommendation}` : ''}`
          }],
          isError: true
        };
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error requesting CNAME: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }
};

/**
 * Delete a CNAME
 */
export const deleteCNAMETool: ToolDefinition = {
  name: 'tunnel_delete_cname',
  description: 'Delete a CNAME record and remove from tunnel ingress. PSs can only delete their own CNAMEs. Meta-supervisor can delete any CNAME.',
  inputSchema: {
    type: 'object',
    properties: {
      hostname: {
        type: 'string',
        description: 'Full hostname to delete (e.g., "api.153.se")'
      },
      projectName: {
        type: 'string',
        description: 'Requesting project name (auto-detected from context)'
      },
      isMetaSupervisor: {
        type: 'boolean',
        description: 'Is the request from meta-supervisor (can delete any CNAME)',
        default: false
      }
    },
    required: ['hostname']
  },
  handler: async (params: any, context?: ProjectContext) => {
    try {
      const projectName = params.projectName || context?.project?.name || 'unknown';

      const manager = await getTunnelManager();

      const result = await manager.deleteCNAME(
        params.hostname,
        projectName,
        params.isMetaSupervisor || false
      );

      if (result.success) {
        return {
          content: [{
            type: 'text',
            text: `✅ ${result.message}`
          }]
        };
      } else {
        return {
          content: [{
            type: 'text',
            text: `❌ ${result.message}`
          }],
          isError: true
        };
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error deleting CNAME: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }
};

/**
 * List CNAMEs
 */
export const listCNAMEsTool: ToolDefinition = {
  name: 'tunnel_list_cnames',
  description: 'List all CNAMEs. PSs see only their own CNAMEs. Meta-supervisor sees all CNAMEs.',
  inputSchema: {
    type: 'object',
    properties: {
      projectName: {
        type: 'string',
        description: 'Filter by project name (auto-detected from context for PSs)'
      },
      domain: {
        type: 'string',
        description: 'Filter by domain (e.g., "153.se")'
      },
      isMetaSupervisor: {
        type: 'boolean',
        description: 'Is the request from meta-supervisor (sees all CNAMEs)',
        default: false
      }
    },
    required: []
  },
  handler: async (params: any, context?: ProjectContext) => {
    try {
      const projectName = params.projectName || context?.project?.name;

      const manager = await getTunnelManager();

      // PSs can only see their own CNAMEs
      const filters: any = {};
      if (!params.isMetaSupervisor && projectName) {
        filters.projectName = projectName;
      } else if (params.projectName) {
        filters.projectName = params.projectName;
      }

      if (params.domain) {
        filters.domain = params.domain;
      }

      const cnames = manager.listCNAMEs(filters);

      if (cnames.length === 0) {
        return {
          content: [{
            type: 'text',
            text: 'No CNAMEs found'
          }]
        };
      }

      const formatted = cnames.map(c =>
        `- ${c.full_hostname} → ${c.target_service} (${c.project_name})`
      ).join('\n');

      return {
        content: [{
          type: 'text',
          text: `CNAMEs (${cnames.length}):\n\n${formatted}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error listing CNAMEs: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }
};

/**
 * List available domains
 */
export const listDomainsTool: ToolDefinition = {
  name: 'tunnel_list_domains',
  description: 'List all available Cloudflare domains that can be used for CNAME creation',
  inputSchema: {
    type: 'object',
    properties: {},
    required: []
  },
  handler: async (params: any, context?: ProjectContext) => {
    try {
      const manager = await getTunnelManager();
      const domains = manager.listDomains();

      if (domains.length === 0) {
        return {
          content: [{
            type: 'text',
            text: 'No domains discovered'
          }]
        };
      }

      const formatted = domains.map(d =>
        `- ${d.domain} (${d.zone_id})`
      ).join('\n');

      return {
        content: [{
          type: 'text',
          text: `Available domains (${domains.length}):\n\n${formatted}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error listing domains: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }
};

// Export all tunnel tools
export const tunnelTools = [
  getTunnelStatusTool,
  requestCNAMETool,
  deleteCNAMETool,
  listCNAMEsTool,
  listDomainsTool
];
