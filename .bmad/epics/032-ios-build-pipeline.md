# Epic: iOS Build Pipeline

**Epic ID:** 032
**Created:** 2026-01-22
**Status:** Planned
**Complexity Level:** 4
**Feature:** Mobile App Development Platform

## Business Context

Automate iOS app builds using MacBook + Xcode + fastlane. Enable PSs to build .ipa files for TestFlight distribution without manual Xcode intervention.

## Requirements

**MUST HAVE:**
- [ ] fastlane installation on MacBook ($99 Apple Developer account required)
- [ ] Xcode project configuration (signing, capabilities)
- [ ] fastlane Fastfile with lanes: build_ios, test_ios, beta_ios
- [ ] GitHub Actions workflow: ios-ci.yml (macOS runner)
- [ ] Build output: .ipa file for TestFlight
- [ ] Certificate and provisioning profile management

**SHOULD HAVE:**
- [ ] Automatic version bumping
- [ ] Build number auto-increment
- [ ] Crashlytics integration
- [ ] Notification on build completion

## Architecture

**Build Flow:**
1. Push to GitHub → Trigger ios-ci.yml
2. macOS runner connects to MacBook via SSH
3. fastlane build_ios lane executes
4. Xcode builds .ipa
5. Upload to TestFlight via fastlane beta_ios

**Prerequisites:**
- MacBook Intel 2019 with Xcode installed
- Apple Developer account ($99/year)
- Certificates in Keychain
- GitHub Actions macOS runner

## Implementation Tasks

- [ ] Install fastlane on MacBook: gem install fastlane
- [ ] Create Fastfile template
- [ ] Configure Xcode signing (match for cert management)
- [ ] Create .github/workflows/ios-ci.yml
- [ ] Test build locally: fastlane build_ios
- [ ] Test TestFlight upload: fastlane beta_ios

**Estimated Effort:** 12 hours (1.5 days)

## Acceptance Criteria

- [ ] fastlane build_ios successfully builds .ipa
- [ ] GitHub Actions workflow triggers on push
- [ ] .ipa uploaded to TestFlight
- [ ] Build artifacts stored in GitHub
- [ ] PS can trigger builds via git push

## Dependencies

**Blocked By:** Epic 031 (Project Setup)
**Prerequisites:** Apple Developer account, MacBook with Xcode, fastlane
