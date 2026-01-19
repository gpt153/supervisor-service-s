/**
 * MCP tools for Cloudflare integration
 *
 * Provides tools for:
 * - DNS record management (CNAME, A records)
 * - Tunnel ingress synchronization
 * - Multi-domain support
 */

import { ToolDefinition, ProjectContext } from '../types/project.js';
import { CloudflareManager } from './CloudflareManager.js';
import { SecretsManager } from '../secrets/SecretsManager.js';
import { PortManager } from '../ports/PortManager.js';
import { pool } from '../db/client.js';
import type { CloudflareSecrets } from '../types/cloudflare.js';

// Singleton instances
let cloudflareManager: CloudflareManager | null = null;
let secretsManager: SecretsManager | null = null;
let portManager: PortManager | null = null;

/**
 * Get or create CloudflareManager instance
 *
 * Loads secrets from database on first access
 */
async function getCloudflareManager(): Promise<CloudflareManager> {
  if (cloudflareManager) {
    return cloudflareManager;
  }

  // Get secrets manager
  if (!secretsManager) {
    secretsManager = new SecretsManager();
  }

  // Load Cloudflare secrets
  const apiToken = await secretsManager.get({ keyPath: 'meta/cloudflare/api_token' });
  const accountId = await secretsManager.get({ keyPath: 'meta/cloudflare/account_id' });
  const tunnelId = await secretsManager.get({ keyPath: 'meta/cloudflare/tunnel_id' });
  const zoneId153se = await secretsManager.get({ keyPath: 'meta/cloudflare/zone_id_153se' });

  if (!apiToken || !accountId || !tunnelId || !zoneId153se) {
    throw new Error(
      'Missing Cloudflare secrets. Please set:\n' +
      '  - meta/cloudflare/api_token\n' +
      '  - meta/cloudflare/account_id\n' +
      '  - meta/cloudflare/tunnel_id\n' +
      '  - meta/cloudflare/zone_id_153se\n' +
      'Use mcp__meta__set_secret to configure these.'
    );
  }

  // Build zone IDs map
  const zoneIds: Record<string, string> = {
    '153.se': zoneId153se,
  };

  // Check for optional openhorizon.cc zone
  const zoneIdOpenHorizon = await secretsManager.get({ keyPath: 'meta/cloudflare/zone_id_openhorizon' });
  if (zoneIdOpenHorizon) {
    zoneIds['openhorizon.cc'] = zoneIdOpenHorizon;
  }

  const secrets: CloudflareSecrets = {
    apiToken,
    accountId,
    zoneIds,
    tunnelId,
  };

  cloudflareManager = new CloudflareManager(secrets);
  return cloudflareManager;
}

/**
 * Get or create PortManager instance
 */
function getPortManager(): PortManager {
  if (!portManager) {
    portManager = new PortManager(pool);
  }
  return portManager;
}

/**
 * Create CNAME DNS record
 *
 * Tool: mcp__meta__create_cname
 */
export const createCNAMETool: ToolDefinition = {
  name: 'mcp__meta__create_cname',
  description: 'Create CNAME DNS record in Cloudflare. If record exists, updates it.',
  inputSchema: {
    type: 'object',
    properties: {
      hostname: {
        type: 'string',
        description: 'Full hostname for the CNAME (e.g., api.consilio.153.se)',
      },
      target: {
        type: 'string',
        description: 'Target hostname (e.g., tunnel.153.se or @)',
      },
      proxied: {
        type: 'boolean',
        description: 'Whether to proxy through Cloudflare (default: true)',
      },
    },
    required: ['hostname', 'target'],
  },
  handler: async (params: { hostname: string; target: string; proxied?: boolean }, context: ProjectContext) => {
    try {
      const manager = await getCloudflareManager();

      const result = await manager.createCNAME(
        params.hostname,
        params.target,
        { proxied: params.proxied }
      );

      return {
        success: true,
        record: {
          id: result.id,
          name: result.name,
          content: result.content,
        },
        message: `CNAME created: ${result.name} → ${result.content}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        hostname: params.hostname,
      };
    }
  },
};

/**
 * Create A DNS record
 *
 * Tool: mcp__meta__create_a_record
 */
export const createARecordTool: ToolDefinition = {
  name: 'mcp__meta__create_a_record',
  description: 'Create A record DNS record in Cloudflare. If record exists, updates it.',
  inputSchema: {
    type: 'object',
    properties: {
      hostname: {
        type: 'string',
        description: 'Full hostname for the A record (e.g., 153.se or server.153.se)',
      },
      ipAddress: {
        type: 'string',
        description: 'IPv4 address (e.g., 34.91.182.123)',
      },
      proxied: {
        type: 'boolean',
        description: 'Whether to proxy through Cloudflare (default: true)',
      },
    },
    required: ['hostname', 'ipAddress'],
  },
  handler: async (params: { hostname: string; ipAddress: string; proxied?: boolean }, context: ProjectContext) => {
    try {
      const manager = await getCloudflareManager();

      const result = await manager.createARecord(
        params.hostname,
        params.ipAddress,
        { proxied: params.proxied }
      );

      return {
        success: true,
        record: {
          id: result.id,
          name: result.name,
          content: result.content,
        },
        message: `A record created: ${result.name} → ${result.content}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        hostname: params.hostname,
      };
    }
  },
};

