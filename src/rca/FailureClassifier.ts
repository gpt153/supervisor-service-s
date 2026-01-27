/**
 * Failure Classifier
 * Epic: 006-F
 *
 * Classifies failures by category and complexity
 */

import type { FailureCategory, Complexity, FailureClassification } from '../types/rca.js';

export class FailureClassifier {
  /**
   * Classify a failure based on error message and context
   *
   * @param errorMessage - Error message from test failure
   * @param stackTrace - Stack trace if available
   * @param fileContext - Files involved in failure
   * @returns Failure classification
   */
  classify(
    errorMessage: string,
    stackTrace?: string,
    fileContext?: string[]
  ): FailureClassification {
    const category = this.classifyCategory(errorMessage, stackTrace);
    const complexity = this.classifyComplexity(errorMessage, stackTrace, fileContext);
    const confidence = this.calculateConfidence(category, complexity, errorMessage);

    return {
      category,
      complexity,
      confidence,
      reasoning: this.generateReasoning(category, complexity, errorMessage)
    };
  }

  /**
   * Classify failure category
   *
   * @param errorMessage - Error message
   * @param stackTrace - Stack trace
   * @returns Failure category
   */
  private classifyCategory(errorMessage: string, stackTrace?: string): FailureCategory {
    const msg = errorMessage.toLowerCase();
    const trace = stackTrace?.toLowerCase() || '';

    // Syntax errors
    if (
      msg.includes('syntaxerror') ||
      msg.includes('unexpected token') ||
      msg.includes('unexpected identifier') ||
      msg.includes('missing semicolon') ||
      msg.includes('invalid syntax')
    ) {
      return 'syntax';
    }

    // Integration errors (imports, APIs, dependencies)
    if (
      msg.includes('cannot find module') ||
      msg.includes('modulenotfounderror') ||
      msg.includes('import error') ||
      msg.includes('no such file') ||
      msg.includes('enoent') ||
      msg.includes('404') ||
      msg.includes('connection refused') ||
      msg.includes('network error') ||
      msg.includes('timeout')
    ) {
      return 'integration';
    }

    // Environment errors (config, permissions, env vars)
    if (
      msg.includes('permission denied') ||
      msg.includes('eacces') ||
      msg.includes('environment variable') ||
      msg.includes('config') ||
      msg.includes('not defined') ||
      msg.includes('undefined is not') ||
      msg.includes('cannot read properties of undefined')
    ) {
      return 'environment';
    }

    // Default to logic errors (wrong behavior, assertions)
    return 'logic';
  }

  /**
   * Classify failure complexity
   *
   * @param errorMessage - Error message
   * @param stackTrace - Stack trace
   * @param fileContext - Files involved
   * @returns Complexity level
   */
  private classifyComplexity(
    errorMessage: string,
    stackTrace?: string,
    fileContext?: string[]
  ): Complexity {
    const msg = errorMessage.toLowerCase();
    const filesInvolved = fileContext?.length || 0;

    // Simple: Single file, obvious fix
    if (filesInvolved <= 1) {
      if (
        msg.includes('typo') ||
        msg.includes('missing semicolon') ||
        msg.includes('unexpected token') ||
        msg.includes('import')
      ) {
        return 'simple';
      }
    }

    // Requires human: Architectural or business logic
    if (
      msg.includes('architecture') ||
      msg.includes('design') ||
      msg.includes('business logic') ||
      msg.includes('ambiguous') ||
      msg.includes('unclear requirement')
    ) {
      return 'requires_human';
    }

    // Complex: Multiple files, logic issues
    if (filesInvolved > 3) {
      return 'complex';
    }

    // Moderate: Everything else
    return 'moderate';
  }

  /**
   * Calculate confidence score
   *
   * @param category - Classified category
   * @param complexity - Classified complexity
   * @param errorMessage - Error message
   * @returns Confidence score (0-1)
   */
  private calculateConfidence(
    category: FailureCategory,
    complexity: Complexity,
    errorMessage: string
  ): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence for clear indicators
    const msg = errorMessage.toLowerCase();

    // Strong syntax indicators
    if (category === 'syntax' && msg.includes('syntaxerror')) {
      confidence += 0.4;
    }

    // Strong integration indicators
    if (category === 'integration' && (msg.includes('modulenotfounderror') || msg.includes('404'))) {
      confidence += 0.3;
    }

    // Strong environment indicators
    if (category === 'environment' && msg.includes('permission denied')) {
      confidence += 0.3;
    }

    // Complexity indicators
    if (complexity === 'simple' && msg.length < 100) {
      confidence += 0.2;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Generate reasoning for classification
   *
   * @param category - Classified category
   * @param complexity - Classified complexity
   * @param errorMessage - Error message
   * @returns Human-readable reasoning
   */
  private generateReasoning(
    category: FailureCategory,
    complexity: Complexity,
    errorMessage: string
  ): string {
    const reasons: string[] = [];

    // Category reasoning
    switch (category) {
      case 'syntax':
        reasons.push('Error message indicates syntax issue');
        break;
      case 'integration':
        reasons.push('Error suggests missing dependency or API issue');
        break;
      case 'environment':
        reasons.push('Error points to configuration or environment problem');
        break;
      case 'logic':
        reasons.push('Error indicates logic or assertion failure');
        break;
    }

    // Complexity reasoning
    switch (complexity) {
      case 'simple':
        reasons.push('Issue appears straightforward to fix');
        break;
      case 'moderate':
        reasons.push('Issue may require some investigation');
        break;
      case 'complex':
        reasons.push('Issue involves multiple components');
        break;
      case 'requires_human':
        reasons.push('Issue requires architectural or business decision');
        break;
    }

    return reasons.join('. ');
  }
}
