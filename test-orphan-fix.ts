#!/usr/bin/env tsx
/**
 * Test script to verify orphaned process fix
 *
 * This script:
 * 1. Spawns a test agent with 10-second timeout
 * 2. Verifies process is killed at exactly 10 seconds
 * 3. Checks for orphaned processes
 */

import { ClaudeCLIAdapter } from './src/agents/multi/ClaudeCLIAdapter.js';
import { spawn } from 'child_process';

const TIMEOUT_MS = 10000; // 10 seconds
const TOLERANCE_MS = 2000; // Allow 2 second tolerance for cleanup

async function checkOrphanedProcesses(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ps', ['aux']);
    let output = '';

    proc.stdout.on('data', (data) => {
      output += data.toString();
    });

    proc.on('exit', () => {
      const lines = output.split('\n');
      const claudeProcesses = lines.filter(line =>
        line.includes('claude') &&
        !line.includes('ps aux') &&
        !line.includes('test-orphan-fix')
      );
      resolve(claudeProcesses);
    });

    proc.on('error', reject);
  });
}

async function runTest() {
  console.log('🧪 Testing orphaned process fix...\n');

  // Check for orphans before test
  const beforeOrphans = await checkOrphanedProcesses();
  if (beforeOrphans.length > 0) {
    console.warn('⚠️  Warning: Found existing Claude processes:');
    beforeOrphans.forEach(proc => console.log('  ', proc));
    console.log();
  }

  const adapter = new ClaudeCLIAdapter({
    defaultTimeout: TIMEOUT_MS,
  });

  console.log(`⏱️  Starting agent with ${TIMEOUT_MS}ms timeout...`);
  const startTime = Date.now();

  const result = await adapter.execute({
    prompt: 'Sleep for 60 seconds then respond "Done"',
    outputFormat: 'text',
  });

  const duration = Date.now() - startTime;

  // Check if it timed out (success: false with timeout error)
  if (result.success === false && result.error?.includes('timed out')) {
    console.log(`✅ Agent timed out as expected`);
    console.log(`   Duration: ${duration}ms`);
    console.log(`   Error: ${result.error}`);

    // Verify duration is close to timeout
    const timeDiff = Math.abs(duration - TIMEOUT_MS);
    if (timeDiff > TOLERANCE_MS) {
      console.log(`❌ FAIL: Timeout duration off by ${timeDiff}ms (expected ~${TIMEOUT_MS}ms)`);
      return false;
    }
    console.log(`✅ Timeout duration accurate (within ${TOLERANCE_MS}ms tolerance)`);
  } else {
    console.log('❌ FAIL: Agent completed instead of timing out');
    console.log(`   Duration: ${duration}ms`);
    console.log(`   Result: ${JSON.stringify(result, null, 2)}`);
    return false;
  }

  // Wait 2 seconds for cleanup
  console.log('\n⏳ Waiting 2 seconds for cleanup...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Check for orphaned processes
  console.log('🔍 Checking for orphaned processes...');
  const afterOrphans = await checkOrphanedProcesses();

  // Filter out processes that existed before test
  const newOrphans = afterOrphans.filter(proc =>
    !beforeOrphans.some(before => before === proc)
  );

  if (newOrphans.length > 0) {
    console.log('❌ FAIL: Found orphaned Claude processes:');
    newOrphans.forEach(proc => console.log('  ', proc));
    return false;
  }

  console.log('✅ No orphaned processes found');

  console.log('\n🎉 All tests passed!');
  return true;
}

// Run test
runTest()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('💥 Test crashed:', error);
    process.exit(1);
  });
