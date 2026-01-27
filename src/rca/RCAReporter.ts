/**
 * RCA Reporter
 * Epic: 006-F
 *
 * Generates human-readable RCA reports
 */

import type { RootCauseAnalysis } from '../types/rca.js';
import type { FixAttempt } from '../types/fixing.js';

export class RCAReporter {
  /**
   * Generate RCA report
   *
   * @param rca - Root cause analysis
   * @param attempts - Fix attempts (optional)
   * @returns Formatted report
   */
  generateReport(rca: RootCauseAnalysis, attempts?: FixAttempt[]): string {
    const sections: string[] = [];

    // Header
    sections.push('# Root Cause Analysis Report');
    sections.push('');
    sections.push(`**Test ID:** ${rca.test_id}`);
    sections.push(`**Epic ID:** ${rca.epic_id}`);
    sections.push(`**Analyzed:** ${rca.analyzed_at || new Date().toISOString()}`);
    sections.push(`**Analyzer:** ${rca.analyzer_model}`);
    sections.push('');

    // Classification
    sections.push('## Classification');
    sections.push('');
    sections.push(`**Category:** ${this.formatCategory(rca.failure_category)}`);
    sections.push(`**Complexity:** ${this.formatComplexity(rca.complexity)}`);
    sections.push(`**Estimated Fix Difficulty:** ${rca.estimated_fix_difficulty} ${rca.estimated_fix_difficulty === 1 ? 'retry' : 'retries'}`);
    sections.push('');

    // Symptoms
    if (rca.symptoms && rca.symptoms.length > 0) {
      sections.push('## Symptoms');
      sections.push('');
      for (const symptom of rca.symptoms) {
        sections.push(`- ${symptom}`);
      }
      sections.push('');
    }

    // Root Cause
    sections.push('## Root Cause');
    sections.push('');
    sections.push(rca.root_cause);
    sections.push('');

    // Diagnosis Reasoning
    if (rca.diagnosis_reasoning) {
      sections.push('## Diagnosis Reasoning');
      sections.push('');
      sections.push(rca.diagnosis_reasoning);
      sections.push('');
    }

    // Recommended Strategy
    sections.push('## Recommended Fix Strategy');
    sections.push('');
    sections.push(`**Strategy:** ${rca.recommended_strategy}`);
    sections.push('');

    // Fix Attempts (if provided)
    if (attempts && attempts.length > 0) {
      sections.push('## Fix Attempts');
      sections.push('');
      for (const attempt of attempts) {
        sections.push(`### Retry ${attempt.retry_number} (${attempt.model_used})`);
        sections.push('');
        sections.push(`**Strategy:** ${attempt.fix_strategy}`);
        sections.push(`**Result:** ${attempt.success ? '✅ Success' : '❌ Failed'}`);
        if (attempt.verification_passed !== undefined) {
          sections.push(`**Verification:** ${attempt.verification_passed ? '✅ Passed' : '❌ Failed'}`);
        }
        if (attempt.error_message) {
          sections.push(`**Error:** ${attempt.error_message}`);
        }
        if (attempt.cost_usd) {
          sections.push(`**Cost:** $${attempt.cost_usd.toFixed(4)}`);
        }
        sections.push('');
        sections.push('**Changes Made:**');
        sections.push('```');
        sections.push(attempt.changes_made);
        sections.push('```');
        sections.push('');
      }
    }

    return sections.join('\n');
  }

  /**
   * Generate summary for quick viewing
   *
   * @param rca - Root cause analysis
   * @returns Brief summary
   */
  generateSummary(rca: RootCauseAnalysis): string {
    return `[${this.formatComplexity(rca.complexity)}] ${this.formatCategory(rca.failure_category)}: ${rca.root_cause}`;
  }

  /**
   * Format category for display
   *
   * @param category - Failure category
   * @returns Formatted string
   */
  private formatCategory(category: string): string {
    const formatted = category.charAt(0).toUpperCase() + category.slice(1);
    const icons: Record<string, string> = {
      syntax: '🔤',
      logic: '🧠',
      integration: '🔗',
      environment: '⚙️'
    };
    return `${icons[category] || ''} ${formatted}`;
  }

  /**
   * Format complexity for display
   *
   * @param complexity - Complexity level
   * @returns Formatted string
   */
  private formatComplexity(complexity: string): string {
    const icons: Record<string, string> = {
      simple: '🟢',
      moderate: '🟡',
      complex: '🟠',
      requires_human: '🔴'
    };
    return `${icons[complexity] || ''} ${complexity.toUpperCase()}`;
  }
}
