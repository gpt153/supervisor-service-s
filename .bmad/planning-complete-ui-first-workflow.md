# Planning Complete: UI-First Development Workflow

**Date:** 2026-01-22
**Status:** Ready for Implementation
**Complexity Level:** 3 (Large Feature)
**Total Estimated Effort:** 120.5 hours (15 days)

---

## Summary

Comprehensive planning completed for UI-First Development Workflow feature. This feature enables Project Supervisors to design, build, and test interactive UI mockups with mock data at any point in the development cycle—before, during, or after backend implementation.

**Key Innovation:** Optional UI design phase that can be inserted anywhere in the development workflow, not a mandatory gate.

---

## Planning Artifacts Created

### 1. Product Requirements Document (PRD)
**File:** `.bmad/prd/ui-first-workflow.md`
**Status:** ✅ Complete

**Contents:**
- Executive summary
- Problem statement and impact
- Solution overview (two-track approach)
- Requirements (MoSCoW prioritization)
- Architecture (system components, database schema)
- Success criteria
- Risks & mitigation
- Dependencies
- Epic breakdown (9 epics)

---

### 2. Epic Breakdown (9 Epics)

**Epic UI-001: Requirements Analysis Engine**
- **File:** `.bmad/epics/ui-001-requirements-analysis-engine.md`
- **Complexity:** Level 2
- **Estimated Effort:** 15 hours (2 days)
- **Purpose:** Extract UI requirements from epic acceptance criteria
- **Key Features:**
  - Parse epic markdown files
  - Extract acceptance criteria and user stories
  - Identify required UI elements, flows, data needs
  - MCP tool: `ui_analyze_epic({ epicId })`
- **Dependencies:** None (foundational)
- **Blocks:** UI-003, UI-004, UI-008

**Epic UI-002: Design System Foundation**
- **File:** `.bmad/epics/ui-002-design-system-foundation.md`
- **Complexity:** Level 2
- **Estimated Effort:** 12 hours (1.5 days)
- **Purpose:** Create and manage component libraries (global, reusable)
- **Key Features:**
  - Create design_systems database table
  - MCP tool: `ui_create_design_system`
  - Generate Storybook configuration
  - Store design tokens (colors, fonts, spacing)
- **Dependencies:** None (foundational)
- **Blocks:** UI-003, UI-004, UI-006

**Epic UI-003: Frame0 Design Generation Integration**
- **File:** `.bmad/epics/ui-003-frame0-design-generation.md`
- **Complexity:** Level 2
- **Estimated Effort:** 13.5 hours (1.5 days)
- **Purpose:** Generate UI designs from requirements using Frame0 AI
- **Key Features:**
  - MCP tool: `ui_generate_design({ method: "frame0" })`
  - Generate Frame0 design prompt from requirements
  - Create Frame0 frames, components
  - Export design as image for preview
- **Dependencies:** UI-001
- **Blocks:** UI-007

**Epic UI-004: Figma Design Import Integration**
- **File:** `.bmad/epics/ui-004-figma-design-import.md`
- **Complexity:** Level 2
- **Estimated Effort:** 12 hours (1.5 days)
- **Purpose:** Import UI designs from Figma URLs as alternative to Frame0
- **Key Features:**
  - MCP tool: `ui_generate_design({ method: "figma", figmaUrl })`
  - Import design from Figma URL using Figma MCP
  - Extract component hierarchy and design tokens
  - Map Figma components to acceptance criteria
- **Dependencies:** UI-001
- **Blocks:** UI-007

**Epic UI-005: Mock Data Generation System**
- **File:** `.bmad/epics/ui-005-mock-data-generation.md`
- **Complexity:** Level 2
- **Estimated Effort:** 12 hours (1.5 days)
- **Purpose:** Create realistic fake data for UI mockup testing
- **Key Features:**
  - MCP tool: `ui_generate_mock_data({ epicId, count })`
  - Support Faker.js for realistic data
  - Domain templates (users, products, orders)
  - Store mock data specs in database
- **Dependencies:** UI-001
- **Blocks:** UI-007

**Epic UI-006: Storybook Deployment (Design System Track)**
- **File:** `.bmad/epics/ui-006-storybook-deployment.md`
- **Complexity:** Level 2
- **Estimated Effort:** 14 hours (1.5-2 days)
- **Purpose:** Deploy Storybook component library at ui.153.se/[project]/storybook
- **Key Features:**
  - MCP tool: `ui_deploy_storybook({ project })`
  - Generate Storybook configuration
  - Allocate port, deploy to dev server
  - Update nginx config for path-based routing
  - Hot reload for component changes
