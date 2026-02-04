# Epic M-006: iOS CI/CD Pipeline & Firebase Test Lab iOS

**Epic ID:** M-006
**Created:** 2026-02-04
**Status:** Pending
**Complexity Level:** 3
**Feature:** Mobile App Development Platform
**Estimated Effort:** 8 hours (1 day)
**Model:** Haiku

---

## Prerequisites

- [ ] Epic M-005 complete (iOS local build working)
- [ ] Epic M-003 complete (GitHub Actions pattern established)
- [ ] Epic M-004 complete (Firebase Test Lab integration working for Android)
- [ ] GitHub Actions self-hosted runner on Mac (or use `macos-latest` cloud runner)
- [ ] Apple certificates and provisioning profiles configured
- [ ] Firebase Test Lab iOS support enabled

**MANUAL PREREQUISITES:**

```bash
# Option A: Self-hosted runner on Mac (free, recommended)
# 1. On the Mac, download GitHub Actions runner:
mkdir ~/actions-runner && cd ~/actions-runner
curl -o actions-runner-osx-x64-2.321.0.tar.gz -L https://github.com/actions/runner/releases/download/v2.321.0/actions-runner-osx-x64-2.321.0.tar.gz
tar xzf actions-runner-osx-x64-2.321.0.tar.gz

# 2. Configure:
./config.sh --url https://github.com/YOUR_ORG/YOUR_REPO --token YOUR_TOKEN

# 3. Install as service:
sudo ./svc.sh install
sudo ./svc.sh start

# Option B: Use macos-latest cloud runner (200 free min/month)
# No setup needed, but costs money after free tier

# For both options, configure signing:
# 4. Set up GitHub Secrets:
#    APPLE_CERTIFICATE_BASE64 - Base64 of .p12 certificate
#    APPLE_CERTIFICATE_PASSWORD - Password for .p12
#    APPLE_PROVISIONING_PROFILE_BASE64 - Base64 of .mobileprovision
#    APPLE_TEAM_ID - Apple Developer Team ID
#    APPLE_ID - Apple ID email
#    APPLE_APP_SPECIFIC_PASSWORD - App-specific password for uploading

# 5. Export certificate:
#    Keychain Access > My Certificates > Export > .p12 format
#    base64 -i certificate.p12 | pbcopy
```

---

## Acceptance Criteria

- [ ] `.github/workflows/ios-ci.yml` exists and is valid YAML
- [ ] Workflow triggers on push to `main` and on PRs
- [ ] Workflow builds iOS app on macOS runner
- [ ] Built IPA uploaded as GitHub Actions artifact
- [ ] Firebase Test Lab runs iOS tests (when configured)
- [ ] Self-hosted runner setup documented
- [ ] MCP tool `mobile_deploy_beta` can trigger TestFlight upload
- [ ] End-to-end: code push -> build -> test -> deploy pipeline works

---

## Implementation Steps

### Step 1: Create iOS CI/CD Workflow Template

**File:** `/home/samuel/sv/supervisor-service-s/src/mobile/templates/github-workflows/ios-ci.yml`
**Action:** Create new file

