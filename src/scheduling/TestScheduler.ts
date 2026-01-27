/**
 * Epic 006-G: Test Scheduler
 *
 * Schedules tests for parallel execution with priority ordering
 */

import type {
  OrchestrationTestDefinition,
  TestScheduleEntry,
  TestWorkflowResult
} from '../types/orchestration.js';
import { TestOrchestrator } from '../orchestration/TestOrchestrator.js';
import { ResourceManager } from './ResourceManager.js';

/**
 * Schedules and executes tests in parallel
 */
export class TestScheduler {
  private orchestrator: TestOrchestrator;
  private resourceManager: ResourceManager;
  private queue: TestScheduleEntry[];

  constructor(resourceManager?: ResourceManager) {
    this.orchestrator = new TestOrchestrator();
    this.resourceManager = resourceManager || new ResourceManager();
    this.queue = [];
  }

  /**
   * Schedule a test for execution
   */
  schedule(testDefinition: OrchestrationTestDefinition): void {
    const priority = this.calculatePriority(testDefinition);
    const estimatedDuration = this.estimateDuration(testDefinition);

    const entry: TestScheduleEntry = {
      testDefinition,
      priority,
      scheduledAt: new Date(),
      estimatedDuration
    };

    this.queue.push(entry);

    // Sort queue by priority (higher first)
    this.queue.sort((a, b) => b.priority - a.priority);

    console.log(
      `Scheduled test ${testDefinition.id} (priority: ${priority}, estimated: ${estimatedDuration}ms)`
    );
  }

  /**
   * Schedule multiple tests
   */
  scheduleMany(tests: OrchestrationTestDefinition[]): void {
    for (const test of tests) {
      this.schedule(test);
    }
  }

  /**
   * Execute all scheduled tests
   */
  async executeAll(): Promise<TestWorkflowResult[]> {
    console.log(`Executing ${this.queue.length} scheduled tests...`);

    const results: TestWorkflowResult[] = [];
    const promises: Promise<void>[] = [];

    while (this.queue.length > 0 || promises.length > 0) {
      // Start new tests if resources available
      while (this.queue.length > 0 && this.resourceManager.isAvailable()) {
        const entry = this.queue.shift()!;

        // Acquire resource
        const acquired = await this.resourceManager.acquire(entry.testDefinition.id);

        if (!acquired) {
          // Put back in queue if couldn't acquire
          this.queue.unshift(entry);
          break;
        }

        // Execute test
        const promise = this.executeTest(entry)
          .then(result => {
            results.push(result);

            // Release resource
            this.resourceManager.release(
              entry.testDefinition.id,
              result.success,
              result.report.duration
            );
          })
          .catch(error => {
            console.error(`Test ${entry.testDefinition.id} failed:`, error);

            // Release resource
            this.resourceManager.release(entry.testDefinition.id, false, 0);
          });

        promises.push(promise);
      }

      // Wait for at least one test to complete if queue not empty
      if (this.queue.length > 0 && promises.length > 0) {
        await Promise.race(promises);

        // Remove completed promises
        const completed = promises.filter(p =>
          Promise.race([p, Promise.resolve()]) === Promise.resolve()
        );

        completed.forEach(p => {
          const index = promises.indexOf(p);
          if (index > -1) {
            promises.splice(index, 1);
          }
        });
      }

      // If no more tests in queue, wait for all remaining tests
      if (this.queue.length === 0 && promises.length > 0) {
        await Promise.all(promises);
        break;
      }
    }

    console.log(`Completed execution of ${results.length} tests`);

    return results;
  }

  /**
   * Execute single test
   */
  private async executeTest(entry: TestScheduleEntry): Promise<TestWorkflowResult> {
    const startTime = Date.now();

    console.log(
      `Executing test ${entry.testDefinition.id} ` +
      `(priority: ${entry.priority}, queue time: ${startTime - entry.scheduledAt.getTime()}ms)`
    );

    const result = await this.orchestrator.orchestrate(entry.testDefinition);

    const duration = Date.now() - startTime;

    console.log(
      `Completed test ${entry.testDefinition.id} ` +
      `(duration: ${duration}ms, success: ${result.success})`
    );

    return result;
  }

  /**
   * Calculate priority score for test
   */
  private calculatePriority(test: OrchestrationTestDefinition): number {
    // Base priority from definition
    const basePriority = {
      critical: 100,
      high: 75,
      medium: 50,
      low: 25
    }[test.priority];

    // Adjust based on test type
    const typeAdjustment = {
      ui: 10,      // UI tests are more important
      api: 5,      // API tests are standard
      unit: 0,     // Unit tests are least critical
      integration: 8  // Integration tests are important
    }[test.type];

    return basePriority + typeAdjustment;
  }

  /**
   * Estimate test duration
   */
  private estimateDuration(test: OrchestrationTestDefinition): number {
    // Base duration by test type
    const baseDuration = {
      ui: 180000,        // 3 minutes for UI
      api: 60000,        // 1 minute for API
      unit: 10000,       // 10 seconds for unit
      integration: 120000 // 2 minutes for integration
    }[test.type];

    // Adjust based on step count
    const stepCount = test.steps?.length || 5;
    const stepAdjustment = stepCount * 5000; // 5 seconds per step

    return baseDuration + stepAdjustment;
  }

  /**
   * Get queue length
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Get queued tests
   */
  getQueue(): TestScheduleEntry[] {
    return [...this.queue];
  }

  /**
   * Clear queue
   */
  clearQueue(): void {
    this.queue = [];
    console.log('Cleared test queue');
  }

  /**
   * Get resource manager
   */
  getResourceManager(): ResourceManager {
    return this.resourceManager;
  }
}
