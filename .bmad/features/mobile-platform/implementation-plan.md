# Implementation Plan: Mobile Platform

**Created:** 2026-02-04
**Author:** Opus 4.5 (Planning Agent)
**Status:** Ready for Immediate Implementation
**Feature:** mobile-platform
**PRD Version:** 2.0.0

---

## Overview

This document is the complete handoff for implementing the Mobile App Development Platform. All open questions have been resolved, all epics are Haiku-safe, and the parallelization roadmap is defined. A subagent receiving this document has everything needed to begin implementation immediately.

---

## Resolved Decisions

| Decision | Choice | Impact |
|----------|--------|--------|
| Platform priority | **Android first** | M-001 through M-004 are Android-only; iOS comes in M-005/M-006 |
| Framework | **React Native (Expo ~52.0.0)** | TypeScript everywhere, code sharing, Expo managed workflow |
| Testing | **Firebase Test Lab (free tier: 60 min/day)** | gcloud CLI integration, virtual + physical devices |
| CI/CD | **GitHub Actions (free: 2000 min/month Linux)** | Cloud runners for Android, self-hosted Mac for iOS |
| iOS build strategy | **Self-hosted GitHub Actions runner on Mac** | Avoids $100+/mo macOS cloud runner costs |
| Epic structure | **6 redesigned epics (M-001 to M-006)** | Replaces original 9 epics (031-039) |

---

## Epic Summary

| # | Epic | Effort | Key Deliverables |
|---|------|--------|-----------------|
| M-001 | React Native Project Template & DB Schema | 8h | DB migration, MobileProjectManager, 5 MCP tools, project scaffold |
| M-002 | Android Local Build & Emulator Testing | 8h | AndroidBuildManager, build script, 3 MCP tools |
| M-003 | GitHub Actions Android CI/CD | 6h | android-ci.yml workflow, setup script, 2 MCP tools |
| M-004 | Firebase Test Lab Integration | 8h | FirebaseTestLabClient, 2 MCP tools, CI integration |
| M-005 | iOS Local Build & Simulator | 8h | IOSBuildManager, Fastfile template, 2 MCP tools |
| M-006 | iOS CI/CD & Firebase iOS | 8h | ios-ci.yml workflow, deploy tool, iOS device seeds |

**Total: 46 hours (~6 working days)**

---

## Dependency Graph

```
M-001 (Foundation)
  |
  v
M-002 (Android Local Build)
  |
  +---------------------------+
  |                           |
  v                           v
M-003 (GitHub Actions)     M-005 (iOS Local Build)   <-- CAN PARALLEL
  |                           |
  v                           |
M-004 (Firebase Test Lab)     |
  |                           |
  +---------------------------+
  |
  v
M-006 (iOS CI/CD + Deploy)
```

### Sequential Path (Critical Path)

```
M-001 --> M-002 --> M-003 --> M-004 --> M-006
                                          ^
                              M-005 ------+
```

**Critical path time:** 38 hours (M-001 + M-002 + M-003 + M-004 + M-006)
**With parallelization:** 38 hours (M-005 runs parallel with M-003+M-004)

---

## Parallelization Roadmap

### What CAN Run in Parallel

| Parallel Group | Epics | Condition |
|---------------|-------|-----------|
| Group A | M-003 + M-005 | After M-002 completes, M-003 (Android CI) and M-005 (iOS local) are independent |
| Group B | M-004 runs after M-003 | Must be sequential (Firebase needs CI artifacts) |

### Recommended Execution Order

**Option 1: Fully Sequential (Safer, recommended)**
```
Session 1 (Day 1):   M-001 (Foundation)
Session 2 (Day 2):   M-002 (Android Local Build)
Session 3 (Day 3):   M-003 (GitHub Actions Android)
Session 4 (Day 4):   M-004 (Firebase Test Lab)
Session 5 (Day 5):   M-005 (iOS Local Build)
Session 6 (Day 6):   M-006 (iOS CI/CD + Deploy)
```

