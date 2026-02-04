# Claude Code Backup Setup and Operation

**Epic**: 009-D - Backup Automation
**Created**: 2026-02-04
**Status**: Implementation Complete

---

## Overview

This document describes the Claude Code session backup system, which automatically backs up Claude Code session transcripts (~/.claude/projects/) to Google Drive using rclone. The system implements:

- **Automated daily backups** via systemd timer (03:00 UTC)
- **Incremental sync** (only changed files uploaded)
- **Bandwidth limiting** (10 Mbps to avoid connection saturation)
- **7-day hot local retention** with older sessions archived to Drive
- **Restore capability** with optional dry-run preview
- **Status monitoring** via MCP tool

---

## Prerequisites

### Software

- **rclone** (v1.60+) - Remote sync tool
  ```bash
  sudo apt install rclone
  # or: brew install rclone (macOS)
  # or: choco install rclone (Windows)
  ```

- **systemd** (Linux only) - For automated scheduling
  - Not available on macOS (use `launchd` instead - manual setup)

### Accounts

- **Google Drive access** configured via odin@153.se
- Read/write permissions on `gdrive:` remote

---

## One-Time Setup

### Step 1: Verify rclone Installation

```bash
rclone version
# Output should show v1.60+
```

### Step 2: Configure Google Drive Remote (if not already done)

If you haven't configured rclone for Google Drive:

```bash
rclone config

# Interactive prompts:
# 1. Select 'New remote' (n)
# 2. Name: gdrive
# 3. Type: Google Drive (18 or similar)
# 4. Leave client ID/secret blank (use default)
# 5. Scope: Full access (1 or leave default)
# 6. Service account file: Leave blank
# 7. Edit config: No
# 8. Authorize: Yes (opens browser)
# 9. Login with odin@153.se
# 10. Approve access
```

### Step 3: Verify Access

```bash
rclone lsd gdrive:
# Should list directories on Google Drive
```

### Step 4: Create Backup Directory

```bash
rclone mkdir gdrive:claude-backups/$(hostname)
# Creates: gdrive:claude-backups/{your-machine-name}/
```

### Step 5: Install Systemd Timer (Linux only)

```bash
~/sv/supervisor-service-s/scripts/install-backup-timer.sh
```

This will:
- Copy service and timer files to `~/.config/systemd/user/`
- Enable the timer for auto-start at boot
- Start the timer immediately

### Step 6: Verify Installation

```bash
# Check timer status
systemctl --user status claude-backup.timer

# View next scheduled run
systemctl --user list-timers claude-backup.timer

# View logs
journalctl --user -u claude-backup.service -f
```

---

## Manual Backup

To run a backup manually:

```bash
~/sv/supervisor-service-s/scripts/backup-claude-sessions.sh
```

### Backup Script Options

```bash
# Dry-run (preview changes without uploading)
~/sv/supervisor-service-s/scripts/backup-claude-sessions.sh --dry-run

# Verbose output
~/sv/supervisor-service-s/scripts/backup-claude-sessions.sh --verbose

# Both
~/sv/supervisor-service-s/scripts/backup-claude-sessions.sh --dry-run --verbose
```

### Output

The script logs to `~/.claude/backup-logs/backup-{date}-{time}.log`

```
=== Backup Started ===
Timestamp: 2026-02-04T12:34:56Z
Source: /home/user/.claude/projects
Destination: gdrive:claude-backups/my-machine/.claude/projects
Pre-backup stats:
  Total size: 2.5G
  Total files: 1563

=== Backup Completed ===
End timestamp: 2026-02-04T12:45:30Z
Exit code: 0
Status: SUCCESS
```

### Exit Codes

| Code | Meaning | Action |
|------|---------|--------|
| 0 | Success | All files synced |
| 1 | Partial failure | Some files synced, some failed |
| 2 | Complete failure | Backup failed, check errors |

---

## Restore from Backup

### Restore All Projects

```bash
~/sv/supervisor-service-s/scripts/restore-claude-sessions.sh
```

This will:
1. Show source and destination directories
2. Display a confirmation prompt (requires "yes" to confirm)
3. Copy all projects from Drive to local disk
4. Preserve existing local files

### Restore Specific Project

```bash
~/sv/supervisor-service-s/scripts/restore-claude-sessions.sh --project=consilio
```

