#!/usr/bin/env tsx

/**
 * Comprehensive Spawn Diagnostic Test
 *
 * Tests that subagents:
 * 1. Execute in the correct project directory
 * 2. Actually create files in that directory
 * 3. Don't create files in supervisor-service-s
 */

import { spawnSubagentTool } from './src/mcp/tools/spawn-subagent-tool.js';
import fs from 'fs/promises';
import path from 'path';

const HEALTH_AGENT_PATH = '/home/samuel/sv/health-agent-s';
const CONSILIO_PATH = '/home/samuel/sv/consilio-s';
const SUPERVISOR_PATH = '/home/samuel/sv/supervisor-service-s';

const TEST_FILE_NAME = 'SPAWN_DIAGNOSTIC_TEST.txt';

async function cleanupTestFiles() {
  const paths = [HEALTH_AGENT_PATH, CONSILIO_PATH, SUPERVISOR_PATH];
  for (const p of paths) {
    const testFile = path.join(p, TEST_FILE_NAME);
    try {
      await fs.unlink(testFile);
      console.log(`✓ Cleaned up ${testFile}`);
    } catch (error) {
      // File doesn't exist, that's fine
    }
  }
}

async function runTest(
  testName: string,
  projectPath: string,
  projectName: string,
  useExplicitContext: boolean
): Promise<boolean> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`TEST: ${testName}`);
  console.log(`${'='.repeat(80)}`);
  console.log(`Project: ${projectName}`);
  console.log(`Expected Path: ${projectPath}`);
  console.log(`Context Method: ${useExplicitContext ? 'Explicit project_path' : 'ProjectContext routing'}`);
  console.log();

  // Prepare parameters
  const params: any = {
    task_type: 'implementation',
    description: `Create a file named "${TEST_FILE_NAME}" in the current working directory. The file should contain exactly this text: "Test from ${projectName} - Timestamp: {{current_time}}". Replace {{current_time}} with the actual current timestamp. This is a diagnostic test to verify the agent executes in the correct directory.`,
  };

  // Add context based on test type
  if (useExplicitContext) {
    params.context = {
      project_path: projectPath,
      project_name: projectName
    };
  }

  // Mock ProjectContext for routing-based test
  const mockContext = useExplicitContext ? undefined : {
    project: {
      name: projectName,
      path: projectPath
    },
    workingDirectory: projectPath
  };

  try {
    // Execute spawn
    console.log('→ Spawning subagent...');
    const result = await spawnSubagentTool.handler(params, mockContext);

    console.log('\n→ Result:', result.isError ? '❌ ERROR' : '✅ SUCCESS');

    if (result.isError) {
      console.log('Error content:', result.content[0].text);
      return false;
    }

    const output = result.content[0].text;
    console.log('Output preview:', output.substring(0, 500) + '...');

    // Wait a moment for file system to sync
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check where the file was created
    console.log('\n→ Checking file locations...');

    const expectedFile = path.join(projectPath, TEST_FILE_NAME);
    const wrongFile1 = path.join(SUPERVISOR_PATH, TEST_FILE_NAME);

    let success = true;

    // Check if file exists in expected location
    try {
      const content = await fs.readFile(expectedFile, 'utf-8');
      console.log(`  ✅ File found in CORRECT location: ${expectedFile}`);
      console.log(`     Content: ${content.substring(0, 100)}`);
    } catch (error) {
      console.log(`  ❌ File NOT found in expected location: ${expectedFile}`);
      success = false;
    }

    // Check if file was wrongly created in supervisor-service-s
    try {
      await fs.access(wrongFile1);
      console.log(`  ❌ File INCORRECTLY created in: ${wrongFile1}`);
      success = false;
    } catch (error) {
      console.log(`  ✅ File correctly NOT in supervisor-service-s`);
    }

    // Verify with git status
    console.log('\n→ Verifying with git status...');
    try {
      const { execSync } = await import('child_process');
      const gitStatus = execSync('git status --short', { cwd: projectPath }).toString();

      if (gitStatus.includes(TEST_FILE_NAME)) {
        console.log(`  ✅ Git status shows file in ${projectName}`);
        console.log(`     ${gitStatus.trim()}`);
      } else {
        console.log(`  ⚠️  Git status doesn't show file (might be in .gitignore)`);
      }
    } catch (error) {
      console.log(`  ⚠️  Could not check git status: ${error}`);
    }

    return success;

  } catch (error) {
    console.log(`\n❌ Test threw error:`, error);
    return false;
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║         COMPREHENSIVE SPAWN DIAGNOSTIC TEST SUITE              ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  // Cleanup first
  console.log('\n→ Cleaning up any existing test files...');
  await cleanupTestFiles();

  const results: { name: string; passed: boolean }[] = [];

  // Test 1: Explicit project_path with health-agent-s
  results.push({
    name: 'Test 1: Explicit project_path (health-agent-s)',
    passed: await runTest(
      'Explicit project_path with health-agent-s',
      HEALTH_AGENT_PATH,
      'health-agent',
      true
    )
  });

  // Cleanup between tests
  await cleanupTestFiles();

  // Test 2: ProjectContext routing with consilio-s
  results.push({
    name: 'Test 2: ProjectContext routing (consilio-s)',
    passed: await runTest(
      'ProjectContext routing with consilio-s',
      CONSILIO_PATH,
      'consilio',
      false
    )
  });

  // Cleanup between tests
  await cleanupTestFiles();

  // Test 3: Explicit project_path with consilio-s
  results.push({
    name: 'Test 3: Explicit project_path (consilio-s)',
    passed: await runTest(
      'Explicit project_path with consilio-s',
      CONSILIO_PATH,
      'consilio',
      true
    )
  });

  // Final cleanup
  await cleanupTestFiles();

  // Print summary
  console.log('\n\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                       TEST SUMMARY                              ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  for (const result of results) {
    console.log(`${result.passed ? '✅' : '❌'} ${result.name}`);
  }

  const allPassed = results.every(r => r.passed);
  console.log(`\n${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  console.log(`\nPassed: ${results.filter(r => r.passed).length}/${results.length}`);

  process.exit(allPassed ? 0 : 1);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
