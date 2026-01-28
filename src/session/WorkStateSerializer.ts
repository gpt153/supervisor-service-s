/**
 * Work State Serializer (Epic 007-D)
 * Serializes current work state for checkpoint creation
 *
 * Captures:
 * - Current epic and status
 * - Files modified (paths + line counts)
 * - Git status (branch, staged/unstaged, commits)
 * - Last N commands from command log
 * - PRD status and version
 * - Environment info
 *
 * Performance target: <100ms serialization
 */

import { execSync } from 'child_process';
import { getCommandLogger } from './CommandLogger.js';
import { getInstanceDetails } from './InstanceRegistry.js';
import {
  WorkState,
  FileModificationRecord,
  GitStatusSnapshot,
  CommandSummary,
  EpicStatusRecord,
  PRDStatusSnapshot,
  WorkEnvironment,
} from '../types/checkpoint.js';

/**
 * Work State Serializer
 */
export class WorkStateSerializer {
  /**
   * Serialize current work state
   * @param instanceId Instance ID for context
   * @param currentEpic Optional current epic data
   * @param workingDir Working directory (default: cwd)
   * @returns Serialized work state
   */
  async serialize(
    instanceId: string,
    currentEpic?: Partial<EpicStatusRecord>,
    workingDir?: string
  ): Promise<WorkState> {
    const start = Date.now();

    try {
      const instance = await getInstanceDetails(instanceId);
      if (!instance) {
        throw new Error(`Instance not found: ${instanceId}`);
      }

      const cwd = workingDir || process.cwd();

      // Parallel serialization of independent components
      const [
        git_status,
        last_commands,
        files_modified,
        prd_status,
        environment,
      ] = await Promise.all([
        this.serializeGitStatus(cwd),
        this.serializeLastCommands(instanceId),
        this.serializeFilesModified(cwd),
        this.serializePRDStatus(cwd),
        this.serializeEnvironment(instance.project, cwd),
      ]);

      // Build work state
      const workState: WorkState = {
        current_epic: currentEpic
          ? {
              epic_id: currentEpic.epic_id || 'unknown',
              feature_name: currentEpic.feature_name,
              status: currentEpic.status || 'implementation',
              duration_hours: currentEpic.duration_hours,
              test_results: currentEpic.test_results,
            }
          : null,
        files_modified,
        git_status,
        last_commands,
        prd_status,
        environment,
        pending_tasks: [],
        important_context: [],
        snapshot_at: new Date().toISOString(),
      };

      const duration = Date.now() - start;

      if (duration > 100) {
        console.warn(`WorkStateSerializer.serialize slow: ${duration}ms`);
      }

      return workState;
    } catch (error) {
      console.error('Failed to serialize work state:', error);
      throw error;
    }
  }

  /**
   * Serialize git status
   */
  private async serializeGitStatus(cwd: string): Promise<GitStatusSnapshot> {
    try {
      // Check if we're in a git repo
      const isGit = this.isGitRepo(cwd);

      if (!isGit) {
        return {
          branch: 'unknown',
          staged_files: 0,
          unstaged_files: 0,
          untracked_files: 0,
          commit_count: 0,
        };
      }

      // Get branch name
      let branch = 'unknown';
      try {
        branch = execSync('git rev-parse --abbrev-ref HEAD', {
          cwd,
          encoding: 'utf-8',
        }).trim();
      } catch {
        // Use default
      }

      // Get status counts
      let staged_files = 0;
      let unstaged_files = 0;
      let untracked_files = 0;

      try {
        const status = execSync('git status --porcelain', {
          cwd,
          encoding: 'utf-8',
        });

        const lines = status.split('\n').filter((line) => line.trim());
        for (const line of lines) {
          const status_char = line.charAt(0);
          if (status_char === 'A' || status_char === 'M' || status_char === 'D') {
            staged_files++;
          } else if (status_char === 'M' || status_char === 'D') {
            unstaged_files++;
          } else if (status_char === '?') {
            untracked_files++;
          } else {
            unstaged_files++;
          }
        }
      } catch {
        // Use defaults
      }

      // Get commit count
      let commit_count = 0;
      try {
        const count = execSync('git rev-list --count HEAD', {
          cwd,
          encoding: 'utf-8',
        }).trim();
        commit_count = parseInt(count, 10) || 0;
      } catch {
        // Use default
      }

      return {
        branch,
        staged_files,
        unstaged_files,
        untracked_files,
        commit_count,
      };
    } catch (error) {
      console.warn('Failed to serialize git status:', error);
      return {
        branch: 'unknown',
        staged_files: 0,
        unstaged_files: 0,
        untracked_files: 0,
        commit_count: 0,
      };
    }
  }

