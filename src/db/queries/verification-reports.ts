/**
 * Verification Report Database Queries
 * Epic 006-E: Independent Verification Agent
 */

import { Pool, QueryResult } from 'pg';
import {
  VerificationReport,
  VerificationReportInput,
  VerificationStatistics,
} from '../../types/verification.js';

/**
 * Insert a new verification report
 */
export async function insertVerificationReport(
  pool: Pool,
  input: VerificationReportInput
): Promise<VerificationReport> {
  const query = `
    INSERT INTO verification_reports (
      test_id, epic_id, evidence_id, verified, confidence_score, recommendation,
      evidence_reviewed, cross_validation_results, red_flags_found,
      summary, reasoning, concerns, verifier_model
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *
  `;

  const values = [
    input.testId,
    input.epicId,
    input.evidenceId || null,
    input.verified,
    input.confidenceScore,
    input.recommendation,
    JSON.stringify(input.evidenceReviewed),
    JSON.stringify(input.crossValidationResults),
    JSON.stringify(input.redFlagsFound),
    input.summary,
    input.reasoning,
    input.concerns,
    input.verifierModel,
  ];

  const result: QueryResult = await pool.query(query, values);
  return mapVerificationReport(result.rows[0]);
}

/**
 * Query verification reports by test ID
 */
export async function queryVerificationReportsByTest(
  pool: Pool,
  testId: string
): Promise<VerificationReport[]> {
  const query = `
    SELECT * FROM verification_reports
    WHERE test_id = $1
    ORDER BY verified_at DESC
  `;

  const result: QueryResult = await pool.query(query, [testId]);
  return result.rows.map(mapVerificationReport);
}

/**
 * Query verification reports by epic ID
 */
export async function queryVerificationReportsByEpic(
  pool: Pool,
  epicId: string
): Promise<VerificationReport[]> {
  const query = `
    SELECT * FROM verification_reports
    WHERE epic_id = $1
    ORDER BY verified_at DESC
  `;

  const result: QueryResult = await pool.query(query, [epicId]);
  return result.rows.map(mapVerificationReport);
}

/**
 * Get latest verification report for a test
 */
export async function getLatestVerificationReport(
  pool: Pool,
  testId: string
): Promise<VerificationReport | null> {
  const query = `
    SELECT * FROM verification_reports
    WHERE test_id = $1
    ORDER BY verified_at DESC
    LIMIT 1
  `;

  const result: QueryResult = await pool.query(query, [testId]);
  if (result.rows.length === 0) {
    return null;
  }
  return mapVerificationReport(result.rows[0]);
}

/**
 * Query failed verifications (verified = false)
 */
export async function queryFailedVerifications(
  pool: Pool,
  epicId: string
): Promise<VerificationReport[]> {
  const query = `
    SELECT * FROM verification_reports
    WHERE epic_id = $1 AND verified = FALSE
    ORDER BY verified_at DESC
  `;

  const result: QueryResult = await pool.query(query, [epicId]);
  return result.rows.map(mapVerificationReport);
}

/**
 * Query verifications requiring manual review
 */
export async function queryManualReviewRequired(
  pool: Pool,
  epicId: string
): Promise<VerificationReport[]> {
  const query = `
    SELECT * FROM verification_reports
    WHERE epic_id = $1 AND recommendation = 'manual_review'
    ORDER BY verified_at DESC
  `;

  const result: QueryResult = await pool.query(query, [epicId]);
  return result.rows.map(mapVerificationReport);
}

/**
 * Query verifications by confidence score range
 */
export async function queryByConfidenceRange(
  pool: Pool,
  epicId: string,
  minScore: number,
  maxScore: number
): Promise<VerificationReport[]> {
  const query = `
    SELECT * FROM verification_reports
    WHERE epic_id = $1
      AND confidence_score >= $2
      AND confidence_score <= $3
    ORDER BY confidence_score DESC, verified_at DESC
  `;

  const result: QueryResult = await pool.query(query, [epicId, minScore, maxScore]);
  return result.rows.map(mapVerificationReport);
}

/**
 * Get verification statistics for an epic
 */
