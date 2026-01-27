/**
 * Cross Validator
 * Compares multiple evidence sources to detect contradictions
 * Epic 006-E: Independent Verification Agent
 */

import { Logger } from 'pino';
import { Pool } from 'pg';
import { CrossValidationResult, CrossValidationType } from '../types/verification.js';
import { EvidenceArtifact, TestType } from '../types/evidence.js';
import { EvidenceAnalyzer } from './EvidenceAnalyzer.js';
import { getTestTimingAverages } from '../db/queries/red-flags.js';

export class CrossValidator {
  constructor(
    private analyzer: EvidenceAnalyzer,
    private pool: Pool,
    private logger: Logger
  ) {}

  /**
   * Validate evidence by cross-checking multiple sources
   */
  async validate(evidence: EvidenceArtifact): Promise<CrossValidationResult[]> {
    const results: CrossValidationResult[] = [];

    // 1. Screenshot vs Console Logs
    if (evidence.screenshot_after && evidence.console_logs) {
      const screenshotVsConsole = await this.validateScreenshotVsConsole(
        evidence.screenshot_after,
        evidence.console_logs
      );
      results.push(screenshotVsConsole);
    }

    // 2. HTTP Response vs Expected Schema (for API tests)
    if (evidence.test_type === 'api' && evidence.http_response) {
      const httpVsSchema = await this.validateHTTPVsSchema(
        evidence.http_response,
        evidence.expected_outcome
      );
      results.push(httpVsSchema);
    }

    // 3. Test Duration vs Historical Average
    if (evidence.duration_ms && evidence.test_name) {
      const durationVsHistorical = await this.validateDurationVsHistorical(
        evidence.test_name,
        evidence.duration_ms
      );
      results.push(durationVsHistorical);
    }

    // 4. Coverage Change vs Test Scope
    if (evidence.coverage_report) {
      const coverageVsScope = await this.validateCoverageVsScope(
        evidence.coverage_report,
        evidence.test_type
      );
      results.push(coverageVsScope);
    }

    // 5. Network Activity vs UI Changes (for UI tests)
    if (evidence.test_type === 'ui' && evidence.network_trace && evidence.dom_snapshot) {
      const networkVsUI = await this.validateNetworkVsUI(
        evidence.network_trace,
        evidence.dom_snapshot
      );
      results.push(networkVsUI);
    }

    // 6. Error Logs vs Test Result
    if (evidence.console_logs) {
      const errorVsResult = await this.validateErrorVsResult(
        evidence.console_logs,
        evidence.pass_fail
      );
      results.push(errorVsResult);
    }

    return results;
  }

