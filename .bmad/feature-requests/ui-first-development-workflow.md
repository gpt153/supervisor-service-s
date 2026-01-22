# Feature Request: UI-First Development Workflow

**Created:** 2026-01-22
**Status:** Draft
**Complexity:** Level 3 (Large Feature)
**Priority:** High
**Planning Track:** Enterprise

---

## One-Sentence Summary

A requirements-driven UI-first development workflow that enables PSs to design, build, and test interactive UI mockups with mock data before backend implementation, using Frame0/Figma MCP for design generation, Storybook for component libraries, and dev environment deployments for full-app testing - ensuring UI serves product requirements and UX is validated before backend investment.

---

## Problem Statement

Currently, UI development in the SV system is tightly coupled with backend implementation:

1. **No UI-first workflow** - Cannot design and test UX before building backend
2. **No requirements traceability** - UI designed without explicit mapping to epic acceptance criteria
3. **No interactive mockups** - Cannot test user flows without real backend
4. **No design system** - No reusable component library across features
5. **No separation of concerns** - Global styles mixed with feature-specific UI
6. **Late UX validation** - UX problems discovered after backend is built (expensive to change)
7. **No preview environments** - Cannot show interactive prototypes to stakeholders

This leads to:
- Backend built for wrong UX (rework required)
- Inconsistent UI across features
- Slow iteration on design changes
- Poor user experience validation

---

## User Impact

**Primary Users:** Project Supervisors (PSs) building web and mobile applications

**Current Pain Points:**
- Cannot validate UX before writing backend code
- No way to test user flows interactively
- UI doesn't map explicitly to epic requirements
- Inconsistent styling across features
- Expensive to change UI after backend is built
- Cannot show working prototypes to stakeholders

**Expected Value:**
- **UI-First Development**: Design and validate UX before backend investment
- **Requirements-Driven**: Every UI element maps to acceptance criteria
- **Interactive Testing**: Test all user flows with mock data, no backend needed
- **Design Consistency**: Shared component library across all features
- **Fast Iteration**: Change UI quickly without touching backend
- **Stakeholder Previews**: Share working prototypes for feedback
- **Reduced Rework**: Catch UX issues before backend implementation

---

## Business Context

**What Happens If We Don't Build This:**
- Continue building backend for wrong UX (wasted development time)
- Poor user experience due to late validation
- Inconsistent UI hurts product quality
- Cannot rapidly prototype new ideas
- Slow feedback cycles with stakeholders

**Timeline:** High priority - improves development efficiency across all projects

**Dependencies:**
- Existing Frame0 MCP tools (already available)
- Existing Figma MCP tools (already available)
- Port allocation system (already available)
- Cloudflare tunnel for dev environment access (already available)

---

## Requirements (MoSCoW)

### MUST HAVE (MVP)

**Two-Track UI Workflow:**

**Track 1: Design System (Global)**
- Create design system from description: "modern, professional, blue primary"
- Generate component library: buttons, inputs, cards, navigation, modals
- Define global styles: colors, fonts, spacing, shadows
- Deploy to Storybook for interactive preview
- URL pattern: `https://[project].153.se/storybook`
- Reusable across all features in project

**Track 2: Feature UI (Epic-Driven)**
- Read epic from `.bmad/epics/epic-XXX.md`
- Extract acceptance criteria and user stories
- Generate UI that satisfies all requirements
- Create mock data for testing
- Deploy interactive mockup to dev environment
- URL pattern: `https://[project]-dev.153.se`
- Map UI elements to requirements (traceability)

**Requirements Analysis Phase:**
- MCP tool: `ui_analyze_epic({ epicId })` - Extract UI requirements from epic
- Parse acceptance criteria
- Identify required UI elements (forms, lists, actions)
- Check for design constraints (accessibility, branding)
- Detect user flows and navigation needs
- Return structured UI requirements spec

**Design Generation Phase:**
- MCP tool: `ui_generate_design({ epicId, method })` - method: "frame0" or "figma"
- Frame0 path: AI generates design from requirements
- Figma path: User provides Figma URL, import design
- Show preview image to user
- Iterate on feedback
- Map design elements to acceptance criteria

