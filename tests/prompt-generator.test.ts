/**
 * Tests for Prompt Generator
 *
 * Validates that:
 * 1. Prompt generator creates appropriate prompts for different health states
 * 2. Context-based decision logic works correctly
 * 3. Spawn status prompts are generated correctly
 * 4. Tmux command formatting works properly
 */

import { PromptGenerator } from '../src/monitoring/prompt-generator.js';
import type { ActiveSpawn } from '../src/types/monitoring.js';

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
    console.log('\n=== Prompt Generator Tests ===\n');
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
      message || `Expected ${expected}, got ${actual}`
    );
  }
}

function assertContains(str: string, substr: string, message?: string): void {
  if (!str.includes(substr)) {
    throw new Error(
      message || `Expected "${str}" to contain "${substr}"`
    );
  }
}

function assertNotNull(value: any, message?: string): void {
  if (value === null || value === undefined) {
    throw new Error(message || 'Expected value to not be null/undefined');
  }
}

// Test suite
const runner = new TestRunner();
const generator = new PromptGenerator();

// Mock spawn data
const mockSpawn: ActiveSpawn = {
  id: 1,
  project: 'consilio',
  task_id: 'task-123',
  task_type: 'implementation',
  description: 'Implement user authentication',
  spawn_time: new Date(),
  last_output_change: new Date(),
  output_file: '/tmp/spawn-task-123.log',
  status: 'running',
};

// Spawn update tests
runner.test('generateSpawnUpdatePrompt creates normal update prompt', () => {
  const result = generator.generateSpawnUpdatePrompt(mockSpawn);

  assertEquals(result.type, 'spawn_update');
  assertEquals(result.priority, 'normal');
  assertContains(result.prompt, 'task-123');
  assertContains(result.prompt, 'progress update');
  assertEquals(result.context.project, 'consilio');
  assertEquals(result.context.task_id, 'task-123');
});

// Spawn stalled tests
runner.test('generateSpawnStalledPrompt creates stalled warning', () => {
  const result = generator.generateSpawnStalledPrompt(mockSpawn, 20);

  assertEquals(result.type, 'spawn_stalled');
  assertEquals(result.priority, 'high');
  assertContains(result.prompt, 'task-123');
  assertContains(result.prompt, '20 minutes');
  assertContains(result.prompt, 'Investigate');
  assertEquals(result.context.stall_duration_minutes, 20);
});

// Spawn failed tests
runner.test('generateSpawnFailedPrompt creates failure prompt', () => {
  const result = generator.generateSpawnFailedPrompt(
    mockSpawn,
    'TypeError: Cannot read property'
  );

  assertEquals(result.type, 'spawn_failed');
  assertEquals(result.priority, 'high');
  assertContains(result.prompt, 'task-123');
  assertContains(result.prompt, 'failed');
  assertContains(result.prompt, 'TypeError');
  assertEquals(result.context.error_message, 'TypeError: Cannot read property');
});

// Context check tests
runner.test('generateContextCheckPrompt creates regular check', () => {
  const result = generator.generateContextCheckPrompt('consilio');

  assertEquals(result.type, 'context_check');
  assertEquals(result.priority, 'normal');
  assertContains(result.prompt, 'context window usage');
  assertContains(result.prompt, 'system warnings');
  assertEquals(result.context.project, 'consilio');
});

// Context warning tests
runner.test('generateContextWarningPrompt creates warning at 75%', () => {
  const result = generator.generateContextWarningPrompt('consilio', 75);

  assertEquals(result.type, 'context_warning');
  assertEquals(result.priority, 'normal');
  assertContains(result.prompt, '75%');
  assertContains(result.prompt, 'Consider creating a handoff');
  assertEquals(result.context.context_percentage, 75);
});

// Context critical tests
runner.test('generateContextCriticalPrompt creates critical warning at 88%', () => {
  const result = generator.generateContextCriticalPrompt('consilio', 88);

  assertEquals(result.type, 'context_critical');
  assertEquals(result.priority, 'critical');
  assertContains(result.prompt, 'CRITICAL');
  assertContains(result.prompt, '88%');
  assertContains(result.prompt, 'Stop accepting new work');
  assertEquals(result.context.context_percentage, 88);
});

