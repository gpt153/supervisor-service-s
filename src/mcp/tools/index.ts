/**
 * Tool definitions for the MCP server
 */

import { ToolDefinition, ProjectContext } from '../../types/project.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { getPortTools } from '../../ports/port-tools.js';
import { getTimingTools } from './timing-tools.js';
import { getSecretTools } from './secrets-tools.js';
import { getLearningTools } from './learning-tools.js';
import { getInstructionTools } from './instruction-tools.js';
import { getCloudflareTools } from '../../cloudflare/cloudflare-tools.js';
import { getGCloudTools } from '../../gcloud/gcloud-tools.js';
import { getPIVTools } from './piv-tools.js';
import { getProjectContextTools } from './project-context-tools.js';
import { getMultiAgentTools } from './multi-agent-tools.js';
import { tunnelTools } from './tunnel-tools.js';
import { getUsageMonitoringTools } from './usage-monitoring-tools.js';
import { getSubscriptionOptimizationTools } from './subscription-optimization-tools.js';
import { getAPIKeyAutomationTools } from './api-key-automation-tools.js';
import { spawnSubagentTool } from './spawn-subagent-tool.js';
import { uiTools } from './ui-tools.js';
import { getPerStepPIVTools } from './piv-per-step-tool.js';
import { getPIVPhaseTools } from './piv-phase-tools.js';
import { getBMADTools } from './bmad-tools.js';
import { getBMADFullWorkflowTools } from './bmad-full-workflow.js';
import { getPRDStalenessTools } from './prd-staleness-tools.js';
import { getSessionTools } from './session-tools.js';
import { getSnippetTools } from './snippet-tools.js';
import { getLineageTools } from './lineage-tools.js';
import { getMobileTools } from './mobile-tools.js';
import { getEventStoreTools } from './event-tools.js';
import { getTranscriptTools } from './transcript-tools.js';
import { backupTools } from './backup-tools.js';

const execAsync = promisify(exec);

/**
 * Task status tool - Get status of tasks in a project
 */
export const taskStatusTool: ToolDefinition = {
  name: 'task-status',
  description: 'Get the status of tasks in the project workspace',
  inputSchema: {
    type: 'object',
    properties: {
      filter: {
        type: 'string',
        description: 'Optional filter for task status (pending, active, done)',
      },
    },
  },
  handler: async (params, context: ProjectContext) => {
    const workspaceDir = path.join(context.workingDirectory, '.scar');

    try {
      const exists = await fs.access(workspaceDir).then(() => true).catch(() => false);
      if (!exists) {
        return {
          status: 'no_workspace',
          message: 'No SCAR workspace found in this project',
          project: context.project.name,
        };
      }

      // Read task files
      const taskFiles = await fs.readdir(workspaceDir);
      const tasks = [];

      for (const file of taskFiles) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(workspaceDir, file), 'utf-8');
          try {
            const task = JSON.parse(content);
            tasks.push(task);
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }

      const filtered = params.filter
        ? tasks.filter((t: any) => t.status === params.filter)
        : tasks;

      return {
        project: context.project.name,
        totalTasks: tasks.length,
        filteredTasks: filtered.length,
        tasks: filtered,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        project: context.project.name,
      };
    }
  },
};

/**
 * Issue list tool - List GitHub issues for a project
 */
export const issueListTool: ToolDefinition = {
  name: 'issue-list',
  description: 'List GitHub issues for the project',
  inputSchema: {
    type: 'object',
    properties: {
      state: {
        type: 'string',
        description: 'Issue state: open, closed, or all',
        enum: ['open', 'closed', 'all'],
      },
      limit: {
        type: 'number',
        description: 'Maximum number of issues to return',
      },
    },
  },
  handler: async (params, context: ProjectContext) => {
    return {
      project: context.project.name,
      message: 'Issue list tool - implementation depends on GitHub integration',
      params,
    };
  },
};

/**
 * Epic progress tool - Get progress on epics
 */
export const epicProgressTool: ToolDefinition = {
  name: 'epic-progress',
  description: 'Get progress information for epics in the project',
  inputSchema: {
    type: 'object',
    properties: {
      epicId: {
        type: 'string',
        description: 'Optional epic ID to get specific epic progress',
      },
    },
  },
  handler: async (params, context: ProjectContext) => {
    const epicsDir = path.join(context.workingDirectory, '.bmad', 'epics');

    try {
      const exists = await fs.access(epicsDir).then(() => true).catch(() => false);
      if (!exists) {
        return {
          status: 'no_epics',
          message: 'No epics directory found in this project',
          project: context.project.name,
        };
      }

      return {
        project: context.project.name,
        message: 'Epic progress tracking - ready for implementation',
        epicsDir,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        project: context.project.name,
      };
    }
  },
};

/**
 * SCAR monitor tool - Monitor SCAR workspace
 */
export const scarMonitorTool: ToolDefinition = {
  name: 'scar-monitor',
  description: 'Monitor SCAR workspace for changes and status',
  inputSchema: {
    type: 'object',
    properties: {
      detailed: {
        type: 'boolean',
        description: 'Include detailed information about each task',
      },
    },
  },
  handler: async (params, context: ProjectContext) => {
    return {
      project: context.project.name,
      message: 'SCAR monitoring - ready for implementation',
      workingDirectory: context.workingDirectory,
    };
  },
};

/**
 * Code analysis tool - Analyze code in the project
 */
