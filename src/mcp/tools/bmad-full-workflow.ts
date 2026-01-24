/**
 * BMAD Full Workflow Orchestrator
 *
 * Implements complete 4-phase BMAD methodology:
 * - Phase 1: Analysis (Requirements analysis)
 * - Phase 2: Planning (PRD and Epic creation)
 * - Phase 3: Architecture (ADR creation)
 * - Phase 4: Implementation (PIV Loop)
 *
 * Scale-adaptive with complexity levels 0-4.
 */

import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';

const META_MCP_ENDPOINT = 'http://localhost:8081/mcp/meta';

/**
 * Ensure .bmad/ directory structure exists
 */
async function ensureBMADDirectories(projectPath: string): Promise<void> {
  const bmadPath = path.join(projectPath, '.bmad');
  const directories = [
    'feature-requests',
    'prd',
    'epics',
    'adr',
    'architecture',
    'plans',
    'context',
    'reports'
  ];

  try {
    // Create .bmad/ root if doesn't exist
    await fs.mkdir(bmadPath, { recursive: true });

    // Create subdirectories
    for (const dir of directories) {
      await fs.mkdir(path.join(bmadPath, dir), { recursive: true });
    }

    console.log('[BMAD] Directory structure verified');
  } catch (error) {
    console.error('[BMAD] Failed to create directory structure:', error);
    throw error;
  }
}

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

    // Parse the MCP result - spawn tool returns JSON string in content[0].text
    const mcpResult = response.data.result;
    if (mcpResult.content && mcpResult.content[0] && mcpResult.content[0].text) {
      const firstParse = JSON.parse(mcpResult.content[0].text);

      // Spawn tool returns ANOTHER MCP response (double-nested)
      if (firstParse.content && firstParse.content[0] && firstParse.content[0].text) {
        return JSON.parse(firstParse.content[0].text);
      }

      return firstParse;
    }

    return mcpResult;
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
 * Call PIV per-step or execute epic tasks via MCP
 */
async function callEpicTool(toolName: string, params: any): Promise<any> {
  try {
    const response = await axios.post(META_MCP_ENDPOINT, {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: params
      }
    }, {
      timeout: 60 * 60 * 1000, // 60 minute timeout for full epic implementation
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.data.error) {
      throw new Error(response.data.error.message || 'MCP call failed');
    }

    const mcpResult = response.data.result;
    if (mcpResult.content && mcpResult.content[0] && mcpResult.content[0].text) {
      return JSON.parse(mcpResult.content[0].text);
    }

    return mcpResult;
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED') {
      throw new Error('MCP server not running on port 8081');
    }
    throw error;
  }
}

export interface BMADFullWorkflowParams {
  projectName: string;
  projectPath: string;
  featureDescription: string;
  complexity?: number; // 0-4, auto-detected if omitted
  skipPhases?: ('analysis' | 'planning' | 'architecture')[];
}

export interface BMADFullWorkflowResult {
  success: boolean;
  complexity: number;
  phases_executed: string[];
  outputs: {
    feature_request?: string;
    prd?: string;
    epics: string[];
    adrs: string[];
    pull_requests: string[];
  };
  error?: string;
}

/**
 * Project state detection for greenfield vs brownfield
 */
interface ProjectState {
  is_greenfield: boolean;
  has_codebase: boolean;
  language?: string;
  framework?: string;
  file_count: number;
}

/**
 * Detect if project is greenfield or brownfield
 */
