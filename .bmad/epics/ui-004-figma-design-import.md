# Epic: Figma Design Import Integration

**Epic ID:** UI-004
**Created:** 2026-01-22
**Status:** Planned
**Complexity Level:** 2
**Feature:** UI-First Development Workflow
**PRD:** `/home/samuel/sv/supervisor-service-s/.bmad/prd/ui-first-workflow.md`

## Project Context

- **Project:** supervisor-service-s (Meta Infrastructure)
- **Tech Stack:** TypeScript, Figma MCP, PostgreSQL
- **Related Epics:** UI-001 (requirements), UI-003 (Frame0), UI-007 (deployment)
- **Purpose:** Import UI designs from Figma URLs as alternative to Frame0 generation

## Business Context

### Problem Statement
Frame0 is great for quick AI-generated designs, but complex UIs need professional design tools. PSs should be able to import existing Figma designs and map them to acceptance criteria.

### User Value
- Use professional Figma designs instead of AI-generated
- Import existing design work (no recreation needed)
- Map Figma components to acceptance criteria
- Extract design tokens (colors, fonts, spacing) from Figma

### Success Metrics
- Import Figma design in <10 seconds
- Design tokens extracted automatically
- Components mapped to UI requirements

## Requirements

### Functional Requirements (MoSCoW)

**MUST HAVE:**
- [ ] MCP tool: `ui_generate_design({ epicId, method: "figma", figmaUrl })`
- [ ] Import design from Figma URL using Figma MCP
- [ ] Extract component hierarchy
- [ ] Extract design tokens (colors, fonts, spacing) using get_variable_defs
- [ ] Store Figma URL and design context in `ui_mockups` table
- [ ] Map Figma frames to acceptance criteria
- [ ] Take screenshot of design for preview

**SHOULD HAVE:**
- [ ] Detect component variants (hover states, active states)
- [ ] Extract Figma Code Connect mappings
- [ ] Validate design completeness against requirements

**COULD HAVE:**
- [ ] Auto-sync when Figma design updates
- [ ] Suggest missing components based on requirements

**WON'T HAVE:**
- Figma editing (use Figma app for changes)
- Real-time collaboration in Figma

### Non-Functional Requirements

**Performance:**
- Import Figma design in <10 seconds
- Screenshot generation in <5 seconds

## Architecture

### Technical Approach
**Pattern:** Figma URL → Figma MCP → Design Context → Storage

**Flow:**
1. PS provides Figma URL and node ID
2. Call Figma MCP: `get_design_context({ fileKey, nodeId })`
3. Extract component hierarchy, design tokens
4. Take screenshot: `get_screenshot({ fileKey, nodeId })`
5. Store Figma reference in `ui_mockups` table
6. Map Figma frames to acceptance criteria

### Database Schema
```sql
-- Extends ui_mockups table
ALTER TABLE ui_mockups
  ADD COLUMN figma_url TEXT,
  ADD COLUMN figma_file_key TEXT,
  ADD COLUMN figma_node_id TEXT,
  ADD COLUMN figma_design_context JSONB,
  ADD COLUMN figma_design_tokens JSONB;
```

### Integration Points
- **Figma MCP:** Use existing Figma tools (get_design_context, get_screenshot, get_variable_defs)
- **UI Requirements:** Match Figma components to requirements from Epic UI-001
- **Design Storage:** Store in `ui_mockups` table

### Files to Create/Modify
```
/home/samuel/sv/supervisor-service-s/
├── src/ui/
│   ├── FigmaDesignImporter.ts     # Import from Figma
│   └── FigmaComponentMapper.ts    # Map Figma components to requirements
├── migrations/
│   └── ui-004-add-figma-fields.sql
└── tests/
    └── ui/
        └── FigmaDesignImporter.test.ts
```

## Implementation Tasks

### Task Breakdown

**Task 1: Database Extension**
- [ ] Create migration: `ui-004-add-figma-fields.sql`
- [ ] Add Figma-specific fields to `ui_mockups` table
- **Validation:** `npm run migrate:up`

**Task 2: Figma Design Importer**
- [ ] Create `src/ui/FigmaDesignImporter.ts`
- [ ] Implement `importDesign(epicId, figmaUrl)`
- [ ] Parse Figma URL to extract fileKey and nodeId
- [ ] Call `get_design_context({ fileKey, nodeId })`
- [ ] Call `get_variable_defs({ fileKey, nodeId })` for design tokens
- [ ] Call `get_screenshot({ fileKey, nodeId })` for preview
- [ ] Store in `ui_mockups` table
- **Validation:** Import test Figma design, verify data stored

**Task 3: Component Mapper**
- [ ] Create `src/ui/FigmaComponentMapper.ts`
- [ ] Implement `mapComponents(figmaContext, uiRequirements)`
- [ ] Match Figma component names to required UI elements
- [ ] Store mapping in database
- **Validation:** Map test design to requirements, verify accuracy

**Task 4: MCP Tool Extension**
- [ ] Extend `ui_generate_design` in `src/mcp/tools/ui-tools.ts`
- [ ] Support `method: "figma"` with `figmaUrl` parameter
- [ ] Input validation (valid Figma URL)
- [ ] Call FigmaDesignImporter
- [ ] Return preview screenshot and design context
- **Validation:** Call tool with Figma URL, verify import succeeds

**Task 5: Testing**
- [ ] Unit tests for Figma URL parsing
- [ ] Integration test: Figma URL → imported design
- [ ] Test with various Figma designs
- **Validation:** `npm test` passes

### Estimated Effort
- Database extension: 0.5 hours
- Figma design importer: 4 hours
- Component mapper: 3 hours
- MCP tool extension: 2 hours
- Testing: 2.5 hours
- **Total: 12 hours (1.5 days)**

## Acceptance Criteria

**Feature-Level Acceptance:**
- [ ] `ui_generate_design({ epicId, method: "figma", figmaUrl })` imports design
- [ ] Design context and tokens extracted from Figma
- [ ] Screenshot preview generated
- [ ] Design stored in `ui_mockups` table with Figma reference
- [ ] Components mapped to acceptance criteria

**Code Quality:**
- [ ] All TypeScript compiles without errors
- [ ] Error handling for invalid Figma URLs
- [ ] Error handling for Figma API failures
- [ ] Unit test coverage >80%

## Dependencies

**Blocked By:**
- Epic UI-001: Requirements Analysis Engine (need UI requirements for mapping)

**Blocks:**
- Epic UI-007: Dev Environment Deployment (uses imported designs)

**External Dependencies:**
- Figma MCP tools (already exist)
- Valid Figma URLs with access permissions

## Risks & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Figma URL requires authentication | Medium | High | Document authentication setup, store Figma token |
| Design doesn't match requirements | Medium | Medium | Component mapper validates coverage |
| Figma API rate limits | Low | Medium | Cache designs, rate limiting |

## Notes

### Design Decisions

**Why Figma as fallback?**
- Professional designs need professional tools
- Many teams already use Figma
- Better for complex interactions
- Frame0 for quick mockups, Figma for production-quality

**Why extract design tokens?**
- Auto-populate design system (Epic UI-002)
- Ensure consistency between Figma and code
- No manual token entry needed
