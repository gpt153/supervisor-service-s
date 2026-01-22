/**
 * MCP tool for centralized subagent spawning with AI Router
 *
 * Provides single-call subagent spawning that:
 * - Queries Odin's AI Router for optimal AI service selection
 * - Selects appropriate subagent template from library
 * - Spawns agent with best service/model
 * - Tracks usage and cost automatically
 */

import { ToolDefinition, ProjectContext } from '../../types/project.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { pool } from '../../db/client.js';
import { MultiAgentExecutor } from '../../agents/multi/MultiAgentExecutor.js';

// Task type definitions
type TaskType =
  | 'research'
  | 'planning'
  | 'implementation'
  | 'testing'
  | 'validation'
  | 'documentation'
  | 'fix'
  | 'deployment'
  | 'review'
  | 'security'
  | 'integration';

interface SpawnSubagentParams {
  task_type: TaskType;
  description: string;
  context?: {
    epic_id?: string;
    plan_file?: string;
    files_to_review?: string[];
    validation_commands?: string[];
    [key: string]: any;
  };
}

interface SubagentMetadata {
  task_type: TaskType;
  estimated_tokens: 'small' | 'medium' | 'large';
  complexity: 'simple' | 'medium' | 'complex';
  keywords: string[];
  file_path: string;
  file_name: string;
}

interface OdinRecommendation {
  service: 'gemini' | 'codex' | 'claude' | 'claude-max';
  model: string;
  cli_command: string;
  estimated_cost: string;
  reason: string;
}

/**
 * Query Odin AI Router for service recommendation
 *
 * Calls the Odin AI Router via subprocess to get optimal service recommendation
 */
async function queryOdin(
  taskType: TaskType,
  estimatedTokens: number,
  complexity: 'simple' | 'medium' | 'complex'
): Promise<OdinRecommendation> {
  try {
    // Call Odin AI Router via Python subprocess
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);

    const odinPython = '/home/samuel/sv/odin-s/venv/bin/python';
    const queryScript = '/home/samuel/sv/odin-s/scripts/ai/query_ai_router.py';

    const { stdout } = await execFileAsync(odinPython, [
      queryScript,
      taskType,
      estimatedTokens.toString(),
      complexity
    ]);

    const recommendation = JSON.parse(stdout);

    // Map Odin response to our format
    return {
      service: recommendation.service as 'gemini' | 'codex' | 'claude' | 'claude-max',
      model: recommendation.model,
      cli_command: recommendation.cli_command,
      estimated_cost: recommendation.estimated_cost,
      reason: recommendation.reason
    };
  } catch (error) {
    console.warn('[Odin Query] Failed, using fallback heuristics:', error);
    // Fallback: Intelligent heuristics
    if (complexity === 'simple' || taskType === 'testing' || taskType === 'validation') {
      return {
        service: 'gemini',
        model: 'gemini-2.5-flash-lite',
        cli_command: 'scripts/ai/gemini_agent.sh',
        estimated_cost: '$0.0000',
        reason: 'Simple task, using free Gemini Flash (fallback)'
      };
    }

    if (complexity === 'complex' || taskType === 'planning') {
      return {
        service: 'claude',
        model: 'claude-opus-4-5-20251101',
        cli_command: 'scripts/ai/claude_agent.sh',
        estimated_cost: '$0.0150',
        reason: 'Complex task requiring deep reasoning (fallback)'
      };
    }

    // Medium complexity
    return {
      service: 'claude',
      model: 'claude-sonnet-4-5-20250929',
      cli_command: 'scripts/ai/claude_agent.sh',
      estimated_cost: '$0.0030',
      reason: 'Medium complexity, using Claude Sonnet (fallback)'
    };
  }
}

/**
 * Parse subagent metadata from markdown file
 */
