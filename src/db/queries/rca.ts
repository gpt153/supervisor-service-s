/**
 * Root Cause Analysis Database Queries
 * Epic: 006-F
 */

import { pool } from '../client.js';
import type { RootCauseAnalysis } from '../../types/rca.js';

/**
 * Create a new RCA record
 *
 * @param rca - Root cause analysis data
 * @returns Created RCA with ID
 */
export async function createRCA(rca: RootCauseAnalysis): Promise<{ success: boolean; data?: RootCauseAnalysis; error?: string }> {
  try {
    const result = await pool.query(
      `INSERT INTO root_cause_analyses
       (test_id, epic_id, evidence_id, failure_category, root_cause, complexity,
        estimated_fix_difficulty, symptoms, diagnosis_reasoning, recommended_strategy, analyzer_model)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        rca.test_id,
        rca.epic_id,
        rca.evidence_id,
        rca.failure_category,
        rca.root_cause,
        rca.complexity,
        rca.estimated_fix_difficulty,
        rca.symptoms,
        rca.diagnosis_reasoning,
        rca.recommended_strategy,
        rca.analyzer_model
      ]
    );

    return { success: true, data: result.rows[0] };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Get RCA by ID
 *
 * @param id - RCA ID
 * @returns RCA record or null
 */
export async function getRCAById(id: number): Promise<{ success: boolean; data?: RootCauseAnalysis; error?: string }> {
  try {
    const result = await pool.query(
      'SELECT * FROM root_cause_analyses WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return { success: false, error: 'RCA not found' };
    }

    return { success: true, data: result.rows[0] };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Get all RCAs for a test
 *
 * @param testId - Test identifier
 * @returns List of RCAs for the test
 */
export async function getRCAsByTestId(testId: string): Promise<{ success: boolean; data?: RootCauseAnalysis[]; error?: string }> {
  try {
    const result = await pool.query(
      'SELECT * FROM root_cause_analyses WHERE test_id = $1 ORDER BY analyzed_at DESC',
      [testId]
    );

    return { success: true, data: result.rows };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Get latest RCA for a test
 *
 * @param testId - Test identifier
 * @returns Most recent RCA or null
 */
export async function getLatestRCA(testId: string): Promise<{ success: boolean; data?: RootCauseAnalysis; error?: string }> {
  try {
    const result = await pool.query(
      'SELECT * FROM root_cause_analyses WHERE test_id = $1 ORDER BY analyzed_at DESC LIMIT 1',
      [testId]
    );

    if (result.rows.length === 0) {
      return { success: false, error: 'No RCA found for test' };
    }

    return { success: true, data: result.rows[0] };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Get RCAs by epic
 *
 * @param epicId - Epic identifier
 * @returns List of RCAs for the epic
 */
export async function getRCAsByEpicId(epicId: string): Promise<{ success: boolean; data?: RootCauseAnalysis[]; error?: string }> {
  try {
    const result = await pool.query(
      'SELECT * FROM root_cause_analyses WHERE epic_id = $1 ORDER BY analyzed_at DESC',
      [epicId]
    );

    return { success: true, data: result.rows };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Get RCAs by complexity
 *
 * @param complexity - Complexity level
 * @returns List of RCAs with matching complexity
 */
export async function getRCAsByComplexity(complexity: string): Promise<{ success: boolean; data?: RootCauseAnalysis[]; error?: string }> {
  try {
    const result = await pool.query(
      'SELECT * FROM root_cause_analyses WHERE complexity = $1 ORDER BY analyzed_at DESC',
      [complexity]
    );

    return { success: true, data: result.rows };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Get RCA statistics
 *
 * @returns Statistics about RCAs (category distribution, complexity distribution)
 */
export async function getRCAStats(): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const categoryStats = await pool.query(
      'SELECT failure_category, COUNT(*) as count FROM root_cause_analyses GROUP BY failure_category'
    );

    const complexityStats = await pool.query(
      'SELECT complexity, COUNT(*) as count FROM root_cause_analyses GROUP BY complexity'
    );

    const avgDifficulty = await pool.query(
      'SELECT AVG(estimated_fix_difficulty) as avg_difficulty FROM root_cause_analyses WHERE estimated_fix_difficulty IS NOT NULL'
    );

    return {
      success: true,
      data: {
        by_category: categoryStats.rows,
        by_complexity: complexityStats.rows,
        avg_fix_difficulty: avgDifficulty.rows[0]?.avg_difficulty || 0
      }
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
