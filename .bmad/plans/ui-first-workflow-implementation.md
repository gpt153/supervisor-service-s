# Implementation Plan: UI-First Development Workflow

**Created:** 2026-01-22
**Feature Request:** ui-first-development-workflow.md
**Epics:** 022-030
**Estimated Total:** 10-12 days

---

## Overview

Implement UI-first workflow enabling PSs to:
1. Extract UI requirements from epics (traceability)
2. Generate designs via Frame0 or Figma
3. Deploy interactive mockups with mock data
4. Validate requirements coverage
5. Connect to real backend when ready

All UI accessible via **ui.153.se** with path-based routing.

---

## Implementation Phases

### Phase 1: Foundation (Epics 022, 023, 026)
**Duration:** 3-4 days
**Goal:** Core infrastructure and requirements analysis

**Tasks:**
1. Epic 022: Design System Foundation
   - Create design_systems table
   - Storybook template and deployer
   - MCP tool: ui_create_design_system

2. Epic 023: Requirements Analysis Engine
   - Create ui_requirements table
   - Epic parser (markdown → structured requirements)
   - MCP tool: ui_analyze_epic

3. Epic 026: Mock Data System
   - Mock data templates (hardcoded, Faker.js, MSW)
   - MockDataGenerator class
   - Entity templates (users, products, orders)

**Deliverable:** PSs can create design systems, extract requirements from epics, generate mock data

---

### Phase 2: Design Generation (Epics 024, 025)
**Duration:** 2 days
**Goal:** Frame0 and Figma integration

**Tasks:**
1. Epic 024: Frame0 Design Generation
   - Wrap Frame0 MCP tools
   - Requirements → Frame0 commands
   - PNG export for approval

2. Epic 025: Figma Design Import
   - Wrap Figma MCP tools
   - Component hierarchy extraction
   - Design tokens sync

**Deliverable:** PSs can generate designs from text OR import from Figma

---

### Phase 3: Interactive Mockups (Epics 027, 030)
**Duration:** 3 days
**Goal:** Deploy interactive mockups with shared CNAME

**Tasks:**
1. Epic 027: Interactive Mockup Deployment
   - Code generation (Frame0/Figma → React)
   - Vite dev server setup
   - Mock data injection
   - Port allocation and deployment
   - MCP tool: ui_deploy_mockup

2. Epic 030: Shared CNAME Infrastructure
   - nginx reverse proxy on port 8080
   - CNAME: ui.153.se → localhost:8080
   - Auto-generate nginx location blocks
   - Path routing: /[project]/storybook, /[project]/dev

**Deliverable:** ui.153.se/[project]/dev shows interactive mockups

---

### Phase 4: Validation & Connection (Epics 028, 029)
**Duration:** 2-3 days
**Goal:** Validate requirements, connect to backend

**Tasks:**
1. Epic 028: Requirements Validation
   - Traceability checker (AC → UI component mapping)
   - Gap analysis (missing ACs)
   - MCP tool: ui_validate_requirements

2. Epic 029: Backend Connection
   - Replace mock data with API calls
   - Generate API client
   - Loading/error states
   - MCP tool: ui_connect_backend

**Deliverable:** Validated UIs connect to real backends

---

## Database Migrations

**Priority Order:**
1. 022-create-design-systems.sql
2. 023-create-ui-requirements.sql
3. 027-create-ui-mockups.sql
4. 030-create-ui-deployments.sql

---

## MCP Tools Created

1. **ui_create_design_system** - Create component library with Storybook
2. **ui_analyze_epic** - Extract UI requirements from epic
3. **ui_generate_design** - Generate via Frame0 or import from Figma
4. **ui_deploy_mockup** - Deploy interactive mockup with mock data
5. **ui_get_preview_urls** - Get Storybook + dev URLs
6. **ui_validate_requirements** - Check AC coverage
7. **ui_connect_backend** - Replace mock data with real API

---

## Critical Files

**Core:**
- src/ui/UIManager.ts - Orchestrator
- src/ui/RequirementsAnalyzer.ts - Epic parsing
- src/ui/DesignGenerator.ts - Frame0 + Figma wrapper
- src/ui/MockupDeployer.ts - Vite deployment
- src/ui/NginxConfigManager.ts - nginx automation

**Templates:**
- templates/storybook/ - Storybook config
- templates/mock-data/ - Entity templates
- templates/vite-react/ - Mockup project

---

## Testing Strategy

**Per Epic:**
- Unit tests for parsers and generators
- Integration tests for MCP tools
- Manual testing via MCP tool calls

**End-to-End:**
1. Create design system: ui_create_design_system
2. Analyze epic: ui_analyze_epic(epic-003)
3. Generate design: ui_generate_design (Frame0)
4. Deploy mockup: ui_deploy_mockup
5. Validate: ui_validate_requirements
6. Access: ui.153.se/test/dev

---

## Success Criteria

- ✅ All 9 epics implemented and tested
- ✅ All 7 MCP tools functional
- ✅ ui.153.se accessible with path routing
- ✅ Requirements traceability working
- ✅ Mock-to-real backend migration works
- ✅ Documentation complete

---

## Risks & Mitigation

| Risk | Mitigation |
|------|-----------|
| nginx config corruption | Backup before edit, validate |
| Port conflicts | Use dedicated ranges per project |
| Frame0 designs lack quality | Support Figma as alternative |
| Mock data unrealistic | Provide Faker.js templates |

---

## Post-Implementation

1. **Documentation:**
   - Update mcp-tools-reference.md
   - Create ui-workflow-guide.md
   - Add examples to feature request

2. **Training:**
   - Demo to PSs
   - Record video walkthrough

3. **Monitoring:**
   - Track MCP tool usage
   - Monitor ui.153.se uptime
   - Collect PS feedback
