---
epic_id: claude-session-integration-009-D
parent_feature: claude-session-integration
status: pending
complexity: 2
created: 2026-02-04
started: null
completed: null
assigned_to: null
source: prd
---

# Epic 009-D: Backup Automation

**Feature**: Claude Code Session Reference Integration - Backup Phase
**Epic ID**: claude-session-integration-009-D
**Status**: Pending
**Complexity**: 2 (Medium)
**Created**: 2026-02-04
**Effort**: 14 hours
**Dependencies**: None (independent of database epics)
**Source**: PRD (claude-session-integration)

---

## Quick Reference

**Purpose**: Automate backup of Claude Code session transcripts (`~/.claude/projects/`) to Google Drive using rclone. Implement 7-day hot local retention with older sessions archived to Drive.

**Key Deliverable**: Automated daily backup via systemd timer, restore script, and basic monitoring. Protects 2.5GB of session data against machine failure.

**Critical Success Factor**: Backups run automatically without manual intervention, restore procedure tested, and no impact on active Claude Code sessions.

---

## Project Context

- **Project**: Supervisor Service (Meta)
- **Repository**: `/home/samuel/sv/supervisor-service-s/`
- **Tech Stack**: Bash scripts, rclone, systemd, Google Drive API
- **Parent Feature**: claude-session-integration
- **Independent**: No dependency on database epics (009-A, 009-B, 009-C)

---

## Business Context

### Problem Statement

Claude Code stores 2.5GB of session transcripts locally at `~/.claude/projects/`. This data includes full conversation history, tool call records, and decision context accumulated over months. There is no backup or redundancy. A machine failure, disk corruption, or accidental deletion would permanently lose this data.

Key statistics:
- Total data: 2.5GB across all projects
- Recent data: 1.6GB from last 7 days (1,563 sessions)
- Average session: 1.1MB
- Growth rate: ~230MB/day

### User Value

- **Data protection**: Session transcripts backed up to Google Drive
- **Disaster recovery**: Restore procedure tested and documented
- **Storage management**: Old transcripts archived, freeing local disk space
- **Automatic**: No manual intervention needed after initial setup

---

## Requirements

### Functional Requirements (MoSCoW)

**MUST HAVE:**

- [ ] AC1: rclone configuration for Google Drive
  - Remote name: `gdrive` (odin@153.se account)
  - Target directory: `gdrive:claude-backups/`
  - Machine-specific subdirectory: `gdrive:claude-backups/{hostname}/`
  - Verify: rclone access to Google Drive works

