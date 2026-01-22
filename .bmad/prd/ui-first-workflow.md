# PRD: UI-First Development Workflow

**Created:** 2026-01-22
**Status:** Approved for Planning
**Complexity Level:** 3 (Large Feature)
**Priority:** High
**Version:** 1.0

---

## Executive Summary

A flexible, requirements-driven UI development workflow that enables Project Supervisors to design, build, and test interactive UI mockups with mock data at any point in the development cycle—before, during, or after backend implementation. The system uses Frame0/Figma MCP for design generation, Storybook for component libraries, and dev environment deployments for full-app testing via a shared CNAME (`ui.153.se`).

**Key Innovation:** Optional UI design phase that can be inserted anywhere in the development workflow, not a mandatory gate.

---

## Problem Statement

### Current State
UI development in the SV system is tightly coupled with backend implementation, leading to:

1. **No UI-first capability** - Cannot design and test UX before building backend
2. **No requirements traceability** - UI designed without explicit mapping to epic acceptance criteria
3. **No interactive mockups** - Cannot test user flows without real backend
4. **No design system** - No reusable component library across features
5. **Late UX validation** - UX problems discovered after backend is built (expensive to change)
6. **No preview environments** - Cannot show interactive prototypes to stakeholders

### Impact
- Backend built for wrong UX (rework required)
- Inconsistent UI across features
- Slow iteration on design changes
- Poor user experience validation
- Cannot rapidly prototype new ideas

### Target Users
**Primary:** Project Supervisors (PSs) building web and mobile applications
**Secondary:** Stakeholders who need to review UI prototypes

---

## Solution Overview

### Two-Track Approach

**Track 1: Design System (Global, Reusable)**
- Create component library once per project
- Define global styles (colors, fonts, spacing)
- Deploy to Storybook at `ui.153.se/[project]/storybook`
- Reuse across all features

**Track 2: Feature UI (Epic-Driven, Temporary)**
- Read epic acceptance criteria
- Generate UI that satisfies all requirements
- Create mock data for testing
- Deploy interactive mockup at `ui.153.se/[project]/dev`
- Map UI elements to requirements (traceability)
- Iterate until approved
- Replace with real backend when ready

### Flexible Workflow Options

The UI design phase is **OPTIONAL** and can happen at any point:

1. **UI-First:** Design → Validate UX → Build backend → Connect
2. **Backend-First:** Build backend → Later: Design UI → Connect
3. **Parallel:** Design UI while PIV builds backend → Connect when both ready
4. **Planning Phase:** Design mockups during BMAD → Approve before implementation

**Key Principle:** UI design is a TOOL, not a mandatory gate.

---

## Requirements (MoSCoW)

### MUST HAVE (MVP)

#### Requirements Analysis Phase
- [ ] MCP tool: `ui_analyze_epic({ epicId })` - Extract UI requirements from epic
- [ ] Parse acceptance criteria and user stories
- [ ] Identify required UI elements (forms, lists, actions)
- [ ] Detect user flows and navigation needs
- [ ] Return structured UI requirements spec

#### Design Generation Phase
- [ ] MCP tool: `ui_generate_design({ epicId, method })` - Generate UI from requirements
- [ ] Support Frame0 path (AI generates design from text)
- [ ] Support Figma path (import design from URL)
- [ ] Show preview image to user
- [ ] Allow iteration on feedback
- [ ] Map design elements to acceptance criteria

#### Interactive Mockup Phase
- [ ] Generate React/React Native components
- [ ] Create mock data (hardcoded or Faker.js)
- [ ] Implement all user flows with fake backend
- [ ] Deploy to dev environment at `ui.153.se/[project]/dev`
- [ ] All interactions work (search, filter, navigation, actions)

#### Design System Track
- [ ] MCP tool: `ui_create_design_system({ project, name, styleConfig })`
- [ ] Generate component library (buttons, inputs, cards, navigation, modals)
- [ ] Define global styles (colors, fonts, spacing, shadows)
- [ ] Deploy to Storybook at `ui.153.se/[project]/storybook`
- [ ] Reusable across all features in project

#### Validation Phase
- [ ] MCP tool: `ui_validate_requirements({ epicId })` - Check AC coverage
- [ ] User tests all user flows interactively
- [ ] Verify acceptance criteria satisfied
- [ ] Iterate on design/interactions
- [ ] Approve when ready

#### Backend Connection Phase
- [ ] MCP tool: `ui_connect_backend({ epicId })` - Replace mock with real API
- [ ] Replace mock data with real API calls
- [ ] Replace mock actions with real backend operations
- [ ] Deploy to production

