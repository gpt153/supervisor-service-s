# Epic 008-B: EventLogger with Lineage Tracking

**Status**: Pending
**Priority**: HIGH
**Estimated Effort**: 10 hours
**Dependencies**: Epic 008-A (Schema Enhancement)
**Feature**: event-lineage-tracking

---

## Overview

Create a new `EventLogger` class that wraps the existing `EventStore` with automatic parent UUID tracking. This class maintains a "current parent" context that propagates through nested operations, making lineage tracking transparent to callers.

## Business Value

- **Transparent Lineage**: Developers don't manually track parent UUIDs
- **Context Propagation**: Parent UUID flows through async operations
- **Memory Safe**: Logs to database, never accumulates in memory
- **Smart Queries**: Bounded queries (LIMIT) prevent memory bloat

## Problem Statement

**Current EventStore API:**
```typescript
// Caller must manually track parent UUID
const parentEvent = await emitEvent(instanceId, 'user_message', {...});
const childEvent = await emitEvent(instanceId, 'spawn', {...}); // NO LINK!
```

**With EventLogger:**
```typescript
const logger = new EventLogger(instanceId);
const userMsgId = await logger.log('user_message', {...}); // parent: null
await logger.withParent(userMsgId, async () => {
  await logger.log('spawn', {...}); // parent: userMsgId automatically
});
```

## Acceptance Criteria

### 1. EventLogger Class

- [ ] Create `src/session/EventLogger.ts`
- [ ] Constructor accepts `instanceId: string`
- [ ] Implements methods:
  - `log(type, payload, options?)` - Logs event with current parent
  - `withParent(parentUuid, callback)` - Executes with parent context
  - `getParentChain(eventUuid)` - Walks parent chain
  - `getRecentEvents(limit?)` - Last N events (default 50)
  - `getTimeline(start, end)` - Events in time range

### 2. Parent Context Propagation

- [ ] Use AsyncLocalStorage for context
- [ ] `withParent()` sets context for nested async calls
- [ ] Nested `withParent()` calls create proper chains
- [ ] Context resets after callback completes

### 3. Memory Safety Guarantees

- [ ] `getRecentEvents()` always uses LIMIT (max 1000)
- [ ] `getParentChain()` has depth limit (max 1000)
- [ ] `getTimeline()` uses pagination (max 1000 per page)
- [ ] No method loads entire session into memory

### 4. Type Safety

- [ ] Full TypeScript types for all methods
- [ ] Event type validation (from EventTypeSchema)
- [ ] Payload validation for known event types

### 5. Error Handling

- [ ] Database errors are logged but non-fatal
- [ ] Invalid parent UUID throws ValidationError
- [ ] Graceful degradation if DB unavailable

---

## Technical Specifications

### EventLogger Implementation

```typescript
// src/session/EventLogger.ts

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
```

### Type Updates

```typescript
// Add to src/types/event-store.ts

export interface EventItem {
  event_id: string;
  instance_id?: string;
  event_type: string;
  sequence_num: number;
  timestamp: string;
  event_data: Record<string, any>;
  metadata?: Record<string, any>;
  // NEW: Lineage fields
  parent_uuid?: string;
  root_uuid?: string;
  depth?: number;
}
```

---

## Testing Requirements

### Unit Tests

```typescript
// tests/unit/EventLogger.test.ts

describe('EventLogger', () => {
  let logger: EventLogger;
  const instanceId = 'test-PS-abc123';

  beforeEach(async () => {
    // Register test instance
    await pool.query(
      `INSERT INTO supervisor_sessions (instance_id, project, instance_type)
       VALUES ($1, 'test', 'PS')`,
      [instanceId]
    );
    logger = new EventLogger(instanceId);
  });

  describe('log()', () => {
    it('should create event with null parent when no context', async () => {
      const eventId = await logger.log('user_message', { content: 'test' });
      expect(eventId).toBeDefined();

      const result = await pool.query(
        `SELECT parent_uuid, depth FROM event_store WHERE event_id = $1`,
        [eventId]
      );
      expect(result.rows[0].parent_uuid).toBeNull();
      expect(result.rows[0].depth).toBe(0);
    });

    it('should link to parent when inside withParent()', async () => {
      const parentId = await logger.log('user_message', {});

      await logger.withParent(parentId, async () => {
        const childId = await logger.log('spawn_decision', {});
        const result = await pool.query(
          `SELECT parent_uuid, depth FROM event_store WHERE event_id = $1`,
          [childId]
        );
        expect(result.rows[0].parent_uuid).toBe(parentId);
        expect(result.rows[0].depth).toBe(1);
      });
    });

    it('should support nested withParent() calls', async () => {
      const rootId = await logger.log('user_message', {});

      await logger.withParent(rootId, async () => {
        const childId = await logger.log('spawn_decision', {});

        await logger.withParent(childId, async () => {
          const grandchildId = await logger.log('tool_use', {});
          const result = await pool.query(
            `SELECT parent_uuid, depth, root_uuid FROM event_store WHERE event_id = $1`,
            [grandchildId]
          );
          expect(result.rows[0].parent_uuid).toBe(childId);
          expect(result.rows[0].depth).toBe(2);
          expect(result.rows[0].root_uuid).toBe(rootId);
        });
      });
    });
  });

  describe('getParentChain()', () => {
    it('should return chain from root to event', async () => {
      const rootId = await logger.log('user_message', {});
      let childId: string;

      await logger.withParent(rootId, async () => {
        childId = await logger.log('spawn_decision', {});
      });

      const chain = await logger.getParentChain(childId!);
      expect(chain).toHaveLength(2);
      expect(chain[0].event_id).toBe(rootId);
      expect(chain[1].event_id).toBe(childId);
    });
  });

  describe('getRecentEvents()', () => {
    it('should respect limit parameter', async () => {
      for (let i = 0; i < 100; i++) {
        await logger.log('test_event', { i });
      }

      const events = await logger.getRecentEvents(50);
      expect(events).toHaveLength(50);
    });

    it('should enforce max limit of 1000', async () => {
      const events = await logger.getRecentEvents(5000);
      // Should not throw, should cap at 1000
    });
  });
});
```

---

## Success Criteria

- [ ] EventLogger class created and exported
- [ ] log() method correctly sets parent from context
- [ ] withParent() propagates context through async calls
- [ ] Nested withParent() creates correct chains
- [ ] getParentChain() returns full chain
- [ ] getRecentEvents() respects limit
- [ ] All methods enforce max limit (1000)
- [ ] Unit tests pass (100%)
- [ ] No memory accumulation during logging

---

## Implementation Steps (for Haiku Agent)

1. **Create EventLogger.ts** at `src/session/EventLogger.ts`
2. **Update types** in `src/types/event-store.ts` to add lineage fields
3. **Export from index** in `src/session/index.ts`
4. **Write unit tests** in `tests/unit/EventLogger.test.ts`
5. **Run tests**: `npm test -- EventLogger`
6. **Verify no memory leaks**: Log 10,000 events, check memory stable

---

**Maintained by**: Meta-Supervisor
**Created**: 2026-01-31
**Last Updated**: 2026-01-31
