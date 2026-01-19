/**
 * Example usage of Task Timing & Estimation System
 * EPIC-007: Task Timing & Estimation
 *
 * This file demonstrates how to use the timing system in a supervisor workflow.
 */

import { TaskTimer } from '../timing/TaskTimer.js';
import { pool } from '../db/client.js';

/**
 * Example 1: Basic Task Timing
 */
async function example1_basicTiming() {
  console.log('\n=== Example 1: Basic Task Timing ===\n');

  const taskTimer = new TaskTimer(pool);
  const taskId = 'example-auth-001';

  try {
    // Get estimate first
    const estimate = await taskTimer.estimateTask({
      taskDescription: 'Implement authentication system with JWT',
      taskType: 'epic',
      projectName: 'consilio',
      complexity: 'complex',
    });

    console.log('Estimate:', {
      estimated: `${Math.round(estimate.estimatedSeconds / 60)} minutes`,
      range: `${Math.round(estimate.confidenceIntervalLow / 60)}-${Math.round(estimate.confidenceIntervalHigh / 60)} minutes`,
      confidence: `Based on ${estimate.sampleSize} similar tasks`,
    });

    // Start timing
    await taskTimer.startTask({
      taskId,
      taskType: 'epic',
      taskDescription: 'Implement authentication system with JWT',
      projectName: 'consilio',
      agentType: 'piv-agent',
      agentModel: 'haiku',
      estimatedSeconds: estimate.estimatedSeconds,
      complexity: 'complex',
    });

    console.log('\nTask started, timer running...');

    // Simulate work (in real scenario, actual implementation happens here)
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Complete the task
    const metrics = await taskTimer.completeTask({
      taskId,
      success: true,
      linesOfCodeChanged: 450,
      filesChanged: 12,
      testsWritten: 8,
      tokensUsed: 125000,
      outputSummary: 'Authentication system implemented with JWT, NextAuth.js integration',
    });

    console.log('\nTask completed:', {
      duration: `${Math.round(metrics.durationSeconds / 60)} minutes`,
      estimated: metrics.estimatedSeconds ? `${Math.round(metrics.estimatedSeconds / 60)} minutes` : 'not estimated',
      accuracy: metrics.estimationError !== undefined
        ? `${(Math.abs(metrics.estimationError) * 100).toFixed(1)}% ${metrics.estimationError > 0 ? 'over' : 'under'}`
        : 'N/A',
      success: metrics.success,
    });
  } catch (error) {
    console.error('Error in example 1:', error);
  }
}

/**
 * Example 2: Parallel Execution Tracking
 */
