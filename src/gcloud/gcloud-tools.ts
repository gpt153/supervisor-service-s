/**
 * GCloud MCP Tools
 *
 * MCP tool definitions for Google Cloud VM management, health monitoring,
 * and automatic scaling.
 */

import type { ToolDefinition, ProjectContext } from '../types/project.js';
import type { GCloudServices } from './index.js';
import { initializeGCloud } from './index.js';
import { SecretsManager } from '../secrets/index.js';

// Global reference to GCloud services (lazy initialized)
let gcloudServices: GCloudServices | null = null;
let gcloudInitPromise: Promise<GCloudServices> | null = null;

/**
 * Get or initialize GCloud services
 *
 * Uses lazy initialization - creates instances on first use.
 */
async function getGCloud(): Promise<GCloudServices> {
  if (gcloudServices) {
    return gcloudServices;
  }

  if (gcloudInitPromise) {
    return gcloudInitPromise;
  }

  gcloudInitPromise = (async () => {
    try {
      const secretsManager = new SecretsManager();
      gcloudServices = await initializeGCloud(secretsManager);
      return gcloudServices;
    } catch (error) {
      gcloudInitPromise = null; // Reset on error so it can retry
      throw error;
    }
  })();

  return gcloudInitPromise;
}

/**
 * Get VM instance details
 */
