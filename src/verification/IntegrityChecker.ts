/**
 * Integrity Checker
 * Verifies evidence artifacts are complete, valid, and trustworthy
 * Epic 006-E: Independent Verification Agent
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { Logger } from 'pino';
import {
  IntegrityCheckResult,
  FileIntegrityCheck,
} from '../types/verification.js';
import { EvidenceArtifact, TestType } from '../types/evidence.js';

export class IntegrityChecker {
  constructor(
    private artifactDir: string,
    private logger: Logger
  ) {}

  /**
   * Check integrity of all evidence artifacts for a test
   */
  async check(evidence: EvidenceArtifact): Promise<IntegrityCheckResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Check that all expected files exist
    const filesExist = await this.checkFilesExist(evidence, errors, warnings);

    // 2. Check that timestamps are sequential
    const timestampsSequential = await this.checkTimestampsSequential(
      evidence,
      errors,
      warnings
    );

    // 3. Check that file sizes are reasonable
    const sizesReasonable = await this.checkFileSizes(evidence, errors, warnings);

    // 4. Check that file formats are correct
    const formatsCorrect = await this.checkFileFormats(evidence, errors, warnings);

    const passed = filesExist && timestampsSequential && sizesReasonable && formatsCorrect;

    return {
      passed,
      checks: {
        filesExist,
        timestampsSequential,
        sizesReasonable,
        formatsCorrect,
      },
      errors,
      warnings,
    };
  }

  /**
   * Check that all expected artifact files exist on disk
   */
  private async checkFilesExist(
    evidence: EvidenceArtifact,
    errors: string[],
    warnings: string[]
  ): Promise<boolean> {
    const expectedArtifacts = this.getExpectedArtifacts(evidence.test_type);
    let allExist = true;

    for (const artifact of expectedArtifacts) {
      const path = evidence[artifact as keyof EvidenceArtifact] as string | undefined;

      if (!path) {
        errors.push(`Missing artifact path: ${artifact}`);
        allExist = false;
        continue;
      }

      const fullPath = join(this.artifactDir, path);
      const exists = await this.fileExists(fullPath);

      if (!exists) {
        errors.push(`Artifact file does not exist: ${path}`);
        allExist = false;
      }
    }

    return allExist;
  }

  /**
   * Check that artifact timestamps are sequential (no time travel)
   */
  private async checkTimestampsSequential(
    evidence: EvidenceArtifact,
    errors: string[],
    warnings: string[]
  ): Promise<boolean> {
    const artifacts = await this.getArtifactTimestamps(evidence);

    if (artifacts.length < 2) {
      // Need at least 2 artifacts to check sequence
      return true;
    }

    // Sort by expected sequence (before -> action -> after)
    const sortedArtifacts = this.sortArtifactsByExpectedSequence(artifacts);

    let sequential = true;

    for (let i = 1; i < sortedArtifacts.length; i++) {
      const prev = sortedArtifacts[i - 1];
      const current = sortedArtifacts[i];

      if (current.timestamp && prev.timestamp) {
        if (current.timestamp < prev.timestamp) {
          errors.push(
            `Timestamp out of sequence: ${current.path} (${current.timestamp.toISOString()}) ` +
              `is before ${prev.path} (${prev.timestamp.toISOString()})`
          );
          sequential = false;
        }

        // Warning if timestamps are too close together (< 10ms)
        const timeDiff = current.timestamp.getTime() - prev.timestamp.getTime();
        if (timeDiff < 10) {
          warnings.push(
            `Timestamps very close together (<10ms): ${prev.path} and ${current.path}`
          );
        }
      }
    }

    return sequential;
  }

  /**
   * Check that file sizes are reasonable (not empty, not corrupted)
   */
  private async checkFileSizes(
    evidence: EvidenceArtifact,
    errors: string[],
    warnings: string[]
  ): Promise<boolean> {
    let reasonable = true;

    // UI test: Screenshots should be 10KB - 5MB
    if (evidence.screenshot_before) {
      const size = await this.getFileSize(evidence.screenshot_before);
      if (size !== null) {
        if (size < 10 * 1024) {
          errors.push(
            `Screenshot before is too small (${size} bytes) - likely corrupted`
          );
          reasonable = false;
        } else if (size > 5 * 1024 * 1024) {
          warnings.push(
            `Screenshot before is very large (${size} bytes) - may indicate issue`
          );
        }
      }
    }

    if (evidence.screenshot_after) {
      const size = await this.getFileSize(evidence.screenshot_after);
      if (size !== null) {
        if (size < 10 * 1024) {
          errors.push(`Screenshot after is too small (${size} bytes) - likely corrupted`);
          reasonable = false;
        } else if (size > 5 * 1024 * 1024) {
          warnings.push(
            `Screenshot after is very large (${size} bytes) - may indicate issue`
          );
        }
      }
    }

    // JSON files (logs, traces, HTTP) should be > 10 bytes
    const jsonFiles = [
      evidence.console_logs,
      evidence.network_trace,
      evidence.http_request,
      evidence.http_response,
      evidence.coverage_report,
    ];

    for (const jsonFile of jsonFiles) {
      if (jsonFile) {
        const size = await this.getFileSize(jsonFile);
        if (size !== null && size < 10) {
          errors.push(`JSON file is too small (${size} bytes): ${jsonFile}`);
          reasonable = false;
        }
      }
    }

    // DOM snapshots should be > 100 bytes
    if (evidence.dom_snapshot) {
      const size = await this.getFileSize(evidence.dom_snapshot);
      if (size !== null && size < 100) {
        errors.push(`DOM snapshot is too small (${size} bytes) - likely invalid`);
        reasonable = false;
      }
    }

    return reasonable;
  }

  /**
   * Check that file formats are correct
   */
  private async checkFileFormats(
    evidence: EvidenceArtifact,
    errors: string[],
    warnings: string[]
  ): Promise<boolean> {
    let correct = true;

    // Screenshots should be PNG or JPEG
    if (evidence.screenshot_before) {
      if (
        !evidence.screenshot_before.endsWith('.png') &&
        !evidence.screenshot_before.endsWith('.jpg') &&
        !evidence.screenshot_before.endsWith('.jpeg')
      ) {
        errors.push(
          `Screenshot before has invalid format: ${evidence.screenshot_before}`
        );
        correct = false;
      }
    }

    if (evidence.screenshot_after) {
      if (
        !evidence.screenshot_after.endsWith('.png') &&
        !evidence.screenshot_after.endsWith('.jpg') &&
        !evidence.screenshot_after.endsWith('.jpeg')
      ) {
        errors.push(
          `Screenshot after has invalid format: ${evidence.screenshot_after}`
        );
        correct = false;
      }
    }

    // JSON files should have .json extension
    const jsonFiles = [
      { path: evidence.console_logs, name: 'console_logs' },
      { path: evidence.network_trace, name: 'network_trace' },
      { path: evidence.http_request, name: 'http_request' },
      { path: evidence.http_response, name: 'http_response' },
      { path: evidence.coverage_report, name: 'coverage_report' },
    ];

    for (const jsonFile of jsonFiles) {
      if (jsonFile.path && !jsonFile.path.endsWith('.json')) {
        errors.push(`${jsonFile.name} should be JSON format: ${jsonFile.path}`);
        correct = false;
      }
    }

    // HTML files should have .html extension
    if (evidence.dom_snapshot && !evidence.dom_snapshot.endsWith('.html')) {
      warnings.push(`DOM snapshot should be HTML format: ${evidence.dom_snapshot}`);
    }

    return correct;
  }

  /**
   * Get expected artifacts for a test type
   */
  private getExpectedArtifacts(testType: TestType): string[] {
    switch (testType) {
      case 'ui':
        return ['screenshot_before', 'screenshot_after', 'console_logs'];
      case 'api':
        return ['http_request', 'http_response'];
      case 'unit':
      case 'integration':
        return ['coverage_report']; // Minimal for unit tests
      default:
        return [];
    }
  }

  /**
   * Get artifact timestamps from file metadata
   */
  private async getArtifactTimestamps(
    evidence: EvidenceArtifact
  ): Promise<FileIntegrityCheck[]> {
    const artifacts: FileIntegrityCheck[] = [];

    const paths = [
      { path: evidence.screenshot_before, name: 'screenshot_before' },
      { path: evidence.screenshot_after, name: 'screenshot_after' },
      { path: evidence.dom_snapshot, name: 'dom_snapshot' },
      { path: evidence.console_logs, name: 'console_logs' },
      { path: evidence.network_trace, name: 'network_trace' },
      { path: evidence.http_request, name: 'http_request' },
      { path: evidence.http_response, name: 'http_response' },
      { path: evidence.coverage_report, name: 'coverage_report' },
    ];

    for (const { path, name } of paths) {
      if (path) {
        const fullPath = join(this.artifactDir, path);
        const timestamp = await this.getFileTimestamp(fullPath);
        const size = await this.getFileSize(path);

        artifacts.push({
          path: name,
          exists: timestamp !== null,
          size: size || undefined,
          timestamp: timestamp || undefined,
        });
      }
    }

    return artifacts;
  }

  /**
   * Sort artifacts by expected sequence (before -> action -> after)
   */
  private sortArtifactsByExpectedSequence(
    artifacts: FileIntegrityCheck[]
  ): FileIntegrityCheck[] {
    const order = [
      'screenshot_before',
      'dom_snapshot',
      'http_request',
      'network_trace',
      'console_logs',
      'http_response',
      'screenshot_after',
      'coverage_report',
    ];

    return artifacts.sort((a, b) => {
      const aIndex = order.indexOf(a.path);
      const bIndex = order.indexOf(b.path);
      return aIndex - bIndex;
    });
  }

  /**
   * Check if file exists
   */
  private async fileExists(fullPath: string): Promise<boolean> {
    try {
      await fs.stat(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file size in bytes
   */
  private async getFileSize(relativePath: string): Promise<number | null> {
    try {
      const fullPath = join(this.artifactDir, relativePath);
      const stats = await fs.stat(fullPath);
      return stats.size;
    } catch (error) {
      this.logger.debug({ error, path: relativePath }, 'Failed to get file size');
      return null;
    }
  }

  /**
   * Get file timestamp (mtime)
   */
  private async getFileTimestamp(fullPath: string): Promise<Date | null> {
    try {
      const stats = await fs.stat(fullPath);
      return stats.mtime;
    } catch (error) {
      this.logger.debug({ error, path: fullPath }, 'Failed to get file timestamp');
      return null;
    }
  }
}
