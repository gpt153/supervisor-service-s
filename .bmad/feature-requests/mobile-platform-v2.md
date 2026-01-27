# Mobile App Development Platform v2 (Redesigned)

**Created:** 2026-01-27
**Status:** Draft - Pending User Decisions
**Original:** `mobile-app-development-platform.md` (Epics 031-039)
**Priority:** DEFERRED (see Deferral Recommendation below)

---

## Executive Summary

This document redesigns the Mobile App Development Platform feature with new criteria:
- Haiku-safe epics (detailed implementation steps)
- Parallel building opportunities
- Incremental validation at each step
- Start simple (one platform first)
- Clear handoff points

**Key Change:** The original 9-epic plan was too ambitious. This redesign proposes a phased approach starting with minimal viable mobile capability.

---

## Deferral Recommendation

### Should This Be Built Now?

**Recommendation: DEFER for 2-4 weeks**

**Reasons to Defer:**
1. **PIV Loop Not Mature** - The autonomous supervision system is still being refined. Mobile adds complexity that could overwhelm the current infrastructure.
2. **No Current Mobile Projects** - There are no mobile apps in the SV system queue. Building infrastructure without immediate use leads to bit rot.
3. **Manual Prerequisites Required** - Apple Developer ($99/year), Google Play ($25), Firebase setup, Xcode installation - these require manual steps that should happen right before implementation.
4. **High Cost/Low Immediate Value** - Investment of 4-6 days for capability that won't be used immediately.
5. **UI-First Workflow Dependency** - The mobile platform benefits significantly from the UI-First workflow (feature request exists but not implemented).

**When to Build:**
- When a specific mobile app project is planned
- When PIV loops are stable (3+ successful feature implementations)
- When UI-First workflow is available (optional but recommended)

**Minimum Trigger:** User says "I want to build a mobile app for [X]"

---

## If Proceeding: Open Questions (User Decisions Required)

Before implementation, the user must decide:

### Q1: Which Platform First?

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **Android First** | Linux build (no Mac needed), cheaper testing, faster iteration | No iOS until Phase 2 | **Recommended** if no Mac time |
| **iOS First** | Larger market share, stricter quality | Requires Mac availability, $99/year Apple fee | If Mac is always available |

**Default if no answer:** Android first (simpler infrastructure)

### Q2: React Native vs Flutter?

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **React Native** | JS/TS ecosystem, larger community, Expo simplifies dev | Performance overhead, native module complexity | **Recommended** for web devs |
| **Flutter** | Better performance, Dart is cleaner, hot reload | New language (Dart), smaller ecosystem | For performance-critical apps |

**Default if no answer:** React Native (matches existing TypeScript expertise)

### Q3: Testing Strategy?

| Option | Cost | Coverage | Recommendation |
|--------|------|----------|----------------|
| **Emulator Only** | Free | 70% confidence | Development phase |
| **Firebase Test Lab** | Free tier (60 min/day) | 95% confidence | **Recommended** for CI |
| **AWS Device Farm** | $250/month | 99% confidence | Production only |

**Default if no answer:** Firebase Test Lab free tier

### Q4: CI/CD Platform?

| Option | Cost | Complexity | Recommendation |
|--------|------|------------|----------------|
| **GitHub Actions** | Free (2000 min/month) | Medium | **Recommended** |
| **Self-hosted** | Hardware cost | High | Not recommended |
| **CircleCI** | Paid for macOS | Low | If GitHub limits hit |

**Default if no answer:** GitHub Actions

---

## Simplified Epic Breakdown (If Proceeding)

### Original Plan (9 epics, 4-6 days)
Too ambitious. Covered both platforms, full CI/CD, all MCP tools simultaneously.

### Redesigned Plan: 4 Phases

#### Phase 1: Local Development Only (1.5 days)
Get one app running locally before any CI/CD or cloud testing.

**Epic M-001: React Native Project Template**
- Create project structure with .bmad/ folder
- Basic app that runs in emulator
- CLAUDE.md for mobile PS
- No CI/CD, no cloud testing

**Epic M-002: Android Local Build**
- Gradle configuration
- APK generation
- Run in local emulator
- Basic Espresso test that runs locally

#### Phase 2: Basic CI/CD (1 day)
Only after local development works.

**Epic M-003: GitHub Actions Android**
- Build APK on push
- Upload as artifact
- No device farm yet (just builds)

#### Phase 3: Cloud Testing (1 day)
Only after CI/CD works.

**Epic M-004: Firebase Test Lab Integration**
- Upload APK to Firebase
- Run on virtual devices
- Collect results

#### Phase 4: iOS (If Needed) (1.5 days)
Only after Android is complete end-to-end.

**Epic M-005: iOS Local Build**
- Xcode/fastlane setup on Mac
- IPA generation
- Run in simulator

**Epic M-006: iOS CI/CD + Testing**
- GitHub Actions macOS runner
- Firebase Test Lab iOS

