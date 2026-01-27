/**
 * Inconsistent Evidence Detector
 * Epic 006-B: Detect when evidence contradicts test results
 *
 * HIGH severity: Evidence shows failure but test reported pass
 */

import { Pool } from 'pg';
import { promises as fs } from 'fs';
import { CreateRedFlagInput, TestType, RedFlagProof } from '../types/red-flags.js';
import { EvidenceArtifact, TestResult } from './MissingEvidenceDetector.js';

/**
 * Error patterns to detect in screenshots and logs
 */
const ERROR_PATTERNS = [
  /error/i,
  /exception/i,
  /failed/i,
  /failure/i,
  /fatal/i,
  /critical/i,
  /stack trace/i,
  /traceback/i,
  /\d{3} error/i, // HTTP error codes
  /4\d{2}\s/,     // 4xx errors
  /5\d{2}\s/,     // 5xx errors
  /uncaught/i,
  /unhandled/i,
  /refused/i,
  /timeout/i,
  /cannot/i,
  /unable to/i,
  /not found/i,
];

/**
 * Expected error patterns (don't flag these)
 */
const EXPECTED_ERROR_PATTERNS = [
  /test.*error.*handling/i,
  /expected.*error/i,
  /should.*fail/i,
  /expect.*throw/i,
];

/**
 * Detect inconsistent evidence that contradicts test results
 */
export class InconsistentEvidenceDetector {
  constructor(private pool: Pool) {}

  /**
   * Detect inconsistencies for a test
   */
  async detect(
    epicId: string,
    test: TestResult,
    evidence: EvidenceArtifact[]
  ): Promise<CreateRedFlagInput[]> {
    const flags: CreateRedFlagInput[] = [];

    // Only check tests that passed (we're looking for false passes)
    if (test.passFail !== 'pass') {
      return flags;
    }

    // Check screenshot for errors
    const screenshotAfter = evidence.find((e) => e.artifactType === 'screenshot_after');
    if (screenshotAfter) {
      const screenshotFlag = await this.checkScreenshotForErrors(epicId, test, screenshotAfter);
      if (screenshotFlag) flags.push(screenshotFlag);
    }

    // Check HTTP response for error status codes
    const httpResponse = evidence.find((e) => e.artifactType === 'http_response');
    if (httpResponse) {
      const httpFlag = await this.checkHttpResponseForErrors(epicId, test, httpResponse);
      if (httpFlag) flags.push(httpFlag);
    }

    // Check console logs for errors
    const consoleLog = evidence.find((e) => e.artifactType === 'console_log');
    if (consoleLog) {
      const consoleFlag = await this.checkConsoleForErrors(epicId, test, consoleLog);
      if (consoleFlag) flags.push(consoleFlag);
    }

    // Check DOM snapshot for missing expected elements
    const domSnapshot = evidence.find((e) => e.artifactType === 'dom_snapshot');
    if (domSnapshot && test.type === 'ui') {
      const domFlag = await this.checkDomForMissingElements(epicId, test, domSnapshot);
      if (domFlag) flags.push(domFlag);
    }

    return flags;
  }

  /**
   * Check screenshot for error messages
   */
  private async checkScreenshotForErrors(
    epicId: string,
    test: TestResult,
    screenshot: EvidenceArtifact
  ): Promise<CreateRedFlagInput | null> {
    try {
      // For now, use simple pattern matching on screenshot metadata
      // In future, could use OCR for actual image text extraction
      const metadata = screenshot.metadata || {};

      // Check if screenshot path indicates error
      const path = screenshot.artifactPath.toLowerCase();
      if (
        path.includes('error') ||
        path.includes('fail') ||
        path.includes('exception')
      ) {
        // Check if this is an expected error test
        if (this.isExpectedErrorTest(test.name)) {
          return null;
        }

        const proof: RedFlagProof = {
          testId: test.id,
          testType: test.type,
          screenshot: screenshot.artifactPath,
          detectedError: 'Screenshot filename indicates error state',
          testResult: 'pass',
          timestamp: test.executedAt.toISOString(),
        };

        return {
          epicId,
          testId: test.id,
          evidenceId: screenshot.id,
          flagType: 'inconsistent',
          severity: 'high',
          description: `Test "${test.name}" passed but screenshot indicates error state`,
          proof,
        };
      }

      // Check metadata for error indicators
      if (metadata.containsError || metadata.errorText) {
        if (this.isExpectedErrorTest(test.name)) {
          return null;
        }

        const proof: RedFlagProof = {
          testId: test.id,
          testType: test.type,
          screenshot: screenshot.artifactPath,
          detectedError: metadata.errorText || 'Error detected in screenshot',
          testResult: 'pass',
          timestamp: test.executedAt.toISOString(),
        };

        return {
          epicId,
          testId: test.id,
          evidenceId: screenshot.id,
          flagType: 'inconsistent',
          severity: 'high',
          description: `Test "${test.name}" passed but screenshot shows error: ${metadata.errorText}`,
          proof,
        };
      }

      return null;
    } catch (error) {
      console.error('Error checking screenshot:', error);
      return null;
    }
  }

