# BMAD Features Directory

**Last Updated:** 2026-01-27
**Migration Date:** 2026-01-27

---

## Overview

This directory contains the feature-based organization of the supervisor-service BMAD system. Each feature has its own directory with epics, ADRs, reports, and context.

**Migration Status:** ✅ Complete (migrated from legacy flat structure)

---

## Feature Directory Structure

Each feature directory follows this standard structure:

```
feature-name/
├── prd.md              # Product Requirements Document
├── epics/              # Epic specifications for this feature
│   ├── epic-001-name.md
│   ├── epic-002-name.md
│   └── ...
├── adr/                # Architecture Decision Records
│   ├── 001-decision.md
│   └── ...
├── reports/            # Implementation reports and verification
│   ├── EPIC-001-IMPLEMENTATION.md
│   └── ...
├── context/            # Feature requests, handoffs, background
│   ├── feature-request.md
│   ├── handoff-YYYY-MM-DD.md
│   └── ...
└── plans/              # Planning artifacts (if needed)
    └── ...
```

---

## Active Features

### Infrastructure & Meta

1. **[bmad-integration](./bmad-integration/)** - Foundation BMAD system integration
2. **[database-foundation](./database-foundation/)** - PostgreSQL foundation and migrations
3. **[secrets-management](./secrets-management/)** - Vault-based secrets infrastructure
4. **[port-allocation](./port-allocation/)** - Port range management system
5. **[tunnel-manager](./tunnel-manager/)** - Cloudflare tunnel and CNAME management

### Supervisor Capabilities

6. **[automated-supervisor-updates](./automated-supervisor-updates/)** - Auto-update CLAUDE.md and instructions
7. **[ps-delegation-enforcement](./ps-delegation-enforcement/)** - Subagent library and delegation rules
8. **[ps-health-monitoring](./ps-health-monitoring/)** - PS health checks and restart automation
9. **[automatic-quality-workflows](./automatic-quality-workflows/)** - Quality assurance automation
10. **[automatic-context-handoff](./automatic-context-handoff/)** - Context management and handoff system

### Development Workflows

11. **[learning-system](./learning-system/)** - Learning action database and enhancement
12. **[ui-first-workflow](./ui-first-workflow/)** - UI-first development with Frame0/Figma
13. **[mobile-platform](./mobile-platform/)** - React Native mobile development platform
14. **[subagent-debugging](./subagent-debugging/)** - Fix subagent hanging and debugging tools

---

## Feature Statistics

**Total Features:** 14
**Total Epics:** 43
**Total ADRs:** 19
**Total Implementation Reports:** 21

---

## Legacy Migration Notes

### Migrated From

- `.bmad/epics/` (48 epics) → `features/*/epics/`
- `.bmad/adr/` (19 ADRs) → `features/*/adr/`
- `.bmad/implementation/` (22 reports) → `features/*/reports/`
- `.bmad/feature-requests/` (10 requests) → `features/*/context/`

### Archived

- `.bmad/archive/test-epics/` - Test epics (test-001, test-002, test-003)
- `.bmad/prd/` - Legacy PRD directory (content migrated to feature PRDs)

### Deprecated (Empty)

- `.bmad/epics/` - ⚠️ DEPRECATED (use `features/*/epics/`)
- `.bmad/adr/` - ⚠️ DEPRECATED (use `features/*/adr/`)
- `.bmad/feature-requests/` - ⚠️ DEPRECATED (use `features/*/context/`)

---

## Working with Features

### Creating a New Feature

```bash
# 1. Create feature directory structure
mkdir -p .bmad/features/my-feature/{epics,adr,reports,context,plans}

# 2. Create PRD
cp /home/samuel/sv/templates/prd-template.md .bmad/features/my-feature/prd.md
# Edit prd.md with feature details

# 3. Create first epic
cp /home/samuel/sv/templates/epic-template.md .bmad/features/my-feature/epics/epic-001-my-epic.md
# Edit epic with:
# - Feature: my-feature (in frontmatter)
```

### Adding an Epic to Existing Feature

```bash
# 1. Create epic file in feature epics/ directory
cp /home/samuel/sv/templates/epic-template.md .bmad/features/my-feature/epics/epic-002-next-epic.md

# 2. Update PRD epic status table
# Add row to Epic Status table in prd.md

# 3. Add frontmatter
# Feature: my-feature
# Status: Pending
```

### Recording an ADR

```bash
# 1. Create ADR in feature adr/ directory
cp /home/samuel/sv/templates/adr-template.md .bmad/features/my-feature/adr/001-decision-topic.md

# 2. Link from PRD
# Add to "Related Documents > Architecture Decisions" section
```

---

## PRD Maintenance

Each feature PRD tracks:

1. **Document History** - Version changes and authors
2. **Epic Status** - Completion tracking for all epics
3. **Goals** - Feature objectives and success criteria
4. **Change Log** - Major milestones and updates

**Update PRD when:**
- Epic status changes (Pending → In Progress → Complete)
- New epic added to feature
- Feature scope changes
- Major milestone reached

---

## Finding Information

### By Epic Number

```bash
# Find epic-015
find .bmad/features -name "*epic-015*"
```

### By Topic/Keyword

```bash
# Find all epics related to "tunnel"
grep -r "tunnel" .bmad/features/*/epics/
```

### By Feature

```bash
# List all epics in ui-first-workflow
ls .bmad/features/ui-first-workflow/epics/
```

### All Implementation Reports

```bash
# List all implementation reports
find .bmad/features -name "EPIC-*" -path "*/reports/*"
```

---

## Migration Documentation

**Complete migration plan:** `.bmad/MIGRATION-PLAN.md`
**Feature-epic mapping:** `.bmad/FEATURE-EPIC-MAPPING.md`
**Migration report:** `.bmad/MIGRATION-REPORT.md` (generated after completion)

---

## References

- **BMAD Guide:** `/home/samuel/sv/docs/guides/bmad-workflow-guide.md`
- **Epic Template:** `/home/samuel/sv/templates/epic-template.md`
- **PRD Template:** `/home/samuel/sv/templates/prd-template.md`
- **ADR Template:** `/home/samuel/sv/templates/adr-template.md`

---

**Maintained by:** Meta-Supervisor
**Last Migration:** 2026-01-27