export async function getVerificationStatistics(
  pool: Pool,
  epicId: string
): Promise<VerificationStatistics | null> {
  const query = `
    SELECT * FROM verification_statistics
    WHERE epic_id = $1
  `;

  const result: QueryResult = await pool.query(query, [epicId]);
  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    epicId: row.epic_id,
    totalVerifications: parseInt(row.total_verifications, 10),
    passedVerifications: parseInt(row.passed_verifications, 10),
    failedVerifications: parseInt(row.failed_verifications, 10),
    manualReviewRequired: parseInt(row.manual_review_required, 10),
    averageConfidenceScore: parseFloat(row.avg_confidence_score),
    averageExecutionTimeMs: 0, // Not tracked in view, would need separate calculation
    mostCommonConcerns: [], // Would need to query verification_concerns view
    redFlagDistribution: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      totalFlags: 0,
      descriptions: [],
    },
    lastVerifiedAt: new Date(row.last_verified_at),
  };
}

/**
 * Get most common concerns for an epic
 */
export async function getMostCommonConcerns(
  pool: Pool,
  epicId: string,
  limit: number = 10
): Promise<Array<{ concern: string; count: number }>> {
  const query = `
    SELECT concern, occurrence_count
    FROM verification_concerns
    WHERE epic_id = $1
    ORDER BY occurrence_count DESC
    LIMIT $2
  `;

  const result: QueryResult = await pool.query(query, [epicId, limit]);
  return result.rows.map((row) => ({
    concern: row.concern,
    count: parseInt(row.occurrence_count, 10),
  }));
}

/**
 * Delete old verification reports (cleanup)
 */
export async function deleteOldVerificationReports(
  pool: Pool,
  daysToKeep: number = 90
): Promise<number> {
  const query = `
    DELETE FROM verification_reports
    WHERE verified_at < NOW() - INTERVAL '${daysToKeep} days'
  `;

  const result: QueryResult = await pool.query(query);
  return result.rowCount || 0;
}

/**
 * Get verification reports with low confidence (<60%)
 */
export async function getLowConfidenceVerifications(
  pool: Pool,
  epicId: string
): Promise<VerificationReport[]> {
  const query = `
    SELECT * FROM verification_reports
    WHERE epic_id = $1 AND confidence_score < 60
    ORDER BY confidence_score ASC, verified_at DESC
  `;

  const result: QueryResult = await pool.query(query, [epicId]);
  return result.rows.map(mapVerificationReport);
}

/**
 * Get verification reports by verifier model
 */
export async function queryByVerifierModel(
  pool: Pool,
  epicId: string,
  model: string
): Promise<VerificationReport[]> {
  const query = `
    SELECT * FROM verification_reports
    WHERE epic_id = $1 AND verifier_model = $2
    ORDER BY verified_at DESC
  `;

  const result: QueryResult = await pool.query(query, [epicId, model]);
  return result.rows.map(mapVerificationReport);
}

/**
 * Count verifications by recommendation type
 */
export async function countByRecommendation(
  pool: Pool,
  epicId: string
): Promise<{ accept: number; reject: number; manual_review: number }> {
  const query = `
    SELECT
      recommendation,
      COUNT(*) as count
    FROM verification_reports
    WHERE epic_id = $1
    GROUP BY recommendation
  `;

  const result: QueryResult = await pool.query(query, [epicId]);

  const counts = {
    accept: 0,
    reject: 0,
    manual_review: 0,
  };

  result.rows.forEach((row) => {
    counts[row.recommendation as keyof typeof counts] = parseInt(row.count, 10);
  });

  return counts;
}

/**
 * Map database row to VerificationReport type
 */
function mapVerificationReport(row: any): VerificationReport {
  return {
    id: row.id,
    testId: row.test_id,
    epicId: row.epic_id,
    evidenceId: row.evidence_id,
    verified: row.verified,
    confidenceScore: row.confidence_score,
    recommendation: row.recommendation,
    evidenceReviewed:
      typeof row.evidence_reviewed === 'string'
        ? JSON.parse(row.evidence_reviewed)
        : row.evidence_reviewed,
    crossValidationResults:
      typeof row.cross_validation_results === 'string'
        ? JSON.parse(row.cross_validation_results)
        : row.cross_validation_results || [],
    redFlagsFound:
      typeof row.red_flags_found === 'string'
        ? JSON.parse(row.red_flags_found)
        : row.red_flags_found,
    summary: row.summary,
    reasoning: row.reasoning,
    concerns: row.concerns || [],
    verifiedAt: new Date(row.verified_at),
    verifierModel: row.verifier_model,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
