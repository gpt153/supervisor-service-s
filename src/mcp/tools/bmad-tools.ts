/**
 * BMAD Epic Implementation Tools
 *
 * Orchestrates implementation of BMAD epics by reading Implementation Notes
 * and spawning subagents for each task and acceptance criterion validation.
 */

import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { parseBMADEpic, getImplementationNotes, getAllCriteria } from '../../utils/bmad-parser.js';

const META_MCP_ENDPOINT = 'http://localhost:8081/mcp';

/**
 * Call mcp_meta_spawn_subagent via MCP HTTP endpoint
 */
async function spawnSubagent(params: {
  task_type: string;
  description: string;
  context?: any;
}): Promise<any> {
  try {
    const response = await axios.post(META_MCP_ENDPOINT, {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: 'mcp_meta_spawn_subagent',
        arguments: params
      }
    }, {
      timeout: 35 * 60 * 1000, // 35 minute timeout (allows for 30min agent + overhead)
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.data.error) {
      throw new Error(response.data.error.message || 'MCP call failed');
    }

    return response.data.result;
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED') {
      throw new Error('MCP server not running on port 8081. Start with: npm run start:mcp');
    }
    if (error.code === 'ETIMEDOUT') {
      throw new Error('Spawn subagent timeout - agent took longer than 35 minutes');
    }
    throw error;
  }
}

export interface BMADImplementEpicParams {
  projectName: string;
  projectPath: string;
  epicFile: string;
  baseBranch?: string;
  createPR?: boolean;
}

export interface BMADImplementEpicResult {
  success: boolean;
  epic_id: string;
  epic_title: string;
  tasks_completed: number;
  criteria_validation?: {
    total: number;
    met: number;
    results: Array<{
      criterion: string;
      section: string;
      met: boolean;
      evidence?: any;
    }>;
  };
  pr_url?: string;
  error?: string;
  failed_task?: string;
  task_index?: number;
}

/**
 * Implement a BMAD epic by executing Implementation Notes sequentially
 * and validating all acceptance criteria.
 */
