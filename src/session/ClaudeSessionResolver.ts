/**
 * Claude Code Session Path Resolver (Epic 009-A)
 * Utilities for resolving and validating Claude Code session transcript paths
 */

import { promises as fs } from 'fs';
import { homedir } from 'os';

/**
 * Resolve the filesystem path to a Claude Code session transcript
 *
 * Format: ~/.claude/projects/{project}/{uuid}.jsonl
 *
 * @param project Project name (used as directory name under ~/.claude/projects/)
 * @param uuid Claude session UUID
 * @returns Resolved absolute path to the session transcript file
 *
 * @example
 * const path = resolveClaudeSessionPath('odin', 'abc123def456');
 * // Returns: /home/samuel/.claude/projects/odin/abc123def456.jsonl
 */
export function resolveClaudeSessionPath(project: string, uuid: string): string {
  const home = process.env.HOME || homedir();
  return `${home}/.claude/projects/${project}/${uuid}.jsonl`;
}

/**
 * Check if a Claude session transcript file exists
 *
 * @param sessionPath Path to check
 * @returns true if file exists and is readable, false otherwise
 *
 * @example
 * const exists = await claudeSessionExists('/home/samuel/.claude/projects/odin/abc123.jsonl');
 * // Returns: true or false
 */
export async function claudeSessionExists(sessionPath: string): Promise<boolean> {
  try {
    await fs.access(sessionPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get file size of a Claude session transcript
 *
 * @param sessionPath Path to the session file
 * @returns File size in bytes, or null if file doesn't exist
 */
export async function getClaudeSessionSize(sessionPath: string): Promise<number | null> {
  try {
    const stats = await fs.stat(sessionPath);
    return stats.size;
  } catch {
    return null;
  }
}
