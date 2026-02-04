#!/bin/bash
# Restore Claude Code session transcripts from Google Drive
# Usage: ./restore-claude-sessions.sh [--project=NAME] [--dry-run]
#
# Features:
#   - Restore all projects or specific project
#   - Dry-run to preview changes
#   - Confirmation prompt before overwrite

set -euo pipefail

HOSTNAME=$(hostname)
SOURCE_DIR="gdrive:claude-backups/${HOSTNAME}/.claude/projects"
DEST_DIR="$HOME/.claude/projects"
PROJECT=""
DRY_RUN=""

# Parse arguments
for arg in "$@"; do
  case $arg in
    --project=*) PROJECT="${arg#*=}" ;;
    --dry-run) DRY_RUN="--dry-run" ;;
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

# Adjust paths for specific project
if [ -n "$PROJECT" ]; then
  SOURCE_DIR="${SOURCE_DIR}/${PROJECT}"
  DEST_DIR="${DEST_DIR}/${PROJECT}"
  echo "Restoring project: $PROJECT"
else
  echo "Restoring ALL projects"
fi

echo ""
echo "Source: $SOURCE_DIR"
echo "Destination: $DEST_DIR"
echo "Hostname: $HOSTNAME"
echo ""

# Check if source exists on Drive
if ! rclone lsd "$SOURCE_DIR" &>/dev/null; then
  echo "ERROR: Backup not found on Google Drive: $SOURCE_DIR"
  echo ""
  echo "Available backups:"
  rclone lsd "gdrive:claude-backups/" || true
  exit 1
fi

# Confirmation prompt (unless --dry-run)
if [ -z "$DRY_RUN" ]; then
  echo "⚠️  WARNING: This will copy files from Google Drive to local disk."
  echo "   Existing local files with same name will be OVERWRITTEN."
  echo "   (New local files will NOT be deleted)"
  echo ""
  read -p "Continue? (type 'yes' to confirm): " -r
  echo

  if [[ ! $REPLY == "yes" ]]; then
    echo "Aborted."
    exit 0
  fi
fi

# Create destination directory
mkdir -p "$DEST_DIR"

# Run the restore
echo "Starting restore..."
echo ""

rclone copy "$SOURCE_DIR" "$DEST_DIR" \
  --transfers=4 \
  --stats=30s \
  --stats-one-line \
  --log-level=INFO \
  $DRY_RUN

echo ""
echo "Restore completed."

if [ -z "$DRY_RUN" ]; then
  echo ""
  echo "Restored to: $DEST_DIR"
  echo "Use 'find $DEST_DIR -type f | wc -l' to count restored files"
fi
