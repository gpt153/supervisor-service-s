/**
 * Epic 006-G: Resource Manager
 *
 * Manages concurrency limits and resource allocation for test execution
 */

import type { ResourceLimits, ExecutionMetrics } from '../types/orchestration.js';

/**
 * Manages test execution resources
 */
export class ResourceManager {
  private limits: ResourceLimits;
  private activeTests: Set<string>;
  private metrics: ExecutionMetrics;

  constructor(limits?: Partial<ResourceLimits>) {
    this.limits = {
      maxConcurrentTests: limits?.maxConcurrentTests || 5,
      maxTestDuration: limits?.maxTestDuration || 600000, // 10 minutes
      maxStageDuration: limits?.maxStageDuration || 300000, // 5 minutes
      maxRetries: limits?.maxRetries || 3
    };

    this.activeTests = new Set();
    this.metrics = {
      totalTests: 0,
      completedTests: 0,
      failedTests: 0,
      avgDuration: 0,
      maxDuration: 0,
      successRate: 0
    };
  }

  /**
   * Acquire resource slot for test
   */
  async acquire(testId: string): Promise<boolean> {
    // Check if we're at capacity
    if (this.activeTests.size >= this.limits.maxConcurrentTests) {
      console.log(
        `Resource limit reached (${this.activeTests.size}/${this.limits.maxConcurrentTests}), ` +
        `waiting for slot...`
      );
      return false;
    }

    // Add to active tests
    this.activeTests.add(testId);
    this.metrics.totalTests++;

    console.log(
      `Acquired resource for ${testId} ` +
      `(${this.activeTests.size}/${this.limits.maxConcurrentTests} active)`
    );

    return true;
  }

  /**
   * Release resource slot
   */
  release(testId: string, success: boolean, duration: number): void {
    if (!this.activeTests.has(testId)) {
      console.warn(`Attempted to release non-active test: ${testId}`);
      return;
    }

    this.activeTests.delete(testId);

    // Update metrics
    if (success) {
      this.metrics.completedTests++;
    } else {
      this.metrics.failedTests++;
    }

    // Update duration metrics
    const totalDuration = this.metrics.avgDuration * (this.metrics.totalTests - 1) + duration;
    this.metrics.avgDuration = totalDuration / this.metrics.totalTests;

    if (duration > this.metrics.maxDuration) {
      this.metrics.maxDuration = duration;
    }

    // Update success rate
    const completedTotal = this.metrics.completedTests + this.metrics.failedTests;
    this.metrics.successRate = completedTotal > 0
      ? (this.metrics.completedTests / completedTotal) * 100
      : 0;

    console.log(
      `Released resource for ${testId} ` +
      `(${this.activeTests.size}/${this.limits.maxConcurrentTests} active)`
    );
  }

  /**
   * Check if resource is available
   */
  isAvailable(): boolean {
    return this.activeTests.size < this.limits.maxConcurrentTests;
  }

  /**
   * Get current active tests
   */
  getActiveTests(): string[] {
    return Array.from(this.activeTests);
  }

  /**
   * Get active test count
   */
  getActiveCount(): number {
    return this.activeTests.size;
  }

  /**
   * Get resource limits
   */
  getLimits(): ResourceLimits {
    return { ...this.limits };
  }

  /**
   * Update resource limits
   */
  setLimits(limits: Partial<ResourceLimits>): void {
    this.limits = {
      ...this.limits,
      ...limits
    };
    console.log('Updated resource limits:', this.limits);
  }

  /**
   * Get execution metrics
   */
  getMetrics(): ExecutionMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalTests: 0,
      completedTests: 0,
      failedTests: 0,
      avgDuration: 0,
      maxDuration: 0,
      successRate: 0
    };
    console.log('Reset execution metrics');
  }

  /**
   * Wait for available slot
   */
  async waitForSlot(timeoutMs: number = 60000): Promise<boolean> {
    const startTime = Date.now();

    while (!this.isAvailable()) {
      if (Date.now() - startTime > timeoutMs) {
        console.log('Timeout waiting for resource slot');
        return false;
      }

      // Wait 1 second before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return true;
  }

  /**
   * Get resource utilization percentage
   */
  getUtilization(): number {
    return (this.activeTests.size / this.limits.maxConcurrentTests) * 100;
  }
}
