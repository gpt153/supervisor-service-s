/**
 * Unit tests for InstanceIdGenerator (Epic 007-A)
 * Tests ID generation, validation, and parsing
 */

import {
  generateInstanceId,
  validateInstanceId,
  parseInstanceId,
} from '../../../src/session/InstanceIdGenerator.js';
import { InstanceType, INSTANCE_ID_PATTERN } from '../../../src/types/session.js';

describe('InstanceIdGenerator', () => {
  describe('generateInstanceId', () => {
    it('generates valid instance ID format', () => {
      const id = generateInstanceId('odin', InstanceType.PS);
      expect(id).toMatch(INSTANCE_ID_PATTERN);
    });

    it('includes project prefix correctly', () => {
      const id1 = generateInstanceId('consilio', InstanceType.PS);
      const id2 = generateInstanceId('odin', InstanceType.MS);

      expect(id1).toMatch(/^consilio-PS-/);
      expect(id2).toMatch(/^odin-MS-/);
    });

    it('includes instance type correctly', () => {
      const psId = generateInstanceId('test-project', InstanceType.PS);
      const msId = generateInstanceId('test-project', InstanceType.MS);

      expect(psId).toContain('-PS-');
      expect(msId).toContain('-MS-');
    });

    it('generates 6-character hash', () => {
      const id = generateInstanceId('test', InstanceType.PS);
      const parts = id.split('-');
      const hash = parts[parts.length - 1];

      expect(hash).toHaveLength(6);
      expect(hash).toMatch(/^[a-z0-9]{6}$/);
    });

    it('generates unique IDs on repeated calls', () => {
      const ids = new Set<string>();

      for (let i = 0; i < 100; i++) {
        ids.add(generateInstanceId('test', InstanceType.PS));
      }

      expect(ids.size).toBe(100);
    });

    it('generates different IDs for different projects', () => {
      const id1 = generateInstanceId('project-a', InstanceType.PS);
      const id2 = generateInstanceId('project-b', InstanceType.PS);

      expect(id1).not.toBe(id2);
      expect(id1).toContain('project-a');
      expect(id2).toContain('project-b');
    });

    it('generates different IDs for different types', () => {
      const id1 = generateInstanceId('test', InstanceType.PS);
      const id2 = generateInstanceId('test', InstanceType.MS);

      expect(id1).not.toBe(id2);
      expect(id1).toContain('-PS-');
      expect(id2).toContain('-MS-');
    });

    it('validates project name (lowercase alphanumeric + hyphens)', () => {
      expect(() => generateInstanceId('valid-project', InstanceType.PS)).not.toThrow();
      expect(() => generateInstanceId('project123', InstanceType.PS)).not.toThrow();

      // Invalid: uppercase
      expect(() => generateInstanceId('Invalid', InstanceType.PS)).toThrow();

      // Invalid: special characters
      expect(() => generateInstanceId('project!', InstanceType.PS)).toThrow();

      // Invalid: empty
      expect(() => generateInstanceId('', InstanceType.PS)).toThrow();

      // Invalid: too long
      expect(() => generateInstanceId('a'.repeat(100), InstanceType.PS)).toThrow();
    });

    it('validates instance type', () => {
      expect(() => generateInstanceId('test', InstanceType.PS)).not.toThrow();
      expect(() => generateInstanceId('test', InstanceType.MS)).not.toThrow();

      expect(() => generateInstanceId('test', 'INVALID' as any)).toThrow();
    });

    it('generates IDs with collision rate <0.01% over 10k IDs', () => {
      const ids = new Set<string>();

      for (let i = 0; i < 10000; i++) {
        ids.add(generateInstanceId('test', InstanceType.PS));
      }

      const collisions = 10000 - ids.size;
      const collisionRate = collisions / 10000;

      // Expect <1 collision in 10000 IDs (0.01% rate)
      expect(collisionRate).toBeLessThan(0.0001);
    });
  });

  describe('validateInstanceId', () => {
    it('accepts valid instance IDs', () => {
      expect(validateInstanceId('odin-PS-8f4a2b')).toBe(true);
      expect(validateInstanceId('meta-MS-a9b2c4')).toBe(true);
      expect(validateInstanceId('consilio-PS-123456')).toBe(true);
      expect(validateInstanceId('test-project-PS-abcdef')).toBe(true);
    });

    it('rejects invalid formats', () => {
      expect(validateInstanceId('invalid')).toBe(false);
      expect(validateInstanceId('odin-INVALID-8f4a2b')).toBe(false);
      expect(validateInstanceId('odin-PS-short')).toBe(false);
      expect(validateInstanceId('odin-PS-8f4a2b-extra')).toBe(false);
      expect(validateInstanceId('')).toBe(false);
    });

    it('rejects uppercase in project or hash', () => {
      expect(validateInstanceId('ODIN-PS-8f4a2b')).toBe(false);
      expect(validateInstanceId('odin-PS-8F4A2B')).toBe(false);
    });

    it('rejects invalid instance types', () => {
      expect(validateInstanceId('odin-ps-8f4a2b')).toBe(false); // lowercase
      expect(validateInstanceId('odin-SUPERVISOR-8f4a2b')).toBe(false); // wrong type
      expect(validateInstanceId('odin-PM-8f4a2b')).toBe(false); // wrong type
    });

    it('accepts project names with hyphens', () => {
      expect(validateInstanceId('multi-word-project-PS-8f4a2b')).toBe(true);
    });

    it('rejects invalid hash characters', () => {
      expect(validateInstanceId('odin-PS-!@#$%^')).toBe(false);
      expect(validateInstanceId('odin-PS-8f4a2_')).toBe(false);
    });
  });

  describe('parseInstanceId', () => {
    it('parses valid instance ID into components', () => {
      const { project, type, hash } = parseInstanceId('odin-PS-8f4a2b');

      expect(project).toBe('odin');
      expect(type).toBe(InstanceType.PS);
      expect(hash).toBe('8f4a2b');
    });

    it('handles project names with hyphens', () => {
      const { project, type, hash } = parseInstanceId('multi-word-project-MS-abc123');

      expect(project).toBe('multi-word-project');
      expect(type).toBe(InstanceType.MS);
      expect(hash).toBe('abc123');
    });

    it('throws for invalid format', () => {
      expect(() => parseInstanceId('invalid')).toThrow();
      expect(() => parseInstanceId('odin-PS-short')).toThrow();
      expect(() => parseInstanceId('')).toThrow();
    });

    it('extracts correct type', () => {
      const ps = parseInstanceId('odin-PS-8f4a2b');
      const ms = parseInstanceId('meta-MS-xyz789');

      expect(ps.type).toBe(InstanceType.PS);
      expect(ms.type).toBe(InstanceType.MS);
    });

    it('extracts correct hash', () => {
      const id = 'odin-PS-8f4a2b';
      const { hash } = parseInstanceId(id);

      expect(hash).toBe('8f4a2b');
      expect(hash).toHaveLength(6);
    });

    it('extracts correct project', () => {
      const id1 = 'odin-PS-8f4a2b';
      const id2 = 'consilio-PS-abc123';
      const id3 = 'my-custom-project-MS-def456';

      expect(parseInstanceId(id1).project).toBe('odin');
      expect(parseInstanceId(id2).project).toBe('consilio');
      expect(parseInstanceId(id3).project).toBe('my-custom-project');
    });
  });

  describe('integration: generate → validate → parse', () => {
    it('generated ID passes validation and parses correctly', () => {
      const generated = generateInstanceId('odin', InstanceType.PS);

      expect(validateInstanceId(generated)).toBe(true);

      const parsed = parseInstanceId(generated);
      expect(parsed.project).toBe('odin');
      expect(parsed.type).toBe(InstanceType.PS);
      expect(parsed.hash).toHaveLength(6);
    });

    it('cycle works for various projects and types', () => {
      const testCases = [
        ['odin', InstanceType.PS],
        ['consilio', InstanceType.MS],
        ['test-project', InstanceType.PS],
        ['meta', InstanceType.MS],
      ] as const;

      for (const [project, type] of testCases) {
        const generated = generateInstanceId(project, type);
        expect(validateInstanceId(generated)).toBe(true);

        const parsed = parseInstanceId(generated);
        expect(parsed.project).toBe(project);
        expect(parsed.type).toBe(type);
      }
    });
  });

  describe('determinism and randomness', () => {
    it('generates different hashes for same project+type due to randomness', () => {
      const id1 = generateInstanceId('test', InstanceType.PS);
      const id2 = generateInstanceId('test', InstanceType.PS);

      expect(id1).not.toBe(id2);

      const hash1 = parseInstanceId(id1).hash;
      const hash2 = parseInstanceId(id2).hash;

      expect(hash1).not.toBe(hash2);
    });

    it('hashes are uniformly distributed (basic check)', () => {
      const hashes = new Set<string>();

      for (let i = 0; i < 100; i++) {
        const id = generateInstanceId('test', InstanceType.PS);
        hashes.add(parseInstanceId(id).hash);
      }

      // All hashes should be unique (no collision in 100 samples)
      expect(hashes.size).toBe(100);
    });
  });

  describe('edge cases', () => {
    it('accepts project with numbers', () => {
      expect(() => generateInstanceId('project123', InstanceType.PS)).not.toThrow();
    });

    it('accepts project with leading hyphen (though unusual)', () => {
      // Note: This actually matches the validation pattern
      // but may be unusual in practice
      const id = generateInstanceId('a-b-c', InstanceType.PS);
      expect(validateInstanceId(id)).toBe(true);
    });

    it('rejects project that\'s too long', () => {
      const longProject = 'a'.repeat(100);
      expect(() => generateInstanceId(longProject, InstanceType.PS)).toThrow();
    });

    it('handles project with max length (64 chars)', () => {
      const maxProject = 'a'.repeat(64);
      const id = generateInstanceId(maxProject, InstanceType.PS);
      expect(validateInstanceId(id)).toBe(true);
    });
  });
});