### Total: 6 epics (vs original 9)
**Estimated time:** 5-6 days (but spread over time, not continuous)

---

## Parallel Opportunities

### What CAN Run in Parallel

```
Phase 1 (Sequential - Foundation)
  Epic M-001 (Project Template)
       |
       v
  Epic M-002 (Android Local Build)
       |
       v
Phase 2 (Sequential - Depends on Local Build)
  Epic M-003 (GitHub Actions)
       |
       v
Phase 3 (Sequential - Depends on CI)
  Epic M-004 (Firebase Integration)
       |
       v
Phase 4 (Can Start After M-002 Done)
  Epic M-005 (iOS Local) ----+
       |                      |
       v                      | (Parallel if two agents)
  Epic M-006 (iOS CI/CD) ----+
```

**Parallelization Window:** M-005 and M-006 can run in parallel with M-003 and M-004 IF:
- Two separate subagents available
- Mac and Linux both accessible
- No shared state between platforms

**Practical Reality:** Sequential is safer. Parallelization adds complexity for marginal time savings.

---

## Haiku-Safe Epic Requirements

For each epic to be Haiku-safe (executable by Haiku model), it must include:

### Required in Every Epic

1. **Exact File Paths**
   ```
   Create: /home/samuel/sv/mobile-project/android/app/build.gradle
   Modify: /home/samuel/sv/mobile-project/package.json (line 12-15)
   ```

2. **Numbered Implementation Steps**
   ```
   Step 1: Create directory structure
   Step 2: Initialize React Native project
   Step 3: Configure Android Gradle
   ...
   ```

3. **Code Snippets**
   ```typescript
   // Add to package.json scripts
   "android:build": "cd android && ./gradlew assembleDebug"
   ```

4. **Verification Commands**
   ```bash
   # Verify APK was created
   ls -la android/app/build/outputs/apk/debug/

   # Verify size is reasonable (>1MB, <100MB)
   stat --format=%s android/app/build/outputs/apk/debug/app-debug.apk
   ```

5. **Rollback Instructions**
   ```
   If Step 3 fails:
   - Delete android/app/build/
   - Run: cd android && ./gradlew clean
   - Retry from Step 2
   ```

### Epic Template

```markdown
# Epic M-00X: [Title]

## Prerequisites
- [ ] Epic M-00(X-1) complete
- [ ] Required tools installed: [list]

## Acceptance Criteria
- [ ] Criterion 1 (testable)
- [ ] Criterion 2 (testable)

## Implementation Steps

### Step 1: [Action]
**File:** `/path/to/file.ts`
**Action:** Create/Modify/Delete
**Code:**
\`\`\`typescript
// Exact code to write
\`\`\`
**Verify:**
\`\`\`bash
# Command to verify
\`\`\`

### Step 2: [Action]
...

## Validation Checklist
- [ ] All verification commands pass
- [ ] No errors in console
- [ ] Acceptance criteria met

## Rollback
If this epic fails, revert with:
\`\`\`bash
git checkout -- .
\`\`\`
```

---

## Testing Strategy: Incremental Validation

### Per-Epic Validation

| Epic | Validation Method | Success Criteria |
|------|-------------------|------------------|
| M-001 | `npm start` runs without error | Metro bundler starts |
| M-002 | APK file exists and size >1MB | `ls android/app/build/outputs/apk/debug/` |
| M-003 | GitHub Action completes | Green checkmark on commit |
| M-004 | Firebase shows test results | 0 failures in dashboard |
| M-005 | IPA file exists | `ls ios/build/*.ipa` |
| M-006 | iOS tests pass in Firebase | 0 failures in dashboard |

### End-to-End Validation

After all epics complete:
1. Push code change
2. GitHub Actions triggers
3. Builds APK/IPA
4. Uploads to Firebase Test Lab
5. Tests run on devices
6. Results appear in <20 minutes
7. PS can deploy to beta with single command

---

## Dependencies and Ordering

### Strict Dependencies (Must Be Done First)

```
Before Any Mobile Work:
  - PIV loop working (3+ successful runs)
  - Task tool spawning reliable

Before Phase 1:
  - React Native CLI installed: npm install -g react-native-cli
  - Android Studio + SDK installed
  - Emulator created and working

Before Phase 2:
  - GitHub Secrets configured:
    - ANDROID_KEYSTORE (for signed builds)

Before Phase 3:
  - Firebase project created
  - Test Lab API enabled
  - Service account JSON in GitHub Secrets

Before Phase 4:
  - Mac accessible
  - Xcode installed (20GB+)
  - Apple Developer account ($99/year)
  - fastlane installed
```

### Manual Prerequisites (Cannot Be Automated)

| Task | Time | Cost | When Needed |
|------|------|------|-------------|
| Android Studio install | 2 hours | Free | Before Phase 1 |
| Firebase project setup | 30 min | Free | Before Phase 3 |
| Apple Developer enrollment | 1-2 days | $99/year | Before Phase 4 |
| Xcode download | 4+ hours | Free | Before Phase 4 |
| Google Play enrollment | 1 hour | $25 | Before beta deploy |