  /**
   * Get last N commands from command log
   */
  private async serializeLastCommands(instanceId: string): Promise<CommandSummary[]> {
    try {
      const logger = getCommandLogger();
      const result = await logger.searchCommands({
        instance_id: instanceId,
        limit: 20,
        offset: 0,
      });

      return result.commands
        .reverse() // Most recent first
        .slice(0, 20)
        .map((cmd) => ({
          command_id: `cmd_${cmd.id}`,
          type: cmd.tool_name || 'unknown',
          action: cmd.action,
          target: cmd.parameters?.target,
          timestamp: cmd.timestamp,
        }));
    } catch (error) {
      console.warn('Failed to serialize last commands:', error);
      return [];
    }
  }

  /**
   * Serialize files modified (git-based)
   */
  private async serializeFilesModified(cwd: string): Promise<FileModificationRecord[]> {
    try {
      if (!this.isGitRepo(cwd)) {
        return [];
      }

      const files: FileModificationRecord[] = [];

      try {
        // Get git diff --name-status (shows file status)
        const diffOutput = execSync('git diff --name-status', {
          cwd,
          encoding: 'utf-8',
        });

        for (const line of diffOutput.split('\n').filter((l) => l.trim())) {
          const [statusChar, filePath] = line.split('\t');
          let status: 'modified' | 'added' | 'deleted' = 'modified';

          if (statusChar === 'A') status = 'added';
          else if (statusChar === 'D') status = 'deleted';
          else status = 'modified';

          // Try to get line count
          let lines_changed = 0;
          try {
            const diff = execSync(`git diff -- "${filePath}"`, {
              cwd,
              encoding: 'utf-8',
            });
            const addedLines = (diff.match(/^\+/gm) || []).length;
            const removedLines = (diff.match(/^\-/gm) || []).length;
            lines_changed = Math.abs(addedLines - removedLines);
          } catch {
            lines_changed = 0;
          }

          files.push({
            path: filePath,
            status,
            lines_changed,
            last_modified: new Date().toISOString(),
          });
        }
      } catch {
        // Use empty list
      }

      return files.slice(0, 50); // Cap at 50 files
    } catch (error) {
      console.warn('Failed to serialize files modified:', error);
      return [];
    }
  }

  /**
   * Serialize PRD status (stub for now)
   */
  private async serializePRDStatus(cwd: string): Promise<PRDStatusSnapshot> {
    try {
      // In production, this would read PRD file from .bmad/features/*/prd.md
      return {
        version: '1.0.0',
        status_summary: 'In progress',
      };
    } catch (error) {
      console.warn('Failed to serialize PRD status:', error);
      return {};
    }
  }

  /**
   * Serialize environment info
   */
  private async serializeEnvironment(project: string, cwd: string): Promise<WorkEnvironment> {
    try {
      const os = require('os');
      return {
        project,
        working_directory: cwd,
        hostname: os.hostname(),
      };
    } catch (error) {
      console.warn('Failed to serialize environment:', error);
      return {
        project,
        working_directory: cwd,
        hostname: 'unknown',
      };
    }
  }

  /**
   * Check if directory is a git repository
   */
  private isGitRepo(cwd: string): boolean {
    try {
      execSync('git rev-parse --git-dir', {
        cwd,
        encoding: 'utf-8',
      });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Global instance (singleton)
 */
let globalSerializer: WorkStateSerializer | null = null;

/**
 * Get or create the global work state serializer
 */
export function getWorkStateSerializer(): WorkStateSerializer {
  if (!globalSerializer) {
    globalSerializer = new WorkStateSerializer();
  }
  return globalSerializer;
}

/**
 * Reset the global instance (for testing)
 */
export function resetWorkStateSerializer(): void {
  globalSerializer = null;
}
