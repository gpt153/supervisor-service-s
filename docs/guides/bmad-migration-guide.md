# BMAD Structure Migration Guide

**Tool**: `/home/samuel/sv/supervisor-service-s/src/scripts/migrate-bmad-structure.ts`

---

## Overview

The BMAD migration tool converts flat `.bmad/` directory structures to feature-based organization. This enables better artifact management and clearer relationships between epics, PRDs, ADRs, and feature requests.

---

## What Gets Migrated

### Before (Flat Structure)

```
.bmad/
├── epics/
│   ├── epic-001-auth.md
│   ├── epic-002-dashboard.md
│   └── epic-003-notifications.md
├── adr/
│   ├── ADR-001-jwt-auth.md
│   └── ADR-002-websocket-protocol.md
├── prd/
│   └── PRD-20260120-auth.md
└── feature-requests/
    └── FR-20260115-push-notifications.md
```

### After (Feature-Based Structure)

```
.bmad/
└── features/
    ├── auth/
    │   ├── feature-request.md  (was FR-20260115-auth.md)
    │   ├── prd.md              (was PRD-20260120-auth.md)
    │   ├── epics/
    │   │   └── epic-001-auth.md
    │   └── adr/
    │       └── ADR-001-jwt-auth.md
    ├── dashboard/
    │   └── epics/
    │       └── epic-002-dashboard.md
    └── notifications/
        ├── feature-request.md  (was FR-20260115-push-notifications.md)
        └── epics/
            └── epic-003-notifications.md
```

---

## Feature Detection

The tool detects features from:

1. **Feature Requests**: `FR-YYYYMMDD-{feature-slug}.md` → feature: `{feature-slug}`
2. **PRDs**: `PRD-YYYYMMDD-{feature-slug}.md` → feature: `{feature-slug}`
3. **Epics**: Extracts from frontmatter (`parent_feature`/`feature`) or title
4. **ADRs**: Uses slug from filename

### Epic Feature Detection

**Priority order:**

1. **Frontmatter** (highest priority):
   ```markdown
   ---
   parent_feature: authentication
   ---
   # Epic 001: JWT Authentication
   ```

2. **Title extraction**:
   ```markdown
   # Epic 001: User Authentication System
   ```
   Extracts "user-authentication-system" as feature.

3. **Filename fallback**:
   ```
   epic-001-authentication-system.md
   ```
   Uses "authentication-system" as feature.

---

## Usage

### 1. Dry Run (Preview Changes)

**ALWAYS run dry run first to preview changes:**

```bash
cd /home/samuel/sv/supervisor-service-s

npm run migrate-bmad -- --project /home/samuel/sv/consilio-s --dry-run
```

**Output:**
- Lists all features detected
- Shows what files would be moved where
- No files are modified

### 2. Execute Migration

**After reviewing dry run:**

```bash
npm run migrate-bmad -- --project /home/samuel/sv/consilio-s
```

**This will:**
- Create backup: `.bmad.backup/`
- Create feature directories
- Copy artifacts to new structure
- Generate migration report

### 3. Verify Migration

**Check results:**

```bash
# Verify new structure
ls -R /home/samuel/sv/consilio-s/.bmad/features/

# Check migration report
cat /home/samuel/sv/consilio-s/.bmad/reports/migration-*.md
```

---

## Migration Report

**Location**: `.bmad/reports/migration-{timestamp}.md`

**Contains:**

1. **Summary**
   - Features created
   - Artifacts moved
   - Errors/warnings

2. **Detailed Mapping**
   - Before/after paths for each file

3. **Next Steps**
   - Verification checklist
   - Cleanup instructions

**Example:**

```markdown
# BMAD Structure Migration Report

**Project**: /home/samuel/sv/consilio-s
**Timestamp**: 2026-01-25T10:30:00.000Z
**Mode**: LIVE MIGRATION
**Backup**: /home/samuel/sv/consilio-s/.bmad.backup

---

## Summary

- **Features Created**: 4
- **Artifacts Moved**: 12
- **Errors**: 0
- **Warnings**: 0

---

## Features Created

- `authentication`
- `dashboard`
- `gdpr-compliance`
- `notifications`

---

## Artifacts Moved

- `.bmad/epics/epic-001-auth.md` → `.bmad/features/authentication/epics/epic-001-auth.md`
- `.bmad/adr/ADR-001-jwt.md` → `.bmad/features/authentication/adr/ADR-001-jwt.md`
...
```

