/**
 * InstanceResolver unit tests (Epic 007-E)
 * Tests all 5 resolution strategies and disambiguation logic
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { pool } from '../../../src/db/client.js';
import {
  resolveInstance,
  validateInstanceIsStale,
  ActiveInstanceError,
} from '../../../src/session/InstanceResolver.js';
import { ResolutionStrategy } from '../../../src/types/resume.js';

// Mock pool queries
vi.mock('../../../src/db/client.js', () => ({
  pool: {
    query: vi.fn(),
  },
}));

describe('InstanceResolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('resolveInstance - Strategy 1: Exact ID Match', () => {
    it('should resolve exact instance ID match', async () => {
      const mockInstance = {
        instance_id: 'odin-PS-8f4a2b',
        project: 'odin',
        instance_type: 'PS',
        status: 'stale',
        last_heartbeat: new Date(Date.now() - 180000), // 3 min ago
        current_epic: 'epic-003',
        age_minutes: 3,
      };

      (pool.query as any).mockResolvedValueOnce({
        rows: [mockInstance],
      });

      const result = await resolveInstance('odin-PS-8f4a2b');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.instance_id).toBe('odin-PS-8f4a2b');
        expect(result.strategy).toBe(ResolutionStrategy.EXACT);
      }
    });

    it('should fail if exact match instance is active', async () => {
      const mockInstance = {
        instance_id: 'odin-PS-8f4a2b',
        project: 'odin',
        instance_type: 'PS',
        status: 'active',
        last_heartbeat: new Date(Date.now() - 30000), // 30s ago (active)
        current_epic: 'epic-003',
        age_minutes: 0.5,
      };

      (pool.query as any).mockResolvedValueOnce({
        rows: [mockInstance],
      });

      await expect(resolveInstance('odin-PS-8f4a2b')).rejects.toThrow(
        ActiveInstanceError
      );
    });

    it('should return not found for non-existent exact ID', async () => {
      (pool.query as any).mockResolvedValueOnce({
        rows: [],
      });

      const result = await resolveInstance('nonexistent-PS-123456');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('not found');
      }
    });
  });

  describe('resolveInstance - Strategy 2: Partial ID Match', () => {
    it('should resolve single partial match', async () => {
      const mockInstance = {
        instance_id: 'odin-PS-8f4a2b',
        project: 'odin',
        instance_type: 'PS',
        status: 'stale',
        last_heartbeat: new Date(Date.now() - 180000),
        current_epic: 'epic-003',
        age_minutes: 3,
      };

      (pool.query as any).mockResolvedValueOnce({
        rows: [mockInstance],
      });

      const result = await resolveInstance('8f4a2b');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.instance_id).toBe('odin-PS-8f4a2b');
        expect(result.strategy).toBe(ResolutionStrategy.PARTIAL);
      }
    });

    it('should resolve 4-char partial match', async () => {
      const mockInstance = {
        instance_id: 'odin-PS-8f4a2b',
        project: 'odin',
        instance_type: 'PS',
        status: 'stale',
        last_heartbeat: new Date(Date.now() - 180000),
        current_epic: 'epic-003',
        age_minutes: 3,
      };

      (pool.query as any).mockResolvedValueOnce({
        rows: [mockInstance],
      });

      const result = await resolveInstance('8f4a');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.instance_id).toBe('odin-PS-8f4a2b');
        expect(result.strategy).toBe(ResolutionStrategy.PARTIAL);
      }
    });

    it('should return disambiguation for multiple partial matches', async () => {
      const mockInstances = [
        {
          instance_id: 'odin-PS-8f4a2b',
          project: 'odin',
          instance_type: 'PS',
          status: 'stale',
          last_heartbeat: new Date(Date.now() - 180000),
          current_epic: 'epic-003',
          age_minutes: 3,
        },
        {
          instance_id: 'consilio-PS-8f4a7c',
          project: 'consilio',
          instance_type: 'PS',
          status: 'stale',
          last_heartbeat: new Date(Date.now() - 240000),
          current_epic: 'epic-005',
          age_minutes: 4,
        },
      ];

      (pool.query as any).mockResolvedValueOnce({
        rows: mockInstances,
      });

      const result = await resolveInstance('8f4a');

      expect(result.success).toBe(false);
      if (!result.success && 'matches' in result) {
        expect(result.matches).toHaveLength(2);
        expect(result.hint).toContain('Multiple instances found');
      }
    });
  });

  describe('resolveInstance - Strategy 3: Project Latest', () => {
    it('should resolve single project match', async () => {
      const mockInstance = {
        instance_id: 'odin-PS-8f4a2b',
        project: 'odin',
        instance_type: 'PS',
        status: 'stale',
        last_heartbeat: new Date(Date.now() - 180000),
        current_epic: 'epic-003',
        age_minutes: 3,
      };

      (pool.query as any).mockResolvedValueOnce({
        rows: [mockInstance],
      });

      const result = await resolveInstance('odin');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.instance_id).toBe('odin-PS-8f4a2b');
        expect(result.strategy).toBe(ResolutionStrategy.PROJECT);
      }
    });

    it('should return disambiguation for multiple project matches', async () => {
      const mockInstances = [
        {
          instance_id: 'odin-PS-8f4a2b',
          project: 'odin',
          instance_type: 'PS',
          status: 'stale',
          last_heartbeat: new Date(Date.now() - 180000),
          current_epic: 'epic-003',
          age_minutes: 3,
        },
        {
          instance_id: 'odin-PS-3c7d1e',
          project: 'odin',
          instance_type: 'PS',
          status: 'stale',
          last_heartbeat: new Date(Date.now() - 240000),
          current_epic: 'epic-007',
          age_minutes: 4,
        },
      ];

      (pool.query as any).mockResolvedValueOnce({
        rows: mockInstances,
      });

      const result = await resolveInstance('odin');

      expect(result.success).toBe(false);
      if (!result.success && 'matches' in result) {
        expect(result.matches).toHaveLength(2);
        expect(result.hint).toContain('Multiple odin instances found');
      }
    });

    it('should return not found for project with no stale instances', async () => {
      (pool.query as any).mockResolvedValueOnce({
        rows: [],
      });

      const result = await resolveInstance('nonexistent-project');

      expect(result.success).toBe(false);
      if (!result.success && !('matches' in result)) {
        expect(result.error).toContain('No stale instances found');
      }
    });
  });

  describe('resolveInstance - Strategy 4: Epic Match', () => {
    it('should resolve instance by epic ID', async () => {
      const mockInstance = {
        instance_id: 'odin-PS-8f4a2b',
        project: 'odin',
        instance_type: 'PS',
        status: 'stale',
        last_heartbeat: new Date(Date.now() - 180000),
        current_epic: 'epic-003',
        age_minutes: 3,
      };

      (pool.query as any).mockResolvedValueOnce({
        rows: [mockInstance],
      });

      const result = await resolveInstance('epic-003');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.instance_id).toBe('odin-PS-8f4a2b');
        expect(result.strategy).toBe(ResolutionStrategy.EPIC);
      }
    });

    it('should return not found for epic with no stale instances', async () => {
      (pool.query as any).mockResolvedValueOnce({
        rows: [],
      });

      const result = await resolveInstance('epic-999');

      expect(result.success).toBe(false);
      if (!result.success && !('matches' in result)) {
        expect(result.error).toContain('No stale instance found working on');
      }
    });
  });

  describe('resolveInstance - Strategy 5: Newest', () => {
    it('should resolve newest stale instance when no hint provided', async () => {
      const mockInstance = {
        instance_id: 'odin-PS-8f4a2b',
        project: 'odin',
        instance_type: 'PS',
        status: 'stale',
        last_heartbeat: new Date(Date.now() - 180000),
        current_epic: 'epic-003',
        age_minutes: 3,
      };

      (pool.query as any).mockResolvedValueOnce({
        rows: [mockInstance],
      });

      const result = await resolveInstance();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.instance_id).toBe('odin-PS-8f4a2b');
        expect(result.strategy).toBe(ResolutionStrategy.NEWEST);
      }
    });

    it('should return not found if no stale instances exist', async () => {
      (pool.query as any).mockResolvedValueOnce({
        rows: [],
      });

      const result = await resolveInstance();

      expect(result.success).toBe(false);
      if (!result.success && !('matches' in result)) {
        expect(result.error).toBe('No stale instances found');
      }
    });
  });

  describe('validateInstanceIsStale', () => {
    it('should return true for stale instance', async () => {
      (pool.query as any).mockResolvedValueOnce({
        rows: [{ age_seconds: 180 }], // 3 minutes
      });

      const result = await validateInstanceIsStale('odin-PS-8f4a2b');

      expect(result).toBe(true);
    });

    it('should throw ActiveInstanceError for active instance', async () => {
      (pool.query as any).mockResolvedValueOnce({
        rows: [{ age_seconds: 60 }], // 1 minute (not stale)
      });

      await expect(
        validateInstanceIsStale('odin-PS-8f4a2b')
      ).rejects.toThrow(ActiveInstanceError);
    });

    it('should throw error for non-existent instance', async () => {
      (pool.query as any).mockResolvedValueOnce({
        rows: [],
      });

      await expect(
        validateInstanceIsStale('nonexistent-PS-123456')
      ).rejects.toThrow('Instance not found');
    });
  });
});
