/**
 * Red Flag Database Queries
 * Epic 006-B: Red Flag Detection System
 */

import { Pool, QueryResult } from 'pg';
import {
  RedFlag,
  CreateRedFlagInput,
  ResolveRedFlagInput,
  RedFlagQueryFilters,
  RedFlagStatistics,
  TestTimingHistory,
  TestTimingAverages,
  TestType,
} from '../types/red-flags.js';

/**
 * Insert a new red flag
 */
export async function insertRedFlag(
  pool: Pool,
  input: CreateRedFlagInput
): Promise<RedFlag> {
  const query = `
    INSERT INTO red_flags (
      epic_id, test_id, evidence_id, flag_type, severity, description, proof
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;

  const values = [
    input.epicId,
    input.testId,
    input.evidenceId || null,
    input.flagType,
    input.severity,
    input.description,
    JSON.stringify(input.proof),
  ];

  const result: QueryResult = await pool.query(query, values);
  return mapRedFlag(result.rows[0]);
}

/**
 * Query red flags by filters
 */
export async function queryRedFlags(
  pool: Pool,
  filters: RedFlagQueryFilters
): Promise<RedFlag[]> {
  const conditions: string[] = [];
  const values: any[] = [];
  let paramCounter = 1;

  if (filters.epicId) {
    conditions.push(`epic_id = $${paramCounter++}`);
    values.push(filters.epicId);
  }

  if (filters.testId) {
    conditions.push(`test_id = $${paramCounter++}`);
    values.push(filters.testId);
  }

  if (filters.flagType) {
    conditions.push(`flag_type = $${paramCounter++}`);
    values.push(filters.flagType);
  }

  if (filters.severity) {
    conditions.push(`severity = $${paramCounter++}`);
    values.push(filters.severity);
  }

  if (filters.resolved !== undefined) {
    conditions.push(`resolved = $${paramCounter++}`);
    values.push(filters.resolved);
  }

  if (filters.detectedAfter) {
    conditions.push(`detected_at >= $${paramCounter++}`);
    values.push(filters.detectedAfter);
  }

  if (filters.detectedBefore) {
    conditions.push(`detected_at <= $${paramCounter++}`);
    values.push(filters.detectedBefore);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const query = `
    SELECT * FROM red_flags
    ${whereClause}
    ORDER BY detected_at DESC
  `;

  const result: QueryResult = await pool.query(query, values);
  return result.rows.map(mapRedFlag);
}

/**
 * Query red flags by epic ID
 */
export async function queryRedFlagsByEpic(
  pool: Pool,
  epicId: string
): Promise<RedFlag[]> {
  return queryRedFlags(pool, { epicId });
}

/**
 * Query red flags by severity
 */
export async function queryRedFlagsBySeverity(
  pool: Pool,
  epicId: string,
  severity: string
): Promise<RedFlag[]> {
  return queryRedFlags(pool, { epicId, severity: severity as any });
}

/**
 * Query unresolved critical/high flags
 */
export async function queryActiveCriticalFlags(
  pool: Pool,
  epicId: string
): Promise<RedFlag[]> {
  const query = `
    SELECT * FROM red_flags
    WHERE epic_id = $1
      AND resolved = FALSE
      AND severity IN ('critical', 'high')
    ORDER BY severity, detected_at DESC
  `;

  const result: QueryResult = await pool.query(query, [epicId]);
  return result.rows.map(mapRedFlag);
}

/**
 * Resolve a red flag
 */
export async function resolveRedFlag(
  pool: Pool,
  input: ResolveRedFlagInput
): Promise<RedFlag> {
  const query = `
    UPDATE red_flags
    SET resolved = TRUE,
        resolution_notes = $2,
        resolved_at = NOW()
    WHERE id = $1
    RETURNING *
  `;

  const result: QueryResult = await pool.query(query, [input.id, input.resolutionNotes]);
  if (result.rows.length === 0) {
    throw new Error(`Red flag ${input.id} not found`);
  }
  return mapRedFlag(result.rows[0]);
}

/**
 * Get red flag statistics for an epic
 */
export async function getRedFlagStatistics(
  pool: Pool,
  epicId: string
): Promise<RedFlagStatistics[]> {
  const query = `
    SELECT * FROM red_flag_statistics
    WHERE epic_id = $1
    ORDER BY severity DESC, flag_type
  `;

  const result: QueryResult = await pool.query(query, [epicId]);
  return result.rows.map((row) => ({
    epicId: row.epic_id,
    flagType: row.flag_type,
    severity: row.severity,
    flagCount: parseInt(row.flag_count, 10),
    resolvedCount: parseInt(row.resolved_count, 10),
    unresolvedCount: parseInt(row.unresolved_count, 10),
    firstDetectedAt: new Date(row.first_detected_at),
    lastDetectedAt: new Date(row.last_detected_at),
  }));
}

/**
 * Insert test timing history
 */
export async function insertTestTiming(
  pool: Pool,
  testName: string,
  testType: TestType,
  durationMs: number,
  networkRequests: number,
  domChanges: number,
  epicId?: string
): Promise<TestTimingHistory> {
  const query = `
    INSERT INTO test_timing_history (
      test_name, test_type, duration_ms, network_requests, dom_changes, epic_id
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;

  const values = [testName, testType, durationMs, networkRequests, domChanges, epicId || null];

  const result: QueryResult = await pool.query(query, values);
  return mapTestTiming(result.rows[0]);
}

/**
 * Get test timing averages for a test
 */
export async function getTestTimingAverages(
  pool: Pool,
  testName: string
): Promise<TestTimingAverages | null> {
  const query = `
    SELECT * FROM test_timing_averages
    WHERE test_name = $1
  `;

  const result: QueryResult = await pool.query(query, [testName]);
  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    testName: row.test_name,
    testType: row.test_type,
    avgDurationMs: parseFloat(row.avg_duration_ms),
    stddevDurationMs: parseFloat(row.stddev_duration_ms || '0'),
    avgNetworkRequests: parseFloat(row.avg_network_requests),
    avgDomChanges: parseFloat(row.avg_dom_changes),
    sampleCount: parseInt(row.sample_count, 10),
    lastExecutedAt: new Date(row.last_executed_at),
  };
}

/**
 * Delete old test timing history (cleanup)
 */
export async function deleteOldTestTiming(
  pool: Pool,
  daysToKeep: number = 90
): Promise<number> {
  const query = `
    DELETE FROM test_timing_history
    WHERE executed_at < NOW() - INTERVAL '${daysToKeep} days'
  `;

  const result: QueryResult = await pool.query(query);
  return result.rowCount || 0;
}

/**
 * Map database row to RedFlag type
 */
function mapRedFlag(row: any): RedFlag {
  return {
    id: row.id,
    epicId: row.epic_id,
    testId: row.test_id,
    evidenceId: row.evidence_id,
    flagType: row.flag_type,
    severity: row.severity,
    description: row.description,
    proof: typeof row.proof === 'string' ? JSON.parse(row.proof) : row.proof,
    detectedAt: new Date(row.detected_at),
    resolved: row.resolved,
    resolutionNotes: row.resolution_notes,
    resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Map database row to TestTimingHistory type
 */
function mapTestTiming(row: any): TestTimingHistory {
  return {
    id: row.id,
    testName: row.test_name,
    testType: row.test_type,
    durationMs: row.duration_ms,
    networkRequests: row.network_requests,
    domChanges: row.dom_changes,
    executedAt: new Date(row.executed_at),
    epicId: row.epic_id,
    createdAt: new Date(row.created_at),
  };
}