- **Dependencies:** UI-002
- **Blocks:** None (parallel track)

**Epic UI-007: Dev Environment Deployment (Feature Mockup Track)**
- **File:** `.bmad/epics/ui-007-dev-environment-deployment.md`
- **Complexity:** Level 2
- **Estimated Effort:** 16 hours (2 days)
- **Purpose:** Deploy interactive mockups at ui.153.se/[project]/dev
- **Key Features:**
  - MCP tool: `ui_deploy_mockup({ epicId })`
  - Generate React components from design
  - Inject mock data into components
  - Deploy to Vite/Next.js dev server
  - All user flows functional (search, filter, navigate, actions)
- **Dependencies:** UI-003/UI-004, UI-005, UI-006
- **Blocks:** UI-009

**Epic UI-008: MCP Tool Suite Implementation**
- **File:** `.bmad/epics/ui-008-mcp-tool-suite.md`
- **Complexity:** Level 2
- **Estimated Effort:** 12 hours (1.5 days)
- **Purpose:** Consolidate all UI workflow MCP tools into unified suite
- **Key Features:**
  - 8 core MCP tools (all previous epics)
  - Unified error handling and validation
  - Consistent response format
  - Tool documentation and examples
  - Integration tests for complete workflows
- **Dependencies:** UI-001 through UI-007
- **Blocks:** None (integration epic)

**Epic UI-009: UI to Backend Connection Workflow**
- **File:** `.bmad/epics/ui-009-backend-connection-workflow.md`
- **Complexity:** Level 2
- **Estimated Effort:** 14 hours (1.5-2 days)
- **Purpose:** Replace mock data with real backend API calls
- **Key Features:**
  - MCP tool: `ui_connect_backend({ epicId, backendUrl })`
  - Replace mock data with API fetch calls
  - Replace mock actions with real API endpoints
  - Update deployment from dev to production
  - Verify all user flows work with real backend
- **Dependencies:** UI-007, Backend implementation complete
- **Blocks:** None (final epic)

---

### 3. Workflow Status Tracker
**File:** `.bmad/workflow-status-ui-first.yaml`
**Status:** ✅ Complete

**Contents:**
- Current phase: Planning (complete)
- Epic breakdown (9 epics, all planned)
- Dependencies and blockers
- Estimated timeline (15 days)
- Progress metrics (0% complete)
- Key decisions
- Risks and mitigation
- Next steps

---

## Implementation Strategy

### Phase 1: Foundation (Epics UI-001, UI-002)
**Duration:** 3-4 days
**Parallel:** Can be done simultaneously
- Epic UI-001: Requirements Analysis Engine
- Epic UI-002: Design System Foundation

### Phase 2: Design Methods (Epics UI-003, UI-004, UI-005)
**Duration:** 4-5 days
**Parallel:** UI-003 and UI-004 can run in parallel
- Epic UI-003: Frame0 Design Generation
- Epic UI-004: Figma Design Import
- Epic UI-005: Mock Data Generation

### Phase 3: Deployment (Epics UI-006, UI-007)
**Duration:** 3-4 days
**Parallel:** UI-006 (Storybook) separate track from UI-007 (dev)
- Epic UI-006: Storybook Deployment
- Epic UI-007: Dev Environment Deployment

### Phase 4: Integration & Connection (Epics UI-008, UI-009)
**Duration:** 3-4 days
**Sequential:** UI-008 integrates all tools, UI-009 finalizes
- Epic UI-008: MCP Tool Suite
- Epic UI-009: Backend Connection Workflow

**Total Duration:** 13-17 days (realistic estimate: 15 days)

---

## Database Schema Summary

### Tables to Create
1. **ui_requirements** (Epic UI-001)
   - Stores UI requirements extracted from epics
   - JSONB for acceptance criteria, user stories, data needs

2. **design_systems** (Epic UI-002)
   - Stores design systems per project
   - JSONB for style config, component library

3. **ui_mockups** (Epic UI-003/UI-004)
   - Stores feature mockups (Frame0 or Figma)
   - References to designs, deployment URLs, status

4. **ui_deployments** (Epic UI-006/UI-007)
   - Tracks Storybook and dev environment deployments
   - Port allocations, nginx configs, status