async function bmadImplementEpic(params: BMADImplementEpicParams): Promise<BMADImplementEpicResult> {
  try {
    // 1. Read and parse epic file
    const epicFilePath = path.join(params.projectPath, params.epicFile);
    console.log(`[BMAD] Reading epic from: ${epicFilePath}`);

    let epicContent: string;
    try {
      epicContent = await fs.readFile(epicFilePath, 'utf-8');
    } catch (error) {
      return {
        success: false,
        epic_id: 'unknown',
        epic_title: 'unknown',
        tasks_completed: 0,
        error: `Failed to read epic file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }

    const epic = parseBMADEpic(epicContent, params.epicFile);
    console.log(`[BMAD] Parsed epic: ${epic.id} - ${epic.title}`);

    // 2. Get implementation tasks
    const tasks = getImplementationNotes(epic);
    if (tasks.length === 0) {
      return {
        success: false,
        epic_id: epic.id,
        epic_title: epic.title,
        tasks_completed: 0,
        error: 'No implementation notes found in epic',
      };
    }

    console.log(`[BMAD] Found ${tasks.length} implementation tasks`);

    // 3. Execute each task sequentially
    const completedTasks: string[] = [];

    for (const [index, task] of tasks.entries()) {
      console.log(`[BMAD] Task ${index + 1}/${tasks.length}: ${task}`);

      try {
        const result = await spawnSubagent({
          task_type: 'implementation',
          description: task,
          context: {
            epic_file: params.epicFile,
            epic_content: epicContent,
            current_task: task,
            task_index: index,
            completed_tasks: completedTasks,
            project_path: params.projectPath,
          },
        });

        // Check if task succeeded
        if (!result.success) {
          console.error(`[BMAD] Task ${index + 1} failed:`, result.error);
          return {
            success: false,
            epic_id: epic.id,
            epic_title: epic.title,
            tasks_completed: completedTasks.length,
            failed_task: task,
            task_index: index,
            error: result.error || 'Task execution failed',
          };
        }

        completedTasks.push(task);
        console.log(`[BMAD] Task ${index + 1} completed successfully`);
      } catch (error) {
        console.error(`[BMAD] Exception during task ${index + 1}:`, error);
        return {
          success: false,
          epic_id: epic.id,
          epic_title: epic.title,
          tasks_completed: completedTasks.length,
          failed_task: task,
          task_index: index,
          error: error instanceof Error ? error.message : 'Unknown error during task execution',
        };
      }
    }

    console.log(`[BMAD] All ${tasks.length} tasks completed successfully`);

    // 4. Validate ALL acceptance criteria
    const criteria = getAllCriteria(epic);
    console.log(`[BMAD] Validating ${criteria.length} acceptance criteria`);

    const criteriaResults = [];

    for (const criterion of criteria) {
      console.log(`[BMAD] Validating: [${criterion.section}] ${criterion.criterion}`);

      try {
        const result = await spawnSubagent({
          task_type: 'validation',
          description: `Validate: ${criterion.criterion}`,
          context: {
            epic_file: params.epicFile,
            criterion: criterion.criterion,
            section: criterion.section,
            project_path: params.projectPath,
          },
        });

        criteriaResults.push({
          criterion: criterion.criterion,
          section: criterion.section,
          met: result.success || false,
          evidence: result.output || result.error,
        });

        console.log(`[BMAD] Criterion validation: ${result.success ? 'MET' : 'NOT MET'}`);
      } catch (error) {
        console.error(`[BMAD] Exception during criterion validation:`, error);
        criteriaResults.push({
          criterion: criterion.criterion,
          section: criterion.section,
          met: false,
          evidence: error instanceof Error ? error.message : 'Validation failed',
        });
      }
    }

    const allCriteriaMet = criteriaResults.every((c) => c.met);
    const metCount = criteriaResults.filter((c) => c.met).length;

    console.log(`[BMAD] Criteria validation: ${metCount}/${criteria.length} met`);

    // 5. Create PR if requested and all criteria met
    let prUrl: string | undefined;

    if (params.createPR && allCriteriaMet) {
      console.log('[BMAD] All criteria met - creating PR');

      // Note: PR creation would be handled by Execute agents
      // who already committed code. This would just invoke gh CLI
      // to create the PR based on the current branch.

      // For now, we'll note that PR creation is handled separately
      // by the Execute agents' git workflow
      prUrl = undefined; // Would be set by actual gh pr create call
    }

    // 6. Return final result
    return {
      success: allCriteriaMet,
      epic_id: epic.id,
      epic_title: epic.title,
      tasks_completed: completedTasks.length,
      criteria_validation: {
        total: criteriaResults.length,
        met: metCount,
        results: criteriaResults,
      },
      pr_url: prUrl,
    };
  } catch (error) {
    console.error('[BMAD] Unexpected error:', error);
    return {
      success: false,
      epic_id: 'unknown',
      epic_title: 'unknown',
      tasks_completed: 0,
      error: error instanceof Error ? error.message : 'Unexpected error during epic implementation',
    };
  }
}

/**
 * Get BMAD tool definitions for MCP server
 */
export function getBMADTools() {
  return [
    {
      name: 'mcp_meta_bmad_implement_epic',
      description: 'Implement a BMAD epic by executing Implementation Notes and validating acceptance criteria',
      inputSchema: {
        type: 'object',
        properties: {
          projectName: {
            type: 'string',
            description: 'Name of the project (e.g., "odin", "consilio")',
          },
          projectPath: {
            type: 'string',
            description: 'Absolute path to the project directory',
          },
          epicFile: {
            type: 'string',
            description: 'Relative path to epic file from project root (e.g., ".bmad/epics/001-project-foundation.md")',
          },
          baseBranch: {
            type: 'string',
            description: 'Base branch to create feature branch from (default: "main")',
          },
          createPR: {
            type: 'boolean',
            description: 'Create pull request after implementation (default: true)',
          },
        },
        required: ['projectName', 'projectPath', 'epicFile'],
      },
      handler: bmadImplementEpic,
    },
  ];
}
