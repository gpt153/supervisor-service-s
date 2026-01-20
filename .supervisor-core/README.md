# Core Supervisor Instructions

**Last Updated**: 2026-01-20

This directory contains **core instructions** shared by all project-supervisors (PSes).

---

## Files (Loaded Alphabetically)

```
01-identity.md          - PS role, principles
02-workflow.md          - SOPs, workflows
03-structure.md         - Directory organization
04-tools.md             - Available commands
05-autonomous-supervision.md - PIV loop, autonomy
06-terminology.md       - Official terms (SSB, PS, MS)
07-deployment-documentation.md - Keep deployment info current
08-port-ranges.md       - Port management
09-tunnel-management.md - CNAME creation, tunnel tools
```

---

## Reference Pattern (Keep CLAUDE.md Lean)

**Inline** (in core files):
- ✅ Core behavior rules ("MUST do X")
- ✅ Checklists
- ✅ When to act
- ✅ Quick reference tables

**External** (`/home/samuel/sv/docs/`):
- 📄 Templates: `/docs/templates/`
- 📄 Guides: `/docs/guides/`
- 📄 Examples: `/docs/examples/`

### Size Guidelines

- ✅ Simple: 30-60 lines
- ✅ Medium: 60-130 lines
- ✅ Complex: 130-270 lines
- ⚠️ Over 270 lines: Split or reference

**If file too large:**
1. Extract templates to `/docs/templates/`
2. Extract examples to `/docs/guides/` or `/docs/examples/`
3. Keep core behavior inline
4. Add references

---

## Adding New Instructions

**Add to core when:**
- ✅ Applies to ALL PSes
- ✅ Fundamental to how PSes work
- ✅ Needed in every session

**Don't add to core when:**
- ❌ Only one project (use `.supervisor-specific/`)
- ❌ Only meta (use `.supervisor-meta/`)
- ❌ One-time setup (use `/docs/guides/`)

**To add**: Create `10-new-topic.md` (next number)

---

## Regenerating CLAUDE.md

**Test one project:**
```bash
cd /home/samuel/sv/supervisor-service-s
npm run init-projects -- --project consilio-s --verbose
```

**Regenerate all:**
```bash
npm run init-projects -- --verbose
```

**Verify:**
```bash
wc -c /home/samuel/sv/*/CLAUDE.md  # Should be < 40k chars
```

---

## Current Status

| File | Lines | Status |
|------|-------|--------|
| 01-identity.md | 52 | ✅ Lean |
| 02-workflow.md | 128 | ✅ Lean |
| 03-structure.md | 46 | ✅ Lean |
| 04-tools.md | 49 | ✅ Lean |
| 05-autonomous-supervision.md | 146 | ✅ Optimized |
| 06-terminology.md | 94 | ✅ Optimized |
| 07-deployment-documentation.md | 78 | ✅ Optimized |
| 08-port-ranges.md | 129 | ✅ Lean |
| 09-tunnel-management.md | 164 | ✅ Optimized |

**Total**: ~886 lines (core shared across all PSes)

**Complete maintenance guide**: `/home/samuel/sv/docs/guides/instruction-system-maintenance.md`

---

**Maintained by**: Meta-supervisor (MS)
**Last optimized**: 2026-01-20 (README slimmed)
