/**
 * Retry Manager
 * Epic: 006-F
 *
 * Tracks retries, costs, and learnings for fix attempts
 */

import type { FixAttempt, FixModel, FixStrategy } from '../types/fixing.js';
import { createFixAttempt, getFixAttemptsByTestId, getTotalFixCost } from '../db/queries/fix-learnings.js';

export class RetryManager {
  private testId: string;
  private maxRetries: number;

  constructor(testId: string, maxRetries: number = 3) {
    this.testId = testId;
    this.maxRetries = maxRetries;
  }

  /**
   * Record a fix attempt
   *
   * @param retryNumber - Retry number (1, 2, 3)
   * @param model - Model used
   * @param strategy - Fix strategy used
   * @param result - Fix execution result
   * @returns Created attempt record
   */
  async recordAttempt(
    retryNumber: number,
    model: FixModel,
    strategy: FixStrategy,
    result: {
      success: boolean;
      changes_made: string;
      commit_sha?: string;
      verification_passed?: boolean;
      error_message?: string;
      cost_usd?: number;
      tokens_used?: number;
    }
  ): Promise<{ success: boolean; data?: FixAttempt; error?: string }> {
    const attempt: FixAttempt = {
      test_id: this.testId,
      retry_number: retryNumber,
      model_used: model,
      fix_strategy: strategy,
      changes_made: result.changes_made,
      commit_sha: result.commit_sha,
      success: result.success,
      verification_passed: result.verification_passed,
      error_message: result.error_message,
      cost_usd: result.cost_usd,
      tokens_used: result.tokens_used
    };

    return await createFixAttempt(attempt);
  }

  /**
   * Get all previous attempts for this test
   *
   * @returns List of previous attempts
   */
  async getPreviousAttempts(): Promise<FixAttempt[]> {
    const result = await getFixAttemptsByTestId(this.testId);
    return result.success && result.data ? result.data : [];
  }

  /**
   * Get failed strategies (to avoid repeating)
   *
   * @returns List of strategies that failed
   */
  async getFailedStrategies(): Promise<FixStrategy[]> {
    const attempts = await this.getPreviousAttempts();
    return attempts
      .filter(a => !a.success)
      .map(a => a.fix_strategy);
  }

  /**
   * Get current retry count
   *
   * @returns Number of attempts so far
   */
  async getRetryCount(): Promise<number> {
    const attempts = await this.getPreviousAttempts();
    return attempts.length;
  }

  /**
   * Check if max retries reached
   *
   * @returns True if max retries reached
   */
  async hasReachedMaxRetries(): Promise<boolean> {
    const count = await this.getRetryCount();
    return count >= this.maxRetries;
  }

  /**
   * Get total cost of all attempts
   *
   * @returns Total cost in USD
   */
  async getTotalCost(): Promise<number> {
    const result = await getTotalFixCost(this.testId);
    return result.success && result.data !== undefined ? result.data : 0;
  }

  /**
   * Get cost breakdown by model
   *
   * @returns Cost by model
   */
  async getCostBreakdown(): Promise<Record<FixModel, number>> {
    const attempts = await this.getPreviousAttempts();
    const breakdown: Record<FixModel, number> = {
      haiku: 0,
      sonnet: 0,
      opus: 0
    };

    for (const attempt of attempts) {
      if (attempt.cost_usd) {
        breakdown[attempt.model_used] += attempt.cost_usd;
      }
    }

    return breakdown;
  }

  /**
   * Get summary of retry history
   *
   * @returns Summary object
   */
  async getSummary(): Promise<{
    total_attempts: number;
    successful_attempts: number;
    total_cost: number;
    strategies_tried: FixStrategy[];
    models_used: FixModel[];
  }> {
    const attempts = await this.getPreviousAttempts();
    const totalCost = await this.getTotalCost();

    return {
      total_attempts: attempts.length,
      successful_attempts: attempts.filter(a => a.success).length,
      total_cost: totalCost,
      strategies_tried: [...new Set(attempts.map(a => a.fix_strategy))],
      models_used: [...new Set(attempts.map(a => a.model_used))]
    };
  }

  /**
   * Analyze why previous attempts failed
   *
   * @returns Analysis of failures
   */
  async analyzeFailures(): Promise<string[]> {
    const attempts = await this.getPreviousAttempts();
    const failedAttempts = attempts.filter(a => !a.success);

    const reasons: string[] = [];

    for (const attempt of failedAttempts) {
      if (attempt.error_message) {
        reasons.push(`Retry ${attempt.retry_number} (${attempt.fix_strategy}): ${attempt.error_message}`);
      } else {
        reasons.push(`Retry ${attempt.retry_number} (${attempt.fix_strategy}): Fix did not resolve issue`);
      }
    }

    return reasons;
  }
}