**Interactive Mockup Phase:**
- Generate React/React Native components
- Create mock data (hardcoded or Faker.js)
- Implement all user flows with fake backend
- Deploy to dev environment
- User tests interactively
- All interactions work (search, filter, navigation, actions)
- No real backend needed

**Validation Phase:**
- User tests all user flows
- Verify acceptance criteria satisfied
- Check UX/usability
- Iterate on design/interactions
- Approve when ready

**Backend Implementation Phase:**
- After UI approved, spawn PIV loop
- Build real backend (database, API, business logic)
- Run backend tests

**Connection Phase:**
- Replace mock data with real API calls
- Deploy to production
- Now it's real!

**MCP Tool Suite (Core):**
1. `ui_create_design_system` - Create component library for project
2. `ui_analyze_epic` - Extract UI requirements from epic
3. `ui_generate_design` - Generate UI from requirements (Frame0 or Figma)
4. `ui_deploy_mockup` - Deploy interactive mockup with mock data
5. `ui_get_preview_urls` - Get Storybook + dev environment URLs
6. `ui_validate_requirements` - Check if UI satisfies acceptance criteria
7. `ui_connect_backend` - Replace mock data with real API calls

**State Management:**
- Database tables:
  - `design_systems` - Track component libraries per project
  - `ui_mockups` - Track feature mockups (epic, URL, status)
  - `ui_requirements` - Map UI elements to acceptance criteria
  - `ui_deployments` - Track Storybook and dev environment deployments

**Mock Data Support:**
- Hardcoded arrays for simple data
- Faker.js for realistic fake data (names, emails, dates)
- Mock Service Worker (MSW) for API interception (advanced)
- Mock data templates per domain (users, products, orders)

**Deployment Infrastructure:**
- Storybook deployment: Static site at `https://[project].153.se/storybook`
- Dev environment: Vite/Next.js dev server at `https://[project]-dev.153.se`
- Port allocation: Use existing project port ranges
- Cloudflare tunnel: CNAME creation via existing tunnel manager
- Auto-restart on code changes (hot reload)

**Frame0 Integration:**
- Use existing Frame0 MCP tools
- Generate design from text description
- Create frames, rectangles, text, icons
- Export as image for preview
- Extract design spec for code generation

**Figma Integration:**
- Use existing Figma MCP tools
- Import design from Figma URL
- Extract component hierarchy
- Get colors, fonts, spacing
- Generate code from design context

### SHOULD HAVE (v1.1)

**Enhanced MCP Tools:**
8. `ui_generate_mock_data` - Generate realistic fake data for domain
9. `ui_screenshot_mockup` - Take screenshots of mockup for documentation
10. `ui_export_design_tokens` - Export colors/fonts as CSS variables
11. `ui_check_accessibility` - Validate WCAG compliance

**Advanced Mockup Features:**
- URL routing in mockup (multi-page navigation)
- Form validation (client-side only)
- Loading states and animations
- Error states and edge cases
- Responsive design preview (mobile/tablet/desktop)

**Design System Management:**
- Version design system (track changes)
- Update all features when design system changes
- Design token management (colors, spacing, typography)
- Component documentation in Storybook

**Collaboration:**
- Share preview URLs with stakeholders
- Collect feedback via comments (optional)
- Track design iterations

### COULD HAVE (v2.0)

**Advanced Features:**
- Visual regression testing (screenshot comparison)
- A/B testing in mockups
- User session recording in mockups
- Analytics in mockups (track which flows users test)
- Design handoff documentation generation

**AI Enhancements:**
- AI suggests improvements based on UX best practices
- AI generates mock data from epic context
- AI validates accessibility automatically

**Mobile-Specific:**
- Native component library for React Native
- Gesture support in mockups
- Device-specific previews (iPhone, Android sizes)

### WON'T HAVE (Out of Scope)

**Explicitly Not Building:**
- Backend implementation (that's PIV loop's job)
- Real database or API (mockups use fake data only)
- Production deployment (mockups are dev-only)
- Advanced design tools (use Figma for that)
- Collaboration platform (not competing with Figma/Sketch)
- Version control for designs (use git for code)
- User testing infrastructure (separate concern)

