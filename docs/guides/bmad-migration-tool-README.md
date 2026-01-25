# BMAD Migration Tool

**Converts flat `.bmad/` directories to feature-based organization**

---

## Quick Start

```bash
# 1. Preview changes (dry run)
npm run migrate-bmad -- --project /path/to/project --dry-run

# 2. Execute migration
npm run migrate-bmad -- --project /path/to/project

# 3. Verify results
cat /path/to/project/.bmad/reports/migration-*.md
```

---

## What It Does

### Before Migration
```
.bmad/
├── epics/
│   ├── epic-001-auth.md
│   └── epic-002-dashboard.md
├── adr/
│   └── ADR-001-jwt.md
└── prd/
    └── PRD-20260120-auth.md
```

### After Migration
```
.bmad/
└── features/
    ├── auth/
    │   ├── prd.md
    │   ├── epics/
    │   │   └── epic-001-auth.md
    │   └── adr/
    │       └── ADR-001-jwt.md
    └── dashboard/
        └── epics/
            └── epic-002-dashboard.md
```

---

## Key Features

✅ **Safe Migration**
- Creates backup before modifying
- Preserves all file content
- No data loss

✅ **Smart Feature Detection**
- Extracts from frontmatter (`parent_feature`)
- Parses epic titles
- Uses filename slugs as fallback

✅ **Dry Run Mode**
- Preview changes before executing
- No files modified
- See exactly what will happen

✅ **Comprehensive Reporting**
- Detailed migration report
- Lists all moves
- Highlights errors/warnings

✅ **Error Handling**
- Validates project path
- Checks for existing structure
- Reports issues clearly

---

## Installation

**Already installed** - part of supervisor-service-s

```bash
cd /home/samuel/sv/supervisor-service-s
npm install  # If not already done
```

---

## Usage

### Basic Commands

```bash
# Help
npm run migrate-bmad -- --help

# Dry run (preview)
npm run migrate-bmad -- --project /path/to/project --dry-run

# Execute
npm run migrate-bmad -- --project /path/to/project
```

### Real Examples

```bash
# Consilio
npm run migrate-bmad -- --project /home/samuel/sv/consilio-s --dry-run
npm run migrate-bmad -- --project /home/samuel/sv/consilio-s

# Odin
npm run migrate-bmad -- --project /home/samuel/sv/odin-s --dry-run
npm run migrate-bmad -- --project /home/samuel/sv/odin-s
```

---

## Feature Detection

### How Features Are Detected

**Priority (highest to lowest):**

1. **Frontmatter** (best)
   ```markdown
   ---
   parent_feature: user-authentication
   ---
   # Epic 001: JWT Auth
   ```

2. **Title extraction**
   ```markdown
   # Epic: User Authentication System
   ```
   → feature: `user-authentication-system`

3. **Filename fallback**
   ```
   epic-001-authentication.md
   ```
   → feature: `authentication`

### Artifact Patterns

| Type | Pattern | Example | Target |
|------|---------|---------|--------|
| Feature Request | `FR-YYYYMMDD-{slug}.md` | `FR-20260120-auth.md` | `features/auth/feature-request.md` |
| PRD | `PRD-YYYYMMDD-{slug}.md` | `PRD-20260120-auth.md` | `features/auth/prd.md` |
| Epic | `epic-NNN-{slug}.md` | `epic-001-auth.md` | `features/auth/epics/epic-001-auth.md` |
| ADR | `ADR-NNN-{slug}.md` | `ADR-001-jwt.md` | `features/auth/adr/ADR-001-jwt.md` |

---

## Workflow

### Standard Migration Process

1. **Dry Run**
   ```bash
   npm run migrate-bmad -- --project /path/to/project --dry-run
   ```
   Review output carefully.

2. **Execute**
   ```bash
   npm run migrate-bmad -- --project /path/to/project
   ```
   Creates backup and migrates files.

3. **Verify**
   ```bash
   # Check new structure
   ls -R /path/to/project/.bmad/features/

   # Read migration report
   cat /path/to/project/.bmad/reports/migration-*.md
   ```

4. **Update References**
   ```bash
   # Fix any broken links in files
   # Update CI/CD scripts if needed
   ```

5. **Test**
   ```bash
   # Verify workflows still work
   # Run tests
   # Check epic creation tools
   ```

6. **Commit**
   ```bash
   git add .bmad/features/ .bmad/reports/
   git commit -m "refactor: migrate BMAD to feature-based structure"
   git push
   ```

7. **Cleanup**
   ```bash
   # After verification (1-2 days)
   rm -rf /path/to/project/.bmad.backup/
   ```

---

## Output Example

