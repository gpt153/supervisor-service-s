/**
 * Skeptical Analyzer
 * Detects suspicious patterns that suggest test execution lies
 * Epic 006-E: Independent Verification Agent
 */

import { Logger } from 'pino';
import {
  SkepticalAnalysisResult,
  SuspiciousPattern,
  SuspiciousPatternType,
} from '../types/verification.js';
import { EvidenceArtifact } from '../types/evidence.js';
import { RedFlag } from '../types/red-flags.js';
import { EvidenceAnalyzer } from './EvidenceAnalyzer.js';

export class SkepticalAnalyzer {
  constructor(
    private analyzer: EvidenceAnalyzer,
    private logger: Logger
  ) {}

  /**
   * Analyze evidence for suspicious patterns
   */
  async analyze(
    evidence: EvidenceArtifact,
    redFlags: RedFlag[]
  ): Promise<SkepticalAnalysisResult> {
    const patterns: SuspiciousPattern[] = [];

    // 1. Check for too-perfect results
    const tooPerfect = await this.checkTooPerfect(evidence);
    if (tooPerfect) patterns.push(tooPerfect);

    // 2. Check for impossibly fast execution
    const tooFast = await this.checkTooFast(evidence);
    if (tooFast) patterns.push(tooFast);

    // 3. Check for missing artifacts
    const missingArtifacts = await this.checkMissingArtifacts(evidence);
    if (missingArtifacts) patterns.push(missingArtifacts);

    // 4. Check for zero network activity (UI tests)
    if (evidence.test_type === 'ui') {
      const zeroNetwork = await this.checkZeroNetwork(evidence);
      if (zeroNetwork) patterns.push(zeroNetwork);
    }

    // 5. Check for zero DOM changes (UI tests)
    if (evidence.test_type === 'ui') {
      const zeroDOMChanges = await this.checkZeroDOMChanges(evidence);
      if (zeroDOMChanges) patterns.push(zeroDOMChanges);
    }

    // 6. Check if red flags were ignored
    const redFlagsIgnored = await this.checkRedFlagsIgnored(evidence, redFlags);
    if (redFlagsIgnored) patterns.push(redFlagsIgnored);

    // 7. Check for inconsistent timing
    const inconsistentTiming = await this.checkInconsistentTiming(evidence);
    if (inconsistentTiming) patterns.push(inconsistentTiming);

    // 8. Check for empty logs
    const emptyLogs = await this.checkEmptyLogs(evidence);
    if (emptyLogs) patterns.push(emptyLogs);

    const concerns = patterns.map((p) => p.description);
    const suspicious = patterns.length > 0;
    const recommendManualReview = patterns.filter((p) => p.severity === 'high').length > 0;

    return {
      suspicious,
      concerns,
      recommendManualReview,
      suspiciousPatterns: patterns,
    };
  }

  /**
   * Check for suspiciously perfect results
   */
  private async checkTooPerfect(
    evidence: EvidenceArtifact
  ): Promise<SuspiciousPattern | null> {
    try {
      // Analyze console logs if available
      let noErrors = true;
      let noWarnings = true;

      if (evidence.console_logs) {
        const consoleAnalysis = await this.analyzer.analyzeConsoleLogs(
          evidence.console_logs
        );
        noErrors = consoleAnalysis.errorCount === 0;
        noWarnings = consoleAnalysis.warningCount === 0;
      }

      // Check coverage if available
      let perfectCoverage = false;
      if (evidence.coverage_report) {
        const coverageAnalysis = await this.analyzer.analyzeCoverage(
          evidence.coverage_report
        );
        perfectCoverage = coverageAnalysis.after === 100;
      }

      // Perfect results are suspicious (no errors, no warnings, 100% coverage)
      const isPerfect = noErrors && noWarnings && perfectCoverage;

      if (isPerfect) {
        return {
          type: 'too_perfect',
          description:
            'Results are suspiciously perfect (no errors, no warnings, 100% coverage)',
          severity: 'medium',
          evidence: {
            noErrors,
            noWarnings,
            perfectCoverage,
          },
        };
      }

      return null;
    } catch (error) {
      this.logger.debug({ error }, 'Failed to check for too-perfect results');
      return null;
    }
  }

  /**
   * Check for impossibly fast execution
   */
  private async checkTooFast(
    evidence: EvidenceArtifact
  ): Promise<SuspiciousPattern | null> {
    if (!evidence.duration_ms) {
      return null;
    }

    // Different minimum times for different test types
    const minimumTimes: Record<string, number> = {
      ui: 500, // UI tests should take at least 500ms
      api: 50, // API tests at least 50ms
      unit: 10, // Unit tests at least 10ms
      integration: 200, // Integration tests at least 200ms
    };

    const minTime = minimumTimes[evidence.test_type] || 50;

    if (evidence.duration_ms < minTime) {
      return {
        type: 'too_fast',
        description: `Test completed in ${evidence.duration_ms}ms (expected >=${minTime}ms for ${evidence.test_type} test)`,
        severity: 'high',
        evidence: {
          duration: evidence.duration_ms,
          expectedMinimum: minTime,
          testType: evidence.test_type,
        },
      };
    }

    return null;
  }

