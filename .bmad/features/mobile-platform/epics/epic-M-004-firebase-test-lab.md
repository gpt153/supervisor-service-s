# Epic M-004: Firebase Test Lab Integration

**Epic ID:** M-004
**Created:** 2026-02-04
**Status:** Pending
**Complexity Level:** 3
**Feature:** Mobile App Development Platform
**Estimated Effort:** 8 hours (1 day)
**Model:** Haiku

---

## Prerequisites

- [ ] Epic M-002 complete (can build APK locally)
- [ ] Epic M-003 complete (GitHub Actions builds APK)
- [ ] Firebase project created (manual step)
- [ ] Firebase Test Lab API enabled
- [ ] Service account JSON key created with Test Lab permissions
- [ ] `gcloud` CLI installed on odin3
- [ ] Service account key stored in vault: `project/mobile/firebase-service-account`

**MANUAL PREREQUISITES (must be done before this epic):**

```bash
# 1. Create Firebase project at https://console.firebase.google.com
# 2. Enable Test Lab API at https://console.cloud.google.com/apis/library/testing.googleapis.com
# 3. Create service account:
gcloud iam service-accounts create mobile-testlab \
  --display-name="Mobile Test Lab" \
  --project=YOUR_FIREBASE_PROJECT_ID

# 4. Grant Test Lab permissions:
gcloud projects add-iam-policy-binding YOUR_FIREBASE_PROJECT_ID \
  --member="serviceAccount:mobile-testlab@YOUR_FIREBASE_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/firebase.testlab.admin"

gcloud projects add-iam-policy-binding YOUR_FIREBASE_PROJECT_ID \
  --member="serviceAccount:mobile-testlab@YOUR_FIREBASE_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.objectViewer"

# 5. Create and download service account key:
gcloud iam service-accounts keys create /tmp/firebase-testlab-key.json \
  --iam-account=mobile-testlab@YOUR_FIREBASE_PROJECT_ID.iam.gserviceaccount.com

# 6. Store in vault:
# Use MCP tool: mcp_meta_set_secret('project/mobile/firebase-service-account', <contents>)

# 7. Add to GitHub Secrets (base64 encoded):
# GOOGLE_CREDENTIALS = base64 -w 0 /tmp/firebase-testlab-key.json
```

---

## Acceptance Criteria

- [ ] `FirebaseTestLabClient.ts` can authenticate with Firebase
- [ ] `mobile_run_tests` MCP tool submits APK to Firebase Test Lab
- [ ] Tests execute on at least one virtual Android device
- [ ] Test results (pass/fail, duration) stored in `mobile_test_runs` table
- [ ] `mobile_get_test_results` MCP tool retrieves results by test run ID
- [ ] Test artifacts (screenshots, logs) paths stored
- [ ] Quota tracking works (minutes used today)
- [ ] GitHub Actions workflow includes Firebase Test Lab step

---

## Implementation Steps

### Step 1: Create Firebase Test Lab Client

**File:** `/home/samuel/sv/supervisor-service-s/src/mobile/FirebaseTestLabClient.ts`
**Action:** Create new file

```typescript
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
import fs from 'fs/promises';
import path from 'path';
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
      await fs.access(submission.apk_path);
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
```

**Verify:**
```bash
cd /home/samuel/sv/supervisor-service-s && npx tsc --noEmit src/mobile/FirebaseTestLabClient.ts 2>&1 | head -10
```

### Step 2: Add Firebase Test MCP Tools

**File:** `/home/samuel/sv/supervisor-service-s/src/mcp/tools/mobile-tools.ts`
**Action:** Modify - Add Firebase test tools

Add import:
```typescript
import { FirebaseTestLabClient } from '../../mobile/FirebaseTestLabClient.js';
```

Add to `getMobileTools()` return array:
```typescript
    mobileRunTestsTool,
    mobileGetTestResultsTool,
```

Add tool definitions:

