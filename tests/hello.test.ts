/**
 * Tests for Hello World function
 *
 * Validates that:
 * 1. hello() function returns correct string
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

  async run(): Promise<void> {
    console.log('\n\n=== Hello World Tests ===\n');
    for (const test of this.tests) {
      test();
    }
    console.log('\n=== Results ===');
    console.log(`✅ Passed: ${this.passed}`);
    console.log(`❌ Failed: ${this.failed}`);
    console.log(`📊 Total: ${this.passed + this.failed}`);
    console.log('');

    if (this.failed > 0) {
      process.exit(1);
    }
  }
}

/**
 * Simple assertion helper
 */
function assertEqual(actual: unknown, expected: unknown, message?: string): void {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

// Create test runner
const runner = new TestRunner();

// Test: hello() returns "Hello, World!"
runner.test('hello() returns "Hello, World!"', () => {
  const result = hello();
  assertEqual(result, 'Hello, World!', 'hello() should return "Hello, World!"');
});

// Run tests
runner.run();