  /**
   * Check for missing expected artifacts
   */
  private async checkMissingArtifacts(
    evidence: EvidenceArtifact
  ): Promise<SuspiciousPattern | null> {
    const missingArtifacts: string[] = [];

    // UI tests should have screenshots
    if (evidence.test_type === 'ui') {
      if (!evidence.screenshot_before) missingArtifacts.push('screenshot_before');
      if (!evidence.screenshot_after) missingArtifacts.push('screenshot_after');
      if (!evidence.console_logs) missingArtifacts.push('console_logs');
    }

    // API tests should have HTTP artifacts
    if (evidence.test_type === 'api') {
      if (!evidence.http_request) missingArtifacts.push('http_request');
      if (!evidence.http_response) missingArtifacts.push('http_response');
    }

    // All tests should have some artifacts
    if (
      !evidence.screenshot_before &&
      !evidence.screenshot_after &&
      !evidence.console_logs &&
      !evidence.http_request &&
      !evidence.http_response &&
      !evidence.coverage_report
    ) {
      return {
        type: 'missing_artifacts',
        description: 'Test has NO artifacts collected - likely not actually run',
        severity: 'high',
        evidence: { testType: evidence.test_type },
      };
    }

    if (missingArtifacts.length > 0) {
      return {
        type: 'missing_artifacts',
        description: `Missing expected artifacts: ${missingArtifacts.join(', ')}`,
        severity: 'medium',
        evidence: {
          missing: missingArtifacts,
          testType: evidence.test_type,
        },
      };
    }

    return null;
  }

  /**
   * Check for zero network activity in UI test
   */
  private async checkZeroNetwork(
    evidence: EvidenceArtifact
  ): Promise<SuspiciousPattern | null> {
    if (!evidence.network_trace) {
      // Network trace not collected, can't check
      return null;
    }

    try {
      const httpAnalysis = await this.analyzer.analyzeHTTPTraces(evidence.network_trace);

      if (httpAnalysis.requestCount === 0) {
        return {
          type: 'zero_network',
          description: 'UI test has no network activity (likely not actually run)',
          severity: 'high',
          evidence: { requestCount: 0 },
        };
      }

      return null;
    } catch (error) {
      this.logger.debug({ error }, 'Failed to check network activity');
      return null;
    }
  }

  /**
   * Check for zero DOM changes in UI test
   */
  private async checkZeroDOMChanges(
    evidence: EvidenceArtifact
  ): Promise<SuspiciousPattern | null> {
    if (!evidence.dom_snapshot) {
      // DOM snapshot not collected, can't check
      return null;
    }

    try {
      const domAnalysis = await this.analyzer.analyzeDOMSnapshot(
        evidence.dom_snapshot,
        evidence.dom_snapshot
      );

      if (domAnalysis.changeCount === 0) {
        return {
          type: 'zero_dom_changes',
          description: 'UI test has no DOM changes (likely not actually run)',
          severity: 'medium',
          evidence: { changeCount: 0 },
        };
      }

      return null;
    } catch (error) {
      this.logger.debug({ error }, 'Failed to check DOM changes');
      return null;
    }
  }

  /**
   * Check if high/critical red flags were ignored
   */
  private async checkRedFlagsIgnored(
    evidence: EvidenceArtifact,
    redFlags: RedFlag[]
  ): Promise<SuspiciousPattern | null> {
    const highSeverityFlags = redFlags.filter(
      (f) => f.severity === 'high' || f.severity === 'critical'
    );

    if (highSeverityFlags.length > 0 && evidence.pass_fail === 'pass') {
      return {
        type: 'red_flags_ignored',
        description: `Test passed but ${highSeverityFlags.length} high/critical red flags detected`,
        severity: 'high',
        evidence: {
          flagCount: highSeverityFlags.length,
          testResult: evidence.pass_fail,
          flags: highSeverityFlags.map((f) => ({
            type: f.flagType,
            severity: f.severity,
            description: f.description,
          })),
        },
      };
    }

    return null;
  }

  /**
   * Check for timing inconsistencies
   */
  private async checkInconsistentTiming(
    evidence: EvidenceArtifact
  ): Promise<SuspiciousPattern | null> {
    if (!evidence.duration_ms || !evidence.network_trace) {
      return null;
    }

    try {
      const httpAnalysis = await this.analyzer.analyzeHTTPTraces(evidence.network_trace);

      // If network requests took longer than total test duration, something is wrong
      const totalNetworkTime = httpAnalysis.requestCount * httpAnalysis.averageResponseTime;

      if (totalNetworkTime > evidence.duration_ms * 2) {
        // Network time is more than 2x total duration
        return {
          type: 'inconsistent_timing',
          description: `Network requests took ${totalNetworkTime}ms but total test duration was ${evidence.duration_ms}ms`,
          severity: 'medium',
          evidence: {
            testDuration: evidence.duration_ms,
            networkTime: totalNetworkTime,
            requestCount: httpAnalysis.requestCount,
          },
        };
      }

      return null;
    } catch (error) {
      this.logger.debug({ error }, 'Failed to check timing consistency');
      return null;
    }
  }

  /**
   * Check for suspiciously empty logs
   */
  private async checkEmptyLogs(
    evidence: EvidenceArtifact
  ): Promise<SuspiciousPattern | null> {
    if (!evidence.console_logs) {
      return null;
    }

    try {
      const consoleAnalysis = await this.analyzer.analyzeConsoleLogs(evidence.console_logs);

      const totalLogs =
        consoleAnalysis.errorCount +
        consoleAnalysis.warningCount +
        consoleAnalysis.infoCount;

      // UI tests should have SOME console output
      if (evidence.test_type === 'ui' && totalLogs === 0) {
        return {
          type: 'empty_logs',
          description: 'UI test has no console output (suspicious)',
          severity: 'low',
          evidence: { totalLogs: 0 },
        };
      }

      return null;
    } catch (error) {
      this.logger.debug({ error }, 'Failed to check for empty logs');
      return null;
    }
  }
}
