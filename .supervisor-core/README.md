# Core Supervisor Instructions

**Last Updated**: 2026-01-19

This directory contains **core instructions** shared by all project-supervisors (PSes).

---

## File Naming Convention

Files are numbered and loaded in alphabetical order:

```
01-identity.md          - Who the PS is, role, principles
02-workflow.md          - Standard operating procedures
03-structure.md         - Directory organization
04-tools.md             - Available commands and tools
05-autonomous-supervision.md - PIV loop, autonomous work
06-terminology.md       - Official terminology (SSB, PS, MS, etc.)
07-deployment-documentation.md - Keep deployment info current
08-port-ranges.md       - Port management
```

**To add new instruction**: Create `09-new-topic.md` (next number)

---

## CRITICAL: Keep Files Lean (Reference Pattern)

**Problem**: CLAUDE.md files can grow too large if we inline everything.

**Solution**: Use the **reference pattern** - keep core behavior inline, reference details.

### ✅ Good Pattern (Keep Inline)

```markdown
# Topic Name

## Critical Behavior

**YOU MUST do X whenever Y happens.**

## Checklist

**Must include:**
1. ✅ Item 1
2. ✅ Item 2
3. ✅ Item 3

## When to Update

- Trigger 1
- Trigger 2

## Templates & Guides

**Need detailed examples?**
- Template: `/home/samuel/sv/docs/templates/topic-template.md`
- Guide: `/home/samuel/sv/docs/guides/topic-guide.md`
```

**What stays inline:**
- ✅ Core behavior rules ("MUST do X")
- ✅ Checklists (what to include)
- ✅ Triggers (when to act)
- ✅ Quick reference tables
- ✅ Short definitions

**What goes to `/docs/`:**
- 📄 Complete templates (copy-paste ready)
- 📄 Detailed examples (with scenarios)
- 📄 Long explanations (how it works)
- 📄 Troubleshooting guides
- 📄 Historical context

### ❌ Bad Pattern (Avoid)

```markdown
# Topic Name

[300 lines of detailed examples]
[200 lines of complete template]
[100 lines of troubleshooting]
[50 lines of historical context]
```

**Problem**: CLAUDE.md becomes huge, hard to parse, slow to load.

---

## Size Guidelines

**Target for core instruction files:**
- ✅ Simple topics: 30-60 lines
- ✅ Medium topics: 60-130 lines
- ✅ Complex topics: 130-270 lines
- ⚠️ Over 270 lines: Consider splitting or referencing

**If a file grows too large:**
1. Extract templates to `/home/samuel/sv/docs/templates/`
2. Extract examples to `/home/samuel/sv/docs/guides/`
3. Keep core behavior inline
4. Add references to external docs

---

## Creating Referenced Documentation

### Step 1: Create Template (if needed)

**Location**: `/home/samuel/sv/docs/templates/`

**Example**: `topic-template.md`
```markdown
# Topic Template

[Complete copy-paste ready template with placeholders]

## Section 1
[Example content]

## Section 2
[Example content]
```

### Step 2: Create Guide (if needed)

**Location**: `/home/samuel/sv/docs/guides/`

**Example**: `topic-guide.md`
```markdown
# Topic Guide

**For Project Supervisors (PSes)**

## Overview
[What this is about]

## Section-by-Section Walkthrough
[Detailed explanations]

## Real Examples
[From actual projects]

## Common Mistakes
[What to avoid]

## Quick Tests
[Verify understanding]
```

### Step 3: Reference from Core Instruction

```markdown
# Topic Name

## Core Behavior
[Keep inline]

## Templates & Guides

**Need a template?**
- See: `/home/samuel/sv/docs/templates/topic-template.md`

**Detailed guide:**
- See: `/home/samuel/sv/docs/guides/topic-guide.md`
```

---

## Examples of Optimized Instructions

### Example 1: Deployment Documentation (78 lines)

**Inline**:
- Core rule: "Keep deployment info current"
- Checklist: What to include
- When to update