---

## Technical Context

### Current Infrastructure

**Available MCP Tools:**
- Frame0: 20+ tools for creating UI designs
- Figma: 8+ tools for importing Figma designs
- Tunnel Manager: CNAME creation for dev environments
- Port Manager: Port allocation for dev servers
- Secrets Manager: Store any needed credentials

**Port Allocation (Dev Servers):**
- Consilio: 5000-5099
- Health-Agent: 5100-5199
- OpenHorizon: 5200-5299
- Odin: 5300-5399

**Example:**
- Consilio Storybook: port 5050 → `https://consilio-storybook.153.se`
- Consilio Dev: port 5051 → `https://consilio-dev.153.se`

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   EPIC IN .bmad/                            │
│                                                             │
│  epic-003-user-management.md                               │
│  ├─ Acceptance Criteria:                                   │
│  │  - AC-1: Search users by email                          │
│  │  - AC-2: Display user roles with badges                 │
│  │  - AC-3: Admin can ban users                            │
│  ├─ User Stories:                                          │
│  │  - As admin, I want to search users...                  │
│  └─ Technical Notes: ...                                   │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│              PS: UI REQUIREMENTS ANALYSIS                   │
│                                                             │
│  ui_analyze_epic({ epicId: "epic-003" })                   │
│  → Extracts:                                               │
│    - Required UI elements: SearchBar, UserList, BanButton  │
│    - User flows: Search → View → Ban                       │
│    - Data needs: User[] with email, role, status           │
│    - Navigation: Dashboard → User Detail                   │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│              PS: DESIGN GENERATION                          │
│                                                             │
│  ui_generate_design({                                       │
│    epicId: "epic-003",                                     │
│    method: "frame0"                                        │
│  })                                                         │
│                                                             │
│  Frame0 creates:                                           │
│  ┌──────────────────────────────────┐                     │
│  │ User Management Dashboard        │                     │
│  │ ┌────────────────┐ [Search...]   │                     │
│  │ │ Email          │ Role   │ Act  │                     │
│  │ ├────────────────┼────────┼──────┤                     │
│  │ │ john@test.com  │ ADMIN  │ Ban  │                     │
│  │ │ jane@test.com  │ USER   │ Ban  │                     │
│  │ └────────────────┴────────┴──────┘                     │
│  └──────────────────────────────────┘                     │
│                                                             │
│  Shows preview → User approves/iterates                    │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│           PS: INTERACTIVE MOCKUP GENERATION                 │
│                                                             │
│  Generates:                                                │
│  ├─ UserManagementDashboard.tsx                            │
│  ├─ SearchBar.tsx                                          │
│  ├─ UserList.tsx                                           │
│  ├─ BanButton.tsx                                          │
│  └─ mockData.ts                                            │
│                                                             │
│  const mockUsers = [                                       │
│    { id: 1, email: "john@test.com", role: "admin" },      │
│    { id: 2, email: "jane@test.com", role: "user" }        │
│  ];                                                         │
│                                                             │
│  All interactions work (no backend needed):                │
│  - Search filters mockUsers array                          │
│  - Ban updates local state                                │
│  - Navigation uses React Router                            │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│              DEPLOYMENT TO DEV ENVIRONMENT                  │
│                                                             │
│  ui_deploy_mockup({ epicId: "epic-003" })                  │
│                                                             │
│  1. Allocate port: 5051 (from Consilio range)             │
│  2. Start Vite dev server on 5051                          │
│  3. Create CNAME: consilio-dev.153.se → localhost:5051    │
│  4. Enable hot reload                                      │
│  5. Return URL                                             │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                  USER TESTS MOCKUP                          │
│                                                             │
│  Visit: https://consilio-dev.153.se/users                  │
│                                                             │
│  User actions:                                             │
│  ✓ Type in search box → sees filtered results              │
│  ✓ Click ban button → sees confirmation dialog             │
│  ✓ Confirm → user status changes to "banned"               │
│  ✓ Navigate to user detail → sees mock profile             │
│                                                             │
│  Everything works! No backend needed.                      │
│                                                             │
│  User feedback:                                            │
│  "Search bar should be in header, not sidebar"             │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                   PS: ITERATE ON DESIGN                     │
│                                                             │
│  User: "Move search to header"                             │
│  PS: [Updates Frame0 design]                               │
│      [Regenerates components]                              │
│      [Auto-reloads dev environment]                        │
│  User: [Tests again] "Perfect!"                            │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│              UI APPROVED → BUILD BACKEND                    │
│                                                             │
│  User: "Approve this UI, build the backend"                │
│                                                             │
│  PS spawns PIV loop:                                       │
│  1. Create database schema (users table)                   │
│  2. Build API endpoints:                                   │
│     - GET /api/users?search=email                          │
│     - POST /api/users/:id/ban                              │
│  3. Implement business logic                               │
│  4. Write tests                                            │
│  5. Deploy backend                                         │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│              PS: CONNECT UI TO REAL BACKEND                 │
│                                                             │
│  ui_connect_backend({ epicId: "epic-003" })                │
│                                                             │
│  Replace mock data:                                        │
│  ❌ const mockUsers = [...]                                │
│  ✅ const { data } = await fetch('/api/users')             │
│                                                             │
│  Replace mock actions:                                     │
│  ❌ setUsers(users.map(u => ...))                          │
│  ✅ await fetch(`/api/users/${id}/ban`, { method: 'POST' })│
│                                                             │
│  Deploy to production:                                     │
│  https://consilio.153.se/users (now with REAL backend!)    │
└─────────────────────────────────────────────────────────────┘
```

### Requirements Traceability Example

```yaml
# Generated by PS after ui_analyze_epic

