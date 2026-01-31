/**
 * EventLogger with Automatic Parent UUID Tracking (Epic 008-B)
 *
 * Wraps EventStore with AsyncLocalStorage for transparent parent context propagation.
 * Developers don't manually track parent UUIDs - they flow automatically through async operations.
 *
 * @example
 * const logger = new EventLogger('odin-PS-abc123');
 *
 * // Log root event
 * const msgId = await logger.log('user_message', { content: 'Deploy app' });
 *
 * // Log child events with automatic parent linking
 * await logger.withParent(msgId, async () => {
 *   await logger.log('spawn_decision', { reason: 'Complex task' });
 *   await logger.log('tool_use', { tool: 'Task' });
 * });
 */

import { AsyncLocalStorage } from 'async_hooks';
import { pool } from '../db/client.js';
import { EventType, EventItem } from '../types/event-store.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Parent context for automatic lineage tracking
 */
interface ParentContext {
  parentUuid: string | null;
}

/**
 * EventLogger with automatic parent UUID tracking
 *
 * Uses AsyncLocalStorage to propagate parent context through async operations.
 *
 * @example
 * const logger = new EventLogger('odin-PS-abc123');
 *
 * // Log root event
 * const msgId = await logger.log('user_message', { content: 'Deploy app' });
 *
 * // Log child events with automatic parent linking
 * await logger.withParent(msgId, async () => {
 *   await logger.log('spawn_decision', { reason: 'Complex task' });
 *   await logger.log('tool_use', { tool: 'Task' });
 * });
 */
export class EventLogger {
  private instanceId: string;
  private static asyncStorage = new AsyncLocalStorage<ParentContext>();

  constructor(instanceId: string) {
    if (!instanceId || typeof instanceId !== 'string') {
      throw new Error('EventLogger requires valid instanceId');
    }
    this.instanceId = instanceId;
  }

  /**
   * Get current parent UUID from async context
   */
  private getCurrentParent(): string | null {
    const ctx = EventLogger.asyncStorage.getStore();
    return ctx?.parentUuid ?? null;
  }

  /**
   * Log an event with automatic parent linking
   *
   * @param type Event type (must be valid EventType)
   * @param payload Event data
   * @param options Optional: explicit parentUuid, durationMs, success, errorMessage
   * @returns Promise<string> Event UUID
   */
  async log(
    type: EventType | string,
    payload: Record<string, any>,
    options?: {
      parentUuid?: string;
      durationMs?: number;
      success?: boolean;
      errorMessage?: string;
    }
  ): Promise<string> {
    const eventId = uuidv4();
    const parentUuid = options?.parentUuid ?? this.getCurrentParent();

    try {
      // Get next sequence number
      const seqResult = await pool.query<{ nextseq: number }>(
        `SELECT COALESCE(MAX(sequence_num), 0) + 1 as nextseq
         FROM event_store WHERE instance_id = $1`,
        [this.instanceId]
      );
      const sequenceNum = seqResult.rows[0]?.nextseq ?? 1;

      // Insert event (trigger handles depth and root_uuid)
      await pool.query(
        `INSERT INTO event_store (
          event_id, instance_id, event_type, sequence_num,
          event_data, parent_uuid, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
        [eventId, this.instanceId, type, sequenceNum, payload, parentUuid]
      );

      return eventId;
    } catch (error: any) {
      // Log error but don't crash the caller
      console.error(`EventLogger.log failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute callback with parent context set
   *
   * All log() calls within callback will use this parent UUID.
   *
   * @param parentUuid Parent event UUID
   * @param callback Async function to execute
   * @returns Promise<T> Callback result
   */
  async withParent<T>(
    parentUuid: string,
    callback: () => Promise<T>
  ): Promise<T> {
    return EventLogger.asyncStorage.run(
      { parentUuid },
      callback
    );
  }

  /**
   * Get parent chain for an event
   *
   * @param eventUuid Event to start from
   * @param maxDepth Maximum chain depth (default 1000)
   * @returns Promise<EventItem[]> Chain from root to event
   */
  async getParentChain(
    eventUuid: string,
    maxDepth: number = 1000
  ): Promise<EventItem[]> {
    const result = await pool.query<EventItem>(
      `SELECT * FROM get_parent_chain($1, $2)`,
      [eventUuid, Math.min(maxDepth, 1000)]
    );
    return result.rows;
  }

  /**
   * Get recent events for this instance
   *
   * @param limit Max events to return (default 50, max 1000)
   * @returns Promise<EventItem[]> Most recent events
   */
  async getRecentEvents(limit: number = 50): Promise<EventItem[]> {
    const result = await pool.query<EventItem>(
      `SELECT event_id, instance_id, event_type, sequence_num,
              timestamp, event_data, parent_uuid, root_uuid, depth
       FROM event_store
       WHERE instance_id = $1
       ORDER BY timestamp DESC
       LIMIT $2`,
      [this.instanceId, Math.min(limit, 1000)]
    );
    return result.rows.reverse(); // Return oldest first
  }

  /**
   * Get events in a time range
   *
   * @param start Start time
   * @param end End time
   * @param limit Max events (default 1000)
   * @returns Promise<EventItem[]> Events in range
   */
  async getTimeline(
    start: Date,
    end: Date,
    limit: number = 1000
  ): Promise<EventItem[]> {
    const result = await pool.query<EventItem>(
      `SELECT event_id, instance_id, event_type, sequence_num,
              timestamp, event_data, parent_uuid, root_uuid, depth
       FROM event_store
       WHERE instance_id = $1
         AND timestamp BETWEEN $2 AND $3
       ORDER BY timestamp
       LIMIT $4`,
      [this.instanceId, start, end, Math.min(limit, 1000)]
    );
    return result.rows;
  }

  /**
   * Get all children of an event
   *
   * @param eventUuid Parent event UUID
   * @returns Promise<EventItem[]> Child events
   */
  async getChildEvents(eventUuid: string): Promise<EventItem[]> {
    const result = await pool.query<EventItem>(
      `SELECT * FROM get_child_events($1)`,
      [eventUuid]
    );
    return result.rows;
  }
}