  /**
   * Check HTTP response for error status codes
   */
  private async checkHttpResponseForErrors(
    epicId: string,
    test: TestResult,
    httpResponse: EvidenceArtifact
  ): Promise<CreateRedFlagInput | null> {
    try {
      const metadata = httpResponse.metadata || {};
      const statusCode = metadata.statusCode || metadata.status;

      if (statusCode >= 400) {
        // Check if this is an expected error test
        if (this.isExpectedErrorTest(test.name)) {
          return null;
        }

        // Read response body if available
        let responseBody = metadata.body || '';
        if (!responseBody && httpResponse.artifactPath) {
          try {
            const content = await fs.readFile(httpResponse.artifactPath, 'utf-8');
            responseBody = content.substring(0, 500); // First 500 chars
          } catch {
            // Ignore read errors
          }
        }

        const proof: RedFlagProof = {
          testId: test.id,
          testType: test.type,
          httpStatus: statusCode,
          httpResponse: responseBody,
          testResult: 'pass',
          timestamp: test.executedAt.toISOString(),
        };

        return {
          epicId,
          testId: test.id,
          evidenceId: httpResponse.id,
          flagType: 'inconsistent',
          severity: 'high',
          description: `Test "${test.name}" passed but HTTP response was ${statusCode}`,
          proof,
        };
      }

      return null;
    } catch (error) {
      console.error('Error checking HTTP response:', error);
      return null;
    }
  }

  /**
   * Check console logs for errors
   */
  private async checkConsoleForErrors(
    epicId: string,
    test: TestResult,
    consoleLog: EvidenceArtifact
  ): Promise<CreateRedFlagInput | null> {
    try {
      // Read console log content
      let content = '';
      if (consoleLog.artifactPath) {
        try {
          content = await fs.readFile(consoleLog.artifactPath, 'utf-8');
        } catch {
          // If can't read file, check metadata
          content = consoleLog.metadata?.content || '';
        }
      }

      if (!content) {
        return null;
      }

      // Check if this is an expected error test
      if (this.isExpectedErrorTest(test.name)) {
        return null;
      }

      // Look for error patterns
      const errors: string[] = [];
      const lines = content.split('\n');

      for (const line of lines) {
        // Skip expected error patterns
        if (EXPECTED_ERROR_PATTERNS.some((pattern) => pattern.test(line))) {
          continue;
        }

        // Check for error patterns
        if (ERROR_PATTERNS.some((pattern) => pattern.test(line))) {
          errors.push(line.trim().substring(0, 200));
        }
      }

      if (errors.length > 0) {
        const proof: RedFlagProof = {
          testId: test.id,
          testType: test.type,
          consoleErrors: errors.slice(0, 5), // First 5 errors
          testResult: 'pass',
          timestamp: test.executedAt.toISOString(),
        };

        return {
          epicId,
          testId: test.id,
          evidenceId: consoleLog.id,
          flagType: 'inconsistent',
          severity: 'high',
          description: `Test "${test.name}" passed but console contains ${errors.length} error(s)`,
          proof,
        };
      }

      return null;
    } catch (error) {
      console.error('Error checking console logs:', error);
      return null;
    }
  }

  /**
   * Check DOM snapshot for missing expected elements
   */
  private async checkDomForMissingElements(
    epicId: string,
    test: TestResult,
    domSnapshot: EvidenceArtifact
  ): Promise<CreateRedFlagInput | null> {
    try {
      const metadata = domSnapshot.metadata || {};

      // Get expected elements from test metadata or metadata
      const expectedElements = metadata.expectedElements || [];
      if (expectedElements.length === 0) {
        return null; // No expectations defined
      }

      // Get actual elements found
      const actualElements = metadata.foundElements || [];

      // Find missing elements
      const missingElements = expectedElements.filter(
        (expected: string) => !actualElements.includes(expected)
      );

      if (missingElements.length > 0) {
        const proof: RedFlagProof = {
          testId: test.id,
          testType: 'ui',
          expectedElements,
          missingElements,
          testResult: 'pass',
          timestamp: test.executedAt.toISOString(),
        };

        return {
          epicId,
          testId: test.id,
          evidenceId: domSnapshot.id,
          flagType: 'inconsistent',
          severity: 'high',
          description: `Test "${test.name}" passed but DOM missing expected elements: ${missingElements.join(', ')}`,
          proof,
        };
      }

      return null;
    } catch (error) {
      console.error('Error checking DOM snapshot:', error);
      return null;
    }
  }

  /**
   * Check if test name indicates this is an expected error test
   */
  private isExpectedErrorTest(testName: string): boolean {
    return EXPECTED_ERROR_PATTERNS.some((pattern) => pattern.test(testName));
  }
}
