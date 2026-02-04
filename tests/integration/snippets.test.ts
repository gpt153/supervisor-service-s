/**
 * Integration Tests for Snippets (Epic 009-B)
 * Tests actual database operations with real PostgreSQL connection
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { pool } from '../../src/db/client.js';
import { getSnippetStore } from '../../src/session/SnippetStore.js';
import { SnippetType } from '../../src/types/snippet.js';

describe('Snippets Integration Tests', () => {
  let testInstanceId: string;

  beforeEach(async () => {
    // Get or create a test instance
    const result = await pool.query(
      `SELECT instance_id FROM supervisor_sessions LIMIT 1`
    );
    if (result.rows.length > 0) {
      testInstanceId = result.rows[0].instance_id;
    } else {
      // Create test instance if none exist
      const newInstance = await pool.query(
        `INSERT INTO supervisor_sessions (instance_id, project, instance_type, status, context_percent, host_machine, created_at, last_heartbeat)
         VALUES ('test-snippet-PS-abc123', 'test', 'PS', 'active', 0, 'test-host', NOW(), NOW())
         RETURNING instance_id`
      );
      testInstanceId = newInstance.rows[0].instance_id;
    }
  });

  afterEach(async () => {
    // Cleanup test snippets
    await pool.query(
      `DELETE FROM conversation_snippets WHERE instance_id = $1`,
      [testInstanceId]
    );
  });

  describe('insertSnippet', () => {
    it('should insert a snippet successfully', async () => {
      const store = getSnippetStore();

      const snippet = await store.insertSnippet({
        instance_id: testInstanceId,
        snippet_type: SnippetType.ERROR_REASONING,
        title: 'Database Timeout Resolution',
        content:
          'The issue was that the database connection pool was too small. We increased it from 10 to 50 connections. This resolved the timeout errors we were seeing in production.',
        tags: ['database', 'timeout', 'performance'],
        metadata: { epic_id: 'epic-001', word_count: 40 },
      });

      expect(snippet.snippet_id).toBeDefined();
      expect(snippet.instance_id).toBe(testInstanceId);
      expect(snippet.snippet_type).toBe(SnippetType.ERROR_REASONING);
      expect(snippet.title).toBe('Database Timeout Resolution');
      expect(snippet.tags).toEqual(['database', 'timeout', 'performance']);
    });

    it('should reject snippet with content too short', async () => {
      const store = getSnippetStore();

      await expect(
        store.insertSnippet({
          instance_id: testInstanceId,
          snippet_type: SnippetType.ERROR_REASONING,
          title: 'Too short',
          content: 'short',
        })
      ).rejects.toThrow();
    });

    it('should store all three snippet types', async () => {
      const store = getSnippetStore();

      const errorSnippet = await store.insertSnippet({
        instance_id: testInstanceId,
        snippet_type: SnippetType.ERROR_REASONING,
        title: 'Error case',
        content: 'This is an error reasoning snippet with enough content to pass validation',
      });

      const decisionSnippet = await store.insertSnippet({
        instance_id: testInstanceId,
        snippet_type: SnippetType.DECISION_RATIONALE,
        title: 'Decision case',
        content: 'This is a decision rationale snippet with enough content to pass validation',
      });

      const learningSnippet = await store.insertSnippet({
        instance_id: testInstanceId,
        snippet_type: SnippetType.LEARNING_PATTERN,
        title: 'Learning case',
        content: 'This is a learning pattern snippet with enough content to pass validation',
      });

      expect(errorSnippet.snippet_type).toBe(SnippetType.ERROR_REASONING);
      expect(decisionSnippet.snippet_type).toBe(SnippetType.DECISION_RATIONALE);
      expect(learningSnippet.snippet_type).toBe(SnippetType.LEARNING_PATTERN);
    });
  });

  describe('querySnippets', () => {
    it('should query snippets by instance', async () => {
      const store = getSnippetStore();

      // Insert test snippets
      await store.insertSnippet({
        instance_id: testInstanceId,
        snippet_type: SnippetType.ERROR_REASONING,
        title: 'Test Error 1',
        content: 'This is an error reasoning snippet with enough content to pass validation',
      });

      await store.insertSnippet({
        instance_id: testInstanceId,
        snippet_type: SnippetType.DECISION_RATIONALE,
        title: 'Test Decision 1',
        content: 'This is a decision rationale snippet with enough content to pass validation',
      });

      // Query snippets
      const result = await store.querySnippets({
        instance_id: testInstanceId,
      });

      expect(result.snippets.length).toBe(2);
      expect(result.total_count).toBe(2);
      expect(result.has_more).toBe(false);
    });

    it('should query snippets by type', async () => {
      const store = getSnippetStore();

      // Insert test snippets
      await store.insertSnippet({
        instance_id: testInstanceId,
        snippet_type: SnippetType.ERROR_REASONING,
        title: 'Error 1',
        content: 'This is an error reasoning snippet with enough content to pass validation',
      });

      await store.insertSnippet({
        instance_id: testInstanceId,
        snippet_type: SnippetType.ERROR_REASONING,
        title: 'Error 2',
        content: 'This is another error reasoning snippet with enough content to pass validation',
      });

      await store.insertSnippet({
        instance_id: testInstanceId,
        snippet_type: SnippetType.DECISION_RATIONALE,
        title: 'Decision 1',
        content: 'This is a decision rationale snippet with enough content to pass validation',
      });

      // Query by type
      const result = await store.querySnippets({
        instance_id: testInstanceId,
        snippet_type: SnippetType.ERROR_REASONING,
      });

      expect(result.snippets.length).toBe(2);
      expect(result.snippets.every((s) => s.snippet_type === SnippetType.ERROR_REASONING)).toBe(
        true
      );
    });

    it('should handle pagination', async () => {
      const store = getSnippetStore();

      // Insert multiple snippets
      for (let i = 0; i < 5; i++) {
        await store.insertSnippet({
          instance_id: testInstanceId,
          snippet_type: SnippetType.ERROR_REASONING,
          title: `Error ${i}`,
          content: `This is error reasoning snippet number ${i} with enough content to pass validation`,
        });
      }

      // Query with limit
      const result1 = await store.querySnippets({
        instance_id: testInstanceId,
        limit: 2,
        offset: 0,
      });

      expect(result1.snippets.length).toBe(2);
      expect(result1.total_count).toBe(5);
      expect(result1.has_more).toBe(true);

      // Query next page
      const result2 = await store.querySnippets({
        instance_id: testInstanceId,
        limit: 2,
        offset: 2,
      });

      expect(result2.snippets.length).toBe(2);
      expect(result2.has_more).toBe(true);
    });

    it('should search by keyword', async () => {
      const store = getSnippetStore();

      await store.insertSnippet({
        instance_id: testInstanceId,
        snippet_type: SnippetType.ERROR_REASONING,
        title: 'Database Connection Issue',
        content:
          'The database connection pool was exhausted. We increased the pool size to resolve this error.',
      });

      const result = await store.querySnippets({
        instance_id: testInstanceId,
        keyword: 'database',
      });

      expect(result.snippets.length).toBe(1);
      expect(result.snippets[0].title).toContain('Database');
    });
  });

  describe('countByType', () => {
    it('should count snippets by type', async () => {
      const store = getSnippetStore();

      // Insert snippets of different types
      for (let i = 0; i < 3; i++) {
        await store.insertSnippet({
          instance_id: testInstanceId,
          snippet_type: SnippetType.ERROR_REASONING,
          title: `Error ${i}`,
          content: `This is error reasoning snippet with enough content to pass validation`,
        });
      }

      for (let i = 0; i < 2; i++) {
        await store.insertSnippet({
          instance_id: testInstanceId,
          snippet_type: SnippetType.DECISION_RATIONALE,
          title: `Decision ${i}`,
          content: `This is decision rationale snippet with enough content to pass validation`,
        });
      }

      const counts = await store.countByType(testInstanceId);

      expect(counts.error_reasoning).toBe(3);
      expect(counts.decision_rationale).toBe(2);
      expect(counts.learning_pattern).toBe(0);
    });
  });
});