This restores only the `consilio` project directory.

### Dry-Run (Preview)

```bash
~/sv/supervisor-service-s/scripts/restore-claude-sessions.sh --dry-run
```

Shows what would be restored without making changes.

### Important Notes

- **Non-destructive**: Existing local files are NOT deleted
- **Overwrites**: Files with same name from Drive will overwrite local copies
- **New files**: Backup files not on local disk will be copied
- **Confirmation required**: Non-dry-run requires explicit confirmation

---

## Local Retention Policy

The cleanup script manages local disk space by deleting old sessions that have been backed up to Drive:

```bash
# Preview deletions (7-day retention)
~/sv/supervisor-service-s/scripts/cleanup-old-sessions.sh --dry-run

# Actually delete files >7 days old
~/sv/supervisor-service-s/scripts/cleanup-old-sessions.sh

# Custom retention (keep 14 days)
~/sv/supervisor-service-s/scripts/cleanup-old-sessions.sh --days=14
```

### Safety

- Only deletes files **confirmed to exist on Drive**
- Always run with `--dry-run` first to preview
- If a file is missing from Drive, it's preserved locally
- Use before rclone cleanup to ensure Drive has files

---

## Check Backup Status

### Via MCP Tool

```bash
# Using mcp-cli-assistant or Claude Code
mcp_meta_check_backup_status
```

Returns:
```json
{
  "success": true,
  "last_backup": {
    "timestamp": "2026-02-04T03:00:15Z",
    "success": true,
    "exit_code": 0,
    "age_hours": 9,
    "age_human": "9h ago"
  },
  "warning": null,
  "local_stats": {
    "total_size_human": "2.5 GB",
    "session_count": 1563,
    "oldest_session_days": 45,
    "newest_session_days": 0
  }
}
```

### Via Status File

```bash
cat ~/.claude/backup-logs/last-backup-status.json
```

### Via Logs

```bash
# Latest backup log
tail -f ~/.claude/backup-logs/backup-*.log

# All backups
ls ~/.claude/backup-logs/
```

---

## Troubleshooting

### "rclone cannot access Google Drive"

**Problem**: Script fails with "rclone cannot access Google Drive"

**Solution**:
```bash
# Re-authenticate
rclone config reconnect gdrive

# Verify access
rclone ls gdrive:

# Check token expiration
rclone ls gdrive: --verbose 2>&1 | grep -i token
```

### "No space left on device"

**Problem**: Backup fails due to disk full

**Solution**:
```bash
# Check disk usage
df -h ~/.claude/

# Delete old local sessions
~/sv/supervisor-service-s/scripts/cleanup-old-sessions.sh --dry-run
~/sv/supervisor-service-s/scripts/cleanup-old-sessions.sh  # Confirm

# Verify backup on Drive before cleanup
rclone lsd gdrive:claude-backups/$(hostname)/.claude/projects/
```

### Backup runs during active Claude Code session

**Problem**: Concerned about file locks during backup

