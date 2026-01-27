/**
 * Unit/Integration Test Evidence Collector
 * Collects evidence for unit and integration test execution:
 * - Test framework output (Jest, Mocha, etc.)
 * - Coverage reports
 * - Assertion details
 * - Stack traces
 */

import { Logger } from 'pino';
import {
  EvidenceCollectorConfig,
  UnitTestEvidence,
  TestFrameworkOutput,
  CoverageReport,
  AssertionLog,
  TestFailureInfo,
  TestType,
  EvidenceCollectionError,
} from '../types/evidence.js';
import { EvidenceCollector } from './EvidenceCollector.js';

export class UnitTestEvidenceCollector extends EvidenceCollector {
  constructor(config: EvidenceCollectorConfig, logger: Logger) {
    super(config, logger);
  }

  /**
   * Collect unit test evidence
   * @param evidence UnitTestEvidence containing all collected data
   * @returns Object containing paths to all saved artifacts
   */
  async collectUnitTestEvidence(evidence: UnitTestEvidence): Promise<{
    frameworkOutput: string;
    coverage?: string;
    assertions: string;
    failures?: string;
    evidence: string;
  }> {
    const startTime = Date.now();
    const testType: TestType = 'unit';
    const timestamp = new Date();

    try {
      this.logger.info(
        {
          testId: evidence.testId,
          testName: evidence.testName,
          suite: evidence.testSuite,
        },
        'Starting unit test evidence collection'
      );

      // Create evidence directory
      const evidenceDir = await this.createEvidenceDirectory(testType, timestamp);

      // Save test framework output
      const frameworkPath = await this.saveJsonArtifact(
        evidenceDir,
        'test-framework-output.json',
        {
          framework: evidence.frameworkOutput.framework,
          totalTests: evidence.frameworkOutput.totalTests,
          passedTests: evidence.frameworkOutput.passedTests,
          failedTests: evidence.frameworkOutput.failedTests,
          skippedTests: evidence.frameworkOutput.skippedTests,
          duration: evidence.frameworkOutput.duration,
          reportPath: evidence.frameworkOutput.reportPath,
          timestamp: new Date().toISOString(),
        },
        testType,
        timestamp
      );

      // Save coverage report if available
      let coveragePath: string | undefined;
      if (evidence.coverage) {
        coveragePath = await this.saveJsonArtifact(
          evidenceDir,
          'coverage-report.json',
          {
            linePercentage: evidence.coverage.linePercentage,
            branchPercentage: evidence.coverage.branchPercentage,
            functionPercentage: evidence.coverage.functionPercentage,
            statementPercentage: evidence.coverage.statementPercentage,
            reportPath: evidence.coverage.reportPath,
            timestamp: new Date().toISOString(),
          },
          testType,
          timestamp
        );
      }

      // Save assertion logs
      const assertionsPath = await this.saveJsonArtifact(
        evidenceDir,
        'assertions.json',
        {
          totalAssertions: evidence.assertions.length,
          passed: evidence.assertions.filter((a) => a.passed).length,
          failed: evidence.assertions.filter((a) => !a.passed).length,
          assertions: evidence.assertions,
          timestamp: new Date().toISOString(),
        },
        testType,
        timestamp
      );

      // Save failure details if any
      let failurePath: string | undefined;
      if (evidence.failures && evidence.failures.length > 0) {
        failurePath = await this.saveJsonArtifact(
          evidenceDir,
          'failures.json',
          {
            totalFailures: evidence.failures.length,
            failures: evidence.failures,
            timestamp: new Date().toISOString(),
          },
          testType,
          timestamp
        );
      }

      // Save comprehensive evidence
      const evidencePath = await this.saveJsonArtifact(
        evidenceDir,
        'unit-test-evidence.json',
        {
          testId: evidence.testId,
          testName: evidence.testName,
          testSuite: evidence.testSuite,
          passFail: evidence.passFail,
          durationMs: evidence.durationMs,
          errorMessage: evidence.errorMessage,
          frameworkOutput: {
            framework: evidence.frameworkOutput.framework,
            totalTests: evidence.frameworkOutput.totalTests,
            passedTests: evidence.frameworkOutput.passedTests,
            failedTests: evidence.frameworkOutput.failedTests,
            skippedTests: evidence.frameworkOutput.skippedTests,
            duration: evidence.frameworkOutput.duration,
          },
          coverage: evidence.coverage
            ? {
                linePercentage: evidence.coverage.linePercentage,
                branchPercentage: evidence.coverage.branchPercentage,
                functionPercentage: evidence.coverage.functionPercentage,
                statementPercentage: evidence.coverage.statementPercentage,
              }
            : null,
          assertions: {
            total: evidence.assertions.length,
            passed: evidence.assertions.filter((a) => a.passed).length,
            failed: evidence.assertions.filter((a) => !a.passed).length,
          },
          failures: evidence.failures
            ? {
                count: evidence.failures.length,
                details: evidence.failures,
              }
            : null,
          timestamp: new Date().toISOString(),
        },
        testType,
        timestamp
      );

      // Verify critical artifacts
      const criticalArtifacts = [frameworkPath, assertionsPath, evidencePath];
      for (const artifact of criticalArtifacts) {
        const exists = await this.verifyArtifact(artifact);
        if (!exists) {
          throw new EvidenceCollectionError(
            `Failed to verify artifact: ${artifact}`,
            evidence.testId,
            testType
          );
        }
      }

      this.logger.info(
        {
          testId: evidence.testId,
          duration: Date.now() - startTime,
          artifacts: {
            frameworkOutput: 'saved',
            coverage: coveragePath ? 'saved' : 'none',
            assertions: 'saved',
            failures: failurePath ? 'saved' : 'none',
            evidence: 'saved',
          },
        },
        'Unit test evidence collection completed'
      );

      // Return paths for storage in database
      return {
        frameworkOutput: frameworkPath,
        coverage: coveragePath,
        assertions: assertionsPath,
        failures: failurePath,
        evidence: evidencePath,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        { testId: evidence.testId, error: errorMsg },
        'Unit test evidence collection failed'
      );

      throw new EvidenceCollectionError(
        `Failed to collect unit test evidence: ${errorMsg}`,
        evidence.testId,
        testType
      );
    }
  }