---

## Handoff Points

### When to Create Handoffs

**Context Window Triggers:**
- After M-001 + M-002 complete (likely ~50% context)
- After M-003 + M-004 complete (likely ~80% context)
- After M-005 before M-006 (fresh context for iOS CI)

**Recommended Handoff Schedule:**

```
Session 1: M-001 + M-002 (Local Dev)
  -> Create handoff: "Android local build complete"
  -> Include: APK path, emulator config, test results

Session 2: M-003 + M-004 (Android CI/CD)
  -> Create handoff: "Android pipeline complete"
  -> Include: GitHub workflow files, Firebase project ID

Session 3: M-005 + M-006 (iOS, if needed)
  -> Create handoff: "iOS complete" or "Mobile platform complete"
  -> Include: Full system documentation
```

### Handoff Document Template

```markdown
# Handoff: Mobile Platform - [Phase]

**Date:** YYYY-MM-DD HH:MM
**Context Used:** XX%
**Next Epic:** M-00X

## Completed
- [x] Epic M-00X: Description
- [x] Epic M-00Y: Description

## Current State
- APK location: /path/to/app-debug.apk
- Firebase project: [project-id]
- GitHub workflow: .github/workflows/android-ci.yml

## Next Steps
1. Start Epic M-00Z
2. Run: [setup command]
3. Continue from Step 3 of epic

## Verification Before Continue
\`\`\`bash
# Verify previous work still valid
ls /path/to/expected/file
curl https://firebase.google.com/project/[id]/testlab
\`\`\`
```

---

## Risk Areas

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Android SDK version mismatch | High | Medium | Pin SDK version in build.gradle |
| Metro bundler port conflict | Medium | Low | Use custom port in package.json |
| Firebase quota exceeded | Low | Low | Monitor usage, use emulator fallback |
| GitHub Actions macOS cost | Medium | Medium | Batch iOS builds, use cache |
| Xcode update breaks build | Medium | High | Pin Xcode version in CI |

### Operational Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Apple developer cert expires | Medium | High | Calendar reminders |
| Mac not available | Medium | High | Document manual fallback |
| Firebase project locked | Low | High | Backup service account |

---

## Cost Summary

### Minimal Setup (Android Only)
- Google Play Console: $25 one-time
- Firebase Test Lab: Free (60 min/day)
- GitHub Actions: Free (2000 min/month)
- **Total:** $25

### Full Setup (Android + iOS)
- Apple Developer: $99/year
- Google Play Console: $25 one-time
- Firebase Test Lab: Free
- GitHub Actions: Free (plus ~$100/year if heavy iOS use)
- **Total Year 1:** $124-224

### When to Upgrade
- Exceeding Firebase free tier: AWS Device Farm ($250/month)
- Exceeding GitHub free tier: Self-hosted runner or CircleCI

---

## Implementation Timeline (If Proceeding)

### Minimum Viable Mobile (Android Only)
```
Day 1 (4 hours): M-001 - Project Template
Day 2 (4 hours): M-002 - Local Build
Day 3 (4 hours): M-003 - GitHub Actions
Day 4 (4 hours): M-004 - Firebase Testing

Total: 4 days, Android-only mobile capability
```

### Full Platform (Android + iOS)
```
Days 1-4: Android (as above)
Day 5 (4 hours): M-005 - iOS Local
Day 6 (4 hours): M-006 - iOS CI/CD

Total: 6 days, full cross-platform capability
```

---

## Decision Matrix

### Should You Build This Now?

| Condition | Answer | Action |
|-----------|--------|--------|
| PIV loops working reliably? | No | Wait for PIV stability |
| Specific mobile project planned? | No | Defer until project exists |
| UI-First workflow available? | No | Consider building that first |
| Have 4+ days uninterrupted? | No | Defer to larger block |
| Android SDK installed? | No | Install first, then evaluate |

**If all "Yes":** Proceed with Phase 1

---

## Summary

### Original Plan Problems
1. Too many epics (9) with complex interdependencies
2. Both platforms at once (complexity explosion)
3. Not Haiku-safe (missing implementation details)
4. No clear handoff points
5. Manual prerequisites mixed with automation

### Redesigned Plan Benefits
1. Fewer epics (6) with clear phases
2. One platform at a time (Android first)
3. Haiku-safe with exact file paths and code
4. Clear handoff points between sessions
5. Manual prerequisites separated and front-loaded

### Recommendation
**Defer this feature** until:
1. A specific mobile app project is identified
2. PIV loops are stable
3. User completes manual prerequisites

When ready, start with Phase 1 (Android local dev only) and validate each phase before proceeding.

---

**Analyst:** Claude Opus 4.5 (Meta-Supervisor)
**Date:** 2026-01-27
**Status:** Draft - Awaiting User Decisions