async function detectProjectState(projectPath: string): Promise<ProjectState> {
  const state: ProjectState = {
    is_greenfield: false,
    has_codebase: false,
    file_count: 0,
  };

  // Check for common config files
  const configFiles = [
    { file: 'package.json', language: 'typescript' },
    { file: 'requirements.txt', language: 'python' },
    { file: 'go.mod', language: 'go' },
    { file: 'Cargo.toml', language: 'rust' },
    { file: 'pom.xml', language: 'java' },
  ];

  for (const { file, language } of configFiles) {
    try {
      await fs.access(path.join(projectPath, file));
      state.has_codebase = true;
      state.language = language;
      break;
    } catch {
      // File doesn't exist, continue checking
    }
  }

  // Count files in src/
  const srcPath = path.join(projectPath, 'src');
  try {
    const files = await fs.readdir(srcPath, { recursive: true });
    state.file_count = files.filter((f) => typeof f === 'string').length;
  } catch {
    // src/ doesn't exist
    state.file_count = 0;
  }

  // Greenfield if no codebase or < 5 files
  state.is_greenfield = !state.has_codebase || state.file_count < 5;

  return state;
}

/**
 * Detect complexity level (0-4) based on feature description
 */
async function detectComplexity(description: string, projectPath: string): Promise<number> {
  console.log('[BMAD] Detecting complexity for feature description...');

  // Simple heuristic-based detection
  // In production, this would query Odin AI router for better detection

  const lowercaseDesc = description.toLowerCase();

  // Level 0: Bug fixes, typos, single-line changes
  if (
    lowercaseDesc.includes('fix typo') ||
    lowercaseDesc.includes('fix bug') ||
    lowercaseDesc.includes('update config') ||
    lowercaseDesc.match(/\bfix\b.*\bbutton\b/) ||
    lowercaseDesc.match(/\bchange\b.*\bcolor\b/)
  ) {
    console.log('[BMAD] Detected complexity: 0 (bug fix/typo)');
    return 0;
  }

  // Level 1: Small features (add button, simple endpoint)
  if (
    lowercaseDesc.match(/\badd\b.*\bbutton\b/) ||
    lowercaseDesc.match(/\bnew\b.*\bendpoint\b/) ||
    lowercaseDesc.match(/\bsimple\b.*\bcomponent\b/) ||
    lowercaseDesc.includes('add field') ||
    lowercaseDesc.includes('add column')
  ) {
    console.log('[BMAD] Detected complexity: 1 (small feature)');
    return 1;
  }

  // Level 3-4: Large/enterprise features
  if (
    lowercaseDesc.includes('multi-tenant') ||
    lowercaseDesc.includes('microservice') ||
    lowercaseDesc.includes('migration') ||
    lowercaseDesc.includes('platform') ||
    lowercaseDesc.includes('enterprise') ||
    lowercaseDesc.match(/\bcomplete\b.*\bsystem\b/) ||
    description.split(' ').length > 30 // Long descriptions suggest complexity
  ) {
    console.log('[BMAD] Detected complexity: 3 (large feature)');
    return 3;
  }

  // Level 2: Medium features (default)
  console.log('[BMAD] Detected complexity: 2 (medium feature)');
  return 2;
}

/**
 * Check if epic has Implementation Notes section with numbered steps
 */
async function epicHasImplementationNotes(projectPath: string, epicFile: string): Promise<boolean> {
  try {
    const epicPath = path.join(projectPath, epicFile);
    const epicContent = await fs.readFile(epicPath, 'utf-8');

    // Check for "## Implementation Notes" section with numbered steps
    return (
      epicContent.includes('## Implementation Notes') &&
      /^\d+\.\s+/m.test(epicContent)
    );
  } catch {
    return false;
  }
}

/**
 * Full BMAD workflow orchestrator
 */
