/**
 * Snippet Store Service
 * Epic 009-B: Conversation Snippet Extraction
 *
 * Database operations for conversation snippets
 */

import { pool, query as dbQuery } from '../db/client.js';
import { getSanitizationService } from './SanitizationService.js';
import {
  Snippet,
  ExtractSnippetInput,
  QuerySnippetsInput,
  QuerySnippetsOutput,
  SnippetCountByType,
  SnippetType,
} from '../types/snippet.js';

/**
 * Error: Instance not found
 */
export class InstanceNotFoundError extends Error {
  constructor(instanceId: string) {
    super(`Instance not found: ${instanceId}`);
    this.name = 'InstanceNotFoundError';
  }
}

/**
 * Error: Event not found
 */
export class EventNotFoundError extends Error {
  constructor(eventId: string) {
    super(`Event not found: ${eventId}`);
    this.name = 'EventNotFoundError';
  }
}

/**
 * Error: Invalid snippet
 */
export class InvalidSnippetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSnippetError';
  }
}

/**
 * Database operations for conversation snippets
 */
export class SnippetStore {
  /**
   * Insert a new snippet
   *
   * @param input Snippet input with all required fields
   * @returns Stored snippet with generated ID and timestamps
   * @throws InstanceNotFoundError if instance_id doesn't exist
   * @throws EventNotFoundError if event_id provided but doesn't exist
   * @throws InvalidSnippetError if validation fails
   */
  async insertSnippet(input: ExtractSnippetInput): Promise<Snippet> {
    // Validate instance exists
    const instanceResult = await dbQuery(
      `SELECT instance_id FROM supervisor_sessions WHERE instance_id = $1 LIMIT 1`,
      [input.instance_id]
    );

    if (instanceResult.rows.length === 0) {
      throw new InstanceNotFoundError(input.instance_id);
    }

    // Validate event exists if provided
    if (input.event_id) {
      const eventResult = await dbQuery(
        `SELECT event_id FROM event_store WHERE event_id = $1 LIMIT 1`,
        [input.event_id]
      );

      if (eventResult.rows.length === 0) {
        throw new EventNotFoundError(input.event_id);
      }
    }

    // Sanitize content before storage
    const sanitizer = await getSanitizationService();
    const sanitizedContent = await sanitizer.sanitize(input.content);

    if (typeof sanitizedContent !== 'string') {
      throw new InvalidSnippetError('Content sanitization failed');
    }

    // Validate content size constraints
    const contentBytes = Buffer.byteLength(sanitizedContent, 'utf-8');
    if (contentBytes < 100) {
      throw new InvalidSnippetError(
        `Content too short: ${contentBytes} bytes (minimum 100)`
      );
    }
    if (contentBytes > 10240) {
      throw new InvalidSnippetError(
        `Content too long: ${contentBytes} bytes (maximum 10240)`
      );
    }

    // Insert snippet
    const tags = input.tags || [];
    const metadata = input.metadata || {};

    const result = await dbQuery(
      `
      INSERT INTO conversation_snippets (
        instance_id, event_id, snippet_type, title, content,
        source_file, source_line_start, source_line_end,
        tags, metadata, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING
        snippet_id, instance_id, event_id, snippet_type, title, content,
        source_file, source_line_start, source_line_end,
        tags, metadata, created_at, updated_at
      `,
      [
        input.instance_id,
        input.event_id || null,
        input.snippet_type,
        input.title,
        sanitizedContent,
        input.source_file || null,
        input.source_line_start || null,
        input.source_line_end || null,
        JSON.stringify(tags),
        JSON.stringify(metadata),
      ]
    );

    const row = result.rows[0];
    return this.mapRowToSnippet(row);
  }

  /**
   * Query snippets with optional filters
   *
   * @param input Query parameters
   * @returns Snippets matching criteria with pagination info
   */
  async querySnippets(input: QuerySnippetsInput): Promise<QuerySnippetsOutput> {
    const limit = Math.min(input.limit || 50, 500);
    const offset = input.offset || 0;

    // Build WHERE clause dynamically
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.instance_id) {
      conditions.push(`cs.instance_id = $${paramIndex}`);
      params.push(input.instance_id);
      paramIndex++;
    }

