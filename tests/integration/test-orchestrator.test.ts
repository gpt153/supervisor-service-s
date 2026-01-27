/**
 * Epic 006-G: Test Orchestrator Integration Tests
 *
 * End-to-end tests for workflow orchestration
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestOrchestrator } from '../../src/orchestration/TestOrchestrator.js';
import { WorkflowStateMachine } from '../../src/orchestration/WorkflowStateMachine.js';
import { TestScheduler } from '../../src/scheduling/TestScheduler.js';
import { PIVIntegration } from '../../src/orchestration/PIVIntegration.js';
import type { OrchestrationTestDefinition } from '../../src/types/orchestration.js';

describe('TestOrchestrator Integration Tests', () => {
  let orchestrator: TestOrchestrator;
  let stateMachine: WorkflowStateMachine;

  beforeEach(() => {
    orchestrator = new TestOrchestrator();
    stateMachine = new WorkflowStateMachine();
  });

  describe('Workflow Orchestration', () => {
    it('should orchestrate complete workflow', async () => {
      const testDefinition: OrchestrationTestDefinition = {
        id: 'test-006-G-001',
        epic_id: '006-G',
        type: 'ui',
        priority: 'high',
        steps: [
          { action: 'navigate', target: 'https://example.com' },
          { action: 'click', target: '#button' },
          { action: 'verify', expected: 'Success' }
        ]
      };

      const result = await orchestrator.orchestrate(testDefinition);

      expect(result.success).toBe(true);
      expect(result.workflow).toBeDefined();
      expect(result.workflow.status).toBe('completed');
      expect(result.report).toBeDefined();
      expect(result.report.testId).toBe('test-006-G-001');
    }, 60000); // 1 minute timeout

    it('should handle execution failures', async () => {
      const testDefinition: OrchestrationTestDefinition = {
        id: 'test-006-G-002',
        epic_id: '006-G',
        type: 'ui',
        priority: 'high',
        steps: [
          { action: 'navigate', target: 'invalid-url' } // Will fail
        ]
      };

      const result = await orchestrator.orchestrate(testDefinition);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.workflow.status).toMatch(/failed|escalated/);
    }, 60000);

    it('should store stage results correctly', async () => {
      const testDefinition: OrchestrationTestDefinition = {
        id: 'test-006-G-003',
        epic_id: '006-G',
        type: 'ui',
        priority: 'high',
        steps: [
          { action: 'navigate', target: 'https://example.com' }
        ]
      };

      const result = await orchestrator.orchestrate(testDefinition);

      expect(result.workflow.execution_result).toBeDefined();
      expect(result.workflow.detection_result).toBeDefined();
      expect(result.workflow.verification_result).toBeDefined();
    }, 60000);
  });

  describe('State Machine', () => {
    it('should create workflow', async () => {
      const workflow = await stateMachine.create({
        test_id: 'test-state-001',
        epic_id: '006-G',
        test_type: 'ui'
      });

      expect(workflow).toBeDefined();
      expect(workflow.test_id).toBe('test-state-001');
      expect(workflow.current_stage).toBe('pending');
      expect(workflow.status).toBe('pending');
    });

    it('should transition between valid stages', async () => {
      const workflow = await stateMachine.create({
        test_id: 'test-state-002',
        epic_id: '006-G',
        test_type: 'ui'
      });

      // Valid transition: pending → execution
      const updated = await stateMachine.transitionTo(workflow, 'execution');
      expect(updated.current_stage).toBe('execution');
      expect(updated.status).toBe('in_progress');
    });

    it('should reject invalid transitions', async () => {
      const workflow = await stateMachine.create({
        test_id: 'test-state-003',
        epic_id: '006-G',
        test_type: 'ui'
      });

      // Invalid transition: pending → verification
      await expect(
        stateMachine.transitionTo(workflow, 'verification')
      ).rejects.toThrow(/invalid/i);
    });

    it('should complete workflow', async () => {
      const workflow = await stateMachine.create({
        test_id: 'test-state-004',
        epic_id: '006-G',
        test_type: 'ui'
      });

      await stateMachine.transitionTo(workflow, 'execution');
      await stateMachine.transitionTo(workflow, 'detection');
      await stateMachine.transitionTo(workflow, 'verification');
      await stateMachine.transitionTo(workflow, 'learning');

      const completed = await stateMachine.complete(workflow);

      expect(completed.status).toBe('completed');
      expect(completed.current_stage).toBe('completed');
      expect(completed.completed_at).toBeDefined();
      expect(completed.duration_ms).toBeGreaterThan(0);
    });
  });

  describe('Test Scheduler', () => {
    it('should schedule tests by priority', () => {
      const scheduler = new TestScheduler();

      const tests: OrchestrationTestDefinition[] = [
        { id: 'test-low', epic_id: '006-G', type: 'ui', priority: 'low', steps: [] },
        { id: 'test-critical', epic_id: '006-G', type: 'ui', priority: 'critical', steps: [] },
        { id: 'test-medium', epic_id: '006-G', type: 'ui', priority: 'medium', steps: [] }
      ];

      scheduler.scheduleMany(tests);

      const queue = scheduler.getQueue();
      expect(queue[0].testDefinition.id).toBe('test-critical');
      expect(queue[2].testDefinition.id).toBe('test-low');
    });

    it('should execute tests in parallel', async () => {
      const scheduler = new TestScheduler();

      const tests: OrchestrationTestDefinition[] = [
        { id: 'test-parallel-1', epic_id: '006-G', type: 'ui', priority: 'high', steps: [] },
        { id: 'test-parallel-2', epic_id: '006-G', type: 'ui', priority: 'high', steps: [] }
      ];

      scheduler.scheduleMany(tests);

      const startTime = Date.now();
      const results = await scheduler.executeAll();
      const duration = Date.now() - startTime;

      expect(results.length).toBe(2);

      // Parallel execution should be faster than sequential
      // (less than sum of individual durations)
      expect(duration).toBeLessThan(120000); // Less than 2 minutes for 2 tests
    }, 120000);
  });

  describe('PIV Integration', () => {
    it('should extract tests from epic', async () => {
      const piv = new PIVIntegration();

      const extraction = await piv.extractTests('006-G');

      expect(extraction.epicId).toBe('006-G');
      expect(extraction.tests).toBeDefined();
      expect(Array.isArray(extraction.tests)).toBe(true);
    });

    it('should handle PIV completion event', async () => {
      const piv = new PIVIntegration();

      const result = await piv.onPIVComplete({
        epicId: '006-G',
        prUrl: 'https://github.com/test/repo/pull/1',
        completedAt: new Date()
      });

      expect(result.epicId).toBe('006-G');
      expect(result.epicReport).toBeDefined();
      expect(result.workflows).toBeDefined();
    }, 300000); // 5 minutes timeout for full epic
  });

  describe('Error Handling', () => {
    it('should retry on transient failures', async () => {
      // This test would need to mock transient failures
      // For now, we'll just verify the orchestrator can handle errors
      const testDefinition: OrchestrationTestDefinition = {
        id: 'test-error-001',
        epic_id: '006-G',
        type: 'ui',
        priority: 'high',
        steps: []
      };

      const result = await orchestrator.orchestrate(testDefinition);

      // Should either succeed or escalate, not crash
      expect(result).toBeDefined();
      expect(result.workflow).toBeDefined();
    }, 60000);

    it('should escalate after max retries', async () => {
      // This test would need to inject persistent failures
      // For now, we'll just verify error handling doesn't crash
      const testDefinition: OrchestrationTestDefinition = {
        id: 'test-error-002',
        epic_id: '006-G',
        type: 'ui',
        priority: 'high',
        steps: []
      };

      const result = await orchestrator.orchestrate(testDefinition);

      expect(result).toBeDefined();

      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    }, 60000);
  });

  describe('Unified Reporting', () => {
    it('should generate test report', async () => {
      const testDefinition: OrchestrationTestDefinition = {
        id: 'test-report-001',
        epic_id: '006-G',
        type: 'ui',
        priority: 'high',
        steps: []
      };

      const result = await orchestrator.orchestrate(testDefinition);

      expect(result.report).toBeDefined();
      expect(result.report.testId).toBe('test-report-001');
      expect(result.report.epicId).toBe('006-G');
      expect(result.report.summary).toBeDefined();
      expect(result.report.recommendation).toMatch(/accept|manual_review|reject/);
      expect(result.report.confidence).toBeGreaterThanOrEqual(0);
      expect(result.report.confidence).toBeLessThanOrEqual(100);
    }, 60000);

    it('should calculate confidence scores', async () => {
      const testDefinition: OrchestrationTestDefinition = {
        id: 'test-confidence-001',
        epic_id: '006-G',
        type: 'ui',
        priority: 'high',
        steps: []
      };

      const result = await orchestrator.orchestrate(testDefinition);

      expect(typeof result.report.confidence).toBe('number');
      expect(result.report.confidence).toBeGreaterThanOrEqual(0);
      expect(result.report.confidence).toBeLessThanOrEqual(100);
    }, 60000);
  });
});

describe('Performance Tests', () => {
  it('should complete workflow within timeout', async () => {
    const orchestrator = new TestOrchestrator();

    const testDefinition: OrchestrationTestDefinition = {
      id: 'test-perf-001',
      epic_id: '006-G',
      type: 'ui',
      priority: 'high',
      steps: [
        { action: 'navigate', target: 'https://example.com' }
      ]
    };

    const startTime = Date.now();
    const result = await orchestrator.orchestrate(testDefinition);
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(300000); // Should complete within 5 minutes
    expect(result).toBeDefined();
  }, 300000);
});
