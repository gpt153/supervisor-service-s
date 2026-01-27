/**
 * Evidence Storage
 * Handles persistence of evidence artifacts to both file system and database
 * Manages file operations, database inserts, and cleanup policies
 */

import { Logger } from 'pino';
import { query } from '../db/client.js';
import {
  EvidenceArtifact,
  EvidenceStorageParams,
  TestType,
  PassFailStatus,
  ArtifactStorageError,
} from '../types/evidence.js';

export class EvidenceStorage {
  constructor(private logger: Logger) {}

  /**
   * Insert evidence artifact into database
   */
  async insertEvidence(params: EvidenceStorageParams & Record<string, any>): Promise<number> {
    try {
      const result = await query(
        `INSERT INTO evidence_artifacts (
          epic_id, test_id, test_type, test_name, expected_outcome, actual_outcome,
          pass_fail, screenshot_before, screenshot_after, dom_snapshot, console_logs,
          network_trace, http_request, http_response, coverage_report, duration_ms,
          error_message, stack_trace, timestamp
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW()
        ) RETURNING id`,
        [
          params.epicId,
          params.testId,
          params.testType,
          params.testName,
          params.expectedOutcome || null,
          params.actualOutcome || null,
          params.passFail,
          params.screenshotBefore || null,
          params.screenshotAfter || null,
          params.domSnapshot || null,
          params.consoleLogs || null,
          params.networkTrace || null,
          params.httpRequest || null,
          params.httpResponse || null,
          params.coverageReport || null,
          params.durationMs || null,
          params.errorMessage || null,
          params.stackTrace || null,
        ]
      );

      const evidenceId = result.rows[0].id;
      this.logger.debug({ evidenceId, testId: params.testId }, 'Evidence inserted');

      return evidenceId;
    } catch (error) {
      throw new ArtifactStorageError(
        `Failed to insert evidence: ${(error as Error).message}`,
        params.testId
      );
    }
  }

