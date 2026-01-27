/**
 * Model Selector
 * Epic: 006-F
 *
 * Selects appropriate model based on retry number and complexity (3-5-7 pattern)
 */

import type { Complexity } from '../types/rca.js';
import type { FixModel } from '../types/fixing.js';

export class ModelSelector {
  /**
   * Select model based on retry number and complexity
   * Implements 3-5-7 pattern: Haiku → Sonnet → Opus
   *
   * @param retryNumber - Current retry (1, 2, or 3)
   * @param complexity - Failure complexity
   * @returns Model to use for this retry
   * @throws Error if retry number > 3 or complexity unknown
   */
  select(retryNumber: number, complexity: Complexity): FixModel {
    if (retryNumber < 1 || retryNumber > 3) {
      throw new Error(`Invalid retry number: ${retryNumber}. Must be 1-3.`);
    }

    // Complexity-based starting point
    switch (complexity) {
      case 'simple':
        return this.selectForSimple(retryNumber);

      case 'moderate':
        return this.selectForModerate(retryNumber);

      case 'complex':
        return this.selectForComplex(retryNumber);

      case 'requires_human':
        // Should be escalated immediately, but if we get here, use Opus
        return 'opus';

      default:
        throw new Error(`Unknown complexity: ${complexity}`);
    }
  }

  /**
   * Model selection for simple complexity
   * Pattern: Haiku → Sonnet → Opus
   *
   * @param retryNumber - Current retry
   * @returns Model for simple fixes
   */
  private selectForSimple(retryNumber: number): FixModel {
    if (retryNumber === 1) return 'haiku'; // Fast, cheap (70% success expected)
    if (retryNumber === 2) return 'sonnet'; // Haiku failed, escalate
    return 'opus'; // Last resort
  }

  /**
   * Model selection for moderate complexity
   * Pattern: Sonnet → Opus → Opus
   *
   * @param retryNumber - Current retry
   * @returns Model for moderate fixes
   */
  private selectForModerate(retryNumber: number): FixModel {
    if (retryNumber === 1) return 'sonnet'; // Skip haiku, start stronger
    return 'opus'; // Need power for retries
  }

  /**
   * Model selection for complex complexity
   * Pattern: Opus → Opus → Opus
   *
   * @param retryNumber - Current retry
   * @returns Model for complex fixes
   */
  private selectForComplex(retryNumber: number): FixModel {
    return 'opus'; // Always use most powerful for complex issues
  }

  /**
   * Estimate cost for a retry
   *
   * @param model - Model to use
   * @param estimatedTokens - Estimated tokens (default: 5000)
   * @returns Estimated cost in USD
   */
  estimateCost(model: FixModel, estimatedTokens: number = 5000): number {
    // Approximate costs per 1M tokens (input + output averaged)
    const costPer1M = {
      haiku: 1.25, // ~$0.01 per 5k tokens
      sonnet: 15.0, // ~$0.15 per 5k tokens
      opus: 75.0 // ~$0.50 per 5k tokens
    };

    return (estimatedTokens / 1_000_000) * costPer1M[model];
  }

  /**
   * Get model capabilities description
   *
   * @param model - Model
   * @returns Description of model strengths
   */
  getModelDescription(model: FixModel): string {
    const descriptions = {
      haiku: 'Fast, cost-effective model for simple fixes (typos, imports, formatting)',
      sonnet: 'Balanced model for moderate complexity (refactoring, logic fixes)',
      opus: 'Most powerful model for complex issues (architecture, algorithms)'
    };

    return descriptions[model];
  }
}