// Handoff trigger tests
runner.test('generateHandoffTriggerPrompt creates handoff command', () => {
  const result = generator.generateHandoffTriggerPrompt('consilio', 87);

  assertEquals(result.type, 'handoff_trigger');
  assertEquals(result.priority, 'critical');
  assertContains(result.prompt, 'Create handoff document now');
  assertContains(result.prompt, '87%');
  assertContains(result.prompt, '.bmad/handoffs/');
  assertEquals(result.context.context_percentage, 87);
});

// Context decision logic tests
runner.test('generateContextPrompt returns regular check at 30%', () => {
  const result = generator.generateContextPrompt('consilio', 0.30);

  assertNotNull(result);
  assertEquals(result?.type, 'context_check');
  assertEquals(result?.priority, 'normal');
});

runner.test('generateContextPrompt returns warning at 60%', () => {
  const result = generator.generateContextPrompt('consilio', 0.60);

  assertNotNull(result);
  assertEquals(result?.type, 'context_warning');
  assertEquals(result?.priority, 'normal');
});

runner.test('generateContextPrompt returns critical at 75%', () => {
  const result = generator.generateContextPrompt('consilio', 0.75);

  assertNotNull(result);
  assertEquals(result?.type, 'context_critical');
  assertEquals(result?.priority, 'critical');
});

runner.test('generateContextPrompt returns handoff trigger at 87%', () => {
  const result = generator.generateContextPrompt('consilio', 0.87);

  assertNotNull(result);
  assertEquals(result?.type, 'handoff_trigger');
  assertEquals(result?.priority, 'critical');
});

// Spawn prompt decision logic tests
runner.test('generateSpawnPrompt returns update for normal spawn', () => {
  const result = generator.generateSpawnPrompt(mockSpawn, 5);

  assertEquals(result.type, 'spawn_update');
  assertEquals(result.priority, 'normal');
});

runner.test('generateSpawnPrompt returns stalled for 15+ min', () => {
  const result = generator.generateSpawnPrompt(mockSpawn, 20);

  assertEquals(result.type, 'spawn_stalled');
  assertEquals(result.priority, 'high');
});

runner.test('generateSpawnPrompt returns failed when error detected', () => {
  const result = generator.generateSpawnPrompt(
    mockSpawn,
    5,
    'Fatal error occurred'
  );

  assertEquals(result.type, 'spawn_failed');
  assertEquals(result.priority, 'high');
});

// Tmux formatting tests
runner.test('formatForTmux escapes double quotes', () => {
  const prompt = generator.generateContextCheckPrompt('consilio');
  const formatted = generator.formatForTmux(prompt);

  assertContains(formatted, '"');
  // Should be wrapped in quotes
  assertEquals(formatted.charAt(0), '"');
  assertEquals(formatted.charAt(formatted.length - 1), '"');
});

runner.test('getTmuxCommand generates correct command', () => {
  const prompt = generator.generateContextCheckPrompt('consilio');
  const command = generator.getTmuxCommand(prompt);

  assertContains(command, 'tmux send-keys');
  assertContains(command, '-t "consilio-ps"');
  assertContains(command, 'C-m'); // Uses C-m for better Claude Code compatibility
  assertContains(command, 'sleep 0.2'); // Includes delay for text to appear
});

runner.test('getTmuxCommand uses correct session name for different projects', () => {
  const prompt = generator.generateContextCheckPrompt('odin');
  const command = generator.getTmuxCommand(prompt);

  assertContains(command, 'odin-ps');
});

// Edge case tests
runner.test('generateSpawnUpdatePrompt handles spawn without description', () => {
  const spawnNoDesc: ActiveSpawn = {
    ...mockSpawn,
    description: null,
  };

  const result = generator.generateSpawnUpdatePrompt(spawnNoDesc);

  assertEquals(result.type, 'spawn_update');
  assertContains(result.prompt, 'task-123');
  // Should not have extra parentheses
  assertEquals(result.context.task_description, undefined);
});

runner.test('generateSpawnFailedPrompt handles no error message', () => {
  const result = generator.generateSpawnFailedPrompt(mockSpawn);

  assertEquals(result.type, 'spawn_failed');
  assertContains(result.prompt, 'failed');
  assertEquals(result.context.error_message, undefined);
});

// Run all tests
runner.run();
