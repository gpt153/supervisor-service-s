#!/usr/bin/env tsx
/**
 * Simple spawn CLI tool
 *
 * Auto-detects project from pwd, calls AI router, spawns agent
 * NO MCP layer needed - direct function calls
 *
 * Usage:
 *   spawn implementation "Add CLIP model to image_embedding.py"
 *   spawn research "How does the memory system work?"
 *   spawn testing "Write tests for visual search"
 */

import path from 'path';
import { spawnSubagentTool } from '../src/mcp/tools/spawn-subagent-tool.ts';

// Get project path from environment (set by wrapper) or fallback to cwd
const projectPath = process.env.SPAWN_PROJECT_PATH || process.cwd();
const projectName = path.basename(projectPath).replace(/-s$/, '');

const [taskType, description] = process.argv.slice(2);

if (!taskType || !description) {
  console.error('Usage: spawn <task_type> <description>');
  console.error('');
  console.error('Examples:');
  console.error('  spawn implementation "Add feature X"');
  console.error('  spawn research "Investigate Y"');
  console.error('  spawn testing "Write tests for Z"');
  process.exit(1);
}

console.log(`\n🚀 Spawning ${taskType} agent...`);
console.log(`   Project: ${projectName}`);
console.log(`   Path: ${projectPath}`);
console.log(`   Description: ${description}\n`);

try {
  const result = await spawnSubagentTool.handler(
    {
      task_type: taskType,
      description: description,
      context: {
        project_path: projectPath,
        project_name: projectName
      }
    },
    {
      project: {
        name: projectName,
        path: projectPath
      },
      workingDirectory: projectPath,
      isolatedState: new Map()
    }
  );

  if (result.isError) {
    console.error('❌ Spawn failed:', result.content[0].text);
    process.exit(1);
  }

  const parsed = JSON.parse(result.content[0].text);
  console.log('\n✅ Spawn completed:');
  console.log(`   Agent ID: ${parsed.agent_id}`);
  console.log(`   Service: ${parsed.service_used}`);
  console.log(`   Model: ${parsed.model_used}`);
  console.log(`   Duration: ${parsed.duration_ms}ms`);
  console.log(`   Cost: ${parsed.estimated_cost}`);

  if (parsed.task_tool_params) {
    console.log(`\n📋 Task Tool Parameters:`);
    console.log(`   Model: ${parsed.task_tool_params.model}`);
    console.log(`   Max turns: ${parsed.task_tool_params.max_turns}`);
    console.log(`   Instructions: ${parsed.task_tool_params.instructions_file}`);
    console.log(`   Project path: ${parsed.task_tool_params.project_path}`);
    console.log(`\n⚠️  NEXT STEP: MS must call Task tool to execute with full tool access.`);
    console.log(`   The instructions file contains the complete task description.`);
  }

  console.log(`\n📄 Output: ${parsed.output_file}`);
  console.log(`\nTo see output: cat ${parsed.output_file}`);

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
