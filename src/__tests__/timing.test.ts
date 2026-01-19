/**
 * Basic integration tests for Task Timing & Estimation
 * EPIC-007: Task Timing & Estimation
 *
 * Note: These are integration tests that require a running database.
 * Run with: tsx src/__tests__/timing.test.ts
 */

import { TaskTimer } from '../timing/TaskTimer.js';
import { pool } from '../db/client.js';

/**
 * Test 1: TaskTimer instantiation
 */
async function test1_instantiation() {
  console.log('Test 1: TaskTimer instantiation');

  try {
    const taskTimer = new TaskTimer(pool);
    console.log('✓ TaskTimer created successfully');
    return true;
  } catch (error) {
    console.error('✗ Failed to create TaskTimer:', error);
    return false;
  }
}

/**
 * Test 2: Estimation with no data
 */
async function test2_estimationNoData() {
  console.log('\nTest 2: Estimation with no data');

  try {
    const taskTimer = new TaskTimer(pool);

    const estimate = await taskTimer.estimateTask({
      taskDescription: 'Implement a completely new and unique feature that has never been done before',
      taskType: 'feature',
      projectName: 'test-project-nonexistent',
      complexity: 'complex',
    });

    console.log('Estimate:', estimate);
    console.log('✓ Estimation works with no historical data');
    console.log(`  - Conservative estimate: ${estimate.estimatedSeconds / 60} minutes`);
    console.log(`  - Note: ${estimate.note}`);
    return true;
  } catch (error) {
    console.error('✗ Estimation failed:', error);
    return false;
  }
}

/**
 * Test 3: Full timing cycle
 */
async function test3_fullTimingCycle() {
  console.log('\nTest 3: Full timing cycle');

  try {
    const taskTimer = new TaskTimer(pool);
    const taskId = `test-task-${Date.now()}`;

    // Get estimate
    const estimate = await taskTimer.estimateTask({
      taskDescription: 'Test task for timing system',
      taskType: 'test',
      projectName: 'supervisor-service',
      complexity: 'simple',
    });

    console.log('✓ Got estimate:', {
      estimatedSeconds: estimate.estimatedSeconds,
      sampleSize: estimate.sampleSize,
    });

    // Start task
    await taskTimer.startTask({
      taskId,
      taskType: 'test',
      taskDescription: 'Test task for timing system',
      projectName: 'supervisor-service',
      agentType: 'test-agent',
      agentModel: 'test',
      estimatedSeconds: estimate.estimatedSeconds,
      complexity: 'simple',
    });

    console.log('✓ Task timer started');

    // Wait a bit to simulate work
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Complete task
    const metrics = await taskTimer.completeTask({
      taskId,
      success: true,
      linesOfCodeChanged: 100,
      filesChanged: 3,
    });

    console.log('✓ Task completed:', {
      durationSeconds: metrics.durationSeconds,
      success: metrics.success,
    });

    return true;
  } catch (error) {
    console.error('✗ Full timing cycle failed:', error);
    return false;
  }
}

/**
 * Test 4: Project statistics
 */
async function test4_projectStatistics() {
  console.log('\nTest 4: Project statistics');

  try {
    const taskTimer = new TaskTimer(pool);

    const stats = await taskTimer.getProjectStats('supervisor-service');

    console.log('✓ Got project statistics:', {
      totalTasks: stats.totalTasks,
      completedTasks: stats.completedTasks,
      averageDuration: stats.averageDuration,
      taskTypes: Object.keys(stats.byType).length,
    });

    return true;
  } catch (error) {
    // It's OK if the project doesn't exist yet
    if (error instanceof Error && error.message.includes('not found')) {
      console.log('✓ Correctly handled non-existent project');
      return true;
    }
    console.error('✗ Project statistics failed:', error);
    return false;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('='.repeat(60));
  console.log('Task Timing & Estimation - Integration Tests');
  console.log('='.repeat(60));
  console.log();

  const results = [];

  results.push(await test1_instantiation());
  results.push(await test2_estimationNoData());
  results.push(await test3_fullTimingCycle());
  results.push(await test4_projectStatistics());

  console.log();
  console.log('='.repeat(60));
  console.log('Test Results');
  console.log('='.repeat(60));

  const passed = results.filter(r => r).length;
  const total = results.length;

  console.log(`Passed: ${passed}/${total}`);
  console.log(`Failed: ${total - passed}/${total}`);

  if (passed === total) {
    console.log('\n✓ All tests passed!');
  } else {
    console.log('\n✗ Some tests failed');
  }

  // Close database connection
  await pool.end();

  return passed === total;
}

// Run tests
runTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error running tests:', error);
    process.exit(1);
  });