**Referenced**:
- Template: `deployment-status-template.md` (164 lines)
- Guide: `deployment-documentation-guide.md` (358 lines)

**Saved**: 196 lines per project

### Example 2: Terminology (95 lines)

**Inline**:
- Core rule: "Always expand abbreviations"
- Term definitions (short)
- Quick reference table

**Referenced**:
- Examples: `terminology-usage-examples.md` (255 lines)

**Saved**: 150 lines per project

---

## When to Create New Instructions

**Add new core instruction when:**
- ✅ Behavior applies to ALL project-supervisors (PSes)
- ✅ It's fundamental to how PSes work
- ✅ PSes need this in every session

**Don't add to core when:**
- ❌ Only relevant to one project (put in `.supervisor-specific/`)
- ❌ Only relevant to meta-supervisor (put in `.supervisor-meta/`)
- ❌ It's a one-time setup (put in docs/guides/)

---

## Testing Changes

**After editing any core instruction:**

1. **Test locally** (one project):
   ```bash
   cd /home/samuel/sv/supervisor-service-s
   npm run init-projects -- --project consilio-s --verbose
   ```

2. **Check output**:
   - Verify section count is correct
   - Check file size didn't explode
   - Verify referenced files exist

3. **Propagate to all projects**:
   ```bash
   npm run init-projects -- --verbose
   ```

4. **Verify**:
   ```bash
   wc -l /home/samuel/sv/*/CLAUDE.md
   ```

---

## Current Files Overview

| File | Lines | Purpose | Status |
|------|-------|---------|--------|
| 01-identity.md | 33 | PS role, principles | ✅ Lean |
| 02-workflow.md | 57 | SOPs, workflows | ✅ Lean |
| 03-structure.md | 46 | Directory organization | ✅ Lean |
| 04-tools.md | 49 | Available commands | ✅ Lean |
| 05-autonomous-supervision.md | 264 | PIV loop, autonomy | ✅ OK |
| 06-terminology.md | 95 | Official terms | ✅ Optimized |
| 07-deployment-documentation.md | 78 | Deployment docs | ✅ Optimized |
| 08-port-ranges.md | 129 | Port management | ✅ Lean |

**Total**: ~750 lines for all core instructions

---

## Regenerating CLAUDE.md Files

**Command**:
```bash
cd /home/samuel/sv/supervisor-service-s
npm run init-projects -- --verbose
```

**What happens**:
1. InstructionAssembler loads core instructions (this directory)
2. Loads meta instructions (`.supervisor-meta/` for MS only)
3. Loads project-specific instructions (`.supervisor-specific/`)
4. Assembles into final CLAUDE.md
5. Writes to each project directory

**Script location**: `src/scripts/init-project-supervisors.ts`

---

## Troubleshooting

**Problem**: CLAUDE.md files too large

**Solution**: Apply reference pattern
1. Identify long sections with examples/templates
2. Extract to `/home/samuel/sv/docs/templates/` or `/docs/guides/`
3. Keep core behavior inline with reference
4. Regenerate CLAUDE.md

**Problem**: PSes not following instructions

**Solution**: Check inline content
- Core behavior must be inline
- Use imperative language ("MUST", "CRITICAL")
- Add clear checklists
- References are for details, not core rules

**Problem**: Referenced files not being read

**Solution**: Verify paths
- Use absolute paths: `/home/samuel/sv/docs/...`
- Verify files exist
- Check file permissions (readable)
- Add context about WHY to read the file

---

## Best Practices

✅ **Do this**:
- Keep core behavior inline
- Use clear, imperative language
- Number files for ordering
- Reference templates/guides for details
- Test after every change

❌ **Don't do this**:
- Inline 200+ line templates
- Vague references ("see some doc")
- Forget to update when behavior changes
- Add project-specific content here

---

**Maintained by**: Meta-supervisor (MS)
**Review frequency**: When adding new core behavior
**Last optimized**: 2026-01-19 (reference pattern applied)
