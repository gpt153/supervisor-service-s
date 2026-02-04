# Product Requirements Document: Mobile Platform

**Feature ID:** mobile-platform
**Created:** 2026-01-27
**Last Updated:** 2026-02-04
**Status:** Active - Planning Complete
**Version:** 2.0.0

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-27 | Meta-Supervisor | Initial PRD created during migration |
| 2.0.0 | 2026-02-04 | Opus 4.5 | Complete rewrite: resolved open questions, redesigned 6-epic plan, Haiku-safe epics, deployment plan |

---

## Executive Summary

A comprehensive mobile app development platform integrated into the SV supervisor system that enables project supervisors to build, test, and deploy Android and iOS applications autonomously. The system uses React Native (Expo) for cross-platform development, Firebase Test Lab for device testing, GitHub Actions for CI/CD, and fastlane for deployment automation -- all coordinated through MCP tools with zero manual intervention after initial setup.

**Architecture Decision:** Android-first phased approach. 6 epics replacing original 9 for clarity and incremental validation.

---

## Architecture Decisions (Resolved)

| Question | Decision | Rationale |
|----------|----------|-----------|
| Q1: Which platform first? | **Android** | Linux build (no Mac dependency), cheaper testing, odin3 is Linux |
| Q2: Framework? | **React Native (Expo)** | Matches existing TypeScript expertise, larger ecosystem |
| Q3: Testing strategy? | **Firebase Test Lab (free tier)** | 60 min/day free, serverless, gcloud CLI integration |
| Q4: CI/CD platform? | **GitHub Actions** | 2000 min/month free, already used for other projects |

**ADRs:**
- ADR-010: React Native vs Flutter (Accepted: React Native default, Flutter optional)
- ADR-011: Firebase Test Lab vs AWS Device Farm (Accepted: Firebase free tier for MVP)

---

## Goals & Objectives

### Primary Goal

Enable the SV supervisor system to autonomously create, build, test, and deploy mobile applications for both Android and iOS platforms, extending the system's capability beyond web-only development.

### Secondary Goals

1. **Zero-touch builds**: Push to GitHub triggers automatic build, test, and deployment pipeline
2. **Real device testing**: Every commit tested on actual/virtual mobile devices via Firebase Test Lab
3. **Cross-platform efficiency**: 70-90% code sharing between Android and iOS using React Native
4. **Autonomous operation**: Project supervisors can manage mobile projects using MCP tools without mobile development expertise
5. **Cost optimization**: Operate within free tiers ($25 one-time + $99/year Apple) until scaling requires paid services

### Success Criteria

- [ ] PS can create mobile project with single MCP tool call (`mobile_create_project`)
- [ ] Android APK builds successfully on odin3 (Linux)
- [ ] iOS IPA builds successfully on Mac (via SSH or locally)
- [ ] Firebase Test Lab runs tests on virtual Android devices
- [ ] GitHub Actions pipeline: commit -> build -> test -> artifact in <20 minutes
- [ ] Beta deployment to TestFlight/Play Store Internal with one MCP call
- [ ] All MCP tools operational: create, build, test, deploy, monitor
- [ ] Free tier covers all development usage

---

## Epic Status (Redesigned v2)

| Epic | Title | Status | Completion | Estimated | Dependencies |
|------|-------|--------|------------|-----------|-------------|
| M-001 | React Native Project Template & DB Schema | Pending | 0% | 8h | None (foundational) |
| M-002 | Android Local Build & Emulator Testing | Pending | 0% | 8h | M-001 |
| M-003 | GitHub Actions Android CI/CD Pipeline | Pending | 0% | 6h | M-002 |
| M-004 | Firebase Test Lab Integration | Pending | 0% | 8h | M-003 |
| M-005 | iOS Local Build & Simulator Testing | Pending | 0% | 8h | M-002 |
| M-006 | iOS CI/CD Pipeline & Firebase iOS | Pending | 0% | 8h | M-003, M-004, M-005 |

**Total Estimated:** 46 hours (~6 days)

### Legacy Epics (Superseded)

The original epics 031-039 are superseded by M-001 through M-006. The original epics remain in the `epics/` directory for reference but should not be implemented.

| Original Epic | Replaced By | Reason |
|--------------|-------------|--------|
| epic-031 (RN Project Setup) | M-001 | Consolidated with DB schema |
| epic-032 (iOS Build Pipeline) | M-005 + M-006 | Split into local + CI |
| epic-033 (Android Build Pipeline) | M-002 + M-003 | Split into local + CI |
| epic-034 (Firebase Test Lab) | M-004 | Streamlined, Android-first |
| epic-035 (GitHub Actions) | M-003 + M-006 | Split per platform |
| epic-036 (Expo Snack) | Deferred | Not needed for MVP |
| epic-037 (MacBook Integration) | M-006 | Folded into iOS CI/CD |
| epic-038 (MCP Tools) | M-001-M-006 | Distributed across all epics |
| epic-039 (Deploy Automation) | M-006 | Folded into iOS CI/CD |

---

## Architecture

### System Overview

```
                  SUPERVISOR (odin3)
                       |
            MCP Server (port 8081)
            /          |           \
   mobile_create   mobile_build   mobile_deploy
   mobile_test     mobile_check   mobile_list
           |           |              |
     +-----------+  +--------+  +----------+
     | PostgreSQL |  | GitHub |  | Firebase |
     | mobile_*   |  | Actions|  | Test Lab |
     | tables     |  | CI/CD  |  | (free)   |
     +-----------+  +--------+  +----------+
                       |
              +--------+--------+
              |                 |
         ubuntu-latest     macos-self-hosted
         (Android APK)     (iOS IPA)
              |                 |
         Gradle Build      Xcode + fastlane
              |                 |
              +--------+--------+
                       |
                Firebase Test Lab
                (60 min/day free)
                       |
              +--------+--------+
              |                 |
         Play Store         TestFlight
         (Internal)         (Beta)
```

