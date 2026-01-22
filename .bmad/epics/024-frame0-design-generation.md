# Epic: Frame0 Design Generation

**Epic ID:** 024
**Created:** 2026-01-22
**Status:** Planned
**Complexity Level:** 2
**Feature:** UI-First Development Workflow

## Business Context

Enable PSs to generate UI designs from text descriptions using Frame0 MCP, eliminating need for manual design tools. AI generates mockups in minutes, user iterates with natural language feedback.

## Requirements

**MUST HAVE:**
- [ ] Integrate Frame0 MCP tools (create_frame, create_rectangle, create_text, etc.)
- [ ] MCP tool: ui_generate_design({ description, epic_id, design_method: "frame0" })
- [ ] Generate design from requirements analysis output
- [ ] Export design as PNG/SVG for approval
- [ ] Store design_url in ui_mockups table

**SHOULD HAVE:**
- [ ] Iterative refinement ("make button larger", "change color to blue")
- [ ] Design versioning (track iterations)
- [ ] Design templates (login, dashboard, form)

## Architecture

**Integration:** Frame0 MCP → Design generation → PNG export → Database storage
**Database:** ui_mockups.design_method = 'frame0', design_url = exported image path

## Implementation Tasks

- [ ] Wrap Frame0 MCP tools in DesignGenerator.generateWithFrame0()
- [ ] Convert UI requirements to Frame0 commands
- [ ] Export design to file (PNG/SVG)
- [ ] Store in ui_mockups with epic_id reference
- [ ] MCP tool: ui_generate_design

**Estimated Effort:** 8 hours (1 day)

## Acceptance Criteria

- [ ] ui_generate_design with Frame0 creates visual mockup
- [ ] Design exported as PNG for user approval
- [ ] Stored in ui_mockups with design_method='frame0'
- [ ] User can iterate with natural language ("make X bigger")

## Dependencies

**Blocked By:** Epic 022 (Design System), Epic 023 (Requirements Analysis)
**Blocks:** Epic 027 (Interactive Mockup Deployment)
