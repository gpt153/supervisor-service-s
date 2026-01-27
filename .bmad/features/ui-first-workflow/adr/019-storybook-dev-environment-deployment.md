# ADR 019: Storybook and Dev Environment Deployment Architecture

**Status:** Proposed
**Date:** 2026-01-22
**Context:** UI-First Development Workflow
**Related Epics:** 027 (Storybook Deployment), 028 (Dev Environment Deployment), 030 (Shared CNAME Infrastructure)

## Context

UI-First workflow requires two distinct deployment environments:

1. **Component Library (Storybook)** - Isolated components for design system
2. **Interactive Mockups (Dev Environment)** - Full app with mock data for testing flows

Need to decide deployment architecture, URL structure, and lifecycle management.

## Decision

**Dual-Track Deployment: Permanent Storybook + Ephemeral Dev Environments**

### Track 1: Storybook (Permanent)
- **Purpose**: Component library / design system showcase
- **Lifecycle**: Create once per project, runs permanently
- **URL**: `ui.153.se/[project]/storybook`
- **Technology**: Storybook static build served by nginx
- **Port**: Allocated from project range (e.g., 5050 for Consilio)
- **Update Frequency**: On design system changes only

### Track 2: Dev Environment (Ephemeral)
- **Purpose**: Interactive feature mockups for testing user flows
- **Lifecycle**: Created per epic, destroyed after backend connection
- **URL**: `ui.153.se/[project]/dev`
- **Technology**: Vite dev server with hot reload
- **Port**: Allocated from project range (e.g., 5051 for Consilio)
- **Update Frequency**: Hot reload during active development

### Shared Infrastructure
- **CNAME**: Single `ui.153.se` domain
- **Proxy**: nginx on port 8080 with path-based routing
- **Port Allocation**: From project-specific ranges
- **Tunnel**: Cloudflare tunnel for HTTPS access

## Rationale

### Why Two Tracks?

**Storybook Advantages:**
- ✅ Isolated component testing (no app context)
- ✅ Component documentation and examples
- ✅ Design system source of truth
- ✅ Reusable across all features
- ✅ Industry standard tool

**Dev Environment Advantages:**
- ✅ Full app context (navigation, state, routing)
- ✅ Complete user flows testable
- ✅ Interactive with mock data
- ✅ Rapid iteration with hot reload
- ✅ Realistic UX validation

**Why Both?**
- Storybook alone: Can't test complete workflows
- Dev environment alone: No component documentation
- Together: Component library + flow testing

### Why Permanent vs Ephemeral?

**Storybook (Permanent):**
- Design system changes infrequently
- Components reused across features
- Reference documentation needed long-term
- No cost to keep running

**Dev Environment (Ephemeral):**
- Created for epic development only
- Replaced by real backend after approval
- No value after implementation complete
- Saves resources (ports, memory)

### Why Shared CNAME?

- Single DNS entry (no per-project CNAMEs)
- Clean URL namespace
- Scalable (add projects without DNS changes)
- Standard reverse proxy pattern

## Consequences

### Positive

1. **Clear Separation of Concerns**:
   - Component library (global) vs feature mockup (temporary)
   - Reusable components vs one-time prototypes

2. **Resource Efficiency**:
   - Storybook runs once per project (not per epic)
   - Dev environments cleaned up after use

3. **Flexible Workflow**:
   - Can test components in isolation (Storybook)
   - Can test flows end-to-end (dev environment)
   - Both accessible via same domain

4. **Scalability**:
   - Add projects without infrastructure changes
   - Standard patterns across all projects

### Negative

1. **Complexity**:
   - Two deployment types to manage
   - Port allocation for both tracks
   - nginx config updates for both

2. **Lifecycle Management**:
   - Must track when to destroy dev environments
   - Must update Storybook when design system changes

3. **Single Point of Failure**:
   - nginx failure affects all UI tooling
   - Port conflicts could break deployments

### Mitigation

1. **Complexity**: Clear MCP tools abstract complexity
2. **Lifecycle**: Database tracks deployment status (active/stopped)
3. **SPOF**: nginx health monitoring, graceful config reload

## Implementation

### URL Structure

