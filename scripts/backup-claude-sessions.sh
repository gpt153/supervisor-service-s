#!/bin/bash
# Backup Claude Code session transcripts to Google Drive
# Usage: ./backup-claude-sessions.sh [--dry-run] [--verbose]
#
# Features:
#   - Incremental sync (only changed files)
#   - Bandwidth limited (10 Mbps)
#   - Excludes lock/temp files
#   - Comprehensive logging
#   - Exit codes: 0=success, 1=partial failure, 2=complete failure

set -euo pipefail

# Configuration
HOSTNAME=$(hostname)
SOURCE_DIR="$HOME/.claude/projects"
DEST_DIR="gdrive:claude-backups/${HOSTNAME}/.claude/projects"
LOG_DIR="$HOME/.claude/backup-logs"
LOG_FILE="${LOG_DIR}/backup-$(date +%Y-%m-%d-%H%M).log"
BANDWIDTH_LIMIT="10M"
TRANSFERS=4

# Parse arguments
DRY_RUN=""
VERBOSE=""
for arg in "$@"; do
  case $arg in
    --dry-run) DRY_RUN="--dry-run" ;;
    --verbose) VERBOSE="--verbose" ;;
  esac
done

# Create log directory
mkdir -p "$LOG_DIR"

# Pre-flight checks
if [ ! -d "$SOURCE_DIR" ]; then
  echo "ERROR: Source directory not found: $SOURCE_DIR" | tee "$LOG_FILE"
  exit 2
fi

if ! command -v rclone &> /dev/null; then
  echo "ERROR: rclone not installed. Install with: sudo apt install rclone" | tee "$LOG_FILE"
  exit 2
fi

if ! rclone lsd gdrive: &>/dev/null; then
  echo "ERROR: rclone cannot access Google Drive. Run: rclone config" | tee "$LOG_FILE"
  exit 2
fi

# Run backup
{
  echo "=== Backup Started ==="
  echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "Hostname: $HOSTNAME"
  echo "Source: $SOURCE_DIR"
  echo "Destination: $DEST_DIR"
  echo "Mode: Incremental sync"
  echo "Bandwidth limit: $BANDWIDTH_LIMIT"
  echo ""

  # Get pre-backup stats
  SOURCE_SIZE=$(du -sh "$SOURCE_DIR" 2>/dev/null | cut -f1 || echo "unknown")
  SOURCE_FILES=$(find "$SOURCE_DIR" -type f | wc -l)
  echo "Pre-backup stats:"
  echo "  Total size: $SOURCE_SIZE"
  echo "  Total files: $SOURCE_FILES"
  echo ""

  # Run the sync
  rclone sync "$SOURCE_DIR" "$DEST_DIR" \
    --transfers=$TRANSFERS \
    --bwlimit=$BANDWIDTH_LIMIT \
    --exclude="*.lock" \
    --exclude="*.tmp" \
    --exclude="*.swp" \
    --exclude=".DS_Store" \
    --stats=30s \
    --stats-one-line \
    --log-level=INFO \
    $DRY_RUN $VERBOSE 2>&1

  EXIT_CODE=${PIPESTATUS[0]}

  echo ""
  echo "=== Backup Completed ==="
  echo "End timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "Exit code: $EXIT_CODE"

  if [ $EXIT_CODE -eq 0 ]; then
    echo "Status: SUCCESS"
  elif [ $EXIT_CODE -eq 1 ]; then
    echo "Status: PARTIAL FAILURE (some files may not have synced)"
  else
    echo "Status: FAILURE"
  fi
} | tee -a "$LOG_FILE"

EXIT_CODE=${PIPESTATUS[0]}

# Write status file for quick checking
cat > "$LOG_DIR/last-backup-status.json" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "hostname": "$HOSTNAME",
  "exit_code": $EXIT_CODE,
  "success": $([ $EXIT_CODE -eq 0 ] && echo true || echo false),
  "log_file": "$LOG_FILE",
  "source_dir": "$SOURCE_DIR",
  "dest_dir": "$DEST_DIR"
}
EOF

exit $EXIT_CODE
