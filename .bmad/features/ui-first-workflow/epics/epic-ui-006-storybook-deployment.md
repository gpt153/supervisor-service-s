# Epic: Storybook Deployment (Design System Track)

**Epic ID:** UI-006
**Created:** 2026-01-22
**Status:** Planned
**Complexity Level:** 2
**Feature:** UI-First Development Workflow
**PRD:** `/home/samuel/sv/supervisor-service-s/.bmad/prd/ui-first-workflow.md`

## Summary

Deploy Storybook component library for each project to `ui.153.se/[project]/storybook`. Permanent deployment showcasing design system components with documentation and interactive examples.

## Key Features

**MUST HAVE:**
- [ ] Generate Storybook configuration per project
- [ ] Allocate port from project range (e.g., Consilio: 5050)
- [ ] Deploy Storybook to allocated port
- [ ] Update nginx config for path-based routing
- [ ] URL pattern: `ui.153.se/[project]/storybook`
- [ ] MCP tool: `ui_deploy_storybook({ project })`
- [ ] Hot reload for component changes

**SHOULD HAVE:**
- [ ] Component documentation auto-generation
- [ ] Usage examples for each component
- [ ] Design token showcase

## Architecture

```sql
CREATE TABLE ui_deployments (
  id SERIAL PRIMARY KEY,
  project_name TEXT NOT NULL,
  deployment_type TEXT, -- 'storybook' or 'dev'
  port INTEGER NOT NULL,
  url TEXT NOT NULL,
  nginx_location TEXT,
  status TEXT, -- 'active', 'stopped'
  created_at TIMESTAMP DEFAULT NOW()
);
```

### nginx Configuration
```nginx
location /[project]/storybook/ {
    proxy_pass http://localhost:5050/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
}
```

## Estimated Effort
14 hours (1.5-2 days)

## Dependencies
- Epic UI-002: Design System Foundation (need design system)
- Tunnel Manager: CNAME for ui.153.se (already exists)

## Testing
- Deploy Storybook for test project
- Access ui.153.se/test/storybook
- Verify components visible
- Test hot reload (change component, verify update)
- Test nginx reload (no downtime)
