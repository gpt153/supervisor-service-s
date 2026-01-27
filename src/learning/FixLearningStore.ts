/**
 * Fix Learning Store
 * Epic: 006-F
 *
 * Stores and retrieves what fixes work for what failures
 */

import { recordFixLearning, getBestFixStrategy, getReliableLearnings } from '../db/queries/fix-learnings.js';
import type { FixStrategy, FixLearning } from '../types/fixing.js';

export class FixLearningStore {
  /**
   * Record a fix attempt (success or failure)
   *
   * @param failurePattern - Pattern that identifies the failure
   * @param fixStrategy - Strategy used
   * @param success - Whether fix succeeded
   * @param options - Additional metadata
   * @returns Success status
   */
  async record(
    failurePattern: string,
    fixStrategy: FixStrategy,
    success: boolean,
    options: {
      errorRegex?: string;
      filePattern?: string;
      complexity?: string;
    } = {}
  ): Promise<{ success: boolean; error?: string }> {
    return await recordFixLearning(failurePattern, fixStrategy as string, success, options);
  }

  /**
   * Get best known fix for a failure pattern
   *
   * @param failurePattern - Pattern to match
   * @returns Best strategy or null
   */
  async getBestFix(failurePattern: string): Promise<FixStrategy | null> {
    const result = await getBestFixStrategy(failurePattern);

    if (result.success && result.data) {
      return result.data.fix_strategy as FixStrategy;
    }

    return null;
  }

  /**
   * Get all reliable learnings (>70% success rate)
   *
   * @returns List of reliable learnings
   */
  async getReliableLearnings(): Promise<FixLearning[]> {
    const result = await getReliableLearnings(0.7);
    return result.success && result.data ? result.data : [];
  }

  /**
   * Find similar failure patterns
   *
   * @param failurePattern - Pattern to match
   * @returns Similar patterns
   */
  async findSimilarPatterns(failurePattern: string): Promise<FixLearning[]> {
    const allLearnings = await this.getReliableLearnings();

    // Simple similarity: check if patterns contain similar keywords
    const keywords = this.extractKeywords(failurePattern);

    return allLearnings.filter(learning => {
      const learningKeywords = this.extractKeywords(learning.failure_pattern);
      const commonKeywords = keywords.filter(k => learningKeywords.includes(k));
      return commonKeywords.length > 0;
    });
  }

  /**
   * Extract keywords from failure pattern
   *
   * @param pattern - Failure pattern
   * @returns List of keywords
   */
  private extractKeywords(pattern: string): string[] {
    const common = new Set(['error', 'failed', 'the', 'a', 'an', 'is', 'in', 'at', 'of', 'to']);
    return pattern
      .toLowerCase()
      .split(/\W+/)
      .filter(word => word.length > 3 && !common.has(word));
  }

  /**
   * Get learning statistics
   *
   * @returns Statistics about learnings
   */
  async getStats(): Promise<{
    total_patterns: number;
    avg_success_rate: number;
    top_strategies: Array<{ strategy: string; success_rate: number; uses: number }>;
  }> {
    const learnings = await this.getReliableLearnings();

    if (learnings.length === 0) {
      return {
        total_patterns: 0,
        avg_success_rate: 0,
        top_strategies: []
      };
    }

    const avgSuccessRate = learnings.reduce((sum, l) => sum + (l.success_rate || 0), 0) / learnings.length;

    // Group by strategy
    const strategyStats = new Map<string, { totalSuccess: number; totalUses: number }>();
    for (const learning of learnings) {
      const existing = strategyStats.get(learning.fix_strategy) || { totalSuccess: 0, totalUses: 0 };
      existing.totalSuccess += learning.success_rate || 0;
      existing.totalUses += 1;
      strategyStats.set(learning.fix_strategy, existing);
    }

    const topStrategies = Array.from(strategyStats.entries())
      .map(([strategy, stats]) => ({
        strategy,
        success_rate: stats.totalSuccess / stats.totalUses,
        uses: stats.totalUses
      }))
      .sort((a, b) => b.success_rate - a.success_rate)
      .slice(0, 5);

    return {
      total_patterns: learnings.length,
      avg_success_rate: avgSuccessRate,
      top_strategies: topStrategies
    };
  }

  /**
   * Export learnings for backup or analysis
   *
   * @returns All learnings as JSON
   */
  async exportLearnings(): Promise<FixLearning[]> {
    const result = await getReliableLearnings(0.0); // Get all, regardless of success rate
    return result.success && result.data ? result.data : [];
  }

  /**
   * Import learnings from backup
   *
   * @param learnings - Learnings to import
   * @returns Number of learnings imported
   */
  async importLearnings(learnings: FixLearning[]): Promise<number> {
    let imported = 0;

    for (const learning of learnings) {
      const result = await this.record(
        learning.failure_pattern,
        learning.fix_strategy,
        true, // Assume success if in backup
        {
          errorRegex: learning.error_regex,
          filePattern: learning.file_pattern,
          complexity: learning.complexity
        }
      );

      if (result.success) {
        imported++;
      }
    }

    return imported;
  }
}