    if (input.snippet_type) {
      conditions.push(`cs.snippet_type = $${paramIndex}`);
      params.push(input.snippet_type);
      paramIndex++;
    }

    if (input.tags && input.tags.length > 0) {
      conditions.push(`cs.tags @> $${paramIndex}`);
      params.push(JSON.stringify(input.tags));
      paramIndex++;
    }

    if (input.keyword) {
      conditions.push(`(cs.title ILIKE $${paramIndex} OR cs.content ILIKE $${paramIndex})`);
      const searchTerm = `%${input.keyword}%`;
      params.push(searchTerm);
      params.push(searchTerm);
      paramIndex += 2;
    }

    if (input.start_date) {
      conditions.push(`cs.created_at >= $${paramIndex}`);
      params.push(input.start_date);
      paramIndex++;
    }

    if (input.end_date) {
      conditions.push(`cs.created_at <= $${paramIndex}`);
      params.push(input.end_date);
      paramIndex++;
    }

    // Handle project filter (requires JOIN to supervisor_sessions)
    let fromClause = 'FROM conversation_snippets cs';
    if (input.project) {
      fromClause += `
        INNER JOIN supervisor_sessions ss ON cs.instance_id = ss.instance_id
      `;
      conditions.push(`ss.project = $${paramIndex}`);
      params.push(input.project);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await dbQuery(
      `SELECT COUNT(*) as count ${fromClause} ${whereClause}`,
      params
    );
    const totalCount = parseInt(countResult.rows[0].count, 10);

    // Get paginated results
    params.push(limit);
    params.push(offset);

    const result = await dbQuery(
      `
      SELECT
        cs.snippet_id, cs.instance_id, cs.event_id, cs.snippet_type, cs.title,
        cs.content, cs.source_file, cs.source_line_start, cs.source_line_end,
        cs.tags, cs.metadata, cs.created_at, cs.updated_at
      ${fromClause}
      ${whereClause}
      ORDER BY cs.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      params
    );

    const snippets = result.rows.map((row) => this.mapRowToSnippet(row));
    const hasMore = offset + snippets.length < totalCount;

    return {
      snippets,
      total_count: totalCount,
      has_more: hasMore,
    };
  }

  /**
   * Count snippets by type for an instance
   *
   * @param instanceId Instance to count for
   * @returns Count of each snippet type
   */
  async countByType(instanceId: string): Promise<SnippetCountByType> {
    const result = await dbQuery(
      `
      SELECT
        snippet_type,
        COUNT(*) as count
      FROM conversation_snippets
      WHERE instance_id = $1
      GROUP BY snippet_type
      `,
      [instanceId]
    );

    const counts: SnippetCountByType = {
      error_reasoning: 0,
      decision_rationale: 0,
      learning_pattern: 0,
    };

    for (const row of result.rows) {
      counts[row.snippet_type as keyof SnippetCountByType] = parseInt(row.count, 10);
    }

    return counts;
  }

  /**
   * Delete snippets older than retention days
   *
   * @param retentionDays Number of days to retain
   * @returns Count of deleted snippets
   */
  async cleanupOldSnippets(retentionDays: number): Promise<{ deleted: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await dbQuery(
      `
      DELETE FROM conversation_snippets
      WHERE created_at < $1
      `,
      [cutoffDate]
    );

    return { deleted: result.rowCount || 0 };
  }

  /**
   * Map database row to Snippet interface
   */
  private mapRowToSnippet(row: any): Snippet {
    return {
      snippet_id: row.snippet_id,
      instance_id: row.instance_id,
      event_id: row.event_id || undefined,
      snippet_type: row.snippet_type as SnippetType,
      title: row.title,
      content: row.content,
      source_file: row.source_file || undefined,
      source_line_start: row.source_line_start || undefined,
      source_line_end: row.source_line_end || undefined,
      tags: Array.isArray(row.tags) ? row.tags : [],
      metadata: row.metadata || {},
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }
}

/**
 * Global instance (singleton)
 */
let globalInstance: SnippetStore | null = null;

/**
 * Get or create the global snippet store
 */
export function getSnippetStore(): SnippetStore {
  if (!globalInstance) {
    globalInstance = new SnippetStore();
  }
  return globalInstance;
}

/**
 * Reset the global instance (for testing)
 */
export function resetSnippetStore(): void {
  globalInstance = null;
}
