# Epic: Interactive Mockup Deployment

**Epic ID:** 027
**Created:** 2026-01-22
**Status:** Planned
**Complexity Level:** 3
**Feature:** UI-First Development Workflow

## Business Context

Deploy interactive React mockups with mock data to dev environment accessible via ui.153.se/[project]/dev. Users can click, navigate, test workflows before backend exists.

## Requirements

**MUST HAVE:**
- [ ] Generate React components from Frame0/Figma designs
- [ ] Inject mock data into components
- [ ] Vite/Next.js dev server setup per mockup
- [ ] Hot reload for rapid iteration
- [ ] Deploy to allocated port (project range + 50, e.g., 5050 for Consilio)
- [ ] MCP tool: ui_deploy_mockup({ epic_id, mockup_id })
- [ ] Register with nginx: ui.153.se/[project]/dev → localhost:PORT

**SHOULD HAVE:**
- [ ] React Router for multi-page mockups
- [ ] Form validation (client-side)
- [ ] Loading states and transitions
- [ ] Mobile responsive (via viewport)

## Architecture

**Flow:** Design → Code generation → Mock data injection → Dev server → nginx proxy → ui.153.se

**Port Allocation:**
- Storybook: Project base + 50 (5050 for Consilio)
- Dev mockup: Project base + 51 (5051 for Consilio)

**Database:** ui_deployments tracks active deployments

## Implementation Tasks

- [ ] Create MockupDeployer.ts
- [ ] Code generation from Frame0/Figma designs
- [ ] Template: Vite + React project
- [ ] Inject mock data imports
- [ ] Allocate port via PortManager
- [ ] Start dev server (npm run dev --port PORT)
- [ ] Register nginx location: /[project]/dev
- [ ] Store deployment in ui_deployments table
- [ ] MCP tool: ui_deploy_mockup

**Estimated Effort:** 12 hours (1.5 days)

## Acceptance Criteria

- [ ] ui_deploy_mockup generates React components from design
- [ ] Mock data injected and components render
- [ ] Dev server starts on allocated port
- [ ] ui.153.se/[project]/dev accessible and interactive
- [ ] Hot reload works for quick iteration
- [ ] Deployment tracked in ui_deployments table

## Dependencies

**Blocked By:** Epic 024 OR 025 (Design), Epic 026 (Mock Data)
**Blocks:** Epic 028 (Requirements Validation), Epic 029 (Backend Connection)
