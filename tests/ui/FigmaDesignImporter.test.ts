/**
 * Unit tests for FigmaDesignImporter
 * Epic: UI-004 - Figma Design Import Integration
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { FigmaDesignImporter } from '../../src/ui/FigmaDesignImporter.js';

describe('FigmaDesignImporter', () => {
  let importer: FigmaDesignImporter;

  beforeEach(() => {
    importer = new FigmaDesignImporter();
  });

  describe('parseFigmaUrl', () => {
    it('should parse valid design URL', () => {
      const url = 'https://figma.com/design/abc123/MyFile?node-id=1-2';
      const result = importer.parseFigmaUrl(url);

      expect(result.valid).toBe(true);
      expect(result.parsed).toBeDefined();
      expect(result.parsed?.fileKey).toBe('abc123');
      expect(result.parsed?.nodeId).toBe('1:2');
    });

    it('should parse valid file URL', () => {
      const url = 'https://figma.com/file/xyz789/AnotherFile?node-id=10-20';
      const result = importer.parseFigmaUrl(url);

      expect(result.valid).toBe(true);
      expect(result.parsed).toBeDefined();
      expect(result.parsed?.fileKey).toBe('xyz789');
      expect(result.parsed?.nodeId).toBe('10:20');
    });

    it('should parse branch URL and use branchKey as fileKey', () => {
      const url = 'https://figma.com/design/abc123/branch/branch456/BranchFile?node-id=5-6';
      const result = importer.parseFigmaUrl(url);

      expect(result.valid).toBe(true);
      expect(result.parsed).toBeDefined();
      expect(result.parsed?.fileKey).toBe('branch456');
      expect(result.parsed?.branchKey).toBe('branch456');
      expect(result.parsed?.nodeId).toBe('5:6');
    });

    it('should convert node ID dashes to colons', () => {
      const url = 'https://figma.com/design/abc123/MyFile?node-id=100-200';
      const result = importer.parseFigmaUrl(url);

      expect(result.valid).toBe(true);
      expect(result.parsed?.nodeId).toBe('100:200');
    });

    it('should handle www prefix', () => {
      const url = 'https://www.figma.com/design/abc123/MyFile?node-id=1-2';
      const result = importer.parseFigmaUrl(url);

      expect(result.valid).toBe(true);
      expect(result.parsed?.fileKey).toBe('abc123');
    });

    it('should reject invalid URL format', () => {
      const url = 'https://figma.com/invalid/url';
      const result = importer.parseFigmaUrl(url);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject URL without node-id', () => {
      const url = 'https://figma.com/design/abc123/MyFile';
      const result = importer.parseFigmaUrl(url);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject non-Figma URL', () => {
      const url = 'https://example.com/design/abc123?node-id=1-2';
      const result = importer.parseFigmaUrl(url);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('importDesign', () => {
    it('should reject invalid Figma URL', async () => {
      const result = await importer.importDesign({
        epicId: 'epic-001',
        figmaUrl: 'https://invalid-url.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    // Note: Integration tests with actual Figma MCP would go here
    // For now, we test the URL parsing and error handling
  });
});