epic_id: epic-003-user-management
ui_requirements:
  acceptance_criteria:
    - id: AC-1
      text: "Search users by email"
      ui_elements:
        - component: "SearchBar"
          props: { placeholder: "Search by email", filterKey: "email" }
          location: "UserManagementDashboard header"
      user_flow:
        - step: "User types in search box"
        - step: "Results filter in real-time"

    - id: AC-2
      text: "Display user roles with badges"
      ui_elements:
        - component: "RoleBadge"
          variants: ["admin", "user", "guest"]
          location: "UserList row"

    - id: AC-3
      text: "Admin can ban users"
      ui_elements:
        - component: "BanButton"
          permissions: ["admin"]
          confirmation: true
          location: "UserList actions column"
      user_flow:
        - step: "Admin clicks ban button"
        - step: "Confirmation dialog appears"
        - step: "Admin confirms"
        - step: "User status updates to 'banned'"

  mock_data_spec:
    users:
      count: 20
      fields:
        - name: "id"
          type: "uuid"
        - name: "email"
          type: "email"
        - name: "role"
          type: "enum"
          values: ["admin", "user", "guest"]
        - name: "status"
          type: "enum"
          values: ["active", "banned", "pending"]
      generator: "faker"
```

---

## Success Criteria

**Functional:**
- ✓ PS can create design system in <5 minutes
- ✓ PS can generate epic UI from requirements in <10 minutes
- ✓ Interactive mockup deployed and accessible via URL
- ✓ All user flows testable with mock data (no backend)
- ✓ User can validate UX before backend implementation
- ✓ 100% of acceptance criteria mapped to UI elements
- ✓ Design changes take <2 minutes (Frame0 update → redeploy)

**Non-Functional:**
- ✓ Storybook loads in <3 seconds
- ✓ Dev environment hot reload in <1 second
- ✓ Design generation (Frame0) completes in <30 seconds
- ✓ Mock data generation scales to 1000+ records
- ✓ All preview URLs accessible via HTTPS (Cloudflare tunnel)

**User Experience:**
- ✓ User never needs to understand UI implementation details
- ✓ Clear mapping between epic requirements and UI elements
- ✓ Interactive testing feels like real app
- ✓ Fast iteration on design changes
- ✓ Can show working prototypes to stakeholders

---

## Scope Boundaries

**Definitely IN Scope:**
- Two-track workflow (design system + feature UI)
- Requirements analysis from epics
- Frame0 and Figma integration
- Interactive mockup generation
- Mock data support (hardcoded, Faker.js, MSW)
- Storybook deployment
- Dev environment deployment
- Requirements traceability
- UI-first workflow (test before backend)
- MCP tool suite for UI operations

**Explicitly OUT of Scope:**
- Backend implementation (that's PIV loop's job)
- Real database or API (mockups are mock-only)
- Production deployment of mockups (dev-only)
- Advanced design tools (use Figma for complex work)
- Collaboration features (comments, real-time editing)
- User testing analytics (separate product)
- Visual regression testing (could have v2.0)
- Design version control (use git)

---

## Constraints

**Technical:**
- Must work with existing Frame0 and Figma MCP tools
- Must integrate with existing port allocation system
- Must use existing Cloudflare tunnel infrastructure
- Must support React (web) and React Native (mobile)
- Mock data must be realistic enough for UX testing

**Operational:**
- Dev environments are ephemeral (can be destroyed/recreated)
- Storybook is permanent per project
- Preview URLs must be HTTPS (Cloudflare requirement)

**Resource:**
- Port usage: 2 ports per project (Storybook + dev)
- Storage: ~100MB per design system, ~50MB per mockup
- Dev server CPU: <10% per mockup
- Cloudflare tunnel: 2 CNAMEs per project

---

## Dependencies

**Blockers (Must Exist Before Implementation):**
- ✓ Frame0 MCP tools (exist)
- ✓ Figma MCP tools (exist)
- ✓ Port allocation system (exists)
- ✓ Cloudflare tunnel manager (exists or in progress)
- ✓ .bmad/ structure with epics (exists)

**Parallel Dependencies (Can Build Alongside):**
- PIV loop enhancements for backend implementation
- Mobile app development platform (for React Native mockups)

**Blocks (Enables Future Work):**
- Faster product iteration
- Better UX validation
- Reduced development rework
- Stakeholder preview capability
- Design consistency across features

---

## Related Features & Context

**Related Feature Requests:**
- Mobile App Development Platform (mockups for mobile)
- Tunnel Manager (CNAME creation for dev URLs)

**Related Documentation:**
- `/home/samuel/supervisor/docs/ui-workflow-system.md` (OLD system)
- `/home/samuel/supervisor/docs/ui-workflow-improvements.md` (OLD system)

**Integration Points:**
- Frame0 MCP (design generation)
- Figma MCP (design import)
- Tunnel Manager (dev URL creation)
- Port Manager (port allocation)
- PIV Loop (backend implementation after UI approved)

---

## Complexity Rationale

**Why Level 3 (Large Feature):**

1. **Dual-Track Complexity**: Design system + feature UI are different workflows
2. **Requirements Analysis**: Parse epics, extract acceptance criteria, map to UI
3. **Multiple Integration Points**: Frame0, Figma, Tunnel Manager, Port Manager
4. **Mock Data System**: Multiple strategies (hardcoded, Faker, MSW)
5. **Deployment Infrastructure**: Storybook + dev environment
6. **State Management**: Track design systems, mockups, requirements mapping
7. **MCP Tool Suite**: 7+ tools with different purposes
8. **Traceability System**: Link UI elements to requirements
9. **Code Generation**: React and React Native components from designs
10. **Hot Reload**: Dev environment auto-update on changes

**Estimated Implementation Time:** 2-3 days

**Recommended Epic Breakdown:**
1. Epic 1: Requirements analysis and traceability system
2. Epic 2: Frame0 design generation integration
3. Epic 3: Figma design import integration
4. Epic 4: Mock data generation system
5. Epic 5: Storybook deployment (design system track)
6. Epic 6: Dev environment deployment (feature mockup track)
7. Epic 7: MCP tool suite implementation
8. Epic 8: UI → Backend connection workflow
9. Epic 9: Documentation and PS guides

---

## Implementation Phases

### Phase 1: Foundation (1 day)

**Database Schema:**
- `design_systems` table
- `ui_mockups` table
- `ui_requirements` table
- `ui_deployments` table

**MCP Tools (Core):**
- `ui_create_design_system`
- `ui_analyze_epic`

### Phase 2: Design Generation (1 day)

**Frame0 Integration:**
- Design from text description
- Component extraction
- Code generation

**Figma Integration:**
- Import from URL
- Extract design context
- Code generation

**MCP Tools:**
- `ui_generate_design`

### Phase 3: Mockup System (1 day)

**Mock Data:**
- Hardcoded templates
- Faker.js integration
- Domain-specific generators

**Interactive Mockup:**
- Component generation
- Mock data injection
- User flow implementation

**MCP Tools:**
- `ui_deploy_mockup`
- `ui_get_preview_urls`

### Phase 4: Deployment Infrastructure (1 day)

**Storybook:**
- Project template
- Component documentation
- Deployment automation

**Dev Environment:**
- Vite/Next.js setup
- Hot reload configuration
- Cloudflare tunnel integration

### Phase 5: Validation & Connection (1 day)

**Requirements Validation:**
- Check AC coverage
- Traceability reports

**Backend Connection:**
- Replace mock data with API calls
- Migration scripts

**MCP Tools:**
- `ui_validate_requirements`
- `ui_connect_backend`

---

## Cost Analysis

**Development Cost:**
- Implementation: 2-3 days (already accounted for)
- No external services required
- Uses existing infrastructure

**Operational Cost:**
- Port usage: 2 per project (within allocated ranges)
- Cloudflare tunnel: 2 CNAMEs per project (unlimited free)
- Storage: ~150MB per project (design system + mockups)
- CPU: ~10% per active dev environment

**ROI:**
- **Reduced rework**: Catch UX issues before backend (saves 50-80% rework time)
- **Faster iteration**: Design changes in minutes vs hours
- **Better UX**: Validate flows before implementation
- **Stakeholder buy-in**: Show working prototypes early

**Break-even:** First project that avoids backend rework

---

## Risk Areas

**Technical Risks:**
- Frame0 designs may not match expectations (mitigation: Figma fallback)
- Mock data may not be realistic enough (mitigation: Faker.js, domain templates)
- Dev environment stability (mitigation: auto-restart, monitoring)

**Operational Risks:**
- Port conflicts (mitigation: port allocation system)
- CNAME conflicts (mitigation: naming conventions)
- Stale mockups not cleaned up (mitigation: lifecycle management)

**UX Risks:**
- User confuses mockup with production (mitigation: clear labeling, dev URLs)
- Mock interactions don't match real backend (mitigation: requirements validation)

---

## Open Questions

**Resolved:**
- ✓ Frame0 vs Figma: Support both, Frame0 as default
- ✓ Mock data strategy: Hardcoded + Faker.js + MSW
- ✓ Deployment: Storybook + dev environment (dual URLs)

**Pending:**
- Should mockups auto-delete after epic completion? → **Could Have (lifecycle management)**
- Support for other frameworks (Vue, Svelte)? → **React only for MVP**
- Visual regression testing? → **Could Have (v2.0)**

---

## Next Steps

1. **Approval Phase:** Review with stakeholders
2. **Planning Phase:** Create comprehensive epic breakdown with database entries
3. **Architecture Phase:** Create ADRs for:
   - ADR: Frame0 vs Figma as default design method
   - ADR: Mock data strategy (hardcoded vs Faker vs MSW)
   - ADR: Deployment architecture (Storybook + dev env)
4. **Implementation Prep:** Break epics into implementation tasks
5. **Testing Strategy:** Define test scenarios for mockup validation
6. **Documentation:** Create UI workflow guides for PSs

---

## Notes

**Key Insights:**
- UI-first dramatically reduces rework
- Requirements traceability ensures nothing is missed
- Interactive mockups are better than static designs
- Design system ensures consistency
- Mock data quality is critical for realistic testing

**Success Factors:**
- Clear separation of design system vs feature UI
- Explicit mapping to acceptance criteria
- Fast iteration on design changes
- Realistic mock data
- Clear distinction between mockup and production

**Future Enhancements:**
- Visual regression testing
- User session recording in mockups
- AI-generated mock data from epic context
- Accessibility validation
- Performance testing in mockups

---

**Analyst:** Claude Sonnet 4.5 (Meta-Supervisor)
**Review:** Ready for Planning Phase - Epic Creation
