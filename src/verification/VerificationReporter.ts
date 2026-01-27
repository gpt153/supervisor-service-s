/**
 * Verification Reporter
 * Generates plain language verification reports
 * Epic 006-E: Independent Verification Agent
 */

import { Logger } from 'pino';
import { Pool } from 'pg';
import {
  VerificationResult,
  VerificationReportInput,
  VerificationReport,
  EvidenceReviewedSummary,
  RedFlagSummary,
  CrossValidationResult,
  SkepticalAnalysisResult,
  IntegrityCheckResult,
  ConfidenceCalculation,
} from '../types/verification.js';
import { insertVerificationReport } from '../db/queries/verification-reports.js';

export class VerificationReporter {
  constructor(
    private pool: Pool,
    private logger: Logger
  ) {}

  /**
   * Generate complete verification report
   */
  async generate(result: VerificationResult): Promise<VerificationReport> {
    try {
      // Save report to database
      const reportInput: VerificationReportInput = {
        testId: result.testId,
        epicId: result.epicId,
        evidenceId: undefined, // Would be populated if we have evidence ID
        verified: result.verified,
        confidenceScore: result.confidenceScore,
        recommendation: result.recommendation,
        evidenceReviewed: result.evidenceReview,
        crossValidationResults: result.crossValidation,
        redFlagsFound: result.redFlags,
        summary: result.summary,
        reasoning: result.reasoning,
        concerns: result.concerns,
        verifierModel: result.verifierModel,
      };

      const report = await insertVerificationReport(this.pool, reportInput);

      this.logger.info(
        {
          testId: result.testId,
          verified: result.verified,
          confidence: result.confidenceScore,
        },
        'Verification report generated'
      );

      return report;
    } catch (error) {
      this.logger.error({ error, result }, 'Failed to generate verification report');
      throw error;
    }
  }

  /**
   * Generate plain language summary
   */
  generateSummary(
    verified: boolean,
    confidenceScore: number,
    concerns: string[]
  ): string {
    if (verified) {
      if (confidenceScore >= 90) {
        return `✅ Verification PASSED with high confidence (${confidenceScore}%). Evidence is complete and consistent.`;
      } else {
        return `✅ Verification PASSED with moderate confidence (${confidenceScore}%). Some minor concerns noted.`;
      }
    } else {
      if (concerns.length > 0) {
        return `❌ Verification FAILED (${confidenceScore}% confidence). ${concerns.length} concerns identified: ${concerns[0]}`;
      } else {
        return `❌ Verification FAILED (${confidenceScore}% confidence). Evidence does not support test result.`;
      }
    }
  }

  /**
   * Generate detailed reasoning
   */
  generateReasoning(
    evidenceReview: EvidenceReviewedSummary,
    crossValidation: CrossValidationResult[],
    redFlags: RedFlagSummary,
    skepticalAnalysis: SkepticalAnalysisResult,
    integrityChecks: IntegrityCheckResult,
    confidenceCalculation: ConfidenceCalculation
  ): string {
    const lines: string[] = [];

    // Evidence review
    lines.push('**Evidence Review:**');
    lines.push(
      `- Reviewed ${evidenceReview.totalArtifacts} artifacts (${evidenceReview.screenshots} screenshots, ${evidenceReview.logs} logs, ${evidenceReview.traces} traces)`
    );
    if (evidenceReview.missingArtifacts.length > 0) {
      lines.push(
        `- ⚠️ Missing artifacts: ${evidenceReview.missingArtifacts.join(', ')}`
      );
    }
    lines.push('');

    // Integrity checks
    lines.push('**Integrity Checks:**');
    lines.push(`- Files exist: ${integrityChecks.checks.filesExist ? '✅' : '❌'}`);
    lines.push(
      `- Timestamps sequential: ${integrityChecks.checks.timestampsSequential ? '✅' : '❌'}`
    );
    lines.push(
      `- Sizes reasonable: ${integrityChecks.checks.sizesReasonable ? '✅' : '❌'}`
    );
    lines.push(
      `- Formats correct: ${integrityChecks.checks.formatsCorrect ? '✅' : '❌'}`
    );
    if (integrityChecks.errors.length > 0) {
      lines.push(`- ⚠️ Errors: ${integrityChecks.errors.join('; ')}`);
    }
    lines.push('');

    // Cross-validation
    lines.push('**Cross-Validation:**');
    const mismatches = crossValidation.filter((cv) => !cv.matched);
    if (mismatches.length === 0) {
      lines.push('- ✅ All evidence sources are consistent');
    } else {
      lines.push(`- ⚠️ ${mismatches.length} inconsistencies detected:`);
      mismatches.forEach((m) => {
        lines.push(`  - ${m.type}: ${m.description}`);
      });
    }
    lines.push('');

    // Red flags
    lines.push('**Red Flags:**');
    if (redFlags.totalFlags === 0) {
      lines.push('- ✅ No red flags detected');
    } else {
      lines.push(
        `- 🚩 ${redFlags.totalFlags} flags: ${redFlags.critical} critical, ${redFlags.high} high, ${redFlags.medium} medium, ${redFlags.low} low`
      );
      if (redFlags.descriptions.length > 0) {
        redFlags.descriptions.slice(0, 3).forEach((desc) => {
          lines.push(`  - ${desc}`);
        });
        if (redFlags.descriptions.length > 3) {
          lines.push(`  - ... and ${redFlags.descriptions.length - 3} more`);
        }
      }
    }
    lines.push('');

    // Skeptical analysis
    if (skepticalAnalysis.suspicious) {
      lines.push('**Suspicious Patterns:**');
      skepticalAnalysis.concerns.forEach((concern) => {
        lines.push(`- ⚠️ ${concern}`);
      });
      lines.push('');
    }

    // Confidence calculation
    lines.push('**Confidence Breakdown:**');
    lines.push(
      `- Final score: ${confidenceCalculation.finalScore}% (threshold: ${confidenceCalculation.threshold.autoPass}% for auto-pass)`
    );
    lines.push(`- ${confidenceCalculation.explanation}`);

    return lines.join('\n');
  }

