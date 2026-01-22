# Epic: Requirements Analysis Engine

**Epic ID:** UI-001
**Created:** 2026-01-22
**Status:** Planned
**Complexity Level:** 2
**Feature:** UI-First Development Workflow
**PRD:** `/home/samuel/sv/supervisor-service-s/.bmad/prd/ui-first-workflow.md`

## Project Context

- **Project:** supervisor-service-s (Meta Infrastructure)
- **Tech Stack:** TypeScript, PostgreSQL, MCP
- **Related Epics:** UI-002 through UI-009 (depends on this foundation)
- **Purpose:** Extract UI requirements from epic acceptance criteria to guide design generation

## Business Context

### Problem Statement
PSs cannot generate accurate UI designs without understanding what the epic actually requires. Currently:
- No automatic extraction of UI requirements from epics
- Manual interpretation of acceptance criteria leads to missed requirements
- No structured format for UI specifications
- Cannot verify UI completeness against requirements

### User Value
**For Project Supervisors:**
- Automatically parse epics to extract UI needs
- Structured UI requirements spec (components, flows, data)
- Confidence that nothing is missed from acceptance criteria
- Foundation for accurate design generation

**For End Users:**
- UIs that satisfy all acceptance criteria (nothing forgotten)
- Consistent mapping between requirements and implementation

### Success Metrics
- All acceptance criteria extracted correctly (100% coverage)
- UI requirements spec generated in <10 seconds
- Zero manual parsing needed by PS

## Requirements

### Functional Requirements (MoSCoW)

**MUST HAVE:**
- [ ] Parse epic markdown files from `.bmad/epics/`
- [ ] Extract acceptance criteria (AC-XXX format)
- [ ] Extract user stories ("As a... I want...")
- [ ] Identify required UI elements from AC (forms, buttons, lists, etc.)
- [ ] Detect user flows and navigation needs
- [ ] Identify data requirements (what entities need display/input)
- [ ] Output structured UI requirements spec as JSONB
- [ ] Store in `ui_requirements` database table
- [ ] MCP tool: `ui_analyze_epic({ epicId })`

**SHOULD HAVE:**
- [ ] Detect accessibility requirements from AC
- [ ] Extract design constraints (branding, colors, responsive)
- [ ] Suggest component types based on AC patterns
- [ ] Validate epic format before parsing

**COULD HAVE:**
- [ ] AI-enhanced requirement extraction (use Gemini to understand vague ACs)
- [ ] Detect missing requirements (e.g., error states not specified)
- [ ] Suggest additional UX improvements beyond AC

