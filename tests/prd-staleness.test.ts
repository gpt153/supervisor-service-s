/**
 * PRD Staleness Tool Tests
 *
 * Validates PRD staleness detection logic
 */

import { getPRDStalenessTools } from '../src/mcp/tools/prd-staleness-tools.js';

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
        this.failed++;
      }
    });
  }

  async run(): Promise<void> {
    console.log('\n=== PRD Staleness Tool Tests ===\n');
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

function assertTrue(condition: boolean, message?: string): void {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertGreaterThanOrEqual(actual: number, expected: number, message?: string): void {
  if (actual < expected) {
    throw new Error(
      message || `Expected ${actual} to be >= ${expected}`
    );
  }
}

// Tests
const runner = new TestRunner();

// Get the tool handler
const tools = getPRDStalenessTools();
const tool = tools.find(t => t.name === 'mcp_meta_check_prd_staleness');
if (!tool) {
  throw new Error('Tool mcp_meta_check_prd_staleness not found');
}
const checkPRDStaleness = tool.handler;

runner.test('Tool has correct structure', async () => {
  assertTrue(tool.name === 'mcp_meta_check_prd_staleness', 'Tool name should match');
  assertTrue(typeof tool.description === 'string', 'Tool should have description');
  assertTrue(typeof tool.handler === 'function', 'Tool should have handler function');
  assertTrue(typeof tool.inputSchema === 'object', 'Tool should have inputSchema');
});

runner.test('Check odin-s PRDs for staleness', async () => {
  const result = await checkPRDStaleness({
    projects: ['odin-s'],
  });

  console.log(`\n  📊 Total PRDs: ${result.total_prds}`);
  console.log(`  ✅ Healthy: ${result.healthy_prds}`);
  console.log(`  ⚠️  Stale: ${result.stale_prds.length}`);
  console.log(`  📝 Summary: ${result.summary}`);

  if (result.stale_prds.length > 0) {
    console.log('\n  Stale PRDs Details:');
    for (const prd of result.stale_prds) {
      console.log(`\n    🔍 ${prd.feature} (${prd.project})`);
      console.log(`       Version: ${prd.version}`);
      console.log(`       Completed: ${prd.completed_epics}/${prd.total_epics} epics`);
      console.log(`       Issues:`);
      for (const issue of prd.issues) {
        console.log(`         - ${issue}`);
      }
      console.log(`       💡 ${prd.recommendation}`);
    }
  }

  assertTrue(typeof result.stale_prds === 'object', 'Should return stale_prds array');
  assertTrue(typeof result.healthy_prds === 'number', 'Should return healthy_prds count');
  assertTrue(typeof result.total_prds === 'number', 'Should return total_prds count');
  assertTrue(typeof result.summary === 'string', 'Should return summary string');
});

runner.test('Check all projects', async () => {
  const result = await checkPRDStaleness({});

  console.log(`\n  📊 Total PRDs across all projects: ${result.total_prds}`);
  console.log(`  ✅ Healthy: ${result.healthy_prds}`);
  console.log(`  ⚠️  Stale: ${result.stale_prds.length}`);

  assertGreaterThanOrEqual(result.total_prds, 0, 'Should have non-negative total PRDs');
  assertTrue(
    result.stale_prds.length + result.healthy_prds === result.total_prds,
    'Stale + healthy should equal total'
  );
});

runner.test('Handle non-existent project gracefully', async () => {
  const result = await checkPRDStaleness({
    projects: ['non-existent-project'],
  });

  assertTrue(result.total_prds === 0, 'Should have 0 total PRDs for non-existent project');
  assertTrue(result.stale_prds.length === 0, 'Should have 0 stale PRDs for non-existent project');
});

runner.test('Check consilio-s PRDs', async () => {
  const result = await checkPRDStaleness({
    projects: ['consilio-s'],
  });

  console.log(`\n  📊 Consilio PRDs: ${result.total_prds}`);
  console.log(`  ✅ Healthy: ${result.healthy_prds}`);
  console.log(`  ⚠️  Stale: ${result.stale_prds.length}`);

  assertTrue(typeof result.total_prds === 'number', 'Should return total count');
});

runner.test('Check health-agent-s PRDs', async () => {
  const result = await checkPRDStaleness({
    projects: ['health-agent-s'],
  });

  console.log(`\n  📊 Health-Agent PRDs: ${result.total_prds}`);
  console.log(`  ✅ Healthy: ${result.healthy_prds}`);
  console.log(`  ⚠️  Stale: ${result.stale_prds.length}`);

  assertTrue(typeof result.total_prds === 'number', 'Should return total count');
});

// Run tests
runner.run();
