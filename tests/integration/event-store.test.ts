/**
 * Integration Tests for EventStore (Epic 007-C)
 * Full lifecycle and cross-system integration testing
 *
 * Test scenarios:
 * 1. Full lifecycle: Register → Emit → Query → Replay
 * 2. Concurrent instances
 * 3. Event ordering
 * 4. Large datasets
 * 5. Performance under load
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import {
  emitEvent,
  queryEvents,
  replayEvents,
  getEventCount,
  deleteEventsForInstance,
} from '../../src/session/EventStore.js';
import { registerInstance, listInstances } from '../../src/session/InstanceRegistry.js';
import { pool } from '../../src/db/client.js';

describe('EventStore Integration Tests', () => {
  let testInstanceId: string;

  beforeAll(async () => {
    const instance = await registerInstance('integration-test', 'PS');
    testInstanceId = instance.instance_id;
  });

  afterAll(async () => {
    if (testInstanceId) {
      await deleteEventsForInstance(testInstanceId);
    }
    await pool.end();
  });

  beforeEach(async () => {
    if (testInstanceId) {
      await deleteEventsForInstance(testInstanceId);
    }
  });

  describe('Full Lifecycle', () => {
    it('completes register → emit → query → replay flow', async () => {
      // 1. Register instance (already done in beforeAll)
      expect(testInstanceId).toBeDefined();

      // 2. Emit events
      const event1 = await emitEvent(testInstanceId, 'epic_started', {
        epic_id: 'epic-001',
        feature_name: 'authentication',
        estimated_hours: 60,
        spawned_by: 'plan-feature',
        acceptance_criteria_count: 12,
      });

      const event2 = await emitEvent(testInstanceId, 'test_passed', {
        test_type: 'unit',
        passed_count: 100,
        failed_count: 0,
        coverage_percent: 95,
        duration_seconds: 45,
      });

      const event3 = await emitEvent(testInstanceId, 'epic_completed', {
        epic_id: 'epic-001',
        duration_hours: 58,
        files_changed: 25,
        tests_passed: 200,
        validation_confidence: 0.97,
      });

      // 3. Query events
      const queryResult = await queryEvents(testInstanceId);

      expect(queryResult.total_count).toBe(3);
      expect(queryResult.events.length).toBe(3);
      expect(queryResult.events[0].event_type).toBe('epic_started');
      expect(queryResult.events[1].event_type).toBe('test_passed');
      expect(queryResult.events[2].event_type).toBe('epic_completed');

      // 4. Replay events
      const replayResult = await replayEvents(testInstanceId);

      expect(replayResult.events_replayed).toBe(3);
      expect(replayResult.final_state.last_epic).toBe('epic-001');
      expect(replayResult.final_state.last_event_type).toBe('epic_completed');
      expect(replayResult.final_state.latest_timestamp).toBeDefined();
    });
  });

  describe('Event Ordering', () => {
    it('maintains strict ordering across multiple events', async () => {
      const eventIds = [];

      for (let i = 1; i <= 10; i++) {
        const result = await emitEvent(testInstanceId, 'instance_heartbeat', {
          context_percent: i * 10,
        });
        eventIds.push(result.sequence_num);
      }

      // Verify sequence is strictly increasing
      for (let i = 1; i < eventIds.length; i++) {
        expect(eventIds[i]).toBe(eventIds[i - 1] + 1);
      }
    });

    it('query returns events in sequence order', async () => {
      for (let i = 1; i <= 5; i++) {
        await emitEvent(testInstanceId, 'instance_heartbeat', {
          context_percent: i * 20,
        });
      }

      const result = await queryEvents(testInstanceId);

      for (let i = 1; i < result.events.length; i++) {
        expect(result.events[i].sequence_num).toBeGreaterThan(
          result.events[i - 1].sequence_num
        );
      }
    });
  });

  describe('Concurrent Instances', () => {
    it('isolates events between different instances', async () => {
      const instance1 = await registerInstance('integration-test', 'PS');
      const instance2 = await registerInstance('integration-test', 'PS');

      await emitEvent(instance1.instance_id, 'epic_started', {
        epic_id: 'epic-i1',
        feature_name: 'feature1',
        estimated_hours: 40,
        spawned_by: 'test',
        acceptance_criteria_count: 8,
      });

      await emitEvent(instance2.instance_id, 'epic_started', {
        epic_id: 'epic-i2',
        feature_name: 'feature2',
        estimated_hours: 50,
        spawned_by: 'test',
        acceptance_criteria_count: 10,
      });

      const result1 = await queryEvents(instance1.instance_id);
      const result2 = await queryEvents(instance2.instance_id);

      expect(result1.total_count).toBe(1);
      expect(result2.total_count).toBe(1);
      expect(result1.events[0].event_data.epic_id).toBe('epic-i1');
      expect(result2.events[0].event_data.epic_id).toBe('epic-i2');

      // Cleanup
      await deleteEventsForInstance(instance1.instance_id);
      await deleteEventsForInstance(instance2.instance_id);
    });

    it('maintains separate sequence numbers per instance', async () => {
      const instance1 = await registerInstance('integration-test', 'PS');
      const instance2 = await registerInstance('integration-test', 'PS');

      const e1_1 = await emitEvent(instance1.instance_id, 'epic_started', {
        epic_id: 'e1',
        feature_name: 'f',
        estimated_hours: 40,
        spawned_by: 't',
        acceptance_criteria_count: 8,
      });

      const e2_1 = await emitEvent(instance2.instance_id, 'epic_started', {
        epic_id: 'e2',
        feature_name: 'f',
        estimated_hours: 40,
        spawned_by: 't',
        acceptance_criteria_count: 8,
      });

      const e1_2 = await emitEvent(instance1.instance_id, 'epic_completed', {
        epic_id: 'e1',
        duration_hours: 39,
        files_changed: 10,
        tests_passed: 50,
      });

      expect(e1_1.sequence_num).toBe(1);
      expect(e2_1.sequence_num).toBe(1); // Separate sequence for different instance
      expect(e1_2.sequence_num).toBe(2); // Continues sequence for same instance

      // Cleanup
      await deleteEventsForInstance(instance1.instance_id);
      await deleteEventsForInstance(instance2.instance_id);
    });
  });

  describe('Large Datasets', () => {
    it('handles 100+ events efficiently', async () => {
      const start = Date.now();

      // Emit 100 events
      for (let i = 0; i < 100; i++) {
        await emitEvent(testInstanceId, 'instance_heartbeat', {
          context_percent: (i % 100) + 1,
        });
      }

      const emitDuration = Date.now() - start;

      // Query them
      const queryStart = Date.now();
      const result = await queryEvents(testInstanceId, {}, 1000);
      const queryDuration = Date.now() - queryStart;

      // Replay them
      const replayStart = Date.now();
      const replayResult = await replayEvents(testInstanceId);
      const replayDuration = Date.now() - replayStart;

      expect(result.total_count).toBe(100);
      expect(replayResult.events_replayed).toBe(100);

      // Verify performance targets (allowing for test overhead)
      expect(emitDuration).toBeLessThan(5000); // ~50ms per event
      expect(queryDuration).toBeLessThan(500); // Should handle 100 events quickly
      expect(replayDuration).toBeLessThan(1000); // Replay should be fast
    });

    it('supports pagination for large result sets', async () => {
      // Emit 50 events
      for (let i = 0; i < 50; i++) {
        await emitEvent(testInstanceId, 'instance_heartbeat', {
          context_percent: i % 100,
        });
      }

      // Query in pages
      const page1 = await queryEvents(testInstanceId, {}, 10, 0);
      const page2 = await queryEvents(testInstanceId, {}, 10, 10);
      const page3 = await queryEvents(testInstanceId, {}, 10, 40);

      expect(page1.events.length).toBe(10);
      expect(page2.events.length).toBe(10);
      expect(page3.events.length).toBe(10);
      expect(page1.total_count).toBe(50);

      // Verify no overlap
      const ids1 = page1.events.map((e) => e.event_id);
      const ids2 = page2.events.map((e) => e.event_id);

      for (const id of ids1) {
        expect(ids2).not.toContain(id);
      }
    });
  });

  describe('Query Filtering', () => {
    it('filters by event type correctly', async () => {
      await emitEvent(testInstanceId, 'epic_started', {
        epic_id: 'epic-001',
        feature_name: 'f',
        estimated_hours: 40,
        spawned_by: 't',
        acceptance_criteria_count: 8,
      });

      await emitEvent(testInstanceId, 'test_passed', {
        test_type: 'unit',
        passed_count: 50,
        failed_count: 0,
        duration_seconds: 30,
      });

      await emitEvent(testInstanceId, 'epic_completed', {
        epic_id: 'epic-001',
        duration_hours: 39,
        files_changed: 10,
        tests_passed: 100,
      });

      const result = await queryEvents(testInstanceId, {
        event_type: 'epic_started',
      });

      expect(result.total_count).toBe(1);
      expect(result.events[0].event_type).toBe('epic_started');
    });

    it('filters by multiple event types', async () => {
      await emitEvent(testInstanceId, 'epic_started', {
        epic_id: 'e1',
        feature_name: 'f',
        estimated_hours: 40,
        spawned_by: 't',
        acceptance_criteria_count: 8,
      });

      await emitEvent(testInstanceId, 'test_passed', {
        test_type: 'unit',
        passed_count: 50,
        failed_count: 0,
        duration_seconds: 30,
      });

      await emitEvent(testInstanceId, 'deployment_completed', {
        service: 'api',
        environment: 'local',
        health_status: 'healthy',
        duration_seconds: 120,
      });

      const result = await queryEvents(testInstanceId, {
        event_type: ['epic_started', 'deployment_completed'],
      });

      expect(result.total_count).toBe(2);
      expect(result.events.map((e) => e.event_type)).not.toContain('test_passed');
    });

    it('filters by keyword in event data', async () => {
      await emitEvent(testInstanceId, 'epic_started', {
        epic_id: 'epic-auth',
        feature_name: 'authentication',
        estimated_hours: 40,
        spawned_by: 't',
        acceptance_criteria_count: 8,
      });

      await emitEvent(testInstanceId, 'epic_started', {
        epic_id: 'epic-payment',
        feature_name: 'payments',
        estimated_hours: 50,
        spawned_by: 't',
        acceptance_criteria_count: 10,
      });

      const result = await queryEvents(testInstanceId, {
        keyword: 'authentication',
      });

      expect(result.total_count).toBeGreaterThanOrEqual(1);
      expect(
        result.events.some((e) => e.event_data.feature_name === 'authentication')
      ).toBe(true);
    });
  });

  describe('Replay Accuracy', () => {
    it('partial replay stops at specified sequence', async () => {
      await emitEvent(testInstanceId, 'epic_started', {
        epic_id: 'epic-001',
        feature_name: 'f',
        estimated_hours: 40,
        spawned_by: 't',
        acceptance_criteria_count: 8,
      });

      await emitEvent(testInstanceId, 'test_passed', {
        test_type: 'unit',
        passed_count: 50,
        failed_count: 0,
        duration_seconds: 30,
      });

      await emitEvent(testInstanceId, 'epic_completed', {
        epic_id: 'epic-001',
        duration_hours: 39,
        files_changed: 10,
        tests_passed: 100,
      });

      const fullReplay = await replayEvents(testInstanceId);
      const partialReplay = await replayEvents(testInstanceId, 2);

      expect(fullReplay.events_replayed).toBe(3);
      expect(partialReplay.events_replayed).toBe(2);
      expect(fullReplay.final_state.last_event_type).toBe('epic_completed');
      expect(partialReplay.final_state.last_event_type).toBe('test_passed');
    });

    it('replay reflects all event data correctly', async () => {
      const epicId = 'epic-reconstruction-test';

      await emitEvent(testInstanceId, 'epic_started', {
        epic_id: epicId,
        feature_name: 'complex-feature',
        estimated_hours: 80,
        spawned_by: 'plan-feature',
        acceptance_criteria_count: 15,
      });

      const replayResult = await replayEvents(testInstanceId);

      expect(replayResult.final_state.last_epic).toBe(epicId);
      expect(replayResult.events_replayed).toBe(1);
    });
  });

  describe('Performance Benchmarks', () => {
    it('emit completes within target latency', async () => {
      const durations: number[] = [];

      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        await emitEvent(testInstanceId, 'instance_heartbeat', {
          context_percent: i * 10,
        });
        durations.push(Date.now() - start);
      }

      const maxDuration = Math.max(...durations);
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

      expect(maxDuration).toBeLessThan(50); // 10ms target with 5x tolerance for tests
      expect(avgDuration).toBeLessThan(20);
    });

    it('query completes within target latency', async () => {
      // Emit 100 events
      for (let i = 0; i < 100; i++) {
        await emitEvent(testInstanceId, 'instance_heartbeat', {
          context_percent: i % 100,
        });
      }

      const start = Date.now();
      const result = await queryEvents(testInstanceId, {}, 100);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500); // 100ms target with 5x tolerance
      expect(result.total_count).toBe(100);
    });

    it('replay completes within target latency', async () => {
      // Emit 100 events
      for (let i = 0; i < 100; i++) {
        await emitEvent(testInstanceId, 'instance_heartbeat', {
          context_percent: i % 100,
        });
      }

      const start = Date.now();
      const result = await replayEvents(testInstanceId);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500); // 200ms target with 2.5x tolerance
      expect(result.events_replayed).toBe(100);
    });
  });
});