export async function bmadFullWorkflow(params: BMADFullWorkflowParams): Promise<BMADFullWorkflowResult> {
  const result: BMADFullWorkflowResult = {
    success: false,
    complexity: 0,
    phases_executed: [],
    outputs: { epics: [], adrs: [], pull_requests: [] }
  };

  try {
    console.log('[BMAD] Starting full BMAD workflow');
    console.log(`[BMAD] Project: ${params.projectName}`);
    console.log(`[BMAD] Feature: ${params.featureDescription}`);

    // 0. Ensure .bmad/ directory structure exists
    await ensureBMADDirectories(params.projectPath);

    // 1. Detect complexity if not provided
    const complexity = params.complexity ?? await detectComplexity(params.featureDescription, params.projectPath);
    result.complexity = complexity;
    console.log(`[BMAD] Complexity level: ${complexity}`);

    // Level 0: Skip all planning, direct implementation
    if (complexity === 0) {
      console.log('[BMAD] Level 0 detected - skipping planning, direct implementation');

      const implResult = await spawnSubagent({
        task_type: 'implementation',
        description: params.featureDescription,
        context: {
          project_path: params.projectPath,
          complexity: 0,
          direct_implementation: true,
        }
      });

      result.phases_executed.push('implementation');
      result.success = implResult.success || false;

      if (!result.success) {
        result.error = implResult.error || 'Implementation failed';
      }

      return result;
    }

    // 1. ANALYSIS PHASE (Level 1-4)
    if (complexity >= 1 && !params.skipPhases?.includes('analysis')) {
      console.log('[BMAD] Phase 1: Analysis - Creating feature request');

      const analysisResult = await spawnSubagent({
        task_type: 'planning',
        description: `Analyze feature requirements: ${params.featureDescription}`,
        context: {
          phase: 'analysis',
          artifact_type: 'feature_request',
          project_path: params.projectPath,
          complexity,
        }
      });

      result.phases_executed.push('analysis');

      if (analysisResult.output_file) {
        result.outputs.feature_request = analysisResult.output_file;
        console.log(`[BMAD] Feature request created: ${analysisResult.output_file}`);
      }
    }

    // 2. PLANNING PHASE (All levels)
    if (!params.skipPhases?.includes('planning')) {
      console.log('[BMAD] Phase 2: Planning - Creating epic(s)');

      // Level 3-4: Create PRD first
      if (complexity >= 3) {
        console.log('[BMAD] Creating PRD (complexity 3+)');

        const prdResult = await spawnSubagent({
          task_type: 'planning',
          description: `Create Product Requirements Document for: ${params.featureDescription}`,
          context: {
            phase: 'planning',
            artifact_type: 'prd',
            feature_request: result.outputs.feature_request,
            project_path: params.projectPath,
            complexity,
          }
        });

        if (prdResult.output_file) {
          result.outputs.prd = prdResult.output_file;
          console.log(`[BMAD] PRD created: ${prdResult.output_file}`);
        }
      }

      // Create epic(s) - may shard into multiple for complexity 3-4
      const epicResult = await spawnSubagent({
        task_type: 'planning',
        description: `Create BMAD epic for: ${params.featureDescription}`,
        context: {
          phase: 'planning',
          artifact_type: 'epic',
          prd: result.outputs.prd,
          feature_request: result.outputs.feature_request,
          project_path: params.projectPath,
          complexity,
        }
      });

      result.phases_executed.push('planning');

      // Handle epic file(s) - could be single or array
      if (epicResult.epic_files && Array.isArray(epicResult.epic_files)) {
        result.outputs.epics = epicResult.epic_files;
      } else if (epicResult.output_file) {
        result.outputs.epics = [epicResult.output_file];
      }

      console.log(`[BMAD] Created ${result.outputs.epics.length} epic(s)`);
    }

    // If no epics created, fail
    if (result.outputs.epics.length === 0) {
      result.error = 'No epics created during planning phase';
      return result;
    }

    // 3. ARCHITECTURE PHASE (Level 2-4)
    if (complexity >= 2 && !params.skipPhases?.includes('architecture')) {
      console.log('[BMAD] Phase 3: Architecture - Creating ADRs');

      for (const epicFile of result.outputs.epics) {
        console.log(`[BMAD] Creating ADR for: ${epicFile}`);

        const adrResult = await spawnSubagent({
          task_type: 'planning',
          description: `Create Architecture Decision Record for technical decisions in ${epicFile}`,
          context: {
            phase: 'architecture',
            artifact_type: 'adr',
            epic_file: epicFile,
            project_path: params.projectPath,
          }
        });

        if (adrResult.output_file) {
          result.outputs.adrs.push(adrResult.output_file);
          console.log(`[BMAD] ADR created: ${adrResult.output_file}`);
        }
      }

      result.phases_executed.push('architecture');
    }

    // 4. IMPLEMENTATION PHASE (All levels - PIV Loop)
    console.log('[BMAD] Phase 4: Implementation - PIV Loop');

    // Detect project state for greenfield handling
    const projectState = await detectProjectState(params.projectPath);
    console.log(`[BMAD] Project state: ${projectState.is_greenfield ? 'greenfield' : 'brownfield'}`);

    for (const epicFile of result.outputs.epics) {
      console.log(`[BMAD] Implementing epic: ${epicFile}`);

      // Check if greenfield and needs initialization
      if (projectState.is_greenfield) {
        console.log('[BMAD] Greenfield project - initializing project structure');

        await spawnSubagent({
          task_type: 'implementation',
          description: 'Initialize project structure and scaffolding',
          context: {
            greenfield: true,
            language: projectState.language || 'typescript',
            epic_file: epicFile,
            project_path: params.projectPath,
          }
        });

        // Mark as no longer greenfield for subsequent epics
        projectState.is_greenfield = false;
      }

      // Check if epic has Implementation Notes
      const hasNotes = await epicHasImplementationNotes(params.projectPath, epicFile);

      let implResult;

      if (hasNotes) {
        console.log('[BMAD] Epic has Implementation Notes - using execute_epic_tasks');

        implResult = await callEpicTool('mcp_meta_execute_epic_tasks', {
          projectName: params.projectName,
          projectPath: params.projectPath,
          epicFile,
        });
      } else {
        console.log('[BMAD] Epic lacks Implementation Notes - using PIV per-step');

        implResult = await callEpicTool('mcp_meta_run_piv_per_step', {
          projectName: params.projectName,
          projectPath: params.projectPath,
          epicFile,
        });
      }

      if (implResult.success && implResult.pr_url) {
        result.outputs.pull_requests.push(implResult.pr_url);
      }

      if (!implResult.success) {
        result.error = `Epic implementation failed: ${epicFile}. ${implResult.error || ''}`;
        return result;
      }
    }

    result.phases_executed.push('implementation');
    result.success = true;

    console.log('[BMAD] Full workflow completed successfully');
    console.log(`[BMAD] Phases executed: ${result.phases_executed.join(', ')}`);
    console.log(`[BMAD] Epics: ${result.outputs.epics.length}, ADRs: ${result.outputs.adrs.length}, PRs: ${result.outputs.pull_requests.length}`);

    return result;

  } catch (error) {
    console.error('[BMAD] Unexpected error:', error);
    result.error = error instanceof Error ? error.message : 'Unexpected error during BMAD workflow';
    return result;
  }
}

/**
 * Get BMAD full workflow tool definition for MCP server
 */
export function getBMADFullWorkflowTools() {
  return [
    {
      name: 'mcp_meta_bmad_full_workflow',
      description: 'Execute complete 4-phase BMAD methodology: Analysis → Planning → Architecture → Implementation. Auto-detects complexity (0-4) and adapts workflow. Use this when user provides feature description.',
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
          featureDescription: {
            type: 'string',
            description: 'User description of the feature to implement',
          },
          complexity: {
            type: 'number',
            description: 'Optional complexity level 0-4 (auto-detected if omitted). 0=bugfix, 1=small, 2=medium, 3=large, 4=enterprise',
            minimum: 0,
            maximum: 4,
          },
          skipPhases: {
            type: 'array',
            description: 'Optional phases to skip (e.g., ["architecture"])',
            items: {
              type: 'string',
              enum: ['analysis', 'planning', 'architecture'],
            },
          },
        },
        required: ['projectName', 'projectPath', 'featureDescription'],
      },
      handler: bmadFullWorkflow,
    },
  ];
}
