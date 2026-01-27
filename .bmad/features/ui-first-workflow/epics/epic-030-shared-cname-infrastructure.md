# Epic: Shared CNAME Infrastructure

**Epic ID:** 030
**Created:** 2026-01-22
**Status:** Planned
**Complexity Level:** 2
**Feature:** UI-First Development Workflow

## Business Context

Single CNAME (ui.153.se) with nginx reverse proxy provides path-based routing to all UI tooling across all projects. Clean URLs, no DNS changes per project.

## Requirements

**MUST HAVE:**
- [ ] Allocate port 8080 for nginx reverse proxy
- [ ] Request CNAME: ui.153.se → localhost:8080
- [ ] Auto-generate nginx config with location blocks
- [ ] Path routing: /[project]/storybook → localhost:[storybook_port]
- [ ] Path routing: /[project]/dev → localhost:[dev_port]
- [ ] Reload nginx after config changes
- [ ] Track deployments in ui_deployments table

**SHOULD HAVE:**
- [ ] Health check endpoint: /health
- [ ] Nginx access logs per project
- [ ] Auto-cleanup of stopped deployments

## Architecture

**nginx Configuration:**
```nginx
server {
    listen 8080;
    server_name localhost;

    location /consilio/storybook/ {
        proxy_pass http://localhost:5050/;
    }

    location /consilio/dev/ {
        proxy_pass http://localhost:5051/;
    }

    # Auto-generated for each project
}
```

**Database:** ui_deployments.nginx_path = '/consilio/storybook'

## Implementation Tasks

- [ ] Create NginxConfigManager.ts
- [ ] Allocate port 8080 for nginx
- [ ] Request CNAME: tunnel_request_cname({ subdomain: 'ui', targetPort: 8080 })
- [ ] Generate nginx config from ui_deployments
- [ ] Reload nginx: nginx -s reload
- [ ] Auto-add location blocks when deployments created

**Estimated Effort:** 8 hours (1 day)

## Acceptance Criteria

- [ ] ui.153.se resolves to nginx on port 8080
- [ ] ui.153.se/consilio/storybook → Consilio's Storybook
- [ ] ui.153.se/consilio/dev → Consilio's dev mockup
- [ ] nginx config auto-updates when deployments change
- [ ] Multiple projects work simultaneously

## Dependencies

**Blocked By:** Epic 022 (Storybook), Epic 027 (Dev Deployment)
**External:** Tunnel Manager (CNAME creation)