  /**
   * Generate recommendations
   */
  generateRecommendations(
    verified: boolean,
    confidenceScore: number,
    concerns: string[],
    redFlags: RedFlagSummary,
    skepticalAnalysis: SkepticalAnalysisResult
  ): string[] {
    const recommendations: string[] = [];

    if (!verified) {
      recommendations.push('❌ Do NOT merge this code - verification failed');
      recommendations.push('Review test implementation and re-run verification');
    } else if (confidenceScore < 80) {
      recommendations.push('⚠️ Manual review recommended before merging');
      recommendations.push('Confidence score below optimal threshold');
    } else {
      recommendations.push('✅ Safe to merge - verification passed with high confidence');
    }

    if (redFlags.critical > 0) {
      recommendations.push(
        `🚩 Address ${redFlags.critical} critical red flag(s) immediately`
      );
    }

    if (redFlags.high > 0) {
      recommendations.push(`⚠️ Review ${redFlags.high} high-severity red flag(s)`);
    }

    if (skepticalAnalysis.suspicious) {
      recommendations.push(
        '⚠️ Suspicious patterns detected - verify test actually executed'
      );
    }

    if (concerns.length > 0) {
      recommendations.push(`📋 Address ${concerns.length} concern(s) noted in reasoning`);
    }

    return recommendations;
  }

  /**
   * Format verification report as markdown
   */
  formatAsMarkdown(report: VerificationReport): string {
    const lines: string[] = [];

    lines.push(`# Verification Report: ${report.testId}`);
    lines.push('');
    lines.push(`**Epic:** ${report.epicId}`);
    lines.push(`**Verified At:** ${report.verifiedAt.toISOString()}`);
    lines.push(`**Verifier Model:** ${report.verifierModel}`);
    lines.push('');

    lines.push('## Summary');
    lines.push('');
    lines.push(report.summary);
    lines.push('');

    lines.push('## Outcome');
    lines.push('');
    lines.push(`- **Verified:** ${report.verified ? '✅ PASS' : '❌ FAIL'}`);
    lines.push(`- **Confidence Score:** ${report.confidenceScore}%`);
    lines.push(`- **Recommendation:** ${report.recommendation.toUpperCase()}`);
    lines.push('');

    if (report.concerns.length > 0) {
      lines.push('## Concerns');
      lines.push('');
      report.concerns.forEach((concern, i) => {
        lines.push(`${i + 1}. ${concern}`);
      });
      lines.push('');
    }

    lines.push('## Detailed Analysis');
    lines.push('');
    lines.push(report.reasoning);
    lines.push('');

    lines.push('---');
    lines.push('');
    lines.push('*Generated by Independent Verification Agent (Epic 006-E)*');

    return lines.join('\n');
  }

  /**
   * Export report to file
   */
  async exportToFile(
    report: VerificationReport,
    outputPath: string
  ): Promise<void> {
    try {
      const markdown = this.formatAsMarkdown(report);
      const fs = await import('fs/promises');
      await fs.writeFile(outputPath, markdown, 'utf-8');

      this.logger.info({ testId: report.testId, outputPath }, 'Report exported to file');
    } catch (error) {
      this.logger.error({ error, outputPath }, 'Failed to export report to file');
      throw error;
    }
  }
}
