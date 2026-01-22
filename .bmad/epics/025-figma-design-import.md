# Epic: Figma Design Import

**Epic ID:** 025
**Created:** 2026-01-22
**Status:** Planned
**Complexity Level:** 2
**Feature:** UI-First Development Workflow

## Business Context

For PSs who prefer manual design control, enable importing designs from Figma URLs using Figma MCP tools. Supports professional design handoffs and complex visual requirements.

## Requirements

**MUST HAVE:**
- [ ] Integrate Figma MCP tools (get_design_context, get_metadata, get_variable_defs)
- [ ] MCP tool: ui_generate_design({ figma_url, epic_id, design_method: "figma" })
- [ ] Extract component hierarchy from Figma
- [ ] Extract design tokens (colors, fonts) from Figma variables
- [ ] Store figma_url in ui_mockups.design_url

**SHOULD HAVE:**
- [ ] Sync design tokens to design_systems table
- [ ] Component mapping (Figma component → React component name)
- [ ] Screenshot fallback if design_context fails

## Architecture

**Integration:** Figma MCP → Component extraction → Design tokens → Database storage
**Database:** ui_mockups.design_method = 'figma', design_url = Figma URL

## Implementation Tasks

- [ ] Wrap Figma MCP tools in DesignGenerator.generateWithFigma()
- [ ] Parse Figma design context for component hierarchy
- [ ] Extract design tokens with get_variable_defs
- [ ] Map to React component structure
- [ ] Store in ui_mockups with figma_url
- [ ] MCP tool: ui_generate_design (Figma path)

**Estimated Effort:** 8 hours (1 day)

## Acceptance Criteria

- [ ] ui_generate_design with Figma URL imports design successfully
- [ ] Component hierarchy extracted and stored
- [ ] Design tokens synced to design_systems table
- [ ] Stored in ui_mockups with design_method='figma'

## Dependencies

**Blocked By:** Epic 022 (Design System), Epic 023 (Requirements Analysis)
**Blocks:** Epic 027 (Interactive Mockup Deployment)
