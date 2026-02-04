/**
 * Transcript Lookup MCP Tools
 * Epic 009-C: Transcript Lookup Tools
 *
 * Provides three MCP tools for navigating from supervisor sessions to Claude Code transcripts:
 * 1. mcp_meta_find_transcript - Find transcript file by instance_id
 * 2. mcp_meta_list_project_sessions - List all sessions for a project
 * 3. mcp_meta_read_transcript_summary - Read first/last lines of a transcript
 */

import { query as dbQuery } from '../../db/index.js';
import {
  TranscriptFileService,
  getTranscriptFileService,
} from '../../session/TranscriptFileService.js';
import {
  getSanitizationService,
} from '../../session/index.js';
import {
  FindTranscriptOutput,
  ListProjectSessionsOutput,
  ReadTranscriptSummaryOutput,
} from '../../types/transcript.js';
import { ToolDefinition, ProjectContext } from '../../types/project.js';

/**
 * Tool: mcp_meta_find_transcript
 * Find transcript file by instance_id with metadata
 */
export const findTranscriptTool: ToolDefinition = {
  name: 'mcp_meta_find_transcript',
  description:
    'Find Claude Code transcript file by supervisor instance_id. Returns file metadata including path, size, and modification time.',
  inputSchema: {
    type: 'object',
    properties: {
      instance_id: {
        type: 'string',
        description: 'Supervisor instance ID (e.g., "odin-PS-a1b2c3")',
      },
    },
    required: ['instance_id'],
  },
  handler: async (input: any, context: ProjectContext): Promise<FindTranscriptOutput> => {
    const start = Date.now();

    try {
      const transcriptService = getTranscriptFileService();

      // Look up instance in database
      const instanceResult = await dbQuery(
        `SELECT instance_id, claude_session_uuid, claude_session_path
         FROM supervisor_sessions
         WHERE instance_id = $1`,
        [input.instance_id]
      );

      if (instanceResult.rows.length === 0) {
        return {
          success: false,
          instance_id: input.instance_id,
          error: `Instance not found: ${input.instance_id}`,
        };
      }

      const instance = instanceResult.rows[0] as any;

      // Check if Claude session is linked
      if (!instance.claude_session_uuid) {
        return {
          success: false,
          instance_id: input.instance_id,
          error: 'No Claude session linked to this instance. Use mcp_meta_register_instance with claude_session_uuid.',
        };
      }

      // Resolve path (use stored path or construct from UUID)
      let transcriptPath = instance.claude_session_path;
      if (!transcriptPath) {
        // Extract project from instance_id (format: PROJECT-PS/MS-xxxxx)
        const parts = input.instance_id.split('-');
        const project = parts[0];
        transcriptPath = transcriptService.resolvePath(project, instance.claude_session_uuid);
      }

      // Get file metadata
      const metadata = await transcriptService.getFileMetadata(transcriptPath);

      const duration = Date.now() - start;

      return {
        success: true,
        instance_id: input.instance_id,
        claude_session_uuid: instance.claude_session_uuid,
        transcript: {
          path: transcriptPath,
          exists: metadata.exists,
          size_bytes: metadata.size_bytes,
          size_human: metadata.size_human,
          modified_at: metadata.modified_at.toISOString(),
          line_count: metadata.line_count,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        instance_id: input.instance_id,
        error: `Error finding transcript: ${error.message}`,
      };
    }
  },
};

/**
 * Tool: mcp_meta_list_project_sessions
 * List all Claude Code sessions for a project with linked instance info
 */
export const listProjectSessionsTool: ToolDefinition = {
  name: 'mcp_meta_list_project_sessions',
  description:
    'List all Claude Code sessions for a project. Cross-references with supervisor_sessions to show linked instances and status.',
  inputSchema: {
    type: 'object',
    properties: {
      project: {
        type: 'string',
        description: 'Project name (e.g., "consilio", "odin")',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of sessions to return (default: 50)',
        default: 50,
      },
      include_unlinked: {
        type: 'boolean',
        description: 'Include sessions not linked to supervisor instances (default: true)',
        default: true,
      },
    },
    required: ['project'],
  },
  handler: async (input: any, context: ProjectContext): Promise<ListProjectSessionsOutput> => {
    const start = Date.now();

    try {
      const transcriptService = getTranscriptFileService();

      // Get all session files for the project
      const sessionFiles = await transcriptService.listProjectSessions(input.project);

      // Query supervisor_sessions for linked instances
      const linkedResult = await dbQuery(
        `SELECT instance_id, claude_session_uuid, status
         FROM supervisor_sessions
         WHERE project = $1 AND claude_session_uuid IS NOT NULL`,
        [input.project]
      );

      const linkedByUuid = new Map<string, { instance_id: string; status: string }>();
      for (const row of linkedResult.rows as any[]) {
        linkedByUuid.set(row.claude_session_uuid, {
          instance_id: row.instance_id,
          status: row.status,
        });
      }

      // Build output with cross-references
      const sessions = sessionFiles
        .slice(0, input.limit || 50)
        .map((session) => {
          const linked = linkedByUuid.get(session.uuid);
          return {
            filename: session.filename,
            uuid: session.uuid,
            path: session.path,
            size_bytes: session.size_bytes,
            size_human: session.size_human,
            modified_at: session.modified_at.toISOString(),
            linked_instance_id: linked?.instance_id,
            linked_status: linked?.status,
          };
        });

      // Calculate totals
      const totalSize = sessionFiles.reduce((sum, s) => sum + s.size_bytes, 0);
      const linkedCount = sessions.filter((s) => s.linked_instance_id).length;

      const duration = Date.now() - start;

      return {
        success: true,
        project: input.project,
        sessions,
        total_count: sessionFiles.length,
        linked_count: linkedCount,
        total_size_human: transcriptService.formatSize(totalSize),
      };
    } catch (error: any) {
      return {
        success: false,
        project: input.project,
        sessions: [],
        total_count: 0,
        linked_count: 0,
        total_size_human: '0 B',
      };
    }
  },
};

/**
 * Tool: mcp_meta_read_transcript_summary
 * Read first and last N lines from a transcript with sanitization
 */
export const readTranscriptSummaryTool: ToolDefinition = {
  name: 'mcp_meta_read_transcript_summary',
  description:
    'Read first and last N lines from a Claude Code transcript JSONL file. Content is sanitized to remove secrets.',
  inputSchema: {
    type: 'object',
    properties: {
      instance_id: {
        type: 'string',
        description: 'Supervisor instance ID to lookup transcript path',
      },
      path: {
        type: 'string',
        description: 'Direct path to transcript file (alternative to instance_id)',
      },
      head_lines: {
        type: 'number',
        description: 'Number of lines to read from start (default: 5)',
        default: 5,
      },
      tail_lines: {
        type: 'number',
        description: 'Number of lines to read from end (default: 5)',
        default: 5,
      },
    },
  },
  handler: async (input: any, context: ProjectContext): Promise<ReadTranscriptSummaryOutput> => {
    const start = Date.now();

    try {
      const transcriptService = getTranscriptFileService();
      const sanitizer = await getSanitizationService();

      let transcriptPath = input.path;

      // If instance_id provided, resolve path from database
      if (input.instance_id && !transcriptPath) {
        const instanceResult = await dbQuery(
          `SELECT claude_session_path, claude_session_uuid, project
           FROM supervisor_sessions
           WHERE instance_id = $1`,
          [input.instance_id]
        );

        if (instanceResult.rows.length === 0) {
          return {
            success: false,
            path: '',
            total_lines: 0,
            head: [],
            tail: [],
            error: `Instance not found: ${input.instance_id}`,
          };
        }

        const instance = instanceResult.rows[0] as any;

        if (!instance.claude_session_path && !instance.claude_session_uuid) {
          return {
            success: false,
            path: '',
            total_lines: 0,
            head: [],
            tail: [],
            error: 'No Claude session linked to this instance',
          };
        }

        transcriptPath = instance.claude_session_path ||
          transcriptService.resolvePath(instance.project, instance.claude_session_uuid);
      }

      if (!transcriptPath) {
        return {
          success: false,
          path: '',
          total_lines: 0,
          head: [],
          tail: [],
          error: 'No instance_id or path provided',
        };
      }

      // Read head and tail lines
      const headLines = input.head_lines || 5;
      const tailLines = input.tail_lines || 5;

      const { head, tail, total_lines } = await transcriptService.readHeadTail(
        transcriptPath,
        headLines,
        tailLines
      );

      // Sanitize content previews
      const sanitizedHead = await Promise.all(
        head.map(async (line) => ({
          ...line,
          content_preview: await sanitizer.sanitize(line.content_preview),
        }))
      );

      const sanitizedTail = await Promise.all(
        tail.map(async (line) => ({
          ...line,
          content_preview: await sanitizer.sanitize(line.content_preview),
        }))
      );

      const duration = Date.now() - start;

      return {
        success: true,
        path: transcriptPath,
        total_lines,
        head: sanitizedHead,
        tail: sanitizedTail,
      };
    } catch (error: any) {
      return {
        success: false,
        path: input.path || input.instance_id,
        total_lines: 0,
        head: [],
        tail: [],
        error: `Error reading transcript: ${error.message}`,
      };
    }
  },
};

/**
 * Get all transcript tools
 * @returns Array of tool definitions
 */
export function getTranscriptTools(): ToolDefinition[] {
  return [
    findTranscriptTool,
    listProjectSessionsTool,
    readTranscriptSummaryTool,
  ];
}
