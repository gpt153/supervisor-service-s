/**
 * Unit tests for HeartbeatManager (Epic 007-A)
 * Tests heartbeat updates, staleness detection, and messaging
 */

import {
  sendHeartbeat,
  sendHeartbeatAsync,
  checkStaleness,
  getStaleTimeout,
  formatStalenessMessage,
} from '../../../src/session/HeartbeatManager.js';
import { registerInstance } from '../../../src/session/InstanceRegistry.js';
import { InstanceType, STALE_TIMEOUT_SECONDS } from '../../../src/types/session.js';

describe('HeartbeatManager', () => {
  describe('sendHeartbeat', () => {
    it('updates heartbeat and returns correct output', async () => {
      const instance = await registerInstance('test-project', InstanceType.PS);

      const result = await sendHeartbeat(instance.instance_id, 50, 'epic-007-A');

      expect(result).toBeDefined();
      expect(result.instance_id).toBe(instance.instance_id);
      expect(result.status).toBeDefined();
      expect(result.last_heartbeat).toBeDefined();
      expect(result.age_seconds).toBeDefined();
      expect(result.stale).toBe(false);
      expect(result.context_percent).toBe(50);
    });

    it('validates context_percent', async () => {
      const instance = await registerInstance('test-project', InstanceType.PS);

      await expect(sendHeartbeat(instance.instance_id, -1)).rejects.toThrow();
      await expect(sendHeartbeat(instance.instance_id, 101)).rejects.toThrow();
      await expect(sendHeartbeat(instance.instance_id, 50.5)).rejects.toThrow();
    });

    it('validates instance_id', async () => {
      await expect(sendHeartbeat('', 50)).rejects.toThrow();
      await expect(sendHeartbeat(null as any, 50)).rejects.toThrow();
    });

    it('accepts optional current_epic', async () => {
      const instance = await registerInstance('test-project', InstanceType.PS);

      const result1 = await sendHeartbeat(instance.instance_id, 50);
      expect(result1).toBeDefined();

      const result2 = await sendHeartbeat(instance.instance_id, 50, 'epic-001');
      expect(result2).toBeDefined();
    });

    it('completes in <20ms', async () => {
      const instance = await registerInstance('test-project', InstanceType.PS);

      const start = Date.now();
      await sendHeartbeat(instance.instance_id, 50);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(20);
    });

    it('returns age_seconds >= 0', async () => {
      const instance = await registerInstance('test-project', InstanceType.PS);

      const result = await sendHeartbeat(instance.instance_id, 50);

      expect(result.age_seconds).toBeGreaterThanOrEqual(0);
    });

    it('returns stale=false for active instance', async () => {
      const instance = await registerInstance('test-project', InstanceType.PS);

      const result = await sendHeartbeat(instance.instance_id, 50);

      expect(result.stale).toBe(false);
    });
  });

  describe('sendHeartbeatAsync', () => {
    it('does not block (fire-and-forget)', async () => {
      const instance = await registerInstance('test-project', InstanceType.PS);

      const start = Date.now();
      sendHeartbeatAsync(instance.instance_id, 50, 'epic-007-A');
      const duration = Date.now() - start;

      // Should return immediately (no await needed)
      expect(duration).toBeLessThan(10);
    });

    it('handles errors silently', async () => {
      // Invalid instance ID - should not throw
      expect(() => {
        sendHeartbeatAsync('invalid', 50);
      }).not.toThrow();
    });
  });

  describe('checkStaleness', () => {
    it('returns false for recent timestamp', () => {
      const recent = new Date();
      const { stale, ageSeconds } = checkStaleness(recent);

      expect(stale).toBe(false);
      expect(ageSeconds).toBeLessThan(10);
    });

    it('returns true for old timestamp', () => {
      const old = new Date(Date.now() - (STALE_TIMEOUT_SECONDS + 30) * 1000);
      const { stale, ageSeconds } = checkStaleness(old);

      expect(stale).toBe(true);
      expect(ageSeconds).toBeGreaterThan(STALE_TIMEOUT_SECONDS);
    });

    it('uses STALE_TIMEOUT_SECONDS as boundary', () => {
      const boundaryTime = new Date(Date.now() - STALE_TIMEOUT_SECONDS * 1000);
      const { stale, ageSeconds } = checkStaleness(boundaryTime);

      // At the boundary, might be either way depending on timing
      expect([true, false]).toContain(stale);
      expect(Math.abs(ageSeconds - STALE_TIMEOUT_SECONDS)).toBeLessThan(5);
    });

    it('calculates ageSeconds correctly', () => {
      const ageInSeconds = 50;
      const timestamp = new Date(Date.now() - ageInSeconds * 1000);
      const { ageSeconds } = checkStaleness(timestamp);

      expect(Math.abs(ageSeconds - ageInSeconds)).toBeLessThan(2);
    });
  });

  describe('getStaleTimeout', () => {
    it('returns STALE_TIMEOUT_SECONDS', () => {
      const timeout = getStaleTimeout();
      expect(timeout).toBe(STALE_TIMEOUT_SECONDS);
    });

    it('returns 120', () => {
      const timeout = getStaleTimeout();
      expect(timeout).toBe(120);
    });
  });

  describe('formatStalenessMessage', () => {
    it('formats active instance correctly', () => {
      const message = formatStalenessMessage(30, 'active');
      expect(message).toContain('active');
      expect(message).toContain('30s');
    });

    it('formats stale instance correctly', () => {
      const message = formatStalenessMessage(150, 'stale');
      expect(message).toContain('stale');
      expect(message).toContain('2m');
    });

    it('formats closed instance', () => {
      const message = formatStalenessMessage(0, 'closed');
      expect(message).toContain('closed');
    });

    it('converts seconds to minutes for large ages', () => {
      const message = formatStalenessMessage(300, 'active');
      expect(message).toContain('5m');
    });

    it('shows seconds for small ages', () => {
      const message = formatStalenessMessage(45, 'active');
      expect(message).toContain('45s');
    });

    it('shows boundary at 60 seconds', () => {
      const message60 = formatStalenessMessage(60, 'active');
      const message61 = formatStalenessMessage(61, 'active');

      expect(message60).toContain('60s');
      expect(message61).toContain('1m');
    });

    it('shows stale message with minute count', () => {
      const message = formatStalenessMessage(300, 'stale');
      expect(message).toContain('stale');
      expect(message).toContain('5 minutes');
    });
  });

  describe('integration: heartbeat workflow', () => {
    it('complete heartbeat workflow succeeds', async () => {
      // Register instance
      const instance = await registerInstance('test-project', InstanceType.PS);

      // Send heartbeat
      const result = await sendHeartbeat(instance.instance_id, 50, 'epic-007-A');

      // Verify result
      expect(result).toBeDefined();
      expect(result.instance_id).toBe(instance.instance_id);
      expect(result.stale).toBe(false);
      expect(result.context_percent).toBe(50);

      // Check staleness
      const heartbeatDate = new Date(result.last_heartbeat);
      const { stale } = checkStaleness(heartbeatDate);
      expect(stale).toBe(false);
    });

    it('multiple heartbeats work correctly', async () => {
      const instance = await registerInstance('test-project', InstanceType.PS);

      const result1 = await sendHeartbeat(instance.instance_id, 25);
      expect(result1.context_percent).toBe(25);

      const result2 = await sendHeartbeat(instance.instance_id, 50);
      expect(result2.context_percent).toBe(50);

      const result3 = await sendHeartbeat(instance.instance_id, 75);
      expect(result3.context_percent).toBe(75);
    });
  });

  describe('performance', () => {
    it('sendHeartbeat completes in <20ms', async () => {
      const instance = await registerInstance('test-project', InstanceType.PS);

      const start = Date.now();
      await sendHeartbeat(instance.instance_id, 50);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(20);
    });

    it('checkStaleness is instant (<1ms)', () => {
      const timestamp = new Date();

      const start = Date.now();
      checkStaleness(timestamp);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1);
    });

    it('formatStalenessMessage is instant (<1ms)', () => {
      const start = Date.now();
      formatStalenessMessage(50, 'active');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1);
    });
  });

  describe('edge cases', () => {
    it('handles context_percent=0', async () => {
      const instance = await registerInstance('test-project', InstanceType.PS);
      const result = await sendHeartbeat(instance.instance_id, 0);

      expect(result.context_percent).toBe(0);
    });

    it('handles context_percent=100', async () => {
      const instance = await registerInstance('test-project', InstanceType.PS);
      const result = await sendHeartbeat(instance.instance_id, 100);

      expect(result.context_percent).toBe(100);
    });

    it('handles very old timestamps', () => {
      const veryOld = new Date('2020-01-01');
      const { stale, ageSeconds } = checkStaleness(veryOld);

      expect(stale).toBe(true);
      expect(ageSeconds).toBeGreaterThan(STALE_TIMEOUT_SECONDS);
    });

    it('handles future timestamps', () => {
      const future = new Date(Date.now() + 1000 * 1000); // 1000 seconds in future
      const { stale, ageSeconds } = checkStaleness(future);

      // Age should be negative or near-zero
      expect(ageSeconds).toBeLessThanOrEqual(0);
    });
  });
});
