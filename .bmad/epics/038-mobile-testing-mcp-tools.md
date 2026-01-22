# Epic: Mobile Testing MCP Tools

**Epic ID:** 038
**Created:** 2026-01-22
**Status:** Planned
**Complexity Level:** 2
**Feature:** Mobile App Development Platform

## Business Context

Provide PSs with MCP tools for mobile operations: list devices, run tests, get results, check quota, preview apps.

## Requirements

**MUST HAVE:**
- [ ] mobile_list_devices - Query Firebase device catalog
- [ ] mobile_run_tests - Submit to Test Lab
- [ ] mobile_get_test_results - Fetch results by test_run_id
- [ ] mobile_check_quota - Test Lab usage (free tier: 60 min/day)
- [ ] mobile_preview_app - Create Expo Snack with QR code

**SHOULD HAVE:**
- [ ] mobile_get_crash_reports - Firebase Crashlytics
- [ ] mobile_deploy_beta - TestFlight/Play Internal
- [ ] mobile_list_builds - Recent builds

## MCP Tool Specifications

```typescript
// mobile_run_tests
{
  project_id: number,
  platform: 'android' | 'ios',
  device_models: string[], // ['Pixel5', 'iPhone13']
  test_type: 'instrumentation' | 'robo'
}
→ Returns: { test_matrix_id, status, devices }

// mobile_get_test_results
{
  test_run_id: number
}
→ Returns: { status, duration, results_url, screenshots, logs }

// mobile_check_quota
{}
→ Returns: { minutes_used_today, minutes_remaining, resets_at }
```

## Implementation Tasks

- [ ] Create src/mcp/tools/mobile-tools.ts
- [ ] Implement all 5 core tools
- [ ] Database queries for mobile_projects, mobile_test_runs
- [ ] Firebase Test Lab API integration
- [ ] Expo Snack API integration

**Estimated Effort:** 10 hours (1.25 days)

## Acceptance Criteria

- [ ] All 5 MCP tools functional
- [ ] mobile_run_tests submits to Test Lab successfully
- [ ] mobile_get_test_results fetches results
- [ ] mobile_check_quota shows accurate usage
- [ ] mobile_preview_app returns QR code

## Dependencies

**Blocked By:** Epic 031 (Projects), Epic 034 (Test Lab), Epic 036 (Expo)
