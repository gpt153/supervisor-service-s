# Epic: GitHub Actions CI/CD

**Epic ID:** 035
**Created:** 2026-01-22
**Status:** Planned
**Complexity Level:** 2
**Feature:** Mobile App Development Platform

## Business Context

Automate build, test, and deployment pipeline using GitHub Actions. Free tier: 2000 min/month Linux, ~200 min/month macOS. Triggered on every push/PR.

## Requirements

**MUST HAVE:**
- [ ] .github/workflows/android-ci.yml (Linux runner)
- [ ] .github/workflows/ios-ci.yml (macOS runner)
- [ ] Trigger on push to main/develop branches
- [ ] Trigger on pull requests
- [ ] Matrix builds (multiple OS versions)
- [ ] Artifact uploads (APK, IPA, test results)
- [ ] Status checks for PRs

**SHOULD HAVE:**
- [ ] Caching (dependencies, build outputs)
- [ ] Notifications on Slack/Discord
- [ ] Deploy to beta on successful test

## Architecture

**android-ci.yml:**
```yaml
on: [push, pull_request]
jobs:
  build-android:
    runs-on: ubuntu-latest
    steps:
      - Checkout
      - Setup Java
      - Gradle build
      - Upload APK
      - Firebase Test Lab
```

**ios-ci.yml:**
```yaml
on: [push, pull_request]
jobs:
  build-ios:
    runs-on: macos-latest
    steps:
      - Checkout
      - Setup Xcode
      - fastlane build_ios
      - Upload IPA
      - Firebase Test Lab
```

## Implementation Tasks

- [ ] Create .github/workflows/android-ci.yml
- [ ] Create .github/workflows/ios-ci.yml
- [ ] Configure GitHub Secrets (signing keys, API tokens)
- [ ] Test workflow triggers
- [ ] Optimize caching for speed

**Estimated Effort:** 8 hours (1 day)

## Acceptance Criteria

- [ ] Workflows trigger on push/PR
- [ ] Android builds successfully on Linux runner
- [ ] iOS builds successfully on macOS runner
- [ ] Artifacts uploaded to GitHub
- [ ] Test results visible in PR checks

## Dependencies

**Blocked By:** Epic 032 (iOS), Epic 033 (Android), Epic 034 (Test Lab)
