/**
 * PIV Per-Step Orchestrator Tool
 *
 * Spawns PIV phases individually instead of monolithic loop
 * Gives PS granular control to monitor, restart, and validate between phases
 */

import { ToolDefinition, ProjectContext } from '../../types/project.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { pool } from '../../db/client.js';
import axios from 'axios';

interface PIVPerStepParams {
  projectName: string;
  projectPath: string;
  epicId: string;
  epicTitle: string;
  epicDescription: string;
  acceptanceCriteria: string[];
  tasks?: string[];
  baseBranch?: string;
  createPR?: boolean;
}

interface PhaseResult {
  success: boolean;
  phase: 'prime' | 'plan' | 'execute';
  output?: string;
  error?: string;
  context_path?: string;
  plan_path?: string;
  pr_url?: string;
  files_changed?: string[];
}

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

/**
 * Validate acceptance criteria after Execute phase
 *
 * For each criterion, spawn a validation subagent to check if it's met
 */
async function validateAcceptanceCriteria(
  epicId: string,
  acceptanceCriteria: string[],
  projectPath: string
): Promise<{ criterion: string; met: boolean; details: string }[]> {
  const results = [];

  for (const criterion of acceptanceCriteria) {
    console.log(`[PIV] Validating: "${criterion}"`);

    try {
      const validationResult = await spawnSubagent({
        task_type: 'validation',
        description: `Verify acceptance criterion is met: "${criterion}"`,
        context: {
          epic_id: epicId,
          criterion,
          project_path: projectPath
        }
      });

      results.push({
        criterion,
        met: validationResult.success === true,
        details: validationResult.output || 'Validation completed'
      });
    } catch (error: any) {
      console.error(`[PIV] Validation failed for "${criterion}":`, error.message);
      results.push({
        criterion,
        met: false,
        details: `Validation error: ${error.message}`
      });
    }
  }

  return results;
}

/**
 * PIV Per-Step Tool Definition
 *
 * Runs PIV loop with individual agent spawns for each phase
 */