export const codeAnalysisTool: ToolDefinition = {
  name: 'code-analysis',
  description: 'Analyze code structure and patterns in the project',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Relative path within project to analyze',
      },
      type: {
        type: 'string',
        description: 'Type of analysis: structure, complexity, dependencies',
        enum: ['structure', 'complexity', 'dependencies'],
      },
    },
  },
  handler: async (params, context: ProjectContext) => {
    const targetPath = params.path
      ? path.join(context.workingDirectory, params.path)
      : context.workingDirectory;

    return {
      project: context.project.name,
      analysisType: params.type || 'structure',
      targetPath,
      message: 'Code analysis - ready for implementation',
    };
  },
};

/**
 * Meta/Infrastructure tools
 */

export const serviceStatusTool: ToolDefinition = {
  name: 'service-status',
  description: 'Get status of supervisor services',
  inputSchema: {
    type: 'object',
    properties: {
      service: {
        type: 'string',
        description: 'Specific service to check (optional)',
      },
    },
  },
  handler: async (params, context: ProjectContext) => {
    return {
      service: params.service || 'all',
      status: 'running',
      message: 'Service status check - ready for implementation',
    };
  },
};

export const serviceRestartTool: ToolDefinition = {
  name: 'service-restart',
  description: 'Restart a supervisor service',
  inputSchema: {
    type: 'object',
    properties: {
      service: {
        type: 'string',
        description: 'Service to restart',
      },
    },
    required: ['service'],
  },
  handler: async (params, context: ProjectContext) => {
    return {
      service: params.service,
      status: 'restarted',
      message: 'Service restart - ready for implementation',
    };
  },
};

export const serviceLogsTool: ToolDefinition = {
  name: 'service-logs',
  description: 'Get logs from supervisor services',
  inputSchema: {
    type: 'object',
    properties: {
      service: {
        type: 'string',
        description: 'Service to get logs from',
      },
      lines: {
        type: 'number',
        description: 'Number of log lines to retrieve',
      },
    },
    required: ['service'],
  },
  handler: async (params, context: ProjectContext) => {
    return {
      service: params.service,
      lines: params.lines || 100,
      message: 'Service logs - ready for implementation',
    };
  },
};

export const healthCheckTool: ToolDefinition = {
  name: 'health-check',
  description: 'Perform health check on all supervisor services',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  handler: async (params, context: ProjectContext) => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: [],
      message: 'Health check - ready for implementation',
    };
  },
};

export const systemMetricsTool: ToolDefinition = {
  name: 'system-metrics',
  description: 'Get system metrics and resource usage',
  inputSchema: {
    type: 'object',
    properties: {
      metric: {
        type: 'string',
        description: 'Specific metric to retrieve (cpu, memory, disk)',
        enum: ['cpu', 'memory', 'disk', 'all'],
      },
    },
  },
  handler: async (params, context: ProjectContext) => {
    return {
      metric: params.metric || 'all',
      message: 'System metrics - ready for implementation',
    };
  },
};


/**
 * Get all tools
 */
export function getAllTools(): ToolDefinition[] {
  return [
    // Project tools
    taskStatusTool,
    issueListTool,
    epicProgressTool,
    scarMonitorTool,
    codeAnalysisTool,

    // Meta tools
    serviceStatusTool,
    serviceRestartTool,
    serviceLogsTool,
    healthCheckTool,
    systemMetricsTool,

    // Port allocation tools
    ...getPortTools(),

    // Secrets management tools
    ...getSecretTools(),

    // Timing and estimation tools
    ...getTimingTools(),

    // Learning system tools
    ...getLearningTools(),

    // Instruction management tools
    ...getInstructionTools(),

    // Cloudflare integration tools
    ...getCloudflareTools(),

    // GCloud integration tools
    ...getGCloudTools(),

    // PIV loop tools (monolithic)
    ...getPIVTools(),

    // PIV per-step tools (granular control)
    ...getPerStepPIVTools(),
    ...getPIVPhaseTools(),

    // BMAD epic implementation tools
    ...getBMADTools(),

    // BMAD full workflow orchestrator (all 4 phases)
    ...getBMADFullWorkflowTools(),

    // Project context tools
    ...getProjectContextTools(),

    // Multi-agent CLI integration tools
    ...getMultiAgentTools(),

    // Tunnel management tools
    ...tunnelTools,

    // Usage monitoring and cost tracking tools
    ...getUsageMonitoringTools(),

    // Subscription optimization tools
    ...getSubscriptionOptimizationTools(),

    // API key automation tools
    ...getAPIKeyAutomationTools(),

    // Subagent spawning tool
    spawnSubagentTool,

    // UI-First Development Workflow tools
    ...uiTools,

    // PRD staleness monitoring tools
    ...getPRDStalenessTools(),

    // Session continuity and instance registry tools (Epic 007-A)
    ...getSessionTools(),

    // Snippet extraction tools for conversation analysis (Epic 009-B)
    ...getSnippetTools(),

    // Event store tools for session state tracking (Epic 007-C)
    ...getEventStoreTools(),

    // Event lineage debugging and analysis tools (Epic 008-D)
    ...getLineageTools(),

    // Mobile app development platform tools (Epic M-001)
    ...getMobileTools(),

    // Transcript lookup tools for Claude Code sessions (Epic 009-C)
    ...getTranscriptTools(),

    // Backup automation tools for Claude Code sessions (Epic 009-D)
    ...backupTools,
  ];
}

// Re-export timing and learning tools
export * from './timing-tools.js';
export * from './learning-tools.js';
