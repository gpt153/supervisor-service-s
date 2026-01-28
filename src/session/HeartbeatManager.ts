/**
 * Heartbeat Manager (Epic 007-A)
 * Handles non-blocking heartbeat updates and stale instance detection
 *
 * Responsibilities:
 * - Async, fire-and-forget heartbeat updates
 * - Track instance age and stale status
 * - Performance optimization: <20ms per heartbeat
 */

import { updateHeartbeat, isInstanceStale, calculateInstanceAge } from './InstanceRegistry.js';
import { HeartbeatOutput, InstanceStatus, STALE_TIMEOUT_SECONDS } from '../types/session.js';

/**
 * Send heartbeat for an instance (async, non-blocking)
 *
 * @param instanceId Instance ID
 * @param contextPercent Context usage (0-100)
 * @param currentEpic Optional current epic ID
 * @returns Promise that resolves with heartbeat result (fire-and-forget)
 *
 * @example
 * // Fire and forget
 * sendHeartbeat('odin-PS-8f4a2b', 50, 'epic-007-A').catch(err => {
 *   console.error('Heartbeat failed:', err);
 * });
 */
export async function sendHeartbeat(
  instanceId: string,
  contextPercent: number,
  currentEpic?: string
): Promise<HeartbeatOutput> {
  // Validate inputs early
  if (!instanceId || typeof instanceId !== 'string') {
    throw new Error('Invalid instanceId');
  }

  if (contextPercent < 0 || contextPercent > 100 || !Number.isInteger(contextPercent)) {
    throw new Error('contextPercent must be an integer between 0 and 100');
  }

  try {
    const start = Date.now();

    // Update in database
    const instance = await updateHeartbeat(instanceId, contextPercent, currentEpic);

    const duration = Date.now() - start;

    // Calculate age and stale status
    const ageSeconds = calculateInstanceAge(instance.last_heartbeat);
    const stale = isInstanceStale(instance.last_heartbeat);

    // Log performance warning if slow
    if (duration > 20) {
      console.warn(`Heartbeat slow: ${duration}ms for ${instanceId}`, {
        contextPercent,
        currentEpic,
      });
    }

    return {
      instance_id: instance.instance_id,
      status: stale ? InstanceStatus.STALE : instance.status,
      last_heartbeat: instance.last_heartbeat.toISOString(),
      age_seconds: ageSeconds,
      stale,
      context_percent: instance.context_percent,
    };
  } catch (error) {
    console.error(`Heartbeat failed for ${instanceId}:`, error);
    throw error;
  }
}

/**
 * Send heartbeat in background without blocking
 * Use this in PS/MS response handlers
 *
 * @param instanceId Instance ID
 * @param contextPercent Context usage (0-100)
 * @param currentEpic Optional current epic ID
 *
 * @example
 * // In PS response handler
 * sendHeartbeatAsync(instanceId, contextPercent, epic);
 * // Return response immediately without waiting
 */
export function sendHeartbeatAsync(
  instanceId: string,
  contextPercent: number,
  currentEpic?: string
): void {
  // Fire and forget - don't await
  sendHeartbeat(instanceId, contextPercent, currentEpic).catch((error) => {
    console.error(`Background heartbeat failed for ${instanceId}:`, error);
    // Don't rethrow - background operation
  });
}

/**
 * Check instance staleness
 *
 * @param lastHeartbeat Last heartbeat timestamp
 * @returns Object with stale status and age
 */
export function checkStaleness(lastHeartbeat: Date): { stale: boolean; ageSeconds: number } {
  const ageSeconds = calculateInstanceAge(lastHeartbeat);
  const stale = ageSeconds > STALE_TIMEOUT_SECONDS;

  return { stale, ageSeconds };
}

/**
 * Get stale timeout in seconds
 *
 * @returns Stale timeout in seconds
 */
export function getStaleTimeout(): number {
  return STALE_TIMEOUT_SECONDS;
}

/**
 * Format staleness message for user
 *
 * @param ageSeconds Age in seconds
 * @param status Instance status
 * @returns Formatted message
 */
export function formatStalenessMessage(ageSeconds: number, status: string): string {
  if (status === 'closed') {
    return 'Instance is closed';
  }

  if (ageSeconds > STALE_TIMEOUT_SECONDS) {
    const minutes = Math.floor(ageSeconds / 60);
    return `Instance is stale (no heartbeat for ${minutes} minutes)`;
  }

  if (ageSeconds < 60) {
    return `Instance active (${ageSeconds}s since last heartbeat)`;
  }

  const minutes = Math.floor(ageSeconds / 60);
  return `Instance active (${minutes}m since last heartbeat)`;
}
