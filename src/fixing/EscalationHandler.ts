/**
 * Escalation Handler
 * Epic: 006-F
 *
 * Handles escalation when fixes fail or human decision needed
 */

import type { RootCauseAnalysis } from '../types/rca.js';
import type { EscalationReason, EscalationResult, FixAttempt } from '../types/fixing.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export class EscalationHandler {
  private projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  /**
   * Escalate issue to human
   *
   * @param testId - Test identifier
   * @param rca - Root cause analysis
   * @param reason - Escalation reason
   * @param attempts - Fix attempts made
   * @returns Escalation result with handoff path
   */
  async escalate(
    testId: string,
    rca: RootCauseAnalysis,
    reason: EscalationReason,
    attempts?: FixAttempt[]
  ): Promise<EscalationResult> {
    // Generate handoff document
    const handoffPath = await this.generateHandoff(testId, rca, reason, attempts);

    // Return escalation result
    return {
      escalated: true,
      reason,
      handoff_path: handoffPath,
      rca_summary: this.generateRCASummary(rca),
      attempted_fixes: attempts ? attempts.map(a => `${a.fix_strategy} (${a.model_used})`) : []
    };
  }

  /**
   * Generate handoff document
   *
   * @param testId - Test identifier
   * @param rca - Root cause analysis
   * @param reason - Escalation reason
   * @param attempts - Fix attempts
   * @returns Path to handoff file
   */
  private async generateHandoff(
    testId: string,
    rca: RootCauseAnalysis,
    reason: EscalationReason,
    attempts?: FixAttempt[]
  ): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${timestamp}-escalation-${testId}.md`;
    const handoffDir = path.join(this.projectRoot, 'docs', 'handoffs');
    const handoffPath = path.join(handoffDir, filename);

    // Ensure directory exists
    await fs.mkdir(handoffDir, { recursive: true });

    // Generate handoff content
    const content = this.generateHandoffContent(testId, rca, reason, attempts);

    // Write handoff file
    await fs.writeFile(handoffPath, content, 'utf-8');

    return handoffPath;
  }

  /**
   * Generate handoff content
   *
   * @param testId - Test identifier
   * @param rca - Root cause analysis
   * @param reason - Escalation reason
   * @param attempts - Fix attempts
   * @returns Handoff markdown content
   */
  private generateHandoffContent(
    testId: string,
    rca: RootCauseAnalysis,
    reason: EscalationReason,
    attempts?: FixAttempt[]
  ): string {
    const sections: string[] = [];

    // Header
    sections.push('# Fix Escalation Handoff');
    sections.push('');
    sections.push(`**Test ID:** ${testId}`);
    sections.push(`**Epic ID:** ${rca.epic_id}`);
    sections.push(`**Escalation Reason:** ${reason}`);
    sections.push(`**Date:** ${new Date().toISOString()}`);
    sections.push('');

    // Status
    sections.push('## Status');
    sections.push('');
    sections.push('🔴 **ESCALATED** - Human intervention required');
    sections.push('');

    // Root Cause Analysis
    sections.push('## Root Cause Analysis');
    sections.push('');
    sections.push(`**Category:** ${rca.failure_category}`);
    sections.push(`**Complexity:** ${rca.complexity}`);
    sections.push('');
    sections.push('**Root Cause:**');
    sections.push(rca.root_cause);
    sections.push('');
    sections.push('**Diagnosis Reasoning:**');
    sections.push(rca.diagnosis_reasoning);
    sections.push('');

    // Attempted Fixes
    if (attempts && attempts.length > 0) {
      sections.push('## Attempted Fixes');
      sections.push('');
      sections.push(`**Total Attempts:** ${attempts.length}`);
      sections.push('');

      for (const attempt of attempts) {
        sections.push(`### Retry ${attempt.retry_number} - ${attempt.model_used}`);
        sections.push('');
        sections.push(`**Strategy:** ${attempt.fix_strategy}`);
        sections.push(`**Result:** ${attempt.success ? '✅ Success' : '❌ Failed'}`);
        if (attempt.error_message) {
          sections.push(`**Error:** ${attempt.error_message}`);
        }
        sections.push('');
        sections.push('**Changes:**');
        sections.push('```');
        sections.push(attempt.changes_made);
        sections.push('```');
        sections.push('');
      }

      // Cost summary
      const totalCost = attempts.reduce((sum, a) => sum + (a.cost_usd || 0), 0);
      sections.push('**Total Cost:** $' + totalCost.toFixed(4));
      sections.push('');
    }

    // Why Escalated
    sections.push('## Why Escalated');
    sections.push('');
    sections.push(this.getEscalationExplanation(reason, rca, attempts));
    sections.push('');

    // Next Steps
    sections.push('## Next Steps');
    sections.push('');
    sections.push(this.getNextSteps(reason, rca));
    sections.push('');

    // Evidence
    sections.push('## Evidence');
    sections.push('');
    sections.push(`**Evidence Artifact ID:** ${rca.evidence_id || 'N/A'}`);
    sections.push('');

    return sections.join('\n');
  }

  /**
   * Generate RCA summary
   *
   * @param rca - Root cause analysis
   * @returns Brief summary
   */
  private generateRCASummary(rca: RootCauseAnalysis): string {
    return `[${rca.complexity}] ${rca.failure_category}: ${rca.root_cause}`;
  }

  /**
   * Get escalation explanation
   *
   * @param reason - Escalation reason
   * @param rca - Root cause analysis
   * @param attempts - Fix attempts
   * @returns Explanation text
   */
  private getEscalationExplanation(
    reason: EscalationReason,
    rca: RootCauseAnalysis,
    attempts?: FixAttempt[]
  ): string {
    const explanations: Record<EscalationReason, string> = {
      'Root cause requires human decision': 'The root cause involves architectural or design decisions that require human judgment. Automated fixes could introduce technical debt or violate system constraints.',
      'Architectural change needed': 'The issue requires changes to system architecture that are beyond the scope of automated fixes. This may involve refactoring, new patterns, or design changes.',
      'Business logic ambiguity': 'The correct fix depends on business requirements or domain knowledge that is not encoded in the codebase. Human clarification is needed.',
      'Max retries exhausted': `All ${attempts?.length || 3} automated fix attempts have been exhausted without resolving the issue. Further attempts are unlikely to succeed without human analysis.`,
      'Unknown failure pattern': 'The failure pattern is not recognized and does not match any known fix strategies. Manual investigation is required.'
    };

    return explanations[reason] || 'Unknown escalation reason.';
  }

  /**
   * Get recommended next steps
   *
   * @param reason - Escalation reason
   * @param rca - Root cause analysis
   * @returns Next steps text
   */
  private getNextSteps(reason: EscalationReason, rca: RootCauseAnalysis): string {
    if (reason === 'Architectural change needed' || reason === 'Root cause requires human decision') {
      return `1. Review root cause analysis above
2. Assess architectural impact
3. Create ADR if needed
4. Design appropriate solution
5. Implement fix with proper testing`;
    }

    if (reason === 'Business logic ambiguity') {
      return `1. Clarify business requirements
2. Document expected behavior
3. Update test expectations if needed
4. Implement fix based on clarified requirements`;
    }

    if (reason === 'Max retries exhausted') {
      return `1. Review all attempted fixes above
2. Analyze why each fix failed
3. Consider alternative approaches
4. May need to update RCA with new insights
5. Implement fix manually`;
    }

    return `1. Review root cause analysis
2. Investigate failure pattern
3. Design appropriate fix
4. Implement and test`;
  }

  /**
   * Check if issue should be escalated immediately
   *
   * @param rca - Root cause analysis
   * @returns True if should escalate without retries
   */
  shouldEscalateImmediately(rca: RootCauseAnalysis): boolean {
    return rca.complexity === 'requires_human';
  }

  /**
   * Alert user about escalation
   *
   * @param escalation - Escalation result
   */
  async alertUser(escalation: EscalationResult): Promise<void> {
    // In production, this would:
    // 1. Send notification
    // 2. Create issue in tracking system
    // 3. Log to monitoring system

    console.log('🔴 ESCALATION ALERT:');
    console.log(`Reason: ${escalation.reason}`);
    console.log(`Handoff: ${escalation.handoff_path}`);
    console.log(`RCA: ${escalation.rca_summary}`);
  }
}
