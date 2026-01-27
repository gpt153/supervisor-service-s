# ⚠️ DEPRECATED: Implementation Directory

**This directory is deprecated as of 2026-01-27.**

---

## Migration Complete

All implementation reports have been migrated to feature-specific `reports/` directories at `.bmad/features/*/reports/`.

---

## Where to Find Implementation Reports

**Old location:** `.bmad/implementation/EPIC-001-IMPLEMENTATION.md`
**New location:** `.bmad/features/feature-name/reports/EPIC-001-IMPLEMENTATION.md`

---

## Report Distribution by Feature

- **learning-system**: 4 reports (EPIC-009-*)
- **tunnel-manager**: 3 reports (EPIC-005-*)
- **ps-delegation-enforcement**: 8 reports (EPIC-011-*, EPIC-012-*)
- **secrets-management**: 2 reports (EPIC-003-*)
- **port-allocation**: 1 report (EPIC-004-IMPLEMENTATION)
- **database-foundation**: 5 reports (EPIC-001, EPIC-002, EPIC-006, EPIC-007)

---

## Finding Implementation Reports

### By Epic Number

```bash
# Example: Find EPIC-011 reports
find .bmad/features -name "EPIC-011-*" -path "*/reports/*"
```

### By Type

```bash
# Example: Find all QUICKREF documents
find .bmad/features -name "*-QUICKREF.md" -path "*/reports/*"
```

### By Feature

```bash
# Example: List all tunnel-manager reports
ls .bmad/features/tunnel-manager/reports/
```

---

## Report Types

- **IMPLEMENTATION.md** - Detailed implementation notes
- **QUICKREF.md** - Quick reference guide
- **SUMMARY.md/.txt** - Implementation summary
- **VERIFICATION.md** - Verification and testing results
- **COMPLETE.md** - Completion confirmation

---

## Migration Details

**Migration date:** 2026-01-27
**Reports migrated:** 21
**Features affected:** 6

See `.bmad/FEATURE-EPIC-MAPPING.md` for complete report-to-feature mapping.

---

**DO NOT create new implementation reports here. Use `.bmad/features/[feature]/reports/` instead.**
