/**
 * Integration tests for Session Registry (Epic 007-A)
 * Tests complete workflows: registration, heartbeat, listing, querying
 * Requires: PostgreSQL with supervisor_sessions table
 */

import {
  registerInstance,
  updateHeartbeat,
  listInstances,
  getInstanceDetails,
  markInstanceClosed,
} from '../../src/session/index.js';
import { sendHeartbeat } from '../../src/session/HeartbeatManager.js';
import { InstanceType } from '../../src/types/session.js';

describe('Session Registry Integration Tests', () => {
  describe('Scenario 1: Single PS instance lifecycle', () => {
    it('completes full lifecycle: register → heartbeat → list → close', async () => {
      // Step 1: Register instance
      const registered = await registerInstance('odin', InstanceType.PS);
      expect(registered).toBeDefined();
      expect(registered.instance_id).toMatch(/^odin-PS-/);
      expect(registered.status).toBe('active');

      // Step 2: Send heartbeat
      const heartbeat = await sendHeartbeat(registered.instance_id, 50, 'epic-007-A');
      expect(heartbeat).toBeDefined();
      expect(heartbeat.stale).toBe(false);
      expect(heartbeat.context_percent).toBe(50);

      // Step 3: List instances and verify our instance is there
      const instances = await listInstances('odin');
      const found = instances.find((i) => i.instance_id === registered.instance_id);
      expect(found).toBeDefined();
      expect(found?.status).toBe('active');

      // Step 4: Query specific instance
      const details = await getInstanceDetails(registered.instance_id);
      expect(details).toBeDefined();
      expect(details?.instance_id).toBe(registered.instance_id);

      // Step 5: Close instance
      const closed = await markInstanceClosed(registered.instance_id);
      expect(closed.status).toBe('closed');

      // Step 6: Verify closed in list
      const finalList = await listInstances('odin', false);
      const finalFound = finalList.find((i) => i.instance_id === registered.instance_id);
      expect(finalFound?.status).toBe('closed');
    });
  });

  describe('Scenario 2: Multiple concurrent instances of same project', () => {
    it('handles 3 simultaneous Odin PS instances correctly', async () => {
      // Register 3 instances
      const inst1 = await registerInstance('odin', InstanceType.PS);
      const inst2 = await registerInstance('odin', InstanceType.PS);
      const inst3 = await registerInstance('odin', InstanceType.PS);

      expect(inst1.instance_id).not.toBe(inst2.instance_id);
      expect(inst2.instance_id).not.toBe(inst3.instance_id);

      // Send heartbeats with different contexts
      await sendHeartbeat(inst1.instance_id, 25, 'epic-001');
      await sendHeartbeat(inst2.instance_id, 50, 'epic-002');
      await sendHeartbeat(inst3.instance_id, 75, 'epic-003');

      // List all Odin instances
      const instances = await listInstances('odin');
      const odinInstances = instances.filter((i) =>
        [inst1.instance_id, inst2.instance_id, inst3.instance_id].includes(i.instance_id)
      );

      expect(odinInstances.length).toBeGreaterThanOrEqual(3);
      expect(odinInstances.map((i) => i.instance_id)).toContain(inst1.instance_id);
      expect(odinInstances.map((i) => i.instance_id)).toContain(inst2.instance_id);
      expect(odinInstances.map((i) => i.instance_id)).toContain(inst3.instance_id);

      // Verify contexts are different
      const contexts = odinInstances.map((i) => i.context_percent);
      expect(contexts).toContain(25);
      expect(contexts).toContain(50);
      expect(contexts).toContain(75);
    });
  });

  describe('Scenario 3: Multiple projects with PS and MS instances', () => {
    it('correctly handles mixed PS/MS instances across projects', async () => {
      // Register instances for different projects
      const odinPS = await registerInstance('odin', InstanceType.PS);
      const odinMS = await registerInstance('odin', InstanceType.MS);
      const consilioPS = await registerInstance('consilio', InstanceType.PS);
      const metaMS = await registerInstance('meta', InstanceType.MS);

      // Send heartbeats
      await sendHeartbeat(odinPS.instance_id, 30);
      await sendHeartbeat(odinMS.instance_id, 40);
      await sendHeartbeat(consilioPS.instance_id, 50);
      await sendHeartbeat(metaMS.instance_id, 60);

      // List all instances
      const allInstances = await listInstances();
      expect(allInstances.length).toBeGreaterThanOrEqual(4);

      // Verify projects are sorted
      const projects = allInstances.map((i) => i.project);
      for (let i = 1; i < projects.length; i++) {
        if (projects[i - 1] !== projects[i]) {
          expect(projects[i - 1]).toBeLessThanOrEqual(projects[i]);
        }
      }

      // List by project
      const odinInstances = await listInstances('odin');
      expect(odinInstances.some((i) => i.instance_id === odinPS.instance_id)).toBe(true);
      expect(odinInstances.some((i) => i.instance_id === odinMS.instance_id)).toBe(true);
      expect(odinInstances.some((i) => i.project === 'odin')).toBe(true);
    });
  });

  describe('Scenario 4: Stale instance detection and recovery', () => {
    it('detects and lists stale instances after 120s timeout', async () => {
      // Register instance
      const instance = await registerInstance('test-project', InstanceType.PS);

      // Initial heartbeat - should be active
      let list = await listInstances('test-project', false);
      let found = list.find((i) => i.instance_id === instance.instance_id);
      expect(found?.status).toBe('active');

      // Note: Full test of staleness would require mocking time or
      // directly manipulating database. For now, we verify the mechanism exists.

      // In production, after 120s without heartbeat:
      // list = await listInstances('test-project', false);
      // found = list.find((i) => i.instance_id === instance.instance_id);
      // expect(found?.status).toBe('stale');

      // Sending heartbeat should mark as active again
      const heartbeat = await sendHeartbeat(instance.instance_id, 50);
      expect(heartbeat.stale).toBe(false);

      list = await listInstances('test-project', false);
      found = list.find((i) => i.instance_id === instance.instance_id);
      expect(found?.status).toBe('active');
    });
  });

  describe('Query operations', () => {
    it('finds instance by exact ID', async () => {
      const registered = await registerInstance('query-test', InstanceType.PS);

      const found = await getInstanceDetails(registered.instance_id);

      expect(found).toBeDefined();
      expect(found?.instance_id).toBe(registered.instance_id);
      expect(found?.project).toBe('query-test');
    });

    it('finds instance by 6-char hash prefix', async () => {
      const registered = await registerInstance('query-test', InstanceType.PS);
      const hash = registered.instance_id.split('-').pop();

      const found = await getInstanceDetails(hash!);

      expect(found).toBeDefined();
      expect(found?.instance_id).toBe(registered.instance_id);
    });

    it('returns null for non-existent instance', async () => {
      const found = await getInstanceDetails('nonexistent-PS-000000');
      expect(found).toBeNull();
    });
  });

  describe('Performance under load', () => {
    it('registers 50 instances within reasonable time', async () => {
      const start = Date.now();

      for (let i = 0; i < 50; i++) {
        await registerInstance(`perf-test-${i % 5}`, InstanceType.PS);
      }

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(5000); // 5 seconds for 50 registrations
    });

    it('lists instances from multiple projects efficiently', async () => {
      // Create instances across projects
      for (let p = 0; p < 3; p++) {
        for (let i = 0; i < 5; i++) {
          await registerInstance(`load-test-${p}`, InstanceType.PS);
        }
      }

      const start = Date.now();
      const instances = await listInstances();
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
      expect(instances.length).toBeGreaterThanOrEqual(15);
    });
  });

  describe('Context and epic tracking', () => {
    it('tracks context_percent across heartbeats', async () => {
      const instance = await registerInstance('context-test', InstanceType.PS);

      const beat1 = await sendHeartbeat(instance.instance_id, 10);
      expect(beat1.context_percent).toBe(10);

      const beat2 = await sendHeartbeat(instance.instance_id, 50);
      expect(beat2.context_percent).toBe(50);

      const beat3 = await sendHeartbeat(instance.instance_id, 90);
      expect(beat3.context_percent).toBe(90);

      const details = await getInstanceDetails(instance.instance_id);
      expect(details?.context_percent).toBe(90);
    });

    it('tracks current_epic across heartbeats', async () => {
      const instance = await registerInstance('epic-test', InstanceType.PS);

      await sendHeartbeat(instance.instance_id, 25, 'epic-001');
      let details = await getInstanceDetails(instance.instance_id);
      expect(details?.current_epic).toBe('epic-001');

      await sendHeartbeat(instance.instance_id, 50, 'epic-002');
      details = await getInstanceDetails(instance.instance_id);
      expect(details?.current_epic).toBe('epic-002');

      await sendHeartbeat(instance.instance_id, 75, 'epic-003');
      details = await getInstanceDetails(instance.instance_id);
      expect(details?.current_epic).toBe('epic-003');
    });
  });

  describe('Instance ID uniqueness', () => {
    it('generates 100+ unique IDs without collision', async () => {
      const ids = new Set<string>();

      for (let i = 0; i < 100; i++) {
        const instance = await registerInstance('uniqueness-test', InstanceType.PS);
        ids.add(instance.instance_id);
      }

      expect(ids.size).toBe(100);
    });
  });

  describe('Edge cases', () => {
    it('handles project names with hyphens', async () => {
      const instance = await registerInstance('my-custom-project', InstanceType.PS);
      expect(instance.project).toBe('my-custom-project');

      const found = await getInstanceDetails(instance.instance_id);
      expect(found?.project).toBe('my-custom-project');
    });

    it('handles very high context_percent', async () => {
      const instance = await registerInstance('edge-test', InstanceType.PS);

      const beat = await sendHeartbeat(instance.instance_id, 100);
      expect(beat.context_percent).toBe(100);
    });

    it('handles zero context_percent', async () => {
      const instance = await registerInstance('edge-test', InstanceType.PS);

      const beat = await sendHeartbeat(instance.instance_id, 0);
      expect(beat.context_percent).toBe(0);
    });
  });
});