- [ ] AC2: Backup script (`scripts/backup-claude-sessions.sh`)
  - Source: `~/.claude/projects/`
  - Destination: `gdrive:claude-backups/{hostname}/.claude/projects/`
  - Mode: Incremental sync (only changed files)
  - Exclude: Lock files, temp files (`*.lock`, `*.tmp`, `*.swp`)
  - Bandwidth limit: 10 Mbps (don't saturate connection)
  - Logging: Output to `~/.claude/backup-logs/backup-{date}.log`
  - Exit codes: 0=success, 1=partial failure, 2=complete failure

- [ ] AC3: Systemd timer for scheduled backup
  - Timer unit: `claude-backup.timer`
  - Service unit: `claude-backup.service`
  - Schedule: Daily at 03:00 UTC (off-peak)
  - Persistent: Yes (catch up if machine was off at scheduled time)
  - Install: User-level systemd (`~/.config/systemd/user/`)

- [ ] AC4: Restore script (`scripts/restore-claude-sessions.sh`)
  - Input: Optional project name (default: all projects)
  - Source: `gdrive:claude-backups/{hostname}/.claude/projects/`
  - Destination: `~/.claude/projects/`
  - Mode: Sync from Drive (does not delete local files by default)
  - Dry-run flag: `--dry-run` to preview without changes
  - Confirmation prompt before overwrite

- [ ] AC5: Basic monitoring
  - Log backup success/failure to backup log directory
  - Log file includes: timestamp, files synced, bytes transferred, duration, errors
  - Last backup status readable via simple script

**SHOULD HAVE:**

- [ ] AC6: Retention policy
  - Keep all sessions locally for 7 days
  - After 7 days, sessions exist only on Drive
  - Local cleanup script: `scripts/cleanup-old-sessions.sh`
  - Cleanup only runs AFTER verifying backup exists on Drive
  - Safety: Never delete local file unless confirmed on Drive

- [ ] AC7: Status checking MCP tool
  - `mcp_meta_check_backup_status`: Returns last backup time, success/failure, files count, total size
  - Reads from backup log files
  - Warns if last successful backup >48 hours ago

**COULD HAVE:**

- [ ] Alert notification on 3 consecutive backup failures (email or log)
- [ ] Compression of old sessions before upload

**WON'T HAVE (this iteration):**

- Real-time sync (only daily batch)
- Cross-machine backup coordination
- Backup encryption at rest (Drive handles security)
- Selective project backup (all projects backed up together)

---

## Architecture

### Technical Approach

**rclone Configuration:**
```
[gdrive]
type = drive
scope = drive
token = {oauth-token}
root_folder_id = {folder-id}
```

**Backup Flow:**
```
~/.claude/projects/  (local, 2.5GB)
  |
  v
rclone sync --transfers=4 --bwlimit=10M
  |
  v
gdrive:claude-backups/{hostname}/.claude/projects/  (Google Drive)
  |
  v
Log result to ~/.claude/backup-logs/backup-{date}.log
```

**Retention Flow:**
```
For each session in ~/.claude/projects/{project}/:
  |
  +-- Modified < 7 days ago? --> Keep locally
  |
  +-- Modified >= 7 days ago?
        |
        +-- Exists on Drive? (rclone check)
        |     |
        |     +-- Yes --> Delete local copy
        |     +-- No --> Keep (backup may have failed)
```

**Systemd Units:**
```
~/.config/systemd/user/
  claude-backup.timer    # Triggers daily at 03:00 UTC
  claude-backup.service  # Runs backup script
```

---

## Implementation Notes

### Task Breakdown

**Task 1: rclone Setup and Configuration (2 hours)**

Verify rclone is installed and configured:
```bash
# Check rclone installed
which rclone || sudo apt install rclone

# Configure Google Drive remote (if not already done)
# rclone config (interactive, one-time setup)

# Verify access
rclone lsd gdrive:

# Create backup directory
rclone mkdir gdrive:claude-backups/$(hostname)
```

Document configuration in `docs/backup-setup.md`.

If rclone is not configured, document the one-time setup steps:
1. `rclone config` --> New remote --> Google Drive
2. OAuth flow with odin@153.se
3. Verify with `rclone ls gdrive:`

**Task 2: Backup Script (3 hours)**

Create `scripts/backup-claude-sessions.sh`:

```bash
#!/bin/bash
# Backup Claude Code session transcripts to Google Drive
# Usage: ./backup-claude-sessions.sh [--dry-run] [--verbose]

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

if ! rclone lsd gdrive: &>/dev/null; then
  echo "ERROR: rclone cannot access Google Drive" | tee "$LOG_FILE"
  exit 2
fi

# Run backup
echo "Starting backup at $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee "$LOG_FILE"
echo "Source: $SOURCE_DIR" | tee -a "$LOG_FILE"
echo "Destination: $DEST_DIR" | tee -a "$LOG_FILE"
echo "Hostname: $HOSTNAME" | tee -a "$LOG_FILE"

rclone sync "$SOURCE_DIR" "$DEST_DIR" \
  --transfers=$TRANSFERS \
  --bwlimit=$BANDWIDTH_LIMIT \
  --exclude="*.lock" \
  --exclude="*.tmp" \
  --exclude="*.swp" \
  --stats=30s \
  --stats-one-line \
  --log-file="$LOG_FILE" \
  --log-level=INFO \
  $DRY_RUN $VERBOSE 2>&1 | tee -a "$LOG_FILE"

EXIT_CODE=${PIPESTATUS[0]}

echo "" | tee -a "$LOG_FILE"
echo "Backup completed at $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee -a "$LOG_FILE"
echo "Exit code: $EXIT_CODE" | tee -a "$LOG_FILE"

# Write status file for quick checking
cat > "$LOG_DIR/last-backup-status.json" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "hostname": "$HOSTNAME",
  "exit_code": $EXIT_CODE,
  "success": $([ $EXIT_CODE -eq 0 ] && echo true || echo false),
  "log_file": "$LOG_FILE"
}
EOF

exit $EXIT_CODE
```

Make executable: `chmod +x scripts/backup-claude-sessions.sh`

**Task 3: Restore Script (2 hours)**

Create `scripts/restore-claude-sessions.sh`:

```bash
#!/bin/bash
# Restore Claude Code session transcripts from Google Drive
# Usage: ./restore-claude-sessions.sh [--project NAME] [--dry-run]

set -euo pipefail

HOSTNAME=$(hostname)
SOURCE_DIR="gdrive:claude-backups/${HOSTNAME}/.claude/projects"
DEST_DIR="$HOME/.claude/projects"
PROJECT=""
DRY_RUN=""

for arg in "$@"; do
  case $arg in
    --project=*) PROJECT="${arg#*=}" ;;
    --dry-run) DRY_RUN="--dry-run" ;;
  esac
done

# Adjust paths for specific project
if [ -n "$PROJECT" ]; then
  SOURCE_DIR="${SOURCE_DIR}/${PROJECT}"
  DEST_DIR="${DEST_DIR}/${PROJECT}"
  echo "Restoring project: $PROJECT"
else
  echo "Restoring ALL projects"
fi

echo "Source: $SOURCE_DIR"
echo "Destination: $DEST_DIR"

if [ -z "$DRY_RUN" ]; then
  echo ""
  echo "WARNING: This will copy files from Google Drive to local disk."
  echo "Existing local files will NOT be deleted."
  read -p "Continue? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
  fi
fi

rclone copy "$SOURCE_DIR" "$DEST_DIR" \
  --transfers=4 \
  --stats=30s \
  --stats-one-line \
  --log-level=INFO \
  $DRY_RUN

echo "Restore completed."
```

Make executable: `chmod +x scripts/restore-claude-sessions.sh`

**Task 4: Systemd Timer (2 hours)**

Create `scripts/systemd/claude-backup.service`:
```ini
[Unit]
Description=Backup Claude Code sessions to Google Drive
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=%h/sv/supervisor-service-s/scripts/backup-claude-sessions.sh
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
```

Create `scripts/systemd/claude-backup.timer`:
```ini
[Unit]
Description=Daily backup of Claude Code sessions

[Timer]
OnCalendar=*-*-* 03:00:00 UTC
Persistent=true
RandomizedDelaySec=300

[Install]
WantedBy=timers.target
```

Installation script (`scripts/install-backup-timer.sh`):
```bash
#!/bin/bash
set -euo pipefail

SYSTEMD_USER_DIR="$HOME/.config/systemd/user"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

mkdir -p "$SYSTEMD_USER_DIR"

cp "$SCRIPT_DIR/systemd/claude-backup.service" "$SYSTEMD_USER_DIR/"
cp "$SCRIPT_DIR/systemd/claude-backup.timer" "$SYSTEMD_USER_DIR/"

systemctl --user daemon-reload
systemctl --user enable claude-backup.timer
systemctl --user start claude-backup.timer

echo "Backup timer installed and started."
echo "Status: systemctl --user status claude-backup.timer"
echo "Logs: journalctl --user -u claude-backup.service"
```

**Task 5: Retention Policy Script (2 hours)**

Create `scripts/cleanup-old-sessions.sh`:

```bash
#!/bin/bash
# Clean up local Claude sessions older than retention period
# Only deletes local files that are confirmed to exist on Drive
# Usage: ./cleanup-old-sessions.sh [--days=7] [--dry-run]

set -euo pipefail

RETENTION_DAYS=7
DRY_RUN=""
HOSTNAME=$(hostname)
SOURCE_DIR="$HOME/.claude/projects"
REMOTE_DIR="gdrive:claude-backups/${HOSTNAME}/.claude/projects"
DELETED=0
SKIPPED=0

for arg in "$@"; do
  case $arg in
    --days=*) RETENTION_DAYS="${arg#*=}" ;;
    --dry-run) DRY_RUN="true" ;;
  esac
done

echo "Retention: $RETENTION_DAYS days"
echo "Source: $SOURCE_DIR"
echo "Checking against: $REMOTE_DIR"

# Find local files older than retention period
find "$SOURCE_DIR" -name "*.jsonl" -mtime +"$RETENTION_DAYS" | while read -r local_file; do
  # Get relative path
  rel_path="${local_file#$SOURCE_DIR/}"

  # Check if file exists on Drive
  if rclone ls "${REMOTE_DIR}/${rel_path}" &>/dev/null; then
    if [ -n "$DRY_RUN" ]; then
      echo "WOULD DELETE: $local_file"
    else
      rm "$local_file"
      echo "DELETED: $local_file"
    fi
    ((DELETED++))
  else
    echo "SKIPPED (not on Drive): $local_file"
    ((SKIPPED++))
  fi
done

echo ""
echo "Deleted: $DELETED files"
echo "Skipped: $SKIPPED files"
```

**Task 6: Status Check MCP Tool (2 hours)**

Add to `src/mcp/tools/session-tools.ts` or create `src/mcp/tools/backup-tools.ts`:

`mcp_meta_check_backup_status`:
- Input: `{}` (no required params)
- Reads `~/.claude/backup-logs/last-backup-status.json`
- Returns:
  ```typescript
  {
    success: true,
    last_backup: {
      timestamp: string,
      success: boolean,
      exit_code: number,
      log_file: string,
      age_hours: number,
    },
    warning: string | null,  // "Last successful backup was 72 hours ago"
    local_stats: {
      total_size_human: string,
      session_count: number,
      oldest_session_days: number,
    }
  }
  ```
- Warns if last successful backup >48 hours ago

**Task 7: Documentation (1 hour)**

Create `docs/backup-setup.md`:
- Prerequisites (rclone, Google Drive access)
- One-time setup steps
- Verification commands
- Restore procedure
- Troubleshooting
- Monitoring commands

### Estimated Effort

- Task 1 (rclone Setup): 2 hours
- Task 2 (Backup Script): 3 hours
- Task 3 (Restore Script): 2 hours
- Task 4 (Systemd Timer): 2 hours
- Task 5 (Retention Script): 2 hours
- Task 6 (Status MCP Tool): 2 hours
- Task 7 (Documentation): 1 hour
- **Total**: 14 hours

---

## Acceptance Criteria

**Feature-Level Acceptance:**

- [ ] AC1: rclone configured and can access Google Drive
- [ ] AC2: Backup script syncs `~/.claude/projects/` to Drive successfully
- [ ] AC3: Backup log written with timestamp, file count, size, duration
- [ ] AC4: Systemd timer fires daily at 03:00 UTC
- [ ] AC5: Restore script can recover sessions from Drive
- [ ] AC6: Restore --dry-run shows what would be restored without changes
- [ ] AC7: Retention cleanup only deletes files confirmed on Drive
- [ ] AC8: Status tool reports last backup time and success/failure
- [ ] AC9: No impact on active Claude Code sessions during backup

**Operational:**

- [ ] Backup script handles missing rclone gracefully
- [ ] Backup script handles network failures gracefully
- [ ] Restore script requires confirmation before overwriting
- [ ] Documentation covers setup, verification, and troubleshooting

---

## Dependencies

**Blocked By:**
- None (independent)

**Blocks:**
- None

**External Dependencies:**
- rclone (install: `sudo apt install rclone` or `brew install rclone`)
- Google Drive account (odin@153.se)
- systemd (for timer scheduling, Linux only)

---

## Files Created

| File | Description |
|------|-------------|
| `scripts/backup-claude-sessions.sh` | Main backup script |
| `scripts/restore-claude-sessions.sh` | Restore from Drive |
| `scripts/cleanup-old-sessions.sh` | Local retention cleanup |
| `scripts/install-backup-timer.sh` | Install systemd timer |
| `scripts/systemd/claude-backup.service` | Systemd service unit |
| `scripts/systemd/claude-backup.timer` | Systemd timer unit |
| `src/mcp/tools/backup-tools.ts` | Backup status MCP tool |
| `docs/backup-setup.md` | Setup and operation documentation |

---

## Risks & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Google Drive quota exceeded** | Low | Medium | Monitor usage; 15GB free tier; compress old sessions |
| **rclone OAuth token expires** | Medium | Medium | Document re-auth steps; check before backup; alert on auth failure |
| **Backup runs during active session** | High (daily) | Low | rclone handles concurrent reads safely; no file locking needed |
| **Network failure during backup** | Medium | Low | rclone retries by default; partial sync resumes next run |
| **Accidental cleanup deletes needed files** | Low | High | Require Drive verification before delete; --dry-run default; confirmation prompt |
| **systemd not available (macOS)** | Medium | Low | Document launchd alternative for macOS; script still works manually |

---

**Specification Version**: 1.0
**Last Updated**: 2026-02-04
**Maintained by**: Meta-Supervisor (MS)
**Status**: Ready for Implementation
