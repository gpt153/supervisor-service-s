/**
 * Missing Evidence Detector
 * Epic 006-B: Detect when required evidence artifacts are missing
 *
 * CRITICAL severity: Tests must have evidence to be trusted
 */

import { Pool } from 'pg';
import { CreateRedFlagInput, TestType, RedFlagProof } from '../types/red-flags.js';

/**
 * Evidence artifact interface
 */
export interface EvidenceArtifact {
  id: number;
  epicId: string;
  testId: string;
  artifactType: string;
  artifactPath: string;
  collectedAt: Date;
  metadata: Record<string, any>;
}

/**
 * Test result interface
 */
export interface TestResult {
  id: string;
  name: string;
  type: TestType;
  passFail: 'pass' | 'fail';
  executedAt: Date;
}

/**
 * Required artifacts by test type
 */
const REQUIRED_ARTIFACTS: Record<TestType, string[]> = {
  ui: ['screenshot_before', 'screenshot_after', 'console_log', 'dom_snapshot'],
  api: ['http_request', 'http_response', 'console_log'],
  unit: ['coverage_report', 'console_log', 'test_output'],
  integration: ['console_log', 'test_output', 'coverage_report'],
};

/**
 * Optional artifacts that don't trigger critical flags
 */
const OPTIONAL_ARTIFACTS: Record<TestType, string[]> = {
  ui: ['network_trace', 'performance_metrics'],
  api: ['network_trace', 'database_queries'],
  unit: ['memory_usage', 'cpu_usage'],
  integration: ['screenshot', 'network_trace'],
};

/**
 * Detect missing evidence artifacts for tests
 */
export class MissingEvidenceDetector {
  constructor(private pool: Pool) {}

  /**
   * Detect missing evidence for a test
   */
  async detect(
    epicId: string,
    test: TestResult,
    evidence: EvidenceArtifact[]
  ): Promise<CreateRedFlagInput[]> {
    const flags: CreateRedFlagInput[] = [];

    // Only check tests that passed (failures are expected to have limited evidence)
    if (test.passFail !== 'pass') {
      return flags;
    }

    const requiredArtifacts = REQUIRED_ARTIFACTS[test.type] || [];
    const actualArtifacts = evidence.map((e) => e.artifactType);

    // Check for missing required artifacts
    const missingArtifacts = requiredArtifacts.filter(
      (required) => !actualArtifacts.includes(required)
    );

    if (missingArtifacts.length > 0) {
      flags.push(this.createMissingArtifactsFlag(epicId, test, missingArtifacts, requiredArtifacts));
    }

    // Check for empty console logs (impossible if test actually ran)
    const consoleLog = evidence.find((e) => e.artifactType === 'console_log');
    if (consoleLog && this.isEmptyConsoleLog(consoleLog)) {
      flags.push(this.createEmptyConsoleLogFlag(epicId, test, consoleLog));
    }

    // UI-specific checks
    if (test.type === 'ui') {
      const screenshotBefore = evidence.find((e) => e.artifactType === 'screenshot_before');
      const screenshotAfter = evidence.find((e) => e.artifactType === 'screenshot_after');

      if (!screenshotBefore || !screenshotAfter) {
        flags.push(
          this.createMissingScreenshotsFlag(
            epicId,
            test,
            !screenshotBefore,
            !screenshotAfter,
            evidence[0]?.id
          )
        );
      }
    }

    // API-specific checks
    if (test.type === 'api') {
      const httpRequest = evidence.find((e) => e.artifactType === 'http_request');
      const httpResponse = evidence.find((e) => e.artifactType === 'http_response');

      if (!httpRequest || !httpResponse) {
        flags.push(
          this.createMissingHttpLogsFlag(
            epicId,
            test,
            !httpRequest,
            !httpResponse,
            evidence[0]?.id
          )
        );
      }
    }

    // Unit test-specific checks
    if (test.type === 'unit') {
      const coverageReport = evidence.find((e) => e.artifactType === 'coverage_report');

      if (!coverageReport) {
        flags.push(this.createMissingCoverageFlag(epicId, test, evidence[0]?.id));
      }
    }

    return flags;
  }