**Option 2: With Parallelization (Saves ~1 day)**
```
Session 1 (Day 1):   M-001 (Foundation)
Session 2 (Day 2):   M-002 (Android Local Build)
Session 3 (Day 3):   M-003 (Android CI) || M-005 (iOS Local)  <-- parallel
Session 4 (Day 4):   M-004 (Firebase Test Lab)
Session 5 (Day 5):   M-006 (iOS CI/CD + Deploy)
```

**Parallelization constraints for M-003 || M-005:**
- M-003 runs on odin3 (Linux) -- no Mac needed
- M-005 runs on Mac -- no odin3 conflict
- Two separate subagents required
- No shared files between them (M-003 creates `android-ci.yml`, M-005 creates `IOSBuildManager.ts`)
- Both modify `mobile-tools.ts` -- MERGE CONFLICT RISK. Assign M-005 tools to a separate file (`mobile-ios-tools.ts`) if running in parallel

---

## Handoff Points (Context Window Management)

| After | Context ~% | Handoff Content |
|-------|-----------|-----------------|
| M-001 + M-002 | ~50% | "Android local build working, APK path, DB tables created" |
| M-003 + M-004 | ~80% | "Android CI pipeline complete, Firebase Test Lab integrated, workflow files listed" |
| M-005 (fresh) | ~30% | "Start iOS build on Mac" |
| M-006 | 100% | "Mobile platform complete" |

### Handoff Template

```
## Handoff: Mobile Platform - After M-00X

**Date:** YYYY-MM-DD HH:MM
**Context:** XX%
**Next Epic:** M-00Y

### Completed
- [x] M-001: DB schema + 5 MCP tools + project scaffold
- [x] M-002: AndroidBuildManager + 3 MCP tools + build script

### State
- Database: 4 tables created (mobile_projects, mobile_test_runs, mobile_deployments, mobile_devices)
- MCP tools: 8 registered (5 from M-001, 3 from M-002)
- Test project: /home/samuel/sv/test-app-s/ (if created during testing)
- APK path: /home/samuel/sv/test-app-s/android/app/build/outputs/apk/debug/app-debug.apk

### Verify Before Continuing
psql -U supervisor -d supervisor_service -h localhost -p 5434 -c "\dt mobile_*"
cd /home/samuel/sv/supervisor-service-s && npx tsc --noEmit 2>&1 | tail -3

### Next Steps
1. Start Epic M-003 (GitHub Actions Android CI/CD)
2. Read: .bmad/features/mobile-platform/epics/epic-M-003-github-actions-android.md
```

---

## Manual Prerequisites Checklist

These must be completed BY THE USER before certain epics can execute.

### Before M-001 (No prerequisites -- can start immediately)

Nothing needed. M-001 only creates database tables, TypeScript code, and templates.

### Before M-002 (Android SDK Required)

```bash
# Install JDK 17
sudo apt update && sudo apt install -y openjdk-17-jdk

# Install Android command-line tools
mkdir -p /home/samuel/Android/Sdk/cmdline-tools
cd /tmp
wget https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip commandlinetools-linux-11076708_latest.zip
mv cmdline-tools /home/samuel/Android/Sdk/cmdline-tools/latest

# Environment variables (add to ~/.bashrc)
echo 'export ANDROID_HOME=/home/samuel/Android/Sdk' >> ~/.bashrc
echo 'export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator' >> ~/.bashrc
source ~/.bashrc

# Accept licenses and install SDK
sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"

# Verify
java --version        # Should show 17+
sdkmanager --version  # Should show version
```

**Estimated time:** 30-60 minutes
**Cost:** Free

### Before M-004 (Firebase Project Required)

```bash
# 1. Create Firebase project at https://console.firebase.google.com
# 2. Enable Test Lab API
# 3. Create service account with firebase.testlab.admin role
# 4. Download service account JSON key
# 5. Install gcloud CLI if not present
# 6. Authenticate: gcloud auth activate-service-account --key-file=key.json
# 7. Store in vault + .env: FIREBASE_PROJECT_ID=xxx
```

