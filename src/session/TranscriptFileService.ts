/**
 * Transcript File Service
 * Epic 009-C: Transcript Lookup Tools
 *
 * Provides file system operations for Claude Code transcript files (.jsonl)
 * including metadata retrieval, head/tail reading, and project session discovery.
 */

import { promises as fs } from 'fs';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import path from 'path';
import os from 'os';
import { ParsedTranscriptLine } from '../types/transcript.js';

/**
 * Service for reading and inspecting Claude Code transcript files
 */
export class TranscriptFileService {
  private claudeProjectsDir: string;
  private homeDir: string;

  /**
   * Machine home directory mapping
   * Maps machine hostnames to their home directories
   */
  private machineHomeMap: Record<string, string> = {
    'odin3': '/home/samuel',
    'gcp-odin3-vm': '/home/samuel',
    'odin4': '/home/samuel',
    'laptop': '/Users/samuel',
  };

  constructor() {
    this.homeDir = process.env.HOME || '/home/samuel';
    this.claudeProjectsDir = path.join(this.homeDir, '.claude', 'projects');
  }

  /**
   * Get metadata for a transcript file
   * @param filePath - Full path to the transcript file
   * @returns File metadata including size, modification time, and approximate line count
   */
  async getFileMetadata(filePath: string): Promise<{
    exists: boolean;
    size_bytes: number;
    size_human: string;
    modified_at: Date;
    line_count: number;
  }> {
    try {
      const stat = await fs.stat(filePath);

      // Approximate line count from file size (avg ~700 bytes/line)
      const lineCount = Math.ceil(stat.size / 700);

      return {
        exists: true,
        size_bytes: stat.size,
        size_human: this.formatSize(stat.size),
        modified_at: stat.mtime,
        line_count: lineCount,
      };
    } catch (error) {
      // File doesn't exist or can't be read
      return {
        exists: false,
        size_bytes: 0,
        size_human: '0 B',
        modified_at: new Date(),
        line_count: 0,
      };
    }
  }

  /**
   * Read first N and last N lines from a JSONL file
   * Uses streaming for efficiency with large files
   *
   * @param filePath - Path to JSONL file
   * @param headLines - Number of lines to read from start
   * @param tailLines - Number of lines to read from end
   * @returns Head lines, tail lines, and total line count
   */
  async readHeadTail(
    filePath: string,
    headLines: number,
    tailLines: number
  ): Promise<{
    head: ParsedTranscriptLine[];
    tail: ParsedTranscriptLine[];
    total_lines: number;
  }> {
    const head: ParsedTranscriptLine[] = [];
    const tail: ParsedTranscriptLine[] = [];
    let lineNumber = 0;
    let totalLines = 0;

    try {
      // First pass: read all lines and collect head/tail
      const readStream = createReadStream(filePath, { encoding: 'utf-8' });
      const rl = createInterface({
        input: readStream,
        crlfDelay: Infinity,
      });

      for await (const line of rl) {
        if (!line.trim()) {
          continue; // Skip empty lines
        }

        lineNumber++;
        totalLines++;

        try {
          const parsed = this.parseTranscriptLine(line, lineNumber);

          // Collect head lines
          if (head.length < headLines) {
            head.push(parsed);
          }

          // Always keep last N lines in a rolling buffer
          if (tail.length < tailLines) {
            tail.push(parsed);
          } else {
            // Remove first, add new
            tail.shift();
            tail.push(parsed);
          }
        } catch (parseError) {
          // Skip malformed JSONL lines
          console.debug(`Skipping malformed JSONL line ${lineNumber}: ${(parseError as Error).message}`);
        }
      }

      return { head, tail, total_lines: totalLines };
    } catch (error) {
      console.warn(`Error reading transcript ${filePath}: ${(error as Error).message}`);
      return { head: [], tail: [], total_lines: 0 };
    }
  }

  /**
   * Parse a single JSONL line from transcript
   * Extracts role, type, and content preview
   *
   * @param line - Raw JSONL line
   * @param lineNumber - Line number for reference
   * @returns Parsed transcript line
   */
  private parseTranscriptLine(line: string, lineNumber: number): ParsedTranscriptLine {
    const obj = JSON.parse(line);

    // Determine role and type from message structure
    let role = 'unknown';
    let type = 'message';
    let content = '';
    let timestamp: string | undefined;

    if (obj.role) {
      role = obj.role; // user, assistant, system
    }

    if (obj.type) {
      type = obj.type; // message, tool_call, tool_result
    }

    // Extract content based on message type
    if (obj.content) {
      content = typeof obj.content === 'string' ? obj.content : JSON.stringify(obj.content);
    } else if (obj.text) {
      content = obj.text;
    } else if (obj.message) {
      content = typeof obj.message === 'string' ? obj.message : JSON.stringify(obj.message);
    }

    // Extract timestamp if available
    if (obj.timestamp) {
      timestamp = obj.timestamp;
    } else if (obj.created_at) {
      timestamp = obj.created_at;
    }

    // Create preview (first 200 chars)
    const preview = content.substring(0, 200);

    return {
      line: lineNumber,
      role,
      type,
      content_preview: preview,
      timestamp,
    };
  }

