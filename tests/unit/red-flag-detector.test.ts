/**
 * Red Flag Detector Unit Tests
 * Epic 006-B: Test all detection modules
 */

import { Pool } from 'pg';
import { RedFlagDetector } from '../../src/red-flags/RedFlagDetector.js';
import { MissingEvidenceDetector, EvidenceArtifact, TestResult } from '../../src/red-flags/MissingEvidenceDetector.js';
import { InconsistentEvidenceDetector } from '../../src/red-flags/InconsistentEvidenceDetector.js';
import { ToolExecutionDetector } from '../../src/red-flags/ToolExecutionDetector.js';
import { TimingAnomalyDetector } from '../../src/red-flags/TimingAnomalyDetector.js';
import { CoverageAnalyzer } from '../../src/red-flags/CoverageAnalyzer.js';

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
        await fn();
        this.passed++;
        console.log(`✓ ${name}`);
      } catch (error) {
        this.failed++;
        console.error(`✗ ${name}`);
        console.error(`  ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  }

  async run(): Promise<void> {
    console.log('\nRunning Red Flag Detector Tests...\n');

    for (const test of this.tests) {
      await test();
    }

    console.log(`\n${this.passed} passed, ${this.failed} failed`);

    if (this.failed > 0) {
      process.exit(1);
    }
  }
}

const runner = new TestRunner();

/**
 * Simple assertion helpers
 */
function expect(actual: any) {
  return {
    toBe(expected: any) {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, got ${actual}`);
      }
    },
    toBeGreaterThan(expected: number) {
      if (!(actual > expected)) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    toContain(expected: string) {
      if (!String(actual).includes(expected)) {
        throw new Error(`Expected "${actual}" to contain "${expected}"`);
      }
    },
    toBeDefined() {
      if (actual === undefined) {
        throw new Error('Expected value to be defined');
      }
    },
  };
}

// Mock pool for testing
const mockPool = {
  query: async () => ({ rows: [] }),
} as unknown as Pool;

// Test MissingEvidenceDetector
runner.test('MissingEvidenceDetector: should detect UI test without screenshots', async () => {
  const detector = new MissingEvidenceDetector(mockPool);

  const test: TestResult = {
    id: 'test-1',
    name: 'UI test without screenshots',
    type: 'ui',
    passFail: 'pass',
    executedAt: new Date(),
  };

  const evidence: EvidenceArtifact[] = [
    {
      id: 1,
      epicId: 'epic-001',
      testId: 'test-1',
      artifactType: 'console_log',
      artifactPath: '/path/to/console.log',
      collectedAt: new Date(),
      metadata: { lineCount: 10 },
    },
  ];

  const flags = await detector.detect('epic-001', test, evidence);

  expect(flags.length).toBeGreaterThan(0);
  expect(flags[0].severity).toBe('critical');
  expect(flags[0].flagType).toBe('missing_evidence');
  expect(flags[0].description).toContain('screenshot');
});

runner.test('MissingEvidenceDetector: should detect API test without HTTP logs', async () => {
  const detector = new MissingEvidenceDetector(mockPool);

  const test: TestResult = {
    id: 'test-2',
    name: 'API test without HTTP logs',
    type: 'api',
    passFail: 'pass',
    executedAt: new Date(),
  };

  const evidence: EvidenceArtifact[] = [
    {
      id: 2,
      epicId: 'epic-001',
      testId: 'test-2',
      artifactType: 'console_log',
      artifactPath: '/path/to/console.log',
      collectedAt: new Date(),
      metadata: {},
    },
  ];

  const flags = await detector.detect('epic-001', test, evidence);

  expect(flags.length).toBeGreaterThan(0);
  expect(flags[0].severity).toBe('critical');
  expect(flags[0].description).toContain('HTTP');
});

runner.test('MissingEvidenceDetector: should not flag failed tests', async () => {
  const detector = new MissingEvidenceDetector(mockPool);

  const test: TestResult = {
    id: 'test-3',
    name: 'Failed test',
    type: 'ui',
    passFail: 'fail',
    executedAt: new Date(),
  };

  const evidence: EvidenceArtifact[] = [];

  const flags = await detector.detect('epic-001', test, evidence);

  expect(flags.length).toBe(0);
});

