/**
 * MCP Tools for PIV Loop Management
 *
 * These tools allow supervisors to spawn and manage PIV (Plan → Implement → Validate) agents
 */

import { ToolDefinition, ProjectContext } from '../../types/project.js';
import { PIVAgent } from '../../agents/PIVAgent.js';
import type { Epic, PIVConfig } from '../../types/piv.js';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// Track active PIV loops
const activePIVLoops = new Map<
  string,
  {
    agent: PIVAgent;
    config: PIVConfig;
    status: 'prime' | 'plan' | 'execute' | 'complete' | 'failed';
    startTime: Date;
    epicId: string;
    projectName: string;
  }
>();

/**
 * Start a PIV loop for an epic
 */
export const startPIVLoopTool: ToolDefinition = {
  name: 'mcp__meta__start_piv_loop',
  description:
    'Start a PIV (Plan → Implement → Validate) loop to autonomously implement an epic. PIV spawns subagents that research the codebase, create an implementation plan, and execute the implementation.',
  inputSchema: {
    type: 'object',
    properties: {
      projectName: {
        type: 'string',
        description: 'Name of the project (e.g., "consilio", "odin")',
      },
      projectPath: {
        type: 'string',
        description: 'Absolute path to the project directory',
      },
      epicId: {
        type: 'string',
        description: 'Epic ID (e.g., "epic-010")',
      },
      epicTitle: {
        type: 'string',
        description: 'Epic title',
      },
      epicDescription: {
        type: 'string',
        description: 'Epic description',
      },
      acceptanceCriteria: {
        type: 'array',
        description: 'Array of acceptance criteria',
        items: { type: 'string' },
      },
      tasks: {
        type: 'array',
        description: 'Array of tasks/user stories',
        items: { type: 'string' },
      },
      baseBranch: {
        type: 'string',
        description: 'Base branch to create feature branch from (default: main)',
        default: 'main',
      },
      createPR: {
        type: 'boolean',
        description: 'Create pull request after implementation (default: true)',
        default: true,
      },
    },
    required: [
      'projectName',
      'projectPath',
      'epicId',
      'epicTitle',
      'epicDescription',
      'acceptanceCriteria',
      'tasks',
    ],
  },
  handler: async (params, context: ProjectContext) => {
    const {
      projectName,
      projectPath,
      epicId,
      epicTitle,
      epicDescription,
      acceptanceCriteria,
      tasks,
      baseBranch = 'main',
      createPR = true,
    } = params;

    try {
      // Check if PIV loop already running for this epic
      const loopId = `${projectName}:${epicId}`;
      if (activePIVLoops.has(loopId)) {
        return {
          success: false,
          error: `PIV loop already running for ${epicId}`,
          hint: `Use mcp__meta__piv_status to check progress`,
        };
      }

      // Create epic object
      const epic: Epic = {
        id: epicId,
        title: epicTitle,
        description: epicDescription,
        acceptanceCriteria,
        tasks,
      };

      // Create PIV config
      const config: PIVConfig = {
        project: {
          name: projectName,
          path: projectPath,
        },
        epic,
        workingDirectory: projectPath,
        git: {
          baseBranch,
          createBranch: true,
          createPR,
        },
        storage: {
          plansDir: join(projectPath, '.agents', 'plans'),
          contextDir: join(projectPath, '.agents', 'context'),
        },
      };

      // Ensure storage directories exist
      await mkdir(config.storage!.plansDir!, { recursive: true });
      await mkdir(config.storage!.contextDir!, { recursive: true });

      // Create PIV agent
      const agent = new PIVAgent(config);

      // Track active loop
      activePIVLoops.set(loopId, {
        agent,
        config,
        status: 'prime',
        startTime: new Date(),
        epicId,
        projectName,
      });

      // Save active PIV metadata
      await saveActivePIVState(projectPath, loopId, {
        epicId,
        epicTitle,
        status: 'prime',
        startTime: new Date().toISOString(),
      });

      // Start PIV loop asynchronously
      agent
        .run()
        .then(async result => {
          const loop = activePIVLoops.get(loopId);
          if (loop) {
            loop.status = 'complete';
            await saveActivePIVState(projectPath, loopId, {
              epicId,
              epicTitle,
              status: 'complete',
              startTime: loop.startTime.toISOString(),
              completeTime: new Date().toISOString(),
              result,
            });
          }
          console.log(`[PIV] ${loopId} completed successfully`);
        })
        .catch(async error => {
          const loop = activePIVLoops.get(loopId);
          if (loop) {
            loop.status = 'failed';
            await saveActivePIVState(projectPath, loopId, {
              epicId,
              epicTitle,
              status: 'failed',
              startTime: loop.startTime.toISOString(),
              failTime: new Date().toISOString(),
              error: error.message,
            });
          }
          console.error(`[PIV] ${loopId} failed:`, error);
        });

      return {
        success: true,
        loopId,
        epicId,
        epicTitle,
        projectName,
        status: 'started',
        message: `PIV loop started for ${epicTitle}. Use mcp__meta__piv_status to check progress.`,
        phases: {
          next: 'Prime (codebase research)',
          upcoming: ['Plan (implementation design)', 'Execute (implementation + validation)'],
        },
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
 * Check status of a PIV loop
 */
export const pivStatusTool: ToolDefinition = {
  name: 'mcp__meta__piv_status',
  description: 'Check the status of a running PIV loop',
  inputSchema: {
    type: 'object',
    properties: {
      projectName: {
        type: 'string',
        description: 'Project name (optional if epicId is unique)',
      },
      epicId: {
        type: 'string',
        description: 'Epic ID to check status for',
      },
    },
    required: ['epicId'],
  },
  handler: async (params, context: ProjectContext) => {
    const { projectName, epicId } = params;

    try {
      // Find the loop (with or without projectName)
      let loopId: string | undefined;
      if (projectName) {
        loopId = `${projectName}:${epicId}`;
      } else {
        // Search for epic across all projects
        for (const key of activePIVLoops.keys()) {
          if (key.endsWith(`:${epicId}`)) {
            loopId = key;
            break;
          }
        }
      }

      if (!loopId || !activePIVLoops.has(loopId)) {
        return {
          success: false,
          error: `No active PIV loop found for ${epicId}`,
          hint: 'PIV loop may have completed or not started yet',
        };
      }

      const loop = activePIVLoops.get(loopId)!;
      const duration = Date.now() - loop.startTime.getTime();
      const durationMinutes = Math.floor(duration / 60000);

      return {
        success: true,
        loopId,
        epicId: loop.epicId,
        projectName: loop.projectName,
        status: loop.status,
        startTime: loop.startTime.toISOString(),
        durationMinutes,
        currentPhase: getPhaseDescription(loop.status),
        epic: {
          id: loop.config.epic.id,
          title: loop.config.epic.title,
        },
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
 * Cancel a running PIV loop
 */
export const cancelPIVTool: ToolDefinition = {
  name: 'mcp__meta__cancel_piv',
  description: 'Cancel a running PIV loop (use only if PIV is stuck or needs to stop)',
  inputSchema: {
    type: 'object',
    properties: {
      projectName: {
        type: 'string',
        description: 'Project name',
      },
      epicId: {
        type: 'string',
        description: 'Epic ID to cancel',
      },
    },
    required: ['epicId'],
  },
  handler: async (params, context: ProjectContext) => {
    const { projectName, epicId } = params;

    try {
      // Find the loop
      let loopId: string | undefined;
      if (projectName) {
        loopId = `${projectName}:${epicId}`;
      } else {
        for (const key of activePIVLoops.keys()) {
          if (key.endsWith(`:${epicId}`)) {
            loopId = key;
            break;
          }
        }
      }

      if (!loopId || !activePIVLoops.has(loopId)) {
        return {
          success: false,
          error: `No active PIV loop found for ${epicId}`,
        };
      }

      // Remove from active loops
      activePIVLoops.delete(loopId);

      // Update status file
      const loop = activePIVLoops.get(loopId);
      if (loop) {
        await saveActivePIVState(loop.config.project.path, loopId, {
          epicId: loop.epicId,
          epicTitle: loop.config.epic.title,
          status: 'cancelled',
          startTime: loop.startTime.toISOString(),
          cancelTime: new Date().toISOString(),
        });
      }

      return {
        success: true,
        message: `PIV loop for ${epicId} cancelled`,
        note: 'The PIV agent will stop after completing its current phase',
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
 * List all active PIV loops
 */
export const listActivePIVTool: ToolDefinition = {
  name: 'mcp__meta__list_active_piv',
  description: 'List all currently active PIV loops across all projects',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const active: Array<{
        loopId: string;
        projectName: string;
        epicId: string;
        epicTitle: string;
        status: string;
        durationMinutes: number;
      }> = [];

      for (const [loopId, loop] of activePIVLoops.entries()) {
        const duration = Date.now() - loop.startTime.getTime();
        const durationMinutes = Math.floor(duration / 60000);

        active.push({
          loopId,
          projectName: loop.projectName,
          epicId: loop.epicId,
          epicTitle: loop.config.epic.title,
          status: loop.status,
          durationMinutes,
        });
      }

      return {
        success: true,
        count: active.length,
        loops: active,
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
 * Save active PIV state to project directory
 */
async function saveActivePIVState(
  projectPath: string,
  loopId: string,
  state: any
): Promise<void> {
  const agentsDir = join(projectPath, '.agents');
  await mkdir(agentsDir, { recursive: true });

  const statePath = join(agentsDir, 'active-piv.json');

  let allStates: Record<string, any> = {};
  if (existsSync(statePath)) {
    const content = await readFile(statePath, 'utf-8');
    allStates = JSON.parse(content);
  }

  allStates[loopId] = state;

  await writeFile(statePath, JSON.stringify(allStates, null, 2), 'utf-8');
}

/**
 * Get human-readable phase description
 */
function getPhaseDescription(status: string): string {
  switch (status) {
    case 'prime':
      return 'Prime: Researching codebase and analyzing patterns';
    case 'plan':
      return 'Plan: Creating detailed implementation plan';
    case 'execute':
      return 'Execute: Implementing features and running validation';
    case 'complete':
      return 'Complete: All phases finished successfully';
    case 'failed':
      return 'Failed: PIV loop encountered an error';
    default:
      return 'Unknown phase';
  }
}

/**
 * Get all PIV tools
 */
export function getPIVTools(): ToolDefinition[] {
  return [startPIVLoopTool, pivStatusTool, cancelPIVTool, listActivePIVTool];
}