#### Deployment Infrastructure
- [ ] Shared CNAME: `ui.153.se` → nginx reverse proxy
- [ ] Path-based routing: `/[project]/storybook` and `/[project]/dev`
- [ ] Port allocation from project ranges
- [ ] Auto-generate nginx config
- [ ] Hot reload for dev environment

#### State Management
- [ ] Database table: `design_systems` - Component libraries per project
- [ ] Database table: `ui_mockups` - Feature mockups (epic, URL, status)
- [ ] Database table: `ui_requirements` - Map UI elements to acceptance criteria
- [ ] Database table: `ui_deployments` - Track Storybook and dev environment

### SHOULD HAVE (v1.1)

- [ ] Enhanced MCP tools:
  - `ui_generate_mock_data` - Generate realistic fake data for domain
  - `ui_screenshot_mockup` - Take screenshots for documentation
  - `ui_export_design_tokens` - Export colors/fonts as CSS variables
  - `ui_check_accessibility` - Validate WCAG compliance

- [ ] Advanced mockup features:
  - URL routing (multi-page navigation)
  - Form validation (client-side only)
  - Loading states and animations
  - Error states and edge cases
  - Responsive design preview

- [ ] Design system management:
  - Version design system (track changes)
  - Update all features when design system changes
  - Design token management
  - Component documentation in Storybook

### COULD HAVE (v2.0)

- [ ] Visual regression testing (screenshot comparison)
- [ ] A/B testing in mockups
- [ ] User session recording in mockups
- [ ] Analytics in mockups (track which flows users test)
- [ ] AI suggests improvements based on UX best practices

### WON'T HAVE (Out of Scope)

- Backend implementation (that's PIV loop's job)
- Real database or API (mockups use fake data only)
- Production deployment of mockups (dev-only)
- Advanced design tools (use Figma for that)
- Collaboration platform (not competing with Figma)
- Design version control (use git for code)

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────┐
│  Epic (.bmad/epics/epic-XXX.md)             │
│  ├─ Acceptance Criteria                     │
│  ├─ User Stories                            │
│  └─ Technical Notes                         │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  Requirements Analysis (PS)                 │
│  ui_analyze_epic({ epicId })                │
│  → UI elements, flows, data needs           │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  Design Generation (PS)                     │
│  ui_generate_design({ epicId, method })     │
│  → Frame0 creates design from requirements  │
│  → Shows preview, user approves/iterates    │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  Interactive Mockup Generation (PS)         │
│  → React components                         │
│  → Mock data (hardcoded or Faker.js)        │
│  → All interactions work (no backend)       │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  Deployment to Dev Environment              │
│  ui_deploy_mockup({ epicId })               │
│  → Allocate port from project range         │
│  → Start Vite dev server                    │
│  → Update nginx config                      │
│  → URL: ui.153.se/[project]/dev             │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  User Tests Mockup Interactively            │
│  → Test all user flows                      │
│  → Verify acceptance criteria               │
│  → Provide feedback                         │
│  → Iterate until approved                   │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  Backend Implementation (PIV Loop)          │
│  → Build real backend after UI approved     │
│  → Database, API, business logic            │
│  → Run tests                                │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  Connect UI to Real Backend                 │
│  ui_connect_backend({ epicId })             │
│  → Replace mock data with API calls         │
│  → Deploy to production                     │
└─────────────────────────────────────────────┘
```

### Technology Stack

**Frontend:**
- React (web)
- React Native (mobile)
- Vite/Next.js (dev server)
- Storybook (component library)

**Backend:**
- Node.js + TypeScript
- PostgreSQL (state management)
- MCP tools (operations)

**Design Tools:**
- Frame0 MCP (AI design generation)
- Figma MCP (design import)

**Infrastructure:**
- nginx (reverse proxy for ui.153.se)
- Cloudflare Tunnel (HTTPS access)
- Port allocation system (existing)

### Database Schema

```sql
-- Design systems (global component libraries)
CREATE TABLE design_systems (
  id SERIAL PRIMARY KEY,
  project_name TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  style_config JSONB, -- colors, fonts, spacing
  component_library JSONB, -- Button, Input, Card...
  storybook_port INTEGER,
  storybook_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_name, name)
);

