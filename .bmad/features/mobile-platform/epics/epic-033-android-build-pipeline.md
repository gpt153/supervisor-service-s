# Epic: Android Build Pipeline

**Epic ID:** 033
**Created:** 2026-01-22
**Status:** Planned
**Complexity Level:** 3
**Feature:** Mobile App Development Platform

## Business Context

Automate Android app builds using Linux VM + Gradle. Enable PSs to build .apk/.aab files for Play Store distribution.

## Requirements

**MUST HAVE:**
- [ ] Gradle build configuration
- [ ] Signing key generation (release builds)
- [ ] GitHub Actions workflow: android-ci.yml (Linux runner)
- [ ] Build output: .apk (debug), .aab (release)
- [ ] fastlane for Android deployment automation

**SHOULD HAVE:**
- [ ] ProGuard/R8 optimization
- [ ] Automatic version code increment
- [ ] Build variants (debug, release, staging)

## Architecture

**Build Flow:**
1. Push to GitHub → Trigger android-ci.yml
2. Linux runner on VM
3. Gradle builds APK/AAB
4. fastlane uploads to Play Store internal testing

**Prerequisites:**
- Google Play Console account ($25 one-time)
- Service account for API access
- Signing keystore

## Implementation Tasks

- [ ] Generate signing key: keytool -genkey
- [ ] Configure Gradle signing config
- [ ] Create Fastfile for Android
- [ ] Create .github/workflows/android-ci.yml
- [ ] Test build: ./gradlew assembleRelease
- [ ] Test upload: fastlane deploy_android

**Estimated Effort:** 10 hours (1.25 days)

## Acceptance Criteria

- [ ] Gradle successfully builds .aab for release
- [ ] GitHub Actions workflow triggers on push
- [ ] .aab uploaded to Play Store internal
- [ ] Signing works correctly
- [ ] PS can trigger builds via git push

## Dependencies

**Blocked By:** Epic 031 (Project Setup)
**Prerequisites:** Google Play Console account, signing key
