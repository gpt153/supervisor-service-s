# Epic: UI to Backend Connection Workflow

**Epic ID:** UI-009
**Created:** 2026-01-22
**Status:** Planned
**Complexity Level:** 2
**Feature:** UI-First Development Workflow
**PRD:** `/home/samuel/sv/supervisor-service-s/.bmad/prd/ui-first-workflow.md`

## Summary

Replace mock data and interactions with real backend API calls after backend implementation complete. Transform dev mockup into production-ready UI connected to real database and business logic.

## Key Features

**MUST HAVE:**
- [ ] MCP tool: `ui_connect_backend({ epicId, backendUrl })`
- [ ] Identify all mock data sources in mockup code
- [ ] Replace mock data with API fetch calls
- [ ] Replace mock actions with real API endpoints
- [ ] Update environment variables (API_URL)
- [ ] Remove mock data files
- [ ] Update deployment from dev to production
- [ ] Verify all user flows work with real backend

**SHOULD HAVE:**
- [ ] Error handling for API failures
- [ ] Loading states during API calls
- [ ] Authentication token management
- [ ] API response validation

## Architecture

### Connection Strategy

**Before (Mock):**
```typescript
// Mock data
const mockUsers = [
  { id: 1, email: "john@test.com", role: "admin" },
  { id: 2, email: "jane@test.com", role: "user" }
];

// Mock actions
function handleBan(userId) {
  setUsers(users.map(u =>
    u.id === userId ? { ...u, status: 'banned' } : u
  ));
}
```

**After (Real Backend):**
```typescript
// Real data
const { data: users, loading, error } = useFetch('/api/users');

// Real actions
async function handleBan(userId) {
  await fetch(`/api/users/${userId}/ban`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  refreshUsers();
}
```

### Migration Steps
1. Parse mockup code to find mock data sources
2. Generate API client code for each mock endpoint
3. Replace mock imports with API client imports
4. Add error handling and loading states
5. Update environment config (API_URL)
6. Remove mock data files
7. Test all user flows with real backend

## Key Features (Detailed)

**Code Transformation:**
- [ ] Detect mock data arrays/objects
- [ ] Generate fetch/axios calls for each mock endpoint
- [ ] Replace mock function calls with API calls
- [ ] Add async/await handling
- [ ] Add error boundaries

**Environment Configuration:**
- [ ] Update .env with VITE_API_URL
- [ ] Configure CORS if needed
- [ ] Set up authentication token storage

**Deployment Update:**
- [ ] Move from `ui.153.se/[project]/dev` to production URL
- [ ] Update nginx config for production
- [ ] Deploy to production server

## Estimated Effort
14 hours (1.5-2 days)

## Dependencies
- Epic UI-007: Dev Environment Deployment (need mockup code)
- Backend implementation complete (PIV loop)
- Backend API documented (endpoints, request/response formats)

## Testing

### Manual Testing Checklist
- [ ] Identify all mock data sources in mockup
- [ ] Run `ui_connect_backend({ epicId, backendUrl })`
- [ ] Verify API calls replace mock data
- [ ] Test search functionality with real API
- [ ] Test actions (ban, delete, update) with real API
- [ ] Verify error handling (network failure, 404, 500)
- [ ] Verify loading states show during API calls
- [ ] Test authentication (if required)
- [ ] Compare mockup behavior vs. connected behavior (should be identical)

### Integration Tests
- [ ] Mock backend API (MSW or similar)
- [ ] Test full user flows with mocked API
- [ ] Verify error states handled correctly
- [ ] Test authentication flow

## Success Criteria
- All mock data replaced with API calls
- All user flows work with real backend
- Error handling for all API failures
- Loading states visible during API calls
- Deployed to production URL
- User cannot tell difference between mockup and connected UI (same UX)

## Notes

### Design Decisions

**Why manual migration vs. automatic?**
- MVP: Manual code transformation by PS
- v1.1: Automatic code transformation tool
- Reason: Complex to automatically handle all patterns

**Why keep mockup after connection?**
- Keep mockup as reference
- Can switch back to mockup for testing
- Useful for stakeholder demos without backend

### Future Enhancements
- Automatic code transformation (detect patterns, generate API calls)
- Mock Service Worker (MSW) integration for offline testing
- API response mocking for development
- Automatic API client generation from OpenAPI spec