  /**
   * Update evidence artifact in database
   */
  async updateEvidence(evidenceId: number, updates: Partial<EvidenceStorageParams>): Promise<void> {
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      // Build dynamic UPDATE query
      if (updates.actualOutcome !== undefined) {
        fields.push(`actual_outcome = $${paramIndex++}`);
        values.push(updates.actualOutcome);
      }
      if (updates.passFail !== undefined) {
        fields.push(`pass_fail = $${paramIndex++}`);
        values.push(updates.passFail);
      }
      if (updates.durationMs !== undefined) {
        fields.push(`duration_ms = $${paramIndex++}`);
        values.push(updates.durationMs);
      }
      if (updates.errorMessage !== undefined) {
        fields.push(`error_message = $${paramIndex++}`);
        values.push(updates.errorMessage);
      }

      if (fields.length === 0) {
        return; // Nothing to update
      }

      fields.push(`updated_at = NOW()`);
      values.push(evidenceId);

      const sql = `UPDATE evidence_artifacts SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING id`;

      await query(sql, values);
      this.logger.debug({ evidenceId }, 'Evidence updated');
    } catch (error) {
      throw new ArtifactStorageError(
        `Failed to update evidence: ${(error as Error).message}`,
        String(evidenceId)
      );
    }
  }

  /**
   * Get evidence by ID
   */
  async getEvidenceById(evidenceId: number): Promise<EvidenceArtifact | null> {
    try {
      const result = await query('SELECT * FROM evidence_artifacts WHERE id = $1', [evidenceId]);

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0] as EvidenceArtifact;
    } catch (error) {
      this.logger.error({ error, evidenceId }, 'Failed to get evidence');
      return null;
    }
  }

  /**
   * Query evidence by epic ID
   */
  async queryByEpicId(epicId: string, limit = 100, offset = 0): Promise<EvidenceArtifact[]> {
    try {
      const result = await query(
        `SELECT * FROM evidence_artifacts WHERE epic_id = $1
         ORDER BY timestamp DESC LIMIT $2 OFFSET $3`,
        [epicId, limit, offset]
      );

      return result.rows as EvidenceArtifact[];
    } catch (error) {
      this.logger.error({ error, epicId }, 'Failed to query evidence by epic');
      return [];
    }
  }

  /**
   * Query evidence by test type
   */
  async queryByTestType(testType: TestType, limit = 100, offset = 0): Promise<EvidenceArtifact[]> {
    try {
      const result = await query(
        `SELECT * FROM evidence_artifacts WHERE test_type = $1
         ORDER BY timestamp DESC LIMIT $2 OFFSET $3`,
        [testType, limit, offset]
      );

      return result.rows as EvidenceArtifact[];
    } catch (error) {
      this.logger.error({ error, testType }, 'Failed to query evidence by type');
      return [];
    }
  }

  /**
   * Query evidence by pass/fail status
   */
  async queryByStatus(passFail: PassFailStatus, limit = 100, offset = 0): Promise<EvidenceArtifact[]> {
    try {
      const result = await query(
        `SELECT * FROM evidence_artifacts WHERE pass_fail = $1
         ORDER BY timestamp DESC LIMIT $2 OFFSET $3`,
        [passFail, limit, offset]
      );

      return result.rows as EvidenceArtifact[];
    } catch (error) {
      this.logger.error({ error, passFail }, 'Failed to query evidence by status');
      return [];
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
  ): Promise<EvidenceArtifact[]> {
    try {
      const result = await query(
        `SELECT * FROM evidence_artifacts
         WHERE timestamp >= $1 AND timestamp <= $2
         ORDER BY timestamp DESC LIMIT $3 OFFSET $4`,
        [startDate, endDate, limit, offset]
      );

      return result.rows as EvidenceArtifact[];
    } catch (error) {
      this.logger.error({ error, startDate, endDate }, 'Failed to query evidence by date range');
      return [];
    }
  }

  /**
   * Complex query with multiple filters
   */
  async queryEvidence(filters: {
    epicId?: string;
    testType?: TestType;
    passFail?: PassFailStatus;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<EvidenceArtifact[]> {
    try {
      const conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (filters.epicId) {
        conditions.push(`epic_id = $${paramIndex++}`);
        values.push(filters.epicId);
      }
      if (filters.testType) {
        conditions.push(`test_type = $${paramIndex++}`);
        values.push(filters.testType);
      }
      if (filters.passFail) {
        conditions.push(`pass_fail = $${paramIndex++}`);
        values.push(filters.passFail);
      }
      if (filters.startDate) {
        conditions.push(`timestamp >= $${paramIndex++}`);
        values.push(filters.startDate);
      }
      if (filters.endDate) {
        conditions.push(`timestamp <= $${paramIndex++}`);
        values.push(filters.endDate);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limit = filters.limit || 100;
      const offset = filters.offset || 0;

      const sql = `
        SELECT * FROM evidence_artifacts ${whereClause}
        ORDER BY timestamp DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}
      `;

      values.push(limit, offset);

      const result = await query(sql, values);
      return result.rows as EvidenceArtifact[];
    } catch (error) {
      this.logger.error({ error, filters }, 'Failed to query evidence');
      return [];
    }
  }

  /**
   * Get evidence statistics for epic
   */
  async getEpicStatistics(
    epicId: string
  ): Promise<{
    totalTests: number;
    passedTests: number;
    failedTests: number;
    pendingTests: number;
    averageDuration: number;
    testTypeBreakdown: Record<TestType, number>;
  }> {
    try {
      const result = await query(
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN pass_fail = 'pass' THEN 1 ELSE 0 END) as passed,
          SUM(CASE WHEN pass_fail = 'fail' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN pass_fail = 'pending' THEN 1 ELSE 0 END) as pending,
          AVG(duration_ms) as avg_duration,
          test_type
        FROM evidence_artifacts
        WHERE epic_id = $1
        GROUP BY test_type`,
        [epicId]
      );

      const summary = await query(
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN pass_fail = 'pass' THEN 1 ELSE 0 END) as passed,
          SUM(CASE WHEN pass_fail = 'fail' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN pass_fail = 'pending' THEN 1 ELSE 0 END) as pending,
          AVG(duration_ms) as avg_duration
        FROM evidence_artifacts
        WHERE epic_id = $1`,
        [epicId]
      );

      const summaryRow = summary.rows[0];
      const typeBreakdown: Record<TestType, number> = {
        ui: 0,
        api: 0,
        unit: 0,
        integration: 0,
      };

      for (const row of result.rows) {
        typeBreakdown[row.test_type as TestType] = parseInt(row.total);
      }

      return {
        totalTests: parseInt(summaryRow.total),
        passedTests: parseInt(summaryRow.passed) || 0,
        failedTests: parseInt(summaryRow.failed) || 0,
        pendingTests: parseInt(summaryRow.pending) || 0,
        averageDuration: parseFloat(summaryRow.avg_duration) || 0,
        testTypeBreakdown: typeBreakdown,
      };
    } catch (error) {
      this.logger.error({ error, epicId }, 'Failed to get epic statistics');
      return {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        pendingTests: 0,
        averageDuration: 0,
        testTypeBreakdown: { ui: 0, api: 0, unit: 0, integration: 0 },
      };
    }
  }

  /**
   * Delete evidence by ID (soft delete for retention policy)
   */
  async deleteEvidence(evidenceId: number): Promise<void> {
    try {
      // Mark as deleted but keep in database for audit trail
      await query('UPDATE evidence_artifacts SET pass_fail = NULL WHERE id = $1', [evidenceId]);

      this.logger.info({ evidenceId }, 'Evidence marked for deletion');
    } catch (error) {
      throw new ArtifactStorageError(
        `Failed to delete evidence: ${(error as Error).message}`,
        String(evidenceId)
      );
    }
  }

  /**
   * Hard delete evidence (only for cleanup operations)
   */
  async hardDeleteEvidence(evidenceId: number): Promise<void> {
    try {
      // First delete related metadata
      await query('DELETE FROM evidence_metadata WHERE evidence_id = $1', [evidenceId]);
      await query('DELETE FROM evidence_console_logs WHERE evidence_id = $1', [evidenceId]);
      await query('DELETE FROM evidence_network_traces WHERE evidence_id = $1', [evidenceId]);
      await query('DELETE FROM evidence_http_pairs WHERE evidence_id = $1', [evidenceId]);
      await query('DELETE FROM evidence_tool_execution WHERE evidence_id = $1', [evidenceId]);
      await query('DELETE FROM evidence_coverage WHERE evidence_id = $1', [evidenceId]);
      await query('DELETE FROM evidence_retention WHERE evidence_id = $1', [evidenceId]);

      // Then delete the artifact
      await query('DELETE FROM evidence_artifacts WHERE id = $1', [evidenceId]);

      this.logger.info({ evidenceId }, 'Evidence hard deleted');
    } catch (error) {
      throw new ArtifactStorageError(
        `Failed to hard delete evidence: ${(error as Error).message}`,
        String(evidenceId)
      );
    }
  }
}
