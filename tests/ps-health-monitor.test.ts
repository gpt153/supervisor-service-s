/**
 * Tests for PS Health Monitor
 *
 * Validates:
 * 1. Health monitor initialization and configuration
 * 2. Active project detection
 * 3. Spawn health checking (stall detection, error detection)
 * 4. Context usage monitoring
 * 5. Handoff cycle triggering
 * 6. Health check recording
 */

import { PSHealthMonitor } from '../src/monitoring/ps-health-monitor.js';
import { pool } from '../src/db/client.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Simple test runner
 */
class TestRunner {
  private tests: Array<() => Promise<void>> = [];
  private passed = 0;
  private failed = 0;

  test(name: string, fn: () => Promise<void>): void {
    this.tests.push(async () => {
      try {
        console.log(`\n🧪 ${name}`);
        await fn();
        console.log(`  ✅ PASS`);
        this.passed++;
      } catch (error) {
        console.log(`  ❌ FAIL: ${(error as Error).message}`);
        console.error(error);
        this.failed++;
      }
    });
  }

  async run(): Promise<void> {
    console.log('\n=== PS Health Monitor Tests ===\n');

    // Run tests sequentially
    for (const test of this.tests) {
      await test();
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

function assertEquals(actual: any, expected: any, message?: string): void {
  if (actual !== expected) {
    throw new Error(
      message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function assertGreaterThan(actual: number, expected: number, message?: string): void {
  if (actual <= expected) {
    throw new Error(
      message || `Expected ${actual} to be greater than ${expected}`
    );
  }
}

function assertNotNull(value: any, message?: string): void {
  if (value === null || value === undefined) {
    throw new Error(message || 'Expected value to not be null/undefined');
  }
}

function assertTrue(value: boolean, message?: string): void {
  if (!value) {
    throw new Error(message || 'Expected value to be true');
  }
}

/**
 * Test utilities
 */
async function cleanupTestData(): Promise<void> {
  // Clean up test data from database
  await pool.query(`DELETE FROM health_checks WHERE project LIKE 'test-%'`);
  await pool.query(`DELETE FROM active_spawns WHERE project LIKE 'test-%'`);
  await pool.query(`DELETE FROM ps_sessions WHERE project LIKE 'test-%'`);
}

async function createTestSession(
  project: string,
  contextUsage: number = 0.3
): Promise<void> {
  await pool.query(
    `INSERT INTO ps_sessions (project, session_type, session_id, context_usage, estimated_tokens_used)
     VALUES ($1, 'cli', $2, $3, $4)
     ON CONFLICT (project) DO UPDATE
     SET context_usage = $3, estimated_tokens_used = $4, updated_at = NOW()`,
    [project, `${project}-ps`, contextUsage, Math.floor(contextUsage * 200000)]
  );
}

async function createTestSpawn(
  project: string,
  taskId: string,
  status: string = 'running',
  outputFile?: string
): Promise<void> {
  await pool.query(
    `INSERT INTO active_spawns (project, task_id, task_type, description, status, output_file)
     VALUES ($1, $2, 'implementation', 'Test task', $3, $4)
     ON CONFLICT (project, task_id) DO UPDATE
     SET status = $3, output_file = $4, updated_at = NOW()`,
    [project, taskId, status, outputFile || null]
  );
}

async function updateSpawnOutputTime(
  project: string,
  taskId: string,
  minutesAgo: number
): Promise<void> {
  await pool.query(
    `UPDATE active_spawns
     SET last_output_change = NOW() - INTERVAL '${minutesAgo} minutes'
     WHERE project = $1 AND task_id = $2`,
    [project, taskId]
  );
}

async function createTestOutputFile(
  filePath: string,
  content: string
): Promise<void> {
  await fs.writeFile(filePath, content, 'utf-8');
}

async function getHealthChecks(project: string): Promise<any[]> {
  const result = await pool.query(
    `SELECT * FROM health_checks WHERE project = $1 ORDER BY check_time DESC`,
    [project]
  );
  return result.rows;
}

// Test suite
const runner = new TestRunner();

// Setup and teardown
runner.test('Setup: Clean test data', async () => {
  await cleanupTestData();
});

// Configuration tests
runner.test('PSHealthMonitor initializes with default config', () => {
  const monitor = new PSHealthMonitor();
  assertNotNull(monitor);
});

runner.test('PSHealthMonitor accepts custom config', () => {
  const monitor = new PSHealthMonitor({
    checkInterval: 5 * 60 * 1000, // 5 minutes
    stallThresholdMinutes: 10,
    contextThresholds: {
      warning: 0.60,
      critical: 0.80,
    },
  });
  assertNotNull(monitor);
});

// Active project detection tests
runner.test('getActiveProjects returns empty when no sessions', async () => {
  await cleanupTestData();

  const monitor = new PSHealthMonitor();
  // @ts-ignore - accessing private method for testing
  const projects = await monitor.getActiveProjects();

  assertEquals(projects.length, 0);
});

runner.test('getActiveProjects returns projects with active sessions', async () => {
  await cleanupTestData();
  await createTestSession('test-project-1', 0.3);
  await createTestSession('test-project-2', 0.5);

  const monitor = new PSHealthMonitor();
  // @ts-ignore
  const projects = await monitor.getActiveProjects();

  assertGreaterThan(projects.length, 0);
  assertTrue(projects.includes('test-project-1'));
  assertTrue(projects.includes('test-project-2'));
});

runner.test('getActiveProjects returns projects with active spawns', async () => {
  await cleanupTestData();
  await createTestSpawn('test-project-3', 'task-123', 'running');

  const monitor = new PSHealthMonitor();
  // @ts-ignore
  const projects = await monitor.getActiveProjects();

  assertTrue(projects.includes('test-project-3'));
});

// Spawn health checking tests
runner.test('getActiveSpawns returns only running spawns', async () => {
  await cleanupTestData();
  const project = 'test-spawn-check';

  await createTestSpawn(project, 'task-running-1', 'running');
  await createTestSpawn(project, 'task-running-2', 'running');
  await createTestSpawn(project, 'task-completed', 'completed');
  await createTestSpawn(project, 'task-failed', 'failed');

  const monitor = new PSHealthMonitor();
  // @ts-ignore
  const spawns = await monitor.getActiveSpawns(project);

  assertEquals(spawns.length, 2);
  assertTrue(spawns.every(s => s.status === 'running'));
});

runner.test('getMinutesSinceLastOutput returns 0 for recent output', async () => {
  await cleanupTestData();
  const project = 'test-output-time';
  const outputFile = '/tmp/test-spawn-recent.log';

  await createTestOutputFile(outputFile, 'Recent output');
  await createTestSpawn(project, 'task-recent', 'running', outputFile);

  const monitor = new PSHealthMonitor();
  // @ts-ignore
  const spawns = await monitor.getActiveSpawns(project);
  // @ts-ignore
  const minutes = await monitor.getMinutesSinceLastOutput(spawns[0]);

  assertEquals(minutes, 0);

  // Cleanup
  await fs.unlink(outputFile).catch(() => {});
});

runner.test('getMinutesSinceLastOutput detects stalled spawn', async () => {
  await cleanupTestData();
  const project = 'test-stalled';
  const outputFile = '/tmp/test-spawn-stalled.log';

  await createTestOutputFile(outputFile, 'Old output');
  await createTestSpawn(project, 'task-stalled', 'running', outputFile);
  await updateSpawnOutputTime(project, 'task-stalled', 20);

  const monitor = new PSHealthMonitor();
  // @ts-ignore
  const spawns = await monitor.getActiveSpawns(project);
  // @ts-ignore
  const minutes = await monitor.getMinutesSinceLastOutput(spawns[0]);

  assertGreaterThan(minutes, 15);

  // Cleanup
  await fs.unlink(outputFile).catch(() => {});
});

runner.test('detectSpawnError detects error in output', async () => {
  await cleanupTestData();
  const project = 'test-error-detection';
  const outputFile = '/tmp/test-spawn-error.log';

  await createTestOutputFile(outputFile, 'Some output\nError: Something went wrong\nMore output');
  await createTestSpawn(project, 'task-error', 'running', outputFile);

  const monitor = new PSHealthMonitor();
  // @ts-ignore
  const spawns = await monitor.getActiveSpawns(project);
  // @ts-ignore
  const errorMessage = await monitor.detectSpawnError(spawns[0]);

  assertNotNull(errorMessage);
  assertTrue(errorMessage!.includes('Error'));

  // Cleanup
  await fs.unlink(outputFile).catch(() => {});
});

runner.test('detectSpawnError returns undefined for normal output', async () => {
  await cleanupTestData();
  const project = 'test-normal-output';
  const outputFile = '/tmp/test-spawn-normal.log';

  await createTestOutputFile(outputFile, 'Normal output\nEverything is fine\nProcessing...');
  await createTestSpawn(project, 'task-normal', 'running', outputFile);

  const monitor = new PSHealthMonitor();
  // @ts-ignore
  const spawns = await monitor.getActiveSpawns(project);
  // @ts-ignore
  const errorMessage = await monitor.detectSpawnError(spawns[0]);

  assertEquals(errorMessage, undefined);

  // Cleanup
  await fs.unlink(outputFile).catch(() => {});
});

// Context usage tests
runner.test('getSession returns session for project', async () => {
  await cleanupTestData();
  await createTestSession('test-get-session', 0.45);

  const monitor = new PSHealthMonitor();
  // @ts-ignore
  const session = await monitor.getSession('test-get-session');

  assertNotNull(session);
  assertEquals(session!.project, 'test-get-session');
  assertEquals(session!.context_usage, 0.45);
});

runner.test('getSession returns null for non-existent project', async () => {
  await cleanupTestData();

  const monitor = new PSHealthMonitor();
  // @ts-ignore
  const session = await monitor.getSession('non-existent-project');

  assertEquals(session, null);
});

// Health check recording tests
runner.test('recordHealthCheck stores check in database', async () => {
  await cleanupTestData();
  const project = 'test-record-check';

  const monitor = new PSHealthMonitor();
  // @ts-ignore
  await monitor.recordHealthCheck(
    project,
    'spawn',
    'warning',
    { task_id: 'task-123', minutes_stalled: 20 },
    'Prompted PS: spawn_stalled'
  );

  const checks = await getHealthChecks(project);
  assertEquals(checks.length, 1);
  assertEquals(checks[0].check_type, 'spawn');
  assertEquals(checks[0].status, 'warning');
  assertEquals(checks[0].details.task_id, 'task-123');
});

runner.test('recordHealthCheck stores multiple checks', async () => {
  await cleanupTestData();
  const project = 'test-multiple-checks';

  const monitor = new PSHealthMonitor();
  // @ts-ignore
  await monitor.recordHealthCheck(project, 'spawn', 'ok', {}, 'Check 1');
  // @ts-ignore
  await monitor.recordHealthCheck(project, 'context', 'warning', {}, 'Check 2');
  // @ts-ignore
  await monitor.recordHealthCheck(project, 'spawn', 'critical', {}, 'Check 3');

  const checks = await getHealthChecks(project);
  assertGreaterThan(checks.length, 2);
});

// Health stats tests
runner.test('getHealthStats returns statistics', async () => {
  await cleanupTestData();
  const project = 'test-health-stats';

  const monitor = new PSHealthMonitor();
  // @ts-ignore
  await monitor.recordHealthCheck(project, 'spawn', 'ok', {}, 'Test');

  const stats = await monitor.getHealthStats(project);
  assertNotNull(stats);
  assertTrue(Array.isArray(stats));
});

// Integration tests
runner.test('checkSpawns handles project with no spawns', async () => {
  await cleanupTestData();
  await createTestSession('test-no-spawns', 0.3);

  const monitor = new PSHealthMonitor();
  // @ts-ignore - Should not throw
  await monitor.checkSpawns('test-no-spawns');
});

runner.test('checkContext handles project with no session', async () => {
  await cleanupTestData();

  const monitor = new PSHealthMonitor();
  // @ts-ignore - Should not throw
  await monitor.checkContext('test-no-session');
});

runner.test('checkProject completes without errors', async () => {
  await cleanupTestData();
  await createTestSession('test-full-check', 0.4);
  await createTestSpawn('test-full-check', 'task-1', 'running');

  const monitor = new PSHealthMonitor();
  // @ts-ignore - Should not throw
  await monitor.checkProject('test-full-check');

  // Verify health checks were recorded
  const checks = await getHealthChecks('test-full-check');
  assertGreaterThan(checks.length, 0);
});

// Cleanup
runner.test('Cleanup: Remove test data', async () => {
  await cleanupTestData();
});

// Run all tests
runner.run().catch((error) => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
