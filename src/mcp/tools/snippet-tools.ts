/**
 * Snippet Management MCP Tools (Epic 009-B)
 * Provides MCP tools for extracting and querying conversation snippets
 *
 * Epic 009-B (Conversation Snippet Extraction):
 * - mcp_meta_extract_snippet: Extract and store a conversation snippet
 * - mcp_meta_query_snippets: Search and filter stored snippets
 */

import {
  getSnippetStore,
  InstanceNotFoundError,
  EventNotFoundError,
  InvalidSnippetError,
} from '../../session/SnippetStore.js';
import {
  ExtractSnippetInputSchema,
  QuerySnippetsInputSchema,
  SnippetType,
} from '../../types/snippet.js';
import { ToolDefinition, ProjectContext } from '../../types/project.js';

/**
 * Tool: mcp_meta_extract_snippet
 * Extract and store a conversation snippet from a Claude Code session
 */
export const extractSnippetTool: ToolDefinition = {
  name: 'mcp_meta_extract_snippet',
  description: 'Extract and store a targeted conversation snippet from Claude Code transcript',
  inputSchema: {
    type: 'object',
    properties: {
      instance_id: {
        type: 'string',
        description: 'Supervisor instance ID to associate with snippet',
      },
      snippet_type: {
        type: 'string',
        enum: ['error_reasoning', 'decision_rationale', 'learning_pattern'],
        description:
          'Type of snippet: error_reasoning (why error occurred and resolution), decision_rationale (why approach chosen), learning_pattern (reusable technique)',
      },
      title: {
        type: 'string',
        description: 'Descriptive title for the snippet (max 256 chars)',
      },
      content: {
        type: 'string',
        description: 'The snippet content (100 bytes - 10KB, sanitized before storage)',
      },
      event_id: {
        type: 'string',
        description: 'Optional UUID linking to specific event in event_store',
      },
      source_file: {
        type: 'string',
        description: 'Optional path to source transcript file',
      },
      source_line_start: {
        type: 'number',
        description: 'Optional starting line in transcript',
      },
      source_line_end: {
        type: 'number',
        description: 'Optional ending line in transcript',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional categorization tags (e.g., "deployment", "auth")',
      },
      metadata: {
        type: 'object',
        description: 'Optional additional context (word_count, epic_id, etc.)',
      },
    },
    required: ['instance_id', 'snippet_type', 'title', 'content'],
  },
  handler: async (input: any, context: ProjectContext) => {
    const start = Date.now();

    try {
      // Validate input with Zod schema
      const validated = ExtractSnippetInputSchema.safeParse({
        instance_id: input.instance_id,
        snippet_type: input.snippet_type as SnippetType,
        title: input.title,
        content: input.content,
        event_id: input.event_id,
        source_file: input.source_file,
        source_line_start: input.source_line_start,
        source_line_end: input.source_line_end,
        tags: input.tags,
        metadata: input.metadata,
      });

      if (!validated.success) {
        return {
          success: false,
          error: `Validation failed: ${validated.error.message}`,
        };
      }

      // Extract snippet
      const store = getSnippetStore();
      const snippet = await store.insertSnippet(validated.data);

      const duration = Date.now() - start;

      if (duration > 500) {
        console.warn(`Extract snippet slow: ${duration}ms for ${snippet.snippet_id}`);
      }

      return {
        success: true,
        snippet_id: snippet.snippet_id,
        instance_id: snippet.instance_id,
        snippet_type: snippet.snippet_type,
        title: snippet.title,
        created_at: snippet.created_at.toISOString(),
      };
    } catch (error: any) {
      console.error('Extract snippet failed:', error);

      // Return specific error messages
      if (error instanceof InstanceNotFoundError || error instanceof EventNotFoundError) {
        return {
          success: false,
          error: error.message,
        };
      }

      if (error instanceof InvalidSnippetError) {
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: false,
        error: error.message || 'Failed to extract snippet',
      };
    }
  },
};

/**
 * Tool: mcp_meta_query_snippets
 * Search and filter stored conversation snippets
 */
export const querySnippetsTool: ToolDefinition = {
  name: 'mcp_meta_query_snippets',
  description: 'Query and filter conversation snippets with multiple filter options',
  inputSchema: {
    type: 'object',
    properties: {
      instance_id: {
        type: 'string',
        description: 'Optional filter by supervisor instance',
      },
      snippet_type: {
        type: 'string',
        enum: ['error_reasoning', 'decision_rationale', 'learning_pattern'],
        description: 'Optional filter by snippet type',
      },
      project: {
        type: 'string',
        description: 'Optional filter by project name (joins supervisor_sessions)',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional filter by tags (array containment)',
      },
      keyword: {
        type: 'string',
        description: 'Optional text search in title and content',
      },
      start_date: {
        type: 'string',
        description: 'Optional ISO 8601 start date (e.g., 2026-02-01T00:00:00Z)',
      },
      end_date: {
        type: 'string',
        description: 'Optional ISO 8601 end date (e.g., 2026-02-04T23:59:59Z)',
      },
      limit: {
        type: 'number',
        description: 'Max results (default 50, max 500)',
        default: 50,
      },
      offset: {
        type: 'number',
        description: 'Pagination offset (default 0)',
        default: 0,
      },
    },
  },
  handler: async (input: any, context: ProjectContext) => {
    const start = Date.now();

    try {
      // Validate input with Zod schema
      const validated = QuerySnippetsInputSchema.safeParse({
        instance_id: input.instance_id,
        snippet_type: input.snippet_type as SnippetType | undefined,
        project: input.project,
        tags: input.tags,
        keyword: input.keyword,
        start_date: input.start_date,
        end_date: input.end_date,
        limit: input.limit,
        offset: input.offset,
      });

      if (!validated.success) {
        return {
          success: false,
          error: `Validation failed: ${validated.error.message}`,
        };
      }

      // Query snippets
      const store = getSnippetStore();
      const result = await store.querySnippets(validated.data);

      const duration = Date.now() - start;

      if (duration > 50) {
        console.warn(`Query snippets slow: ${duration}ms`);
      }

      return {
        success: true,
        snippets: result.snippets.map((snippet) => ({
          snippet_id: snippet.snippet_id,
          instance_id: snippet.instance_id,
          snippet_type: snippet.snippet_type,
          title: snippet.title,
          content: snippet.content,
          tags: snippet.tags,
          created_at: snippet.created_at.toISOString(),
        })),
        total_count: result.total_count,
        has_more: result.has_more,
        returned_count: result.snippets.length,
      };
    } catch (error: any) {
      console.error('Query snippets failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to query snippets',
      };
    }
  },
};

/**
 * Export all snippet tools
 */
export function getSnippetTools(): ToolDefinition[] {
  return [extractSnippetTool, querySnippetsTool];
}

export const snippetTools = getSnippetTools();
