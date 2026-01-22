# ADR 007: Frame0 vs Figma as Default Design Tool

**Status:** Proposed
**Date:** 2026-01-22
**Context:** UI-First Development Workflow
**Related Epics:** 024 (Frame0), 025 (Figma)

## Context

UI-First workflow requires design generation. Two options available:
1. **Frame0 MCP**: AI generates designs from text descriptions
2. **Figma MCP**: Import designs from Figma URLs (user designs manually)

Need to choose default tool while supporting both paths.

## Decision

**Default: Frame0 MCP**
**Alternative: Figma MCP (when user prefers manual control)**

## Rationale

**Frame0 Advantages:**
- ✅ Faster iteration (AI generates in seconds)
- ✅ No external tools needed (works in chat)
- ✅ Non-designers can create mockups
- ✅ Natural language refinement ("make button bigger")
- ✅ No learning curve

**Figma Advantages:**
- ✅ Professional polish
- ✅ Full design control
- ✅ Industry-standard tool
- ✅ Collaboration with designers
- ✅ Design system libraries

**Decision Criteria:**
- Frame0 for rapid prototyping (80% of cases)
- Figma for complex UIs requiring design expertise (20%)
- Both supported, user chooses per epic

## Consequences

**Positive:**
- Faster UI development for most features
- Lower barrier to entry (non-designers can design)
- Reduced dependency on external tools

**Negative:**
- Frame0 designs may lack polish
- Complex UIs may require Figma anyway
- Need to maintain two code paths

**Mitigation:**
- Clear documentation on when to use each
- Easy switching between tools
- Design system ensures consistency

## Implementation

```typescript
ui_generate_design({
  epic_id: "epic-003",
  design_method: "frame0", // or "figma"
  input: "Create login form with email/password" // or Figma URL
})
```

Default = frame0, but user can override.
