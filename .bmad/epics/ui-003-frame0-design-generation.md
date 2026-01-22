# Epic: Frame0 Design Generation Integration

**Epic ID:** UI-003
**Created:** 2026-01-22
**Status:** Planned
**Complexity Level:** 2
**Feature:** UI-First Development Workflow
**PRD:** `/home/samuel/sv/supervisor-service-s/.bmad/prd/ui-first-workflow.md`

## Project Context

- **Project:** supervisor-service-s (Meta Infrastructure)
- **Tech Stack:** TypeScript, Frame0 MCP, PostgreSQL
- **Related Epics:** UI-001 (requirements), UI-005 (mock data), UI-007 (deployment)
- **Purpose:** Generate UI designs from requirements using Frame0 AI design tool

## Business Context

### Problem Statement
PSs have UI requirements but need visual designs. Manual design is slow and requires design expertise. Frame0 can generate designs from text descriptions automatically.

### User Value
**For Project Supervisors:**
- Generate UI designs from requirements in <30 seconds
- No design skills required
- Iterate quickly on design feedback
- Map generated design to acceptance criteria

**For End Users:**
- Well-structured, functional UI layouts
- Professional appearance without manual design work

### Success Metrics
- Design generated from requirements in <30 seconds
- PS can iterate on design with simple text prompts
- All acceptance criteria represented in design

## Requirements

### Functional Requirements (MoSCoW)

**MUST HAVE:**
- [ ] MCP tool: `ui_generate_design({ epicId, method: "frame0", prompt })`
- [ ] Read UI requirements from `ui_requirements` table (Epic UI-001)
- [ ] Generate Frame0 design prompt from requirements
- [ ] Create Frame0 frames, components (rectangles, text, icons)
- [ ] Export design as image for preview
- [ ] Store design reference in `ui_mockups` table
- [ ] Show preview to PS for approval/iteration
- [ ] Map Frame0 components to acceptance criteria

**SHOULD HAVE:**
- [ ] Design iteration: PS provides feedback, regenerate design
- [ ] Multiple layout options (list view, grid view, card view)
- [ ] Responsive preview (mobile, tablet, desktop)

**COULD HAVE:**
- [ ] AI-suggested improvements based on UX best practices
- [ ] Design templates (dashboard, form, list, detail)

**WON'T HAVE (this iteration):**
- Advanced design features (animations, transitions) - use Figma
- Multi-page designs in single call - generate page by page

### Non-Functional Requirements

**Performance:**
- Generate design in <30 seconds
- Handle epics with up to 20 acceptance criteria

**Maintainability:**
- Clear separation between prompt generation and Frame0 calls
- Extensible design templates

## Architecture

### Technical Approach
**Pattern:** Requirements → Prompt Generator → Frame0 API → Design Storage

**Flow:**
1. Read UI requirements from database (Epic UI-001 output)
2. Generate Frame0 design prompt from requirements
3. Create Frame0 page, frames for each AC
4. Add components (search bar, list, buttons, etc.)
5. Export design as image
6. Store design reference in `ui_mockups` table
7. Return preview image and design URL

### Database Schema
```sql
-- Extends ui_mockups table (created in Epic UI-001)
ALTER TABLE ui_mockups
  ADD COLUMN frame0_page_id TEXT,
  ADD COLUMN frame0_design_export TEXT, -- base64 image
  ADD COLUMN component_mapping JSONB; -- Map Frame0 shapes to AC IDs
```

### Integration Points
- **UI Requirements:** Read from `ui_requirements` table (Epic UI-001)
- **Frame0 MCP:** Use existing Frame0 tools (create_frame, create_rectangle, create_text, etc.)
- **Design Storage:** Store in `ui_mockups` table
- **Downstream:** Used by Epic UI-007 (dev environment deployment) to generate code

### Files to Create/Modify
```
/home/samuel/sv/supervisor-service-s/
├── src/ui/
│   ├── Frame0DesignGenerator.ts    # Generate designs from requirements
│   └── Frame0PromptBuilder.ts      # Build prompts from UI specs
├── migrations/
│   └── ui-003-add-frame0-fields.sql
├── src/mcp/tools/
│   └── ui-tools.ts                 # Add ui_generate_design (frame0)
└── tests/
    └── ui/
        └── Frame0DesignGenerator.test.ts
```

