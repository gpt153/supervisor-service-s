/**
 * Backup Automation MCP Tools (Epic 009-D)
 * Provides MCP tools for Claude Code session backup management
 *
 * Epic 009-D (Backup Automation):
 * - mcp_meta_check_backup_status: Check last backup status and local stats
 */

import { readFileSync, statSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { ToolDefinition, ProjectContext } from '../../types/project.js';

interface BackupStatus {
  timestamp: string;
  hostname: string;
  exit_code: number;
  success: boolean;
  log_file: string;
  source_dir: string;
  dest_dir: string;
}

interface LocalStats {
  total_size_bytes: number;
  total_size_human: string;
  session_count: number;
  oldest_session_days: number;
  newest_session_days: number;
}

interface BackupCheckResult {
  success: boolean;
  last_backup: {
    timestamp: string;
    success: boolean;
    exit_code: number;
    log_file: string;
    age_hours: number;
    age_human: string;
  } | null;
  warning: string | null;
  local_stats: LocalStats | null;
  error?: string;
}

/**
 * Format bytes to human-readable size
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Calculate age in days from timestamp
 */
function getAgeInDays(timestamp: string): number {
  const backupTime = new Date(timestamp).getTime();
  const nowTime = new Date().getTime();
  return Math.floor((nowTime - backupTime) / (1000 * 60 * 60 * 24));
}

/**
 * Calculate age in hours from timestamp
 */
function getAgeInHours(timestamp: string): number {
  const backupTime = new Date(timestamp).getTime();
  const nowTime = new Date().getTime();
  return Math.floor((nowTime - backupTime) / (1000 * 60 * 60));
}

/**
 * Format age in human-readable format
 */
function formatAge(hours: number): string {
  if (hours < 1) {
    const minutes = Math.floor(hours * 60);
    return `${minutes}m ago`;
  } else if (hours < 24) {
    return `${Math.floor(hours)}h ago`;
  } else {
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
}

/**
 * Get directory size recursively
 */
function getDirSize(dir: string): number {
  let size = 0;
  try {
    const files = readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
      const path = join(dir, file.name);
      try {
        if (file.isDirectory()) {
          size += getDirSize(path);
        } else {
          size += statSync(path).size;
        }
      } catch (e) {
        // Skip files we can't access
      }
    }
  } catch (e) {
    // Return 0 if directory doesn't exist or can't be read
  }
  return size;
}

/**
 * Count .jsonl files (session transcripts)
 */
function countSessions(dir: string): number {
  let count = 0;
  try {
    const files = readdirSync(dir, { withFileTypes: true, recursive: true });
    for (const file of files) {
      if (file.isFile() && file.name.endsWith('.jsonl')) {
        count++;
      }
    }
  } catch (e) {
    // Return 0 if directory doesn't exist
  }
  return count;
}

/**
 * Get oldest and newest session age
 */
function getSessionAges(dir: string): { oldest: number; newest: number } {
  let oldestTime = Number.MAX_SAFE_INTEGER;
  let newestTime = 0;
  let found = false;

  try {
    const files = readdirSync(dir, { withFileTypes: true, recursive: true });
    for (const file of files) {
      if (file.isFile() && file.name.endsWith('.jsonl')) {
        try {
          const path = join(dir, file.name);
          const stat = statSync(path);
          const mtime = stat.mtimeMs;
          found = true;

          if (mtime < oldestTime) oldestTime = mtime;
          if (mtime > newestTime) newestTime = mtime;
        } catch (e) {
          // Skip files we can't stat
        }
      }
    }
  } catch (e) {
    // Directory doesn't exist
  }

  const now = Date.now();
  return {
    oldest: found ? Math.floor((now - oldestTime) / (1000 * 60 * 60 * 24)) : 0,
    newest: found ? Math.floor((now - newestTime) / (1000 * 60 * 60 * 24)) : 0,
  };
}

/**
 * Get local backup statistics
 */
function getLocalStats(sourceDir: string): LocalStats | null {
  try {
    const totalSize = getDirSize(sourceDir);
    const sessionCount = countSessions(sourceDir);
    const ages = getSessionAges(sourceDir);

    return {
      total_size_bytes: totalSize,
      total_size_human: formatBytes(totalSize),
      session_count: sessionCount,
      oldest_session_days: ages.oldest,
      newest_session_days: ages.newest,
    };
  } catch (e) {
    return null;
  }
}

/**
 * Tool: mcp_meta_check_backup_status
 * Check last backup status and provide local statistics
 */
export const checkBackupStatusTool: ToolDefinition = {
  name: 'mcp_meta_check_backup_status',
  description:
    'Check backup status and local session statistics. Returns last backup info and warnings if backups are stale.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  handler: async (input: any, context: ProjectContext): Promise<BackupCheckResult> => {
    try {
      const home = homedir();
      const statusFile = join(home, '.claude', 'backup-logs', 'last-backup-status.json');
      const sourceDir = join(home, '.claude', 'projects');

      let lastBackup = null;
      let warning = null;

      // Try to read last backup status
      try {
        const statusContent = readFileSync(statusFile, 'utf-8');
        const status: BackupStatus = JSON.parse(statusContent);

        const ageHours = getAgeInHours(status.timestamp);
        lastBackup = {
          timestamp: status.timestamp,
          success: status.success,
          exit_code: status.exit_code,
          log_file: status.log_file,
          age_hours: ageHours,
          age_human: formatAge(ageHours),
        };

        // Generate warning if backup is stale
        if (!status.success) {
          warning = `Last backup FAILED with exit code ${status.exit_code}`;
        } else if (ageHours > 48) {
          warning = `Last successful backup was ${Math.floor(ageHours / 24)} days ago (>48 hours)`;
        }
      } catch (e) {
        warning = 'No backup status file found (backups may not have run yet)';
      }

      // Get local statistics
      const localStats = getLocalStats(sourceDir);

      return {
        success: true,
        last_backup: lastBackup,
        warning,
        local_stats: localStats,
      };
    } catch (error: any) {
      return {
        success: false,
        last_backup: null,
        warning: null,
        local_stats: null,
        error: error.message || 'Failed to check backup status',
      };
    }
  },
};

/**
 * Export all backup tools
 */
export const backupTools = [checkBackupStatusTool];
