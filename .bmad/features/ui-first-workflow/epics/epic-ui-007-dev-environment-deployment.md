# Epic: Dev Environment Deployment (Feature Mockup Track)

**Epic ID:** UI-007
**Created:** 2026-01-22
**Status:** Planned
**Complexity Level:** 2
**Feature:** UI-First Development Workflow
**PRD:** `/home/samuel/sv/supervisor-service-s/.bmad/prd/ui-first-workflow.md`

## Summary

Deploy interactive UI mockups to `ui.153.se/[project]/dev` for user testing. Ephemeral deployment with mock data, all user flows functional. Used for validating UX before backend implementation.

## Key Features

**MUST HAVE:**
- [ ] Generate React components from design (Frame0 or Figma)
- [ ] Inject mock data into components
- [ ] Deploy to Vite/Next.js dev server on allocated port
- [ ] Update nginx config for path-based routing
- [ ] URL pattern: `ui.153.se/[project]/dev`
- [ ] MCP tool: `ui_deploy_mockup({ epicId })`
- [ ] Hot reload for code changes
- [ ] All user flows work (search, filter, navigate, actions)

**SHOULD HAVE:**
- [ ] Multi-page routing (React Router)
- [ ] Form validation (client-side)
- [ ] Loading states
- [ ] Error states

## Architecture

### Component Generation
```typescript
// From Frame0 design
Frame0Component → React Component
  - Rectangle → <div>
  - Text → <span> or <p>
  - Input → <input> or <TextField>
  - Button → <button> or <Button>

// From Figma design
Figma Component → React Component via Code Connect
```

### Mock Data Injection
```typescript
// Replace API calls with mock data
const mockUsers = generateMockData('users', 20);

// Mock interactions
function handleSearch(query) {
  return mockUsers.filter(u => u.email.includes(query));
}
```

## Estimated Effort
16 hours (2 days)

## Dependencies
- Epic UI-003 or UI-004: Design generation
- Epic UI-005: Mock data generation
- Epic UI-006: Storybook (for shared components)

## Testing
- Deploy mockup for test epic
- Access ui.153.se/test/dev
- Test search functionality (filters mock data)
- Test navigation (multiple pages)
- Test action buttons (update mock state)
- Verify hot reload works
- Verify all acceptance criteria testable