**Solution**: This is safe
- rclone only reads files (doesn't write locally)
- Claude Code session files are not locked during normal use
- Backup runs at 03:00 UTC (typically off-peak)
- If race condition occurs, rclone retries next sync

### systemd timer not running (Linux)

**Problem**: `systemctl --user status claude-backup.timer` shows "inactive"

**Solution**:
```bash
# Enable the timer
systemctl --user enable claude-backup.timer

# Start it
systemctl --user start claude-backup.timer

# Verify
systemctl --user status claude-backup.timer
systemctl --user list-timers claude-backup.timer
```

### Backup is >48 hours old

**Problem**: MCP tool shows warning "Last backup >48 hours old"

**Solution**:
```bash
# Check logs for failures
tail -20 ~/.claude/backup-logs/backup-*.log

# Run manual backup
~/sv/supervisor-service-s/scripts/backup-claude-sessions.sh --verbose

# If failing, check:
rclone ls gdrive:  # Google Drive access
df -h ~/.claude/   # Local disk space
free -h            # RAM availability
```

### macOS (no systemd)

**Problem**: systemd not available on macOS

**Solutions**:
1. Run backup manually: `~/sv/supervisor-service-s/scripts/backup-claude-sessions.sh`
2. Set up with `launchd` (manual setup required)
3. Use cron: `0 3 * * * /home/user/sv/supervisor-service-s/scripts/backup-claude-sessions.sh`

---

## Monitoring

### Daily Check

```bash
# Every morning, check backup status
systemctl --user status claude-backup.timer
mcp_meta_check_backup_status  # Via Claude Code

# If warning, investigate logs
journalctl --user -u claude-backup.service | tail -30
```

### Weekly Audit

```bash
# Verify Drive has recent backups
rclone ls gdrive:claude-backups/$(hostname)/ --max-depth 1

# Check local session count
find ~/.claude/projects -type f -name "*.jsonl" | wc -l

# Compare to stats in status
cat ~/.claude/backup-logs/last-backup-status.json
```

### Monthly Verification

```bash
# Test restore procedure (dry-run)
~/sv/supervisor-service-s/scripts/restore-claude-sessions.sh --dry-run

# Check disk usage trend
du -sh ~/.claude/projects
du -sh gdrive:claude-backups/$(hostname)/.claude/projects 2>/dev/null || echo "Use rclone size"

# Test cleanup logic (dry-run)
~/sv/supervisor-service-s/scripts/cleanup-old-sessions.sh --dry-run
```

---

## Disk Space Estimates

| Item | Size | Notes |
|------|------|-------|
| Current sessions (~7 days) | ~1.6 GB | Hot local retention |
| Archived sessions (~30 days) | ~6.9 GB | On Drive only (freed locally) |
| Backup logs (~1 year) | ~50 MB | Rotated monthly |
| **Total local** | ~1.6 GB | After 7-day cleanup |
| **Total on Drive** | ~8.5 GB | Within 15 GB free tier |

---

## Backup Flow Diagram

```
~/.claude/projects/ (local, 2.5GB)
    |
    v
[backup script]
    |
    +-- Check: Source exists?
    |
    +-- Check: rclone available?
    |
    +-- Check: Google Drive accessible?
    |
    v
rclone sync (incremental)
    |
    +-- Filters: *.lock, *.tmp, *.swp (excluded)
    |
    +-- Bandwidth: 10 Mbps limit
    |
    +-- Transfers: 4 concurrent
    |
    v
gdrive:claude-backups/{hostname}/.claude/projects/
    |
    v
[Log result]
    |
    +-- Write: ~/.claude/backup-logs/backup-{date}.log
    |
    +-- Write: ~/.claude/backup-logs/last-backup-status.json
    |
    v
[Local cleanup] (optional, separate cron/manual)
    |
    +-- Find: Files > 7 days old
    |
    +-- Verify: Exists on Drive
    |
    +-- Delete: Only if confirmed on Drive
    |
    v
~/.claude/projects/ (cleaned up, ~1.6GB)
```

---

## Architecture

### Services and Timers

**Linux (systemd)**:
- Service: `~/.config/systemd/user/claude-backup.service`
- Timer: `~/.config/systemd/user/claude-backup.timer`
- Schedule: Daily 03:00 UTC + 5min random delay
- User-level (non-privileged execution)

**macOS (alternative)**:
- Cron job (see Troubleshooting)
- Or manual execution via scripts

### Storage

| Location | Purpose |
|----------|---------|
| `~/.claude/projects/` | Local session data |
| `gdrive:claude-backups/{hostname}/` | Google Drive backup |
| `~/.claude/backup-logs/` | Backup logs and status |

### Network

- **Source**: Local filesystem
- **Destination**: Google Drive (via rclone/OAuth)
- **Bandwidth limit**: 10 Mbps (user-configurable)
- **Concurrent transfers**: 4 (user-configurable)

---

## Related Documentation

- **Epic 009-A**: Claude Session Reference (instance tracking)
- **Epic 009-B**: Session Snippets and Context (extraction)
- **Epic 009-C**: Transcript Lookup Tools (retrieval)
- **Epic 009-D**: Backup Automation (this document)

---

## Support

For issues:

1. Check logs: `~/.claude/backup-logs/backup-*.log`
2. Check MCP status: `mcp_meta_check_backup_status`
3. Run manual test: `~/sv/supervisor-service-s/scripts/backup-claude-sessions.sh --verbose`
4. Check rclone: `rclone ls gdrive: --verbose`

---

**Last Updated**: 2026-02-04
**Maintained by**: Meta-Supervisor (MS)
**Epic**: 009-D (Backup Automation)
