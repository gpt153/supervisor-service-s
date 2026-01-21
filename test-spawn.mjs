#!/usr/bin/env node
/**
 * Test script for subagent spawning system
 * Tests different task types and complexities
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Simple version of the spawn logic for testing
async function testSpawn(taskType, description, complexity) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing: ${taskType.toUpperCase()} - ${complexity}`);
  console.log(`Description: ${description}`);
  console.log('='.repeat(80));

  // Simulate Odin query failure and test fallback heuristics
  let recommendation;

  if (complexity === 'simple' || taskType === 'testing' || taskType === 'validation') {
    recommendation = {
      service: 'gemini',
      model: 'gemini-2.5-flash-lite',
      cli_command: 'scripts/ai/gemini_agent.sh',
      estimated_cost: '$0.0000',
      reason: 'Simple task, using free Gemini Flash (fallback)'
    };
  } else if (complexity === 'complex' || taskType === 'planning') {
    recommendation = {
      service: 'claude',
      model: 'claude-opus-4-5-20251101',
      cli_command: 'scripts/ai/claude_agent.sh',
      estimated_cost: '$0.0150',
      reason: 'Complex task requiring deep reasoning (fallback)'
    };
  } else {
    recommendation = {
      service: 'claude',
      model: 'claude-sonnet-4-5-20250929',
      cli_command: 'scripts/ai/claude_agent.sh',
      estimated_cost: '$0.0030',
      reason: 'Medium complexity, using Claude Sonnet (fallback)'
    };
  }

  console.log(`\n✅ Service Selected: ${recommendation.service.toUpperCase()}`);
  console.log(`   Model: ${recommendation.model}`);
  console.log(`   Cost: ${recommendation.estimated_cost}`);
  console.log(`   Reason: ${recommendation.reason}`);

  // Find matching subagent template
  const subagentDir = '/home/samuel/sv/.claude/commands/subagents';
  const categories = await fs.readdir(subagentDir);

  let bestMatch = null;
  let bestScore = 0;

  for (const category of categories) {
    const categoryPath = join(subagentDir, category);
    const stat = await fs.stat(categoryPath);

    if (!stat.isDirectory()) continue;

    const files = await fs.readdir(categoryPath);

    for (const file of files) {
      if (!file.endsWith('.md')) continue;

      const filePath = join(categoryPath, file);
      const content = await fs.readFile(filePath, 'utf-8');

      // Extract YAML frontmatter
      const match = content.match(/^---\n([\s\S]+?)\n---/);
      if (!match) continue;

      const frontmatter = match[1];
      let score = 0;

      // Check if task_type matches
      if (frontmatter.includes(`task_type: ${taskType}`)) {
        score += 10;

        // Extract keywords
        const keywordsMatch = frontmatter.match(/keywords:\s*\[(.*?)\]/);
        if (keywordsMatch) {
          const keywords = keywordsMatch[1].split(',').map(k => k.trim().replace(/['"]/g, ''));

          for (const keyword of keywords) {
            if (description.toLowerCase().includes(keyword.toLowerCase())) {
              score += 5;
            }
          }
        }

        if (score > bestScore) {
          bestScore = score;
          bestMatch = {
            name: file.replace('.md', ''),
            path: filePath,
            score: score
          };
        }
      }
    }
  }

  if (bestMatch) {
    console.log(`\n✅ Subagent Selected: ${bestMatch.name}`);
    console.log(`   Path: ${bestMatch.path}`);
    console.log(`   Match Score: ${bestMatch.score}`);
  } else {
    console.log(`\n❌ No matching subagent found for task_type: ${taskType}`);
  }

  return { recommendation, subagent: bestMatch };
}

// Run test scenarios
async function main() {
  console.log('\n🚀 SUBAGENT SPAWNING SYSTEM TEST\n');
  console.log('Testing Odin fallback heuristics and subagent selection...\n');

  const tests = [
    {
      taskType: 'research',
      description: 'Research existing authentication patterns in the codebase',
      complexity: 'simple'
    },
    {
      taskType: 'planning',
      description: 'Create detailed implementation plan for user authentication',
      complexity: 'complex'
    },
    {
      taskType: 'implementation',
      description: 'Implement JWT authentication middleware',
      complexity: 'medium'
    },
    {
      taskType: 'testing',
      description: 'Test all UI buttons and forms with Playwright',
      complexity: 'medium'
    },
    {
      taskType: 'validation',
      description: 'Run all validation checks and collect errors',
      complexity: 'simple'
    },
    {
      taskType: 'documentation',
      description: 'Update API documentation with new endpoints',
      complexity: 'simple'
    }
  ];

  const results = [];

  for (const test of tests) {
    const result = await testSpawn(test.taskType, test.description, test.complexity);
    results.push({ ...test, ...result });
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));

  const serviceCounts = {};
  const modelCounts = {};
  let totalCost = 0;

  for (const result of results) {
    const service = result.recommendation.service;
    const model = result.recommendation.model;
    const cost = parseFloat(result.recommendation.estimated_cost.replace('$', '')) || 0;

    serviceCounts[service] = (serviceCounts[service] || 0) + 1;
    modelCounts[model] = (modelCounts[model] || 0) + 1;
    totalCost += cost;
  }

  console.log('\n📊 Service Distribution:');
  for (const [service, count] of Object.entries(serviceCounts)) {
    console.log(`   ${service}: ${count}/${results.length} (${Math.round(count/results.length*100)}%)`);
  }

  console.log('\n📊 Model Distribution:');
  for (const [model, count] of Object.entries(modelCounts)) {
    console.log(`   ${model}: ${count}`);
  }

  console.log(`\n💰 Total Estimated Cost: $${totalCost.toFixed(4)}`);
  console.log(`   Average per task: $${(totalCost/results.length).toFixed(4)}`);

  const matchedCount = results.filter(r => r.subagent !== null).length;
  console.log(`\n✅ Subagent Matching: ${matchedCount}/${results.length} matched`);

  console.log('\n' + '='.repeat(80));
  console.log('✅ ALL TESTS COMPLETE');
  console.log('='.repeat(80) + '\n');
}

main().catch(console.error);
