# Epic: Backend Connection

**Epic ID:** 029
**Created:** 2026-01-22
**Status:** Planned
**Complexity Level:** 2
**Feature:** UI-First Development Workflow

## Business Context

Once UI is validated with mock data and backend is implemented (via PIV), replace mock data with real API calls. Seamless transition from mockup to production.

## Requirements

**MUST HAVE:**
- [ ] MCP tool: ui_connect_backend({ mockup_id, api_base_url })
- [ ] Replace mock data imports with API calls (fetch/axios)
- [ ] Generate API client based on endpoints
- [ ] Update components to use real data
- [ ] Handle loading states
- [ ] Handle error states

**SHOULD HAVE:**
- [ ] API response validation (ensure schema matches mock data)
- [ ] Gradual migration (some endpoints mock, some real)
- [ ] Production build optimization

## Architecture

**Migration Pattern:**
```
Before: const users = mockData.users
After:  const { data: users } = await fetch('/api/users')
```

**Automatic:** Parse component files, find mock data imports, replace with API calls

## Implementation Tasks

- [ ] Create BackendConnector.ts
- [ ] Detect mock data usage in components
- [ ] Generate API client code
- [ ] Replace imports with fetch/axios calls
- [ ] Add loading/error handling
- [ ] MCP tool: ui_connect_backend

**Estimated Effort:** 10 hours (1.25 days)

## Acceptance Criteria

- [ ] ui_connect_backend replaces mock data with real API calls
- [ ] Components fetch data from api_base_url
- [ ] Loading and error states handled
- [ ] UI works with real backend

## Dependencies

**Blocked By:** Epic 027 (Mockup Deployment), Epic 028 (Validation)
**Blocks:** None (final step)
