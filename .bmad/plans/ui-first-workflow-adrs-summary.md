# ADR Creation Summary: UI-First Development Workflow

**Date**: 2026-01-22
**Planner**: Plan Implementation Agent
**Task**: Create 4 ADRs for UI-First Development Workflow
**Context**: Epic breakdown planning for UI-First workflow (Epics 022-030)

---

## Completion Status

✅ **ALL 4 ADRs CREATED**

---

## ADR Overview

### ADR 007: Frame0 vs Figma as Default Design Tool
**File**: `.bmad/adr/007-frame0-vs-figma-default-tool.md`
**Status**: Proposed
**Date**: 2026-01-22
**Related Epics**: 024 (Frame0), 025 (Figma)

**Decision**: Frame0 as default, Figma as fallback
- Frame0 for rapid prototyping (80% of cases)
- Figma for complex UIs requiring design expertise (20%)
- Both supported, user chooses per epic

**Key Rationale**:
- Frame0: Faster iteration, no external tools, natural language refinement
- Figma: Professional polish, full design control, industry-standard

---

### ADR 009: Mock Data Strategy
**File**: `.bmad/adr/009-mock-data-strategy.md`
**Status**: Accepted
**Date**: 2026-01-22
**Related Epic**: 026 (Mock Data System)

**Decision**: Layered approach - Hardcoded → Faker.js → MSW
- **Hardcoded**: Simple forms and displays
- **Faker.js**: Lists and tables (realistic data)
- **MSW**: Complex workflows with API interactions

**Key Rationale**:
- Start simple, escalate complexity as needed
- Most cases handled by hardcoded or Faker
- MSW only when API interaction testing is critical

---

### ADR 008: Shared CNAME vs Per-Project CNAMEs
**File**: `.bmad/adr/008-shared-cname-vs-per-project.md`
**Status**: Accepted
**Date**: 2026-01-22
**Related Epic**: 030 (Shared CNAME Infrastructure)

**Decision**: Single `ui.153.se` CNAME with nginx path-based routing

**URL Structure**:
- `ui.153.se/consilio/storybook` → Consilio's Storybook
- `ui.153.se/consilio/dev` → Consilio's dev mockup
- `ui.153.se/odin/storybook` → Odin's Storybook

**Key Rationale**:
- Single DNS entry (no DNS changes per project)
- Clean URL structure
- Scalable (add projects without DNS churn)
- Standard reverse proxy pattern

---

### ADR 019: Storybook and Dev Environment Deployment Architecture ✨ NEW
**File**: `.bmad/adr/019-storybook-dev-environment-deployment.md`
**Status**: Proposed
**Date**: 2026-01-22
**Related Epics**: 027 (Storybook), 028 (Dev Environment), 030 (Shared CNAME)

**Decision**: Dual-track deployment - Permanent Storybook + Ephemeral Dev Environments

**Track 1: Storybook (Permanent)**
- Purpose: Component library / design system showcase
- Lifecycle: Create once per project, runs permanently
- URL: `ui.153.se/[project]/storybook`
- Technology: Storybook static build served by nginx

**Track 2: Dev Environment (Ephemeral)**
- Purpose: Interactive feature mockups for testing user flows
- Lifecycle: Created per epic, destroyed after backend connection
- URL: `ui.153.se/[project]/dev`
- Technology: Vite dev server with hot reload

**Key Rationale**:
- Storybook: Component isolation, documentation, design system reference
- Dev Environment: Full app context, complete user flows, realistic UX
- Storybook permanent (design system changes infrequently)
- Dev environment ephemeral (no value after implementation)

---

## Port Allocation Plan

| Project | Storybook Port | Dev Environment Port | Range |
|---------|----------------|---------------------|-------|
| Consilio | 5050 | 5051 | 5000-5099 |
| Health-Agent | 5150 | 5151 | 5100-5199 |
| OpenHorizon | 5250 | 5251 | 5200-5299 |
| Odin | 5350 | 5351 | 5300-5399 |

---

## nginx Configuration Pattern

