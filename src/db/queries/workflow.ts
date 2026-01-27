/**
 * Epic 006-G: Workflow Database Queries
 *
 * CRUD operations for test workflow state management
 */

import { pool } from '../client.js';
import type {
  TestWorkflow,
  WorkflowStage,
  WorkflowStatus,
  TestExecutionResult,
  DetectionResult,
  VerificationReport,
  FixResult,
  LearningResult
} from '../../types/orchestration.js';

/**
 * Create a new test workflow
 */
export async function createWorkflow(params: {
  test_id: string;
  epic_id: string;
  test_type: 'ui' | 'api' | 'unit' | 'integration';
}): Promise<TestWorkflow> {
  const result = await pool.query<TestWorkflow>(
    `INSERT INTO test_workflows (test_id, epic_id, test_type, current_stage, status)
     VALUES ($1, $2, $3, 'pending', 'pending')
     RETURNING *`,
    [params.test_id, params.epic_id, params.test_type]
  );

  return result.rows[0];
}

/**
 * Get workflow by ID
 */
export async function getWorkflow(id: number): Promise<TestWorkflow | null> {
  const result = await pool.query<TestWorkflow>(
    'SELECT * FROM test_workflows WHERE id = $1',
    [id]
  );

  return result.rows[0] || null;
}

/**
 * Get workflow by test ID
 */
export async function getWorkflowByTestId(testId: string): Promise<TestWorkflow | null> {
  const result = await pool.query<TestWorkflow>(
    'SELECT * FROM test_workflows WHERE test_id = $1',
    [testId]
  );

  return result.rows[0] || null;
}

/**
 * Get all workflows for an epic
 */
export async function getWorkflowsByEpic(epicId: string): Promise<TestWorkflow[]> {
  const result = await pool.query<TestWorkflow>(
    'SELECT * FROM test_workflows WHERE epic_id = $1 ORDER BY created_at ASC',
    [epicId]
  );

  return result.rows;
}

/**
 * Update workflow stage
 */
export async function updateWorkflowStage(
  id: number,
  stage: WorkflowStage
): Promise<TestWorkflow> {
  const result = await pool.query<TestWorkflow>(
    `UPDATE test_workflows
     SET current_stage = $1, status = 'in_progress'
     WHERE id = $2
     RETURNING *`,
    [stage, id]
  );

  return result.rows[0];
}

/**
 * Update workflow status
 */
export async function updateWorkflowStatus(
  id: number,
  status: WorkflowStatus
): Promise<TestWorkflow> {
  const result = await pool.query<TestWorkflow>(
    'UPDATE test_workflows SET status = $1 WHERE id = $2 RETURNING *',
    [status, id]
  );

  return result.rows[0];
}

/**
 * Store execution result
 */
export async function storeExecutionResult(
  id: number,
  result: TestExecutionResult
): Promise<TestWorkflow> {
  const dbResult = await pool.query<TestWorkflow>(
    'UPDATE test_workflows SET execution_result = $1 WHERE id = $2 RETURNING *',
    [JSON.stringify(result), id]
  );

  return dbResult.rows[0];
}

/**
 * Store detection result
 */
export async function storeDetectionResult(
  id: number,
  result: DetectionResult
): Promise<TestWorkflow> {
  const dbResult = await pool.query<TestWorkflow>(
    'UPDATE test_workflows SET detection_result = $1 WHERE id = $2 RETURNING *',
    [JSON.stringify(result), id]
  );

  return dbResult.rows[0];
}

/**
 * Store verification result
 */
export async function storeVerificationResult(
  id: number,
  result: VerificationReport
): Promise<TestWorkflow> {
  const dbResult = await pool.query<TestWorkflow>(
    'UPDATE test_workflows SET verification_result = $1 WHERE id = $2 RETURNING *',
    [JSON.stringify(result), id]
  );

  return dbResult.rows[0];
}

/**
 * Store fixing result
 */
export async function storeFixingResult(
  id: number,
  result: FixResult
): Promise<TestWorkflow> {
  const dbResult = await pool.query<TestWorkflow>(
    'UPDATE test_workflows SET fixing_result = $1 WHERE id = $2 RETURNING *',
    [JSON.stringify(result), id]
  );

  return dbResult.rows[0];
}

/**
 * Store learning result
 */
export async function storeLearningResult(
  id: number,
  result: LearningResult
): Promise<TestWorkflow> {
  const dbResult = await pool.query<TestWorkflow>(
    'UPDATE test_workflows SET learning_result = $1 WHERE id = $2 RETURNING *',
    [JSON.stringify(result), id]
  );

  return dbResult.rows[0];
}

/**
 * Mark workflow as completed
 */
export async function completeWorkflow(id: number): Promise<TestWorkflow> {
  const result = await pool.query<TestWorkflow>(
    `UPDATE test_workflows
     SET status = 'completed',
         current_stage = 'completed',
         completed_at = NOW(),
         duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000
     WHERE id = $1
     RETURNING *`,
    [id]
  );

  return result.rows[0];
}

/**
 * Mark workflow as failed
 */
export async function failWorkflow(
  id: number,
  errorMessage: string
): Promise<TestWorkflow> {
  const result = await pool.query<TestWorkflow>(
    `UPDATE test_workflows
     SET status = 'failed',
         current_stage = 'failed',
         error_message = $1,
         completed_at = NOW(),
         duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000
     WHERE id = $2
     RETURNING *`,
    [errorMessage, id]
  );

  return result.rows[0];
}

/**
 * Increment retry count
 */
export async function incrementRetryCount(id: number): Promise<TestWorkflow> {
  const result = await pool.query<TestWorkflow>(
    'UPDATE test_workflows SET retry_count = retry_count + 1 WHERE id = $1 RETURNING *',
    [id]
  );

  return result.rows[0];
}

/**
 * Mark workflow as escalated
 */
export async function escalateWorkflow(id: number): Promise<TestWorkflow> {
  const result = await pool.query<TestWorkflow>(
    'UPDATE test_workflows SET escalated = TRUE WHERE id = $1 RETURNING *',
    [id]
  );

  return result.rows[0];
}

/**
 * Get workflows by status
 */
export async function getWorkflowsByStatus(status: WorkflowStatus): Promise<TestWorkflow[]> {
  const result = await pool.query<TestWorkflow>(
    'SELECT * FROM test_workflows WHERE status = $1 ORDER BY created_at ASC',
    [status]
  );

  return result.rows;
}

/**
 * Get in-progress workflows
 */
export async function getInProgressWorkflows(): Promise<TestWorkflow[]> {
  return getWorkflowsByStatus('in_progress');
}

/**
 * Get workflow statistics
 */
export async function getWorkflowStatistics(): Promise<{
  test_type: string;
  current_stage: string;
  status: string;
  workflow_count: number;
  avg_duration_ms: number;
  max_duration_ms: number;
  escalation_count: number;
  avg_retry_count: number;
}[]> {
  const result = await pool.query(
    'SELECT * FROM workflow_statistics ORDER BY workflow_count DESC'
  );

  return result.rows;
}

/**
 * Delete old workflows (for cleanup)
 */
export async function deleteOldWorkflows(daysOld: number): Promise<number> {
  const result = await pool.query(
    `DELETE FROM test_workflows
     WHERE created_at < NOW() - INTERVAL '${daysOld} days'
     AND status IN ('completed', 'failed')`,
    []
  );

  return result.rowCount || 0;
}