  /**
   * Create flag for missing artifacts
   */
  private createMissingArtifactsFlag(
    epicId: string,
    test: TestResult,
    missingArtifacts: string[],
    requiredArtifacts: string[]
  ): CreateRedFlagInput {
    const proof: RedFlagProof = {
      testId: test.id,
      testType: test.type,
      expectedArtifacts: requiredArtifacts,
      missingArtifacts,
      timestamp: test.executedAt.toISOString(),
    };

    return {
      epicId,
      testId: test.id,
      flagType: 'missing_evidence',
      severity: 'critical',
      description: `Test "${test.name}" passed but missing required evidence: ${missingArtifacts.join(', ')}`,
      proof,
    };
  }

  /**
   * Create flag for empty console log
   */
  private createEmptyConsoleLogFlag(
    epicId: string,
    test: TestResult,
    consoleLog: EvidenceArtifact
  ): CreateRedFlagInput {
    const proof: RedFlagProof = {
      testId: test.id,
      testType: test.type,
      missingArtifacts: ['console_output'],
      timestamp: test.executedAt.toISOString(),
    };

    return {
      epicId,
      testId: test.id,
      evidenceId: consoleLog.id,
      flagType: 'missing_evidence',
      severity: 'critical',
      description: `Test "${test.name}" passed but console log is empty (impossible if test ran)`,
      proof,
    };
  }

  /**
   * Create flag for missing screenshots
   */
  private createMissingScreenshotsFlag(
    epicId: string,
    test: TestResult,
    missingBefore: boolean,
    missingAfter: boolean,
    evidenceId?: number
  ): CreateRedFlagInput {
    const missing = [];
    if (missingBefore) missing.push('screenshot_before');
    if (missingAfter) missing.push('screenshot_after');

    const proof: RedFlagProof = {
      testId: test.id,
      testType: 'ui',
      expectedArtifacts: ['screenshot_before', 'screenshot_after'],
      missingArtifacts: missing,
      timestamp: test.executedAt.toISOString(),
    };

    return {
      epicId,
      testId: test.id,
      evidenceId,
      flagType: 'missing_evidence',
      severity: 'critical',
      description: `UI test "${test.name}" passed without ${missing.join(' and ')}`,
      proof,
    };
  }

  /**
   * Create flag for missing HTTP logs
   */
  private createMissingHttpLogsFlag(
    epicId: string,
    test: TestResult,
    missingRequest: boolean,
    missingResponse: boolean,
    evidenceId?: number
  ): CreateRedFlagInput {
    const missing = [];
    if (missingRequest) missing.push('http_request');
    if (missingResponse) missing.push('http_response');

    const proof: RedFlagProof = {
      testId: test.id,
      testType: 'api',
      expectedArtifacts: ['http_request', 'http_response'],
      missingArtifacts: missing,
      timestamp: test.executedAt.toISOString(),
    };

    return {
      epicId,
      testId: test.id,
      evidenceId,
      flagType: 'missing_evidence',
      severity: 'critical',
      description: `API test "${test.name}" passed without ${missing.join(' and ')}`,
      proof,
    };
  }

  /**
   * Create flag for missing coverage report
   */
  private createMissingCoverageFlag(
    epicId: string,
    test: TestResult,
    evidenceId?: number
  ): CreateRedFlagInput {
    const proof: RedFlagProof = {
      testId: test.id,
      testType: 'unit',
      expectedArtifacts: ['coverage_report'],
      missingArtifacts: ['coverage_report'],
      timestamp: test.executedAt.toISOString(),
    };

    return {
      epicId,
      testId: test.id,
      evidenceId,
      flagType: 'missing_evidence',
      severity: 'critical',
      description: `Unit test "${test.name}" passed without coverage report`,
      proof,
    };
  }

  /**
   * Check if console log is empty
   */
  private isEmptyConsoleLog(consoleLog: EvidenceArtifact): boolean {
    // Check file size if available
    if (consoleLog.metadata?.fileSize !== undefined) {
      return consoleLog.metadata.fileSize === 0;
    }

    // Check line count if available
    if (consoleLog.metadata?.lineCount !== undefined) {
      return consoleLog.metadata.lineCount === 0;
    }

    // Default to false if can't determine
    return false;
  }
}
