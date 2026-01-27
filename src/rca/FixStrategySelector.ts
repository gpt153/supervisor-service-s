/**
 * Fix Strategy Selector
 * Epic: 006-F
 *
 * Selects appropriate fix strategy based on RCA and avoids failed strategies
 */

import type { RootCauseAnalysis, FailureCategory } from '../types/rca.js';
import type { FixStrategy, FixModel } from '../types/fixing.js';
import { getBestFixStrategy } from '../db/queries/fix-learnings.js';

export class FixStrategySelector {
  /**
   * Select fix strategy based on RCA, avoiding failed strategies
   *
   * @param rca - Root cause analysis
   * @param failedStrategies - Strategies that already failed
   * @param model - Model to be used for fix
   * @returns Selected fix strategy
   * @throws Error if no strategies available
   */
  async select(
    rca: RootCauseAnalysis,
    failedStrategies: FixStrategy[],
    model: FixModel
  ): Promise<FixStrategy> {
    // 1. Check if we have a known successful fix for this pattern
    const knownFix = await this.getKnownFix(rca.root_cause, failedStrategies);
    if (knownFix) {
      return knownFix;
    }

    // 2. Use recommended strategy from RCA if not already tried
    if (rca.recommended_strategy && !failedStrategies.includes(rca.recommended_strategy as FixStrategy)) {
      return rca.recommended_strategy as FixStrategy;
    }

    // 3. Select based on failure category
    const strategies = this.getStrategiesForCategory(rca.failure_category);

    // 4. Filter out failed strategies
    const availableStrategies = strategies.filter(
      s => !failedStrategies.includes(s)
    );

    if (availableStrategies.length === 0) {
      throw new Error('No more strategies available to try');
    }

    // 5. Prioritize by model capability
    return this.prioritizeByModel(availableStrategies, model);
  }

  /**
   * Get known successful fix from learning database
   *
   * @param failurePattern - Failure pattern from RCA
   * @param failedStrategies - Strategies to exclude
   * @returns Known strategy or null
   */
  private async getKnownFix(
    failurePattern: string,
    failedStrategies: FixStrategy[]
  ): Promise<FixStrategy | null> {
    const result = await getBestFixStrategy(failurePattern);

    if (result.success && result.data) {
      const strategy = result.data.fix_strategy as FixStrategy;
      // Use if success rate > 70% and not already tried
      if (result.data.success_rate && result.data.success_rate > 0.7 && !failedStrategies.includes(strategy)) {
        return strategy;
      }
    }

    return null;
  }

  /**
   * Get available strategies for a failure category
   *
   * @param category - Failure category
   * @returns List of strategies for this category
   */
  private getStrategiesForCategory(category: FailureCategory): FixStrategy[] {
    const strategies: Record<FailureCategory, FixStrategy[]> = {
      syntax: ['typo_correction', 'syntax_fix', 'formatting'],
      logic: ['refactor', 'algorithm_fix', 'condition_fix'],
      integration: ['import_fix', 'dependency_add', 'api_update'],
      environment: ['env_var_add', 'config_fix', 'permission_fix']
    };

    return strategies[category] || [];
  }

  /**
   * Prioritize strategies by model capability
   * Simpler strategies for weaker models, complex for stronger
   *
   * @param strategies - Available strategies
   * @param model - Model to use
   * @returns Best strategy for this model
   */
  private prioritizeByModel(strategies: FixStrategy[], model: FixModel): FixStrategy {
    // Define strategy complexity
    const simpleStrategies: FixStrategy[] = ['typo_correction', 'import_fix', 'formatting'];
    const moderateStrategies: FixStrategy[] = ['syntax_fix', 'dependency_add', 'env_var_add', 'config_fix'];
    const complexStrategies: FixStrategy[] = ['refactor', 'algorithm_fix', 'condition_fix', 'api_update', 'permission_fix'];

    // Match model to strategy complexity
    if (model === 'haiku') {
      // Prefer simple strategies for Haiku
      const simple = strategies.filter(s => simpleStrategies.includes(s));
      if (simple.length > 0) return simple[0];
    }

    if (model === 'sonnet') {
      // Prefer moderate strategies for Sonnet
      const moderate = strategies.filter(s => moderateStrategies.includes(s));
      if (moderate.length > 0) return moderate[0];
    }

    if (model === 'opus') {
      // Prefer complex strategies for Opus
      const complex = strategies.filter(s => complexStrategies.includes(s));
      if (complex.length > 0) return complex[0];
    }

    // Fallback: return first available
    return strategies[0];
  }

  /**
   * Get description of a fix strategy
   *
   * @param strategy - Fix strategy
   * @returns Human-readable description
   */
  getStrategyDescription(strategy: FixStrategy): string {
    const descriptions: Record<FixStrategy, string> = {
      typo_correction: 'Correct typos in variable/function names',
      syntax_fix: 'Fix syntax errors (missing brackets, semicolons)',
      formatting: 'Fix code formatting issues',
      refactor: 'Refactor code structure or logic',
      algorithm_fix: 'Fix algorithm or data structure issues',
      condition_fix: 'Fix conditional logic or boolean expressions',
      import_fix: 'Fix import statements or module paths',
      dependency_add: 'Add missing dependencies to package.json',
      api_update: 'Update API calls to match current interface',
      env_var_add: 'Add missing environment variables',
      config_fix: 'Fix configuration files',
      permission_fix: 'Fix file or resource permissions'
    };

    return descriptions[strategy] || 'Unknown strategy';
  }
}
