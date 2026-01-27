# Epic: Mobile Deployment Automation

**Epic ID:** 039
**Created:** 2026-01-22
**Status:** Planned
**Complexity Level:** 3
**Feature:** Mobile App Development Platform

## Business Context

Automate beta deployments to TestFlight (iOS) and Play Store Internal (Android). PSs trigger deployments via MCP tool or git tag.

## Requirements

**MUST HAVE:**
- [ ] MCP tool: mobile_deploy_beta({ project_id, platform, version })
- [ ] fastlane lanes: ios_beta, android_beta
- [ ] Automatic version code/build number increment
- [ ] Deployment tracking (mobile_deployments table)
- [ ] Notification on deployment completion

**SHOULD HAVE:**
- [ ] Release notes auto-generation from git commits
- [ ] Rollback capability
- [ ] Staged rollout (10% → 50% → 100%)

## Database Schema

```sql
CREATE TABLE mobile_deployments (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES mobile_projects(id),
  platform TEXT NOT NULL,
  version_code INTEGER NOT NULL,
  version_name TEXT NOT NULL,
  build_number INTEGER NOT NULL,
  deployment_type TEXT, -- 'testflight' | 'play-internal' | 'play-beta'
  deployed_at TIMESTAMP DEFAULT NOW(),
  deployed_by TEXT,
  status TEXT, -- 'uploading' | 'processing' | 'available' | 'failed'
  distribution_url TEXT
);
```

## fastlane Lanes

```ruby
lane :ios_beta do
  increment_build_number
  build_ios_app
  upload_to_testflight
  slack(message: "iOS beta deployed!")
end

lane :android_beta do
  increment_version_code
  build_android_app
  upload_to_play_store(track: 'internal')
  slack(message: "Android beta deployed!")
end
```

## Implementation Tasks

- [ ] Create fastlane lanes: ios_beta, android_beta
- [ ] Version auto-increment logic
- [ ] Database migration: 039-create-mobile-deployments.sql
- [ ] MCP tool: mobile_deploy_beta
- [ ] Notification integration (Slack/Discord)

**Estimated Effort:** 10 hours (1.25 days)

## Acceptance Criteria

- [ ] mobile_deploy_beta uploads to TestFlight successfully
- [ ] mobile_deploy_beta uploads to Play Store Internal successfully
- [ ] Version/build numbers auto-increment
- [ ] Deployment tracked in mobile_deployments
- [ ] Notification sent on completion

## Dependencies

**Blocked By:** Epic 032 (iOS), Epic 033 (Android), Epic 035 (CI/CD)
**Prerequisites:** App Store Connect access, Play Console access