  /**
   * List all .jsonl session files for a project
   * Scans the project directory and returns metadata for each session file
   *
   * @param project - Project name
   * @returns Array of session file information
   */
  async listProjectSessions(project: string): Promise<Array<{
    filename: string;
    uuid: string;
    path: string;
    size_bytes: number;
    size_human: string;
    modified_at: Date;
  }>> {
    const projectDir = path.join(this.claudeProjectsDir, project);

    try {
      // Check if project directory exists
      await fs.access(projectDir);
    } catch {
      // Directory doesn't exist
      return [];
    }

    const sessions: Array<{
      filename: string;
      uuid: string;
      path: string;
      size_bytes: number;
      size_human: string;
      modified_at: Date;
    }> = [];

    try {
      const files = await fs.readdir(projectDir);

      for (const file of files) {
        // Only process .jsonl files
        if (!file.endsWith('.jsonl')) {
          continue;
        }

        const filePath = path.join(projectDir, file);

        try {
          const stat = await fs.stat(filePath);

          // Extract UUID from filename (e.g., "abc123-def456.jsonl" -> "abc123-def456")
          const uuid = file.replace('.jsonl', '');

          sessions.push({
            filename: file,
            uuid,
            path: filePath,
            size_bytes: stat.size,
            size_human: this.formatSize(stat.size),
            modified_at: stat.mtime,
          });
        } catch (error) {
          console.warn(`Error reading file metadata for ${file}: ${(error as Error).message}`);
        }
      }

      // Sort by modification time (newest first)
      sessions.sort((a, b) => b.modified_at.getTime() - a.modified_at.getTime());

      return sessions;
    } catch (error) {
      console.warn(`Error listing project sessions for ${project}: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * Resolve the path to a Claude session file
   * Constructs standard path from project and UUID
   *
   * @param project - Project name
   * @param uuid - Session UUID
   * @returns Full path to transcript file
   */
  resolvePath(project: string, uuid: string): string {
    return path.join(this.claudeProjectsDir, project, `${uuid}.jsonl`);
  }

  /**
   * Format bytes to human-readable string
   * @param bytes - Number of bytes
   * @returns Formatted size string (e.g., "1.2 MB")
   */
  formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const unitIndex = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = bytes / Math.pow(1024, unitIndex);

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Get current machine hostname
   * @returns Machine hostname
   */
  getCurrentMachine(): string {
    return os.hostname();
  }

  /**
   * Get home directory for a specific machine
   * @param machine - Machine hostname
   * @returns Home directory path
   */
  getHomeForMachine(machine: string): string {
    return this.machineHomeMap[machine] || '/home/samuel';
  }

  /**
   * Check if a path might be on another machine
   * Returns machine names that might have the file
   *
   * @param filePath - Path to check
   * @returns Array of possible machine names
   */
  getPossibleMachines(filePath: string): string[] {
    const possible: string[] = [];

    // Extract project name from path
    const pathParts = filePath.split('/');
    const projectIndex = pathParts.indexOf('.claude');

    if (projectIndex === -1) {
      return [];
    }

    // Try each machine
    for (const [machine, homeDir] of Object.entries(this.machineHomeMap)) {
      const alternativePath = filePath.replace(this.homeDir, homeDir);
      // Don't suggest the current machine
      if (machine !== this.getCurrentMachine()) {
        possible.push(machine);
      }
    }

    return possible;
  }
}

/**
 * Global instance (singleton)
 */
let globalInstance: TranscriptFileService | null = null;

/**
 * Get or create the global transcript file service
 * @returns TranscriptFileService instance
 */
export function getTranscriptFileService(): TranscriptFileService {
  if (!globalInstance) {
    globalInstance = new TranscriptFileService();
  }
  return globalInstance;
}

/**
 * Reset the global instance (for testing)
 */
export function resetTranscriptFileService(): void {
  globalInstance = null;
}
