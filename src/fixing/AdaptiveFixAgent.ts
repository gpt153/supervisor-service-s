/**
 * Adaptive Fix Agent
 * Epic: 006-F
 *
 * Orchestrates adaptive iteration for fixing test failures
 * Implements 3-5-7 pattern: Haiku → Sonnet → Opus
 */

import { RootCauseAnalyzer } from '../rca/RootCauseAnalyzer.js';
import { ModelSelector } from '../rca/ModelSelector.js';
import { FixStrategySelector } from '../rca/FixStrategySelector.js';
import { RetryManager } from './RetryManager.js';
import { FixExecutor } from './FixExecutor.js';
import { VerificationLoop } from './VerificationLoop.js';
import { EscalationHandler } from './EscalationHandler.js';
import { FixLearningStore } from '../learning/FixLearningStore.js';
import type { RCAOptions } from '../types/rca.js';
import type { FixResult, FixStrategy } from '../types/fixing.js';

export class AdaptiveFixAgent {
  private rootCauseAnalyzer: RootCauseAnalyzer;
  private modelSelector: ModelSelector;
  private fixStrategySelector: FixStrategySelector;
  private fixExecutor: FixExecutor;
  private verificationLoop: VerificationLoop;
  private escalationHandler: EscalationHandler;
  private fixLearningStore: FixLearningStore;

  constructor(projectRoot: string = process.cwd()) {
    this.rootCauseAnalyzer = new RootCauseAnalyzer();
    this.modelSelector = new ModelSelector();
    this.fixStrategySelector = new FixStrategySelector();
    this.fixExecutor = new FixExecutor();
    this.verificationLoop = new VerificationLoop();
    this.escalationHandler = new EscalationHandler(projectRoot);
    this.fixLearningStore = new FixLearningStore();
  }

  /**
   * Fix a test using adaptive iteration
   * Implements full 3-5-7 pattern with learning
   *
   * @param options - RCA options (includes test_id, evidence, etc.)
   * @returns Fix result
   */
  async fixTest(options: RCAOptions): Promise<FixResult> {
    const maxRetries = 3;
    const retryManager = new RetryManager(options.test_id, maxRetries);

    try {
      // Step 1: Run RCA (Opus for most accurate diagnosis)
      console.log(`Running RCA for test: ${options.test_id}`);
      const rcaResult = await this.rootCauseAnalyzer.analyze(options);

      if (!rcaResult.success || !rcaResult.rca) {
        return {
          success: false,
          error: rcaResult.error || 'RCA failed'
        };
      }

      const rca = rcaResult.rca;
      console.log(`RCA complete: ${rca.complexity} ${rca.failure_category} - ${rca.root_cause}`);

      // Step 2: Check if human required (escalate immediately)
      if (this.escalationHandler.shouldEscalateImmediately(rca)) {
        console.log('Escalating immediately - requires human decision');
        const escalation = await this.escalationHandler.escalate(
          options.test_id,
          rca,
          'Root cause requires human decision'
        );

        return {
          success: false,
          escalated: true,
          handoffPath: escalation.handoff_path,
          error: 'Requires human intervention'
        };
      }

      // Step 3: Adaptive iteration (3-5-7 pattern)
      let totalCost = 0;

      for (let retry = 1; retry <= maxRetries; retry++) {
        console.log(`\nRetry ${retry}/${maxRetries}`);

        // Select model based on retry and complexity
        const model = this.modelSelector.select(retry, rca.complexity);
        console.log(`Selected model: ${model}`);

        // Get previous attempts (to avoid repeating failed strategies)
        const previousAttempts = await retryManager.getPreviousAttempts();
        const failedStrategies = previousAttempts
          .filter(a => !a.success)
          .map(a => a.fix_strategy);

        // Select fix strategy
        let strategy: FixStrategy;
        try {
          strategy = await this.fixStrategySelector.select(rca, failedStrategies, model);
          console.log(`Selected strategy: ${strategy}`);
        } catch (error) {
          // No more strategies - escalate
          console.log('No more strategies available - escalating');
          const escalation = await this.escalationHandler.escalate(
            options.test_id,
            rca,
            'Max retries exhausted',
            previousAttempts
          );

          return {
            success: false,
            escalated: true,
            handoffPath: escalation.handoff_path,
            retriesUsed: retry - 1,
            totalCost: await retryManager.getTotalCost()
          };
        }

        // Execute fix
        console.log('Executing fix...');
        const fixResult = await this.fixExecutor.execute({
          test_id: options.test_id,
          strategy,
          model
        });

        // Record attempt
        await retryManager.recordAttempt(retry, model, strategy, fixResult);
        totalCost += fixResult.cost_usd || 0;

        if (!fixResult.success) {
          console.log(`Fix execution failed: ${fixResult.error_message}`);
          continue; // Try next retry
        }

        // Verify fix
        console.log('Verifying fix...');
        const verificationPassed = await this.verificationLoop.verify(options.test_id);

        // Update verification status
        await retryManager.recordAttempt(retry, model, strategy, {
          ...fixResult,
          verification_passed: verificationPassed
        });

        if (verificationPassed) {
          // Success! Store learning
          console.log('✅ Fix successful and verified');
          await this.fixLearningStore.record(rca.root_cause, strategy, true, {
            complexity: rca.complexity
          });

          return {
            success: true,
            retriesUsed: retry,
            fixStrategy: strategy,
            totalCost
          };
        }

        console.log('❌ Verification failed - trying next strategy');

        // Failed - analyze why (for next retry)
        if (retry < maxRetries) {
          console.log('Analyzing failure for next retry...');
          // Could re-run RCA here with updated context
        }
      }

      // All retries exhausted - escalate
      console.log('All retries exhausted - escalating');
      const attempts = await retryManager.getPreviousAttempts();
      const escalation = await this.escalationHandler.escalate(
        options.test_id,
        rca,
        'Max retries exhausted',
        attempts
      );

      return {
        success: false,
        escalated: true,
        handoffPath: escalation.handoff_path,
        retriesUsed: maxRetries,
        totalCost: await retryManager.getTotalCost()
      };

    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Get fix statistics
   *
   * @returns Statistics about fix attempts
   */
  async getStats(): Promise<{
    total_fixes: number;
    success_rate: number;
    avg_retries: number;
    avg_cost: number;
    top_strategies: any[];
  }> {
    // In production, this would query the database
    return {
      total_fixes: 0,
      success_rate: 0,
      avg_retries: 0,
      avg_cost: 0,
      top_strategies: []
    };
  }

  /**
   * Estimate cost for fixing a test
   *
   * @param complexity - Failure complexity
   * @returns Estimated cost range
   */
  estimateCost(complexity: string): { min: number; max: number; expected: number } {
    // Simple: Usually fixed by Haiku on first try
    if (complexity === 'simple') {
      return {
        min: 0.01, // Haiku only
        max: 0.66, // All 3 models
        expected: 0.02 // 70% success on retry 1
      };
    }

    // Moderate: Usually needs Sonnet
    if (complexity === 'moderate') {
      return {
        min: 0.15, // Sonnet only
        max: 0.65, // Sonnet + Opus
        expected: 0.25
      };
    }

    // Complex: Usually needs Opus
    if (complexity === 'complex') {
      return {
        min: 0.50, // Opus only
        max: 1.50, // Multiple Opus retries
        expected: 0.75
      };
    }

    return { min: 0, max: 0, expected: 0 };
  }
}