**WON'T HAVE (this iteration):**
- UI design generation (that's Epic UI-003/UI-004)
- Mock data generation (that's Epic UI-005)
- Deployment (that's Epic UI-006/UI-007)

### Non-Functional Requirements

**Performance:**
- Parse epic in <5 seconds
- Handle epics up to 500 lines

**Maintainability:**
- Extensible parser (easy to add new AC patterns)
- Clear error messages when epic format invalid

**Reliability:**
- Handle malformed epics gracefully
- Validate all extracted requirements

## Architecture

### Technical Approach
**Pattern:** Parser + Analyzer + Mapper
- Parser: Extract AC and user stories from markdown
- Analyzer: Identify UI elements, flows, data needs
- Mapper: Map requirements to UI specification

**Storage:** PostgreSQL JSONB for flexibility

### Database Schema
```sql
CREATE TABLE ui_requirements (
  id SERIAL PRIMARY KEY,
  epic_id TEXT NOT NULL UNIQUE,
  project_name TEXT NOT NULL,
  acceptance_criteria JSONB, -- [ { id, text, ui_elements, user_flow } ]
  user_stories JSONB, -- [ { role, goal, benefit } ]
  data_requirements JSONB, -- { entities, fields, operations }
  navigation_needs JSONB, -- { pages, transitions }
  design_constraints JSONB, -- { accessibility, responsive, branding }
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Example UI Requirements Spec
```json
{
  "epic_id": "epic-003-user-management",
  "acceptance_criteria": [
    {
      "id": "AC-1",
      "text": "Search users by email",
      "ui_elements": [
        {
          "component": "SearchBar",
          "props": { "placeholder": "Search by email", "filterKey": "email" },
          "location": "UserManagementDashboard header"
        }
      ],
      "user_flow": [
        { "step": 1, "action": "User types in search box" },
        { "step": 2, "action": "Results filter in real-time" }
      ]
    },
    {
      "id": "AC-2",
      "text": "Display user roles with badges",
      "ui_elements": [
        {
          "component": "RoleBadge",
          "variants": ["admin", "user", "guest"],
          "location": "UserList row"
        }
      ]
    },
    {
      "id": "AC-3",
      "text": "Admin can ban users",
      "ui_elements": [
        {
          "component": "BanButton",
          "permissions": ["admin"],
          "confirmation": true,
          "location": "UserList actions column"
        }
      ],
      "user_flow": [
        { "step": 1, "action": "Admin clicks ban button" },
        { "step": 2, "action": "Confirmation dialog appears" },
        { "step": 3, "action": "Admin confirms" },
        { "step": 4, "action": "User status updates to 'banned'" }
      ]
    }
  ],
  "data_requirements": {
    "entities": ["User"],
    "fields": ["id", "email", "role", "status"],
    "operations": ["list", "search", "update"]
  },
  "navigation_needs": {
    "pages": ["UserManagementDashboard", "UserDetailPage"],
    "transitions": [
      { "from": "UserManagementDashboard", "to": "UserDetailPage", "trigger": "click_user_row" }
    ]
  }
}
```

### Integration Points
- **Epic Files:** Read from `.bmad/epics/{epic-id}.md`
- **Database:** Store in `ui_requirements` table
- **MCP Tools:** Expose via `ui_analyze_epic`
- **Downstream:** Used by Epic UI-003/UI-004 (design generation)

### Files to Create/Modify
```
/home/samuel/sv/supervisor-service-s/
├── src/ui/
│   ├── EpicParser.ts              # Parse epic markdown
│   ├── RequirementsAnalyzer.ts    # Extract UI requirements
│   └── UISpecMapper.ts            # Map to UI spec format
├── migrations/
│   └── ui-001-create-requirements.sql
├── src/mcp/tools/
│   └── ui-tools.ts                # Add ui_analyze_epic
└── tests/
    └── ui/
        ├── EpicParser.test.ts
        └── RequirementsAnalyzer.test.ts
```

## Implementation Tasks

### Task Breakdown

**Task 1: Database Setup**
- [ ] Create migration: `ui-001-create-requirements.sql`
- [ ] Add `ui_requirements` table with JSONB columns
- [ ] Test migration up/down
- **Files:** `migrations/ui-001-create-requirements.sql`
- **Validation:** `npm run migrate:up && npm run migrate:down && npm run migrate:up`

**Task 2: Epic Parser**
- [ ] Create `src/ui/EpicParser.ts`
- [ ] Implement `parseEpic(epicId)` - read epic markdown
- [ ] Extract acceptance criteria (AC-XXX: text)
- [ ] Extract user stories (As a... I want... So that...)
- [ ] Extract technical notes section
- **Files:** `src/ui/EpicParser.ts`
- **Validation:** Unit tests with sample epic markdown

**Task 3: Requirements Analyzer**
- [ ] Create `src/ui/RequirementsAnalyzer.ts`
- [ ] Implement `analyzeAC(acText)` - identify UI elements from AC text
- [ ] Pattern matching for common UI needs:
  - "search" → SearchBar component
  - "display list" → List/Table component
  - "form" → Form component
  - "button" → Button component
  - "navigate" → Navigation flow
- [ ] Detect data needs (entities, fields, operations)
- **Files:** `src/ui/RequirementsAnalyzer.ts`
- **Validation:** Unit tests with various AC patterns

**Task 4: UI Spec Mapper**
- [ ] Create `src/ui/UISpecMapper.ts`
- [ ] Implement `mapToUISpec(parsedEpic, analysis)` - create structured spec
- [ ] Format acceptance criteria with UI elements
- [ ] Format user flows as step arrays
- [ ] Format data requirements
- [ ] Format navigation needs
- **Files:** `src/ui/UISpecMapper.ts`
- **Validation:** Output matches example JSON structure

**Task 5: MCP Tool**
- [ ] Add `ui_analyze_epic` to `src/mcp/tools/ui-tools.ts`
- [ ] Input validation (epicId format)
- [ ] Call EpicParser → RequirementsAnalyzer → UISpecMapper
- [ ] Store result in `ui_requirements` table
- [ ] Return UI spec to caller
- **Files:** `src/mcp/tools/ui-tools.ts`
- **Validation:** Call tool with real epic, verify database entry

**Task 6: Testing**
- [ ] Unit tests for EpicParser (various markdown formats)
- [ ] Unit tests for RequirementsAnalyzer (AC pattern matching)
- [ ] Integration test: Full epic → UI spec
- [ ] Test with real epics from `.bmad/epics/`
- **Files:** `tests/ui/*.test.ts`
- **Validation:** `npm test` passes

### Estimated Effort
- Database setup: 1 hour
- Epic Parser: 3 hours
- Requirements Analyzer: 4 hours
- UI Spec Mapper: 2 hours
- MCP tool: 2 hours
- Testing: 3 hours
- **Total: 15 hours (2 days)**

## Acceptance Criteria

**Feature-Level Acceptance:**
- [ ] `ui_requirements` table exists and stores JSONB specs
- [ ] `ui_analyze_epic({ epicId })` successfully parses epic
- [ ] All acceptance criteria extracted from epic (100% coverage)
- [ ] UI requirements spec stored in database
- [ ] Returned spec includes: AC with UI elements, user flows, data needs, navigation

**Code Quality:**
- [ ] All TypeScript compiles without errors
- [ ] Database migration runs successfully
- [ ] Error handling for invalid epic format
- [ ] Validation for epic file existence
- [ ] Unit test coverage >80%

**Documentation:**
- [ ] JSDoc comments on all public methods
- [ ] Example UI spec in this epic file ✓ (see above)
- [ ] MCP tool documented in `/home/samuel/sv/docs/mcp-tools-reference.md`

## Dependencies

**Blocked By:**
- None (foundational epic)

**Blocks:**
- Epic UI-003: Frame0 Design Generation (needs UI requirements)
- Epic UI-004: Figma Design Import (needs UI requirements)
- Epic UI-008: MCP Tool Suite (depends on this tool)

**External Dependencies:**
- Epic markdown files in `.bmad/epics/` (already exist)
- PostgreSQL database (already exists)

## Risks & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| AC format varies across epics | Medium | Medium | Flexible parser, handle multiple formats |
| Vague ACs don't map to clear UI | High | Medium | Manual review step, AI-enhanced analysis (v1.1) |
| Missing ACs in some epics | Medium | Low | Warn PS about incomplete requirements |
| Complex user flows hard to extract | Medium | Medium | Start with simple flows, improve iteratively |

## Testing Strategy

### Manual Testing Checklist
- [ ] Create test epic with clear AC format
- [ ] Call `ui_analyze_epic({ epicId: "test-epic" })`
- [ ] Verify all ACs extracted correctly
- [ ] Check UI elements identified for each AC
- [ ] Verify user flows captured as step arrays
- [ ] Check data requirements detected
- [ ] Verify database entry created
- [ ] Test with real epic (e.g., `epic-005-tunnel-manager.md`)

### Automated Tests
- [ ] `EpicParser.test.ts` - Various markdown formats
- [ ] `RequirementsAnalyzer.test.ts` - AC pattern matching
- [ ] `UISpecMapper.test.ts` - Output format validation
- [ ] Integration test: End-to-end epic analysis

## Notes

### Design Decisions

**Why JSONB for requirements?**
- Flexible schema (different epics have different structures)
- Easy to query (e.g., find all epics needing SearchBar component)
- No need for complex migrations

**Why pattern matching vs AI?**
- Pattern matching faster and more reliable for MVP
- AI-enhanced analysis can be added later (SHOULD HAVE)
- Covers 80% of common cases

**Why store in database vs file?**
- Database allows querying (find epics with similar requirements)
- Can track changes over time
- Integrates with other MCP tools

### Future Enhancements
- AI-enhanced requirement extraction (Gemini to understand vague ACs)
- Suggest missing requirements (error states, loading states)
- Detect accessibility needs automatically
- Generate test scenarios from user flows