async function example2_parallelExecution() {
  console.log('\n=== Example 2: Parallel Execution Tracking ===\n');

  const taskTimer = new TaskTimer(pool);
  const parentTaskId = 'example-epic-dashboard';
  const childTaskIds = ['example-issue-42', 'example-issue-43', 'example-issue-44'];

  try {
    // Get estimates for each task
    const estimates = await Promise.all(
      childTaskIds.map((id, index) =>
        taskTimer.estimateTask({
          taskDescription: `Implement dashboard component ${index + 1}`,
          taskType: 'issue',
          projectName: 'consilio',
          complexity: 'medium',
        })
      )
    );

    const sequentialEstimate = estimates.reduce((sum, e) => sum + e.estimatedSeconds, 0);
    console.log('Sequential estimate:', `${Math.round(sequentialEstimate / 60)} minutes`);
    console.log('Parallel estimate (longest task):', `~${Math.round(Math.max(...estimates.map(e => e.estimatedSeconds)) / 60)} minutes`);

    // Track parallel execution
    await taskTimer.trackParallelExecution({
      parentTaskId,
      childTaskIds,
      sequentialEstimate,
    });

    // Start all tasks
    await Promise.all(
      childTaskIds.map((id, index) =>
        taskTimer.startTask({
          taskId: id,
          taskType: 'issue',
          taskDescription: `Implement dashboard component ${index + 1}`,
          projectName: 'consilio',
          agentType: 'piv-agent',
          agentModel: 'haiku',
          parentTaskId,
          estimatedSeconds: estimates[index].estimatedSeconds,
          complexity: 'medium',
        })
      )
    );

    console.log('\nRunning 3 tasks in parallel...');

    // Simulate parallel work with different completion times
    await new Promise(resolve => setTimeout(resolve, 500));

    // Complete tasks in sequence (simulating different completion times)
    for (let i = 0; i < childTaskIds.length; i++) {
      await taskTimer.completeTask({
        taskId: childTaskIds[i],
        success: true,
        linesOfCodeChanged: 150,
        filesChanged: 4,
      });

      console.log(`Task ${i + 1} completed`);
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Get parallel metrics
    const parallelMetrics = await taskTimer.completeParallelExecution(parentTaskId);

    if (parallelMetrics) {
      console.log('\nParallel execution complete:', {
        sequentialEstimate: `${Math.round(parallelMetrics.sequentialEstimate / 60)} minutes`,
        parallelActual: `${Math.round(parallelMetrics.parallelActual / 60)} minutes`,
        timeSaved: `${Math.round(parallelMetrics.timeSaved / 60)} minutes`,
        efficiency: `${(parallelMetrics.efficiency * 100).toFixed(1)}%`,
        agentCount: parallelMetrics.agentCount,
      });
    }
  } catch (error) {
    console.error('Error in example 2:', error);
  }
}

/**
 * Example 3: Project Statistics
 */
async function example3_projectStatistics() {
  console.log('\n=== Example 3: Project Statistics ===\n');

  const taskTimer = new TaskTimer(pool);

  try {
    // Get project stats
    const stats = await taskTimer.getProjectStats('consilio');

    console.log('Project Overview:', {
      totalTasks: stats.totalTasks,
      completedTasks: stats.completedTasks,
      averageDuration: `${Math.round(stats.averageDuration / 60)} minutes`,
      completionRate: `${((stats.completedTasks / stats.totalTasks) * 100).toFixed(1)}%`,
    });

    console.log('\nBy Task Type:');
    for (const [type, typeStats] of Object.entries(stats.byType)) {
      console.log(`  ${type}:`, {
        count: typeStats.count,
        average: `${Math.round(typeStats.avgDuration / 60)} minutes`,
        median: `${Math.round(typeStats.medianDuration / 60)} minutes`,
        successRate: `${(typeStats.successRate * 100).toFixed(1)}%`,
      });
    }

    console.log('\nEstimation Accuracy:', {
      averageError: `${(stats.estimationAccuracy.avgError * 100).toFixed(1)}%`,
      within20Percent: `${(stats.estimationAccuracy.within20Percent * 100).toFixed(1)}%`,
      improving: stats.estimationAccuracy.improving,
    });

    console.log('\nParallelism Stats:', {
      averageAgents: stats.parallelism.avgAgents.toFixed(1),
      averageEfficiency: `${(stats.parallelism.avgEfficiency * 100).toFixed(1)}%`,
      averageTimeSaved: `${Math.round(stats.parallelism.avgTimeSaved / 60)} minutes per epic`,
    });
  } catch (error) {
    console.error('Error in example 3:', error);
  }
}

/**
 * Example 4: Task Type Statistics
 */
async function example4_taskTypeStats() {
  console.log('\n=== Example 4: Task Type Statistics ===\n');

  const taskTimer = new TaskTimer(pool);

  try {
    // Get stats for a specific task type
    const featureStats = await taskTimer.getTaskTypeStats('feature', 'consilio');

    console.log('Feature Task Statistics:', {
      count: featureStats.count,
      average: `${Math.round(featureStats.avgDuration / 60)} minutes`,
      median: `${Math.round(featureStats.medianDuration / 60)} minutes`,
      p95: `${Math.round(featureStats.p95Duration / 60)} minutes`,
      successRate: `${(featureStats.successRate * 100).toFixed(1)}%`,
    });

    console.log('\nInterpretation:');
    console.log(`  • Most features take ${Math.round(featureStats.medianDuration / 60)} minutes (median)`);
    console.log(`  • 95% complete within ${Math.round(featureStats.p95Duration / 60)} minutes`);
    console.log(`  • Success rate: ${(featureStats.successRate * 100).toFixed(1)}%`);
  } catch (error) {
    console.error('Error in example 4:', error);
  }
}

/**
 * Example 5: Learning Over Time
 */
async function example5_learningOverTime() {
  console.log('\n=== Example 5: Learning Over Time ===\n');

  const taskTimer = new TaskTimer(pool);

  try {
    // First implementation (no data)
    console.log('First time implementing this type of task:');
    const estimate1 = await taskTimer.estimateTask({
      taskDescription: 'Implement real-time notifications with WebSockets',
      taskType: 'feature',
      projectName: 'consilio',
      complexity: 'complex',
    });

    console.log({
      estimated: `${Math.round(estimate1.estimatedSeconds / 60)} minutes`,
      sampleSize: estimate1.sampleSize,
      note: estimate1.note,
    });

    // After some similar tasks...
    console.log('\nAfter implementing similar features:');
    const estimate2 = await taskTimer.estimateTask({
      taskDescription: 'Implement real-time chat with WebSockets',
      taskType: 'feature',
      projectName: 'consilio',
      complexity: 'complex',
    });

    console.log({
      estimated: `${Math.round(estimate2.estimatedSeconds / 60)} minutes`,
      range: `${Math.round(estimate2.confidenceIntervalLow / 60)}-${Math.round(estimate2.confidenceIntervalHigh / 60)} minutes`,
      sampleSize: estimate2.sampleSize,
      similarTasks: estimate2.similarTasks.map(t => ({
        description: t.description.substring(0, 50) + '...',
        duration: `${Math.round(t.duration / 60)} minutes`,
      })),
    });

    console.log('\nConclusion: Estimates improve as historical data accumulates!');
  } catch (error) {
    console.error('Error in example 5:', error);
  }
}

/**
 * Main function - run all examples
 */
async function main() {
  console.log('Task Timing & Estimation System - Usage Examples');
  console.log('=================================================');

  try {
    await example1_basicTiming();
    await example2_parallelExecution();
    await example3_projectStatistics();
    await example4_taskTypeStats();
    await example5_learningOverTime();

    console.log('\n=== All examples completed successfully! ===\n');
  } catch (error) {
    console.error('Error running examples:', error);
  } finally {
    // Close database connection
    await pool.end();
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  example1_basicTiming,
  example2_parallelExecution,
  example3_projectStatistics,
  example4_taskTypeStats,
  example5_learningOverTime,
};
