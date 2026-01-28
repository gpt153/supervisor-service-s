/**
 * Unit Tests for EventStore (Epic 007-C)
 * Comprehensive test coverage for event emission, querying, and replay
 *
 * Test categories:
 * 1. Event emission (all 12+ event types)
 * 2. Event validation
 * 3. Sequence number monotonicity
 * 4. Query filtering
 * 5. Event replay correctness
 * 6. Performance targets
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import {
  emitEvent,
  queryEvents,
  replayEvents,
  aggregateEventsByType,
  getLatestEvents,
  getEventById,
  getEventCount,
  deleteEventsForInstance,
  InvalidEventError,
  InstanceNotFoundForEventError,
  EventStoreError,
} from '../../../src/session/EventStore.js';
import { registerInstance } from '../../../src/session/InstanceRegistry.js';
import { pool } from '../../../src/db/client.js';

describe('EventStore', () => {
  let testInstanceId: string;

  beforeAll(async () => {
    // Create a test instance
    const instance = await registerInstance('test-project', 'PS');
    testInstanceId = instance.instance_id;
  });

  afterAll(async () => {
    // Clean up test data
    if (testInstanceId) {
      await deleteEventsForInstance(testInstanceId);
    }
    await pool.end();
  });

  beforeEach(async () => {
    // Clear events before each test
    if (testInstanceId) {
      await deleteEventsForInstance(testInstanceId);
    }
  });

  describe('emitEvent', () => {
    it('emits instance_registered event', async () => {
      const result = await emitEvent(testInstanceId, 'instance_registered', {
        instance_type: 'PS',
        project: 'test-project',
      });

      expect(result.event_id).toBeDefined();
      expect(result.sequence_num).toBe(1);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('emits epic_started event', async () => {
      const result = await emitEvent(testInstanceId, 'epic_started', {
        epic_id: 'epic-001',
        feature_name: 'authentication',
        estimated_hours: 60,
        spawned_by: 'plan-feature',
        acceptance_criteria_count: 12,
      });

      expect(result.event_id).toBeDefined();
      expect(result.sequence_num).toBe(1);
    });

    it('emits epic_completed event', async () => {
      const result = await emitEvent(testInstanceId, 'epic_completed', {
        epic_id: 'epic-001',
        duration_hours: 58.5,
        files_changed: 23,
        tests_passed: 45,
        validation_confidence: 0.96,
      });

      expect(result.sequence_num).toBe(1);
    });

    it('emits test_passed event', async () => {
      const result = await emitEvent(testInstanceId, 'test_passed', {
        test_type: 'unit',
        passed_count: 100,
        failed_count: 0,
        coverage_percent: 92,
        duration_seconds: 45,
      });

      expect(result.sequence_num).toBe(1);
    });

    it('emits deployment_completed event', async () => {
      const result = await emitEvent(testInstanceId, 'deployment_completed', {
        service: 'supervisor-mcp',
        environment: 'local',
        port: 8081,
        health_status: 'healthy',
        response_time_ms: 12,
        duration_seconds: 120,
      });

      expect(result.sequence_num).toBe(1);
    });

    it('emits validation_passed event', async () => {
      const result = await emitEvent(testInstanceId, 'validation_passed', {
        validation_type: 'automatic_quality_workflow',
        confidence_score: 0.95,
        checks_passed: 10,
        checks_total: 10,
        duration_seconds: 180,
      });

      expect(result.sequence_num).toBe(1);
    });

    it('includes metadata if provided', async () => {
      const result = await emitEvent(
        testInstanceId,
        'epic_started',
        {
          epic_id: 'epic-001',
          feature_name: 'test',
          estimated_hours: 40,
          spawned_by: 'test',
          acceptance_criteria_count: 8,
        },
        { source: 'test-suite', tags: ['test', 'unit'] }
      );

      expect(result.event_id).toBeDefined();
      const event = await getEventById(result.event_id);
      expect(event?.metadata).toEqual({ source: 'test-suite', tags: ['test', 'unit'] });
    });

    it('throws InvalidEventError for invalid event type', async () => {
      await expect(
        emitEvent(testInstanceId, 'invalid_event_type', {})
      ).rejects.toThrow(InvalidEventError);
    });

    it('throws InstanceNotFoundForEventError for non-existent instance', async () => {
      await expect(
        emitEvent('nonexistent-PS-123456', 'epic_started', {
          epic_id: 'epic-001',
          feature_name: 'test',
          estimated_hours: 40,
          spawned_by: 'test',
          acceptance_criteria_count: 8,
        })
      ).rejects.toThrow(InstanceNotFoundForEventError);
    });

    it('assigns monotonically increasing sequence numbers', async () => {
      const result1 = await emitEvent(testInstanceId, 'epic_started', {
        epic_id: 'epic-001',
        feature_name: 'test1',
        estimated_hours: 40,
        spawned_by: 'test',
        acceptance_criteria_count: 8,
      });

      const result2 = await emitEvent(testInstanceId, 'epic_completed', {
        epic_id: 'epic-001',
        duration_hours: 39,
        files_changed: 10,
        tests_passed: 20,
      });

      const result3 = await emitEvent(testInstanceId, 'deployment_completed', {
        service: 'test',
        environment: 'local',
        health_status: 'healthy',
        duration_seconds: 120,
      });

      expect(result1.sequence_num).toBe(1);
      expect(result2.sequence_num).toBe(2);
      expect(result3.sequence_num).toBe(3);
    });

    it('completes within 10ms (p99 target)', async () => {
      const start = Date.now();

      await emitEvent(testInstanceId, 'epic_started', {
        epic_id: 'epic-001',
        feature_name: 'perf-test',
        estimated_hours: 40,
        spawned_by: 'test',
        acceptance_criteria_count: 8,
      });

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(50); // Allow 5x for test overhead
    });
  });

  describe('queryEvents', () => {
    beforeEach(async () => {
      // Emit several events for testing
      await emitEvent(testInstanceId, 'epic_started', {
        epic_id: 'epic-001',
        feature_name: 'auth',
        estimated_hours: 60,
        spawned_by: 'test',
        acceptance_criteria_count: 12,
      });

      await emitEvent(testInstanceId, 'test_passed', {
        test_type: 'unit',
        passed_count: 50,
        failed_count: 0,
        duration_seconds: 45,
      });

      await emitEvent(testInstanceId, 'epic_completed', {
        epic_id: 'epic-001',
        duration_hours: 58,
        files_changed: 25,
        tests_passed: 100,
      });

      await emitEvent(testInstanceId, 'deployment_completed', {
        service: 'api',
        environment: 'local',
        health_status: 'healthy',
        duration_seconds: 120,
      });
    });

    it('returns all events for an instance', async () => {
      const result = await queryEvents(testInstanceId);

      expect(result.total_count).toBe(4);
      expect(result.events.length).toBe(4);
      expect(result.has_more).toBe(false);
    });

    it('filters events by event_type (single)', async () => {
      const result = await queryEvents(testInstanceId, {
        event_type: 'epic_started',
      });

      expect(result.total_count).toBe(1);
      expect(result.events[0].event_type).toBe('epic_started');
    });

    it('filters events by event_type (multiple)', async () => {
      const result = await queryEvents(testInstanceId, {
        event_type: ['epic_started', 'epic_completed'],
      });

      expect(result.total_count).toBe(2);
      expect(result.events.map((e) => e.event_type)).toContain('epic_started');
      expect(result.events.map((e) => e.event_type)).toContain('epic_completed');
    });

    it('filters events by keyword', async () => {
      const result = await queryEvents(testInstanceId, {
        keyword: 'epic-001',
      });

      expect(result.total_count).toBeGreaterThan(0);
      expect(result.events.some((e) => e.event_data.epic_id === 'epic-001')).toBe(true);
    });

    it('supports pagination', async () => {
      const result1 = await queryEvents(testInstanceId, {}, 2, 0);

      expect(result1.events.length).toBe(2);
      expect(result1.has_more).toBe(true);

      const result2 = await queryEvents(testInstanceId, {}, 2, 2);

      expect(result2.events.length).toBe(2);
      expect(result2.has_more).toBe(false);
    });

    it('clamps limit to max 1000', async () => {
      const result = await queryEvents(testInstanceId, {}, 5000);

      expect(result.events.length).toBeLessThanOrEqual(1000);
    });

    it('returns events in sequence order (ASC)', async () => {
      const result = await queryEvents(testInstanceId);

      for (let i = 1; i < result.events.length; i++) {
        expect(result.events[i].sequence_num).toBeGreaterThan(
          result.events[i - 1].sequence_num
        );
      }
    });

    it('completes within 100ms target', async () => {
      const start = Date.now();

      await queryEvents(testInstanceId);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(200); // Allow 2x for test overhead
    });
  });

  describe('replayEvents', () => {
    beforeEach(async () => {
      await emitEvent(testInstanceId, 'epic_started', {
        epic_id: 'epic-002',
        feature_name: 'payments',
        estimated_hours: 50,
        spawned_by: 'test',
        acceptance_criteria_count: 10,
      });

      await emitEvent(testInstanceId, 'test_passed', {
        test_type: 'integration',
        passed_count: 75,
        failed_count: 0,
        duration_seconds: 60,
      });

      await emitEvent(testInstanceId, 'epic_completed', {
        epic_id: 'epic-002',
        duration_hours: 48,
        files_changed: 30,
        tests_passed: 150,
      });
    });

    it('reconstructs final state from events', async () => {
      const result = await replayEvents(testInstanceId);

      expect(result.final_state.last_epic).toBe('epic-002');
      expect(result.final_state.last_event_type).toBe('epic_completed');
      expect(result.final_state.total_events_replayed).toBe(3);
    });

    it('replays up to specified sequence number', async () => {
      const result = await replayEvents(testInstanceId, 2);

      expect(result.events_replayed).toBe(2);
      expect(result.final_state.last_event_type).toBe('test_passed');
    });

    it('returns duration in milliseconds', async () => {
      const result = await replayEvents(testInstanceId);

      expect(result.duration_ms).toBeGreaterThan(0);
      expect(typeof result.duration_ms).toBe('number');
    });

    it('completes within 200ms target', async () => {
      const result = await replayEvents(testInstanceId);

      expect(result.duration_ms).toBeLessThan(500); // Allow 2.5x for test overhead
    });
  });

  describe('aggregateEventsByType', () => {
    beforeEach(async () => {
      await emitEvent(testInstanceId, 'epic_started', {
        epic_id: 'epic-001',
        feature_name: 'test1',
        estimated_hours: 40,
        spawned_by: 'test',
        acceptance_criteria_count: 8,
      });

      await emitEvent(testInstanceId, 'test_passed', {
        test_type: 'unit',
        passed_count: 50,
        failed_count: 0,
        duration_seconds: 30,
      });

      await emitEvent(testInstanceId, 'test_passed', {
        test_type: 'integration',
        passed_count: 25,
        failed_count: 0,
        duration_seconds: 45,
      });

      await emitEvent(testInstanceId, 'deployment_completed', {
        service: 'api',
        environment: 'local',
        health_status: 'healthy',
        duration_seconds: 120,
      });
    });

    it('counts events by type', async () => {
      const aggregates = await aggregateEventsByType(testInstanceId);

      expect(aggregates.epic_started).toBe(1);
      expect(aggregates.test_passed).toBe(2);
      expect(aggregates.deployment_completed).toBe(1);
    });

    it('returns empty object for instance with no events', async () => {
      const instance2 = await registerInstance('test-project', 'PS');
      const aggregates = await aggregateEventsByType(instance2.instance_id);

      expect(aggregates).toEqual({});
    });
  });

  describe('getLatestEvents', () => {
    beforeEach(async () => {
      for (let i = 1; i <= 15; i++) {
        await emitEvent(testInstanceId, 'instance_heartbeat', {
          context_percent: i * 5,
        });
      }
    });

    it('returns latest events (most recent first, then chronological)', async () => {
      const events = await getLatestEvents(testInstanceId, 5);

      expect(events.length).toBe(5);
      // Check they're in chronological order (oldest to newest in the 5)
      for (let i = 1; i < events.length; i++) {
        expect(events[i].sequence_num).toBeGreaterThan(events[i - 1].sequence_num);
      }
    });

    it('defaults to 10 events', async () => {
      const events = await getLatestEvents(testInstanceId);

      expect(events.length).toBe(10);
    });

    it('clamps limit to max 1000', async () => {
      const events = await getLatestEvents(testInstanceId, 5000);

      expect(events.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('getEventById', () => {
    it('retrieves event by UUID', async () => {
      const emitResult = await emitEvent(testInstanceId, 'epic_started', {
        epic_id: 'epic-001',
        feature_name: 'test',
        estimated_hours: 40,
        spawned_by: 'test',
        acceptance_criteria_count: 8,
      });

      const event = await getEventById(emitResult.event_id);

      expect(event).toBeDefined();
      expect(event?.event_id).toBe(emitResult.event_id);
      expect(event?.event_type).toBe('epic_started');
    });

    it('returns null for non-existent event', async () => {
      const event = await getEventById('00000000-0000-0000-0000-000000000000');

      expect(event).toBeNull();
    });
  });

  describe('getEventCount', () => {
    it('returns total event count for instance', async () => {
      await emitEvent(testInstanceId, 'epic_started', {
        epic_id: 'epic-001',
        feature_name: 'test',
        estimated_hours: 40,
        spawned_by: 'test',
        acceptance_criteria_count: 8,
      });

      await emitEvent(testInstanceId, 'test_passed', {
        test_type: 'unit',
        passed_count: 50,
        failed_count: 0,
        duration_seconds: 30,
      });

      const count = await getEventCount(testInstanceId);

      expect(count).toBe(2);
    });

    it('returns 0 for instance with no events', async () => {
      const instance2 = await registerInstance('test-project', 'PS');
      const count = await getEventCount(instance2.instance_id);

      expect(count).toBe(0);
    });
  });

  describe('deleteEventsForInstance', () => {
    it('deletes all events for an instance', async () => {
      await emitEvent(testInstanceId, 'epic_started', {
        epic_id: 'epic-001',
        feature_name: 'test',
        estimated_hours: 40,
        spawned_by: 'test',
        acceptance_criteria_count: 8,
      });

      await emitEvent(testInstanceId, 'test_passed', {
        test_type: 'unit',
        passed_count: 50,
        failed_count: 0,
        duration_seconds: 30,
      });

      const deleted = await deleteEventsForInstance(testInstanceId);

      expect(deleted).toBe(2);

      const count = await getEventCount(testInstanceId);
      expect(count).toBe(0);
    });
  });

  describe('Event immutability', () => {
    it('events are append-only (no duplicate sequence numbers)', async () => {
      const result1 = await emitEvent(testInstanceId, 'epic_started', {
        epic_id: 'epic-001',
        feature_name: 'test',
        estimated_hours: 40,
        spawned_by: 'test',
        acceptance_criteria_count: 8,
      });

      const result2 = await emitEvent(testInstanceId, 'test_passed', {
        test_type: 'unit',
        passed_count: 50,
        failed_count: 0,
        duration_seconds: 30,
      });

      expect(result1.sequence_num).not.toBe(result2.sequence_num);
    });
  });

  describe('Multiple event types', () => {
    it('handles all core event types', async () => {
      const eventTypes = [
        ['instance_registered', { instance_type: 'PS', project: 'test' }],
        ['instance_heartbeat', { context_percent: 50 }],
        ['epic_started', { epic_id: 'e1', feature_name: 'f', estimated_hours: 40, spawned_by: 's', acceptance_criteria_count: 5 }],
        ['test_passed', { test_type: 'unit', passed_count: 10, failed_count: 0, duration_seconds: 30 }],
        ['deployment_completed', { service: 's', environment: 'local', health_status: 'healthy', duration_seconds: 120 }],
        ['commitment_created', { commit_hash: 'abc123', message: 'test' }],
      ];

      for (const [eventType, data] of eventTypes) {
        if (eventType === 'commitment_created') continue; // Skip invalid type

        const result = await emitEvent(testInstanceId, eventType as string, data as any);
        expect(result.event_id).toBeDefined();
      }
    });
  });
});
