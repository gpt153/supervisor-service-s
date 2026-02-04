#!/bin/bash
# Clean up local Claude sessions older than retention period
# Only deletes local files that are confirmed to exist on Drive
# Usage: ./cleanup-old-sessions.sh [--days=7] [--dry-run]
#
# Features:
#   - Retention policy (keep local X days)
#   - Verify on Drive before deletion (safety critical)
#   - Dry-run to preview deletions

set -euo pipefail

RETENTION_DAYS=7
DRY_RUN=""
HOSTNAME=$(hostname)
SOURCE_DIR="$HOME/.claude/projects"
REMOTE_DIR="gdrive:claude-backups/${HOSTNAME}/.claude/projects"
DELETED=0
SKIPPED=0
ERRORS=0

# Parse arguments
for arg in "$@"; do
  case $arg in
    --days=*) RETENTION_DAYS="${arg#*=}" ;;
    --dry-run) DRY_RUN="true" ;;
  esac
done

# Pre-flight checks
if ! command -v rclone &> /dev/null; then
  echo "ERROR: rclone not installed. Install with: sudo apt install rclone"
  exit 2
fi

if ! rclone lsd gdrive: &>/dev/null; then
  echo "ERROR: rclone cannot access Google Drive. Run: rclone config"
  exit 2
fi

if [ ! -d "$SOURCE_DIR" ]; then
  echo "ERROR: Source directory not found: $SOURCE_DIR"
  exit 2
fi

# Header
echo "=== Claude Session Cleanup ==="
echo "Retention period: $RETENTION_DAYS days"
echo "Local source: $SOURCE_DIR"
echo "Verifying against: $REMOTE_DIR"

if [ -n "$DRY_RUN" ]; then
  echo "Mode: DRY RUN (no files will be deleted)"
else
  echo "Mode: ACTUAL (files will be deleted)"
fi

echo ""

# Find local files older than retention period
# Look for .jsonl files (session transcripts)
find "$SOURCE_DIR" -type f -name "*.jsonl" -mtime +"$RETENTION_DAYS" | while read -r local_file; do
  # Get relative path for remote check
  rel_path="${local_file#$SOURCE_DIR/}"

  # Safety check: Skip if relative path couldn't be determined
  if [ "$rel_path" = "$local_file" ]; then
    echo "SKIPPED (path error): $local_file"
    ((ERRORS++))
    continue
  fi

  # Check if file exists on Drive
  if rclone check "${REMOTE_DIR}/${rel_path}" --one-way &>/dev/null; then
    if [ -n "$DRY_RUN" ]; then
      echo "WOULD DELETE (confirmed on Drive): $local_file"
    else
      rm -f "$local_file"
      echo "DELETED (confirmed on Drive): $local_file"
    fi
    ((DELETED++))
  else
    echo "SKIPPED (not confirmed on Drive): $local_file"
    ((SKIPPED++))
  fi
done

echo ""
echo "=== Summary ==="
echo "Deleted: $DELETED files"
echo "Skipped: $SKIPPED files (not confirmed on Drive)"
echo "Errors: $ERRORS files (skipped due to errors)"
echo ""

if [ -n "$DRY_RUN" ]; then
  echo "This was a DRY RUN. No files were actually deleted."
  echo "To perform actual cleanup, run without --dry-run"
fi

exit 0
