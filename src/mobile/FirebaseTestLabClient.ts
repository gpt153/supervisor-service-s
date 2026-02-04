/**
 * FirebaseTestLabClient - Interface to Firebase Test Lab
 *
 * Handles test submission, result collection, and quota monitoring.
 * Uses gcloud CLI for test execution (more reliable than REST API).
 *
 * @module mobile
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { access } from 'fs/promises';
import { Pool } from 'pg';

const execAsync = promisify(exec);

export interface TestSubmission {
  project_id: number;
  apk_path: string;
  test_apk_path?: string;
  device_model: string;
  os_version: string;
  test_type: 'instrumentation' | 'robo';
  timeout_minutes?: number;
}

export interface TestResult {
  test_run_id: number;
  status: 'passed' | 'failed' | 'error';
  duration_seconds: number;
  results_url: string;
  artifacts_path: string;
  failure_reason?: string;
}

export class FirebaseTestLabClient {
  private pool: Pool;
  private firebaseProjectId: string;
  private credentialsPath: string;
  private resultsBucket: string;

  constructor(
    pool: Pool,
    firebaseProjectId: string,
    credentialsPath: string = '/home/samuel/.config/firebase/testlab-key.json'
  ) {
    this.pool = pool;
    this.firebaseProjectId = firebaseProjectId;
    this.credentialsPath = credentialsPath;
    this.resultsBucket = `gs://${firebaseProjectId}_test-lab`;
  }

  /**
   * Authenticate gcloud CLI with service account
   */
  async authenticate(): Promise<{ success: boolean; error?: string }> {
    try {
      await execAsync(
        `gcloud auth activate-service-account --key-file="${this.credentialsPath}" --project="${this.firebaseProjectId}"`,
        { timeout: 30000 }
      );
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Submit APK to Firebase Test Lab for testing
   *
   * @param submission - Test submission parameters
   * @returns Test run ID and initial status
   */
  async submitTest(submission: TestSubmission): Promise<{
    success: boolean;
    test_run_id?: number;
    test_matrix_id?: string;
    error?: string;
  }> {
    // Verify APK exists
    try {
      await access(submission.apk_path);
    } catch {
      return { success: false, error: `APK not found: ${submission.apk_path}` };
    }

    // Insert test run record (pending)
    const insertResult = await this.pool.query(
      `INSERT INTO mobile_test_runs
       (project_id, platform, device_model, os_version, test_type, status)
       VALUES ($1, 'android', $2, $3, $4, 'pending')
       RETURNING id`,
      [submission.project_id, submission.device_model, submission.os_version, submission.test_type]
    );
    const testRunId = insertResult.rows[0].id;

    try {
      // Build gcloud command
      let cmd: string;
      const timeout = submission.timeout_minutes || 10;
      const resultsDir = `${this.resultsBucket}/run-${testRunId}`;

      if (submission.test_type === 'robo') {
        // Robo test (no test APK needed)
        cmd = `gcloud firebase test android run \
          --type=robo \
          --app="${submission.apk_path}" \
          --device model=${submission.device_model},version=${submission.os_version} \
          --timeout=${timeout}m \
          --results-bucket="${this.resultsBucket}" \
          --results-dir="run-${testRunId}" \
          --project="${this.firebaseProjectId}" \
          --format=json \
          --no-auto-google-login 2>&1`;
      } else {
        // Instrumentation test
        if (!submission.test_apk_path) {
          return { success: false, error: 'test_apk_path required for instrumentation tests' };
        }
        cmd = `gcloud firebase test android run \
          --type=instrumentation \
          --app="${submission.apk_path}" \
          --test="${submission.test_apk_path}" \
          --device model=${submission.device_model},version=${submission.os_version} \
          --timeout=${timeout}m \
          --results-bucket="${this.resultsBucket}" \
          --results-dir="run-${testRunId}" \
          --project="${this.firebaseProjectId}" \
          --format=json \
          --no-auto-google-login 2>&1`;
      }

      // Update status to running
      await this.pool.query(
        'UPDATE mobile_test_runs SET status = $1 WHERE id = $2',
        ['running', testRunId]
      );

      // Execute test (this runs async in Firebase)
      const { stdout } = await execAsync(cmd, { timeout: (timeout + 5) * 60 * 1000 });

      // Parse test matrix ID from output
      let testMatrixId: string | undefined;
      try {
        const parsed = JSON.parse(stdout);
        testMatrixId = parsed?.testMatrixId || parsed?.id;
      } catch {
        // Try to extract from text output
        const match = stdout.match(/matrix-[a-z0-9]+/);
        testMatrixId = match ? match[0] : undefined;
      }

      // Update with matrix ID
      await this.pool.query(
        'UPDATE mobile_test_runs SET test_matrix_id = $1 WHERE id = $2',
        [testMatrixId, testRunId]
      );

      return {
        success: true,
        test_run_id: testRunId,
        test_matrix_id: testMatrixId,
      };
    } catch (error: any) {
      // Update status to error
      await this.pool.query(
        'UPDATE mobile_test_runs SET status = $1, failure_reason = $2, completed_at = NOW() WHERE id = $3',
        ['error', error.message, testRunId]
      );

      return {
        success: false,
        test_run_id: testRunId,
        error: error.message,
      };
    }
  }

  /**
   * Check test results by test run ID
   */
  async getTestResults(testRunId: number): Promise<TestResult | null> {
    const result = await this.pool.query(
      'SELECT * FROM mobile_test_runs WHERE id = $1',
      [testRunId]
    );

    if (result.rows.length === 0) return null;

    const run = result.rows[0];

    // If still running, check gcloud for updates
    if (run.status === 'running' && run.test_matrix_id) {
      try {
        const { stdout } = await execAsync(
          `gcloud firebase test android operations describe ${run.test_matrix_id} \
           --project="${this.firebaseProjectId}" \
           --format=json 2>&1`,
          { timeout: 15000 }
        );
        const status = JSON.parse(stdout);

        if (status.done) {
          const passed = !status.error;
          await this.pool.query(
            `UPDATE mobile_test_runs
             SET status = $1, completed_at = NOW(),
                 test_duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER,
                 failure_reason = $2,
                 results_url = $3
             WHERE id = $4`,
            [
              passed ? 'passed' : 'failed',
              status.error?.message || null,
              `https://console.firebase.google.com/project/${this.firebaseProjectId}/testlab/histories`,
              testRunId,
            ]
          );

          run.status = passed ? 'passed' : 'failed';
          run.failure_reason = status.error?.message;
        }
      } catch {
        // gcloud check failed, return current DB state
      }
    }

    return {
      test_run_id: run.id,
      status: run.status,
      duration_seconds: run.test_duration_seconds || 0,
      results_url: run.results_url || '',
      artifacts_path: run.artifacts_path || '',
      failure_reason: run.failure_reason,
    };
  }

  /**
   * Get today's quota usage
   */
  async getQuotaUsage(): Promise<{
    minutes_used: number;
    minutes_remaining: number;
    runs_today: number;
  }> {
    const result = await this.pool.query(`
      SELECT
        COALESCE(SUM(test_duration_seconds), 0) / 60.0 as minutes_used,
        COUNT(*) as runs_today
      FROM mobile_test_runs
      WHERE started_at >= CURRENT_DATE
    `);

    const used = Math.ceil(parseFloat(result.rows[0].minutes_used));
    return {
      minutes_used: used,
      minutes_remaining: Math.max(0, 60 - used),
      runs_today: parseInt(result.rows[0].runs_today),
    };
  }
}