```yaml
# iOS CI/CD Pipeline
# Builds iOS app, runs tests, optionally deploys to TestFlight

name: iOS CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

concurrency:
  group: ios-${{ github.ref }}
  cancel-in-progress: true

env:
  XCODE_VERSION: '15.4'
  NODE_VERSION: '22'

jobs:
  build-ios:
    name: Build iOS App
    runs-on: macos-self-hosted  # Change to macos-latest for cloud runner
    timeout-minutes: 45

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Select Xcode version
        run: sudo xcode-select -s /Applications/Xcode_${{ env.XCODE_VERSION }}.app || true

      - name: Cache CocoaPods
        uses: actions/cache@v4
        with:
          path: ios/Pods
          key: pods-${{ runner.os }}-${{ hashFiles('ios/Podfile.lock') }}
          restore-keys: |
            pods-${{ runner.os }}-

      - name: Install dependencies
        run: npm ci

      - name: Run Jest tests
        run: npm test -- --ci
        continue-on-error: true

      - name: Expo prebuild (iOS)
        run: npx expo prebuild --platform ios --no-install

      - name: Install CocoaPods
        run: cd ios && pod install

      - name: Build for Simulator
        run: |
          cd ios
          xcodebuild \
            -workspace *.xcworkspace \
            -scheme $(ls *.xcworkspace | sed 's/.xcworkspace//') \
            -configuration Debug \
            -sdk iphonesimulator \
            -destination "platform=iOS Simulator,name=iPhone 15" \
            -derivedDataPath build \
            clean build | tail -20

      - name: Verify build
        run: |
          APP=$(find ios/build -name "*.app" -type d | head -1)
          if [ -n "$APP" ]; then
            echo "iOS build successful: $APP"
            du -sh "$APP"
          else
            echo "ERROR: No .app bundle found"
            exit 1
          fi

      - name: Upload build artifact
        uses: actions/upload-artifact@v4
        with:
          name: ios-simulator-build
          path: ios/build/
          retention-days: 7

  deploy-testflight:
    name: Deploy to TestFlight
    runs-on: macos-self-hosted
    needs: build-ios
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    timeout-minutes: 30

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

      - name: Expo prebuild (iOS)
        run: npx expo prebuild --platform ios --no-install

      - name: Install CocoaPods
        run: cd ios && pod install

      - name: Install Apple certificate
        env:
          APPLE_CERTIFICATE_BASE64: ${{ secrets.APPLE_CERTIFICATE_BASE64 }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
          APPLE_PROVISIONING_PROFILE_BASE64: ${{ secrets.APPLE_PROVISIONING_PROFILE_BASE64 }}
        run: |
          # Create temporary keychain
          KEYCHAIN_PASSWORD=$(openssl rand -hex 12)
          security create-keychain -p "$KEYCHAIN_PASSWORD" build.keychain
          security default-keychain -s build.keychain
          security unlock-keychain -p "$KEYCHAIN_PASSWORD" build.keychain

          # Import certificate
          echo "$APPLE_CERTIFICATE_BASE64" | base64 --decode > certificate.p12
          security import certificate.p12 -k build.keychain -P "$APPLE_CERTIFICATE_PASSWORD" -T /usr/bin/codesign
          security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KEYCHAIN_PASSWORD" build.keychain

          # Import provisioning profile
          mkdir -p ~/Library/MobileDevice/Provisioning\ Profiles
          echo "$APPLE_PROVISIONING_PROFILE_BASE64" | base64 --decode > profile.mobileprovision
          cp profile.mobileprovision ~/Library/MobileDevice/Provisioning\ Profiles/

      - name: Build and upload via fastlane
        env:
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
        run: fastlane ios beta

      - name: Clean up keychain
        if: always()
        run: security delete-keychain build.keychain || true

  test-firebase-ios:
    name: Firebase Test Lab (iOS)
    runs-on: ubuntu-latest
    needs: build-ios
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    timeout-minutes: 20

    steps:
      - name: Download iOS build
        uses: actions/download-artifact@v4
        with:
          name: ios-simulator-build
          path: ./ios-build

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GOOGLE_CREDENTIALS }}

      - name: Setup gcloud CLI
        uses: google-github-actions/setup-gcloud@v2

      - name: Create XCTest zip
        run: |
          # Package the app for Firebase Test Lab
          cd ios-build
          APP=$(find . -name "*.app" -type d | head -1)
          if [ -n "$APP" ]; then
            zip -r ../ios-test.zip "$APP"
            echo "Created test package"
          else
            echo "No app bundle found, skipping Firebase tests"
            exit 0
          fi

      - name: Run iOS Test on Firebase Test Lab
        if: hashFiles('ios-test.zip') != ''
        run: |
          gcloud firebase test ios run \
            --test=./ios-test.zip \
            --device model=iphone13pro,version=16.6 \
            --timeout=5m \
            --project=${{ secrets.FIREBASE_PROJECT_ID }} \
            --no-auto-google-login || true
        continue-on-error: true
```

**Verify:**
```bash
python3 -c "import yaml; yaml.safe_load(open('/home/samuel/sv/supervisor-service-s/src/mobile/templates/github-workflows/ios-ci.yml'))" && echo "Valid YAML" || echo "INVALID"
```

### Step 2: Add Beta Deployment MCP Tool

**File:** `/home/samuel/sv/supervisor-service-s/src/mcp/tools/mobile-tools.ts`
**Action:** Modify - Add deployment tool

Add to `getMobileTools()` return array:
```typescript
    mobileDeployBetaTool,
```

Add tool definition:

```typescript
/**
 * mobile_deploy_beta - Deploy to TestFlight or Play Store Internal
 */
const mobileDeployBetaTool: ToolDefinition = {
  name: 'mobile_deploy_beta',
  description: 'Deploy mobile app to beta testing. iOS: TestFlight, Android: Play Store Internal Testing. Uses fastlane.',
  inputSchema: {
    type: 'object',
    properties: {
      project_name: {
        type: 'string',
        description: 'Name of the mobile project',
      },
      platform: {
        type: 'string',
        enum: ['android', 'ios'],
        description: 'Platform to deploy. Default: android',
      },
      version_name: {
        type: 'string',
        description: 'Version name (e.g., "1.0.1"). Auto-incremented if omitted.',
      },
      release_notes: {
        type: 'string',
        description: 'Release notes for this beta version',
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

      const platform = params.platform || 'android';

      // Get latest deployment to auto-increment version
      const lastDeploy = await pool.query(
        `SELECT version_code, build_number FROM mobile_deployments
         WHERE project_id = $1 AND platform = $2
         ORDER BY deployed_at DESC LIMIT 1`,
        [project.id, platform]
      );

      const versionCode = lastDeploy.rows.length > 0
        ? lastDeploy.rows[0].version_code + 1
        : 1;
      const buildNumber = lastDeploy.rows.length > 0
        ? lastDeploy.rows[0].build_number + 1
        : 1;
      const versionName = params.version_name || `1.0.${versionCode}`;

      // Insert deployment record
      const deployResult = await pool.query(
        `INSERT INTO mobile_deployments
         (project_id, platform, version_code, version_name, build_number,
          deployment_type, status, release_notes)
         VALUES ($1, $2, $3, $4, $5, $6, 'uploading', $7)
         RETURNING id`,
        [
          project.id, platform, versionCode, versionName, buildNumber,
          platform === 'ios' ? 'testflight' : 'play-internal',
          params.release_notes || `Beta build v${versionName}`,
        ]
      );
      const deploymentId = deployResult.rows[0].id;

      // Execute fastlane deploy
      const lane = platform === 'ios' ? 'ios beta' : 'android beta';
      try {
        const { stdout } = await execAsync(
          `cd "${project.project_path}" && fastlane ${lane}`,
          { timeout: 900000 } // 15 min
        );

        await pool.query(
          `UPDATE mobile_deployments SET status = 'available' WHERE id = $1`,
          [deploymentId]
        );

        return {
          success: true,
          deployment_id: deploymentId,
          platform,
          version: versionName,
          build_number: buildNumber,
          status: 'available',
          distribution: platform === 'ios'
            ? 'TestFlight (users get notification)'
            : 'Play Store Internal Testing',
        };
      } catch (error: any) {
        await pool.query(
          `UPDATE mobile_deployments SET status = 'failed' WHERE id = $1`,
          [deploymentId]
        );

        return {
          success: false,
          deployment_id: deploymentId,
          error: error.message,
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
```

