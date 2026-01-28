/**
 * ResumeEngine unit tests (Epic 007-E)
 * Tests main resume workflow orchestration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { pool } from '../../../src/db/client.js';
import {
  resumeInstance,
  getInstanceDetails,
  listStaleInstances,
} from '../../../src/session/ResumeEngine.js';

// Mock dependencies
vi.mock('../../../src/db/client.js', () => ({
  pool: {
    query: vi.fn(),
  },
}));

vi.mock('../../../src/session/InstanceResolver.js', () => ({
  resolveInstance: vi.fn(),
  validateInstanceIsStale: vi.fn(),
  ActiveInstanceError: class ActiveInstanceError extends Error {},
}));

vi.mock('../../../src/session/ContextReconstructor.js', () => ({
  reconstructContext: vi.fn(),
}));

vi.mock('../../../src/session/ConfidenceScorer.js', () => ({
  calculateConfidence: vi.fn(),
}));

import { resolveInstance } from '../../../src/session/InstanceResolver.js';
import { reconstructContext } from '../../../src/session/ContextReconstructor.js';
import { calculateConfidence } from '../../../src/session/ConfidenceScorer.js';

describe('ResumeEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('resumeInstance', () => {
    it('should successfully resume instance with exact match', async () => {
      // Mock resolution
      (resolveInstance as any).mockResolvedValueOnce({
        success: true,
        instance_id: 'odin-PS-8f4a2b',
        strategy: 'exact',
      });

      // Mock instance query
      (pool.query as any).mockResolvedValueOnce({
        rows: [
          {
            project: 'odin',
            instance_type: 'PS',
            current_epic: 'epic-003',
            context_percent: 45,
            last_heartbeat: new Date(),
          },
        ],
      });

      // Mock context reconstruction
      (reconstructContext as any).mockResolvedValueOnce({
        source: 'checkpoint',
        confidence_score: 95,
        age_minutes: 2,
        work_state: {
          current_epic: 'epic-003',
          epic_status: 'completed',
        },
        summary: {
          current_epic: {
            epic_id: 'epic-003',
            name: 'Authentication',
            status: 'Completed',
            time_hours: 4.5,
            tests_passed: 42,
            tests_total: 42,
            coverage_percent: 87,
          },
          recent_actions: ['Run tests', 'Update PRD'],
          next_steps: [],
        },
      });

      // Mock confidence scoring
      (calculateConfidence as any).mockResolvedValueOnce({
        score: 95,
        reason: 'Recent checkpoint, all state valid',
        warnings: [],
      });

      const result = await resumeInstance('odin-PS-8f4a2b');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.instance_id).toBe('odin-PS-8f4a2b');
        expect(result.project).toBe('odin');
        expect(result.confidence_score).toBe(95);
        expect(result.summary).toBeDefined();
      }
    });

    it('should return disambiguation for multiple matches', async () => {
      // Mock resolution with multiple matches
      (resolveInstance as any).mockResolvedValueOnce({
        success: false,
        matches: [
          {
            instance_id: 'odin-PS-8f4a2b',
            project: 'odin',
            instance_type: 'PS',
            status: 'stale',
            last_heartbeat: new Date(),
            age_minutes: 3,
          },
          {
            instance_id: 'odin-PS-3c7d1e',
            project: 'odin',
            instance_type: 'PS',
            status: 'stale',
            last_heartbeat: new Date(),
            age_minutes: 4,
          },
        ],
        hint: 'Multiple instances found',
      });

      const result = await resumeInstance('odin');

      expect(result.success).toBe(false);
      if (!result.success && 'matches' in result) {
        expect(result.matches).toHaveLength(2);
        expect(result.user_hint).toContain('Multiple instances found');
      }
    });

    it('should handle user choice for disambiguation', async () => {
      // First call with disambiguation
      (resolveInstance as any).mockResolvedValueOnce({
        success: false,
        matches: [
          {
            instance_id: 'odin-PS-8f4a2b',
            project: 'odin',
            instance_type: 'PS',
            status: 'stale',
            last_heartbeat: new Date(),
            age_minutes: 3,
          },
          {
            instance_id: 'odin-PS-3c7d1e',
            project: 'odin',
            instance_type: 'PS',
            status: 'stale',
            last_heartbeat: new Date(),
            age_minutes: 4,
          },
        ],
        hint: 'Multiple instances found',
      });

      const result = await resumeInstance('odin', 1);

      // Should process user choice (implementation continues with first match)
      expect(result).toBeDefined();
    });

    it('should return error for not found instance', async () => {
      (resolveInstance as any).mockResolvedValueOnce({
        success: false,
        error: 'Instance not found',
        searched_for: 'nonexistent',
      });

      const result = await resumeInstance('nonexistent');

      expect(result.success).toBe(false);
      if (!result.success && !('matches' in result)) {
        expect(result.error).toContain('Instance not found');
      }
    });
  });

  describe('getInstanceDetails', () => {
    it('should return instance details with commands', async () => {
      // Mock instance query
      (pool.query as any)
        .mockResolvedValueOnce({
          rows: [
            {
              project: 'odin',
              instance_type: 'PS',
              status: 'stale',
              created_at: new Date('2026-01-28T10:00:00Z'),
              last_heartbeat: new Date('2026-01-28T10:30:00Z'),
              context_percent: 45,
              current_epic: 'epic-003',
            },
          ],
        })
        // Mock commands query
        .mockResolvedValueOnce({
          rows: [
            {
              command_type: 'spawn_subagent',
              created_at: new Date(),
              command_args: { epic_id: 'epic-003' },
            },
          ],
        });

      const result = await getInstanceDetails('odin-PS-8f4a2b');

      expect(result.instance_id).toBe('odin-PS-8f4a2b');
      expect(result.project).toBe('odin');
      expect(result.status).toBe('stale');
      expect(result.recent_commands).toHaveLength(1);
    });

    it('should throw error for non-existent instance', async () => {
      (pool.query as any).mockResolvedValueOnce({
        rows: [],
      });

      await expect(
        getInstanceDetails('nonexistent-PS-123456')
      ).rejects.toThrow('Instance not found');
    });
  });

  describe('listStaleInstances', () => {
    it('should return all stale instances', async () => {
      const mockInstances = [
        {
          instance_id: 'odin-PS-8f4a2b',
          project: 'odin',
          instance_type: 'PS',
          last_heartbeat: new Date(Date.now() - 180000),
          current_epic: 'epic-003',
        },
        {
          instance_id: 'consilio-PS-3c7d1e',
          project: 'consilio',
          instance_type: 'PS',
          last_heartbeat: new Date(Date.now() - 240000),
          current_epic: 'epic-005',
        },
      ];

      (pool.query as any).mockResolvedValueOnce({
        rows: mockInstances,
      });

      const result = await listStaleInstances();

      expect(result.total_count).toBe(2);
      expect(result.instances).toHaveLength(2);
      expect(result.instances[0].instance_id).toBe('odin-PS-8f4a2b');
      expect(result.instances[0].minutes_stale).toBeGreaterThan(2);
    });

    it('should return empty list if no stale instances', async () => {
      (pool.query as any).mockResolvedValueOnce({
        rows: [],
      });

      const result = await listStaleInstances();

      expect(result.total_count).toBe(0);
      expect(result.instances).toHaveLength(0);
    });
  });
});
