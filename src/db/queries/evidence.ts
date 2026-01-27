/**
 * Evidence Database Queries
 * CRUD operations for evidence artifacts and metadata
 */

import { query } from '../client.js';
import {
  EvidenceArtifact,
  TestType,
  PassFailStatus,
  EvidenceStorageParams,
} from '../../types/evidence.js';

/**
 * Insert new evidence artifact
 */
export async function insertEvidence(
  epicId: string,
  testId: string,
  testType: TestType,
  testName: string,
  passFail: PassFailStatus,
  params?: Partial<EvidenceStorageParams>
): Promise<EvidenceArtifact> {
  const result = await query(
    `INSERT INTO evidence_artifacts (
      epic_id, test_id, test_type, test_name, expected_outcome, actual_outcome,
      pass_fail, screenshot_before, screenshot_after, dom_snapshot, console_logs,
      network_trace, http_request, http_response, coverage_report, duration_ms,
      error_message, stack_trace
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
    RETURNING *`,
    [
      epicId,
      testId,
      testType,
      testName,
      params?.expectedOutcome || null,
      params?.actualOutcome || null,
      passFail,
      null, // screenshot_before
      null, // screenshot_after
      null, // dom_snapshot
      null, // console_logs
      null, // network_trace
      null, // http_request
      null, // http_response
      null, // coverage_report
      params?.durationMs || null,
      params?.errorMessage || null,
      params?.stackTrace || null,
    ]
  );

  return result.rows[0];
}

/**
 * Update evidence artifact
 */
export async function updateEvidence(
  evidenceId: number,
  updates: Partial<EvidenceStorageParams & {
    screenshotBefore?: string;
    screenshotAfter?: string;
    domSnapshot?: string;
    consoleLogs?: string;
    networkTrace?: string;
    httpRequest?: string;
    httpResponse?: string;
    coverageReport?: string;
  }>
): Promise<EvidenceArtifact> {
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (updates.expectedOutcome !== undefined) {
    fields.push(`expected_outcome = $${paramIndex++}`);
    values.push(updates.expectedOutcome);
  }
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
  if (updates.screenshotBefore !== undefined) {
    fields.push(`screenshot_before = $${paramIndex++}`);
    values.push(updates.screenshotBefore);
  }
  if (updates.screenshotAfter !== undefined) {
    fields.push(`screenshot_after = $${paramIndex++}`);
    values.push(updates.screenshotAfter);
  }
  if (updates.domSnapshot !== undefined) {
    fields.push(`dom_snapshot = $${paramIndex++}`);
    values.push(updates.domSnapshot);
  }
  if (updates.consoleLogs !== undefined) {
    fields.push(`console_logs = $${paramIndex++}`);
    values.push(updates.consoleLogs);
  }
  if (updates.networkTrace !== undefined) {
    fields.push(`network_trace = $${paramIndex++}`);
    values.push(updates.networkTrace);
  }
  if (updates.httpRequest !== undefined) {
    fields.push(`http_request = $${paramIndex++}`);
    values.push(updates.httpRequest);
  }
  if (updates.httpResponse !== undefined) {
    fields.push(`http_response = $${paramIndex++}`);
    values.push(updates.httpResponse);
  }
  if (updates.coverageReport !== undefined) {
    fields.push(`coverage_report = $${paramIndex++}`);
    values.push(updates.coverageReport);
  }

  fields.push(`updated_at = NOW()`);
  values.push(evidenceId);

  const sql = `
    UPDATE evidence_artifacts
    SET ${fields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `;

  const result = await query(sql, values);
  return result.rows[0];
}

/**
 * Get evidence by ID
 */
export async function getEvidenceById(evidenceId: number): Promise<EvidenceArtifact | null> {
  const result = await query('SELECT * FROM evidence_artifacts WHERE id = $1', [evidenceId]);
  return result.rows[0] || null;
}

/**
 * Query evidence by epic ID
 */
export async function queryEvidenceByEpic(
  epicId: string,
  limit = 100,
  offset = 0
): Promise<EvidenceArtifact[]> {
  const result = await query(
    `SELECT * FROM evidence_artifacts WHERE epic_id = $1
     ORDER BY timestamp DESC LIMIT $2 OFFSET $3`,
    [epicId, limit, offset]
  );
  return result.rows;
}

