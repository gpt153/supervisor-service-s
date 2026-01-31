/**
 * Integration Tests for PS/MS Event Lineage (Epic 008-C)
 *
 * Tests that EventLogger integrates properly with PSBootstrap
 * and that parent chains work end-to-end through the PS workflow
 *
 * Run with: npx tsx tests/unit/session/EventLineageIntegration.test.ts
 */

import { PSBootstrap } from '../../../src/session/PSBootstrap.js';
import { EventLogger } from '../../../src/session/EventLogger.js';
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
    console.log('\n=== PS Event Lineage Integration Tests (Epic 008-C) ===\n');

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

// Helper assertions
function assertEquals<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(
      message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function assertDefined<T>(actual: T | null | undefined, message?: string): void {
  if (actual == null) {
    throw new Error(message || `Expected defined value, got ${actual}`);
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

function assertGreaterThanOrEqual(actual: number, min: number, message?: string): void {
  if (actual < min) {
    throw new Error(message || `Expected ${actual} >= ${min}`);
  }
}

function assertLessThan(actual: number, max: number, message?: string): void {
  if (actual >= max) {
    throw new Error(message || `Expected ${actual} < ${max}`);
  }
}

// Test runner and state
const runner = new AsyncTestRunner();
let bootstrap: PSBootstrap;
let logger: EventLogger;
let testInstanceId: string;

/**
 * Setup: Initialize test environment
 */
async function setupTests(): Promise<void> {
  try {
    bootstrap = new PSBootstrap('test-project');
    testInstanceId = await bootstrap.initialize();
    logger = bootstrap.getLogger();

    assertDefined(testInstanceId, 'Instance ID should be defined');
    assertDefined(logger, 'Logger should be defined');
  } catch (error) {
    throw new Error(`Setup failed: ${(error as Error).message}`);
  }
}

/**
 * Cleanup: Remove test data
 */
async function cleanupTests(): Promise<void> {
  try {
    if (testInstanceId && logger) {
      await pool.query(
        'DELETE FROM event_store WHERE instance_id = $1',
        [testInstanceId]
      );
    }
    if (bootstrap) {
      await bootstrap.close();
    }
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}

/**
 * Clean events before each test
 */
async function cleanTestData(): Promise<void> {
  if (testInstanceId) {
    await pool.query(
      'DELETE FROM event_store WHERE instance_id = $1',
      [testInstanceId]
    );
  }
}

// Tests
runner.test('should initialize EventLogger in PSBootstrap', async () => {
  await cleanTestData();
  const logger = bootstrap.getLogger();
  assertDefined(logger, 'Logger should be defined');
  assertTrue(logger instanceof EventLogger, 'Logger should be EventLogger instance');
});

runner.test('should throw when accessing logger before initialization', async () => {
  const uninitializedBootstrap = new PSBootstrap('another-project');
  try {
    uninitializedBootstrap.getLogger();
    throw new Error('Should have thrown');
  } catch (error) {
    if ((error as Error).message === 'Should have thrown') {
      throw error;
    }
    // Expected error
  }
});

runner.test('should log user message as root event', async () => {
  await cleanTestData();
  const message = 'Deploy the application';
  const msgId = await bootstrap.logUserMessage(message);

  assertDefined(msgId, 'Message ID should be defined');
  assertTrue(msgId.length > 0, 'Message ID should not be empty');

  // Verify event was stored
  const result = await pool.query(
    `SELECT event_id, event_type, event_data, parent_uuid
     FROM event_store
     WHERE event_id = $1`,
    [msgId]
  );

  assertLength(result.rows, 1, 'Should have one event');
  const event = result.rows[0];
  assertEquals(event.event_type, 'user_message', 'Event type should be user_message');
  assertEquals(event.parent_uuid, null, 'Root event should have no parent');
  assertTrue(event.event_data.content.includes('Deploy'), 'Content should contain Deploy');
});

runner.test('should truncate long messages to 500 chars', async () => {
  await cleanTestData();
  const longMessage = 'a'.repeat(1000);
  const msgId = await bootstrap.logUserMessage(longMessage);

  const result = await pool.query(
    `SELECT event_data FROM event_store WHERE event_id = $1`,
    [msgId]
  );

  assertEquals(
    result.rows[0].event_data.content.length,
    500,
    'Content should be truncated to 500 chars'
  );
});

runner.test('should log processing start linked to user message', async () => {
  await cleanTestData();
  const msgId = await bootstrap.logUserMessage('Test message');
  bootstrap.getState().currentUserMessageId = msgId;

  const procId = await bootstrap.logProcessingStart();

  assertDefined(procId, 'Processing ID should be defined');

  // Verify processing event
  const result = await pool.query(
    `SELECT event_type, parent_uuid FROM event_store WHERE event_id = $1`,
    [procId]
  );

  assertLength(result.rows, 1, 'Should have one event');
  assertEquals(result.rows[0].event_type, 'assistant_start', 'Event type should be assistant_start');
  assertEquals(result.rows[0].parent_uuid, msgId, 'Parent should be user message');
});

runner.test('should log spawn decision with reason', async () => {
  await cleanTestData();
  const spawnId = await bootstrap.logSpawnDecision(
    'general-purpose',
    'Complex task requires subagent',
    'sonnet',
    'epic-003'
  );

  assertDefined(spawnId, 'Spawn ID should be defined');

  const result = await pool.query(
    `SELECT event_data FROM event_store WHERE event_id = $1`,
    [spawnId]
  );

  assertEquals(
    result.rows[0].event_data.reason,
    'Complex task requires subagent',
    'Reason should match'
  );
  assertEquals(
    result.rows[0].event_data.subagent_type,
    'general-purpose',
    'Subagent type should match'
  );
  assertEquals(result.rows[0].event_data.model, 'sonnet', 'Model should match');
  assertEquals(result.rows[0].event_data.epic_id, 'epic-003', 'Epic ID should match');
});

runner.test('should log tool use with sanitized parameters', async () => {
  await cleanTestData();
  const toolId = await bootstrap.logToolUse('Task', {
    description: 'Implement feature',
    api_key: 'super-secret-key',
    normal_param: 'value',
  });

  assertDefined(toolId, 'Tool ID should be defined');

  const result = await pool.query(
    `SELECT event_data FROM event_store WHERE event_id = $1`,
    [toolId]
  );

  assertEquals(
    result.rows[0].event_data.parameters.api_key,
    '[REDACTED]',
    'API key should be redacted'
  );
  assertEquals(
    result.rows[0].event_data.parameters.normal_param,
    'value',
    'Normal param should be preserved'
  );
});

runner.test('should log tool result linked to tool use', async () => {
  await cleanTestData();
  const toolId = await bootstrap.logToolUse('Task', {
    description: 'Deploy service',
  });

  await bootstrap.logToolResult(toolId, true, 45000);

  const result = await pool.query(
    `SELECT event_type, parent_uuid, event_data
     FROM event_store
     WHERE event_type = 'tool_result'`,
    []
  );

  assertLength(result.rows, 1, 'Should have one tool_result event');
  assertEquals(result.rows[0].parent_uuid, toolId, 'Parent should be tool use');
  assertEquals(result.rows[0].event_data.success, true, 'Success should be true');
  assertEquals(result.rows[0].event_data.duration_ms, 45000, 'Duration should match');
});

runner.test('should log errors with context', async () => {
  await cleanTestData();
  const toolId = await bootstrap.logToolUse('Task', { description: 'Deploy' });

  await bootstrap.logError(
    'deploy_failed',
    'Port 5300 is already in use',
    'Error: EADDRINUSE',
    toolId
  );

  const result = await pool.query(
    `SELECT event_type, parent_uuid, event_data
     FROM event_store
     WHERE event_type = 'error'`,
    []
  );

  assertLength(result.rows, 1, 'Should have one error event');
  assertEquals(result.rows[0].parent_uuid, toolId, 'Parent should be tool use');
  assertEquals(result.rows[0].event_data.error_type, 'deploy_failed', 'Error type should match');
  assertTrue(
    result.rows[0].event_data.message.includes('Port 5300'),
    'Message should contain port info'
  );
});

runner.test('should create full chain from user message to error', async () => {
  await cleanTestData();
  // Simulate: User -> Process -> Spawn -> Tool -> Error
  const msgId = await bootstrap.logUserMessage('Deploy the app');
  bootstrap.getState().currentUserMessageId = msgId;

  const procId = await bootstrap.logProcessingStart();
  bootstrap.getState().currentProcessingId = procId;

  // Spawn as explicit child of processing
  const spawnId = await logger.log('spawn_decision', {
    reason: 'Deployment needed',
    subagent_type: 'general-purpose',
    model: 'haiku',
    epic_id: 'epic-005',
  }, { parentUuid: procId });

  // Tool use as explicit child of spawn
  const toolId = await logger.log('tool_use', {
    tool: 'Task',
    parameters: { action: 'deploy' },
  }, { parentUuid: spawnId });

  // Error linked to tool
  const errorId = await logger.log('error', {
    error_type: 'deploy_failed',
    message: 'Port in use',
  }, { parentUuid: toolId });

  // Verify full chain
  const chain = await logger.getParentChain(errorId);

  assertGreaterThanOrEqual(chain.length, 5, 'Chain should have at least 5 events');
  const chainTypes = chain.map(e => e.event_type);

  assertTrue(chainTypes.includes('user_message'), 'Chain should contain user_message');
  assertTrue(chainTypes.includes('assistant_start'), 'Chain should contain assistant_start');
  assertTrue(chainTypes.includes('spawn_decision'), 'Chain should contain spawn_decision');
  assertTrue(chainTypes.includes('tool_use'), 'Chain should contain tool_use');
  assertTrue(chainTypes.includes('error'), 'Chain should contain error');

  // Verify order (checking depths instead of indices since order is guaranteed by parent linkage)
  const msgEvent = chain.find(e => e.event_type === 'user_message');
  const procEvent = chain.find(e => e.event_type === 'assistant_start');
  const spawnEvent = chain.find(e => e.event_type === 'spawn_decision');
  const toolEvent = chain.find(e => e.event_type === 'tool_use');
  const errEvent = chain.find(e => e.event_type === 'error');

  assertDefined(msgEvent, 'user_message should be in chain');
  assertDefined(procEvent, 'assistant_start should be in chain');
  assertDefined(spawnEvent, 'spawn_decision should be in chain');
  assertDefined(toolEvent, 'tool_use should be in chain');
  assertDefined(errEvent, 'error should be in chain');

  // Verify depth ordering (root=0, each child +1)
  const depths = [msgEvent!.depth, procEvent!.depth, spawnEvent!.depth, toolEvent!.depth, errEvent!.depth];
  assertTrue(depths[0] === 0, 'user_message should have depth 0 (root)');
  assertTrue(depths[1] > depths[0], 'assistant_start should be deeper than user_message');
  assertTrue(depths[2] > depths[1], 'spawn_decision should be deeper than assistant_start');
  assertTrue(depths[3] > depths[2], 'tool_use should be deeper than spawn_decision');
  assertTrue(depths[4] > depths[3], 'error should be deeper than tool_use');
});

runner.test('should handle memory efficiently with 50 event limit', async () => {
  await cleanTestData();
  // Create 1000 events
  for (let i = 0; i < 1000; i++) {
    await logger.log('test_event', { index: i });
  }

  const memBefore = process.memoryUsage().heapUsed;
  const recent = await logger.getRecentEvents(50);
  const memAfter = process.memoryUsage().heapUsed;

  assertLength(recent, 50, 'Should return 50 events');

  // Memory increase should be minimal (< 1MB for 50 events)
  const memIncrease = memAfter - memBefore;
  assertLessThan(memIncrease, 1_000_000, 'Memory increase should be < 1MB');
});

runner.test('should return most recent events in correct order', async () => {
  await cleanTestData();
  // Create 100 events
  for (let i = 0; i < 100; i++) {
    await logger.log('test_event', { index: i });
  }

  const recent = await logger.getRecentEvents(50);

  // Should return last 50 events (indices 50-99)
  assertLength(recent, 50, 'Should return 50 events');

  // First event should have index 50, last should have index 99
  assertEquals(recent[0].event_data.index, 50, 'First event index should be 50');
  assertEquals(recent[49].event_data.index, 99, 'Last event index should be 99');
});

runner.test('should propagate parent context through withProcessingContext', async () => {
  await cleanTestData();
  const msgId = await bootstrap.logUserMessage('Test');
  const procId = await logger.log('assistant_start', {});

  bootstrap.getState().currentProcessingId = procId;

  let loggedId = '';
  await bootstrap.withProcessingContext(async () => {
    loggedId = await logger.log('test_event', { marker: 'inside-context' });
  });

  const result = await pool.query(
    `SELECT parent_uuid FROM event_store WHERE event_id = $1`,
    [loggedId]
  );

  assertEquals(result.rows[0].parent_uuid, procId, 'Parent should be processing ID');
});

runner.test('should reconstruct context from event chain', async () => {
  await cleanTestData();
  // Create a scenario
  const msgId = await bootstrap.logUserMessage('Implement feature');
  bootstrap.getState().currentUserMessageId = msgId;

  const procId = await bootstrap.logProcessingStart();

  // Spawn subagent
  const spawnId = await bootstrap.logSpawnDecision(
    'general-purpose',
    'Feature implementation',
    'haiku',
    'epic-007'
  );

  // Execute tool
  const toolId = await bootstrap.logToolUse('Task', {
    description: 'Implement',
  });

  await bootstrap.logToolResult(toolId, true, 60000);

  // Get last 50 events
  const recentEvents = await logger.getRecentEvents(50);

  assertGreaterThanOrEqual(recentEvents.length, 5, 'Should have at least 5 events');

  // Find the events
  const hasUserMsg = recentEvents.some(e => e.event_type === 'user_message');
  const hasAssistant = recentEvents.some(e => e.event_type === 'assistant_start');
  const hasSpawn = recentEvents.some(e => e.event_type === 'spawn_decision');
  const hasToolUse = recentEvents.some(e => e.event_type === 'tool_use');
  const hasToolResult = recentEvents.some(e => e.event_type === 'tool_result');

  assertTrue(hasUserMsg, 'Should have user_message event');
  assertTrue(hasAssistant, 'Should have assistant_start event');
  assertTrue(hasSpawn, 'Should have spawn_decision event');
  assertTrue(hasToolUse, 'Should have tool_use event');
  assertTrue(hasToolResult, 'Should have tool_result event');
});

runner.test('should preserve all event metadata correctly', async () => {
  await cleanTestData();
  const msgId = await bootstrap.logUserMessage('Test with metadata');

  const result = await pool.query(
    `SELECT event_id, instance_id, event_type, sequence_num,
            timestamp, event_data, parent_uuid, root_uuid, depth
     FROM event_store
     WHERE event_id = $1`,
    [msgId]
  );

  const event = result.rows[0];
  assertEquals(event.event_id, msgId, 'Event ID should match');
  assertEquals(event.instance_id, testInstanceId, 'Instance ID should match');
  assertEquals(event.event_type, 'user_message', 'Event type should match');
  assertGreaterThanOrEqual(event.sequence_num, 0, 'Sequence number should be >= 0');
  assertDefined(event.timestamp, 'Timestamp should be defined');
  assertDefined(event.event_data, 'Event data should be defined');
});

runner.test('should calculate depth correctly for parent chains', async () => {
  await cleanTestData();
  const msgId = await bootstrap.logUserMessage('Root event');
  const procId = await logger.log('assistant_start', {}, { parentUuid: msgId });
  const spawnId = await logger.log('spawn_decision', {}, { parentUuid: procId });

  const result = await pool.query(
    `SELECT event_id, depth FROM event_store
     WHERE event_id IN ($1, $2, $3)
     ORDER BY event_id`,
    [msgId, procId, spawnId]
  );

  const depths = result.rows.sort((a: any, b: any) => a.event_id.localeCompare(b.event_id));

  // Root should have depth 0
  const rootEvent = depths.find((e: any) => e.event_id === msgId);
  assertEquals(rootEvent.depth, 0, 'Root event should have depth 0');

  // Child should have depth 1
  const childEvent = depths.find((e: any) => e.event_id === procId);
  assertEquals(childEvent.depth, 1, 'Child event should have depth 1');

  // Grandchild should have depth 2
  const grandchildEvent = depths.find((e: any) => e.event_id === spawnId);
  assertEquals(grandchildEvent.depth, 2, 'Grandchild event should have depth 2');
});

runner.test('should handle logging errors gracefully', async () => {
  // Test with uninitialized instance
  const invalidBootstrap = new PSBootstrap('another-project');

  const msgId = await invalidBootstrap.logUserMessage('Test');
  assertEquals(msgId, '', 'Should return empty string for uninitialized instance');

  const procId = await invalidBootstrap.logProcessingStart();
  assertEquals(procId, '', 'Should return empty string for uninitialized instance');
});

runner.test('should not crash on failed event storage', async () => {
  // Even if storage fails, logging should not crash the PS
  const logger2 = new EventLogger(testInstanceId);

  // This should not throw
  const msgId = await logger2.log('user_message', { content: 'Test' });
  assertDefined(msgId, 'Event should be logged even in edge cases');
});

/**
 * Main execution
 */
async function main(): Promise<void> {
  try {
    await setupTests();
    await runner.run();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await cleanupTests();
    await pool.end();
  }
}

// Run tests
main().catch(console.error);
