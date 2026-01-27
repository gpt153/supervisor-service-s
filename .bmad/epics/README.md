# ⚠️ DEPRECATED: Epics Directory

**This directory is deprecated as of 2026-01-27.**

---

## Migration Complete

All epics have been migrated to the feature-based structure at `.bmad/features/*/epics/`.

---

## Where to Find Epics

**Old location:** `.bmad/epics/001-epic-name.md`
**New location:** `.bmad/features/feature-name/epics/epic-001-epic-name.md`

---

## Quick Navigation

### Find Epic by Number

```bash
# Example: Find epic-015
find .bmad/features -name "*epic-015*"
```

### Find Epic by Name/Topic

```bash
# Example: Find tunnel-related epics
grep -r "tunnel" .bmad/features/*/epics/
```

### Browse by Feature

See `.bmad/features/README.md` for complete feature list and navigation guide.

---

## Migration Details

**Migration date:** 2026-01-27
**Epics migrated:** 43
**Features created:** 14

See `.bmad/FEATURE-EPIC-MAPPING.md` for complete epic-to-feature mapping.

---

**DO NOT create new epics here. Use `.bmad/features/[feature]/epics/` instead.**