/**
 * Query evidence by test type
 */
export async function queryEvidenceByType(
  testType: TestType,
  limit = 100,
  offset = 0
): Promise<EvidenceArtifact[]> {
  const result = await query(
    `SELECT * FROM evidence_artifacts WHERE test_type = $1
     ORDER BY timestamp DESC LIMIT $2 OFFSET $3`,
    [testType, limit, offset]
  );
  return result.rows;
}

/**
 * Query evidence by pass/fail status
 */
export async function queryEvidenceByStatus(
  passFail: PassFailStatus,
  limit = 100,
  offset = 0
): Promise<EvidenceArtifact[]> {
  const result = await query(
    `SELECT * FROM evidence_artifacts WHERE pass_fail = $1
     ORDER BY timestamp DESC LIMIT $2 OFFSET $3`,
    [passFail, limit, offset]
  );
  return result.rows;
}

/**
 * Query evidence by date range
 */
export async function queryEvidenceByDateRange(
  startDate: Date,
  endDate: Date,
  limit = 100,
  offset = 0
): Promise<EvidenceArtifact[]> {
  const result = await query(
    `SELECT * FROM evidence_artifacts
     WHERE timestamp >= $1 AND timestamp <= $2
     ORDER BY timestamp DESC LIMIT $3 OFFSET $4`,
    [startDate, endDate, limit, offset]
  );
  return result.rows;
}

/**
 * Get evidence count by epic
 */
export async function getEvidenceCountByEpic(epicId: string): Promise<number> {
  const result = await query(
    'SELECT COUNT(*) as count FROM evidence_artifacts WHERE epic_id = $1',
    [epicId]
  );
  return parseInt(result.rows[0].count);
}

/**
 * Delete evidence (soft delete)
 */
export async function deleteEvidence(evidenceId: number): Promise<void> {
  // Mark as deleted in metadata rather than hard delete for audit trail
  await query(
    `UPDATE evidence_artifacts SET updated_at = NOW() WHERE id = $1`,
    [evidenceId]
  );
}

/**
 * Hard delete evidence and related data
 */
export async function hardDeleteEvidence(evidenceId: number): Promise<void> {
  // Delete in cascade order
  await query('DELETE FROM evidence_metadata WHERE evidence_id = $1', [evidenceId]);
  await query('DELETE FROM evidence_console_logs WHERE evidence_id = $1', [evidenceId]);
  await query('DELETE FROM evidence_network_traces WHERE evidence_id = $1', [evidenceId]);
  await query('DELETE FROM evidence_http_pairs WHERE evidence_id = $1', [evidenceId]);
  await query('DELETE FROM evidence_tool_execution WHERE evidence_id = $1', [evidenceId]);
  await query('DELETE FROM evidence_coverage WHERE evidence_id = $1', [evidenceId]);
  await query('DELETE FROM evidence_retention WHERE evidence_id = $1', [evidenceId]);
  await query('DELETE FROM evidence_artifacts WHERE id = $1', [evidenceId]);
}

/**
 * Get evidence statistics for epic
 */
export async function getEpicStatistics(
  epicId: string
): Promise<{
  totalTests: number;
  passedTests: number;
  failedTests: number;
  pendingTests: number;
  averageDuration: number;
}> {
  const result = await query(
    `SELECT
      COUNT(*) as total,
      SUM(CASE WHEN pass_fail = 'pass' THEN 1 ELSE 0 END) as passed,
      SUM(CASE WHEN pass_fail = 'fail' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN pass_fail = 'pending' THEN 1 ELSE 0 END) as pending,
      AVG(COALESCE(duration_ms, 0)) as avg_duration
    FROM evidence_artifacts
    WHERE epic_id = $1`,
    [epicId]
  );

  const row = result.rows[0];
  return {
    totalTests: parseInt(row.total) || 0,
    passedTests: parseInt(row.passed) || 0,
    failedTests: parseInt(row.failed) || 0,
    pendingTests: parseInt(row.pending) || 0,
    averageDuration: parseFloat(row.avg_duration) || 0,
  };
}
