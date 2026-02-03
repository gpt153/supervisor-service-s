/**
 * EventStore Service (Epic 007-C)
 * Immutable event store for tracking all state transitions in supervisor instances
 *
 * Core responsibilities:
 * - Emit events with automatic sequence number assignment
 * - Query events with filtering by type, date range, keywords
 * - Replay events to reconstruct state
 * - Aggregate events by type
 * - Validate instance existence before event emission
 */

import { pool } from '../db/client.js';
import { getInstanceDetails } from './InstanceRegistry.js';
import {
  EventType,
  EventItem,
  BaseEvent,
  EventTypeSchema,
  EmitEventInputSchema,
  QueryEventsInputSchema,
  ReplayEventsInputSchema,
} from '../types/event-store.js';

/**
 * Error class for invalid event
 */
export class InvalidEventError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidEventError';
  }
}

/**
 * Error class for instance not found
 */
export class InstanceNotFoundForEventError extends Error {
  constructor(instanceId: string) {
    super(`Instance not found for event emission: ${instanceId}`);
    this.name = 'InstanceNotFoundForEventError';
  }
}

/**
 * Error class for database operation failure
 */
export class EventStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EventStoreError';
  }
}

/**
 * Emit a new event for an instance
 *
 * @param instanceId Instance ID
 * @param eventType Event type (must be valid EventType)
 * @param eventData Event payload (JSONB)
 * @param metadata Optional metadata
 * @returns Emitted event with assigned event_id and sequence_num
 * @throws InstanceNotFoundForEventError if instance doesn't exist
 * @throws InvalidEventError if event_type or event_data is invalid
 * @throws EventStoreError on database error
 *
 * @example
 * const event = await emitEvent('odin-PS-8f4a2b', 'epic_started', {
 *   epic_id: 'epic-003',
 *   feature_name: 'authentication',
 *   estimated_hours: 60,
 *   spawned_by: 'plan-feature',
 *   acceptance_criteria_count: 12
 * });
 */
export async function emitEvent(
  instanceId: string,
  eventType: string,
  eventData: Record<string, any>,
  metadata?: Record<string, any>
): Promise<{
  event_id: string;
  sequence_num: number;
  timestamp: Date;
}> {
  const start = Date.now();

  // Validate event type
  const typeValidation = EventTypeSchema.safeParse(eventType);
  if (!typeValidation.success) {
    throw new InvalidEventError(`Invalid event type: ${eventType}`);
  }

  // Validate event data is JSONB-compatible
  try {
    JSON.stringify(eventData);
  } catch (error) {
    throw new InvalidEventError(`Event data is not JSON serializable: ${error}`);
  }

  // Verify instance exists
  const instance = await getInstanceDetails(instanceId);
  if (!instance) {
    throw new InstanceNotFoundForEventError(instanceId);
  }

  try {
    // Get next sequence number for this instance
    const seqResult = await pool.query<{ nextseq: number }>(
      `SELECT COALESCE(MAX(sequence_num), 0) + 1 as nextseq
       FROM event_store
       WHERE instance_id = $1`,
      [instanceId]
    );

    const nextSequenceNum = seqResult.rows[0]?.nextseq || 1;

    // Insert event (database generates UUID)
    const result = await pool.query<{
      event_id: string;
      sequence_num: number;
      timestamp: string;
    }>(
      `INSERT INTO event_store (
        instance_id, event_type, sequence_num, event_data, metadata, timestamp
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      RETURNING event_id, sequence_num, timestamp`,
      [instanceId, eventType, nextSequenceNum, eventData, metadata || null]
    );

    if (result.rows.length === 0) {
      throw new EventStoreError('Failed to insert event');
    }

    const row = result.rows[0];
    const duration = Date.now() - start;

    if (duration > 10) {
      console.warn(`emitEvent slow: ${duration}ms for ${instanceId}/${eventType}`);
    }

    return {
      event_id: row.event_id,
      sequence_num: row.sequence_num,
      timestamp: new Date(row.timestamp),
    };
  } catch (error: any) {
    if (error instanceof InvalidEventError || error instanceof InstanceNotFoundForEventError) {
      throw error;
    }
    throw new EventStoreError(`Failed to emit event: ${error.message}`);
  }
}

/**
 * Query events for an instance with optional filtering
 *
 * @param instanceId Instance ID
 * @param filters Optional filters (event_type, date range, keyword)
 * @param limit Number of results (default 100, max 1000)
 * @param offset Pagination offset (default 0)
 * @returns Array of events sorted by sequence_num ASC
 *
 * @example
 * const events = await queryEvents('odin-PS-8f4a2b', {
 *   event_type: 'epic_started',
 *   start_date: '2026-01-25T00:00:00Z',
 *   end_date: '2026-01-28T23:59:59Z'
 * }, 100, 0);
 */
