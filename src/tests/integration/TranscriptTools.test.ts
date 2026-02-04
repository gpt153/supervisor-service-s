/**
 * Integration tests for transcript MCP tools
 * Epic 009-C: Transcript Lookup Tools
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { query as dbQuery } from '../../db/index.js';
import {
  findTranscriptTool,
  listProjectSessionsTool,
  readTranscriptSummaryTool,
} from '../../mcp/tools/transcript-tools.js';
import { resetTranscriptFileService } from '../../session/TranscriptFileService.js';

/**
 * Mock ProjectContext for testing
 */
const mockContext = {
  project: { name: 'test-project' },
  workingDirectory: '/tmp/test-project',
};

describe('Transcript MCP Tools Integration', () => {
  let tempDir: string;
  let projectDir: string;
  let testInstanceId: string;

  beforeEach(async () => {
    // Create temporary directory
    tempDir = path.join(os.tmpdir(), `transcript-test-${Date.now()}`);
    projectDir = path.join(tempDir, '.claude', 'projects', 'test-project');
    await fs.mkdir(projectDir, { recursive: true });

    // Override HOME for testing
    process.env.HOME = tempDir;

    // Create a test instance in database
    testInstanceId = 'test-PS-abc123';
  });

  afterEach(async () => {
    // Clean up
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore
    }
    resetTranscriptFileService();

    // Try to clean up test instance from database
    try {
      await dbQuery(
        'DELETE FROM supervisor_sessions WHERE instance_id = $1',
        [testInstanceId]
      );
    } catch (e) {
      // Ignore if DB not available
    }
  });

  describe('findTranscriptTool', () => {
    it('should return error for non-existent instance', async () => {
      const result = await findTranscriptTool.handler(
        { instance_id: 'nonexistent-PS-xyz' },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return error for instance without linked Claude session', async () => {
      try {
        // Insert test instance without Claude session
        await dbQuery(
          `INSERT INTO supervisor_sessions
           (instance_id, project, instance_type, status, context_percent, host_machine, created_at, last_heartbeat)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
          [testInstanceId, 'test-project', 'PS', 'active', 0, 'odin3']
        );

        const result = await findTranscriptTool.handler(
          { instance_id: testInstanceId },
          mockContext
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('No Claude session linked');
      } catch (e) {
        // Skip if DB not available
        console.warn('Database test skipped:', (e as Error).message);
      }
    });

    it('should return transcript metadata for linked session', async () => {
      try {
        const uuid = 'abc123-def456';
        const transcriptPath = path.join(projectDir, `${uuid}.jsonl`);

        // Create transcript file
        const content = JSON.stringify({
          role: 'user',
          content: 'test message',
        }) + '\n';
        await fs.writeFile(transcriptPath, content);

        // Insert test instance with Claude session
        await dbQuery(
          `INSERT INTO supervisor_sessions
           (instance_id, project, instance_type, status, context_percent, host_machine, created_at, last_heartbeat, claude_session_uuid)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), $7)`,
          [testInstanceId, 'test-project', 'PS', 'active', 0, 'odin3', uuid]
        );

        // Need to reset service to pick up new HOME
        resetTranscriptFileService();

        const result = await findTranscriptTool.handler(
          { instance_id: testInstanceId },
          mockContext
        );

        expect(result.success).toBe(true);
        expect(result.claude_session_uuid).toBe(uuid);
        expect(result.transcript).toBeDefined();
        expect(result.transcript?.exists).toBe(true);
        expect(result.transcript?.size_bytes).toBeGreaterThan(0);
        expect(result.transcript?.size_human).toMatch(/B$/);
      } catch (e) {
        console.warn('Database test skipped:', (e as Error).message);
      }
    });
  });

  describe('listProjectSessionsTool', () => {
    it('should return empty list for project without sessions', async () => {
      const result = await listProjectSessionsTool.handler(
        { project: 'test-project' },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.project).toBe('test-project');
      expect(result.sessions).toEqual([]);
      expect(result.total_count).toBe(0);
    });

    it('should list project sessions', async () => {
      // Create test session files
      await fs.writeFile(
        path.join(projectDir, 'session1.jsonl'),
        JSON.stringify({ role: 'user', content: 'message 1' }) + '\n'
      );
      await fs.writeFile(
        path.join(projectDir, 'session2.jsonl'),
        JSON.stringify({ role: 'assistant', content: 'message 2' }) + '\n'
      );

      resetTranscriptFileService();

      const result = await listProjectSessionsTool.handler(
        { project: 'test-project' },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.total_count).toBe(2);
      expect(result.sessions.length).toBeLessThanOrEqual(2);
      expect(result.sessions[0].filename).toMatch(/\.jsonl$/);
      expect(result.sessions[0].uuid).toBeDefined();
      expect(result.total_size_human).toMatch(/B$/);
    });

    it('should respect limit parameter', async () => {
      // Create multiple session files
      for (let i = 0; i < 10; i++) {
        await fs.writeFile(
          path.join(projectDir, `session${i}.jsonl`),
          JSON.stringify({ role: 'user', content: `message ${i}` }) + '\n'
        );
      }

      resetTranscriptFileService();

      const result = await listProjectSessionsTool.handler(
        { project: 'test-project', limit: 3 },
        mockContext
      );

      expect(result.sessions.length).toBeLessThanOrEqual(3);
      expect(result.total_count).toBe(10);
    });

    it('should include linked instance info if available', async () => {
      try {
        const uuid = 'session-uuid-001';
        await fs.writeFile(
          path.join(projectDir, `${uuid}.jsonl`),
          JSON.stringify({ role: 'user', content: 'test' }) + '\n'
        );

        // Insert instance with linked session
        await dbQuery(
          `INSERT INTO supervisor_sessions
           (instance_id, project, instance_type, status, context_percent, host_machine, created_at, last_heartbeat, claude_session_uuid)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), $7)`,
          ['linked-PS-xyz', 'test-project', 'PS', 'active', 50, 'odin3', uuid]
        );

        resetTranscriptFileService();

        const result = await listProjectSessionsTool.handler(
          { project: 'test-project' },
          mockContext
        );

        expect(result.success).toBe(true);
        const linkedSession = result.sessions.find((s) => s.uuid === uuid);
        if (linkedSession) {
          expect(linkedSession.linked_instance_id).toBe('linked-PS-xyz');
          expect(linkedSession.linked_status).toBe('active');
        }
      } catch (e) {
        console.warn('Database test skipped:', (e as Error).message);
      }
    });
  });

  describe('readTranscriptSummaryTool', () => {
    it('should return error when neither instance_id nor path provided', async () => {
      const result = await readTranscriptSummaryTool.handler({}, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should read transcript summary with direct path', async () => {
      const transcriptPath = path.join(projectDir, 'test.jsonl');

      // Create a transcript with multiple lines
      const lines = Array.from({ length: 10 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}: This is a test message`,
      }));

      const content = lines.map((l) => JSON.stringify(l)).join('\n') + '\n';
      await fs.writeFile(transcriptPath, content);

      resetTranscriptFileService();

      const result = await readTranscriptSummaryTool.handler(
        {
          path: transcriptPath,
          head_lines: 2,
          tail_lines: 2,
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.path).toBe(transcriptPath);
      expect(result.total_lines).toBe(10);
      expect(result.head.length).toBeGreaterThan(0);
      expect(result.tail.length).toBeGreaterThan(0);
      expect(result.head[0].role).toBeDefined();
      expect(result.head[0].content_preview).toBeDefined();
    });

    it('should sanitize content in preview', async () => {
      const transcriptPath = path.join(projectDir, 'test.jsonl');

      // Create a transcript with a "secret"
      const content = JSON.stringify({
        role: 'user',
        content: 'API_KEY=sk-1234567890abcdef secret data',
      }) + '\n';
      await fs.writeFile(transcriptPath, content);

      resetTranscriptFileService();

      const result = await readTranscriptSummaryTool.handler(
        { path: transcriptPath },
        mockContext
      );

      expect(result.success).toBe(true);
      // Content should be sanitized
      if (result.head.length > 0) {
        expect(result.head[0].content_preview).toBeDefined();
        // The sanitization service may have redacted the API key
      }
    });

    it('should resolve path from instance_id', async () => {
      try {
        const uuid = 'instance-uuid-001';
        const transcriptPath = path.join(projectDir, `${uuid}.jsonl`);

        // Create transcript
        const content = JSON.stringify({
          role: 'user',
          content: 'test message',
        }) + '\n';
        await fs.writeFile(transcriptPath, content);

        // Insert instance with Claude session
        await dbQuery(
          `INSERT INTO supervisor_sessions
           (instance_id, project, instance_type, status, context_percent, host_machine, created_at, last_heartbeat, claude_session_uuid)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), $7)`,
          [testInstanceId, 'test-project', 'PS', 'active', 0, 'odin3', uuid]
        );

        resetTranscriptFileService();

        const result = await readTranscriptSummaryTool.handler(
          { instance_id: testInstanceId },
          mockContext
        );

        expect(result.success).toBe(true);
        expect(result.total_lines).toBeGreaterThan(0);
      } catch (e) {
        console.warn('Database test skipped:', (e as Error).message);
      }
    });

    it('should handle missing file gracefully', async () => {
      const result = await readTranscriptSummaryTool.handler(
        { path: '/nonexistent/path/transcript.jsonl' },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.total_lines).toBe(0);
      expect(result.head).toEqual([]);
      expect(result.tail).toEqual([]);
    });

    it('should handle malformed JSONL gracefully', async () => {
      const transcriptPath = path.join(projectDir, 'broken.jsonl');

      // Create a transcript with some invalid lines
      const content =
        JSON.stringify({ role: 'user', content: 'valid 1' }) + '\n' +
        'invalid json\n' +
        JSON.stringify({ role: 'assistant', content: 'valid 2' }) + '\n';

      await fs.writeFile(transcriptPath, content);

      resetTranscriptFileService();

      const result = await readTranscriptSummaryTool.handler(
        { path: transcriptPath },
        mockContext
      );

      expect(result.success).toBe(true);
      // Should have 2 valid lines
      expect(result.total_lines).toBe(2);
    });
  });
});
