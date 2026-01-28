/**
 * PS Integration Tests (Epic 007-F)
 * Test session continuity integration with PSes
 *
 * Tests cover:
 * - Bootstrap initialization
 * - Footer rendering
 * - Command logging
 * - Heartbeat
 * - Resume detection
 * - Full lifecycle
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PSBootstrap } from '../../src/session/PSBootstrap.js';
import { renderFooter, formatFooterComplete, getResumeHint } from '../../src/session/FooterRenderer.js';
import { getCommandLogger, resetCommandLogger } from '../../src/session/CommandLogger.js';
import {
  registerInstance,
  listInstances,
  getInstanceDetails,
  markInstanceClosed,
  InstanceType,
} from '../../src/session/InstanceRegistry.js';
import { sendHeartbeat, sendHeartbeatAsync } from '../../src/session/HeartbeatManager.js';

/**
 * Test fixtures and helpers
 */
const TEST_PROJECT = 'test-ps-integration';

// Mock database reset
async function resetTestDb() {
  // In real tests, this would reset the test database
  // For now, just a placeholder
}

describe('PS Session Continuity Integration (Epic 007-F)', () => {
  beforeEach(async () => {
    await resetTestDb();
    resetCommandLogger();
  });

  afterEach(async () => {
    await resetTestDb();
  });

  describe('PSBootstrap Initialization', () => {
    it('should initialize and register instance on first call', async () => {
      const bootstrap = new PSBootstrap(TEST_PROJECT);

      expect(bootstrap.getInstanceId()).toBeNull();

      const instanceId = await bootstrap.initialize();

      expect(instanceId).toBeDefined();
      expect(instanceId).toMatch(/test-ps-integration-PS-[0-9a-f]{6}/);
      expect(bootstrap.getInstanceId()).toBe(instanceId);
    });

    it('should not re-initialize if already done', async () => {
      const bootstrap = new PSBootstrap(TEST_PROJECT);

      const instanceId1 = await bootstrap.initialize();
      const instanceId2 = await bootstrap.initialize();

      expect(instanceId1).toBe(instanceId2);
    });

    it('should have correct state after initialization', async () => {
      const bootstrap = new PSBootstrap(TEST_PROJECT);
      await bootstrap.initialize();

      const state = bootstrap.getState();

      expect(state.instanceId).toBeDefined();
      expect(state.project).toBe(TEST_PROJECT);
      expect(state.registered).toBe(true);
      expect(state.contextPercent).toBe(0);
      expect(state.sessionStartTime).toBeInstanceOf(Date);
    });

    it('should throw if getState() called before initialization', () => {
      const bootstrap = new PSBootstrap(TEST_PROJECT);

      expect(() => bootstrap.getState()).toThrow('PS not initialized');
    });
  });

  describe('Footer Rendering', () => {
    it('should render footer with all components', () => {
      const footer = renderFooter({
        instanceId: 'test-PS-abc123',
        currentEpic: 'epic-003',
        contextPercent: 42,
        sessionStartTime: new Date(Date.now() - 60000), // 1 minute ago
      });

      expect(footer).toContain('test-PS-abc123');
      expect(footer).toContain('epic-003');
      expect(footer).toContain('42%');
      expect(footer).toContain('Active:');
    });

    it('should show dash for missing epic', () => {
      const footer = renderFooter({
        instanceId: 'test-PS-abc123',
        contextPercent: 0,
        sessionStartTime: new Date(),
      });

      expect(footer).toContain('Epic: —');
    });

    it('should calculate correct duration', () => {
      const startTime = new Date(Date.now() - 3600000); // 1 hour ago
      const footer = renderFooter({
        instanceId: 'test-PS-abc123',
        contextPercent: 50,
        sessionStartTime: startTime,
      });

      expect(footer).toMatch(/Active: 1\.0h/);
    });

    it('should format footer with separator', () => {
      const result = formatFooterComplete({
        instanceId: 'test-PS-abc123',
        currentEpic: 'epic-001',
        contextPercent: 30,
        sessionStartTime: new Date(),
      });

      expect(result).toContain('---');
      expect(result).toContain('Instance:');
    });

    it('should include resume hint when context >30%', () => {
      const hint = getResumeHint('test-PS-abc123', 40);

      expect(hint).toContain('resume');
      expect(hint).toContain('test-PS-abc123');
    });

    it('should not show resume hint when context <30%', () => {
      const hint = getResumeHint('test-PS-abc123', 20);

      expect(hint).toBe('');
    });

    it('should respect explicit hint override', () => {
      const hint = getResumeHint('test-PS-abc123', 10, true);

      expect(hint).toContain('resume');
    });
  });

  describe('Command Logging', () => {
    it('should log spawn action', async () => {
      const bootstrap = new PSBootstrap(TEST_PROJECT);
      await bootstrap.initialize();

      await bootstrap.logSpawn('general-purpose', 'Test spawn', 'haiku');

      // Verify log was stored
      const logger = getCommandLogger();
      const stats = await logger.getInstanceStats(bootstrap.getInstanceId()!);

      expect(stats.total_commands).toBeGreaterThan(0);
    });

    it('should log commit action', async () => {
      const bootstrap = new PSBootstrap(TEST_PROJECT);
      await bootstrap.initialize();

      await bootstrap.logCommit('feat: test', 3, 'abc123');

      const logger = getCommandLogger();
      const stats = await logger.getInstanceStats(bootstrap.getInstanceId()!);

      expect(stats.total_commands).toBeGreaterThan(0);
    });

    it('should log deployment action', async () => {
      const bootstrap = new PSBootstrap(TEST_PROJECT);
      await bootstrap.initialize();

      await bootstrap.logDeploy('test-service', 5000, 'success', {
        url: 'http://localhost:5000',
      });

      const logger = getCommandLogger();
      const stats = await logger.getInstanceStats(bootstrap.getInstanceId()!);

      expect(stats.total_commands).toBeGreaterThan(0);
    });

    it('should log PR creation', async () => {
      const bootstrap = new PSBootstrap(TEST_PROJECT);
      await bootstrap.initialize();

      await bootstrap.logPRCreated('https://github.com/test/pr/1', 'epic-001', 'Test PR');

      const logger = getCommandLogger();
      const stats = await logger.getInstanceStats(bootstrap.getInstanceId()!);

      expect(stats.total_commands).toBeGreaterThan(0);
    });

    it('should log epic completion', async () => {
      const bootstrap = new PSBootstrap(TEST_PROJECT);
      await bootstrap.initialize();

      await bootstrap.logEpicComplete('epic-001', '42/42 tests passing', 'https://github.com/test/pr/1');

      const logger = getCommandLogger();
      const stats = await logger.getInstanceStats(bootstrap.getInstanceId()!);

      expect(stats.total_commands).toBeGreaterThan(0);
    });

    it('should not throw on logging errors', async () => {
      const bootstrap = new PSBootstrap(TEST_PROJECT);
      // Don't initialize - this will cause logging to fail
      // But should not throw

      await expect(bootstrap.logSpawn('type', 'desc')).resolves.not.toThrow();
    });
  });

  describe('Context Tracking', () => {
    it('should update context percentage', async () => {
      const bootstrap = new PSBootstrap(TEST_PROJECT);
      await bootstrap.initialize();

      bootstrap.updateContext(50, 'epic-003');

      const state = bootstrap.getState();
      expect(state.contextPercent).toBe(50);
      expect(state.currentEpic).toBe('epic-003');
    });

    it('should reflect context in footer', async () => {
      const bootstrap = new PSBootstrap(TEST_PROJECT);
      await bootstrap.initialize();

      bootstrap.updateContext(75, 'epic-005');

      const response = bootstrap.appendFooter('Test response');

      expect(response).toContain('Context: 75%');
      expect(response).toContain('epic-005');
    });

    it('should handle context changes', async () => {
      const bootstrap = new PSBootstrap(TEST_PROJECT);
      await bootstrap.initialize();

      bootstrap.updateContext(10);
      expect(bootstrap.getState().contextPercent).toBe(10);

      bootstrap.updateContext(50, 'epic-001');
      let state = bootstrap.getState();
      expect(state.contextPercent).toBe(50);
      expect(state.currentEpic).toBe('epic-001');

      bootstrap.updateContext(85, 'epic-002');
      state = bootstrap.getState();
      expect(state.contextPercent).toBe(85);
      expect(state.currentEpic).toBe('epic-002');
    });
  });

  describe('Resume Detection', () => {
    it('should detect valid resume command', () => {
      const bootstrap = new PSBootstrap(TEST_PROJECT);

      const id = bootstrap.detectResumeCommand('resume test-123');
      expect(id).toBe('test-123');
    });

    it('should handle whitespace in resume command', () => {
      const bootstrap = new PSBootstrap(TEST_PROJECT);

      const id1 = bootstrap.detectResumeCommand('  resume  test-456  ');
      expect(id1).toBe('test-456');

      const id2 = bootstrap.detectResumeCommand('resume\ttest-789');
      expect(id2).toBe('test-789');
    });

    it('should not match non-resume commands', () => {
      const bootstrap = new PSBootstrap(TEST_PROJECT);

      expect(bootstrap.detectResumeCommand('help me')).toBeNull();
      expect(bootstrap.detectResumeCommand('resump test-123')).toBeNull();
      expect(bootstrap.detectResumeCommand('what is resume')).toBeNull();
    });

    it('should handle empty resume commands', () => {
      const bootstrap = new PSBootstrap(TEST_PROJECT);

      expect(bootstrap.detectResumeCommand('resume')).toBeNull();
      expect(bootstrap.detectResumeCommand('resume   ')).toBeNull();
    });
  });

  describe('Footer Appending', () => {
    it('should append footer to response', async () => {
      const bootstrap = new PSBootstrap(TEST_PROJECT);
      await bootstrap.initialize();

      const response = bootstrap.appendFooter('My response text');

      expect(response).toContain('My response text');
      expect(response).toContain('Instance:');
      expect(response).toContain('---');
    });

    it('should preserve response content', async () => {
      const bootstrap = new PSBootstrap(TEST_PROJECT);
      await bootstrap.initialize();

      const original = 'Working on epic-003.\nTests passing.\nReady for PR.';
      const result = bootstrap.appendFooter(original);

      expect(result).toContain(original);
      expect(result.indexOf(original)).toBe(0); // At beginning
    });

    it('should include resume hint at high context', async () => {
      const bootstrap = new PSBootstrap(TEST_PROJECT);
      await bootstrap.initialize();

      bootstrap.updateContext(50); // >30%

      const result = bootstrap.appendFooter('Response');

      expect(result).toContain('resume');
    });

    it('should not include resume hint at low context', async () => {
      const bootstrap = new PSBootstrap(TEST_PROJECT);
      await bootstrap.initialize();

      bootstrap.updateContext(10); // <30%

      const result = bootstrap.appendFooter('Response');

      expect(result).not.toContain('Use "resume');
    });
  });

  describe('Full Lifecycle', () => {
    it('should handle complete PS workflow', async () => {
      const bootstrap = new PSBootstrap(TEST_PROJECT);

      // 1. Initialize
      const instanceId = await bootstrap.initialize();
      expect(instanceId).toBeDefined();

      // 2. Update context
      bootstrap.updateContext(10, 'epic-001');
      expect(bootstrap.getState().contextPercent).toBe(10);

      // 3. Log action
      await bootstrap.logSpawn('general-purpose', 'Start work', 'haiku');

      // 4. Build response with footer
      let response = 'Working on implementation...';
      response = bootstrap.appendFooter(response);

      // 5. Verify response
      expect(response).toContain('Working on implementation');
      expect(response).toContain(instanceId);
      expect(response).toContain('epic-001');

      // 6. Update context again
      bootstrap.updateContext(45, 'epic-001');

      // 7. Log commit
      await bootstrap.logCommit('feat: implementation', 5);

      // 8. Another response
      response = 'Code committed.';
      response = bootstrap.appendFooter(response);

      expect(response).toContain('45%');

      // 9. Log completion
      await bootstrap.logEpicComplete('epic-001', 'All tests passing');

      // 10. Close session
      await bootstrap.close();

      // Session should still be retrievable for recovery
      const instance = await getInstanceDetails(instanceId);
      expect(instance).toBeDefined();
    });

    it('should maintain session across multiple operations', async () => {
      const bootstrap = new PSBootstrap(TEST_PROJECT);
      await bootstrap.initialize();
      const instanceId = bootstrap.getInstanceId();

      // Simulate multiple responses in a session
      for (let i = 0; i < 5; i++) {
        bootstrap.updateContext(i * 20);

        let response = `Response ${i + 1}`;
        response = bootstrap.appendFooter(response);

        expect(response).toContain(instanceId);
        expect(response).toContain(`${i * 20}%`);
      }

      // Log some actions
      await bootstrap.logSpawn('task', 'Task 1');
      await bootstrap.logCommit('feat: work', 2);
      await bootstrap.logDeploy('service', 5000, 'success');

      // Verify all logs are for same instance
      const logger = getCommandLogger();
      const stats = await logger.getInstanceStats(instanceId!);

      expect(stats.total_commands).toBe(3);
    });
  });

  describe('Heartbeat Integration', () => {
    it('should update instance on heartbeat', async () => {
      const instance1 = await registerInstance(TEST_PROJECT, InstanceType.PS);

      // Send heartbeat
      await sendHeartbeat(instance1.instance_id, 50, 'epic-001');

      // Verify update
      const instance2 = await getInstanceDetails(instance1.instance_id);
      expect(instance2?.context_percent).toBe(50);
      expect(instance2?.current_epic).toBe('epic-001');
    });

    it('should handle async heartbeat', async () => {
      const instance = await registerInstance(TEST_PROJECT, InstanceType.PS);

      // Fire async heartbeat (doesn't wait)
      sendHeartbeatAsync(instance.instance_id, 75, 'epic-003');

      // Wait a bit for async operation to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify it was processed
      const updated = await getInstanceDetails(instance.instance_id);
      expect(updated?.context_percent).toBe(75);
    });
  });

  describe('Error Handling', () => {
    it('should handle logging errors gracefully', async () => {
      const bootstrap = new PSBootstrap(TEST_PROJECT);
      // Don't initialize - this will fail
      // But should not throw

      // Console.error should be called but not throw
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await bootstrap.logSpawn('type', 'desc');

      spy.mockRestore();
    });

    it('should handle footer errors gracefully', async () => {
      const bootstrap = new PSBootstrap(TEST_PROJECT);
      // Don't initialize

      // Should return response without throwing
      const result = bootstrap.appendFooter('Response');
      expect(result).toBe('Response'); // Unchanged if not initialized
    });

    it('should handle close on non-initialized bootstrap', async () => {
      const bootstrap = new PSBootstrap(TEST_PROJECT);

      // Should not throw
      await expect(bootstrap.close()).resolves.not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should initialize quickly (<50ms)', async () => {
      const bootstrap = new PSBootstrap(TEST_PROJECT);

      const start = Date.now();
      await bootstrap.initialize();
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50);
    });

    it('should render footer quickly (<5ms)', () => {
      const start = Date.now();
      renderFooter({
        instanceId: 'test-PS-abc123',
        currentEpic: 'epic-001',
        contextPercent: 50,
        sessionStartTime: new Date(),
      });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(5);
    });

    it('should update context quickly (<1ms)', async () => {
      const bootstrap = new PSBootstrap(TEST_PROJECT);
      await bootstrap.initialize();

      const start = Date.now();
      bootstrap.updateContext(50);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1);
    });

    it('should detect resume quickly (<1ms)', () => {
      const bootstrap = new PSBootstrap(TEST_PROJECT);

      const start = Date.now();
      bootstrap.detectResumeCommand('resume test-123');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1);
    });
  });

  describe('Instance Cleanup', () => {
    it('should close instance properly', async () => {
      const bootstrap = new PSBootstrap(TEST_PROJECT);
      const instanceId = await bootstrap.initialize();

      await bootstrap.close();

      // Verify instance is marked as closed
      const instance = await getInstanceDetails(instanceId);
      expect(instance?.status).toBe('closed');
    });

    it('should idempotent close', async () => {
      const bootstrap = new PSBootstrap(TEST_PROJECT);
      await bootstrap.initialize();

      // Close multiple times should not error
      await bootstrap.close();
      await bootstrap.close();
      await bootstrap.close();
    });
  });
});

/**
 * Integration test helpers
 */

function calculateContextUsage(messageCount: number = 10, tokensPerMessage: number = 150): number {
  const totalTokens = messageCount * tokensPerMessage;
  const maxTokens = 200000;
  return Math.min(100, Math.round((totalTokens / maxTokens) * 100));
}

function formatRecovery(recovery: any): string {
  let result = `✅ Resumed: ${recovery.instance_id}\n\n`;
  result += `EPIC ${recovery.epic_id}: ${recovery.epic_name}\n`;
  result += `- Status: ${recovery.status}\n`;
  result += `- Progress: ${recovery.progress}%\n\n`;
  result += `Ready to continue.`;
  return result;
}