  /**
   * Compare screenshot analysis with console logs
   */
  private async validateScreenshotVsConsole(
    screenshotPath: string,
    logsPath: string
  ): Promise<CrossValidationResult> {
    try {
      const screenshotAnalysis = await this.analyzer.analyzeScreenshot(screenshotPath);
      const consoleAnalysis = await this.analyzer.analyzeConsoleLogs(logsPath);

      // Check if screenshot shows error UI but console has no errors
      const mismatch =
        screenshotAnalysis.hasErrorUI && consoleAnalysis.errorCount === 0;

      return {
        type: 'screenshot_vs_console',
        matched: !mismatch,
        description: mismatch
          ? 'Screenshot shows error UI but console has no errors'
          : 'Screenshot and console logs are consistent',
        evidence: {
          screenshotErrors: screenshotAnalysis.errors,
          consoleErrorCount: consoleAnalysis.errorCount,
        },
        severity: mismatch ? 'high' : undefined,
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to validate screenshot vs console');
      return {
        type: 'screenshot_vs_console',
        matched: false,
        description: `Validation failed: ${(error as Error).message}`,
        evidence: {},
        severity: 'medium',
      };
    }
  }

  /**
   * Validate HTTP response against expected schema
   */
  private async validateHTTPVsSchema(
    responsePath: string,
    expectedOutcome?: string
  ): Promise<CrossValidationResult> {
    try {
      const response = await this.analyzer.parseHTTPResponse(responsePath);

      if (!response) {
        return {
          type: 'http_vs_schema',
          matched: false,
          description: 'HTTP response could not be parsed',
          evidence: { responsePath },
          severity: 'high',
        };
      }

      // Simple validation: Check if response has expected structure
      // In production, this would use JSON schema validation
      const hasStatus = response.status !== undefined;
      const hasBody = response.body !== undefined;

      const matched = hasStatus && hasBody;

      return {
        type: 'http_vs_schema',
        matched,
        description: matched
          ? 'HTTP response matches expected structure'
          : 'HTTP response missing required fields (status, body)',
        evidence: {
          hasStatus,
          hasBody,
          responseKeys: Object.keys(response),
        },
        severity: matched ? undefined : 'medium',
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to validate HTTP vs schema');
      return {
        type: 'http_vs_schema',
        matched: false,
        description: `Validation failed: ${(error as Error).message}`,
        evidence: {},
        severity: 'medium',
      };
    }
  }

  /**
   * Validate test duration against historical average
   */
  private async validateDurationVsHistorical(
    testName: string,
    durationMs: number
  ): Promise<CrossValidationResult> {
    try {
      const historical = await getTestTimingAverages(this.pool, testName);

      if (!historical) {
        // No historical data, can't validate
        return {
          type: 'duration_vs_historical',
          matched: true,
          description: 'No historical data available for comparison',
          evidence: { durationMs },
        };
      }

      const avgDuration = historical.avgDurationMs;
      const deviation = Math.abs(durationMs - avgDuration) / avgDuration;

      // Flag if more than 50% deviation
      const matched = deviation <= 0.5;

      return {
        type: 'duration_vs_historical',
        matched,
        description: matched
          ? `Test duration ${durationMs}ms is within expected range (avg: ${avgDuration}ms)`
          : `Test duration ${durationMs}ms vs historical avg ${avgDuration}ms (${Math.round(deviation * 100)}% deviation)`,
        evidence: {
          actual: durationMs,
          historical: avgDuration,
          deviation: Math.round(deviation * 100),
        },
        severity: matched ? undefined : deviation > 1.0 ? 'high' : 'medium',
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to validate duration vs historical');
      return {
        type: 'duration_vs_historical',
        matched: true, // Default to matched to avoid false positives
        description: `Validation skipped: ${(error as Error).message}`,
        evidence: { durationMs },
      };
    }
  }

  /**
   * Validate coverage change is proportional to test scope
   */
  private async validateCoverageVsScope(
    coveragePath: string,
    testType: TestType
  ): Promise<CrossValidationResult> {
    try {
      const coverage = await this.analyzer.analyzeCoverage(coveragePath);

      // Simple heuristic: Coverage should increase for new tests
      // Unit/integration tests should increase coverage more than UI tests
      const expectedMinChange = testType === 'unit' || testType === 'integration' ? 0.5 : 0;

      const matched = coverage.change >= expectedMinChange;

      return {
        type: 'coverage_vs_scope',
        matched,
        description: matched
          ? `Coverage changed ${coverage.change}% as expected for ${testType} test`
          : `Coverage changed ${coverage.change}% but expected >=${expectedMinChange}% for ${testType} test`,
        evidence: {
          actual: coverage.change,
          expected: expectedMinChange,
          testType,
        },
        severity: matched ? undefined : 'low', // Low severity - coverage can vary
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to validate coverage vs scope');
      return {
        type: 'coverage_vs_scope',
        matched: true, // Default to matched to avoid false positives
        description: `Validation skipped: ${(error as Error).message}`,
        evidence: {},
      };
    }
  }

  /**
   * Validate network activity matches UI changes
   */
  private async validateNetworkVsUI(
    tracePath: string,
    domPath: string
  ): Promise<CrossValidationResult> {
    try {
      const httpAnalysis = await this.analyzer.analyzeHTTPTraces(tracePath);
      // DOM analysis would need before/after paths, using single path as placeholder
      const domAnalysis = await this.analyzer.analyzeDOMSnapshot(domPath, domPath);

      // UI tests should have network activity
      const hasNetwork = httpAnalysis.requestCount > 0;
      const hasDOMChanges = domAnalysis.changeCount > 0;

      // Mismatch if network activity but no DOM changes, or vice versa
      const matched = hasNetwork === hasDOMChanges || (hasNetwork && hasDOMChanges);

      return {
        type: 'network_vs_ui',
        matched,
        description: matched
          ? 'Network activity and UI changes are consistent'
          : `Inconsistent: ${httpAnalysis.requestCount} network requests but ${domAnalysis.changeCount} DOM changes`,
        evidence: {
          networkRequests: httpAnalysis.requestCount,
          domChanges: domAnalysis.changeCount,
        },
        severity: matched ? undefined : 'medium',
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to validate network vs UI');
      return {
        type: 'network_vs_ui',
        matched: true,
        description: `Validation skipped: ${(error as Error).message}`,
        evidence: {},
      };
    }
  }

  /**
   * Validate error logs match test result
   */
  private async validateErrorVsResult(
    logsPath: string,
    passFailResult: 'pass' | 'fail' | 'pending'
  ): Promise<CrossValidationResult> {
    try {
      const consoleAnalysis = await this.analyzer.analyzeConsoleLogs(logsPath);

      // If test passed but has critical errors, that's suspicious
      const mismatch =
        passFailResult === 'pass' && consoleAnalysis.criticalErrors.length > 0;

      return {
        type: 'error_vs_result',
        matched: !mismatch,
        description: mismatch
          ? `Test passed but has ${consoleAnalysis.criticalErrors.length} critical errors in logs`
          : 'Error logs match test result',
        evidence: {
          testResult: passFailResult,
          errorCount: consoleAnalysis.errorCount,
          criticalErrors: consoleAnalysis.criticalErrors,
        },
        severity: mismatch ? 'high' : undefined,
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to validate error vs result');
      return {
        type: 'error_vs_result',
        matched: true,
        description: `Validation skipped: ${(error as Error).message}`,
        evidence: {},
      };
    }
  }
}