export const gcloudGetVMTool: ToolDefinition = {
  name: 'gcloud-get-vm',
  description: 'Get VM instance details from Google Cloud',
  inputSchema: {
    type: 'object',
    properties: {
      project: {
        type: 'string',
        description: 'GCloud project name (e.g., vm-host, openhorizon)',
      },
      zone: {
        type: 'string',
        description: 'Zone (e.g., us-central1-a)',
      },
      instanceName: {
        type: 'string',
        description: 'VM instance name',
      },
    },
    required: ['project', 'zone', 'instanceName'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const gcloud = await getGCloud();
      const vm = await gcloud.manager.getVM(params.project, params.zone, params.instanceName);
      return { success: true, vm };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

/**
 * Start a VM instance
 */
export const gcloudStartVMTool: ToolDefinition = {
  name: 'gcloud-start-vm',
  description: 'Start a stopped VM instance',
  inputSchema: {
    type: 'object',
    properties: {
      project: {
        type: 'string',
        description: 'GCloud project name',
      },
      zone: {
        type: 'string',
        description: 'Zone',
      },
      instanceName: {
        type: 'string',
        description: 'VM instance name',
      },
      wait: {
        type: 'boolean',
        description: 'Wait for VM to reach RUNNING status (default: true)',
      },
    },
    required: ['project', 'zone', 'instanceName'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const gcloud = await getGCloud();
      await gcloud.manager.startVM(
        params.project,
        params.zone,
        params.instanceName,
        params.wait !== false
      );
      return {
        success: true,
        message: `VM ${params.instanceName} started successfully`,
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
 * Stop a VM instance
 */
export const gcloudStopVMTool: ToolDefinition = {
  name: 'gcloud-stop-vm',
  description: 'Stop a running VM instance',
  inputSchema: {
    type: 'object',
    properties: {
      project: {
        type: 'string',
        description: 'GCloud project name',
      },
      zone: {
        type: 'string',
        description: 'Zone',
      },
      instanceName: {
        type: 'string',
        description: 'VM instance name',
      },
      wait: {
        type: 'boolean',
        description: 'Wait for VM to reach TERMINATED status (default: true)',
      },
    },
    required: ['project', 'zone', 'instanceName'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const gcloud = await getGCloud();
      await gcloud.manager.stopVM(
        params.project,
        params.zone,
        params.instanceName,
        params.wait !== false
      );
      return {
        success: true,
        message: `VM ${params.instanceName} stopped successfully`,
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
 * Resize a VM instance
 */
export const gcloudResizeVMTool: ToolDefinition = {
  name: 'gcloud-resize-vm',
  description: 'Resize VM by changing machine type (stops/restarts VM automatically)',
  inputSchema: {
    type: 'object',
    properties: {
      project: {
        type: 'string',
        description: 'GCloud project name',
      },
      zone: {
        type: 'string',
        description: 'Zone',
      },
      instanceName: {
        type: 'string',
        description: 'VM instance name',
      },
      newMachineType: {
        type: 'string',
        description: 'New machine type (e.g., n1-standard-4)',
      },
    },
    required: ['project', 'zone', 'instanceName', 'newMachineType'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const gcloud = await getGCloud();
      await gcloud.manager.resizeVM(
        params.project,
        params.zone,
        params.instanceName,
        params.newMachineType
      );
      return {
        success: true,
        message: `VM ${params.instanceName} resized to ${params.newMachineType}`,
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
 * Get VM health metrics
 */
export const gcloudVMHealthTool: ToolDefinition = {
  name: 'gcloud-vm-health',
  description: 'Get VM health metrics (CPU, memory, disk usage)',
  inputSchema: {
    type: 'object',
    properties: {
      project: {
        type: 'string',
        description: 'GCloud project name',
      },
      zone: {
        type: 'string',
        description: 'Zone',
      },
      instanceName: {
        type: 'string',
        description: 'VM instance name',
      },
      minutes: {
        type: 'number',
        description: 'Time window in minutes (default: 60)',
      },
    },
    required: ['project', 'zone', 'instanceName'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const gcloud = await getGCloud();
      const health = await gcloud.health.getVMHealth(
        params.project,
        params.zone,
        params.instanceName,
        params.minutes || 60
      );
      const report = gcloud.health.formatHealthReport(health);
      return { success: true, health, report };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

/**
 * List VMs in project
 */
export const gcloudListVMsTool: ToolDefinition = {
  name: 'gcloud-list-vms',
  description: 'List all VMs in a GCloud project',
  inputSchema: {
    type: 'object',
    properties: {
      project: {
        type: 'string',
        description: 'GCloud project name',
      },
      zone: {
        type: 'string',
        description: 'Optional zone filter',
      },
    },
    required: ['project'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const gcloud = await getGCloud();
      const vms = await gcloud.manager.listVMs(params.project, params.zone);
      return {
        success: true,
        project: params.project,
        zone: params.zone || 'all',
        count: vms.length,
        vms,
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
 * Create a new VM instance
 */
export const gcloudCreateVMTool: ToolDefinition = {
  name: 'gcloud-create-vm',
  description: 'Create a new VM instance',
  inputSchema: {
    type: 'object',
    properties: {
      project: {
        type: 'string',
        description: 'GCloud project name',
      },
      zone: {
        type: 'string',
        description: 'Zone',
      },
      name: {
        type: 'string',
        description: 'VM instance name',
      },
      machineType: {
        type: 'string',
        description: 'Machine type (e.g., n1-standard-1)',
      },
      diskSizeGB: {
        type: 'number',
        description: 'Boot disk size in GB',
      },
      imageFamily: {
        type: 'string',
        description: 'Image family (default: ubuntu-2204-lts)',
      },
      imageProject: {
        type: 'string',
        description: 'Image project (default: ubuntu-os-cloud)',
      },
    },
    required: ['project', 'zone', 'name', 'machineType', 'diskSizeGB'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const gcloud = await getGCloud();
      await gcloud.manager.createVM(params.project, params.zone, {
        name: params.name,
        machineType: params.machineType,
        diskSizeGB: params.diskSizeGB,
        imageFamily: params.imageFamily || 'ubuntu-2204-lts',
        imageProject: params.imageProject || 'ubuntu-os-cloud',
      });
      return {
        success: true,
        message: `VM ${params.name} created successfully`,
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
 * Delete a VM instance
 */
export const gcloudDeleteVMTool: ToolDefinition = {
  name: 'gcloud-delete-vm',
  description: 'Delete a VM instance',
  inputSchema: {
    type: 'object',
    properties: {
      project: {
        type: 'string',
        description: 'GCloud project name',
      },
      zone: {
        type: 'string',
        description: 'Zone',
      },
      instanceName: {
        type: 'string',
        description: 'VM instance name',
      },
    },
    required: ['project', 'zone', 'instanceName'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const gcloud = await getGCloud();
      await gcloud.manager.deleteVM(params.project, params.zone, params.instanceName);
      return {
        success: true,
        message: `VM ${params.instanceName} deleted successfully`,
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
 * Evaluate VM auto-scaling decision
 */
export const gcloudEvaluateScalingTool: ToolDefinition = {
  name: 'gcloud-evaluate-scaling',
  description: 'Evaluate if a VM should be auto-scaled based on current metrics',
  inputSchema: {
    type: 'object',
    properties: {
      project: {
        type: 'string',
        description: 'GCloud project name',
      },
      zone: {
        type: 'string',
        description: 'Zone',
      },
      instanceName: {
        type: 'string',
        description: 'VM instance name',
      },
      cpuThreshold: {
        type: 'number',
        description: 'CPU threshold percentage (default: 80)',
      },
      durationMinutes: {
        type: 'number',
        description: 'Duration in minutes to check (default: 120)',
      },
    },
    required: ['project', 'zone', 'instanceName'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const gcloud = await getGCloud();
      const decision = await gcloud.scaler.evaluateScaling(
        params.project,
        params.zone,
        params.instanceName,
        {
          enabled: true,
          cpuThresholdPercent: params.cpuThreshold || 80,
          cpuDurationMinutes: params.durationMinutes || 120,
          diskThresholdPercent: 85,
          memoryThresholdPercent: 85,
          scaleUpMachineType: 'n1-standard-4',
        }
      );
      return { success: true, decision };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

/**
 * Auto-scale a VM if needed
 */
export const gcloudAutoScaleTool: ToolDefinition = {
  name: 'gcloud-auto-scale',
  description: 'Automatically scale a VM if metrics exceed thresholds',
  inputSchema: {
    type: 'object',
    properties: {
      project: {
        type: 'string',
        description: 'GCloud project name',
      },
      zone: {
        type: 'string',
        description: 'Zone',
      },
      instanceName: {
        type: 'string',
        description: 'VM instance name',
      },
      cpuThreshold: {
        type: 'number',
        description: 'CPU threshold percentage (default: 80)',
      },
      durationMinutes: {
        type: 'number',
        description: 'Duration in minutes to check (default: 120)',
      },
    },
    required: ['project', 'zone', 'instanceName'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const gcloud = await getGCloud();
      const result = await gcloud.scaler.autoScale(
        params.project,
        params.zone,
        params.instanceName,
        {
          enabled: true,
          cpuThresholdPercent: params.cpuThreshold || 80,
          cpuDurationMinutes: params.durationMinutes || 120,
          diskThresholdPercent: 85,
          memoryThresholdPercent: 85,
          scaleUpMachineType: 'n1-standard-4',
        }
      );
      return { success: true, result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

/**
 * List configured GCloud projects
 */
export const gcloudListProjectsTool: ToolDefinition = {
  name: 'gcloud-list-projects',
  description: 'List all configured GCloud projects',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const gcloud = await getGCloud();
      const projects = gcloud.manager.listProjects();
      return {
        success: true,
        count: projects.length,
        projects,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

// ============================================================================
// OAuth Management Tools
// ============================================================================

/**
 * List OAuth brands (consent screens)
 */
export const gcloudListOAuthBrandsTool: ToolDefinition = {
  name: 'gcloud-list-oauth-brands',
  description: 'List OAuth brands (consent screens) for a GCloud project',
  inputSchema: {
    type: 'object',
    properties: {
      project: {
        type: 'string',
        description: 'GCloud project name (e.g., odin, openhorizon)',
      },
    },
    required: ['project'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const gcloud = await getGCloud();
      const brands = await gcloud.manager.listOAuthBrands(params.project);
      return {
        success: true,
        count: brands.length,
        brands,
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
 * Create OAuth brand (consent screen)
 */
export const gcloudCreateOAuthBrandTool: ToolDefinition = {
  name: 'gcloud-create-oauth-brand',
  description: 'Create an OAuth brand (consent screen) for a GCloud project',
  inputSchema: {
    type: 'object',
    properties: {
      project: {
        type: 'string',
        description: 'GCloud project name',
      },
      applicationTitle: {
        type: 'string',
        description: 'Application title shown on consent screen',
      },
      supportEmail: {
        type: 'string',
        description: 'Support email address',
      },
    },
    required: ['project', 'applicationTitle', 'supportEmail'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const gcloud = await getGCloud();
      const brand = await gcloud.manager.createOAuthBrand(params.project, {
        applicationTitle: params.applicationTitle,
        supportEmail: params.supportEmail,
      });
      return {
        success: true,
        brand,
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
 * List OAuth clients
 */
export const gcloudListOAuthClientsTool: ToolDefinition = {
  name: 'gcloud-list-oauth-clients',
  description: 'List OAuth clients for a brand. Returns client IDs and secrets.',
  inputSchema: {
    type: 'object',
    properties: {
      project: {
        type: 'string',
        description: 'GCloud project name',
      },
      brandId: {
        type: 'string',
        description: 'Optional brand ID (uses first brand if not specified)',
      },
    },
    required: ['project'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const gcloud = await getGCloud();
      const clients = await gcloud.manager.listOAuthClients(params.project, params.brandId);
      return {
        success: true,
        count: clients.length,
        clients,
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
 * Create OAuth client
 */
export const gcloudCreateOAuthClientTool: ToolDefinition = {
  name: 'gcloud-create-oauth-client',
  description: 'Create an OAuth 2.0 client. Returns client ID and secret.',
  inputSchema: {
    type: 'object',
    properties: {
      project: {
        type: 'string',
        description: 'GCloud project name',
      },
      displayName: {
        type: 'string',
        description: 'Display name for the OAuth client (e.g., "Production Client", "Development Client")',
      },
      brandId: {
        type: 'string',
        description: 'Optional brand ID (uses first brand if not specified)',
      },
    },
    required: ['project', 'displayName'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const gcloud = await getGCloud();
      const client = await gcloud.manager.createOAuthClient(params.project, {
        displayName: params.displayName,
        brandId: params.brandId,
      });
      return {
        success: true,
        client,
        reminder: 'IMPORTANT: Store client_id and secret in vault immediately using mcp__meta__set_secret',
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
 * Get OAuth client (retrieve credentials)
 */
export const gcloudGetOAuthClientTool: ToolDefinition = {
  name: 'gcloud-get-oauth-client',
  description: 'Get OAuth client with secret (for retrieving credentials)',
  inputSchema: {
    type: 'object',
    properties: {
      project: {
        type: 'string',
        description: 'GCloud project name',
      },
      clientName: {
        type: 'string',
        description: 'Full client name (format: projects/PROJECT/brands/BRAND/identityAwareProxyClients/CLIENT_ID)',
      },
    },
    required: ['project', 'clientName'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const gcloud = await getGCloud();
      const client = await gcloud.manager.getOAuthClient(params.project, params.clientName);
      return {
        success: true,
        client,
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
 * Delete OAuth client
 */
export const gcloudDeleteOAuthClientTool: ToolDefinition = {
  name: 'gcloud-delete-oauth-client',
  description: 'Delete an OAuth client',
  inputSchema: {
    type: 'object',
    properties: {
      project: {
        type: 'string',
        description: 'GCloud project name',
      },
      clientName: {
        type: 'string',
        description: 'Full client name to delete',
      },
    },
    required: ['project', 'clientName'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const gcloud = await getGCloud();
      await gcloud.manager.deleteOAuthClient(params.project, params.clientName);
      return {
        success: true,
        message: `Deleted OAuth client: ${params.clientName}`,
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
 * Get all GCloud tools
 */
export function getGCloudTools(): ToolDefinition[] {
  return [
    gcloudGetVMTool,
    gcloudStartVMTool,
    gcloudStopVMTool,
    gcloudResizeVMTool,
    gcloudVMHealthTool,
    gcloudListVMsTool,
    gcloudCreateVMTool,
    gcloudDeleteVMTool,
    gcloudEvaluateScalingTool,
    gcloudAutoScaleTool,
    gcloudListProjectsTool,
    gcloudListOAuthBrandsTool,
    gcloudCreateOAuthBrandTool,
    gcloudListOAuthClientsTool,
    gcloudCreateOAuthClientTool,
    gcloudGetOAuthClientTool,
    gcloudDeleteOAuthClientTool,
  ];
}
