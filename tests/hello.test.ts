/**
 * Tests for hello function
 */

import { hello } from '../src/test/hello.js';

/**
 * Simple test runner
 */
class TestRunner {
  private tests: Array<() => void> = [];
  private passed = 0;
  private failed = 0;

  test(name: string, fn: () => void): void {
    this.tests.push(() => {
      try {
        console.log(`\n🧪 ${name}`);
        fn();
        console.log(`  ✅ PASS`);
        this.passed++;
      } catch (error) {
        console.log(`  ❌ FAIL: ${(error as Error).message}`);
        this.failed++;
      }
    });
  }

  run(): void {
    console.log('\n=== Hello Function Tests ===\n');
    this.tests.forEach(test => test());
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
      message || `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`
    );
  }
}

// Run tests
const runner = new TestRunner();

runner.test('hello() returns "Hello, World!"', () => {
  const result = hello();
  assertEquals(result, 'Hello, World!');
});

runner.run();
