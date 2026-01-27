/**
 * Failure Pattern Matcher
 * Epic: 006-F
 *
 * Matches current failures to known patterns
 */

import { getBestFixStrategy, getReliableLearnings } from '../db/queries/fix-learnings.js';
import type { FixLearning } from '../types/fixing.js';

export class FailurePatternMatcher {
  /**
   * Match a failure to known patterns
   *
   * @param errorMessage - Current error message
   * @param stackTrace - Stack trace (optional)
   * @returns Best matching learning or null
   */
  async match(
    errorMessage: string,
    stackTrace?: string
  ): Promise<FixLearning | null> {
    // 1. Try exact match first
    const exactMatch = await getBestFixStrategy(errorMessage);
    if (exactMatch.success && exactMatch.data && this.isReliable(exactMatch.data)) {
      return exactMatch.data;
    }

    // 2. Try regex matching
    const regexMatch = await this.matchByRegex(errorMessage);
    if (regexMatch) {
      return regexMatch;
    }

    // 3. Try fuzzy matching
    const fuzzyMatch = await this.matchByFuzzy(errorMessage);
    if (fuzzyMatch) {
      return fuzzyMatch;
    }

    return null;
  }

  /**
   * Match by regex patterns
   *
   * @param errorMessage - Error message to match
   * @returns Matching learning or null
   */
  private async matchByRegex(errorMessage: string): Promise<FixLearning | null> {
    const result = await getReliableLearnings(0.7);
    if (!result.success || !result.data) {
      return null;
    }

    const learnings = result.data;

    for (const learning of learnings) {
      if (learning.error_regex) {
        try {
          const regex = new RegExp(learning.error_regex, 'i');
          if (regex.test(errorMessage)) {
            return learning;
          }
        } catch (error) {
          // Invalid regex, skip
          continue;
        }
      }
    }

    return null;
  }

  /**
   * Match by fuzzy similarity
   *
   * @param errorMessage - Error message to match
   * @returns Matching learning or null
   */
  private async matchByFuzzy(errorMessage: string): Promise<FixLearning | null> {
    const result = await getReliableLearnings(0.7);
    if (!result.success || !result.data) {
      return null;
    }

    const learnings = result.data;
    const errorKeywords = this.extractKeywords(errorMessage);

    let bestMatch: FixLearning | null = null;
    let bestScore = 0;

    for (const learning of learnings) {
      const patternKeywords = this.extractKeywords(learning.failure_pattern);
      const score = this.calculateSimilarity(errorKeywords, patternKeywords);

      if (score > bestScore && score > 0.6) { // 60% similarity threshold
        bestScore = score;
        bestMatch = learning;
      }
    }

    return bestMatch;
  }

  /**
   * Extract keywords from text
   *
   * @param text - Text to extract from
   * @returns List of keywords
   */
  private extractKeywords(text: string): string[] {
    const common = new Set(['error', 'failed', 'the', 'a', 'an', 'is', 'in', 'at', 'of', 'to', 'from']);
    return text
      .toLowerCase()
      .split(/\W+/)
      .filter(word => word.length > 3 && !common.has(word));
  }

  /**
   * Calculate similarity between keyword sets
   *
   * @param keywords1 - First keyword set
   * @param keywords2 - Second keyword set
   * @returns Similarity score (0-1)
   */
  private calculateSimilarity(keywords1: string[], keywords2: string[]): number {
    if (keywords1.length === 0 || keywords2.length === 0) {
      return 0;
    }

    const set1 = new Set(keywords1);
    const set2 = new Set(keywords2);

    const intersection = new Set([...set1].filter(k => set2.has(k)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size; // Jaccard similarity
  }

  /**
   * Check if learning is reliable (>70% success rate)
   *
   * @param learning - Fix learning
   * @returns True if reliable
   */
  private isReliable(learning: FixLearning): boolean {
    return (learning.success_rate || 0) > 0.7;
  }

  /**
   * Find all similar patterns
   *
   * @param errorMessage - Error message
   * @param minSimilarity - Minimum similarity (0-1)
   * @returns List of similar learnings
   */
  async findSimilar(errorMessage: string, minSimilarity: number = 0.5): Promise<FixLearning[]> {
    const result = await getReliableLearnings(0.7);
    if (!result.success || !result.data) {
      return [];
    }

    const learnings = result.data;
    const errorKeywords = this.extractKeywords(errorMessage);

    const similar: Array<{ learning: FixLearning; score: number }> = [];

    for (const learning of learnings) {
      const patternKeywords = this.extractKeywords(learning.failure_pattern);
      const score = this.calculateSimilarity(errorKeywords, patternKeywords);

      if (score >= minSimilarity) {
        similar.push({ learning, score });
      }
    }

    // Sort by similarity score descending
    similar.sort((a, b) => b.score - a.score);

    return similar.map(s => s.learning);
  }

  /**
   * Get match confidence
   *
   * @param errorMessage - Error message
   * @param learning - Fix learning
   * @returns Confidence score (0-1)
   */
  async getMatchConfidence(errorMessage: string, learning: FixLearning): Promise<number> {
    let confidence = 0;

    // Exact match = high confidence
    if (errorMessage === learning.failure_pattern) {
      confidence += 0.5;
    }

    // Regex match = medium confidence
    if (learning.error_regex) {
      try {
        const regex = new RegExp(learning.error_regex, 'i');
        if (regex.test(errorMessage)) {
          confidence += 0.3;
        }
      } catch (error) {
        // Invalid regex
      }
    }

    // Success rate adds to confidence
    confidence += (learning.success_rate || 0) * 0.2;

    return Math.min(confidence, 1.0);
  }
}