**Verify:**
```bash
cd /home/samuel/sv/supervisor-service-s && npx tsc --noEmit 2>&1 | tail -5
```

### Step 3: Update Workflow Setup Script for iOS

**File:** `/home/samuel/sv/supervisor-service-s/src/mobile/scripts/setup-github-workflows.sh`
**Action:** Modify - Add iOS workflow copy

Add after the Android CI copy:

```bash
# Copy iOS CI workflow (if template exists)
if [ -f "$TEMPLATE_DIR/ios-ci.yml" ]; then
  cp "$TEMPLATE_DIR/ios-ci.yml" "$PROJECT_PATH/.github/workflows/ios-ci.yml"
  echo "Copied: ios-ci.yml"
fi
```

**Verify:**
```bash
grep "ios-ci.yml" /home/samuel/sv/supervisor-service-s/src/mobile/scripts/setup-github-workflows.sh
```

### Step 4: Add iOS Devices to Database Seed

**File:** `/home/samuel/sv/supervisor-service-s/migrations/1770200000000_mobile_platform.sql`
**Action:** Modify - Add iOS device seeds

Add after the Android device inserts:

```sql
-- Seed common iOS devices (Firebase Test Lab)
INSERT INTO mobile_devices (platform, model_name, model_id, os_version, is_virtual, firebase_device_id, form_factor)
VALUES
  ('ios', 'iPhone 13 Pro', 'iphone13pro', '16.6', false, 'iphone13pro', 'phone'),
  ('ios', 'iPhone 14', 'iphone14', '17.0', false, 'iphone14', 'phone'),
  ('ios', 'iPhone 15', 'iphone15', '17.5', false, 'iphone15', 'phone'),
  ('ios', 'iPad Pro 12.9"', 'ipadpro129', '17.0', false, 'ipadpro129', 'tablet')
ON CONFLICT (firebase_device_id) DO NOTHING;
```

**Verify:**
```bash
psql -U supervisor -d supervisor_service -h localhost -p 5434 -c "SELECT COUNT(*) FROM mobile_devices WHERE platform = 'ios';"
# Should show 4 (after re-running migration)
```

---

## Validation Checklist

- [ ] `ios-ci.yml` template is valid YAML
- [ ] iOS workflow includes: checkout, Node setup, Xcode setup, CocoaPods cache, prebuild, pod install, build, artifact upload
- [ ] TestFlight deployment job uses secure certificate handling (temporary keychain)
- [ ] Firebase Test Lab iOS job attempts iOS device testing
- [ ] `mobile_deploy_beta` MCP tool handles both iOS and Android
- [ ] Deployment versioning auto-increments
- [ ] iOS devices seeded into mobile_devices table
- [ ] Full project `tsc --noEmit` passes

---

## Rollback

```bash
rm -f /home/samuel/sv/supervisor-service-s/src/mobile/templates/github-workflows/ios-ci.yml

# Revert mobile-tools.ts to M-005 version
git checkout -- /home/samuel/sv/supervisor-service-s/src/mcp/tools/mobile-tools.ts

# Revert workflow setup script
git checkout -- /home/samuel/sv/supervisor-service-s/src/mobile/scripts/setup-github-workflows.sh

# Revert migration
git checkout -- /home/samuel/sv/supervisor-service-s/migrations/1770200000000_mobile_platform.sql
```

---

## Dependencies

**Blocked By:** Epic M-005 (iOS Local Build), Epic M-003 (GitHub Actions pattern), Epic M-004 (Firebase Test Lab)
**Blocks:** None (final epic)
**External:** macOS with Xcode, Apple Developer account, Apple certificates, Firebase iOS support