  /**
   * Parse Jest test output (JSON format)
   */
  async parseJestOutput(jestJsonPath: string): Promise<TestFrameworkOutput> {
    // This would read and parse the Jest JSON output file
    // Implementation depends on Jest's JSON reporter format
    return {
      framework: 'jest',
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      duration: 0,
      reportPath: jestJsonPath,
    };
  }

  /**
   * Parse Mocha test output
   */
  async parseMochaOutput(mochaJsonPath: string): Promise<TestFrameworkOutput> {
    // This would read and parse the Mocha JSON output file
    return {
      framework: 'mocha',
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      duration: 0,
      reportPath: mochaJsonPath,
    };
  }

  /**
   * Parse coverage report (LCOV format)
   */
  async parseCoverageReport(coverageJsonPath: string): Promise<CoverageReport> {
    // This would read and parse the coverage report
    return {
      linePercentage: 0,
      branchPercentage: 0,
      functionPercentage: 0,
      statementPercentage: 0,
      reportPath: coverageJsonPath,
    };
  }

  /**
   * Extract assertion details from test execution
   */
  async extractAssertionLogs(testOutput: any): Promise<AssertionLog[]> {
    // This would parse test output and extract assertion details
    return [];
  }

  /**
   * Extract stack traces from failures
   */
  async extractStackTraces(failures: any[]): Promise<TestFailureInfo[]> {
    // This would extract stack traces and failure info
    return [];
  }

  /**
   * Implementation of abstract collect() method
   * Not used directly - use collectUnitTestEvidence() instead
   */
  async collect(): Promise<void> {
    // Unit tests use collectUnitTestEvidence() explicitly
  }
}