/**
 * Delete DNS record
 *
 * Tool: mcp__meta__delete_dns_record
 */
export const deleteDNSRecordTool: ToolDefinition = {
  name: 'mcp__meta__delete_dns_record',
  description: 'Delete DNS record from Cloudflare by hostname',
  inputSchema: {
    type: 'object',
    properties: {
      hostname: {
        type: 'string',
        description: 'Hostname of the DNS record to delete',
      },
    },
    required: ['hostname'],
  },
  handler: async (params: { hostname: string }, context: ProjectContext) => {
    try {
      const manager = await getCloudflareManager();

      const deleted = await manager.deleteDNSRecord(params.hostname);

      return {
        success: true,
        deleted,
        hostname: params.hostname,
        message: deleted
          ? `DNS record deleted: ${params.hostname}`
          : `DNS record not found: ${params.hostname}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        hostname: params.hostname,
      };
    }
  },
};

/**
 * List DNS records for a domain
 *
 * Tool: mcp__meta__list_dns_records
 */
export const listDNSRecordsTool: ToolDefinition = {
  name: 'mcp__meta__list_dns_records',
  description: 'List all DNS records for a domain (e.g., 153.se, openhorizon.cc)',
  inputSchema: {
    type: 'object',
    properties: {
      domain: {
        type: 'string',
        description: 'Domain name (e.g., 153.se, openhorizon.cc)',
      },
    },
    required: ['domain'],
  },
  handler: async (params: { domain: string }, context: ProjectContext) => {
    try {
      const manager = await getCloudflareManager();

      const records = await manager.listDNSRecords(params.domain);

      return {
        success: true,
        domain: params.domain,
        count: records.length,
        records: records.map(r => ({
          id: r.id,
          type: r.type,
          name: r.name,
          content: r.content,
          proxied: r.proxied,
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        domain: params.domain,
      };
    }
  },
};

/**
 * Sync tunnel ingress with port allocations
 *
 * Tool: mcp__meta__sync_tunnel
 */
export const syncTunnelTool: ToolDefinition = {
  name: 'mcp__meta__sync_tunnel',
  description: 'Sync Cloudflare Tunnel ingress rules with port allocations. Reads all port allocations with Cloudflare hostnames and updates /etc/cloudflared/config.yml',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  handler: async (params: {}, context: ProjectContext) => {
    try {
      const manager = await getCloudflareManager();
      const portMgr = getPortManager();

      // Get allocations before sync for reporting
      const allocations = await portMgr.listAll();
      const withHostnames = allocations.filter(a => a.cloudflareHostname);

      await manager.syncPortAllocationsToTunnel(portMgr);

      return {
        success: true,
        routeCount: withHostnames.length,
        routes: withHostnames.map(a => ({
          hostname: a.cloudflareHostname,
          port: a.portNumber,
          project: a.projectName,
          service: a.serviceName,
        })),
        message: `Synced ${withHostnames.length} tunnel routes and restarted cloudflared`,
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
 * Get all Cloudflare tools
 */
export function getCloudflareTools(): ToolDefinition[] {
  return [
    createCNAMETool,
    createARecordTool,
    deleteDNSRecordTool,
    listDNSRecordsTool,
    syncTunnelTool,
  ];
}