```
ui.153.se/consilio/storybook  → Port 5050 (permanent)
ui.153.se/consilio/dev        → Port 5051 (ephemeral, epic-specific)
ui.153.se/odin/storybook      → Port 5300 (permanent)
ui.153.se/odin/dev            → Port 5301 (ephemeral, epic-specific)
```

### nginx Configuration

```nginx
# Storybook (permanent)
location /consilio/storybook/ {
    proxy_pass http://localhost:5050/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}

# Dev environment (ephemeral)
location /consilio/dev/ {
    proxy_pass http://localhost:5051/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

### Port Allocation

| Project | Storybook | Dev Environment | Range |
|---------|-----------|-----------------|-------|
| Consilio | 5050 | 5051 | 5000-5099 |
| Health-Agent | 5150 | 5151 | 5100-5199 |
| OpenHorizon | 5250 | 5251 | 5200-5299 |
| Odin | 5350 | 5351 | 5300-5399 |

### Database Schema

```sql
-- Track both deployment types
CREATE TABLE ui_deployments (
  id SERIAL PRIMARY KEY,
  project_name TEXT NOT NULL,
  deployment_type TEXT NOT NULL, -- 'storybook' or 'dev'
  epic_id TEXT, -- NULL for Storybook, epic ID for dev
  port INTEGER NOT NULL,
  url TEXT NOT NULL, -- Full URL (ui.153.se/project/type)
  nginx_location TEXT, -- nginx config snippet
  status TEXT, -- 'active', 'stopped'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Lifecycle Workflow

**Storybook Deployment (Once Per Project):**
```typescript
// Create design system + deploy Storybook
ui_create_design_system({
  project: "consilio",
  name: "Consilio Design System"
});
// → Allocates port 5050
// → Builds Storybook static files
// → Updates nginx config
// → Creates ui.153.se/consilio/storybook
```

**Dev Environment Deployment (Per Epic):**
```typescript
// Deploy interactive mockup for epic
ui_deploy_mockup({
  epicId: "epic-003",
  project: "consilio"
});
// → Allocates port 5051
// → Starts Vite dev server
// → Updates nginx config
// → Creates ui.153.se/consilio/dev

// Later: Connect to real backend
ui_connect_backend({ epicId: "epic-003" });
// → Stops dev server
// → Releases port 5051
// → Removes nginx location
// → Marks deployment as 'stopped'
```

## Alternatives Considered

### Alternative 1: Storybook Only
- ❌ Can't test complete user flows
- ❌ No app context (routing, navigation)
- ❌ Limited to component-level testing

### Alternative 2: Dev Environment Only
- ❌ No component documentation
- ❌ Hard to test components in isolation
- ❌ No design system reference

### Alternative 3: Per-Epic Storybook + Dev
- ❌ Too many Storybook instances (resource waste)
- ❌ Component duplication across epics
- ❌ No single design system source

### Alternative 4: Single Environment for Both
- ❌ Mixed concerns (library + mockup)
- ❌ Can't maintain permanent component library
- ❌ Confusing UX (what's the purpose?)

## Validation Criteria

### Functional
- ✅ Storybook accessible at ui.153.se/[project]/storybook
- ✅ Dev environment accessible at ui.153.se/[project]/dev
- ✅ Both support hot reload / live updates
- ✅ Port allocation from project ranges
- ✅ nginx config auto-updates on deployment
- ✅ Dev environment cleaned up after epic complete

### Non-Functional
- ✅ Storybook loads in <3 seconds
- ✅ Dev environment hot reload in <1 second
- ✅ nginx config reload with zero downtime
- ✅ Port conflicts detected and prevented

## Related Decisions

- **ADR 007**: Frame0 vs Figma (design input method)
- **ADR 008**: Shared CNAME with nginx proxy (infrastructure)
- **ADR 009**: Mock data strategy (data in dev environments)

## References

- PRD: `/home/samuel/sv/supervisor-service-s/.bmad/prd/ui-first-workflow.md`
- Port Management: `.supervisor-core/08-port-ranges.md`
- Tunnel Management: `.supervisor-core/09-tunnel-management.md`
- Storybook Docs: https://storybook.js.org
