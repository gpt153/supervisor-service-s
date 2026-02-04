/**
 * Type definitions for transcript operations
 * Epic 009-C: Transcript Lookup Tools
 */

/**
 * Metadata for a transcript file
 */
export interface TranscriptMetadata {
  path: string;
  exists: boolean;
  size_bytes: number;
  size_human: string;
  modified_at: string;
  line_count: number;
}

/**
 * A single line from a transcript summary
 */
export interface TranscriptSummaryLine {
  line: number;
  role: string;
  type: string;
  content_preview: string;
  timestamp?: string;
}

/**
 * Information about a project's session file
 */
export interface ProjectSessionInfo {
  filename: string;
  uuid: string;
  path: string;
  size_bytes: number;
  size_human: string;
  modified_at: string;
  linked_instance_id?: string;
  linked_status?: string;
}

/**
 * Output of find_transcript MCP tool
 */
export interface FindTranscriptOutput {
  success: boolean;
  instance_id: string;
  claude_session_uuid?: string;
  transcript?: TranscriptMetadata;
  error?: string;
}

/**
 * Output of list_project_sessions MCP tool
 */
export interface ListProjectSessionsOutput {
  success: boolean;
  project: string;
  sessions: ProjectSessionInfo[];
  total_count: number;
  linked_count: number;
  total_size_human: string;
}

/**
 * Output of read_transcript_summary MCP tool
 */
export interface ReadTranscriptSummaryOutput {
  success: boolean;
  path: string;
  total_lines: number;
  head: TranscriptSummaryLine[];
  tail: TranscriptSummaryLine[];
  error?: string;
}

/**
 * Information about a parsed JSONL line from transcript
 */
export interface ParsedTranscriptLine {
  line: number;
  role: string;
  type: string;
  content_preview: string;
  timestamp?: string;
}
