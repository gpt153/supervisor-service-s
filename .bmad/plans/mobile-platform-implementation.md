# Implementation Plan: Mobile App Development Platform

**Created:** 2026-01-22
**Feature Request:** mobile-app-development-platform.md
**Epics:** 031-039
**Estimated Total:** 10-12 days

---

## Overview

Implement mobile platform enabling PSs to:
1. Create React Native/Flutter projects
2. Build iOS (MacBook + Xcode) and Android (VM + Gradle)
3. Test on real devices (Firebase Test Lab)
4. Deploy to TestFlight and Play Store Internal
5. Optional: Mobile UI mockups via Expo Snack

---

## Prerequisites (Manual - 1 day)

**Apple:**
- [ ] Enroll in Apple Developer Program ($99/year)
- [ ] Install Xcode on MacBook
- [ ] Install fastlane: `gem install fastlane`
- [ ] Configure certificates and provisioning profiles

**Google:**
- [ ] Create Firebase project, enable Test Lab
- [ ] Enroll in Google Play Console ($25 one-time)
- [ ] Create service account, download JSON

**GitHub:**
- [ ] Add Secrets: Apple credentials, Google service account

---

## Phase 1: Foundation (Epic 031)
**Duration:** 1-2 days

**Tasks:**
1. Database: mobile_projects table
2. Create templates: React Native, Flutter
3. MobileProjectManager.createProject()
4. MCP tool: mobile_create_project

**Deliverable:** PSs can scaffold mobile projects

---

## Phase 2: Build Pipelines (Epics 032, 033)
**Duration:** 3 days

**iOS (Epic 032):**
- [ ] fastlane Fastfile with lanes: build_ios, beta_ios
- [ ] GitHub Actions: ios-ci.yml (macOS runner)
- [ ] Certificate management (match)

**Android (Epic 033):**
- [ ] Gradle signing configuration
- [ ] fastlane for Android
- [ ] GitHub Actions: android-ci.yml (Linux runner)

**Deliverable:** Automated builds for iOS and Android

---

## Phase 3: Testing (Epic 034)
**Duration:** 1-2 days

**Tasks:**
1. Firebase Test Lab setup
2. Database: mobile_test_runs, mobile_devices
3. FirebaseTestLabClient.ts
4. MCP tools: mobile_run_tests, mobile_get_test_results

**Deliverable:** Automated device testing

---

## Phase 4: CI/CD & Integration (Epics 035, 036, 037)
**Duration:** 2-3 days

**GitHub Actions (Epic 035):**
- [ ] Workflows for Android and iOS
- [ ] Matrix builds, caching

**Expo Snack (Epic 036):**
- [ ] ExpoSnackClient.createSnack()
- [ ] QR code generation
- [ ] MCP tool: mobile_preview_app

**MacBook (Epic 037):**
- [ ] GitHub Actions self-hosted runner
- [ ] SSH tunnel configuration

**Deliverable:** Complete CI/CD pipeline

---

## Phase 5: MCP Tools & Deployment (Epics 038, 039)
**Duration:** 2-3 days

**MCP Tools (Epic 038):**
- [ ] mobile_list_devices
- [ ] mobile_check_quota
- [ ] mobile_get_crash_reports

**Deployment (Epic 039):**
- [ ] Database: mobile_deployments
- [ ] fastlane lanes: ios_beta, android_beta
- [ ] MCP tool: mobile_deploy_beta

**Deliverable:** Full mobile deployment automation

---

## Database Migrations

1. 031-create-mobile-projects.sql
2. 034-create-mobile-test-runs.sql
3. 034-create-mobile-devices.sql
4. 039-create-mobile-deployments.sql

---

## MCP Tools Created

1. mobile_create_project
2. mobile_run_tests
3. mobile_get_test_results
4. mobile_list_devices
5. mobile_check_quota
6. mobile_preview_app (Expo Snack)
7. mobile_deploy_beta

---

## Cost Analysis

**First Year:**
- Apple Developer: $99/year
- Google Play: $25 one-time
- Firebase Test Lab: Free tier (60 min/day)
- GitHub Actions: Free tier sufficient
- **Total: $124**

**Ongoing:**
- $99/year (Apple renewal)
- Monitor Firebase quota (upgrade if needed)

---

## Success Criteria

- ✅ All 9 epics implemented
- ✅ iOS and Android builds automated
- ✅ Firebase Test Lab integrated
- ✅ Beta deployments working
- ✅ All MCP tools functional

---

## Post-Implementation

1. **Setup Guide:** /home/samuel/sv/supervisor-service-s/.bmad/setup/mobile-prerequisites.md
2. **Documentation:** Update mcp-tools-reference.md
3. **Training:** Demo mobile workflow to PSs