-- Feature mockups (epic-driven, temporary)
CREATE TABLE ui_mockups (
  id SERIAL PRIMARY KEY,
  epic_id TEXT NOT NULL,
  project_name TEXT NOT NULL,
  design_method TEXT, -- 'frame0' or 'figma'
  design_url TEXT, -- Frame0 export or Figma URL
  dev_port INTEGER,
  dev_url TEXT, -- ui.153.se/[project]/dev
  status TEXT, -- 'designing', 'deployed', 'approved', 'connected'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Requirements traceability
CREATE TABLE ui_requirements (
  id SERIAL PRIMARY KEY,
  epic_id TEXT NOT NULL,
  acceptance_criteria_id TEXT NOT NULL,
  ui_elements JSONB, -- { component, props, location }
  user_flow JSONB, -- [ { step, action } ]
  created_at TIMESTAMP DEFAULT NOW()
);

-- Deployment tracking
CREATE TABLE ui_deployments (
  id SERIAL PRIMARY KEY,
  project_name TEXT NOT NULL,
  deployment_type TEXT, -- 'storybook' or 'dev'
  port INTEGER NOT NULL,
  url TEXT NOT NULL,
  nginx_location TEXT, -- nginx config snippet
  status TEXT, -- 'active', 'stopped'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Integration Points

- **Port Manager:** Allocate ports for Storybook and dev environments
- **Tunnel Manager:** CNAME creation (ui.153.se) and nginx config updates
- **Frame0 MCP:** Design generation from text descriptions
- **Figma MCP:** Design import from Figma URLs
- **PIV Loop:** Backend implementation after UI approved

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
- ✓ All preview URLs accessible via HTTPS

### User Experience
- ✓ User never needs to understand UI implementation details
- ✓ Clear mapping between epic requirements and UI elements
- ✓ Interactive testing feels like real app
- ✓ Fast iteration on design changes
- ✓ Can show working prototypes to stakeholders

---

## Risks & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Frame0 designs may not match expectations | Medium | Medium | Support Figma fallback, allow iteration |
| Mock data may not be realistic enough | Low | Medium | Use Faker.js, domain templates |
| Dev environment stability issues | Low | Medium | Auto-restart, monitoring, health checks |
| Port conflicts across projects | Low | High | Use project-specific port ranges |
| CNAME conflicts | Low | Medium | Strict naming conventions, validation |
| nginx config errors break all UI tools | Low | High | Validate config before reload, backup config |

---

## Dependencies

### Blockers (Must Exist Before Implementation)
- ✓ Frame0 MCP tools (exist)
- ✓ Figma MCP tools (exist)
- ✓ Port allocation system (exists)
- ✓ Cloudflare tunnel manager (exists)
- ✓ .bmad/ structure with epics (exists)
- ✓ nginx installed on server (exists)

### Parallel Dependencies (Can Build Alongside)
- PIV loop enhancements for backend implementation
- Mobile app development platform (for React Native mockups)

### Blocks (Enables Future Work)
- Faster product iteration across all projects
- Better UX validation before costly backend work
- Reduced development rework
- Stakeholder preview capability
- Design consistency across features

---

## Implementation Plan

### Epic Breakdown

This feature is broken into 9 epics for PIV loop implementation:

1. **Epic 001: Requirements Analysis Engine** - Extract UI requirements from epics
2. **Epic 002: Design System Foundation** - Create and manage component libraries
3. **Epic 003: Frame0 Design Generation** - AI-generated designs from requirements
4. **Epic 004: Figma Design Import** - Import designs from Figma URLs
5. **Epic 005: Mock Data Generation** - Realistic fake data for testing
6. **Epic 006: Storybook Deployment** - Component library hosting
7. **Epic 007: Dev Environment Deployment** - Interactive mockup hosting
8. **Epic 008: MCP Tool Suite** - Complete UI workflow tools
9. **Epic 009: Backend Connection Workflow** - Replace mock with real API

### Estimated Timeline
- **Total:** 2-3 days (based on complexity level 3)
- **Per Epic:** 4-8 hours
- **Can parallelize:** Epics 3+4 (design methods), Epics 6+7 (deployments)

---

## Appendix

### Related Documentation
- Feature Request: `/home/samuel/sv/supervisor-service-s/.bmad/feature-requests/ui-first-development-workflow.md`
- BMAD Workflow Guide: `/home/samuel/sv/docs/bmad-workflow.md`
- Port Management Guide: `/home/samuel/sv/docs/guides/port-management-examples.md`
- Tunnel Management: `.supervisor-core/09-tunnel-management.md`

### Key Decisions
- **Shared CNAME:** Single `ui.153.se` with path-based routing reduces DNS overhead
- **JSONB for flexibility:** Style config and component library as JSONB for easy extension
- **Optional workflow:** UI design is a tool, not a mandatory gate
- **Requirements-driven:** Every UI element must map to acceptance criteria

### Future Enhancements (Post-MVP)
- Visual regression testing (screenshot comparison)
- User session recording in mockups
- AI-generated mock data from epic context
- Accessibility validation (WCAG compliance)
- Performance testing in mockups

---

**Prepared By:** Meta-Supervisor (Claude Sonnet 4.5)
**Review Status:** Ready for Epic Breakdown
**Next Steps:** Create 9 epics in `.bmad/epics/` directory
