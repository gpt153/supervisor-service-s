/**
 * EventStore Test Runner
 * Runs unit and integration tests for EventStore (Epic 007-C)
 */

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
} from '../src/session/EventStore.js';
import { registerInstance } from '../src/session/InstanceRegistry.js';
import { pool } from '../src/db/client.js';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

async function runTest(name: string, testFn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await testFn();
    results.push({ name, passed: true, duration: Date.now() - start });
    console.log(`✅ ${name}`);
  } catch (error: any) {
    results.push({
      name,
      passed: false,
      error: error.message,
      duration: Date.now() - start,
    });
    console.log(`❌ ${name}: ${error.message}`);
  }
}

async function assertEqual(actual: any, expected: any, message: string): Promise<void> {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

async function assertGreaterThan(actual: number, expected: number, message: string): Promise<void> {
  if (actual <= expected) {
    throw new Error(`${message}: expected > ${expected}, got ${actual}`);
  }
}

async function runAllTests(): Promise<void> {
  console.log('=== EventStore Unit Tests ===\n');

  let testInstanceId: string;
  let instance2Id: string;

  // Setup
  try {
    const instance = await registerInstance('test-project', 'PS');
    testInstanceId = instance.instance_id;
    console.log(`Created test instance: ${testInstanceId}\n`);
  } catch (error: any) {
    console.error('Failed to create test instance:', error.message);
    process.exit(1);
  }

  // Test: Event Emission
  await runTest('emit instance_registered event', async () => {
    const result = await emitEvent(testInstanceId, 'instance_registered', {
      instance_type: 'PS',
      project: 'test-project',
    });
    if (!result.event_id) throw new Error('No event_id returned');
    if (result.sequence_num !== 1) throw new Error(`Expected sequence_num 1, got ${result.sequence_num}`);
  });

  await runTest('emit epic_started event', async () => {
    await deleteEventsForInstance(testInstanceId);
    const result = await emitEvent(testInstanceId, 'epic_started', {
      epic_id: 'epic-001',
      feature_name: 'auth',
      estimated_hours: 60,
      spawned_by: 'plan-feature',
      acceptance_criteria_count: 12,
    });
    if (result.sequence_num !== 1) throw new Error('sequence_num should be 1');
  });

  await runTest('emit validation_passed event', async () => {
    await deleteEventsForInstance(testInstanceId);
    const result = await emitEvent(testInstanceId, 'validation_passed', {
      validation_type: 'automatic_quality_workflow',
      confidence_score: 0.95,
      checks_passed: 10,
      checks_total: 10,
      duration_seconds: 180,
    });
    if (!result.event_id) throw new Error('No event_id returned');
  });

  await runTest('assign monotonically increasing sequence numbers', async () => {
    await deleteEventsForInstance(testInstanceId);
    const r1 = await emitEvent(testInstanceId, 'epic_started', {
      epic_id: 'e1',
      feature_name: 'f',
      estimated_hours: 40,
      spawned_by: 't',
      acceptance_criteria_count: 8,
    });
    const r2 = await emitEvent(testInstanceId, 'test_passed', {
      test_type: 'unit',
      passed_count: 50,
      failed_count: 0,
      duration_seconds: 30,
    });
    const r3 = await emitEvent(testInstanceId, 'deployment_completed', {
      service: 'api',
      environment: 'local',
      health_status: 'healthy',
      duration_seconds: 120,
    });

    if (r1.sequence_num !== 1) throw new Error('r1 should be 1');
    if (r2.sequence_num !== 2) throw new Error('r2 should be 2');
    if (r3.sequence_num !== 3) throw new Error('r3 should be 3');
  });

  await runTest('throw InvalidEventError for invalid event type', async () => {
    try {
      await emitEvent(testInstanceId, 'invalid_type', {});
      throw new Error('Should have thrown InvalidEventError');
    } catch (error: any) {
      if (!(error instanceof InvalidEventError)) throw new Error('Should throw InvalidEventError');
    }
  });

  await runTest('throw InstanceNotFoundForEventError for non-existent instance', async () => {
    try {
      await emitEvent('nonexistent-PS-123456', 'epic_started', {
        epic_id: 'e1',
        feature_name: 'f',
        estimated_hours: 40,
        spawned_by: 't',
        acceptance_criteria_count: 8,
      });
      throw new Error('Should have thrown InstanceNotFoundForEventError');
    } catch (error: any) {
      if (!(error instanceof InstanceNotFoundForEventError)) {
        throw new Error('Should throw InstanceNotFoundForEventError');
      }
    }
  });

  // Test: Query Events
  await runTest('query returns all events for instance', async () => {
    await deleteEventsForInstance(testInstanceId);
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

    const result = await queryEvents(testInstanceId);
    if (result.total_count !== 2) throw new Error(`Expected 2 events, got ${result.total_count}`);
    if (result.events.length !== 2) throw new Error(`Expected 2 in array, got ${result.events.length}`);
  });

  await runTest('filter events by event_type', async () => {
    await deleteEventsForInstance(testInstanceId);
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

    const result = await queryEvents(testInstanceId, { event_type: 'epic_started' });
    if (result.total_count !== 1) throw new Error(`Expected 1 event, got ${result.total_count}`);
    if (result.events[0].event_type !== 'epic_started') {
      throw new Error('Wrong event type returned');
    }
  });

  await runTest('support pagination', async () => {
    await deleteEventsForInstance(testInstanceId);
    for (let i = 0; i < 5; i++) {
      await emitEvent(testInstanceId, 'instance_heartbeat', { context_percent: i * 20 });
    }

    const page1 = await queryEvents(testInstanceId, {}, 2, 0);
    const page2 = await queryEvents(testInstanceId, {}, 2, 2);

    if (page1.events.length !== 2) throw new Error('Page 1 should have 2 events');
    if (page2.events.length !== 2) throw new Error('Page 2 should have 2 events');
    if (!page1.has_more) throw new Error('Page 1 should have more');
    if (page2.has_more) throw new Error('Page 2 should not have more');
  });

  // Test: Replay Events
  await runTest('reconstruct final state from events', async () => {
    await deleteEventsForInstance(testInstanceId);
    await emitEvent(testInstanceId, 'epic_started', {
      epic_id: 'epic-002',
      feature_name: 'payment',
      estimated_hours: 50,
      spawned_by: 't',
      acceptance_criteria_count: 10,
    });
    await emitEvent(testInstanceId, 'test_passed', {
      test_type: 'unit',
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

    const result = await replayEvents(testInstanceId);

    if (result.final_state.last_epic !== 'epic-002') {
      throw new Error(`Expected last_epic 'epic-002', got ${result.final_state.last_epic}`);
    }
    if (result.final_state.last_event_type !== 'epic_completed') {
      throw new Error('Expected last_event_type epic_completed');
    }
    if (result.events_replayed !== 3) throw new Error('Expected 3 events replayed');
  });

  await runTest('replay up to specified sequence number', async () => {
    await deleteEventsForInstance(testInstanceId);
    for (let i = 0; i < 5; i++) {
      await emitEvent(testInstanceId, 'instance_heartbeat', { context_percent: i * 20 });
    }

    const result = await replayEvents(testInstanceId, 3);

    if (result.events_replayed !== 3) throw new Error(`Expected 3 events, got ${result.events_replayed}`);
  });

  // Test: Aggregation
  await runTest('count events by type', async () => {
    await deleteEventsForInstance(testInstanceId);
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
    await emitEvent(testInstanceId, 'test_passed', {
      test_type: 'integration',
      passed_count: 25,
      failed_count: 0,
      duration_seconds: 45,
    });

    const aggregates = await aggregateEventsByType(testInstanceId);

    if (aggregates.epic_started !== 1) throw new Error('Should have 1 epic_started');
    if (aggregates.test_passed !== 2) throw new Error('Should have 2 test_passed');
  });

  // Test: Get Latest Events
  await runTest('return latest events', async () => {
    await deleteEventsForInstance(testInstanceId);
    for (let i = 1; i <= 15; i++) {
      await emitEvent(testInstanceId, 'instance_heartbeat', { context_percent: i * 5 });
    }

    const events = await getLatestEvents(testInstanceId, 5);

    if (events.length !== 5) throw new Error(`Expected 5 events, got ${events.length}`);
  });

  // Test: Get Event By ID
  await runTest('retrieve event by UUID', async () => {
    await deleteEventsForInstance(testInstanceId);
    const emitResult = await emitEvent(testInstanceId, 'epic_started', {
      epic_id: 'e1',
      feature_name: 'f',
      estimated_hours: 40,
      spawned_by: 't',
      acceptance_criteria_count: 8,
    });

    const event = await getEventById(emitResult.event_id);

    if (!event) throw new Error('Event not found');
    if (event.event_id !== emitResult.event_id) throw new Error('Wrong event returned');
    if (event.event_type !== 'epic_started') throw new Error('Wrong event type');
  });

  // Test: Get Event Count
  await runTest('return event count', async () => {
    await deleteEventsForInstance(testInstanceId);
    for (let i = 0; i < 3; i++) {
      await emitEvent(testInstanceId, 'instance_heartbeat', { context_percent: i * 30 });
    }

    const count = await getEventCount(testInstanceId);

    if (count !== 3) throw new Error(`Expected 3 events, got ${count}`);
  });

  // Test: Concurrent Instances
  console.log('\n=== Concurrent Instance Tests ===\n');

  await runTest('isolate events between different instances', async () => {
    const instance1 = await registerInstance('test-project', 'PS');
    const instance2 = await registerInstance('test-project', 'PS');

    await emitEvent(instance1.instance_id, 'epic_started', {
      epic_id: 'epic-i1',
      feature_name: 'f1',
      estimated_hours: 40,
      spawned_by: 't',
      acceptance_criteria_count: 8,
    });

    await emitEvent(instance2.instance_id, 'epic_started', {
      epic_id: 'epic-i2',
      feature_name: 'f2',
      estimated_hours: 50,
      spawned_by: 't',
      acceptance_criteria_count: 10,
    });

    const result1 = await queryEvents(instance1.instance_id);
    const result2 = await queryEvents(instance2.instance_id);

    if (result1.total_count !== 1) throw new Error('Instance 1 should have 1 event');
    if (result2.total_count !== 1) throw new Error('Instance 2 should have 1 event');
    if (result1.events[0].event_data.epic_id !== 'epic-i1') throw new Error('Wrong event in instance 1');
    if (result2.events[0].event_data.epic_id !== 'epic-i2') throw new Error('Wrong event in instance 2');

    await deleteEventsForInstance(instance1.instance_id);
    await deleteEventsForInstance(instance2.instance_id);
  });

  await runTest('maintain separate sequences per instance', async () => {
    const inst1 = await registerInstance('test-project', 'PS');
    const inst2 = await registerInstance('test-project', 'PS');

    const e1_1 = await emitEvent(inst1.instance_id, 'epic_started', {
      epic_id: 'e1',
      feature_name: 'f',
      estimated_hours: 40,
      spawned_by: 't',
      acceptance_criteria_count: 8,
    });

    const e2_1 = await emitEvent(inst2.instance_id, 'epic_started', {
      epic_id: 'e2',
      feature_name: 'f',
      estimated_hours: 40,
      spawned_by: 't',
      acceptance_criteria_count: 8,
    });

    const e1_2 = await emitEvent(inst1.instance_id, 'epic_completed', {
      epic_id: 'e1',
      duration_hours: 39,
      files_changed: 10,
      tests_passed: 50,
    });

    if (e1_1.sequence_num !== 1) throw new Error('e1_1 sequence should be 1');
    if (e2_1.sequence_num !== 1) throw new Error('e2_1 sequence should be 1 (separate instance)');
    if (e1_2.sequence_num !== 2) throw new Error('e1_2 sequence should be 2 (continues inst1)');

    await deleteEventsForInstance(inst1.instance_id);
    await deleteEventsForInstance(inst2.instance_id);
  });

  // Cleanup
  await deleteEventsForInstance(testInstanceId);

  // Report
  console.log('\n=== Test Results ===\n');

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${results.length}`);
  console.log(`⏱️  Total duration: ${results.reduce((sum, r) => sum + r.duration, 0)}ms`);

  if (failed > 0) {
    console.log('\n=== Failed Tests ===\n');
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`❌ ${r.name}`);
        console.log(`   ${r.error}\n`);
      });
  }

  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

runAllTests().catch((error) => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
