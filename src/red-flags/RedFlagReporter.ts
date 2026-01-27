/**
 * Red Flag Reporter
 * Epic 006-B: Generate reports for detected red flags
 *
 * Outputs markdown and JSON reports
 */

import { promises as fs } from 'fs';
import path from 'path';
import { RedFlag, RedFlagDetectionResult, RedFlagReport } from '../types/red-flags.js';

/**
 * Report format options
 */
export type ReportFormat = 'markdown' | 'json' | 'both';

/**
 * Generate reports for red flags
 */
export class RedFlagReporter {
  /**
   * Generate report for a single test
   */
  async generateReport(
    result: RedFlagDetectionResult,
    format: ReportFormat = 'markdown'
  ): Promise<{ markdown?: string; json?: string }> {
    const report: RedFlagReport = {
      epicId: result.epicId,
      testId: result.testId,
      summary: result.summary,
      verdict: result.verdict,
      recommendation: result.recommendation,
      flags: result.flags,
      generatedAt: new Date(),
    };

    const output: { markdown?: string; json?: string } = {};

    if (format === 'markdown' || format === 'both') {
      output.markdown = this.generateMarkdownReport(report);
    }

    if (format === 'json' || format === 'both') {
      output.json = this.generateJsonReport(report);
    }

    return output;
  }

