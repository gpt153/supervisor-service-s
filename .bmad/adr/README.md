# ⚠️ DEPRECATED: ADR Directory

**This directory is deprecated as of 2026-01-27.**

---

## Migration Complete

All Architecture Decision Records have been migrated to feature-specific directories at `.bmad/features/*/adr/`.

---

## Where to Find ADRs

**Old location:** `.bmad/adr/001-decision-name.md`
**New location:** `.bmad/features/feature-name/adr/001-decision-name.md`

---

## ADR Distribution by Feature

- **tunnel-manager**: 3 ADRs (001, 002, 008)
- **ps-delegation-enforcement**: 3 ADRs (002, 014, 020)
- **ui-first-workflow**: 3 ADRs (007, 009, 019)
- **mobile-platform**: 2 ADRs (010, 011)
- **ps-health-monitoring**: 3 ADRs (003, 015, 016)
- **automatic-quality-workflows**: 2 ADRs (004, 005)
- **automated-supervisor-updates**: 1 ADR (006)
- **automatic-context-handoff**: 2 ADRs (017, 018)

---

## Finding ADRs

### By Number

```bash
# Example: Find ADR-015
find .bmad/features -name "015-*" -path "*/adr/*"
```

### By Topic

```bash
# Example: Find health monitoring ADRs
grep -r "health" .bmad/features/*/adr/
```

### By Feature

```bash
# Example: List all tunnel-manager ADRs
ls .bmad/features/tunnel-manager/adr/
```

---

## Migration Details

**Migration date:** 2026-01-27
**ADRs migrated:** 19
**Features affected:** 8

See `.bmad/FEATURE-EPIC-MAPPING.md` for complete ADR-to-feature mapping.

---

**DO NOT create new ADRs here. Use `.bmad/features/[feature]/adr/` instead.**
