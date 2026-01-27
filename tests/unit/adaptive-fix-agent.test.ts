/**
 * Adaptive Fix Agent Unit Tests
 * Epic: 006-F
 */

import { FailureClassifier } from '../../src/rca/FailureClassifier.js';
import { ModelSelector } from '../../src/rca/ModelSelector.js';
import { FixStrategySelector } from '../../src/rca/FixStrategySelector.js';
import type { RootCauseAnalysis } from '../../src/types/rca.js';
import type { FixStrategy } from '../../src/types/fixing.js';

/**
 * Simple test runner
 */
class TestRunner {
  private tests: Array<() => void | Promise<void>> = [];
  private passed = 0;
  private failed = 0;

  test(name: string, fn: () => void | Promise<void>): void {
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
    console.log('\n=== Adaptive Fix Agent Tests ===\n');
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

function assertTrue(value: any, message?: string): void {
  if (!value) {
    throw new Error(message || `Expected truthy value, got ${value}`);
  }
}

function assertContains<T>(array: T[], value: T, message?: string): void {
  if (!array.includes(value)) {
    throw new Error(message || `Expected array to contain ${value}`);
  }
}

function assertGreaterThan(actual: number, expected: number, message?: string): void {
  if (actual <= expected) {
    throw new Error(message || `Expected ${actual} > ${expected}`);
  }
}

function assertLessThan(actual: number, expected: number, message?: string): void {
  if (actual >= expected) {
    throw new Error(message || `Expected ${actual} < ${expected}`);
  }
}

function assertCloseTo(actual: number, expected: number, precision: number, message?: string): void {
  const diff = Math.abs(actual - expected);
  if (diff > Math.pow(10, -precision)) {
    throw new Error(message || `Expected ${actual} to be close to ${expected} (precision: ${precision})`);
  }
}

async function assertRejects(fn: () => Promise<any>, errorMessage?: string): Promise<void> {
  try {
    await fn();
    throw new Error('Expected function to throw, but it did not');
  } catch (error) {
    if (errorMessage && !(error as Error).message.includes(errorMessage)) {
      throw new Error(`Expected error message to include "${errorMessage}", got "${(error as Error).message}"`);
    }
  }
}

// Tests
const runner = new TestRunner();

// FailureClassifier Tests
runner.test('FailureClassifier classifies syntax errors', () => {
  const classifier = new FailureClassifier();
  const result = classifier.classify('SyntaxError: Unexpected token }');
  assertEquals(result.category, 'syntax');
  assertGreaterThan(result.confidence, 0.7);
});

runner.test('FailureClassifier classifies integration errors', () => {
  const classifier = new FailureClassifier();
  const result = classifier.classify('ModuleNotFoundError: Cannot find module "boto3"');
  assertEquals(result.category, 'integration');
  assertGreaterThan(result.confidence, 0.7);
});

runner.test('FailureClassifier classifies environment errors', () => {
  const classifier = new FailureClassifier();
  const result = classifier.classify('Error: Environment variable DATABASE_URL not defined');
  assertEquals(result.category, 'environment');
});

runner.test('FailureClassifier classifies logic errors by default', () => {
  const classifier = new FailureClassifier();
  const result = classifier.classify('AssertionError: Expected 5 but got 3');
  assertEquals(result.category, 'logic');
});

runner.test('FailureClassifier classifies simple single-file issues', () => {
  const classifier = new FailureClassifier();
  const result = classifier.classify('SyntaxError: Missing semicolon', undefined, ['file.ts']);
  assertEquals(result.complexity, 'simple');
});

runner.test('FailureClassifier classifies moderate multi-file issues', () => {
  const classifier = new FailureClassifier();
  const result = classifier.classify('Import error', undefined, ['file1.ts', 'file2.ts']);
  assertEquals(result.complexity, 'moderate');
});

runner.test('FailureClassifier classifies complex multi-file issues', () => {
  const classifier = new FailureClassifier();
  const result = classifier.classify('Logic error', undefined, ['a.ts', 'b.ts', 'c.ts', 'd.ts']);
  assertEquals(result.complexity, 'complex');
});

runner.test('FailureClassifier classifies requires_human for architectural issues', () => {
  const classifier = new FailureClassifier();
  const result = classifier.classify('Architecture change needed for feature');
  assertEquals(result.complexity, 'requires_human');
});

// ModelSelector Tests
runner.test('ModelSelector: 3-5-7 pattern - simple retry 1 = haiku', () => {
  const selector = new ModelSelector();
  const model = selector.select(1, 'simple');
  assertEquals(model, 'haiku');
});

runner.test('ModelSelector: 3-5-7 pattern - simple retry 2 = sonnet', () => {
  const selector = new ModelSelector();
  const model = selector.select(2, 'simple');
  assertEquals(model, 'sonnet');
});

runner.test('ModelSelector: 3-5-7 pattern - simple retry 3 = opus', () => {
  const selector = new ModelSelector();
  const model = selector.select(3, 'simple');
  assertEquals(model, 'opus');
});

runner.test('ModelSelector: moderate retry 1 = sonnet', () => {
  const selector = new ModelSelector();
  const model = selector.select(1, 'moderate');
  assertEquals(model, 'sonnet');
});

runner.test('ModelSelector: moderate retry 2 = opus', () => {
  const selector = new ModelSelector();
  const model = selector.select(2, 'moderate');
  assertEquals(model, 'opus');
});

runner.test('ModelSelector: complex always = opus', () => {
  const selector = new ModelSelector();
  assertEquals(selector.select(1, 'complex'), 'opus');
  assertEquals(selector.select(2, 'complex'), 'opus');
  assertEquals(selector.select(3, 'complex'), 'opus');
});

runner.test('ModelSelector: estimates haiku cost correctly', () => {
  const selector = new ModelSelector();
  const cost = selector.estimateCost('haiku', 5000);
  assertCloseTo(cost, 0.00625, 5);
});

runner.test('ModelSelector: estimates sonnet cost correctly', () => {
  const selector = new ModelSelector();
  const cost = selector.estimateCost('sonnet', 5000);
  assertCloseTo(cost, 0.075, 3);
});

runner.test('ModelSelector: estimates opus cost correctly', () => {
  const selector = new ModelSelector();
  const cost = selector.estimateCost('opus', 5000);
  assertCloseTo(cost, 0.375, 3);
});

runner.test('ModelSelector: throws for invalid retry number', () => {
  const selector = new ModelSelector();
  try {
    selector.select(0, 'simple');
    throw new Error('Should have thrown');
  } catch (error) {
    assertTrue((error as Error).message.includes('Invalid retry number'));
  }
});

runner.test('ModelSelector: throws for unknown complexity', () => {
  const selector = new ModelSelector();
  try {
    selector.select(1, 'unknown' as any);
    throw new Error('Should have thrown');
  } catch (error) {
    assertTrue((error as Error).message.includes('Unknown complexity'));
  }
});

// FixStrategySelector Tests
runner.test('FixStrategySelector: selects syntax strategies for syntax errors', async () => {
  const selector = new FixStrategySelector();
  const rca: RootCauseAnalysis = {
    test_id: 'test-1',
    epic_id: 'epic-1',
    failure_category: 'syntax',
    root_cause: 'Missing semicolon',
    complexity: 'simple',
    symptoms: [],
    diagnosis_reasoning: 'Test',
    recommended_strategy: 'syntax_fix',
    analyzer_model: 'opus'
  };

  const strategy = await selector.select(rca, [], 'haiku');
  assertContains(['typo_correction', 'syntax_fix', 'formatting'], strategy);
});

runner.test('FixStrategySelector: selects integration strategies for integration errors', async () => {
  const selector = new FixStrategySelector();
  const rca: RootCauseAnalysis = {
    test_id: 'test-1',
    epic_id: 'epic-1',
    failure_category: 'integration',
    root_cause: 'Missing module',
    complexity: 'simple',
    symptoms: [],
    diagnosis_reasoning: 'Test',
    recommended_strategy: 'import_fix',
    analyzer_model: 'opus'
  };

  const strategy = await selector.select(rca, [], 'sonnet');
  assertContains(['import_fix', 'dependency_add', 'api_update'], strategy);
});

runner.test('FixStrategySelector: avoids failed strategies', async () => {
  const selector = new FixStrategySelector();
  const rca: RootCauseAnalysis = {
    test_id: 'test-1',
    epic_id: 'epic-1',
    failure_category: 'syntax',
    root_cause: 'Syntax error',
    complexity: 'simple',
    symptoms: [],
    diagnosis_reasoning: 'Test',
    recommended_strategy: 'typo_correction',
    analyzer_model: 'opus'
  };

  const failedStrategies: FixStrategy[] = ['typo_correction', 'syntax_fix'];
  const strategy = await selector.select(rca, failedStrategies, 'haiku');
  assertEquals(strategy, 'formatting'); // Only remaining syntax strategy
});

// Integration Tests
runner.test('Integration: Full 3-5-7 pattern demonstration', () => {
  const selector = new ModelSelector();

  // Simple issue: Haiku → Sonnet → Opus
  assertEquals(selector.select(1, 'simple'), 'haiku');
  assertEquals(selector.select(2, 'simple'), 'sonnet');
  assertEquals(selector.select(3, 'simple'), 'opus');

  // Moderate issue: Sonnet → Opus → Opus
  assertEquals(selector.select(1, 'moderate'), 'sonnet');
  assertEquals(selector.select(2, 'moderate'), 'opus');
  assertEquals(selector.select(3, 'moderate'), 'opus');

  // Complex issue: Opus → Opus → Opus
  assertEquals(selector.select(1, 'complex'), 'opus');
  assertEquals(selector.select(2, 'complex'), 'opus');
  assertEquals(selector.select(3, 'complex'), 'opus');
});

runner.test('Cost Optimization: 80% reduction for simple issues', () => {
  const selector = new ModelSelector();

  // Current system: 3 × Sonnet
  const currentCost = 3 * selector.estimateCost('sonnet', 5000);

  // Adaptive system: 70% fix on retry 1 (Haiku)
  const adaptiveCost = 0.7 * selector.estimateCost('haiku', 5000);

  const savings = (currentCost - adaptiveCost) / currentCost;
  assertGreaterThan(savings, 0.75); // >75% savings
});

runner.run();