async function parseSubagentMetadata(filePath: string): Promise<SubagentMetadata | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');

    // Extract YAML frontmatter
    const match = content.match(/^---\n([\s\S]+?)\n---/);
    if (!match) {
      return null;
    }

    const frontmatter = match[1];
    const lines = frontmatter.split('\n');

    let metadata: Partial<SubagentMetadata> = {
      file_path: filePath,
      file_name: path.basename(filePath)
    };

    for (const line of lines) {
      const [key, ...valueParts] = line.split(':');
      const value = valueParts.join(':').trim();

      if (key === 'task_type') {
        metadata.task_type = value as TaskType;
      } else if (key === 'estimated_tokens') {
        metadata.estimated_tokens = value as 'small' | 'medium' | 'large';
      } else if (key === 'complexity') {
        metadata.complexity = value as 'simple' | 'medium' | 'complex';
      } else if (key === 'keywords') {
        // Parse array: [keyword1, keyword2, ...]
        const keywordsMatch = value.match(/\[(.*)\]/);
        if (keywordsMatch) {
          metadata.keywords = keywordsMatch[1]
            .split(',')
            .map(k => k.trim().replace(/['"]/g, ''));
        }
      }
    }

    if (!metadata.task_type) {
      return null;
    }

    return metadata as SubagentMetadata;
  } catch (error) {
    console.error(`Error parsing metadata from ${filePath}:`, error);
    return null;
  }
}

/**
 * Discover all subagent templates in library
 */
async function discoverSubagents(): Promise<SubagentMetadata[]> {
  const subagentsPath = '/home/samuel/sv/.claude/commands/subagents';
  const subagents: SubagentMetadata[] = [];

  try {
    // Recursively find all .md files
    const categories = await fs.readdir(subagentsPath);

    for (const category of categories) {
      const categoryPath = path.join(subagentsPath, category);
      const stat = await fs.stat(categoryPath);

      if (!stat.isDirectory()) continue;

      const files = await fs.readdir(categoryPath);

      for (const file of files) {
        if (!file.endsWith('.md')) continue;

        const filePath = path.join(categoryPath, file);
        const metadata = await parseSubagentMetadata(filePath);

        if (metadata) {
          subagents.push(metadata);
        }
      }
    }
  } catch (error) {
    console.error('Error discovering subagents:', error);
  }

  return subagents;
}

/**
 * Select best subagent based on task_type and keywords
 */
function selectSubagent(
  subagents: SubagentMetadata[],
  taskType: TaskType,
  description: string
): SubagentMetadata | null {
  // Filter by task_type
  const candidates = subagents.filter(s => s.task_type === taskType);

  if (candidates.length === 0) {
    return null;
  }

  if (candidates.length === 1) {
    return candidates[0];
  }

  // Score candidates based on keyword matches
  const descriptionLower = description.toLowerCase();
  const scored = candidates.map(subagent => {
    let score = 10; // Base score for task_type match

    // Bonus for keyword matches
    for (const keyword of subagent.keywords) {
      if (descriptionLower.includes(keyword.toLowerCase())) {
        score += 5;
      }
    }

    // Bonus for multi-word phrases
    const phrases = subagent.file_name
      .replace('.md', '')
      .split('-')
      .filter(w => w.length > 3); // Only meaningful words

    for (const phrase of phrases) {
      if (descriptionLower.includes(phrase.toLowerCase())) {
        score += 10;
      }
    }

    return { subagent, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  return scored[0].subagent;
}

/**
 * Load subagent template and substitute variables
 */
async function loadAndSubstituteTemplate(
  subagent: SubagentMetadata,
  params: SpawnSubagentParams,
  projectPath: string
): Promise<string> {
  const content = await fs.readFile(subagent.file_path, 'utf-8');

  // Remove YAML frontmatter
  const withoutFrontmatter = content.replace(/^---\n[\s\S]+?\n---\n/, '');

  // Substitute variables
  let instructions = withoutFrontmatter;

  instructions = instructions.replace(/\{\{TASK_DESCRIPTION\}\}/g, params.description);
  instructions = instructions.replace(/\{\{PROJECT_PATH\}\}/g, projectPath);

  if (params.context) {
    instructions = instructions.replace(/\{\{CONTEXT\}\}/g, JSON.stringify(params.context, null, 2));

    // Substitute specific context fields
    if (params.context.epic_id) {
      instructions = instructions.replace(/\{\{EPIC_ID\}\}/g, params.context.epic_id);
    }
    if (params.context.plan_file) {
      instructions = instructions.replace(/\{\{PLAN_FILE\}\}/g, params.context.plan_file);
    }
    if (params.context.validation_commands) {
      instructions = instructions.replace(
        /\{\{VALIDATION_COMMANDS\}\}/g,
        params.context.validation_commands.join('\n')
      );
    }
  } else {
    instructions = instructions.replace(/\{\{CONTEXT\}\}/g, '{}');
  }

  return instructions;
}

/**
 * Spawn agent and execute task
 *
 * Uses MultiAgentExecutor to route and execute via CLI adapters
 */
async function spawnAgent(
  instructions: string,
  recommendation: OdinRecommendation,
  subagentName: string,
  projectPath: string,
  projectName: string,
  taskType: TaskType,
  description: string
): Promise<{
  agent_id: string;
  instructions_preview: string;
  instructions_path: string;
  output: string | null;
  success: boolean;
  error?: string;
  duration_ms: number;
  output_file: string;
}> {
  // Generate agent ID
  const agent_id = `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Save instructions to temp file for agent
  const instructionsPath = `/tmp/${agent_id}-instructions.md`;
  await fs.writeFile(instructionsPath, instructions, 'utf-8');

  // Create output file path for health monitoring
  const outputFile = `/tmp/${agent_id}-output.log`;

  console.log(`[Subagent Spawner] ✅ Instructions prepared`);
  console.log(`[Subagent Spawner]    Agent ID: ${agent_id}`);
  console.log(`[Subagent Spawner]    Subagent: ${subagentName}`);
  console.log(`[Subagent Spawner]    Service: ${recommendation.service}`);
  console.log(`[Subagent Spawner]    Model: ${recommendation.model}`);
  console.log(`[Subagent Spawner]    Instructions: ${instructionsPath}`);
  console.log(`[Subagent Spawner]    Output file: ${outputFile}`);
  console.log(`[Subagent Spawner]    Estimated cost: ${recommendation.estimated_cost}`);

  // Record spawn in database for health monitoring
  try {
    await pool.query(
      `INSERT INTO active_spawns
       (project, task_id, task_type, description, output_file, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (project, task_id) DO UPDATE
       SET task_type = EXCLUDED.task_type,
           description = EXCLUDED.description,
           output_file = EXCLUDED.output_file,
           status = EXCLUDED.status,
           spawn_time = NOW(),
           updated_at = NOW()`,
      [projectName, agent_id, taskType, description, outputFile, 'running']
    );
    console.log(`[Subagent Spawner] ✅ Spawn recorded in database for health monitoring`);
  } catch (error) {
    // Don't fail spawn if database recording fails
    console.warn(`[Subagent Spawner] ⚠️  Failed to record spawn in database:`, error);
  }

  // Execute agent using MultiAgentExecutor
  console.log(`[Subagent Spawner] 🚀 Executing agent...`);
  const startTime = Date.now();

  try {
    const executor = new MultiAgentExecutor();

    // Initialize adapters (load API keys from vault)
    await executor.initialize();

    // Map Odin service to AgentType
    let agentType: 'gemini' | 'claude' | 'codex';
    if (recommendation.service === 'claude' || recommendation.service === 'claude-max') {
      agentType = 'claude';
    } else if (recommendation.service === 'gemini') {
      agentType = 'gemini';
    } else {
      agentType = 'codex';
    }

    // Execute the task
    const result = await executor.executeWithAgent(
      {
        prompt: instructions,
        cwd: projectPath,
        timeout: 600000, // 10 minutes
        outputFormat: 'text',
      },
      agentType
    );

    const duration = Date.now() - startTime;

    console.log(`[Subagent Spawner] ${result.success ? '✅' : '❌'} Execution ${result.success ? 'completed' : 'failed'}`);
    console.log(`[Subagent Spawner]    Duration: ${duration}ms`);
    if (result.error) {
      console.log(`[Subagent Spawner]    Error: ${result.error}`);
    }

    // Update spawn status in database
    try {
      await pool.query(
        `UPDATE active_spawns
         SET status = $1,
             exit_code = $2,
             error_message = $3,
             completed_at = NOW(),
             updated_at = NOW()
         WHERE task_id = $4`,
        [
          result.success ? 'completed' : 'failed',
          result.success ? 0 : 1,
          result.error || null,
          agent_id
        ]
      );
      console.log(`[Subagent Spawner] ✅ Spawn status updated in database`);
    } catch (error) {
      console.warn(`[Subagent Spawner] ⚠️  Failed to update spawn status:`, error);
    }

    // Write output to file for health monitoring
    try {
      await fs.writeFile(outputFile, result.output || '', 'utf-8');
      console.log(`[Subagent Spawner] ✅ Output written to ${outputFile}`);
    } catch (error) {
      console.warn(`[Subagent Spawner] ⚠️  Failed to write output file:`, error);
    }

    return {
      agent_id,
      instructions_preview: instructions.substring(0, 200) + '...',
      instructions_path: instructionsPath,
      output: result.output,
      success: result.success,
      error: result.error,
      duration_ms: duration,
      output_file: outputFile,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown execution error';

    console.log(`[Subagent Spawner] ❌ Execution threw exception`);
    console.log(`[Subagent Spawner]    Error: ${errorMessage}`);

    // Update spawn status to failed
    try {
      await pool.query(
        `UPDATE active_spawns
         SET status = $1,
             error_message = $2,
             completed_at = NOW(),
             updated_at = NOW()
         WHERE task_id = $3`,
        ['failed', errorMessage, agent_id]
      );
    } catch (dbError) {
      console.warn(`[Subagent Spawner] ⚠️  Failed to update spawn status:`, dbError);
    }

    return {
      agent_id,
      instructions_preview: instructions.substring(0, 200) + '...',
      instructions_path: instructionsPath,
      output: null,
      success: false,
      error: errorMessage,
      duration_ms: duration,
      output_file: outputFile,
    };
  }
}

/**
 * Track usage in database
 *
 * Writes to agent_executions table for cost tracking and analytics
 */
async function trackUsage(
  agentId: string,
  taskType: TaskType,
  subagentName: string,
  recommendation: OdinRecommendation,
  projectName: string,
  complexity: 'simple' | 'medium' | 'complex',
  executionSuccess: boolean,
  durationMs: number,
  errorMessage?: string
): Promise<void> {
  try {
    // Parse cost string to decimal (e.g., "$0.0030" -> 0.0030)
    const costValue = parseFloat(recommendation.estimated_cost.replace('$', '')) || 0;

    // Insert into agent_executions table
    await pool.query(
      `INSERT INTO agent_executions
       (agent_type, task_type, complexity, success, duration_ms, cost, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        recommendation.service,      // agent_type (gemini, claude, etc.)
        taskType,                     // task_type (implementation, research, etc.)
        complexity,                   // complexity (simple, medium, complex)
        executionSuccess,             // success (actual execution result)
        durationMs,                   // duration_ms (actual execution time)
        costValue,                    // cost (estimated cost in USD)
        errorMessage || null          // error_message (null if successful)
      ]
    );

    console.log(`[Usage Tracking] ✅ Recorded to database`);
    console.log(`[Usage Tracking]    Agent: ${agentId}`);
    console.log(`[Usage Tracking]    Task Type: ${taskType}`);
    console.log(`[Usage Tracking]    Subagent: ${subagentName}`);
    console.log(`[Usage Tracking]    Service: ${recommendation.service}`);
    console.log(`[Usage Tracking]    Project: ${projectName}`);
    console.log(`[Usage Tracking]    Complexity: ${complexity}`);
    console.log(`[Usage Tracking]    Success: ${executionSuccess}`);
    console.log(`[Usage Tracking]    Duration: ${durationMs}ms`);
    console.log(`[Usage Tracking]    Estimated Cost: ${recommendation.estimated_cost}`);
  } catch (error) {
    // Don't fail the spawn if tracking fails
    console.error(`[Usage Tracking] ⚠️  Failed to record to database:`, error);
    console.error(`[Usage Tracking]    Agent ID: ${agentId} will not be tracked`);
  }
}

/**
 * Calculate estimated tokens from description length
 */
function estimateTokens(description: string): number {
  // Rough estimate: ~4 characters per token
  return Math.ceil(description.length / 4);
}

/**
 * Infer complexity from description keywords
 */
function inferComplexity(description: string, taskType: TaskType): 'simple' | 'medium' | 'complex' {
  const descriptionLower = description.toLowerCase();

  // Complex keywords
  const complexKeywords = [
    'architecture',
    'design',
    'system',
    'integration',
    'multiple',
    'complex',
    'advanced',
    'distributed'
  ];

  for (const keyword of complexKeywords) {
    if (descriptionLower.includes(keyword)) {
      return 'complex';
    }
  }

  // Simple keywords
  const simpleKeywords = [
    'simple',
    'basic',
    'quick',
    'small',
    'minor',
    'trivial'
  ];

  for (const keyword of simpleKeywords) {
    if (descriptionLower.includes(keyword)) {
      return 'simple';
    }
  }

  // Task-type based defaults
  if (taskType === 'research' || taskType === 'planning') {
    return 'complex';
  }

  if (taskType === 'testing' || taskType === 'validation') {
    return 'simple';
  }

  return 'medium';
}

/**
 * Main tool: spawn_subagent
 */
export const spawnSubagentTool: ToolDefinition = {
  name: 'mcp_meta_spawn_subagent',
  description: 'Spawn a subagent to perform an execution task. Automatically queries Odin for optimal service, selects appropriate subagent template, and tracks usage. This is the ONLY way to delegate tasks.',
  inputSchema: {
    type: 'object',
    properties: {
      task_type: {
        type: 'string',
        description: 'Type of task to delegate',
        enum: [
          'research',
          'planning',
          'implementation',
          'testing',
          'validation',
          'documentation',
          'fix',
          'deployment',
          'review',
          'security',
          'integration'
        ]
      },
      description: {
        type: 'string',
        description: 'Plain English description of the task to perform'
      },
      context: {
        type: 'object',
        description: 'Optional context for the task',
        properties: {
          epic_id: { type: 'string' },
          plan_file: { type: 'string' },
          files_to_review: { type: 'array', items: { type: 'string' } },
          validation_commands: { type: 'array', items: { type: 'string' } }
        }
      }
    },
    required: ['task_type', 'description']
  },
  handler: async (params: any, context?: ProjectContext) => {
    try {
      const typedParams = params as SpawnSubagentParams;

      // Get project path from context or cwd
      const projectPath = context?.project?.path || process.cwd();
      const projectName = context?.project?.name || path.basename(projectPath);

      console.log(`\n=== Spawning Subagent ===`);
      console.log(`Task Type: ${typedParams.task_type}`);
      console.log(`Description: ${typedParams.description}`);
      console.log(`Project: ${projectName}`);

      // Step 1: Query Odin for service recommendation
      const estimatedTokens = estimateTokens(typedParams.description);
      const complexity = inferComplexity(typedParams.description, typedParams.task_type);

      console.log(`\n[Step 1/5] Querying Odin AI Router...`);
      const recommendation = await queryOdin(typedParams.task_type, estimatedTokens, complexity);
      console.log(`✅ Recommended: ${recommendation.service} (${recommendation.model})`);
      console.log(`   Estimated cost: ${recommendation.estimated_cost}`);
      console.log(`   Reason: ${recommendation.reason}`);

      // Step 2: Discover and select subagent
      console.log(`\n[Step 2/5] Selecting subagent template...`);
      const subagents = await discoverSubagents();
      console.log(`   Discovered ${subagents.length} subagent templates`);

      const selected = selectSubagent(subagents, typedParams.task_type, typedParams.description);

      if (!selected) {
        return {
          content: [{
            type: 'text',
            text: `❌ No subagent found for task_type "${typedParams.task_type}". Available subagents:\n${subagents.map(s => `- ${s.file_name} (${s.task_type})`).join('\n')}`
          }],
          isError: true
        };
      }

      console.log(`✅ Selected: ${selected.file_name}`);
      console.log(`   Keywords matched: ${selected.keywords.filter(k => typedParams.description.toLowerCase().includes(k.toLowerCase())).join(', ')}`);

      // Step 3: Load and substitute template
      console.log(`\n[Step 3/5] Loading subagent instructions...`);
      const instructions = await loadAndSubstituteTemplate(selected, typedParams, projectPath);
      console.log(`✅ Instructions generated (${instructions.length} characters)`);

      // Step 4: Spawn and execute agent
      console.log(`\n[Step 4/5] Spawning and executing agent...`);
      const executionResult = await spawnAgent(
        instructions,
        recommendation,
        selected.file_name,
        projectPath,
        projectName,
        typedParams.task_type,
        typedParams.description
      );
      console.log(`${executionResult.success ? '✅' : '❌'} Agent execution ${executionResult.success ? 'completed' : 'failed'}: ${executionResult.agent_id}`);

      // Step 5: Track usage
      console.log(`\n[Step 5/5] Tracking usage...`);
      await trackUsage(
        executionResult.agent_id,
        typedParams.task_type,
        selected.file_name,
        recommendation,
        projectName,
        complexity,
        executionResult.success,
        executionResult.duration_ms,
        executionResult.error
      );
      console.log(`✅ Usage tracked`);

      console.log(`\n=== Subagent Execution ${executionResult.success ? 'Completed' : 'Failed'} ===\n`);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: executionResult.success,
            agent_id: executionResult.agent_id,
            subagent_selected: selected.file_name,
            service_used: recommendation.service,
            model_used: recommendation.model,
            estimated_cost: recommendation.estimated_cost,
            complexity,
            duration_ms: executionResult.duration_ms,
            instructions_preview: executionResult.instructions_preview,
            instructions_path: executionResult.instructions_path,
            output_file: executionResult.output_file,
            output: executionResult.output,
            error: executionResult.error,
            message: executionResult.success
              ? `✅ Subagent executed successfully. Agent ID: ${executionResult.agent_id}`
              : `❌ Subagent execution failed. Error: ${executionResult.error}`
          }, null, 2)
        }],
        isError: !executionResult.success
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Error spawning subagent: ${error instanceof Error ? error.message : 'Unknown error'}\n\nStack trace: ${error instanceof Error ? error.stack : ''}`
        }],
        isError: true
      };
    }
  }
};
