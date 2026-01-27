/**
 * Fix Learning Database Queries
 * Epic: 006-F
 */

import { pool } from '../client.js';
import type { FixAttempt, FixLearning } from '../../types/fixing.js';

/**
 * Create a fix attempt record
 *
 * @param attempt - Fix attempt data
 * @returns Created attempt with ID
 */
export async function createFixAttempt(attempt: FixAttempt): Promise<{ success: boolean; data?: FixAttempt; error?: string }> {
  try {
    const result = await pool.query(
      `INSERT INTO fix_attempts
       (test_id, rca_id, retry_number, model_used, fix_strategy, changes_made,
        commit_sha, success, verification_passed, error_message, cost_usd, tokens_used)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        attempt.test_id,
        attempt.rca_id,
        attempt.retry_number,
        attempt.model_used,
        attempt.fix_strategy,
        attempt.changes_made,
        attempt.commit_sha,
        attempt.success,
        attempt.verification_passed,
        attempt.error_message,
        attempt.cost_usd,
        attempt.tokens_used
      ]
    );

    return { success: true, data: result.rows[0] };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Get all fix attempts for a test
 *
 * @param testId - Test identifier
 * @returns List of fix attempts for the test
 */
export async function getFixAttemptsByTestId(testId: string): Promise<{ success: boolean; data?: FixAttempt[]; error?: string }> {
  try {
    const result = await pool.query(
      'SELECT * FROM fix_attempts WHERE test_id = $1 ORDER BY retry_number ASC',
      [testId]
    );

    return { success: true, data: result.rows };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Get fix attempts by RCA
 *
 * @param rcaId - RCA ID
 * @returns List of fix attempts for the RCA
 */
export async function getFixAttemptsByRCAId(rcaId: number): Promise<{ success: boolean; data?: FixAttempt[]; error?: string }> {
  try {
    const result = await pool.query(
      'SELECT * FROM fix_attempts WHERE rca_id = $1 ORDER BY retry_number ASC',
      [rcaId]
    );

    return { success: true, data: result.rows };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Record a fix learning (success or failure)
 *
 * @param failurePattern - Pattern that identifies the failure
 * @param fixStrategy - Strategy used to fix
 * @param success - Whether the fix succeeded
 * @param options - Additional learning data
 * @returns Updated or created learning record
 */
export async function recordFixLearning(
  failurePattern: string,
  fixStrategy: string,
  success: boolean,
  options: { errorRegex?: string; filePattern?: string; complexity?: string } = {}
): Promise<{ success: boolean; data?: FixLearning; error?: string }> {
  try {
    // Check if learning already exists
    const existing = await pool.query(
      'SELECT * FROM fix_learnings WHERE failure_pattern = $1 AND fix_strategy = $2',
      [failurePattern, fixStrategy]
    );

    let result;
    if (existing.rows.length > 0) {
      // Update existing learning
      result = await pool.query(
        `UPDATE fix_learnings
         SET times_tried = times_tried + 1,
             times_succeeded = times_succeeded + $1,
             success_rate = (times_succeeded + $1)::decimal / (times_tried + 1),
             last_used = NOW()
         WHERE failure_pattern = $2 AND fix_strategy = $3
         RETURNING *`,
        [success ? 1 : 0, failurePattern, fixStrategy]
      );
    } else {
      // Create new learning
      result = await pool.query(
        `INSERT INTO fix_learnings
         (failure_pattern, fix_strategy, times_tried, times_succeeded, success_rate,
          error_regex, file_pattern, complexity)
         VALUES ($1, $2, 1, $3, $3::decimal, $4, $5, $6)
         RETURNING *`,
        [
          failurePattern,
          fixStrategy,
          success ? 1 : 0,
          options.errorRegex,
          options.filePattern,
          options.complexity
        ]
      );
    }

    return { success: true, data: result.rows[0] };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Get best fix strategy for a failure pattern
 *
 * @param failurePattern - Pattern that identifies the failure
 * @returns Best strategy or null if no learnings exist
 */
export async function getBestFixStrategy(failurePattern: string): Promise<{ success: boolean; data?: FixLearning; error?: string }> {
  try {
    const result = await pool.query(
      `SELECT * FROM fix_learnings
       WHERE failure_pattern = $1
       ORDER BY success_rate DESC, times_tried DESC
       LIMIT 1`,
      [failurePattern]
    );

    if (result.rows.length === 0) {
      return { success: false, error: 'No learnings found for pattern' };
    }

    return { success: true, data: result.rows[0] };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Get all fix learnings with success rate above threshold
 *
 * @param minSuccessRate - Minimum success rate (0-1)
 * @returns List of reliable learnings
 */
export async function getReliableLearnings(minSuccessRate: number = 0.7): Promise<{ success: boolean; data?: FixLearning[]; error?: string }> {
  try {
    const result = await pool.query(
      `SELECT * FROM fix_learnings
       WHERE success_rate >= $1
       ORDER BY success_rate DESC, times_tried DESC`,
      [minSuccessRate]
    );

    return { success: true, data: result.rows };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Get fix learning statistics
 *
 * @returns Statistics about fix learnings
 */
export async function getFixLearningStats(): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const totalLearnings = await pool.query('SELECT COUNT(*) as count FROM fix_learnings');
    const avgSuccessRate = await pool.query('SELECT AVG(success_rate) as avg FROM fix_learnings');
    const topStrategies = await pool.query(
      `SELECT fix_strategy, AVG(success_rate) as avg_success, SUM(times_tried) as total_tries
       FROM fix_learnings
       GROUP BY fix_strategy
       ORDER BY avg_success DESC
       LIMIT 5`
    );

    return {
      success: true,
      data: {
        total_learnings: totalLearnings.rows[0]?.count || 0,
        avg_success_rate: avgSuccessRate.rows[0]?.avg || 0,
        top_strategies: topStrategies.rows
      }
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Get total cost of fix attempts for a test
 *
 * @param testId - Test identifier
 * @returns Total cost in USD
 */
export async function getTotalFixCost(testId: string): Promise<{ success: boolean; data?: number; error?: string }> {
  try {
    const result = await pool.query(
      'SELECT COALESCE(SUM(cost_usd), 0) as total_cost FROM fix_attempts WHERE test_id = $1',
      [testId]
    );

    return { success: true, data: parseFloat(result.rows[0]?.total_cost || '0') };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