---

## MCP Tools to Implement

### Core Tools (MVP)
1. `ui_create_design_system({ project, styleConfig })`
2. `ui_analyze_epic({ epicId })`
3. `ui_generate_design({ epicId, method, ...params })`
4. `ui_generate_mock_data({ epicId, count })`
5. `ui_deploy_storybook({ project })`
6. `ui_deploy_mockup({ epicId })`
7. `ui_get_preview_urls({ project })`
8. `ui_validate_requirements({ epicId })`

### Enhanced Tools (v1.1)
9. `ui_screenshot_mockup({ epicId })`
10. `ui_export_design_tokens({ project })`
11. `ui_check_accessibility({ epicId })`

---

## Success Criteria

### Functional
- ✓ PS can create design system in <5 minutes
- ✓ PS can generate epic UI from requirements in <10 minutes
- ✓ Interactive mockup deployed and accessible via URL
- ✓ All user flows testable with mock data (no backend)
- ✓ User can validate UX before backend implementation
- ✓ 100% of acceptance criteria mapped to UI elements
- ✓ Design changes take <2 minutes (update → redeploy)

### Non-Functional
- ✓ Storybook loads in <3 seconds
- ✓ Dev environment hot reload in <1 second
- ✓ Design generation (Frame0) completes in <30 seconds
- ✓ Mock data generation scales to 1000+ records
- ✓ All preview URLs accessible via HTTPS (ui.153.se)

---

## Key Architectural Decisions

1. **Shared CNAME with path-based routing**
   - Single `ui.153.se` domain for all UI tooling
   - nginx reverse proxy routes by path: `/[project]/storybook` and `/[project]/dev`
   - No DNS changes when adding projects

2. **Two-track approach**
   - **Track 1:** Design system (global, reusable, permanent)
   - **Track 2:** Feature mockups (epic-driven, temporary)

3. **Frame0 as default, Figma as fallback**
   - Frame0: Fast AI-generated designs for mockups
   - Figma: Professional designs for production-quality

4. **Optional UI design phase (not mandatory)**
   - UI can be designed before, during, or after backend
   - Flexibility based on project needs
   - Tool, not gate

5. **Requirements-driven design**
   - 100% acceptance criteria coverage
   - Traceability: Map UI elements to ACs
   - Validation: Check completeness before deployment

---

## Next Steps

1. **Start Implementation:**
   - Begin with Epic UI-001 (Requirements Analysis Engine)
   - Can parallelize Epic UI-001 and UI-002 (Design System Foundation)

2. **Create ADRs During Implementation:**
   - Frame0 vs Figma as default design method
   - Mock data strategy (hardcoded vs Faker vs MSW)
   - Deployment architecture (Storybook + dev env)
   - Shared CNAME with path-based routing

3. **Set Up Integration Tests:**
   - End-to-end workflow tests
   - Error handling tests
   - Performance tests

4. **Document PS Guides:**
   - UI workflow guide for Project Supervisors
   - MCP tool reference with examples
   - Troubleshooting guide

---

## Files Created

1. `.bmad/prd/ui-first-workflow.md` - Product Requirements Document
2. `.bmad/epics/ui-001-requirements-analysis-engine.md` - Epic UI-001
3. `.bmad/epics/ui-002-design-system-foundation.md` - Epic UI-002
4. `.bmad/epics/ui-003-frame0-design-generation.md` - Epic UI-003
5. `.bmad/epics/ui-004-figma-design-import.md` - Epic UI-004
6. `.bmad/epics/ui-005-mock-data-generation.md` - Epic UI-005
7. `.bmad/epics/ui-006-storybook-deployment.md` - Epic UI-006
8. `.bmad/epics/ui-007-dev-environment-deployment.md` - Epic UI-007
9. `.bmad/epics/ui-008-mcp-tool-suite.md` - Epic UI-008
10. `.bmad/epics/ui-009-backend-connection-workflow.md` - Epic UI-009
11. `.bmad/workflow-status-ui-first.yaml` - Workflow status tracker
12. `.bmad/planning-complete-ui-first-workflow.md` - This summary

**Total:** 12 planning files created

---

**Planning Agent:** Claude Sonnet 4.5 (Meta-Supervisor)
**Planning Methodology:** BMAD with MoSCoW prioritization
**Ready for Implementation:** YES ✅
**Estimated Completion Date:** 2026-02-06 (assuming start 2026-01-23)
