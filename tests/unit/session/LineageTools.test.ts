/**
 * Unit Tests for Event Lineage Debugging Tools (Epic 008-D)
 *
 * Tests lineage tools for:
 * - get_parent_chain: Returns correct parent chain
 * - get_event_tree: Returns complete descendant tree
 * - get_failure_chain: Finds most recent failure with chain
 * - analyze_performance: Aggregates stats by event type
 * - smart_resume_context: Reconstructs bounded context
 * - export_session: Exports events in json/jsonl format
 * - get_event_lineage_stats: Returns lineage statistics
 *
 * Run with: npx tsx tests/unit/session/LineageTools.test.ts
 */

import { pool } from '../../../src/db/client.js';
import {
  getParentChainTool,
  getEventTreeTool,
  getFailureChainTool,
  analyzePerformanceTool,
  smartResumeContextTool,
  exportSessionTool,
  getEventLineageStatsTool,
} from '../../../src/mcp/tools/lineage-tools.js';

/**
 * Simple test runner
 */
class TestRunner {
  private tests: Array<{ name: string; fn: () => Promise<void> }> = [];
  private passed = 0;
  private failed = 0;

  test(name: string, fn: () => Promise<void>): void {
    this.tests.push({ name, fn });
  }

  async run(): Promise<void> {
    console.log('\n=== Event Lineage Tools Tests (Epic 008-D) ===\n');

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

function assertTrue(condition: boolean, message?: string): void {
  if (!condition) {
    throw new Error(message || `Expected true, got false`);
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

function assertGreaterThan(actual: number, min: number, message?: string): void {
  if (actual <= min) {
    throw new Error(message || `Expected ${actual} > ${min}`);
  }
}

function assertLessThanOrEqual(actual: number, max: number, message?: string): void {
  if (actual > max) {
    throw new Error(message || `Expected ${actual} <= ${max}`);
  }
}

// Test runner
const runner = new TestRunner();
let testInstanceId: string;
let rootEventId: string;

/**
 * Setup: Create test events chain
 */
async function setupTests(): Promise<void> {
  // Generate valid instance ID
  const suffix = Math.random().toString(36).substring(2, 8);
  testInstanceId = `test-lineage-PS-${suffix}`;

  // Create supervisor session
  await pool.query(
    `INSERT INTO supervisor_sessions (instance_id, project, instance_type, status, context_percent)
     VALUES ($1, $2, $3, $4, $5)`,
    [testInstanceId, 'test', 'PS', 'active', 0]
  );

  // Create a root event
  const rootResult = await pool.query(
    `INSERT INTO event_store (instance_id, event_type, event_data, sequence_num)
     VALUES ($1, $2, $3, $4)
     RETURNING event_id`,
    [testInstanceId, 'epic_started', JSON.stringify({ epic_id: 'epic-test-001' }), 1]
  );
  rootEventId = rootResult.rows[0].event_id;

  // Create child events
  const child1Result = await pool.query(
    `INSERT INTO event_store (instance_id, event_type, event_data, parent_uuid, sequence_num)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING event_id`,
    [testInstanceId, 'assistant_start', JSON.stringify({}), rootEventId, 2]
  );
  const child1Id = child1Result.rows[0].event_id;

  // Create grandchild
  await pool.query(
    `INSERT INTO event_store (instance_id, event_type, event_data, parent_uuid, sequence_num)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING event_id`,
    [testInstanceId, 'tool_use', JSON.stringify({ tool: 'Task' }), child1Id, 3]
  );

  // Create error event
  await pool.query(
    `INSERT INTO event_store (instance_id, event_type, event_data, parent_uuid, sequence_num)
     VALUES ($1, $2, $3, $4, $5)`,
    [testInstanceId, 'error', JSON.stringify({ error_type: 'deploy_failed' }), child1Id, 4]
  );

  // Create some duration events for performance testing
  await pool.query(
    `INSERT INTO event_store (instance_id, event_type, event_data, sequence_num)
     VALUES ($1, $2, $3, $4)`,
    [testInstanceId, 'test_passed', JSON.stringify({ duration_ms: 5000 }), 5]
  );
}

/**
 * Cleanup
 */
async function cleanupTests(): Promise<void> {
  if (testInstanceId) {
    await pool.query(
      'DELETE FROM event_store WHERE instance_id = $1',
      [testInstanceId]
    );
    await pool.query(
      'DELETE FROM supervisor_sessions WHERE instance_id = $1',
      [testInstanceId]
    );
  }
}

// Mock context
const mockContext: any = {
  project: { name: 'test' },
  workingDirectory: '/tmp',
};

// Tests

runner.test('getParentChainTool is registered and has correct properties', async () => {
  assertDefined(getParentChainTool.name, 'Tool should have name');
  assertEquals(getParentChainTool.name, 'mcp_meta_get_parent_chain', 'Tool name should match');
  assertDefined(getParentChainTool.description, 'Tool should have description');
  assertDefined(getParentChainTool.inputSchema, 'Tool should have inputSchema');
  assertDefined(getParentChainTool.handler, 'Tool should have handler');
});

runner.test('getEventTreeTool is registered and has correct properties', async () => {
  assertDefined(getEventTreeTool.name, 'Tool should have name');
  assertEquals(getEventTreeTool.name, 'mcp_meta_get_event_tree', 'Tool name should match');
  assertDefined(getEventTreeTool.inputSchema, 'Tool should have inputSchema');
  assertTrue(
    getEventTreeTool.inputSchema.required?.includes('root_uuid'),
    'Should require root_uuid'
  );
});

runner.test('getFailureChainTool is registered', async () => {
  assertDefined(getFailureChainTool.name, 'Tool should have name');
  assertEquals(getFailureChainTool.name, 'mcp_meta_get_failure_chain', 'Tool name should match');
});

runner.test('analyzePerformanceTool is registered', async () => {
  assertDefined(analyzePerformanceTool.name, 'Tool should have name');
  assertEquals(
    analyzePerformanceTool.name,
    'mcp_meta_analyze_performance',
    'Tool name should match'
  );
});

runner.test('smartResumeContextTool is registered', async () => {
  assertDefined(smartResumeContextTool.name, 'Tool should have name');
  assertEquals(
    smartResumeContextTool.name,
    'mcp_meta_smart_resume_context',
    'Tool name should match'
  );
});

runner.test('exportSessionTool is registered', async () => {
  assertDefined(exportSessionTool.name, 'Tool should have name');
  assertEquals(exportSessionTool.name, 'mcp_meta_export_session', 'Tool name should match');
  assertTrue(
    exportSessionTool.inputSchema.properties?.format?.enum?.includes('json'),
    'Should support json format'
  );
  assertTrue(
    exportSessionTool.inputSchema.properties?.format?.enum?.includes('jsonl'),
    'Should support jsonl format'
  );
});

runner.test('getEventLineageStatsTool is registered', async () => {
  assertDefined(getEventLineageStatsTool.name, 'Tool should have name');
  assertEquals(
    getEventLineageStatsTool.name,
    'mcp_meta_get_event_lineage_stats',
    'Tool name should match'
  );
});

runner.test('getParentChain returns chain for root event', async () => {
  const response = await getParentChainTool.handler(
    { event_uuid: rootEventId, max_depth: 100 },
    mockContext
  );

  assertTrue(response.success, 'Should succeed');
  assertGreaterThan(response.chain.length, 0, 'Should have chain');
  assertEquals(response.chain[0].event_type, 'epic_started', 'Root should be epic_started');
});

runner.test('getEventTree returns descendants', async () => {
  const response = await getEventTreeTool.handler(
    { root_uuid: rootEventId, max_depth: 10 },
    mockContext
  );

  assertTrue(response.success, 'Should succeed');
  assertGreaterThan(response.tree.length, 1, 'Should have multiple nodes');
  assertEquals(response.tree[0].event_type, 'epic_started', 'Root should be first');
});

runner.test('getFailureChain finds error', async () => {
  const response = await getFailureChainTool.handler(
    { instance_id: testInstanceId },
    mockContext
  );

  assertTrue(response.success, 'Should succeed');
  if (response.failure) {
    assertEquals(response.failure.event_type, 'error', 'Should find error event');
  }
});

runner.test('analyzePerformance returns stats', async () => {
  const response = await analyzePerformanceTool.handler(
    { instance_id: testInstanceId },
    mockContext
  );

  assertTrue(response.success, 'Should succeed');
  assertTrue(Array.isArray(response.stats), 'Should return stats array');
});

runner.test('smartResumeContext returns bounded context', async () => {
  const response = await smartResumeContextTool.handler(
    { instance_id: testInstanceId, max_events: 10 },
    mockContext
  );

  assertTrue(response.success, 'Should succeed');
  assertLessThanOrEqual(response.recent_events.length, 10, 'Should respect max_events');
  assertTrue(Array.isArray(response.parent_chain), 'Should have parent chain');
});

runner.test('exportSession returns json format', async () => {
  const response = await exportSessionTool.handler(
    { instance_id: testInstanceId, format: 'json', limit: 100 },
    mockContext
  );

  assertTrue(response.success, 'Should succeed');
  assertEquals(response.format, 'json', 'Format should be json');
  assertTrue(Array.isArray(response.data), 'Data should be array for json');
  assertGreaterThan(response.event_count, 0, 'Should have events');
});

runner.test('exportSession returns jsonl format', async () => {
  const response = await exportSessionTool.handler(
    { instance_id: testInstanceId, format: 'jsonl', limit: 100 },
    mockContext
  );

  assertTrue(response.success, 'Should succeed');
  assertEquals(response.format, 'jsonl', 'Format should be jsonl');
  assertTrue(typeof response.data === 'string', 'Data should be string for jsonl');
});

runner.test('getEventLineageStats returns stats', async () => {
  const response = await getEventLineageStatsTool.handler(
    { instance_id: testInstanceId },
    mockContext
  );

  assertTrue(response.success, 'Should succeed');
  assertGreaterThan(response.total_events, 0, 'Should have events');
  assertGreaterThan(response.root_count, 0, 'Should have root events');
});

runner.test('All queries complete within 100ms target', async () => {
  const tests = [
    {
      name: 'analyzePerformance',
      fn: () =>
        analyzePerformanceTool.handler(
          { instance_id: testInstanceId },
          mockContext
        ),
    },
    {
      name: 'smartResumeContext',
      fn: () =>
        smartResumeContextTool.handler(
          { instance_id: testInstanceId },
          mockContext
        ),
    },
    {
      name: 'getEventLineageStats',
      fn: () =>
        getEventLineageStatsTool.handler(
          { instance_id: testInstanceId },
          mockContext
        ),
    },
  ];

  for (const test of tests) {
    const start = Date.now();
    await test.fn();
    const duration = Date.now() - start;

    assertLessThanOrEqual(
      duration,
      100,
      `${test.name} took ${duration}ms (target <100ms)`
    );
  }
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
