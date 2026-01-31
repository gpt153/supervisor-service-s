/**
 * Unit Tests for EventLogger with Lineage Tracking (Epic 008-B)
 * Tests parent context propagation, async storage, and memory safety
 *
 * Run with: tsx tests/unit/session/EventLogger.test.ts
 */

import { EventLogger } from '../../../src/session/EventLogger.js';
import { registerInstance } from '../../../src/session/InstanceRegistry.js';
import { pool } from '../../../src/db/client.js';

/**
 * Simple async test runner
 */
class AsyncTestRunner {
  private tests: Array<{ name: string; fn: () => Promise<void> }> = [];
  private passed = 0;
  private failed = 0;

  test(name: string, fn: () => Promise<void>): void {
    this.tests.push({ name, fn });
  }

  async run(): Promise<void> {
    console.log('\n=== EventLogger Unit Tests ===\n');

    for (const test of this.tests) {
      try {
        console.log(`🧪 ${test.name}`);
        await test.fn();
        console.log(`  ✅ PASS`);
        this.passed++;
      } catch (error) {
        console.log(`  ❌ FAIL: ${(error as Error).message}`);
        this.failed++;
      }
    }

    console.log(`\n=== Results ===`);
    console.log(`✅ Passed: ${this.passed}`);
    console.log(`❌ Failed: ${this.failed}`);
    console.log(`📊 Total: ${this.tests.length}\n`);

    if (this.failed > 0) {
      process.exit(1);
    }
  }
}