runner.test('InconsistentEvidenceDetector: should detect HTTP 4xx but test passed', async () => {
  const detector = new InconsistentEvidenceDetector(mockPool);

  const test: TestResult = {
    id: 'test-4',
    name: 'API test with 404',
    type: 'api',
    passFail: 'pass',
    executedAt: new Date(),
  };

  const evidence: EvidenceArtifact[] = [
    {
      id: 4,
      epicId: 'epic-001',
      testId: 'test-4',
      artifactType: 'http_response',
      artifactPath: '/path/to/response.json',
      collectedAt: new Date(),
      metadata: { statusCode: 404, body: 'Not Found' },
    },
  ];

  const flags = await detector.detect('epic-001', test, evidence);

  expect(flags.length).toBeGreaterThan(0);
  expect(flags[0].severity).toBe('high');
  expect(flags[0].flagType).toBe('inconsistent');
  expect(flags[0].description).toContain('404');
});

runner.test('ToolExecutionDetector: should detect missing MCP tool calls', async () => {
  const detector = new ToolExecutionDetector(mockPool);

  const test: TestResult = {
    id: 'test-5',
    name: 'test mcp__figma__get_screenshot call',
    type: 'ui',
    passFail: 'pass',
    executedAt: new Date(),
  };

  const evidence: EvidenceArtifact[] = [
    {
      id: 5,
      epicId: 'epic-001',
      testId: 'test-5',
      artifactType: 'console_log',
      artifactPath: '/path/to/console.log',
      collectedAt: new Date(),
      metadata: {},
    },
  ];

  const flags = await detector.detect('epic-001', test, evidence);

  expect(flags.length).toBeGreaterThan(0);
  expect(flags[0].severity).toBe('critical');
  expect(flags[0].flagType).toBe('tool_execution');
  expect(flags[0].description).toContain('mcp__figma__get_screenshot');
});

runner.test('TimingAnomalyDetector: should detect UI test completing too fast', async () => {
  const detector = new TimingAnomalyDetector(mockPool);

  const test: TestResult = {
    id: 'test-6',
    name: 'UI test too fast',
    type: 'ui',
    passFail: 'pass',
    executedAt: new Date(),
  };

  const evidence: EvidenceArtifact[] = [
    {
      id: 6,
      epicId: 'epic-001',
      testId: 'test-6',
      artifactType: 'test_duration',
      artifactPath: '',
      collectedAt: new Date(),
      metadata: { durationMs: 50 }, // Less than 500ms minimum for UI
    },
  ];

  const flags = await detector.detect('epic-001', test, evidence);

  expect(flags.length).toBeGreaterThan(0);
  expect(flags[0].severity).toBe('medium');
  expect(flags[0].flagType).toBe('timing');
  expect(flags[0].description).toContain('50ms');
});

runner.test('CoverageAnalyzer: should detect unchanged coverage', async () => {
  const analyzer = new CoverageAnalyzer(mockPool);

  const test: TestResult = {
    id: 'test-7',
    name: 'Unit test with unchanged coverage',
    type: 'unit',
    passFail: 'pass',
    executedAt: new Date(),
  };

  const evidence: EvidenceArtifact[] = [
    {
      id: 7,
      epicId: 'epic-001',
      testId: 'test-7',
      artifactType: 'coverage_before',
      artifactPath: '',
      collectedAt: new Date(),
      metadata: {
        coverage: {
          linesCovered: 100,
          linesTotal: 200,
          branchesCovered: 50,
          branchesTotal: 100,
          functionsCovered: 20,
          functionsTotal: 40,
          percentage: 50,
        },
      },
    },
    {
      id: 8,
      epicId: 'epic-001',
      testId: 'test-7',
      artifactType: 'coverage_after',
      artifactPath: '',
      collectedAt: new Date(),
      metadata: {
        coverage: {
          linesCovered: 100, // Same as before
          linesTotal: 200,
          branchesCovered: 50,
          branchesTotal: 100,
          functionsCovered: 20,
          functionsTotal: 40,
          percentage: 50,
        },
      },
    },
  ];

  const flags = await analyzer.detect('epic-001', test, evidence);

  expect(flags.length).toBeGreaterThan(0);
  expect(flags[0].severity).toBe('high');
  expect(flags[0].flagType).toBe('coverage');
  expect(flags[0].description).toContain('unchanged');
});

console.log('Red Flag Detector Tests');
console.log('======================\n');

runner.run().catch((error) => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