---

## Post-Migration Steps

### 1. Verify Structure

```bash
# Check feature directories
ls -la .bmad/features/

# Verify file content unchanged
diff .bmad.backup/epics/epic-001.md .bmad/features/{feature}/epics/epic-001.md
```

### 2. Update References

**Files to check:**

- Epic links to ADRs
- PRD references
- Documentation links
- Scripts/tooling

**Example updates:**

```markdown
# Before
See [ADR-001](../adr/ADR-001-auth.md)

# After
See [ADR-001](./adr/ADR-001-auth.md)
```

### 3. Test Workflows

**Verify:**

- Epic creation still works
- Links resolve correctly
- CI/CD pipelines unaffected

### 4. Commit Changes

```bash
cd /home/samuel/sv/consilio-s

git add .bmad/features/
git add .bmad/reports/
git commit -m "refactor: migrate BMAD to feature-based structure"
git push
```

### 5. Delete Backup

**After verification:**

```bash
rm -rf .bmad.backup/
```

---

## Rollback (If Needed)

**If migration has issues:**

```bash
# Restore from backup
rm -rf .bmad/
mv .bmad.backup/ .bmad/
```

---

## Edge Cases

### Multiple Epics Per Feature

**Handled automatically:**

```
features/
└── authentication/
    └── epics/
        ├── epic-001-jwt-auth.md
        ├── epic-002-oauth.md
        └── epic-003-mfa.md
```

### Feature Name Conflicts

**Tool automatically slugifies:**

- `User Authentication` → `user-authentication`
- `GDPR Compliance!!!` → `gdpr-compliance`
- `API v2.0` → `api-v2-0`

### Artifacts Without Features

**Ignored during migration:**

- Files not matching patterns
- Artifacts in subdirectories
- Non-markdown files

---

## Troubleshooting

### Issue: "No .bmad directory found"

**Solution:**

```bash
# Verify project path
ls -la /path/to/project/

# Check for .bmad/
ls -la /path/to/project/.bmad/
```

### Issue: "Features directory already exists"

**This is a warning, not error. Tool will:**
- Merge new artifacts into existing structure
- Preserve existing feature directories

### Issue: Migration incomplete

**Check migration report:**

```bash
cat .bmad/reports/migration-*.md
```

**Look for errors section and fix manually.**

---

## Advanced Usage

### Migrate All Projects

```bash
cd /home/samuel/sv/supervisor-service-s

# Dry run first
for project in consilio-s odin-s openhorizon-s health-agent-s; do
  npm run migrate-bmad -- --project /home/samuel/sv/$project --dry-run
done

# Execute after review
for project in consilio-s odin-s openhorizon-s health-agent-s; do
  npm run migrate-bmad -- --project /home/samuel/sv/$project
done
```

### Programmatic Usage

```typescript
import { migrate, scanArtifacts } from './migrate-bmad-structure.js';

// Scan artifacts
const groups = scanArtifacts('/path/to/project/.bmad');
console.log('Features found:', groups.length);

// Execute migration
const report = migrate('/path/to/project', false);
console.log('Artifacts moved:', report.artifactsMoved.length);
```

---

## Best Practices

1. **Always dry run first** - Preview changes before executing
2. **Review migration report** - Check for warnings/errors
3. **Verify file content** - Ensure no data loss
4. **Update references** - Fix broken links
5. **Test workflows** - Verify everything still works
6. **Commit incrementally** - Don't mix with other changes
7. **Delete backup after verification** - Keep repo clean

---

## FAQ

**Q: Does migration modify file content?**

A: No. Only moves files, content stays identical.

**Q: Can I undo migration?**

A: Yes. Restore from `.bmad.backup/` directory.

**Q: What if feature detection is wrong?**

A: Manually move files after migration. Update epic frontmatter with correct `parent_feature`.

**Q: Should I migrate all projects at once?**

A: No. Migrate one project at a time, verify, then continue.

**Q: Will this break existing tools?**

A: Check references in scripts/CI/CD. Update paths if needed.

---

## Support

**Issues:** File bug report with:
- Project path
- Dry run output
- Error messages
- Migration report

**Location:** `/home/samuel/sv/supervisor-service-s/src/scripts/migrate-bmad-structure.ts`

---

**Last Updated**: 2026-01-25
**Maintained by**: Meta-Supervisor (MS)