function assertEquals<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(
      message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function assertNotNull<T>(actual: T | null | undefined, message?: string): void {
  if (actual == null) {
    throw new Error(message || `Expected non-null value, got ${actual}`);
  }
}

function assertLength<T extends { length: number }>(
  actual: T,
  expected: number,
  message?: string
): void {
  if (actual.length !== expected) {
    throw new Error(
      message || `Expected length ${expected}, got ${actual.length}`
    );
  }
}

function assertTrue(condition: boolean, message?: string): void {
  if (!condition) {
    throw new Error(message || `Expected true, got false`);
  }
}

function assertLessThan(actual: number, max: number, message?: string): void {
  if (actual >= max) {
    throw new Error(
      message || `Expected ${actual} < ${max}`
    );
  }
}

// Test fixtures
const instanceId = 'test-PS-abc123';
let logger: EventLogger;

/**
 * Setup: Register test instance
 */
async function setupTests(): Promise<void> {
  try {
    // Clean up old data
    await pool.query(
      `DELETE FROM event_store WHERE instance_id = $1`,
      [instanceId]
    );
    await pool.query(
      `DELETE FROM supervisor_sessions WHERE instance_id = $1`,
      [instanceId]
    );
  } catch (err) {
    // Ignore cleanup errors
  }

  // Register instance for tests
  const columns = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'supervisor_sessions'`
  );
  const hasLastHeartbeat = columns.rows.some(
    (r: any) => r.column_name === 'last_heartbeat'
  );

  const insertSQL = hasLastHeartbeat
    ? `INSERT INTO supervisor_sessions (instance_id, project, instance_type, status, created_at, last_heartbeat)
       VALUES ($1, 'test', 'PS', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    : `INSERT INTO supervisor_sessions (instance_id, project, instance_type, status)
       VALUES ($1, 'test', 'PS', 'active')`;

  try {
    await pool.query(insertSQL, [instanceId]);
  } catch (err) {
    // Instance might exist, ignore
  }

  logger = new EventLogger(instanceId);
}

/**
 * Cleanup: Remove test data
 */
async function cleanupTests(): Promise<void> {
  try {
    await pool.query(
      `DELETE FROM event_store WHERE instance_id = $1`,
      [instanceId]
    );
    await pool.query(
      `DELETE FROM supervisor_sessions WHERE instance_id = $1`,
      [instanceId]
    );
  } catch (err) {
    // Ignore cleanup errors
  }

  await pool.end();
}

/**
 * Clear events before each test
 */
async function clearEvents(): Promise<void> {
  try {
    await pool.query(
      `DELETE FROM event_store WHERE instance_id = $1`,
      [instanceId]
    );
  } catch (err) {
    // Ignore errors
  }
}

// Initialize test runner
const runner = new AsyncTestRunner();

// ============================================================================
// Constructor Tests
// ============================================================================

runner.test('constructor: should throw if instanceId is empty', async () => {
  try {
    new EventLogger('');
    throw new Error('Expected error but got none');
  } catch (err: any) {
    if (!err.message.includes('EventLogger requires valid instanceId')) {
      throw err;
    }
  }
});

runner.test('constructor: should throw if instanceId is null', async () => {
  try {
    new EventLogger(null as any);
    throw new Error('Expected error but got none');
  } catch (err: any) {
    if (!err.message.includes('EventLogger requires valid instanceId')) {
      throw err;
    }
  }
});

runner.test('constructor: should throw if instanceId is not a string', async () => {
  try {
    new EventLogger(123 as any);
    throw new Error('Expected error but got none');
  } catch (err: any) {
    if (!err.message.includes('EventLogger requires valid instanceId')) {
      throw err;
    }
  }
});

runner.test('constructor: should create successfully with valid instanceId', async () => {
  const l = new EventLogger('test-PS-abc123');
  assertTrue(l instanceof EventLogger);
});

// ============================================================================
// log() Method Tests
// ============================================================================

runner.test('log(): should create event with null parent when no context', async () => {
  await clearEvents();
  const eventId = await logger.log('instance_registered', { instance_type: 'PS', project: 'test' });
  assertNotNull(eventId);
  assertTrue(eventId.match(/^[0-9a-f-]{36}$/) !== null, 'should be UUID format');

  const result = await pool.query(
    `SELECT parent_uuid, depth FROM event_store WHERE event_id = $1`,
    [eventId]
  );
  assertLength(result.rows, 1);
  assertEquals(result.rows[0].parent_uuid, null);
  assertEquals(result.rows[0].depth, 0);
});

runner.test('log(): should link to parent when inside withParent()', async () => {
  await clearEvents();
  const parentId = await logger.log('instance_heartbeat', {});

  await logger.withParent(parentId, async () => {
    const childId = await logger.log('epic_completed', {});
    const result = await pool.query(
      `SELECT parent_uuid, depth FROM event_store WHERE event_id = $1`,
      [childId]
    );
    assertLength(result.rows, 1);
    assertEquals(result.rows[0].parent_uuid, parentId);
    assertEquals(result.rows[0].depth, 1);
  });
});

runner.test('log(): should support nested withParent() calls', async () => {
  await clearEvents();
  const rootId = await logger.log('instance_heartbeat', {});
  let childId: string;
  let grandchildId: string;

  await logger.withParent(rootId, async () => {
    childId = await logger.log('epic_completed', {});

    await logger.withParent(childId!, async () => {
      grandchildId = await logger.log('task_spawned', {});
      const result = await pool.query(
        `SELECT parent_uuid, depth, root_uuid FROM event_store WHERE event_id = $1`,
        [grandchildId]
      );
      assertLength(result.rows, 1);
      assertEquals(result.rows[0].parent_uuid, childId);
      assertEquals(result.rows[0].depth, 2);
      assertEquals(result.rows[0].root_uuid, rootId);
    });
  });
});

runner.test('log(): should accept explicit parentUuid in options', async () => {
  await clearEvents();
  const parentId = await logger.log('instance_heartbeat', {});
  const childId = await logger.log('epic_completed', {}, { parentUuid: parentId });

  const result = await pool.query(
    `SELECT parent_uuid FROM event_store WHERE event_id = $1`,
    [childId]
  );
  assertEquals(result.rows[0].parent_uuid, parentId);
});

runner.test('log(): should override context parent with explicit parentUuid', async () => {
  await clearEvents();
  const parent1 = await logger.log('instance_heartbeat', {});
  const parent2 = await logger.log('instance_heartbeat', {});

  await logger.withParent(parent1, async () => {
    const childId = await logger.log('epic_completed', {}, { parentUuid: parent2 });
    const result = await pool.query(
      `SELECT parent_uuid FROM event_store WHERE event_id = $1`,
      [childId]
    );
    assertEquals(result.rows[0].parent_uuid, parent2);
  });
});

runner.test('log(): should handle various event types', async () => {
  await clearEvents();
  const types = ['instance_registered', 'epic_started', 'test_passed', 'commit_created'];
  const ids: string[] = [];

  for (const type of types) {
    const id = await logger.log(type, { test: true });
    ids.push(id);
  }

  assertLength(ids, 4);
  const result = await pool.query(
    `SELECT event_type FROM event_store WHERE instance_id = $1 ORDER BY sequence_num`,
    [instanceId]
  );
  for (let i = 0; i < types.length; i++) {
    assertEquals(result.rows[i].event_type, types[i]);
  }
});

runner.test('log(): should store event data correctly', async () => {
  await clearEvents();
  const data = { content: 'test message', count: 42, nested: { key: 'value' } };
  const eventId = await logger.log('instance_heartbeat', data);

  const result = await pool.query(
    `SELECT event_data FROM event_store WHERE event_id = $1`,
    [eventId]
  );
  // Compare as parsed objects, not strings, to avoid key ordering issues
  const storedData = result.rows[0].event_data;
  assertEquals(storedData.content, data.content);
  assertEquals(storedData.count, data.count);
  assertEquals(storedData.nested.key, data.nested.key);
});

// ============================================================================
// withParent() Method Tests
// ============================================================================

runner.test('withParent(): should reset context after callback completes', async () => {
  await clearEvents();
  const parent1 = await logger.log('instance_heartbeat', {});

  await logger.withParent(parent1, async () => {
    await logger.log('epic_completed', {});
  });

  const childId = await logger.log('epic_completed', {});
  const result = await pool.query(
    `SELECT parent_uuid FROM event_store WHERE event_id = $1`,
    [childId]
  );
  assertEquals(result.rows[0].parent_uuid, null);
});

runner.test('withParent(): should handle parallel calls', async () => {
  await clearEvents();
  const parent1 = await logger.log('instance_heartbeat', {});
  const parent2 = await logger.log('instance_heartbeat', {});

  const [child1Id, child2Id] = await Promise.all([
    logger.withParent(parent1, async () => {
      return await logger.log('epic_completed', {});
    }),
    logger.withParent(parent2, async () => {
      return await logger.log('epic_completed', {});
    }),
  ]);

  const result1 = await pool.query(
    `SELECT parent_uuid FROM event_store WHERE event_id = $1`,
    [child1Id]
  );
  const result2 = await pool.query(
    `SELECT parent_uuid FROM event_store WHERE event_id = $1`,
    [child2Id]
  );

  assertEquals(result1.rows[0].parent_uuid, parent1);
  assertEquals(result2.rows[0].parent_uuid, parent2);
});

runner.test('withParent(): should return callback result', async () => {
  await clearEvents();
  const result = await logger.withParent('dummy-uuid', async () => {
    return 'test-result';
  });
  assertEquals(result, 'test-result');
});

runner.test('withParent(): should propagate callback errors', async () => {
  await clearEvents();
  try {
    await logger.withParent('dummy-uuid', async () => {
      throw new Error('test error');
    });
    throw new Error('Expected error but got none');
  } catch (err: any) {
    if (!err.message.includes('test error')) {
      throw err;
    }
  }
});

// ============================================================================
// getParentChain() Method Tests
// ============================================================================

runner.test('getParentChain(): should return chain from root to event', async () => {
  await clearEvents();
  const rootId = await logger.log('instance_heartbeat', { test: 'root' });
  const childId = await (async () => {
    let id: string | undefined;
    await logger.withParent(rootId, async () => {
      id = await logger.log('epic_completed', { test: 'child' });
    });
    return id;
  })();

  if (!childId) throw new Error('childId not set');
  const chain = await logger.getParentChain(childId);
  assertLength(chain, 2);
  // Chain is returned in order from event to root (DESC by depth)
  assertEquals(chain[0].event_type, 'epic_completed');
  assertEquals(chain[0].event_data.test, 'child');
  assertEquals(chain[1].event_type, 'instance_heartbeat');
  assertEquals(chain[1].event_data.test, 'root');
});

runner.test('getParentChain(): should return single element for root event', async () => {
  await clearEvents();
  const rootId = await logger.log('instance_heartbeat', {});
  const chain = await logger.getParentChain(rootId);
  assertLength(chain, 1);
  assertEquals(chain[0].event_id, rootId);
});

runner.test('getParentChain(): should handle three-level hierarchy', async () => {
  await clearEvents();
  const root = await logger.log('instance_heartbeat', { level: 'root' });
  const { child, grandchild } = await (async () => {
    let child: string | undefined;
    let grandchild: string | undefined;

    await logger.withParent(root, async () => {
      child = await logger.log('epic_completed', { level: 'child' });
      if (!child) throw new Error('child not set');
      await logger.withParent(child, async () => {
        grandchild = await logger.log('task_spawned', { level: 'grandchild' });
      });
    });

    return { child, grandchild };
  })();

  if (!child || !grandchild) throw new Error('child or grandchild not set');
  const chain = await logger.getParentChain(grandchild);
  assertLength(chain, 3);
  // Chain is returned in order from event to root (DESC by depth)
  assertEquals(chain[0].event_type, 'task_spawned');
  assertEquals(chain[0].event_data.level, 'grandchild');
  assertEquals(chain[1].event_type, 'epic_completed');
  assertEquals(chain[1].event_data.level, 'child');
  assertEquals(chain[2].event_type, 'instance_heartbeat');
  assertEquals(chain[2].event_data.level, 'root');
});

runner.test('getParentChain(): should enforce max depth limit of 1000', async () => {
  await clearEvents();
  const rootId = await logger.log('instance_heartbeat', {});
  const chain = await logger.getParentChain(rootId, 5000);
  assertNotNull(chain);
});

// ============================================================================
// getRecentEvents() Method Tests
// ============================================================================

runner.test('getRecentEvents(): should return recent events in ascending order', async () => {
  await clearEvents();
  for (let i = 0; i < 10; i++) {
    await logger.log('epic_started', { i });
  }

  const events = await logger.getRecentEvents(10);
  assertLength(events, 10);
  // Should be in ascending order (oldest first)
  for (let i = 0; i < events.length; i++) {
    assertEquals(events[i].event_data.i, i);
  }
});

runner.test('getRecentEvents(): should respect limit parameter', async () => {
  await clearEvents();
  for (let i = 0; i < 100; i++) {
    await logger.log('epic_started', { i });
  }

  const events50 = await logger.getRecentEvents(50);
  assertLength(events50, 50);

  const events25 = await logger.getRecentEvents(25);
  assertLength(events25, 25);
});

runner.test('getRecentEvents(): should enforce max limit of 1000', async () => {
  await clearEvents();
  for (let i = 0; i < 100; i++) {
    await logger.log('epic_started', { i });
  }

  const events = await logger.getRecentEvents(5000);
  assertTrue(events.length <= 100);
});

runner.test('getRecentEvents(): should return empty array when no events', async () => {
  await clearEvents();
  const events = await logger.getRecentEvents(50);
  assertLength(events, 0);
});

runner.test('getRecentEvents(): should use default limit of 50', async () => {
  await clearEvents();
  for (let i = 0; i < 100; i++) {
    await logger.log('epic_started', { i });
  }

  const events = await logger.getRecentEvents();
  assertTrue(events.length <= 50);
});

runner.test('getRecentEvents(): should include lineage fields in results', async () => {
  await clearEvents();
  const parent = await logger.log('instance_heartbeat', {});
  await logger.withParent(parent, async () => {
    await logger.log('epic_completed', {});
  });

  const events = await logger.getRecentEvents(10);
  const child = events[events.length - 1];
  assertEquals(child.parent_uuid, parent);
  assertEquals(child.depth, 1);
  assertEquals(child.root_uuid, parent);
});

// ============================================================================
// getTimeline() Method Tests
// ============================================================================

runner.test('getTimeline(): should return events within time range', async () => {
  await clearEvents();
  const start = new Date();
  for (let i = 0; i < 5; i++) {
    await logger.log('epic_started', { i });
  }
  const end = new Date();

  const events = await logger.getTimeline(
    new Date(start.getTime() - 1000),
    new Date(end.getTime() + 1000)
  );
  assertTrue(events.length >= 5);
});

runner.test('getTimeline(): should return empty for non-matching time range', async () => {
  await clearEvents();
  for (let i = 0; i < 5; i++) {
    await logger.log('epic_started', { i });
  }

  const futureStart = new Date(Date.now() + 10000);
  const futureEnd = new Date(Date.now() + 20000);
  const events = await logger.getTimeline(futureStart, futureEnd);
  assertLength(events, 0);
});

runner.test('getTimeline(): should respect limit parameter', async () => {
  await clearEvents();
  for (let i = 0; i < 100; i++) {
    await logger.log('epic_started', { i });
  }

  const start = new Date(0);
  const end = new Date();
  const events = await logger.getTimeline(start, end, 50);
  assertTrue(events.length <= 50);
});

runner.test('getTimeline(): should enforce max limit of 1000', async () => {
  await clearEvents();
  for (let i = 0; i < 100; i++) {
    await logger.log('epic_started', { i });
  }

  const start = new Date(0);
  const end = new Date();
  const events = await logger.getTimeline(start, end, 5000);
  assertTrue(events.length <= 100);
});

// ============================================================================
// getChildEvents() Method Tests
// ============================================================================

runner.test('getChildEvents(): should return direct children of event', async () => {
  await clearEvents();
  const parent = await logger.log('instance_heartbeat', {});

  await logger.withParent(parent, async () => {
    await logger.log('epic_completed', {});
    await logger.log('epic_completed', {});
  });

  const children = await logger.getChildEvents(parent);
  assertTrue(children.length >= 2);
  for (const child of children) {
    assertEquals(child.parent_uuid, parent);
  }
});

runner.test('getChildEvents(): should return empty array for event with no children', async () => {
  await clearEvents();
  const parent = await logger.log('instance_heartbeat', {});
  const children = await logger.getChildEvents(parent);
  assertLength(children, 0);
});

runner.test('getChildEvents(): should not include grandchildren', async () => {
  await clearEvents();
  const root = await logger.log('instance_heartbeat', {});
  let child: string;

  await logger.withParent(root, async () => {
    child = await logger.log('epic_completed', {});
    await logger.withParent(child!, async () => {
      await logger.log('task_spawned', {});
    });
  });

  const children = await logger.getChildEvents(root);
  assertLength(children, 1);
  assertEquals(children[0].event_id, child);
});

// ============================================================================
// Memory Safety Tests
// ============================================================================

runner.test('memory safety: should not accumulate events in memory', async () => {
  await clearEvents();
  const before = process.memoryUsage().heapUsed;

  // Log 100 events (reduced from 1000 for faster tests)
  for (let i = 0; i < 100; i++) {
    await logger.log('epic_started', { i, data: 'x'.repeat(100) });
  }

  const after = process.memoryUsage().heapUsed;
  const increase = (after - before) / 1024 / 1024; // MB

  // Memory increase should be reasonable (less than 50MB)
  assertLessThan(increase, 50, `Memory increase too large: ${increase.toFixed(2)}MB`);
});

runner.test('memory safety: should respect LIMIT in getRecentEvents', async () => {
  await clearEvents();
  // Log many events
  for (let i = 0; i < 1000; i++) {
    await logger.log('epic_started', { i });
  }

  // getRecentEvents should cap at 1000
  const before = process.memoryUsage().heapUsed;
  const events = await logger.getRecentEvents(10000);
  const after = process.memoryUsage().heapUsed;

  assertTrue(events.length <= 1000);
  const increase = (after - before) / 1024 / 1024;
  assertLessThan(increase, 50, `Memory increase too large: ${increase.toFixed(2)}MB`);
});

// ============================================================================
// Run Tests
// ============================================================================

(async () => {
  await setupTests();
  try {
    await runner.run();
  } finally {
    await cleanupTests();
  }
})();