export async function queryEvents(
  instanceId: string,
  filters?: {
    event_type?: string | string[];
    start_date?: string;
    end_date?: string;
    keyword?: string;
  },
  limit: number = 100,
  offset: number = 0
): Promise<{
  events: EventItem[];
  total_count: number;
  has_more: boolean;
}> {
  const start = Date.now();

  // Clamp limit
  limit = Math.min(Math.max(limit, 1), 1000);
  offset = Math.max(offset, 0);

  let whereClause = 'WHERE instance_id = $1';
  const params: any[] = [instanceId];
  let paramCount = 1;

  // Build filter WHERE clauses
  if (filters?.event_type) {
    const eventTypes = Array.isArray(filters.event_type)
      ? filters.event_type
      : [filters.event_type];

    const placeholders = eventTypes.map(() => `$${++paramCount}`);
    whereClause += ` AND event_type IN (${placeholders.join(', ')})`;
    params.push(...eventTypes);
  }

  if (filters?.start_date) {
    whereClause += ` AND timestamp >= $${++paramCount}`;
    params.push(filters.start_date);
  }

  if (filters?.end_date) {
    whereClause += ` AND timestamp <= $${++paramCount}`;
    params.push(filters.end_date);
  }

  if (filters?.keyword) {
    whereClause += ` AND (event_type ILIKE $${++paramCount}
                         OR event_data::text ILIKE $${paramCount}
                         OR metadata::text ILIKE $${paramCount})`;
    params.push(`%${filters.keyword}%`);
  }

  // Get total count
  const countResult = await pool.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM event_store ${whereClause}`,
    params
  );

  const totalCount = parseInt((countResult.rows[0]?.count || '0').toString(), 10);

  // Get paginated results
  const queryResult = await pool.query<EventItem>(
    `SELECT event_id, event_type, sequence_num, timestamp, event_data, metadata
     FROM event_store
     ${whereClause}
     ORDER BY sequence_num ASC
     LIMIT $${++paramCount} OFFSET $${++paramCount}`,
    [...params, limit, offset]
  );

  const duration = Date.now() - start;

  if (duration > 100) {
    console.warn(`queryEvents slow: ${duration}ms for ${instanceId}`);
  }

  return {
    events: queryResult.rows.map((row) => {
      let timestamp: string;
      if (typeof row.timestamp === 'string') {
        timestamp = row.timestamp;
      } else if (row.timestamp && typeof row.timestamp === 'object' && 'toISOString' in row.timestamp) {
        timestamp = (row.timestamp as Date).toISOString();
      } else {
        timestamp = new Date(row.timestamp as any).toISOString();
      }
      return {
        event_id: row.event_id,
        event_type: row.event_type,
        sequence_num: row.sequence_num,
        timestamp,
        event_data: row.event_data,
        metadata: row.metadata,
      };
    }),
    total_count: totalCount,
    has_more: offset + limit < totalCount,
  };
}

/**
 * Replay events to reconstruct state
 * Returns aggregated state from replaying events in order
 *
 * @param instanceId Instance ID
 * @param toSequenceNum Optional sequence number to replay up to (inclusive)
 * @returns Final state after replaying all events up to toSequenceNum
 *
 * @example
 * const state = await replayEvents('odin-PS-8f4a2b', 100);
 * // Returns: { last_epic: 'epic-003', last_event_type: 'epic_completed', ... }
 */
export async function replayEvents(
  instanceId: string,
  toSequenceNum?: number
): Promise<{
  final_state: {
    last_epic?: string;
    last_event_type?: string;
    latest_timestamp?: string;
    total_events_replayed: number;
    checkpoint_state?: Record<string, any>;
  };
  events_replayed: number;
  duration_ms: number;
}> {
  const start = Date.now();

  let query = `SELECT event_id, event_type, sequence_num, timestamp, event_data
               FROM event_store
               WHERE instance_id = $1`;

  const params: any[] = [instanceId];

  if (toSequenceNum !== undefined) {
    query += ` AND sequence_num <= $2`;
    params.push(toSequenceNum);
  }

  query += ` ORDER BY sequence_num ASC`;

  const result = await pool.query<{
    event_id: string;
    event_type: string;
    sequence_num: number;
    timestamp: Date | string;
    event_data: Record<string, any>;
  }>(query, params);

  // Aggregate state by replaying events
  const state: {
    last_epic?: string;
    last_event_type?: string;
    latest_timestamp?: string;
    total_events_replayed: number;
    checkpoint_state: Record<string, any>;
  } = {
    last_epic: undefined,
    last_event_type: undefined,
    latest_timestamp: undefined,
    total_events_replayed: result.rows.length,
    checkpoint_state: {},
  };

  for (const event of result.rows) {
    state.last_event_type = event.event_type;
    if (typeof event.timestamp === 'string') {
      state.latest_timestamp = event.timestamp;
    } else if (event.timestamp && typeof event.timestamp === 'object' && 'toISOString' in event.timestamp) {
      state.latest_timestamp = (event.timestamp as Date).toISOString();
    } else {
      state.latest_timestamp = new Date(event.timestamp as any).toISOString();
    }

    // Extract epic_id if present in event_data
    if (event.event_data?.epic_id) {
      state.last_epic = event.event_data.epic_id;
    }

    // Track checkpoint state if checkpoint events
    if (event.event_type === 'checkpoint_created') {
      state.checkpoint_state = {
        ...state.checkpoint_state,
        created_at: state.latest_timestamp,
        checkpoint_id: event.event_data.checkpoint_id,
      };
    }

    if (event.event_type === 'checkpoint_loaded') {
      state.checkpoint_state = {
        ...state.checkpoint_state,
        loaded_at: state.latest_timestamp,
      };
    }
  }

  const duration = Date.now() - start;

  if (duration > 200) {
    console.warn(`replayEvents slow: ${duration}ms for ${instanceId} (${result.rows.length} events)`);
  }

  return {
    final_state: state,
    events_replayed: result.rows.length,
    duration_ms: duration,
  };
}

/**
 * Get event counts by type
 *
 * @param instanceId Instance ID
 * @returns Object with event_type as key and count as value
 */
export async function aggregateEventsByType(
  instanceId: string
): Promise<Record<string, number>> {
  const result = await pool.query<{ event_type: string; count: number }>(
    `SELECT event_type, COUNT(*) as count
     FROM event_store
     WHERE instance_id = $1
     GROUP BY event_type
     ORDER BY count DESC`,
    [instanceId]
  );

  const aggregated: Record<string, number> = {};
  for (const row of result.rows) {
    aggregated[row.event_type] = parseInt(row.count.toString(), 10);
  }

  return aggregated;
}

/**
 * Get latest events for an instance (most recent first)
 *
 * @param instanceId Instance ID
 * @param limit Number of events to return (default 10)
 * @returns Array of latest events
 */
export async function getLatestEvents(
  instanceId: string,
  limit: number = 10
): Promise<EventItem[]> {
  const result = await pool.query<EventItem>(
    `SELECT event_id, event_type, sequence_num, timestamp, event_data, metadata
     FROM event_store
     WHERE instance_id = $1
     ORDER BY sequence_num DESC
     LIMIT $2`,
    [instanceId, Math.min(Math.max(limit, 1), 1000)]
  );

  return result.rows
    .reverse()
    .map((row) => {
      let timestamp: string;
      if (typeof row.timestamp === 'string') {
        timestamp = row.timestamp;
      } else if (row.timestamp && typeof row.timestamp === 'object' && 'toISOString' in row.timestamp) {
        timestamp = (row.timestamp as Date).toISOString();
      } else {
        timestamp = new Date(row.timestamp as any).toISOString();
      }
      return {
        event_id: row.event_id,
        event_type: row.event_type,
        sequence_num: row.sequence_num,
        timestamp,
        event_data: row.event_data,
        metadata: row.metadata,
      };
    });
}

/**
 * Get event by ID
 *
 * @param eventId Event UUID
 * @returns Event record or null if not found
 */
export async function getEventById(eventId: string): Promise<EventItem | null> {
  const result = await pool.query<EventItem>(
    `SELECT event_id, event_type, sequence_num, timestamp, event_data, metadata
     FROM event_store
     WHERE event_id = $1`,
    [eventId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  let timestamp: string;
  if (typeof row.timestamp === 'string') {
    timestamp = row.timestamp;
  } else if (row.timestamp && typeof row.timestamp === 'object' && 'toISOString' in row.timestamp) {
    timestamp = (row.timestamp as Date).toISOString();
  } else {
    timestamp = new Date(row.timestamp as any).toISOString();
  }
  return {
    event_id: row.event_id,
    event_type: row.event_type,
    sequence_num: row.sequence_num,
    timestamp,
    event_data: row.event_data,
    metadata: row.metadata,
  };
}

/**
 * Get total event count for an instance
 *
 * @param instanceId Instance ID
 * @returns Total number of events
 */
export async function getEventCount(instanceId: string): Promise<number> {
  const result = await pool.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM event_store WHERE instance_id = $1`,
    [instanceId]
  );

  return parseInt((result.rows[0]?.count || '0').toString(), 10);
}

/**
 * Delete events for an instance (for cleanup/testing)
 * NOTE: Should only be used for testing or cleanup, not in normal operation
 *
 * @param instanceId Instance ID
 * @returns Number of events deleted
 */
export async function deleteEventsForInstance(instanceId: string): Promise<number> {
  const result = await pool.query(
    `DELETE FROM event_store WHERE instance_id = $1`,
    [instanceId]
  );

  return result.rowCount || 0;
}
