/**
 * Epic 006-G: Timeout Enforcer
 *
 * Enforces stage and workflow timeout limits
 */

import type {
  WorkflowStage,
  TimeoutConfig,
  TimeoutEvent
} from '../types/orchestration.js';

/**
 * Enforces timeouts on workflow stages
 */
export class TimeoutEnforcer {
  private config: TimeoutConfig;
  private activeTimeouts: Map<string, NodeJS.Timeout>;
  private timeoutEvents: TimeoutEvent[];

  constructor(config?: Partial<TimeoutConfig>) {
    this.config = {
      execution: config?.execution || 300000,    // 5 minutes
      detection: config?.detection || 60000,     // 1 minute
      verification: config?.verification || 120000, // 2 minutes
      fixing: config?.fixing || 600000,          // 10 minutes
      learning: config?.learning || 30000,       // 30 seconds
      total: config?.total || 900000             // 15 minutes total
    };

    this.activeTimeouts = new Map();
    this.timeoutEvents = [];
  }

  /**
   * Start timeout for stage
   */
  startTimeout(
    workflowId: number,
    stage: WorkflowStage,
    onTimeout: () => void
  ): void {
    const timeoutKey = `${workflowId}-${stage}`;

    // Clear existing timeout if any
    this.clearTimeout(workflowId, stage);

    // Get timeout duration for stage
    const timeoutMs = this.getStageTimeout(stage);

    if (timeoutMs === 0) {
      return; // No timeout for this stage
    }

    console.log(
      `Starting timeout for workflow ${workflowId} stage ${stage}: ${timeoutMs}ms`
    );

    // Set timeout
    const timeout = setTimeout(() => {
      console.log(`Timeout triggered for workflow ${workflowId} stage ${stage}`);

      // Record timeout event
      this.recordTimeoutEvent({
        workflowId,
        stage,
        timeoutMs,
        elapsedMs: timeoutMs,
        timestamp: new Date()
      });

      // Call timeout handler
      onTimeout();
    }, timeoutMs);

    this.activeTimeouts.set(timeoutKey, timeout);
  }

  /**
   * Clear timeout for stage
   */
  clearTimeout(workflowId: number, stage: WorkflowStage): void {
    const timeoutKey = `${workflowId}-${stage}`;
    const timeout = this.activeTimeouts.get(timeoutKey);

    if (timeout) {
      clearTimeout(timeout);
      this.activeTimeouts.delete(timeoutKey);
      console.log(`Cleared timeout for workflow ${workflowId} stage ${stage}`);
    }
  }

  /**
   * Clear all timeouts for workflow
   */
  clearAllTimeouts(workflowId: number): void {
    const keys = Array.from(this.activeTimeouts.keys());

    for (const key of keys) {
      if (key.startsWith(`${workflowId}-`)) {
        const timeout = this.activeTimeouts.get(key);
        if (timeout) {
          clearTimeout(timeout);
          this.activeTimeouts.delete(key);
        }
      }
    }

    console.log(`Cleared all timeouts for workflow ${workflowId}`);
  }

  /**
   * Get stage timeout duration
   */
  getStageTimeout(stage: WorkflowStage): number {
    switch (stage) {
      case 'execution':
        return this.config.execution;
      case 'detection':
        return this.config.detection;
      case 'verification':
        return this.config.verification;
      case 'fixing':
        return this.config.fixing;
      case 'learning':
        return this.config.learning;
      default:
        return 0;
    }
  }

  /**
   * Get total workflow timeout
   */
  getTotalTimeout(): number {
    return this.config.total;
  }

  /**
   * Update timeout configuration
   */
  setConfig(config: Partial<TimeoutConfig>): void {
    this.config = {
      ...this.config,
      ...config
    };
    console.log('Updated timeout configuration:', this.config);
  }

  /**
   * Get timeout configuration
   */
  getConfig(): TimeoutConfig {
    return { ...this.config };
  }

  /**
   * Get timeout events
   */
  getTimeoutEvents(): TimeoutEvent[] {
    return [...this.timeoutEvents];
  }

  /**
   * Clear timeout events
   */
  clearTimeoutEvents(): void {
    this.timeoutEvents = [];
  }

  /**
   * Record timeout event
   */
  private recordTimeoutEvent(event: TimeoutEvent): void {
    this.timeoutEvents.push(event);
  }

  /**
   * Get active timeout count
   */
  getActiveTimeoutCount(): number {
    return this.activeTimeouts.size;
  }

  /**
   * Check if workflow has active timeouts
   */
  hasActiveTimeouts(workflowId: number): boolean {
    const keys = Array.from(this.activeTimeouts.keys());
    return keys.some(key => key.startsWith(`${workflowId}-`));
  }
}
