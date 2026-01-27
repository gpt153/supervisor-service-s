/**
 * Evidence Retriever
 * Provides API for querying and retrieving evidence artifacts
 * Supports filtering by epic, test type, status, and date range
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { Logger } from 'pino';
import { EvidenceStorage } from './EvidenceStorage.js';
import {
  EvidenceArtifact,
  EvidenceQueryOptions,
  EvidenceQueryResult,
  EvidenceRetrievalError,
  TestType,
  PassFailStatus,
} from '../types/evidence.js';

export class EvidenceRetriever {
  constructor(
    private storage: EvidenceStorage,
    private artifactDir: string,
    private logger: Logger
  ) {}

  /**
   * Query evidence by epic ID
   */
  async queryByEpicId(epicId: string, limit = 100, offset = 0): Promise<EvidenceQueryResult[]> {
    try {
      const artifacts = await this.storage.queryByEpicId(epicId, limit, offset);
      return this.buildQueryResults(artifacts);
    } catch (error) {
      throw new EvidenceRetrievalError(
        `Failed to query evidence by epic: ${(error as Error).message}`,
        { epicId }
      );
    }
  }

  /**
   * Query evidence by test type
   */
  async queryByTestType(testType: TestType, limit = 100, offset = 0): Promise<EvidenceQueryResult[]> {
    try {
      const artifacts = await this.storage.queryByTestType(testType, limit, offset);
      return this.buildQueryResults(artifacts);
    } catch (error) {
      throw new EvidenceRetrievalError(
        `Failed to query evidence by type: ${(error as Error).message}`,
        { testType }
      );
    }
  }

  /**
   * Query evidence by pass/fail status
   */
  async queryByStatus(passFail: PassFailStatus, limit = 100, offset = 0): Promise<EvidenceQueryResult[]> {
    try {
      const artifacts = await this.storage.queryByStatus(passFail, limit, offset);
      return this.buildQueryResults(artifacts);
    } catch (error) {
      throw new EvidenceRetrievalError(
        `Failed to query evidence by status: ${(error as Error).message}`,
        { passFail }
      );
    }
  }

  /**
   * Query evidence by date range
   */
  async queryByDateRange(
    startDate: Date,
    endDate: Date,
    limit = 100,
    offset = 0
  ): Promise<EvidenceQueryResult[]> {
    try {
      const artifacts = await this.storage.queryByDateRange(startDate, endDate, limit, offset);
      return this.buildQueryResults(artifacts);
    } catch (error) {
      throw new EvidenceRetrievalError(
        `Failed to query evidence by date range: ${(error as Error).message}`,
        { startDate, endDate }
      );
    }
  }

  /**
   * Complex query with multiple filters
   */
  async query(options: EvidenceQueryOptions): Promise<EvidenceQueryResult[]> {
    try {
      const artifacts = await this.storage.queryEvidence({
        epicId: options.epicId,
        testType: options.testType,
        passFail: options.passFail,
        startDate: options.startDate,
        endDate: options.endDate,
        limit: options.limit || 100,
        offset: options.offset || 0,
      });

      return this.buildQueryResults(artifacts);
    } catch (error) {
      throw new EvidenceRetrievalError(
        `Failed to query evidence: ${(error as Error).message}`,
        options
      );
    }
  }

  /**
   * Get artifact content by path
   */
  async getArtifactContent(relativeArtifactPath: string): Promise<string | Buffer | null> {
    try {
      const fullPath = join(this.artifactDir, relativeArtifactPath);

      // Security: prevent directory traversal
      if (!fullPath.startsWith(this.artifactDir)) {
        throw new Error('Invalid artifact path');
      }

      const content = await fs.readFile(fullPath);

      // Check if it's gzipped
      if (relativeArtifactPath.endsWith('.gz')) {
        const { gunzipSync } = await import('zlib');
        const decompressed = gunzipSync(content);
        return decompressed.toString('utf-8');
      }

      // Return as UTF-8 for text files
      if (
        relativeArtifactPath.endsWith('.json') ||
        relativeArtifactPath.endsWith('.html') ||
        relativeArtifactPath.endsWith('.txt')
      ) {
        return content.toString('utf-8');
      }

      // Return as buffer for binary files (images, etc.)
      return content;
    } catch (error) {
      this.logger.error(
        { error, path: relativeArtifactPath },
        'Failed to get artifact content'
      );
      return null;
    }
  }

  /**
   * Get all artifacts for a test
   */
  async getTestArtifacts(testId: string): Promise<EvidenceQueryResult[]> {
    try {
      const result = await this.storage.queryEvidence({ offset: 0, limit: 1000 });
      const testArtifacts = result.filter((a) => a.test_id === testId);
      return this.buildQueryResults(testArtifacts);
    } catch (error) {
      throw new EvidenceRetrievalError(
        `Failed to get test artifacts: ${(error as Error).message}`,
        {}
      );
    }
  }

  /**
   * Get summary statistics for epic
   */
  async getEpicSummary(epicId: string): Promise<{
    totalTests: number;
    passedTests: number;
    failedTests: number;
    pendingTests: number;
    passPercentage: number;
    averageDuration: number;
    testTypeBreakdown: Record<TestType, number>;
  }> {
    try {
      const stats = await this.storage.getEpicStatistics(epicId);

      const passPercentage =
        stats.totalTests > 0 ? (stats.passedTests / stats.totalTests) * 100 : 0;

      return {
        totalTests: stats.totalTests,
        passedTests: stats.passedTests,
        failedTests: stats.failedTests,
        pendingTests: stats.pendingTests,
        passPercentage: Math.round(passPercentage * 100) / 100,
        averageDuration: Math.round(stats.averageDuration),
        testTypeBreakdown: stats.testTypeBreakdown,
      };
    } catch (error) {
      this.logger.error({ error, epicId }, 'Failed to get epic summary');
      return {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        pendingTests: 0,
        passPercentage: 0,
        averageDuration: 0,
        testTypeBreakdown: { ui: 0, api: 0, unit: 0, integration: 0 },
      };
    }
  }

  /**
   * Export evidence to JSON
   */
  async exportAsJSON(options: EvidenceQueryOptions): Promise<string> {
    try {
      const results = await this.query(options);

      const exported = {
        export_date: new Date().toISOString(),
        query_options: options,
        result_count: results.length,
        results: results,
      };

      return JSON.stringify(exported, null, 2);
    } catch (error) {
      throw new EvidenceRetrievalError(
        `Failed to export evidence: ${(error as Error).message}`,
        options
      );
    }
  }

  /**
   * Build full query results with artifact paths
   */
  private buildQueryResults(artifacts: EvidenceArtifact[]): EvidenceQueryResult[] {
    return artifacts.map((artifact) => ({
      artifact,
      artifactPaths: {
        screenshotBefore: artifact.screenshot_before,
        screenshotAfter: artifact.screenshot_after,
        domSnapshot: artifact.dom_snapshot,
        consoleLogs: artifact.console_logs,
        networkTrace: artifact.network_trace,
        httpRequest: artifact.http_request,
        httpResponse: artifact.http_response,
        coverageReport: artifact.coverage_report,
      },
      metadata: {
        duration: artifact.duration_ms,
        error: artifact.error_message,
        timestamp: artifact.timestamp,
        testType: artifact.test_type,
        passFail: artifact.pass_fail,
      },
    }));
  }

  /**
   * Find evidence without artifacts (missing evidence)
   */
  async findMissingEvidence(epicId: string): Promise<EvidenceArtifact[]> {
    try {
      const artifacts = await this.storage.queryByEpicId(epicId, 1000, 0);

      // Filter for artifacts that should have files but don't
      const missing: EvidenceArtifact[] = [];

      for (const artifact of artifacts) {
        let hasMissingArtifact = false;

        // UI tests must have screenshots
        if (artifact.test_type === 'ui') {
          if (!artifact.screenshot_before || !artifact.screenshot_after) {
            hasMissingArtifact = true;
          } else {
            const beforeExists = await this.artifactExists(artifact.screenshot_before);
            const afterExists = await this.artifactExists(artifact.screenshot_after);

            if (!beforeExists || !afterExists) {
              hasMissingArtifact = true;
            }
          }
        }

        // API tests must have request/response
        if (artifact.test_type === 'api') {
          if (!artifact.http_request || !artifact.http_response) {
            hasMissingArtifact = true;
          }
        }

        // Unit tests must have framework output
        if (artifact.test_type === 'unit') {
          if (!artifact.screenshot_before) {
            // Using screenshot_before as placeholder for framework output
            hasMissingArtifact = true;
          }
        }

        if (hasMissingArtifact) {
          missing.push(artifact);
        }
      }

      return missing;
    } catch (error) {
      this.logger.error({ error, epicId }, 'Failed to find missing evidence');
      return [];
    }
  }

  /**
   * Check if artifact file exists
   */
  private async artifactExists(relativeArtifactPath: string): Promise<boolean> {
    try {
      const fullPath = join(this.artifactDir, relativeArtifactPath);
      await fs.stat(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}
