/**
 * Individual PIV Phase Tools
 *
 * Allows PS to run individual PIV phases for maximum control:
 * - mcp_meta_run_prime: Research phase only
 * - mcp_meta_run_plan: Planning phase only (requires Prime results)
 * - mcp_meta_run_execute: Execute phase only (requires Plan results)
 */

import { ToolDefinition, ProjectContext } from '../../types/project.js';
import axios from 'axios';

const META_MCP_ENDPOINT = 'http://localhost:8081/mcp/meta';

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
      timeout: 35 * 60 * 1000, // 35 minute timeout
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

/**
 * Run Prime Phase (Research) Only
 */
export const runPrimeTool: ToolDefinition = {
  name: 'mcp_meta_run_prime',
  description: 'Run only the Prime phase (codebase research). Analyzes tech stack, patterns, naming conventions, and integration points.',
  inputSchema: {
    type: 'object',
    properties: {
      epicId: {
        type: 'string',
        description: 'Epic identifier'
      },
      epicTitle: {
        type: 'string',
        description: 'Epic title'
      },
      epicDescription: {
        type: 'string',
        description: 'Epic description'
      },
      projectName: {
        type: 'string',
        description: 'Project name'
      },
      projectPath: {
        type: 'string',
        description: 'Absolute path to project directory'
      }
    },
    required: ['epicId', 'epicTitle', 'epicDescription', 'projectName', 'projectPath']
  },

  handler: async (params: any, context?: ProjectContext) => {
    console.log(`[Prime] Running Prime phase for ${params.epicId}...`);

    const result = await spawnSubagent({
      task_type: 'research',
      description: `Analyze ${params.projectName} codebase for epic: ${params.epicTitle}. Identify tech stack, patterns, naming conventions, and integration points.`,
      context: {
        epic_id: params.epicId,
        epic_title: params.epicTitle,
        epic_description: params.epicDescription,
        project_path: params.projectPath,
        project_name: params.projectName
      }
    });

    console.log(`[Prime] ${result.success ? 'Complete' : 'Failed'}`);

    return result;
  }
};

/**
 * Run Plan Phase Only
 */
export const runPlanTool: ToolDefinition = {
  name: 'mcp_meta_run_plan',
  description: 'Run only the Plan phase (implementation planning). Requires Prime phase results. Creates detailed implementation plan with tasks and validation commands.',
  inputSchema: {
    type: 'object',
    properties: {
      epicId: {
        type: 'string',
        description: 'Epic identifier'
      },
      epicTitle: {
        type: 'string',
        description: 'Epic title'
      },
      epicDescription: {
        type: 'string',
        description: 'Epic description'
      },
      acceptanceCriteria: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of acceptance criteria'
      },
      tasks: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional user stories/tasks'
      },
      projectName: {
        type: 'string',
        description: 'Project name'
      },
      projectPath: {
        type: 'string',
        description: 'Absolute path to project directory'
      },
      contextFile: {
        type: 'string',
        description: 'Optional path to Prime context file (if Prime was run)'
      },
      primeOutput: {
        type: 'string',
        description: 'Optional Prime phase output text'
      }
    },
    required: ['epicId', 'epicTitle', 'epicDescription', 'acceptanceCriteria', 'projectName', 'projectPath']
  },

  handler: async (params: any, context?: ProjectContext) => {
    console.log(`[Plan] Running Plan phase for ${params.epicId}...`);

    const result = await spawnSubagent({
      task_type: 'planning',
      description: `Create detailed implementation plan for epic: ${params.epicTitle}. Break down into phases with prescriptive task instructions and validation commands.`,
      context: {
        epic_id: params.epicId,
        epic_title: params.epicTitle,
        epic_description: params.epicDescription,
        acceptance_criteria: params.acceptanceCriteria,
        tasks: params.tasks || [],
        project_path: params.projectPath,
        project_name: params.projectName,
        context_file: params.contextFile,
        prime_output: params.primeOutput || ''
      }
    });

    console.log(`[Plan] ${result.success ? 'Complete' : 'Failed'}`);

    return result;
  }
};

/**
 * Run Execute Phase Only
 */
export const runExecuteTool: ToolDefinition = {
  name: 'mcp_meta_run_execute',
  description: 'Run only the Execute phase (implementation). Requires Plan phase results. Implements the feature, writes tests, commits to git.',
  inputSchema: {
    type: 'object',
    properties: {
      epicId: {
        type: 'string',
        description: 'Epic identifier'
      },
      epicTitle: {
        type: 'string',
        description: 'Epic title'
      },
      epicDescription: {
        type: 'string',
        description: 'Epic description'
      },
      acceptanceCriteria: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of acceptance criteria to validate'
      },
      projectName: {
        type: 'string',
        description: 'Project name'
      },
      projectPath: {
        type: 'string',
        description: 'Absolute path to project directory'
      },
      planFile: {
        type: 'string',
        description: 'Optional path to Plan file (if Plan was run)'
      },
      planOutput: {
        type: 'string',
        description: 'Optional Plan phase output text'
      },
      baseBranch: {
        type: 'string',
        description: 'Base branch (default: main)'
      },
      createPR: {
        type: 'boolean',
        description: 'Create pull request after implementation (default: true)'
      }
    },
    required: ['epicId', 'epicTitle', 'epicDescription', 'acceptanceCriteria', 'projectName', 'projectPath']
  },

  handler: async (params: any, context?: ProjectContext) => {
    console.log(`[Execute] Running Execute phase for ${params.epicId}...`);

    const result = await spawnSubagent({
      task_type: 'implementation',
      description: `Implement epic: ${params.epicTitle} following the plan. CRITICAL: Write actual code (not just docs), run tests, commit changes to git.`,
      context: {
        epic_id: params.epicId,
        epic_title: params.epicTitle,
        epic_description: params.epicDescription,
        acceptance_criteria: params.acceptanceCriteria,
        project_path: params.projectPath,
        project_name: params.projectName,
        plan_file: params.planFile,
        plan_output: params.planOutput || '',
        base_branch: params.baseBranch || 'main',
        create_pr: params.createPR !== false
      }
    });

    console.log(`[Execute] ${result.success ? 'Complete' : 'Failed'}`);

    return result;
  }
};

/**
 * Get all individual PIV phase tools
 */
export function getPIVPhaseTools(): ToolDefinition[] {
  return [runPrimeTool, runPlanTool, runExecuteTool];
}