  /**
   * Generate markdown report
   */
  private generateMarkdownReport(report: RedFlagReport): string {
    const lines: string[] = [];

    // Header
    lines.push(`# Red Flag Detection Report`);
    lines.push('');
    lines.push(`**Epic:** ${report.epicId}`);
    lines.push(`**Test:** ${report.testId}`);
    lines.push(`**Generated:** ${report.generatedAt.toISOString()}`);
    lines.push('');

    // Verdict
    lines.push(`## Verdict: ${this.getVerdictEmoji(report.verdict)} ${report.verdict.toUpperCase()}`);
    lines.push('');
    lines.push(report.recommendation);
    lines.push('');

    // Summary
    lines.push(`## Summary`);
    lines.push('');
    lines.push(`- **Total Flags:** ${report.summary.totalFlags}`);
    lines.push(`- **Critical:** ${report.summary.criticalFlags} (auto-fail)`);
    lines.push(`- **High:** ${report.summary.highFlags} (manual review)`);
    lines.push(`- **Medium:** ${report.summary.mediumFlags} (log for analysis)`);
    lines.push(`- **Low:** ${report.summary.lowFlags} (informational)`);
    lines.push('');

    // Flags detail
    if (report.flags.length > 0) {
      lines.push(`## Detected Red Flags`);
      lines.push('');

      // Group by severity
      const groupedFlags = this.groupFlagsBySeverity(report.flags);

      for (const severity of ['critical', 'high', 'medium', 'low']) {
        const flags = groupedFlags[severity];
        if (flags.length > 0) {
          lines.push(`### ${this.getSeverityEmoji(severity)} ${severity.toUpperCase()} (${flags.length})`);
          lines.push('');

          for (const flag of flags) {
            lines.push(`#### ${flag.flagType.replace(/_/g, ' ').toUpperCase()}`);
            lines.push('');
            lines.push(`**Description:** ${flag.description}`);
            lines.push('');
            lines.push(`**Detected At:** ${flag.detectedAt.toISOString()}`);
            lines.push('');

            // Proof details
            lines.push(`**Proof:**`);
            lines.push('```json');
            lines.push(JSON.stringify(flag.proof, null, 2));
            lines.push('```');
            lines.push('');

            if (flag.resolved) {
              lines.push(`**Resolution:** ${flag.resolutionNotes}`);
              lines.push(`**Resolved At:** ${flag.resolvedAt?.toISOString()}`);
              lines.push('');
            }
          }
        }
      }
    } else {
      lines.push(`## ✅ No Red Flags Detected`);
      lines.push('');
      lines.push(`All checks passed successfully.`);
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Generate JSON report
   */
  private generateJsonReport(report: RedFlagReport): string {
    return JSON.stringify(report, null, 2);
  }

  /**
   * Save report to file
   */
  async saveReport(
    result: RedFlagDetectionResult,
    outputDir: string,
    format: ReportFormat = 'both'
  ): Promise<{ markdownPath?: string; jsonPath?: string }> {
    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseFilename = `red-flags-${result.epicId}-${result.testId}-${timestamp}`;

    const output = await this.generateReport(result, format);
    const paths: { markdownPath?: string; jsonPath?: string } = {};

    if (output.markdown) {
      const markdownPath = path.join(outputDir, `${baseFilename}.md`);
      await fs.writeFile(markdownPath, output.markdown, 'utf-8');
      paths.markdownPath = markdownPath;
    }

    if (output.json) {
      const jsonPath = path.join(outputDir, `${baseFilename}.json`);
      await fs.writeFile(jsonPath, output.json, 'utf-8');
      paths.jsonPath = jsonPath;
    }

    return paths;
  }

  /**
   * Generate batch report for multiple tests
   */
  async generateBatchReport(
    results: RedFlagDetectionResult[],
    format: ReportFormat = 'markdown'
  ): Promise<{ markdown?: string; json?: string }> {
    const output: { markdown?: string; json?: string } = {};

    if (format === 'markdown' || format === 'both') {
      output.markdown = this.generateBatchMarkdownReport(results);
    }

    if (format === 'json' || format === 'both') {
      output.json = JSON.stringify(results, null, 2);
    }

    return output;
  }

  /**
   * Generate batch markdown report
   */
  private generateBatchMarkdownReport(results: RedFlagDetectionResult[]): string {
    const lines: string[] = [];

    // Header
    lines.push(`# Batch Red Flag Detection Report`);
    lines.push('');
    lines.push(`**Generated:** ${new Date().toISOString()}`);
    lines.push(`**Total Tests:** ${results.length}`);
    lines.push('');

    // Summary
    const passed = results.filter((r) => r.verdict === 'pass').length;
    const failed = results.filter((r) => r.verdict === 'fail').length;
    const review = results.filter((r) => r.verdict === 'review').length;

    lines.push(`## Overall Summary`);
    lines.push('');
    lines.push(`- ✅ **Passed:** ${passed}`);
    lines.push(`- ❌ **Failed:** ${failed}`);
    lines.push(`- ⚠️  **Review Required:** ${review}`);
    lines.push('');

    // Aggregate flags
    const totalFlags = results.reduce((sum, r) => sum + r.summary.totalFlags, 0);
    const criticalFlags = results.reduce((sum, r) => sum + r.summary.criticalFlags, 0);
    const highFlags = results.reduce((sum, r) => sum + r.summary.highFlags, 0);
    const mediumFlags = results.reduce((sum, r) => sum + r.summary.mediumFlags, 0);
    const lowFlags = results.reduce((sum, r) => sum + r.summary.lowFlags, 0);

    lines.push(`## Aggregate Flags`);
    lines.push('');
    lines.push(`- **Total Flags:** ${totalFlags}`);
    lines.push(`- **Critical:** ${criticalFlags}`);
    lines.push(`- **High:** ${highFlags}`);
    lines.push(`- **Medium:** ${mediumFlags}`);
    lines.push(`- **Low:** ${lowFlags}`);
    lines.push('');

    // Individual test results
    lines.push(`## Test Results`);
    lines.push('');

    for (const result of results) {
      const emoji = this.getVerdictEmoji(result.verdict);
      lines.push(`### ${emoji} Test: ${result.testId}`);
      lines.push('');
      lines.push(`**Verdict:** ${result.verdict.toUpperCase()}`);
      lines.push(`**Flags:** ${result.summary.totalFlags} (C:${result.summary.criticalFlags}, H:${result.summary.highFlags}, M:${result.summary.mediumFlags}, L:${result.summary.lowFlags})`);
      lines.push('');
      lines.push(result.recommendation);
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Group flags by severity
   */
  private groupFlagsBySeverity(flags: RedFlag[]): Record<string, RedFlag[]> {
    return {
      critical: flags.filter((f) => f.severity === 'critical'),
      high: flags.filter((f) => f.severity === 'high'),
      medium: flags.filter((f) => f.severity === 'medium'),
      low: flags.filter((f) => f.severity === 'low'),
    };
  }

  /**
   * Get verdict emoji
   */
  private getVerdictEmoji(verdict: string): string {
    switch (verdict) {
      case 'pass':
        return '✅';
      case 'fail':
        return '❌';
      case 'review':
        return '⚠️';
      default:
        return '❓';
    }
  }

  /**
   * Get severity emoji
   */
  private getSeverityEmoji(severity: string): string {
    switch (severity) {
      case 'critical':
        return '🔴';
      case 'high':
        return '🟠';
      case 'medium':
        return '🟡';
      case 'low':
        return '🔵';
      default:
        return '⚪';
    }
  }
}