### Technology Stack

| Component | Technology | Version | Location |
|-----------|-----------|---------|----------|
| Framework | React Native (Expo) | ~52.0.0 | Mobile projects |
| Language | TypeScript | 5.3+ | All code |
| Build (Android) | Gradle | 8.x | GitHub Actions |
| Build (iOS) | Xcode + fastlane | 15+ | Mac |
| Testing | Firebase Test Lab | Free tier | Cloud |
| CI/CD | GitHub Actions | v4 | Cloud |
| Database | PostgreSQL | 14+ | odin3:5434 |
| MCP Tools | supervisor-service-s | Current | odin3:8081 |

### Database Tables

| Table | Purpose | Created In |
|-------|---------|-----------|
| `mobile_projects` | Track mobile project metadata | M-001 |
| `mobile_test_runs` | Track Firebase Test Lab runs | M-001 |
| `mobile_deployments` | Track TestFlight/Play Store deploys | M-001 |
| `mobile_devices` | Firebase Test Lab device catalog | M-001 |

### MCP Tools (Total: 14)

| Tool | Epic | Description |
|------|------|-------------|
| `mobile_create_project` | M-001 | Create new mobile project scaffold |
| `mobile_list_projects` | M-001 | List all mobile projects |
| `mobile_get_project` | M-001 | Get project details + recent activity |
| `mobile_list_devices` | M-001 | List Firebase Test Lab devices |
| `mobile_check_quota` | M-001 | Check daily test quota usage |
| `mobile_check_sdk` | M-002 | Verify Android SDK installation |
| `mobile_build_android` | M-002 | Build Android APK locally |
| `mobile_emulator_status` | M-002 | Check Android emulator status |
| `mobile_github_status` | M-003 | Check GitHub Actions build status |
| `mobile_setup_ci` | M-003 | Install CI workflows to project |
| `mobile_run_tests` | M-004 | Submit APK to Firebase Test Lab |
| `mobile_get_test_results` | M-004 | Get test results by run ID |
| `mobile_build_ios` | M-005 | Build iOS app (simulator/device) |
| `mobile_deploy_beta` | M-006 | Deploy to TestFlight/Play Store |

---

## Deployment Plan

### Phase 1: odin3 (Infrastructure Host)

All MCP tools, database schema, and Android build capability run on odin3.

| Component | Port | Service |
|-----------|------|---------|
| MCP Server | 8081 | Existing (adds mobile tools) |
| PostgreSQL | 5434 | Existing (adds mobile tables) |
| Android SDK | N/A | Local install on odin3 |

### Phase 2: Mac (iOS Build Host)

iOS builds execute on the Mac, accessed via SSH from odin3.

| Component | Access | Service |
|-----------|--------|---------|
| Xcode | Local | iOS builds |
| fastlane | Local | Build automation |
| GitHub Runner | Self-hosted | CI/CD for iOS |

### Phase 3: Cloud Services

| Service | Access | Cost |
|---------|--------|------|
| GitHub Actions | Cloud | Free (2000 min/mo Linux) |
| Firebase Test Lab | Cloud (gcloud CLI) | Free (60 min/day) |
| TestFlight | Cloud (fastlane) | Included with Apple Dev |
| Play Store Internal | Cloud (fastlane) | $25 one-time |

---

## Cost Summary

| Item | Cost | Frequency |
|------|------|-----------|
| Google Play Console | $25 | One-time |
| Apple Developer Program | $99 | Annual |
| Firebase Test Lab | $0 | Free tier (60 min/day) |
| GitHub Actions (Linux) | $0 | Free tier (2000 min/mo) |
| GitHub Actions (macOS) | $0 | Self-hosted runner |
| **Total Year 1** | **$124** | |
| **Total Year 2+** | **$99** | |

---

## Related Documents

### Epics
- `epics/epic-M-001-react-native-project-template.md` - Foundation
- `epics/epic-M-002-android-local-build.md` - Android local
- `epics/epic-M-003-github-actions-android.md` - Android CI/CD
- `epics/epic-M-004-firebase-test-lab.md` - Device testing
- `epics/epic-M-005-ios-local-build.md` - iOS local
- `epics/epic-M-006-ios-cicd-testing.md` - iOS CI/CD + deployment

### Architecture Decisions
- `adr/010-react-native-vs-flutter.md` - Framework choice
- `adr/011-firebase-test-lab-vs-aws.md` - Testing infrastructure choice

### Context
- `context/mobile-app-development-platform.md` - Original feature request
- `context/mobile-platform-v2.md` - Redesigned analysis (deferral overridden)

### Implementation
- `implementation-plan.md` - Full handoff document with parallelization

---

## Change Log

### Version 2.0.0 (2026-02-04)
- Resolved all open questions (Android-first, React Native, Firebase, GitHub Actions)
- Replaced 9 original epics (031-039) with 6 redesigned epics (M-001 through M-006)
- All epics made Haiku-safe with exact file paths, code snippets, verification commands
- Added complete architecture diagram and deployment plan
- Added parallelization roadmap and dependency graph
- Added cost analysis and MCP tool inventory
- Overrode deferral recommendation -- proceeding with implementation

### Version 1.0.0 (2026-01-27)
- Initial PRD created during BMAD structure migration
- Migrated epics from legacy structure
- Established feature-based organization

---

**Planning:** Opus 4.5 (Meta-Supervisor)
**Status:** Ready for Implementation
**Next Step:** Begin Epic M-001 (React Native Project Template & DB Schema)