**Estimated time:** 30 minutes
**Cost:** Free (Test Lab has 60 min/day free tier)

### Before M-005 (macOS + Xcode Required)

```bash
# On the Mac:
# 1. Install Xcode from App Store (~25GB, takes 1-4 hours)
sudo xcodebuild -license accept
xcode-select --install
sudo gem install cocoapods
sudo gem install fastlane -NV

# 2. Verify
xcodebuild -version   # Xcode 15+
pod --version          # 1.14+
fastlane --version     # 2.220+
```

**Estimated time:** 2-4 hours (mostly Xcode download)
**Cost:** Free (Xcode is free, Apple Developer account $99/year)

### Before M-006 (Apple Developer + GitHub Runner Required)

```bash
# 1. Enroll in Apple Developer Program ($99/year)
# 2. Create App ID + provisioning profiles
# 3. Export certificate as .p12
# 4. Set up self-hosted GitHub Actions runner on Mac
# 5. Configure GitHub Secrets (certificates, Apple credentials)
```

**Estimated time:** 1-2 hours (Apple enrollment can take 1-2 days)
**Cost:** $99/year

---

## File Inventory (What Gets Created)

### New Files

| File | Epic | Type |
|------|------|------|
| `migrations/1770200000000_mobile_platform.sql` | M-001 | Database migration |
| `src/mobile/MobileProjectManager.ts` | M-001 | TypeScript class |
| `src/mcp/tools/mobile-tools.ts` | M-001+ | MCP tool definitions |
| `src/mobile/AndroidBuildManager.ts` | M-002 | TypeScript class |
| `src/mobile/scripts/build-android.sh` | M-002 | Shell script |
| `src/mobile/templates/jest.config.js` | M-002 | Template |
| `src/mobile/templates/github-workflows/android-ci.yml` | M-003 | YAML template |
| `src/mobile/scripts/setup-github-workflows.sh` | M-003 | Shell script |
| `src/mobile/FirebaseTestLabClient.ts` | M-004 | TypeScript class |
| `src/mobile/IOSBuildManager.ts` | M-005 | TypeScript class |
| `src/mobile/templates/fastlane/Fastfile` | M-005 | Ruby template |
| `src/mobile/templates/github-workflows/ios-ci.yml` | M-006 | YAML template |
| `templates/mobile-claude-template.md` | M-001 | Markdown template |

### Modified Files

| File | Epic | Change |
|------|------|--------|
| `src/mcp/tools/index.ts` | M-001 | Add import + registration of mobile tools |
| `.env.example` | M-004 | Add Firebase environment variables |

### Generated Files (per mobile project)

When `mobile_create_project` is called, it creates:
```
/home/samuel/sv/{project-name}-s/
  package.json
  app.json
  tsconfig.json
  App.tsx
  .gitignore
  src/
    components/
    screens/HomeScreen.tsx
    navigation/RootNavigator.tsx
    services/
    hooks/
    types/
    utils/
  assets/
  __tests__/HomeScreen.test.tsx
  .bmad/
    features/
    epics/
    adr/
    workflow-status.yaml
  .supervisor-core/
  .supervisor-specific/
  .github/
    workflows/android-ci.yml
  fastlane/
    Fastfile
```

---

## Deployment Sequence

### Step 1: Implement on odin3 (Epics M-001 through M-004)

```
odin3 (gcp-odin3-vm):
  - PostgreSQL (localhost:5434) -- mobile_* tables added
  - MCP Server (localhost:8081) -- mobile_* tools registered
  - Android SDK (/home/samuel/Android/Sdk) -- installed manually
  - Node.js v22 -- already present
```

