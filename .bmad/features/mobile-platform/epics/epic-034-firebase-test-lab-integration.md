# Epic: Firebase Test Lab Integration

**Epic ID:** 034
**Created:** 2026-01-22
**Status:** Planned
**Complexity Level:** 3
**Feature:** Mobile App Development Platform

## Business Context

Serverless device testing on real iOS/Android devices using Firebase Test Lab. Free tier: 60 min/day. Automated testing on every commit.

## Requirements

**MUST HAVE:**
- [ ] Firebase project setup
- [ ] Service account with Test Lab permissions
- [ ] gcloud CLI integration
- [ ] MCP tool: mobile_run_tests({ project_id, platform, device_model })
- [ ] Device catalog in database (mobile_devices table)
- [ ] Test run tracking (mobile_test_runs table)
- [ ] Results collection (screenshots, logs, videos)

**SHOULD HAVE:**
- [ ] Parallel testing (multiple devices)
- [ ] Test sharding for speed
- [ ] Flakiness detection
- [ ] Cost monitoring (track free tier usage)

## Database Schema

```sql
CREATE TABLE mobile_test_runs (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES mobile_projects(id),
  platform TEXT NOT NULL, -- 'android' | 'ios'
  test_matrix_id TEXT, -- Firebase Test Lab ID
  device_model TEXT,
  os_version TEXT,
  status TEXT, -- 'pending' | 'running' | 'passed' | 'failed'
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  test_duration_seconds INTEGER,
  results_url TEXT,
  failure_reason TEXT
);

CREATE TABLE mobile_devices (
  id SERIAL PRIMARY KEY,
  platform TEXT NOT NULL,
  model TEXT NOT NULL,
  os_version TEXT NOT NULL,
  is_virtual BOOLEAN DEFAULT false,
  firebase_device_id TEXT UNIQUE,
  available BOOLEAN DEFAULT true,
  last_used TIMESTAMP
);
```

## Implementation Tasks

- [ ] Create Firebase project
- [ ] Enable Test Lab API
- [ ] Create service account JSON
- [ ] Store in secrets: mcp_meta_set_secret('meta/firebase/test_lab_credentials')
- [ ] Seed mobile_devices from Firebase catalog
- [ ] Create FirebaseTestLabClient.ts
- [ ] MCP tool: mobile_run_tests
- [ ] MCP tool: mobile_get_test_results

**Estimated Effort:** 10 hours (1.25 days)

## Acceptance Criteria

- [ ] mobile_run_tests submits APK/IPA to Firebase Test Lab
- [ ] Tests run on specified device
- [ ] Results stored in mobile_test_runs
- [ ] Screenshots/logs/videos accessible
- [ ] Free tier quota monitored

## Dependencies

**Blocked By:** Epic 032 OR 033 (need .apk or .ipa to test)
**Prerequisites:** Firebase project, service account, gcloud CLI
