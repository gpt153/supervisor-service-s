/**
 * Unit Tests for ClaudeSessionResolver (Epic 009-A)
 * Tests path resolution and file existence checking
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { resolveClaudeSessionPath, claudeSessionExists, getClaudeSessionSize } from '../../../src/session/ClaudeSessionResolver.js';

describe('ClaudeSessionResolver', () => {
  const testHomeDir = os.homedir();

  describe('resolveClaudeSessionPath', () => {
    it('should resolve path with project name and UUID', () => {
      const result = resolveClaudeSessionPath('odin', 'abc123def456');
      expect(result).toBe(`${testHomeDir}/.claude/projects/odin/abc123def456.jsonl`);
    });

    it('should handle different project names', () => {
      const projects = ['odin', 'consilio', 'openhorizon', 'health-agent'];
      projects.forEach((project) => {
        const result = resolveClaudeSessionPath(project, 'uuid-123');
        expect(result).toContain(`/.claude/projects/${project}/`);
        expect(result).toEndWith('uuid-123.jsonl');
      });
    });

    it('should use HOME environment variable if set', () => {
      const originalHome = process.env.HOME;
      try {
        process.env.HOME = '/custom/home';
        const result = resolveClaudeSessionPath('test', 'uuid');
        expect(result).toBe('/custom/home/.claude/projects/test/uuid.jsonl');
      } finally {
        process.env.HOME = originalHome;
      }
    });

    it('should fall back to os.homedir() if HOME is not set', () => {
      const originalHome = process.env.HOME;
      try {
        delete process.env.HOME;
        const result = resolveClaudeSessionPath('test', 'uuid');
        expect(result).toContain('/.claude/projects/test/uuid.jsonl');
      } finally {
        process.env.HOME = originalHome;
      }
    });

    it('should handle UUIDs with hyphens', () => {
      const uuid = 'a1b2c3d4-e5f6-4789-a0b1-c2d3e4f5a6b7';
      const result = resolveClaudeSessionPath('odin', uuid);
      expect(result).toContain(uuid);
      expect(result).toEndWith('.jsonl');
    });
  });

  describe('claudeSessionExists', () => {
    let tempDir: string;
    let testFile: string;

    beforeEach(async () => {
      tempDir = path.join(os.tmpdir(), `test-claude-${Date.now()}`);
      await fs.promises.mkdir(tempDir, { recursive: true });
      testFile = path.join(tempDir, 'test-session.jsonl');
      await fs.promises.writeFile(testFile, '{"event": "test"}');
    });

    afterEach(async () => {
      try {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should return true for existing file', async () => {
      const result = await claudeSessionExists(testFile);
      expect(result).toBe(true);
    });

    it('should return false for non-existent file', async () => {
      const result = await claudeSessionExists(path.join(tempDir, 'non-existent.jsonl'));
      expect(result).toBe(false);
    });

    it('should return false for invalid path', async () => {
      const result = await claudeSessionExists('/invalid/path/to/file.jsonl');
      expect(result).toBe(false);
    });
  });

  describe('getClaudeSessionSize', () => {
    let tempDir: string;
    let testFile: string;

    beforeEach(async () => {
      tempDir = path.join(os.tmpdir(), `test-claude-size-${Date.now()}`);
      await fs.promises.mkdir(tempDir, { recursive: true });
      testFile = path.join(tempDir, 'test-session.jsonl');
      const content = '{"event": "test"}\n'.repeat(100);
      await fs.promises.writeFile(testFile, content);
    });

    afterEach(async () => {
      try {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should return file size for existing file', async () => {
      const result = await getClaudeSessionSize(testFile);
      expect(result).toBeGreaterThan(0);
      const stat = await fs.promises.stat(testFile);
      expect(result).toBe(stat.size);
    });

    it('should return null for non-existent file', async () => {
      const result = await getClaudeSessionSize(path.join(tempDir, 'non-existent.jsonl'));
      expect(result).toBeNull();
    });

    it('should return null for invalid path', async () => {
      const result = await getClaudeSessionSize('/invalid/path/to/file.jsonl');
      expect(result).toBeNull();
    });
  });
});