export const pivPerStepTool: ToolDefinition = {
  name: 'mcp_meta_run_piv_per_step',
  description: 'Run PIV loop with per-step spawning (Prime → Plan → Execute) for granular control. PS can monitor and restart individual phases.',
  inputSchema: {
    type: 'object',
    properties: {
      projectName: {
        type: 'string',
        description: 'Project name (e.g., "consilio", "odin")'
      },
      projectPath: {
        type: 'string',
        description: 'Absolute path to project directory'
      },
      epicId: {
        type: 'string',
        description: 'Epic identifier (e.g., "epic-006")'
      },
      epicTitle: {
        type: 'string',
        description: 'Epic title'
      },
      epicDescription: {
        type: 'string',
        description: 'Epic description and requirements'
      },
      acceptanceCriteria: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of acceptance criteria that must be met'
      },
      tasks: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional user stories/tasks for the epic'
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
    required: ['projectName', 'projectPath', 'epicId', 'epicTitle', 'epicDescription', 'acceptanceCriteria']
  },

  handler: async (params: any, context?: ProjectContext) => {
    const typedParams = params as PIVPerStepParams;

    console.log(`\n=== PIV PER-STEP: ${typedParams.epicId} ===`);
    console.log(`Project: ${typedParams.projectName}`);
    console.log(`Epic: ${typedParams.epicTitle}`);
    console.log(`Mode: Per-step spawning`);

    const startTime = Date.now();
    const results: { [key: string]: any } = {};

    try {
      // ============================
      // PHASE 1: PRIME (Research)
      // ============================
      console.log('\n--- PHASE 1: PRIME (Research) ---');
      console.log('[PIV] Spawning Prime agent...');

      const primeResult = await spawnSubagent({
        task_type: 'research',
        description: `Analyze ${typedParams.projectName} codebase for epic: ${typedParams.epicTitle}. Identify tech stack, patterns, naming conventions, and integration points.`,
        context: {
          epic_id: typedParams.epicId,
          epic_title: typedParams.epicTitle,
          epic_description: typedParams.epicDescription,
          project_path: typedParams.projectPath,
          project_name: typedParams.projectName
        }
      });

      if (!primeResult.success) {
        return {
          success: false,
          phase: 'prime',
          error: primeResult.error || 'Prime phase failed',
          duration_ms: Date.now() - startTime
        };
      }

      console.log('[PIV] Prime phase complete');
      console.log(`  Output preview: ${(primeResult.output || '').substring(0, 150)}...`);

      results.prime = primeResult;

      // Find context file (agent should have saved it)
      const contextPath = path.join(typedParams.projectPath, '.agents', 'context', `${typedParams.epicId}.json`);
      let contextExists = false;
      try {
        await fs.access(contextPath);
        contextExists = true;
        console.log(`  Context file: ${contextPath}`);
      } catch {
        console.warn('  ⚠️  Context file not found, continuing with output only');
      }

      // ============================
      // PHASE 2: PLAN (Design)
      // ============================
      console.log('\n--- PHASE 2: PLAN (Design) ---');
      console.log('[PIV] Spawning Plan agent...');

      const planResult = await spawnSubagent({
        task_type: 'planning',
        description: `Create detailed implementation plan for epic: ${typedParams.epicTitle}. Break down into phases with prescriptive task instructions and validation commands.`,
        context: {
          epic_id: typedParams.epicId,
          epic_title: typedParams.epicTitle,
          epic_description: typedParams.epicDescription,
          acceptance_criteria: typedParams.acceptanceCriteria,
          tasks: typedParams.tasks || [],
          project_path: typedParams.projectPath,
          project_name: typedParams.projectName,
          context_file: contextExists ? contextPath : undefined,
          prime_output: primeResult.output || ''
        }
      });

      if (!planResult.success) {
        return {
          success: false,
          phase: 'plan',
          error: planResult.error || 'Plan phase failed',
          prime: results.prime,
          duration_ms: Date.now() - startTime
        };
      }

      console.log('[PIV] Plan phase complete');
      console.log(`  Output preview: ${(planResult.output || '').substring(0, 150)}...`);

      results.plan = planResult;

      // Find plan file (agent should have saved it)
      const planPath = path.join(typedParams.projectPath, '.agents', 'plans', `${typedParams.epicId}.json`);
      let planExists = false;
      try {
        await fs.access(planPath);
        planExists = true;
        console.log(`  Plan file: ${planPath}`);
      } catch {
        console.warn('  ⚠️  Plan file not found, continuing with output only');
      }

      // ============================
      // PHASE 3: EXECUTE (Implement)
      // ============================
      console.log('\n--- PHASE 3: EXECUTE (Implement) ---');
      console.log('[PIV] Spawning Execute agent...');

      const executeResult = await spawnSubagent({
        task_type: 'implementation',
        description: `Implement epic: ${typedParams.epicTitle} following the plan. CRITICAL: Write actual code (not just docs), run tests, commit changes to git.`,
        context: {
          epic_id: typedParams.epicId,
          epic_title: typedParams.epicTitle,
          epic_description: typedParams.epicDescription,
          acceptance_criteria: typedParams.acceptanceCriteria,
          project_path: typedParams.projectPath,
          project_name: typedParams.projectName,
          plan_file: planExists ? planPath : undefined,
          plan_output: planResult.output || '',
          base_branch: typedParams.baseBranch || 'main',
          create_pr: typedParams.createPR !== false
        }
      });

      if (!executeResult.success) {
        return {
          success: false,
          phase: 'execute',
          error: executeResult.error || 'Execute phase failed',
          prime: results.prime,
          plan: results.plan,
          duration_ms: Date.now() - startTime
        };
      }

      console.log('[PIV] Execute phase complete');
      console.log(`  Output preview: ${(executeResult.output || '').substring(0, 150)}...`);

      results.execute = executeResult;

      // ============================
      // PHASE 4: VALIDATE ACCEPTANCE CRITERIA
      // ============================
      console.log('\n--- PHASE 4: VALIDATE ACCEPTANCE CRITERIA ---');

      const criteriaResults = await validateAcceptanceCriteria(
        typedParams.epicId,
        typedParams.acceptanceCriteria,
        typedParams.projectPath
      );

      const allCriteriaMet = criteriaResults.every(c => c.met);
      const unmetCriteria = criteriaResults.filter(c => !c.met);

      console.log('[PIV] Acceptance criteria validation:');
      for (const result of criteriaResults) {
        console.log(`  ${result.met ? '✅' : '❌'} ${result.criterion}`);
        if (!result.met) {
          console.log(`     ${result.details}`);
        }
      }

      results.criteria_validation = {
        all_met: allCriteriaMet,
        results: criteriaResults,
        unmet_count: unmetCriteria.length
      };

      // ============================
      // FINAL RESULT
      // ============================
      const totalDuration = Date.now() - startTime;
      const success = allCriteriaMet;

      console.log('\n=== PIV PER-STEP COMPLETE ===');
      console.log(`Success: ${success ? '✅' : '❌'}`);
      console.log(`Total duration: ${Math.round(totalDuration / 1000)}s`);

      if (!success) {
        console.log('\n❌ INCOMPLETE - Not all acceptance criteria met:');
        for (const criterion of unmetCriteria) {
          console.log(`  - ${criterion.criterion}`);
        }
      }

      return {
        success,
        epic_id: typedParams.epicId,
        prime: results.prime,
        plan: results.plan,
        execute: results.execute,
        criteria_validation: results.criteria_validation,
        duration_ms: totalDuration,
        duration_readable: `${Math.round(totalDuration / 1000)}s`
      };

    } catch (error: any) {
      console.error('[PIV] PIV per-step failed:', error);

      return {
        success: false,
        error: error.message || 'Unknown error',
        epic_id: typedParams.epicId,
        partial_results: results,
        duration_ms: Date.now() - startTime
      };
    }
  }
};

/**
 * Get all per-step PIV tools
 */
export function getPerStepPIVTools(): ToolDefinition[] {
  return [pivPerStepTool];
}
