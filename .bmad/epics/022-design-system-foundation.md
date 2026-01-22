# Epic: Design System Foundation

**Epic ID:** 022
**Created:** 2026-01-22
**Status:** Planned
**Complexity Level:** 2
**Feature:** UI-First Development Workflow

## Project Context

- **Project:** supervisor-service-s (Meta Infrastructure)
- **Tech Stack:** TypeScript, React, Storybook, Frame0 MCP, PostgreSQL
- **Related Epics:** 023-028 (Requirements analysis, design generation, deployment)
- **Purpose:** Enable PSs to create and maintain design systems for consistent UI components

## Business Context

### Problem Statement
Projects lack standardized UI components, leading to:
- Inconsistent user interfaces across features
- Duplicated effort building similar components
- No single source of truth for design tokens (colors, fonts, spacing)
- Difficult to maintain visual consistency

### User Value
**For Project Supervisors:**
- Create reusable component libraries once, use everywhere
- Ensure visual consistency across all features
- Faster feature development (use existing components)
- Easy customization per project (themes, branding)

**For End Users:**
- Consistent, polished user experience
- Familiar interface patterns
- Professional appearance

### Success Metrics
- All projects have a design system defined in database
- Component library accessible via Storybook (ui.153.se/[project]/storybook)
- 80%+ of new features use existing components
- Design system documented with usage examples

## Requirements

### Functional Requirements (MoSCoW)

**MUST HAVE:**
- [ ] Create design_systems database table
- [ ] MCP tool: ui_create_design_system (project, name, style config)
- [ ] Generate Storybook configuration per project
- [ ] Store design tokens (colors, fonts, spacing) as JSONB
- [ ] Deploy Storybook to allocated port in project range
- [ ] Register Storybook with nginx reverse proxy

**SHOULD HAVE:**
- [ ] Import design tokens from Figma variables
- [ ] Export design tokens to CSS/SCSS/Tailwind
- [ ] Component usage analytics
- [ ] Design system versioning

**COULD HAVE:**
- [ ] Visual regression testing for components
- [ ] Component playground for testing
- [ ] Design system templates (Material, Ant Design, Custom)

**WON'T HAVE (this iteration):**
- Multi-theme support (light/dark mode) - v2
- Component marketplace - out of scope
- Cross-framework components (Vue, Angular) - React only

### Non-Functional Requirements

**Performance:**
- Storybook builds in < 30 seconds
- Hot reload < 1 second for component changes

**Maintainability:**
- Design tokens as single source of truth
- Component documentation auto-generated
- Version-controlled with git

## Architecture

### Technical Approach
**Pattern:** Component library with Storybook as documentation and testing environment
**Storage:** PostgreSQL for metadata, filesystem for component code
**Deployment:** Storybook on project-specific port, nginx reverse proxy for shared ui.153.se

### Database Schema
```sql
CREATE TABLE design_systems (
  id SERIAL PRIMARY KEY,
  project_name TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  style_config JSONB, -- { colors: {...}, fonts: {...}, spacing: {...} }
  component_library JSONB, -- { Button: {...}, Input: {...} }
  storybook_port INTEGER,
  storybook_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_name, name)
);
```

### Integration Points
- **Port Manager:** Allocate port for Storybook
- **Tunnel Manager:** Register nginx location for ui.153.se/[project]/storybook
- **Figma MCP:** Import design tokens from Figma variables
- **Frame0 MCP:** Generate component designs

### Files to Create/Modify
```
/home/samuel/sv/supervisor-service-s/
├── src/ui/
│   ├── DesignSystemManager.ts      # Core orchestrator
│   ├── StoryBookDeployer.ts        # Storybook setup/deployment
│   └── DesignTokensExtractor.ts    # Extract tokens from Figma
├── migrations/
│   └── 022-create-design-systems.sql
├── src/mcp/tools/
│   └── ui-tools.ts                 # MCP tool: ui_create_design_system
└── templates/
    └── storybook/                  # Storybook config templates
        ├── main.ts
        ├── preview.ts
        └── package.json
```

## Implementation Tasks

### Task Breakdown