## Implementation Tasks

### Task Breakdown

**Task 1: Database Extension**
- [ ] Create migration: `ui-003-add-frame0-fields.sql`
- [ ] Add Frame0-specific fields to `ui_mockups` table
- **Validation:** `npm run migrate:up`

**Task 2: Prompt Builder**
- [ ] Create `src/ui/Frame0PromptBuilder.ts`
- [ ] Implement `buildPrompt(uiRequirements)` - convert UI spec to design instructions
- [ ] Map AC to Frame0 components (SearchBar → rectangle + text input, List → multiple rectangles)
- **Validation:** Unit tests with sample UI requirements

**Task 3: Frame0 Design Generator**
- [ ] Create `src/ui/Frame0DesignGenerator.ts`
- [ ] Implement `generateDesign(epicId, prompt?)`
- [ ] Create Frame0 page (add_page)
- [ ] Create frame for main container (create_frame)
- [ ] For each AC: Create appropriate Frame0 components
- [ ] Export design as image (export_page_as_image)
- [ ] Store design reference in database
- **Validation:** Generate design for test epic, verify Frame0 output

**Task 4: MCP Tool**
- [ ] Add `ui_generate_design` to `src/mcp/tools/ui-tools.ts`
- [ ] Support `method: "frame0"`
- [ ] Input validation (epicId, optional prompt)
- [ ] Call Frame0DesignGenerator
- [ ] Return preview image and design URL
- **Validation:** Call tool with real epic, verify image returned

**Task 5: Testing**
- [ ] Unit tests for Frame0PromptBuilder
- [ ] Integration test: Requirements → Frame0 design
- [ ] Test with multiple AC patterns (search, list, form, detail)
- **Validation:** `npm test` passes

### Estimated Effort
- Database extension: 0.5 hours
- Prompt builder: 3 hours
- Frame0 design generator: 5 hours
- MCP tool: 2 hours
- Testing: 3 hours
- **Total: 13.5 hours (1.5 days)**

## Acceptance Criteria

**Feature-Level Acceptance:**
- [ ] `ui_generate_design({ epicId, method: "frame0" })` generates design
- [ ] Design includes all components from UI requirements
- [ ] Preview image shows complete UI layout
- [ ] Design stored in `ui_mockups` table with Frame0 reference
- [ ] PS can iterate on design with feedback

**Code Quality:**
- [ ] All TypeScript compiles without errors
- [ ] Error handling for Frame0 API failures
- [ ] Validation for UI requirements existence
- [ ] Unit test coverage >80%

## Dependencies

**Blocked By:**
- Epic UI-001: Requirements Analysis Engine (must have UI requirements)

**Blocks:**
- Epic UI-007: Dev Environment Deployment (uses generated designs)

**External Dependencies:**
- Frame0 MCP tools (already exist)

## Risks & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Frame0 designs don't match expectations | Medium | Medium | Support iteration, Figma fallback (Epic UI-004) |
| Complex UIs hard to generate | Medium | Low | Start with simple layouts, iterate |
| Frame0 API limits | Low | Medium | Rate limiting, error handling |

## Testing Strategy

### Manual Testing Checklist
- [ ] Create test epic with clear UI requirements
- [ ] Call `ui_generate_design({ epicId: "test", method: "frame0" })`
- [ ] Verify design includes search bar (if required)
- [ ] Verify design includes list/table (if required)
- [ ] Verify design includes action buttons (if required)
- [ ] Check preview image renders correctly
- [ ] Provide feedback, regenerate design
- [ ] Verify iteration works (design updates based on feedback)

## Notes

### Design Decisions

**Why Frame0 as default?**
- No manual design work needed
- Fast iteration (text prompts)
- Good enough for mockups (not production)
- Figma available for complex designs (Epic UI-004)

**Why store design as image?**
- Quick preview without reopening Frame0
- Can show in documentation
- Faster than re-rendering design

### Future Enhancements
- Design templates (dashboard, form, list, detail)
- AI-suggested layout improvements
- Multi-page designs in single call
- Responsive design generation (mobile, tablet, desktop)
