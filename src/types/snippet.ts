/**
 * Snippet Types and Validation Schemas
 * Epic 009-B: Conversation Snippet Extraction
 *
 * Defines types for extracting and storing conversation snippets from Claude Code transcripts
 */

import { z } from 'zod';

/**
 * Enumeration of valid snippet types
 */
export enum SnippetType {
  /** Why an error occurred, what was tried, how it was resolved */
  ERROR_REASONING = 'error_reasoning',
  /** Why a particular approach was chosen, what alternatives existed */
  DECISION_RATIONALE = 'decision_rationale',
  /** Reusable pattern or technique discovered during implementation */
  LEARNING_PATTERN = 'learning_pattern',
}

/**
 * Stored conversation snippet
 */
export interface Snippet {
  snippet_id: string;
  instance_id: string;
  event_id?: string;
  snippet_type: SnippetType;
  title: string;
  content: string;
  source_file?: string;
  source_line_start?: number;
  source_line_end?: number;
  tags: string[];
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

/**
 * Input for extracting and storing a snippet
 */
export interface ExtractSnippetInput {
  instance_id: string;
  snippet_type: SnippetType | string;
  title: string;
  content: string;
  event_id?: string;
  source_file?: string;
  source_line_start?: number;
  source_line_end?: number;
  tags?: string[];
  metadata?: Record<string, any>;
}

/**
 * Query parameters for searching snippets
 */
export interface QuerySnippetsInput {
  instance_id?: string;
  snippet_type?: SnippetType | string;
  project?: string;
  tags?: string[];
  keyword?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

/**
 * Query results for snippet search
 */
export interface QuerySnippetsOutput {
  snippets: Snippet[];
  total_count: number;
  has_more: boolean;
}

/**
 * Count of snippets by type for an instance
 */
export interface SnippetCountByType {
  error_reasoning: number;
  decision_rationale: number;
  learning_pattern: number;
}

// ============================================================================
// Zod Validation Schemas
// ============================================================================

/**
 * Validate SnippetType enum
 */
export const SnippetTypeSchema = z.enum([
  'error_reasoning',
  'decision_rationale',
  'learning_pattern',
] as const);

/**
 * Validate ExtractSnippetInput
 */
export const ExtractSnippetInputSchema = z.object({
  instance_id: z.string().min(1).max(32),
  snippet_type: SnippetTypeSchema,
  title: z.string().min(1).max(256),
  content: z.string().min(100).max(10240),
  event_id: z.string().uuid().optional(),
  source_file: z.string().optional(),
  source_line_start: z.number().int().positive().optional(),
  source_line_end: z.number().int().positive().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Validate QuerySnippetsInput
 */
export const QuerySnippetsInputSchema = z.object({
  instance_id: z.string().max(32).optional(),
  snippet_type: SnippetTypeSchema.optional(),
  project: z.string().optional(),
  tags: z.array(z.string()).optional(),
  keyword: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  limit: z.number().int().min(1).max(500).default(50),
  offset: z.number().int().min(0).default(0),
});
