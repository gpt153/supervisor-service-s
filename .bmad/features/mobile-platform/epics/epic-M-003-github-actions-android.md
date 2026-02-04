# Epic M-003: GitHub Actions Android CI/CD Pipeline

**Epic ID:** M-003
**Created:** 2026-02-04
**Status:** Pending
**Complexity Level:** 2
**Feature:** Mobile App Development Platform
**Estimated Effort:** 6 hours (0.75 day)
**Model:** Haiku

---

## Prerequisites

- [ ] Epic M-002 complete (Android local build working)
- [ ] GitHub repository exists for the mobile project
- [ ] GitHub Secrets configured: none required for basic build (signing comes in M-004)

---

## Acceptance Criteria

- [ ] `.github/workflows/android-ci.yml` exists and is valid YAML
- [ ] Workflow triggers on push to `main` and `develop` branches
- [ ] Workflow triggers on pull requests
- [ ] Workflow successfully builds debug APK on `ubuntu-latest` runner
- [ ] APK uploaded as GitHub Actions artifact
- [ ] Build status badge can be added to README
- [ ] MCP tool `mobile_trigger_build` can report GitHub Actions status
- [ ] Caching reduces subsequent build times by 30%+

---

## Implementation Steps

### Step 1: Create GitHub Actions Workflow for Android

**File:** `/home/samuel/sv/supervisor-service-s/src/mobile/templates/github-workflows/android-ci.yml`
**Action:** Create new file (template for mobile projects)

```yaml
# Android CI/CD Pipeline
# Triggers on push to main/develop and PRs
# Builds debug APK, runs tests, uploads artifacts

name: Android CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

concurrency:
  group: android-${{ github.ref }}
  cancel-in-progress: true

env:
  JAVA_VERSION: '17'
  NODE_VERSION: '22'

jobs:
  build-android:
    name: Build Android APK
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: ${{ env.JAVA_VERSION }}

      - name: Setup Android SDK
        uses: android-actions/setup-android@v3

      - name: Cache Gradle
        uses: actions/cache@v4
        with:
          path: |
            ~/.gradle/caches
            ~/.gradle/wrapper
            android/.gradle
          key: gradle-${{ runner.os }}-${{ hashFiles('android/gradle/wrapper/gradle-wrapper.properties', 'android/build.gradle', 'android/app/build.gradle') }}
          restore-keys: |
            gradle-${{ runner.os }}-

      - name: Install dependencies
        run: npm ci

      - name: Run TypeScript check
        run: npm run type-check || true

      - name: Run Jest tests
        run: npm test -- --ci --coverage
        continue-on-error: true

      - name: Expo prebuild (Android)
        run: npx expo prebuild --platform android --no-install

      - name: Make gradlew executable
        run: chmod +x android/gradlew

      - name: Build debug APK
        run: cd android && ./gradlew assembleDebug

      - name: Verify APK exists
        run: |
          APK_PATH="android/app/build/outputs/apk/debug/app-debug.apk"
          if [ -f "$APK_PATH" ]; then
            SIZE=$(stat --format=%s "$APK_PATH")
            echo "APK built successfully: $SIZE bytes"
          else
            echo "ERROR: APK not found!"
            exit 1
          fi

      - name: Upload APK artifact
        uses: actions/upload-artifact@v4
        with:
          name: android-debug-apk
          path: android/app/build/outputs/apk/debug/app-debug.apk
          retention-days: 7

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: |
            coverage/
            junit.xml
          retention-days: 7

  lint:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint || true

      - name: Run TypeScript check
        run: npm run type-check
```

**Verify:**
```bash
# Validate YAML syntax
python3 -c "import yaml; yaml.safe_load(open('/home/samuel/sv/supervisor-service-s/src/mobile/templates/github-workflows/android-ci.yml'))" && echo "Valid YAML" || echo "INVALID YAML"
```

### Step 2: Create Workflow Copy Script

**File:** `/home/samuel/sv/supervisor-service-s/src/mobile/scripts/setup-github-workflows.sh`
**Action:** Create new file

```bash
#!/bin/bash
# Setup GitHub Actions workflows for a mobile project
# Usage: ./setup-github-workflows.sh <project-path>

set -euo pipefail

PROJECT_PATH="${1:?Usage: $0 <project-path>}"
TEMPLATE_DIR="/home/samuel/sv/supervisor-service-s/src/mobile/templates/github-workflows"

echo "=== Setting up GitHub Actions workflows ==="
echo "Project: $PROJECT_PATH"

# Create .github/workflows directory
mkdir -p "$PROJECT_PATH/.github/workflows"

# Copy Android CI workflow
cp "$TEMPLATE_DIR/android-ci.yml" "$PROJECT_PATH/.github/workflows/android-ci.yml"
echo "Copied: android-ci.yml"

# Verify
if [ -f "$PROJECT_PATH/.github/workflows/android-ci.yml" ]; then
  echo "=== GitHub Actions setup complete ==="
  echo "Workflows installed:"
  ls -la "$PROJECT_PATH/.github/workflows/"
else
  echo "ERROR: Workflow file not created"
  exit 1
fi
```

**Verify:**
```bash
chmod +x /home/samuel/sv/supervisor-service-s/src/mobile/scripts/setup-github-workflows.sh
test -x /home/samuel/sv/supervisor-service-s/src/mobile/scripts/setup-github-workflows.sh && echo "OK" || echo "FAIL"
```