```nginx
# Storybook (permanent)
location /[project]/storybook/ {
    proxy_pass http://localhost:[port]/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}

# Dev environment (ephemeral)
location /[project]/dev/ {
    proxy_pass http://localhost:[port+1]/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

---

## Database Schema Impact

### New Table: ui_deployments

```sql
CREATE TABLE ui_deployments (
  id SERIAL PRIMARY KEY,
  project_name TEXT NOT NULL,
  deployment_type TEXT NOT NULL, -- 'storybook' or 'dev'
  epic_id TEXT, -- NULL for Storybook, epic ID for dev
  port INTEGER NOT NULL,
  url TEXT NOT NULL, -- Full URL
  nginx_location TEXT, -- nginx config snippet
  status TEXT, -- 'active', 'stopped'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## Workflow Integration

### Storybook Workflow (Once Per Project)
1. User: "Create design system for Consilio"
2. PS: Allocate port 5050
3. PS: Generate component library
4. PS: Build Storybook static files
5. PS: Update nginx config with /consilio/storybook/ location
6. PS: Start Storybook server
7. PS: Insert record into ui_deployments (status='active')
8. Result: `ui.153.se/consilio/storybook` is live

### Dev Environment Workflow (Per Epic)
1. User: "Implement epic-003 authentication"
2. PS: Generate UI mockup from epic requirements
3. PS: Allocate port 5051
4. PS: Start Vite dev server with mock data
5. PS: Update nginx config with /consilio/dev/ location
6. PS: Insert record into ui_deployments (epic_id='epic-003', status='active')
7. Result: `ui.153.se/consilio/dev` is live
8. User: Test flows, approve UI
9. PS: Build real backend
10. PS: Connect backend to UI
11. PS: Stop dev server, release port, update status='stopped'

---

## Key Design Decisions

### Why Dual-Track?
- **Storybook alone**: Can't test complete workflows
- **Dev environment alone**: No component documentation
- **Together**: Component library + flow testing

### Why Permanent Storybook?
- Design system changes infrequently
- Components reused across features
- Reference documentation needed long-term
- No cost to keep running

### Why Ephemeral Dev?
- Created for epic development only
- Replaced by real backend after approval
- No value after implementation complete
- Saves resources (ports, memory)

### Why Shared CNAME?
- Single DNS entry (no per-project CNAMEs)
- Clean URL namespace
- Scalable (add projects without DNS changes)
- Standard reverse proxy pattern

---

## Risk Analysis

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| nginx becomes single point of failure | Low | High | Health monitoring, graceful reload, backup config |
| Port conflicts across projects | Low | High | Strict project ranges, validation before allocation |
| Dev environments not cleaned up | Medium | Medium | Database tracking, auto-cleanup on epic complete |
| Storybook build fails | Low | Medium | Validate components before build, fallback to last good build |
| nginx config syntax errors | Low | Critical | Validate config before reload, test in staging first |

---

## Implementation Dependencies

### Existing Infrastructure ✅
- Port allocation system (exists)
- Cloudflare tunnel manager (exists)
- nginx (exists, needs configuration)
- Project-specific port ranges (defined)

### New Components Needed ⚠️
- ui_deployments database table
- nginx config generator for UI tooling
- MCP tools for Storybook deployment
- MCP tools for dev environment deployment
- Lifecycle management (cleanup on epic complete)

---

## Next Steps

1. **Review ADRs**: User/team approval of architectural decisions
2. **Create Epics**: Break down PRD into detailed implementation epics
3. **Database Migration**: Create ui_deployments table
4. **nginx Setup**: Configure base reverse proxy for ui.153.se
5. **MCP Tools**: Implement deployment orchestration tools
6. **Documentation**: Update deployment docs with UI tooling info

---

## References

- **PRD**: `.bmad/prd/ui-first-workflow.md`
- **ADR 007**: `.bmad/adr/007-frame0-vs-figma-default-tool.md`
- **ADR 008**: `.bmad/adr/008-shared-cname-vs-per-project.md`
- **ADR 009**: `.bmad/adr/009-mock-data-strategy.md`
- **ADR 019**: `.bmad/adr/019-storybook-dev-environment-deployment.md`
- **Port Management**: `.supervisor-core/08-port-ranges.md`
- **Tunnel Management**: `.supervisor-core/09-tunnel-management.md`

---

**Planner Notes**:

All 4 requested ADRs have been created. Three were pre-existing (007, 008, 009) and one was newly created (019).

The newly created ADR 019 provides comprehensive architectural guidance for the dual-track deployment strategy (permanent Storybook + ephemeral dev environments), which is a critical foundation for the UI-First workflow.

Key insights from planning:
1. Dual-track approach balances component library (global) vs feature mockups (temporary)
2. Shared CNAME with path-based routing scales without DNS changes
3. Port allocation follows existing project ranges (no conflicts)
4. Lifecycle management ensures ephemeral dev environments are cleaned up
5. Database tracking provides visibility and control over deployments

The ADRs form a complete architectural foundation for implementing Epics 022-030.