**Task 1: Database Setup**
- [ ] Create migration: 022-create-design-systems.sql
- [ ] Add design_systems table with JSONB columns
- [ ] Test migration up/down

**Task 2: Design System Manager**
- [ ] Create src/ui/DesignSystemManager.ts
- [ ] Implement createDesignSystem(project, name, styleConfig)
- [ ] Implement getDesignSystem(project)
- [ ] Implement updateDesignSystem(id, changes)

**Task 3: Storybook Deployment**
- [ ] Create templates/storybook/ with config files
- [ ] Implement StoryBookDeployer.deployStorybook(project, port)
- [ ] Generate package.json with React + Storybook dependencies
- [ ] Auto-start Storybook via npm run storybook

**Task 4: MCP Tool**
- [ ] Add ui_create_design_system to src/mcp/tools/ui-tools.ts
- [ ] Validate style config structure
- [ ] Allocate port via PortManager
- [ ] Deploy Storybook to allocated port
- [ ] Register with nginx reverse proxy

**Task 5: nginx Integration**
- [ ] Auto-generate nginx location block for /[project]/storybook
- [ ] Reload nginx after configuration change
- [ ] Test ui.153.se/[project]/storybook accessibility

### Estimated Effort
- Database setup: 1 hour
- Design System Manager: 3 hours
- Storybook deployment: 4 hours
- MCP tool: 2 hours
- nginx integration: 2 hours
- **Total: 12 hours (1.5 days)**

## Acceptance Criteria

**Feature-Level Acceptance:**
- [ ] design_systems table exists and stores style config as JSONB
- [ ] ui_create_design_system MCP tool successfully creates design system
- [ ] Storybook deploys to allocated port and is accessible
- [ ] ui.153.se/[project]/storybook shows component library
- [ ] Design tokens (colors, fonts, spacing) visible in Storybook

**Code Quality:**
- [ ] All TypeScript compiles without errors
- [ ] Database migration runs successfully
- [ ] Error handling for port allocation failures
- [ ] Validation for style config structure

**Documentation:**
- [ ] DesignSystemManager has JSDoc comments
- [ ] MCP tool documented in mcp-tools-reference.md
- [ ] Example style config in feature request or guide

## Dependencies

**Blocked By:**
- None (foundational epic for UI workflow)

**Blocks:**
- Epic 024: Frame0 Design Generation (needs design system)
- Epic 025: Figma Design Import (needs design system)
- Epic 027: Interactive Mockup Deployment (uses design system components)

**External Dependencies:**
- Storybook npm package (@storybook/react)
- Port allocation from PortManager
- nginx reverse proxy (tunnel manager)

## Risks & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Storybook conflicts with existing services | Low | Medium | Use dedicated port range per project |
| JSONB schema for style config too rigid | Medium | Medium | Keep flexible, allow any valid JSON |
| nginx reload disrupts other services | Low | High | Test nginx config before reload, graceful reload |
| Port exhaustion in project range | Low | Medium | Reserve 10 ports per project for UI tooling |

## Testing Strategy

### Manual Testing Checklist
- [ ] Create design system for test project: ui_create_design_system({ project: "test", name: "default", styleConfig: {...} })
- [ ] Verify Storybook starts on allocated port
- [ ] Access ui.153.se/test/storybook and see component library
- [ ] Modify style config, verify changes reflected in Storybook
- [ ] Delete design system, verify cleanup

## Notes

### Design Decisions

**Why Storybook?**
- Industry standard for component documentation
- Built-in testing (visual regression, accessibility)
- Supports React, widely adopted

**Why JSONB for style config?**
- Flexible schema (different projects have different needs)
- Query design tokens with SQL (SELECT style_config->>'colors' FROM design_systems)
- Easy to extend without migrations

**Why shared CNAME (ui.153.se)?**
- Single DNS entry for all UI tooling
- Clean URL structure: /project/tool
- No CNAME churn as projects added

### Future Enhancements
- Design token export to CSS variables, SCSS, Tailwind config
- Component usage analytics (which components used most)
- Visual regression testing integration
- Multi-theme support (light/dark mode)