After M-004 completes, the entire Android pipeline works end-to-end:
1. `mobile_create_project` creates scaffold
2. `mobile_build_android` builds APK locally
3. Push to GitHub triggers android-ci.yml
4. `mobile_run_tests` submits to Firebase Test Lab
5. `mobile_get_test_results` retrieves results

### Step 2: Extend to Mac (Epics M-005 and M-006)

```
Mac (MacBook):
  - Xcode + fastlane -- installed manually
  - GitHub Actions self-hosted runner -- configured
  - SSH access from odin3 -- for IOSBuildManager
```

After M-006 completes, iOS pipeline adds:
6. `mobile_build_ios` builds IPA on Mac
7. `ios-ci.yml` triggers on push
8. `mobile_deploy_beta` uploads to TestFlight/Play Store

### Step 3: Verify End-to-End

```bash
# Create test project
# (via MCP tool: mobile_create_project)

# Build Android
cd /home/samuel/sv/test-app-s
npm install
npx expo prebuild --platform android --no-install
cd android && ./gradlew assembleDebug

# Verify APK
ls -la android/app/build/outputs/apk/debug/app-debug.apk

# Push to GitHub
git init && git add . && git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_ORG/test-app.git
git push -u origin main

# Check GitHub Actions
gh run list --workflow="Android CI"

# Submit to Firebase Test Lab
# (via MCP tool: mobile_run_tests)

# Deploy beta
# (via MCP tool: mobile_deploy_beta)
```

---

## Risk Mitigation

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Android SDK install issues on odin3 | Medium | M-002 has `mobile_check_sdk` tool that diagnoses missing components |
| Firebase quota exceeded | Low | `mobile_check_quota` monitors usage; fallback to emulator-only testing |
| Xcode download takes hours | High | Start download early; M-005 is after M-004 giving buffer time |
| GitHub Actions macOS minutes exhausted | Medium | Self-hosted runner on Mac avoids cloud costs entirely |
| Apple certificate complexity | Medium | ios-ci.yml uses temporary keychain pattern; documented in M-006 |
| Merge conflicts if M-003 + M-005 parallel | Medium | Can split iOS tools into separate file (`mobile-ios-tools.ts`) |

---

## Quality Gates

Each epic has built-in verification:

| Epic | Verification Command | Pass Criteria |
|------|---------------------|---------------|
| M-001 | `psql ... -c "\dt mobile_*"` | 4 tables exist |
| M-001 | `npx tsc --noEmit` | No TypeScript errors |
| M-002 | `ls android/app/build/outputs/apk/debug/app-debug.apk` | APK exists, >1MB |
| M-003 | `python3 -c "import yaml; yaml.safe_load(open('android-ci.yml'))"` | Valid YAML |
| M-004 | `gcloud firebase test android run --type=robo ...` | Test completes |
| M-005 | `xcodebuild ... clean build` | Build succeeds |
| M-006 | `python3 -c "import yaml; yaml.safe_load(open('ios-ci.yml'))"` | Valid YAML |

---

## Implementation Instructions for Subagent

**To begin implementation:**

1. Read this document completely
2. Start with Epic M-001: `/home/samuel/sv/supervisor-service-s/.bmad/features/mobile-platform/epics/epic-M-001-react-native-project-template.md`
3. Follow each step exactly as documented (file paths, code, verification)
4. After each epic, run the Validation Checklist
5. Commit after each epic: `feat: implement mobile platform M-00X - [title]`
6. If a verification fails, check the Rollback section before proceeding
7. Create handoff document if context exceeds 80%

**Subagent model recommendation:**
- M-001 through M-004: **Haiku** (all steps are explicit with exact code)
- M-005 and M-006: **Haiku** (same pattern, just iOS-specific)
- If Haiku fails 3 times on any epic: escalate to **Sonnet**

---

**Planning complete. Ready for immediate implementation.**

**Start command:** Implement Epic M-001 from `/home/samuel/sv/supervisor-service-s/.bmad/features/mobile-platform/epics/epic-M-001-react-native-project-template.md`