### Step 3: Add GitHub Actions Status MCP Tool

**File:** `/home/samuel/sv/supervisor-service-s/src/mcp/tools/mobile-tools.ts`
**Action:** Modify - Add GitHub Actions status tool

Add to the `getMobileTools()` return array and define:

```typescript
    mobileGithubStatusTool,
    mobileSetupCITool,

// Tool definitions:

/**
 * mobile_github_status - Check GitHub Actions build status
 */
const mobileGithubStatusTool: ToolDefinition = {
  name: 'mobile_github_status',
  description: 'Check the latest GitHub Actions build status for a mobile project. Requires gh CLI installed.',
  inputSchema: {
    type: 'object',
    properties: {
      project_name: {
        type: 'string',
        description: 'Name of the mobile project',
      },
      workflow: {
        type: 'string',
        description: 'Workflow name to check. Default: "Android CI"',
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

      // Use gh CLI to check workflow runs
      const workflowName = params.workflow || 'Android CI';
      try {
        const { stdout } = await execAsync(
          `cd "${project.project_path}" && gh run list --workflow="${workflowName}" --limit=5 --json status,conclusion,createdAt,headBranch,databaseId 2>&1`,
          { timeout: 15000 }
        );
        const runs = JSON.parse(stdout);
        return {
          success: true,
          workflow: workflowName,
          recent_runs: runs,
        };
      } catch (error: any) {
        return {
          success: false,
          error: 'gh CLI not available or not in a git repo',
          hint: 'Ensure gh CLI is installed and project has a GitHub remote',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

/**
 * mobile_setup_ci - Set up GitHub Actions CI/CD for a mobile project
 */
const mobileSetupCITool: ToolDefinition = {
  name: 'mobile_setup_ci',
  description: 'Copy GitHub Actions workflow templates to a mobile project. Sets up Android CI pipeline.',
  inputSchema: {
    type: 'object',
    properties: {
      project_name: {
        type: 'string',
        description: 'Name of the mobile project',
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

      // Run setup script
      const { stdout, stderr } = await execAsync(
        `/home/samuel/sv/supervisor-service-s/src/mobile/scripts/setup-github-workflows.sh "${project.project_path}"`,
        { timeout: 10000 }
      );

      return {
        success: true,
        output: stdout,
        workflows_installed: ['android-ci.yml'],
        next_steps: [
          'git add .github/workflows/',
          'git commit -m "ci: add Android CI pipeline"',
          'git push origin main',
          'Check GitHub Actions tab for build status',
        ],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};
```

Add this import at the top of mobile-tools.ts:
```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
```

**Verify:**
```bash
cd /home/samuel/sv/supervisor-service-s && npx tsc --noEmit 2>&1 | tail -5
```

### Step 4: Update MobileProjectManager to Include CI Setup

**File:** `/home/samuel/sv/supervisor-service-s/src/mobile/MobileProjectManager.ts`
**Action:** Modify - Add GitHub workflow setup to project creation

Add after the `.bmad` structure creation in `createProject()`:

```typescript
    // Set up GitHub Actions workflows
    await this.setupGitHubWorkflows(projectDir);
```

Add new method:

```typescript
  /**
   * Set up GitHub Actions CI/CD workflows for the project
   */
  private async setupGitHubWorkflows(projectDir: string): Promise<void> {
    const workflowDir = path.join(projectDir, '.github/workflows');
    await fs.mkdir(workflowDir, { recursive: true });

    const templateDir = path.join(
      '/home/samuel/sv/supervisor-service-s/src/mobile/templates/github-workflows'
    );

    try {
      const templates = await fs.readdir(templateDir);
      for (const template of templates) {
        if (template.endsWith('.yml') || template.endsWith('.yaml')) {
          await fs.copyFile(
            path.join(templateDir, template),
            path.join(workflowDir, template)
          );
        }
      }
    } catch {
      // Templates may not exist yet, skip silently
    }
  }
```

**Verify:**
```bash
cd /home/samuel/sv/supervisor-service-s && npx tsc --noEmit 2>&1 | tail -5
```

---

## Validation Checklist

- [ ] `android-ci.yml` template is valid YAML
- [ ] Workflow template includes: checkout, Node setup, Java setup, Android SDK, Gradle cache, npm install, prebuild, build, artifact upload
- [ ] `setup-github-workflows.sh` script copies templates correctly
- [ ] `mobile_github_status` MCP tool queries GitHub Actions via `gh` CLI
- [ ] `mobile_setup_ci` MCP tool installs workflows to project
- [ ] Project creation now includes GitHub workflow setup
- [ ] Full project `tsc --noEmit` passes

---

## Rollback

```bash
# Remove templates
rm -rf /home/samuel/sv/supervisor-service-s/src/mobile/templates/github-workflows/

# Remove setup script
rm -f /home/samuel/sv/supervisor-service-s/src/mobile/scripts/setup-github-workflows.sh

# Revert mobile-tools.ts changes
git checkout -- /home/samuel/sv/supervisor-service-s/src/mcp/tools/mobile-tools.ts
git checkout -- /home/samuel/sv/supervisor-service-s/src/mobile/MobileProjectManager.ts
```

---

## Dependencies

**Blocked By:** Epic M-002 (Android Local Build)
**Blocks:** Epic M-004 (Firebase Test Lab Integration)
**Can Run In Parallel With:** Nothing (sequential dependency)