```typescript
/**
 * mobile_run_tests - Submit APK to Firebase Test Lab
 */
const mobileRunTestsTool: ToolDefinition = {
  name: 'mobile_run_tests',
  description: 'Submit an Android APK to Firebase Test Lab for testing on virtual or physical devices. Free tier: 60 min/day.',
  inputSchema: {
    type: 'object',
    properties: {
      project_name: {
        type: 'string',
        description: 'Name of the mobile project',
      },
      apk_path: {
        type: 'string',
        description: 'Path to the APK file to test. If omitted, uses latest debug build.',
      },
      device_model: {
        type: 'string',
        description: 'Firebase device model ID (e.g., "redfin" for Pixel 5). Default: redfin',
      },
      os_version: {
        type: 'string',
        description: 'Android API level (e.g., "30"). Default: 30',
      },
      test_type: {
        type: 'string',
        enum: ['robo', 'instrumentation'],
        description: 'Type of test. "robo" requires no test code. Default: robo',
      },
    },
    required: ['project_name'],
  },
  handler: async (params: any, context: ProjectContext) => {
    try {
      const pool = getPool();
      const projectManager = new MobileProjectManager(pool);
      const project = await projectManager.getProject(params.project_name);

      if (!project) {
        return { success: false, error: `Project "${params.project_name}" not found` };
      }

      // Get Firebase project ID from environment or vault
      const firebaseProjectId = process.env.FIREBASE_PROJECT_ID;
      if (!firebaseProjectId) {
        return {
          success: false,
          error: 'FIREBASE_PROJECT_ID not set. Configure in .env or vault.',
        };
      }

      const client = new FirebaseTestLabClient(pool, firebaseProjectId);

      // Authenticate
      const auth = await client.authenticate();
      if (!auth.success) {
        return { success: false, error: `Authentication failed: ${auth.error}` };
      }

      // Check quota
      const quota = await client.getQuotaUsage();
      if (quota.minutes_remaining <= 0) {
        return {
          success: false,
          error: 'Firebase Test Lab daily quota exceeded (60 min/day)',
          quota,
        };
      }

      // Determine APK path
      const apkPath = params.apk_path ||
        `${project.project_path}/android/app/build/outputs/apk/debug/app-debug.apk`;

      const result = await client.submitTest({
        project_id: project.id,
        apk_path: apkPath,
        device_model: params.device_model || 'redfin',
        os_version: params.os_version || '30',
        test_type: params.test_type || 'robo',
      });

      return {
        ...result,
        quota_remaining_minutes: quota.minutes_remaining,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

/**
 * mobile_get_test_results - Get Firebase Test Lab results
 */
const mobileGetTestResultsTool: ToolDefinition = {
  name: 'mobile_get_test_results',
  description: 'Get test results from Firebase Test Lab by test run ID',
  inputSchema: {
    type: 'object',
    properties: {
      test_run_id: {
        type: 'number',
        description: 'Test run ID from mobile_run_tests response',
      },
    },
    required: ['test_run_id'],
  },
  handler: async (params: any, context: ProjectContext) => {
    try {
      const pool = getPool();
      const firebaseProjectId = process.env.FIREBASE_PROJECT_ID;
      if (!firebaseProjectId) {
        return { success: false, error: 'FIREBASE_PROJECT_ID not set' };
      }

      const client = new FirebaseTestLabClient(pool, firebaseProjectId);
      const result = await client.getTestResults(params.test_run_id);

      if (!result) {
        return { success: false, error: `Test run ${params.test_run_id} not found` };
      }

      return { success: true, ...result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};
```

**Verify:**
```bash
cd /home/samuel/sv/supervisor-service-s && npx tsc --noEmit 2>&1 | tail -5
```

### Step 3: Add Firebase Test Lab Step to GitHub Actions

**File:** `/home/samuel/sv/supervisor-service-s/src/mobile/templates/github-workflows/android-ci.yml`
**Action:** Modify - Add Firebase Test Lab job

Add after the `build-android` job:

```yaml
  test-firebase:
    name: Firebase Test Lab
    runs-on: ubuntu-latest
    needs: build-android
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    timeout-minutes: 20

    steps:
      - name: Download APK artifact
        uses: actions/download-artifact@v4
        with:
          name: android-debug-apk
          path: ./artifacts

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GOOGLE_CREDENTIALS }}

      - name: Setup gcloud CLI
        uses: google-github-actions/setup-gcloud@v2

      - name: Run Robo Test on Firebase Test Lab
        run: |
          gcloud firebase test android run \
            --type=robo \
            --app=./artifacts/app-debug.apk \
            --device model=redfin,version=30 \
            --timeout=5m \
            --project=${{ secrets.FIREBASE_PROJECT_ID }} \
            --no-auto-google-login
        continue-on-error: true

      - name: Upload test results
        if: always()
        run: |
          echo "Firebase Test Lab results available at:"
          echo "https://console.firebase.google.com/project/${{ secrets.FIREBASE_PROJECT_ID }}/testlab/histories"
```

**Verify:**
```bash
python3 -c "import yaml; yaml.safe_load(open('/home/samuel/sv/supervisor-service-s/src/mobile/templates/github-workflows/android-ci.yml'))" && echo "Valid YAML" || echo "INVALID"
```

### Step 4: Add Firebase Configuration to .env.example

**File:** `/home/samuel/sv/supervisor-service-s/.env.example`
**Action:** Modify - Add Firebase environment variables

Append:
```bash
# Mobile Platform - Firebase Test Lab
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CREDENTIALS_PATH=/home/samuel/.config/firebase/testlab-key.json
```

**Verify:**
```bash
grep "FIREBASE" /home/samuel/sv/supervisor-service-s/.env.example
```

---

## Validation Checklist

- [ ] `FirebaseTestLabClient.ts` compiles without errors
- [ ] `mobile_run_tests` MCP tool is registered
- [ ] `mobile_get_test_results` MCP tool is registered
- [ ] GitHub Actions workflow includes Firebase Test Lab job
- [ ] Firebase Test Lab job only runs on push to main (not PRs)
- [ ] Quota tracking queries work correctly
- [ ] `.env.example` includes Firebase variables
- [ ] Full project `tsc --noEmit` passes

---

## Rollback

```bash
# Remove Firebase client
rm -f /home/samuel/sv/supervisor-service-s/src/mobile/FirebaseTestLabClient.ts

# Revert mobile-tools.ts
git checkout -- /home/samuel/sv/supervisor-service-s/src/mcp/tools/mobile-tools.ts

# Revert GitHub Actions workflow
git checkout -- /home/samuel/sv/supervisor-service-s/src/mobile/templates/github-workflows/android-ci.yml

# Revert .env.example
git checkout -- /home/samuel/sv/supervisor-service-s/.env.example
```

---

## Dependencies

**Blocked By:** Epic M-003 (GitHub Actions, for CI integration)
**Blocks:** None directly (M-005 and M-006 can start after M-002)
**External:** Firebase project + service account (manual setup required)
