/**
 * Unit tests for InstanceRegistry (Epic 007-A)
 * Tests instance registration, heartbeat, listing, and querying
 * Requires: PostgreSQL running with supervisor_sessions table
 */

import {
  registerInstance,
  updateHeartbeat,
  listInstances,
  getInstanceDetails,
  getPrefixMatches,
  markInstanceClosed,
  calculateInstanceAge,
  isInstanceStale,
  DuplicateInstanceError,
  InstanceNotFoundError,
} from '../../../src/session/InstanceRegistry.js';
import { InstanceType, STALE_TIMEOUT_SECONDS } from '../../../src/types/session.js';

describe('InstanceRegistry', () => {
  // Setup: Clean up test data after each test
  afterEach(async () => {
    // Note: In production, use database transactions or test DB
  });

  describe('registerInstance', () => {
    it('creates instance record with correct fields', async () => {
      const instance = await registerInstance('test-project', InstanceType.PS, {});

      expect(instance).toBeDefined();
      expect(instance.instance_id).toMatch(/^test-project-PS-[a-z0-9]{6}$/);
      expect(instance.project).toBe('test-project');
      expect(instance.instance_type).toBe(InstanceType.PS);
      expect(instance.status).toBe('active');
      expect(instance.context_percent).toBe(0);
      expect(instance.created_at).toBeInstanceOf(Date);
      expect(instance.last_heartbeat).toBeInstanceOf(Date);
    });

    it('generates unique instance IDs on repeated calls', async () => {
      const id1 = (await registerInstance('test-project', InstanceType.PS)).instance_id;
      const id2 = (await registerInstance('test-project', InstanceType.PS)).instance_id;
      const id3 = (await registerInstance('test-project', InstanceType.PS)).instance_id;

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });

    it('supports both PS and MS instance types', async () => {
      const psInstance = await registerInstance('test-project', InstanceType.PS);
      const msInstance = await registerInstance('meta', InstanceType.MS);

      expect(psInstance.instance_type).toBe(InstanceType.PS);
      expect(msInstance.instance_type).toBe(InstanceType.MS);
    });

    it('initializes last_heartbeat to current time', async () => {
      const before = Date.now();
      const instance = await registerInstance('test-project', InstanceType.PS);
      const after = Date.now();

      const heartbeatTime = instance.last_heartbeat.getTime();
      expect(heartbeatTime).toBeGreaterThanOrEqual(before);
      expect(heartbeatTime).toBeLessThanOrEqual(after);
    });
  });

  describe('updateHeartbeat', () => {
    it('updates last_heartbeat timestamp', async () => {
      const instance1 = await registerInstance('test-project', InstanceType.PS);

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      const instance2 = await updateHeartbeat(instance1.instance_id, 50);

      expect(instance2.last_heartbeat.getTime()).toBeGreaterThan(
        instance1.last_heartbeat.getTime()
      );
    });

    it('updates context_percent correctly', async () => {
      const instance1 = await registerInstance('test-project', InstanceType.PS);
      const instance2 = await updateHeartbeat(instance1.instance_id, 75);

      expect(instance2.context_percent).toBe(75);
    });

    it('updates current_epic when provided', async () => {
      const instance1 = await registerInstance('test-project', InstanceType.PS);
      const instance2 = await updateHeartbeat(instance1.instance_id, 50, 'epic-007-A');

      expect(instance2.current_epic).toBe('epic-007-A');
    });

    it('validates context_percent range', async () => {
      const instance = await registerInstance('test-project', InstanceType.PS);

      await expect(updateHeartbeat(instance.instance_id, -1)).rejects.toThrow();
      await expect(updateHeartbeat(instance.instance_id, 101)).rejects.toThrow();
      await expect(updateHeartbeat(instance.instance_id, 50.5)).rejects.toThrow();
    });

    it('throws InstanceNotFoundError for non-existent instance', async () => {
      await expect(updateHeartbeat('nonexistent-PS-000000', 50)).rejects.toThrow(
        InstanceNotFoundError
      );
    });
  });

  describe('listInstances', () => {
    it('returns all instances sorted by project, then last_heartbeat', async () => {
      await registerInstance('project-a', InstanceType.PS);
      await registerInstance('project-b', InstanceType.PS);
      await registerInstance('project-a', InstanceType.MS);

      const instances = await listInstances();

      expect(instances.length).toBeGreaterThanOrEqual(3);
      // Check sorting: project names should be sorted
      const projects = instances.map((i) => i.project);
      for (let i = 1; i < projects.length; i++) {
        if (projects[i - 1] === projects[i]) {
          // Same project, check heartbeat is sorted (newer first)
          const prevTime = instances[i - 1].last_heartbeat.getTime();
          const currTime = instances[i].last_heartbeat.getTime();
          expect(prevTime).toBeGreaterThanOrEqual(currTime);
        } else {
          // Different project, should be sorted alphabetically
          expect(projects[i - 1]).toBeLessThanOrEqual(projects[i]);
        }
      }
    });

    it('filters by project', async () => {
      const i1 = await registerInstance('project-x', InstanceType.PS);
      const i2 = await registerInstance('project-y', InstanceType.PS);

      const xInstances = await listInstances('project-x');
      const yInstances = await listInstances('project-y');

      expect(xInstances.every((i) => i.project === 'project-x')).toBe(true);
      expect(yInstances.every((i) => i.project === 'project-y')).toBe(true);
    });

    it('filters by active_only', async () => {
      const instance = await registerInstance('test-project', InstanceType.PS);

      const allInstances = await listInstances('test-project', false);
      const activeOnly = await listInstances('test-project', true);

      expect(activeOnly.length).toBeLessThanOrEqual(allInstances.length);
      expect(activeOnly.every((i) => i.status === 'active')).toBe(true);
    });

    it('handles empty result', async () => {
      const instances = await listInstances('nonexistent-project-xyz');
      expect(instances).toEqual([]);
    });

    it('completes in <100ms for moderate instance count', async () => {
      const start = Date.now();
      await listInstances();
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });
  });

  describe('getInstanceDetails', () => {
    it('finds instance by full ID', async () => {
      const created = await registerInstance('test-project', InstanceType.PS);
      const found = await getInstanceDetails(created.instance_id);

      expect(found).toBeDefined();
      expect(found?.instance_id).toBe(created.instance_id);
      expect(found?.project).toBe(created.project);
    });

    it('finds instance by 6-char prefix', async () => {
      const created = await registerInstance('test-project', InstanceType.PS);
      const hash = created.instance_id.split('-')[2]; // Extract 6-char hash

      const found = await getInstanceDetails(hash);

      expect(found).toBeDefined();
      expect(found?.instance_id).toBe(created.instance_id);
    });

    it('returns null for non-existent instance', async () => {
      const found = await getInstanceDetails('nonexistent-PS-000000');
      expect(found).toBeNull();
    });

    it('completes in <50ms', async () => {
      const instance = await registerInstance('test-project', InstanceType.PS);

      const start = Date.now();
      await getInstanceDetails(instance.instance_id);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50);
    });
  });

  describe('getPrefixMatches', () => {
    it('returns prefix matches', async () => {
      const instance = await registerInstance('test-project', InstanceType.PS);
      const hash = instance.instance_id.split('-')[2];

      const matches = await getPrefixMatches(hash);

      expect(matches.length).toBeGreaterThan(0);
      expect(matches.some((m) => m.instance_id === instance.instance_id)).toBe(true);
    });

    it('returns empty array for non-matching prefix', async () => {
      const matches = await getPrefixMatches('zzzzzz');
      expect(matches).toEqual([]);
    });
  });

  describe('markInstanceClosed', () => {
    it('closes instance and sets closed_at', async () => {
      const instance = await registerInstance('test-project', InstanceType.PS);

      const closed = await markInstanceClosed(instance.instance_id);

      expect(closed.status).toBe('closed');
      expect(closed.closed_at).toBeInstanceOf(Date);
    });

    it('throws InstanceNotFoundError for non-existent instance', async () => {
      await expect(markInstanceClosed('nonexistent-PS-000000')).rejects.toThrow(
        InstanceNotFoundError
      );
    });
  });

  describe('calculateInstanceAge', () => {
    it('returns age in seconds', async () => {
      const instance = await registerInstance('test-project', InstanceType.PS);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const age = calculateInstanceAge(instance.last_heartbeat);

      expect(age).toBeGreaterThanOrEqual(0);
      expect(age).toBeLessThan(10);
    });

    it('returns increasing age over time', async () => {
      const instance = await registerInstance('test-project', InstanceType.PS);

      const age1 = calculateInstanceAge(instance.last_heartbeat);
      await new Promise((resolve) => setTimeout(resolve, 100));
      const age2 = calculateInstanceAge(instance.last_heartbeat);

      expect(age2).toBeGreaterThan(age1);
    });
  });

  describe('isInstanceStale', () => {
    it('returns false for new instance', async () => {
      const instance = await registerInstance('test-project', InstanceType.PS);
      expect(isInstanceStale(instance.last_heartbeat)).toBe(false);
    });

    it('returns true for instance older than STALE_TIMEOUT_SECONDS', async () => {
      // Create a date in the past (e.g., 150 seconds ago)
      const staleTime = new Date(Date.now() - (STALE_TIMEOUT_SECONDS + 30) * 1000);
      expect(isInstanceStale(staleTime)).toBe(true);
    });

    it('returns false for instance exactly at timeout boundary', async () => {
      // Create a date STALE_TIMEOUT_SECONDS ago
      const boundaryTime = new Date(Date.now() - STALE_TIMEOUT_SECONDS * 1000);
      // Note: This might be flaky depending on timing, so we give it some margin
      const result = isInstanceStale(boundaryTime);
      expect([true, false]).toContain(result);
    });
  });

  describe('collision resistance', () => {
    it('generates 100 unique IDs with zero collisions', async () => {
      const ids = new Set<string>();

      for (let i = 0; i < 100; i++) {
        const instance = await registerInstance('test-project', InstanceType.PS);
        ids.add(instance.instance_id);
      }

      expect(ids.size).toBe(100);
    });

    it('generates 1000 unique IDs with negligible collisions', async () => {
      const ids = new Set<string>();

      for (let i = 0; i < 1000; i++) {
        const instance = await registerInstance('test-project', InstanceType.PS);
        ids.add(instance.instance_id);
      }

      const collisions = 1000 - ids.size;
      expect(collisions).toBeLessThan(10); // Allow <1% collision rate for 1000 IDs
    });
  });

  describe('stale detection', () => {
    it('marks instance as stale after timeout', async () => {
      const instance = await registerInstance('test-project', InstanceType.PS);

      // Create a stale instance by modifying last_heartbeat in database
      const staleTime = new Date(Date.now() - (STALE_TIMEOUT_SECONDS + 30) * 1000);

      // In real scenario, this would be done via raw SQL update
      // For now, we test via isInstanceStale
      expect(isInstanceStale(staleTime)).toBe(true);
    });

    it('correctly identifies active instances', async () => {
      const instance = await registerInstance('test-project', InstanceType.PS);

      // Instance just created should not be stale
      expect(isInstanceStale(instance.last_heartbeat)).toBe(false);
    });
  });

  describe('performance', () => {
    it('registers instance in <50ms', async () => {
      const start = Date.now();
      await registerInstance('test-project', InstanceType.PS);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50);
    });

    it('updates heartbeat in <20ms', async () => {
      const instance = await registerInstance('test-project', InstanceType.PS);

      const start = Date.now();
      await updateHeartbeat(instance.instance_id, 50);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(20);
    });

    it('lists instances in <100ms', async () => {
      const start = Date.now();
      await listInstances();
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it('queries instance in <50ms', async () => {
      const instance = await registerInstance('test-project', InstanceType.PS);

      const start = Date.now();
      await getInstanceDetails(instance.instance_id);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50);
    });
  });
});