```
======================================================================
BMAD STRUCTURE MIGRATION TOOL
======================================================================

⚠️  DRY RUN MODE - No files will be modified

Found 4 feature(s):

  authentication (3 artifact(s))
    [DRY] feature-request: FR-20260115-auth.md
    [DRY] prd: PRD-20260120-auth.md
    [DRY] epic: epic-001-auth.md

  dashboard (1 artifact(s))
    [DRY] epic: epic-002-dashboard.md

  gdpr-compliance (2 artifact(s))
    [DRY] epic: epic-003-gdpr.md
    [DRY] adr: ADR-001-gdpr-design.md

  notifications (1 artifact(s))
    [DRY] epic: epic-004-push-notifications.md

======================================================================
MIGRATION SUMMARY
======================================================================

Mode: DRY RUN
Project: /home/samuel/sv/consilio-s

Features: 4
Artifacts: 7

======================================================================

ℹ️  This was a dry run. No files were modified.
   Run without --dry-run to execute migration.
```

---

## Migration Report

**Location**: `.bmad/reports/migration-{timestamp}.md`

**Contains**:
- Summary (features, artifacts, errors)
- Features created
- Artifacts moved (before/after paths)
- Errors/warnings
- Next steps checklist

**Example**: See `/home/samuel/sv/supervisor-service-s/docs/guides/bmad-migration-guide.md`

---

## Rollback

**If migration has issues:**

```bash
cd /path/to/project

# Remove migrated structure
rm -rf .bmad/features/

# Restore from backup
mv .bmad.backup/* .bmad/
rmdir .bmad.backup
```

---

## Troubleshooting

### "No .bmad directory found"

**Check project path:**
```bash
ls -la /path/to/project/.bmad/
```

**Solution**: Verify correct project path.

### "Features directory already exists"

**This is a warning, not error.**

Tool will merge new artifacts. Review dry run output carefully.

### Migration incomplete

**Check migration report:**
```bash
cat .bmad/reports/migration-*.md
```

Look for errors section. Fix issues manually if needed.

### Feature detection wrong

**Recommended fix:**

Add frontmatter to epic:
```markdown
---
parent_feature: correct-feature-slug
---
```

Then re-run migration.

---

## Advanced Usage

### Batch Migration

```bash
# Dry run all projects
for project in consilio-s odin-s openhorizon-s; do
  npm run migrate-bmad -- --project /home/samuel/sv/$project --dry-run
done

# Execute after review
for project in consilio-s odin-s openhorizon-s; do
  npm run migrate-bmad -- --project /home/samuel/sv/$project
done
```

### Programmatic Usage

```typescript
import { migrate, scanArtifacts, detectArtifact } from './migrate-bmad-structure.js';

// Scan artifacts
const groups = scanArtifacts('/path/to/.bmad');
console.log(`Found ${groups.length} features`);

// Execute migration
const report = migrate('/path/to/project', false);

if (report.errors.length === 0) {
  console.log('✓ Migration successful');
} else {
  console.error('✗ Migration failed:', report.errors);
}
```

---

## Files

| File | Description |
|------|-------------|
| `src/scripts/migrate-bmad-structure.ts` | Migration tool |
| `docs/guides/bmad-migration-guide.md` | Comprehensive guide |
| `docs/examples/bmad-migration-examples.sh` | Usage examples |
| `docs/templates/epic-with-feature-template.md` | Epic template with feature support |

---

## Best Practices

1. ✅ **Always dry run first** - See what will change
2. ✅ **Review output carefully** - Check feature detection is correct
3. ✅ **Backup exists automatically** - But verify it worked
4. ✅ **Update references after** - Fix broken links
5. ✅ **Test workflows** - Ensure nothing broke
6. ✅ **Commit separately** - Don't mix with other changes
7. ✅ **Keep backup for 1-2 days** - Delete after verification

---

## Support

**Questions/Issues:**
- Read: `/home/samuel/sv/supervisor-service-s/docs/guides/bmad-migration-guide.md`
- Examples: `/home/samuel/sv/supervisor-service-s/docs/examples/bmad-migration-examples.sh`
- Code: `/home/samuel/sv/supervisor-service-s/src/scripts/migrate-bmad-structure.ts`

**Report bugs with:**
- Project path
- Dry run output
- Error messages
- Migration report

---

## Version

**Version**: 1.0.0
**Created**: 2026-01-25
**Maintained by**: Meta-Supervisor (MS)

---

## See Also

- [BMAD Migration Guide](./bmad-migration-guide.md) - Comprehensive documentation
- [Migration Examples](../examples/bmad-migration-examples.sh) - Copy-paste commands
- [Epic Template](../templates/epic-with-feature-template.md) - Epic with feature support
