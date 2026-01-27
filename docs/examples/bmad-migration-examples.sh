#!/bin/bash

# BMAD Migration Tool - Usage Examples
# =====================================
# Location: /home/samuel/sv/supervisor-service-s/src/scripts/migrate-bmad-structure.ts

# ============================================================================
# Basic Usage
# ============================================================================

# 1. Help
npm run migrate-bmad -- --help

# 2. Dry run (preview changes)
npm run migrate-bmad -- --project /home/samuel/sv/consilio-s --dry-run

# 3. Execute migration
npm run migrate-bmad -- --project /home/samuel/sv/consilio-s

# ============================================================================
# Project-Specific Migrations
# ============================================================================

# Consilio
npm run migrate-bmad -- --project /home/samuel/sv/consilio-s --dry-run
npm run migrate-bmad -- --project /home/samuel/sv/consilio-s

# Odin
npm run migrate-bmad -- --project /home/samuel/sv/odin-s --dry-run
npm run migrate-bmad -- --project /home/samuel/sv/odin-s

# OpenHorizon
npm run migrate-bmad -- --project /home/samuel/sv/openhorizon-s --dry-run
npm run migrate-bmad -- --project /home/samuel/sv/openhorizon-s

# Health-Agent
npm run migrate-bmad -- --project /home/samuel/sv/health-agent-s --dry-run
npm run migrate-bmad -- --project /home/samuel/sv/health-agent-s

# Supervisor-Service (Meta)
npm run migrate-bmad -- --project /home/samuel/sv/supervisor-service-s --dry-run
npm run migrate-bmad -- --project /home/samuel/sv/supervisor-service-s

# ============================================================================
# Batch Migration (All Projects)
# ============================================================================

# Dry run all projects
for project in consilio-s odin-s openhorizon-s health-agent-s supervisor-service-s; do
  echo "=== DRY RUN: $project ==="
  npm run migrate-bmad -- --project /home/samuel/sv/$project --dry-run
  echo ""
done

# Execute all migrations (after dry run review)
for project in consilio-s odin-s openhorizon-s health-agent-s supervisor-service-s; do
  echo "=== MIGRATING: $project ==="
  npm run migrate-bmad -- --project /home/samuel/sv/$project
  echo ""
done

# ============================================================================
# Verification After Migration
# ============================================================================

# Check new structure
ls -R /home/samuel/sv/consilio-s/.bmad/features/

# View migration report
cat /home/samuel/sv/consilio-s/.bmad/reports/migration-*.md

# Compare backup vs migrated (verify no content changes)
diff -r /home/samuel/sv/consilio-s/.bmad.backup/epics/ \
        /home/samuel/sv/consilio-s/.bmad/features/*/epics/

# Count artifacts in old structure
find /home/samuel/sv/consilio-s/.bmad.backup -name "*.md" -type f | wc -l

# Count artifacts in new structure
find /home/samuel/sv/consilio-s/.bmad/features -name "*.md" -type f | wc -l

# ============================================================================
# Rollback (If Needed)
# ============================================================================

# Restore from backup
cd /home/samuel/sv/consilio-s
rm -rf .bmad/features/
mv .bmad.backup/* .bmad/
rmdir .bmad.backup

# ============================================================================
# Cleanup After Verification
# ============================================================================

# Delete backup (after confirming migration success)
rm -rf /home/samuel/sv/consilio-s/.bmad.backup/

# Commit changes
cd /home/samuel/sv/consilio-s
git add .bmad/features/ .bmad/reports/
git commit -m "refactor: migrate BMAD to feature-based structure"
git push

# ============================================================================
# Troubleshooting
# ============================================================================

# Check if .bmad directory exists
ls -la /home/samuel/sv/consilio-s/.bmad/

# List all markdown files in .bmad
find /home/samuel/sv/consilio-s/.bmad -name "*.md" -type f

# Check for existing features directory
ls -la /home/samuel/sv/consilio-s/.bmad/features/ 2>/dev/null

# View last migration report
ls -t /home/samuel/sv/consilio-s/.bmad/reports/migration-*.md | head -1 | xargs cat

# ============================================================================
# Advanced: Programmatic Usage
# ============================================================================

# Run from Node.js/TypeScript
node -e "
import { migrate } from './src/scripts/migrate-bmad-structure.js';

const report = migrate('/home/samuel/sv/consilio-s', false);
console.log('Artifacts moved:', report.artifactsMoved.length);
console.log('Features created:', report.featuresCreated.length);
"

# ============================================================================
# Testing Feature Detection
# ============================================================================

# Test epic feature extraction
cat > /tmp/test-epic.md << 'EOF'
---
parent_feature: authentication
---
# Epic 001: JWT Authentication System
EOF

# Run migration on test directory (dry run)
npm run migrate-bmad -- --project /tmp/test-project --dry-run

# ============================================================================
# Monitoring Migration Progress
# ============================================================================

# Watch migration in real-time
npm run migrate-bmad -- --project /home/samuel/sv/consilio-s | tee migration.log

# Parse report for statistics
grep "Features:" migration.log
grep "Artifacts:" migration.log
grep "Errors:" migration.log

# ============================================================================
# Integration with CI/CD
# ============================================================================

# Verify structure after migration (in CI pipeline)
#!/bin/bash
set -e

PROJECT_PATH="/home/samuel/sv/consilio-s"

# Run migration (dry run for safety)
npm run migrate-bmad -- --project "$PROJECT_PATH" --dry-run > migration-output.txt

# Check for errors
if grep -q "Errors: 0" migration-output.txt; then
  echo "✓ Migration validation passed"
  exit 0
else
  echo "✗ Migration validation failed"
  cat migration-output.txt
  exit 1
fi

# ============================================================================
# End of Examples
# ============================================================================
