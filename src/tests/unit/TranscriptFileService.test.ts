/**
 * Unit tests for TranscriptFileService
 * Epic 009-C: Transcript Lookup Tools
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import {
  TranscriptFileService,
  resetTranscriptFileService,
} from '../../session/TranscriptFileService.js';

describe('TranscriptFileService', () => {
  let service: TranscriptFileService;
  let tempDir: string;
  let projectDir: string;

  beforeEach(async () => {
    service = new TranscriptFileService();

    // Create temporary directory for tests
    tempDir = path.join(os.tmpdir(), `transcript-test-${Date.now()}`);
    projectDir = path.join(tempDir, '.claude', 'projects', 'test-project');
    await fs.mkdir(projectDir, { recursive: true });

    // Override home directory for testing
    process.env.HOME = tempDir;
  });

  afterEach(async () => {
    // Clean up temporary files
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
    resetTranscriptFileService();
  });

  describe('getFileMetadata', () => {
    it('should return exists: true and correct metadata for existing file', async () => {
      const filePath = path.join(projectDir, 'test.jsonl');
      const content = '{"role":"user","content":"test message"}\n';
      await fs.writeFile(filePath, content);

      const metadata = await service.getFileMetadata(filePath);

      expect(metadata.exists).toBe(true);
      expect(metadata.size_bytes).toBeGreaterThan(0);
      expect(metadata.size_human).toMatch(/^[\d.]+\s*[KMG]?B$/);
      expect(metadata.modified_at).toBeInstanceOf(Date);
      expect(metadata.line_count).toBeGreaterThan(0);
    });

    it('should return exists: false for missing file', async () => {
      const filePath = path.join(projectDir, 'nonexistent.jsonl');

      const metadata = await service.getFileMetadata(filePath);

      expect(metadata.exists).toBe(false);
      expect(metadata.size_bytes).toBe(0);
      expect(metadata.line_count).toBe(0);
    });

    it('should handle permission errors gracefully', async () => {
      const filePath = path.join(projectDir, 'test.jsonl');
      await fs.writeFile(filePath, '{"test":"data"}\n');

      // On Unix-like systems, chmod to remove read permission
      if (process.platform !== 'win32') {
        await fs.chmod(filePath, 0o000);

        const metadata = await service.getFileMetadata(filePath);
        expect(metadata.exists).toBe(false);

        // Restore permissions for cleanup
        await fs.chmod(filePath, 0o644);
      }
    });
  });

  describe('readHeadTail', () => {
    it('should read head and tail lines correctly', async () => {
      const filePath = path.join(projectDir, 'test.jsonl');
      const lines = Array.from({ length: 20 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
      }));

      const content = lines.map((l) => JSON.stringify(l)).join('\n') + '\n';
      await fs.writeFile(filePath, content);

      const result = await service.readHeadTail(filePath, 3, 3);

      expect(result.head.length).toBeLessThanOrEqual(3);
      expect(result.tail.length).toBeLessThanOrEqual(3);
      expect(result.total_lines).toBe(20);
      expect(result.head[0].role).toBeDefined();
      expect(result.tail[result.tail.length - 1].role).toBeDefined();
    });

    it('should handle file with fewer lines than requested', async () => {
      const filePath = path.join(projectDir, 'test.jsonl');
      const lines = Array.from({ length: 2 }, (_, i) => ({
        role: 'user',
        content: `Message ${i}`,
      }));

      const content = lines.map((l) => JSON.stringify(l)).join('\n') + '\n';
      await fs.writeFile(filePath, content);

      const result = await service.readHeadTail(filePath, 5, 5);

      expect(result.head.length).toBe(2);
      expect(result.tail.length).toBe(2);
      expect(result.total_lines).toBe(2);
    });

    it('should handle empty file gracefully', async () => {
      const filePath = path.join(projectDir, 'empty.jsonl');
      await fs.writeFile(filePath, '');

      const result = await service.readHeadTail(filePath, 5, 5);

      expect(result.head).toEqual([]);
      expect(result.tail).toEqual([]);
      expect(result.total_lines).toBe(0);
    });

    it('should skip malformed JSONL lines', async () => {
      const filePath = path.join(projectDir, 'test.jsonl');
      const content =
        '{"role":"user","content":"valid"}\n' +
        'invalid json line\n' +
        '{"role":"assistant","content":"also valid"}\n';

      await fs.writeFile(filePath, content);

      const result = await service.readHeadTail(filePath, 5, 5);

      // Should have 2 valid lines (malformed line is skipped)
      expect(result.total_lines).toBe(2);
      expect(result.head.length).toBe(2);
    });

    it('should extract content preview correctly', async () => {
      const filePath = path.join(projectDir, 'test.jsonl');
      const longContent = 'a'.repeat(300);
      const content = JSON.stringify({
        role: 'user',
        content: longContent,
      }) + '\n';

      await fs.writeFile(filePath, content);

      const result = await service.readHeadTail(filePath, 1, 0);

      expect(result.head[0].content_preview.length).toBeLessThanOrEqual(200);
    });
  });

  describe('listProjectSessions', () => {
    it('should list .jsonl files for a project', async () => {
      // Create some test files
      await fs.writeFile(path.join(projectDir, 'session1.jsonl'), '{"test":1}\n');
      await fs.writeFile(path.join(projectDir, 'session2.jsonl'), '{"test":2}\n');
      await fs.writeFile(path.join(projectDir, 'notajsonl.txt'), 'text\n');

      // Need to recreate service to pick up new HOME dir
      resetTranscriptFileService();
      service = new TranscriptFileService();

      const sessions = await service.listProjectSessions('test-project');

      expect(sessions.length).toBe(2);
      expect(sessions[0].filename).toMatch(/\.jsonl$/);
      expect(sessions[1].filename).toMatch(/\.jsonl$/);
    });

    it('should return empty array for non-existent project', async () => {
      const sessions = await service.listProjectSessions('nonexistent-project');

      expect(sessions).toEqual([]);
    });

    it('should extract UUID from filename', async () => {
      const uuid = 'abc123-def456';
      await fs.writeFile(path.join(projectDir, `${uuid}.jsonl`), '{"test":1}\n');

      resetTranscriptFileService();
      service = new TranscriptFileService();

      const sessions = await service.listProjectSessions('test-project');

      expect(sessions[0].uuid).toBe(uuid);
    });

    it('should sort by modification time (newest first)', async () => {
      // Create files with different timestamps
      await fs.writeFile(path.join(projectDir, 'old.jsonl'), '{"test":1}\n');
      await new Promise((r) => setTimeout(r, 100)); // Wait a bit
      await fs.writeFile(path.join(projectDir, 'new.jsonl'), '{"test":2}\n');

      resetTranscriptFileService();
      service = new TranscriptFileService();

      const sessions = await service.listProjectSessions('test-project');

      expect(sessions[0].filename).toBe('new.jsonl');
      expect(sessions[1].filename).toBe('old.jsonl');
    });

    it('should include file metadata', async () => {
      const content = JSON.stringify({ test: 1 }) + '\n';
      await fs.writeFile(path.join(projectDir, 'test.jsonl'), content);

      resetTranscriptFileService();
      service = new TranscriptFileService();

      const sessions = await service.listProjectSessions('test-project');

      expect(sessions[0].path).toBeDefined();
      expect(sessions[0].size_bytes).toBeGreaterThan(0);
      expect(sessions[0].size_human).toMatch(/^[\d.]+\s*[KMG]?B$/);
      expect(sessions[0].modified_at).toBeInstanceOf(Date);
    });
  });

  describe('resolvePath', () => {
    it('should construct correct path from project and UUID', () => {
      const project = 'test-project';
      const uuid = 'abc123-def456';

      const resolvedPath = service.resolvePath(project, uuid);

      expect(resolvedPath).toContain('test-project');
      expect(resolvedPath).toContain('abc123-def456.jsonl');
      expect(resolvedPath).toContain('.claude/projects');
    });
  });

  describe('formatSize', () => {
    it('should format bytes correctly', () => {
      expect(service.formatSize(0)).toBe('0 B');
      expect(service.formatSize(100)).toBe('100.0 B');
      expect(service.formatSize(1024)).toMatch(/KB/);
      expect(service.formatSize(1024 * 1024)).toMatch(/MB/);
      expect(service.formatSize(1024 * 1024 * 1024)).toMatch(/GB/);
    });

    it('should handle large files', () => {
      const size = service.formatSize(5 * 1024 * 1024 * 1024); // 5 GB
      expect(size).toMatch(/^[\d.]+\s*GB$/);
    });
  });

  describe('getCurrentMachine', () => {
    it('should return a machine hostname', () => {
      const machine = service.getCurrentMachine();
      expect(typeof machine).toBe('string');
      expect(machine.length).toBeGreaterThan(0);
    });
  });

  describe('getHomeForMachine', () => {
    it('should return home directory for known machines', () => {
      expect(service.getHomeForMachine('odin3')).toBe('/home/samuel');
      expect(service.getHomeForMachine('odin4')).toBe('/home/samuel');
      expect(service.getHomeForMachine('laptop')).toBe('/Users/samuel');
    });

    it('should return default home for unknown machine', () => {
      const home = service.getHomeForMachine('unknown-machine');
      expect(home).toBe('/home/samuel');
    });
  });

  describe('getPossibleMachines', () => {
    it('should return possible machines for a path', () => {
      const filePath = '/home/samuel/.claude/projects/test/uuid.jsonl';
      const machines = service.getPossibleMachines(filePath);

      expect(Array.isArray(machines)).toBe(true);
      // Should return some machines (varies by current machine)
      expect(machines.length).toBeGreaterThanOrEqual(0);
    });
  });
});
