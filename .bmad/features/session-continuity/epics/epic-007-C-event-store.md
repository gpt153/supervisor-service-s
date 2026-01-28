# Epic 007-C: Event Store and State Tracking

**Status**: Pending
**Priority**: HIGH
**Estimated Effort**: 50 hours
**Cost**: $0 (infrastructure)
**Dependencies**: epic-007-A (Instance Registry)

---

## Overview

Build an immutable event store that tracks all state transitions in the session continuity system. This provides a complete audit trail of what happened to each instance, enabling replay, analysis, and intelligent resume suggestions.

## Business Value

- **Auditability**: Complete record of state changes (epic started, test passed, deployment done)
- **Replay Capability**: Reconstruct any instance state by replaying events
- **Analysis**: Identify patterns (which epics frequently fail, which operations are slow)
- **Resume Intelligence**: Use event sequence to suggest next steps

## Problem Statement

**Current State:**
- Command log tells us WHAT actions were taken
- Event store tells us WHY and WHEN state changed
- Without events, resume engine cannot suggest next steps intelligently

**Example Gap:**
```
Commands:
- spawn implementation for epic-003
- run tests
- commit changes

Events Missing:
- epic_started (epic-003)
- test_passed (epic-003, 5/8 tests)
- epic_completed (epic-003)
- prd_updated (epic-003, version bumped)
```

**Without events**: Resume engine says "Continue testing"
**With events**: Resume engine says "Epic complete! 5/8 tests passed. PRD updated. Ready for next epic."

## Acceptance Criteria

### Core Event Store Implementation

1. **Database Schema**
   - [ ] Create `event_store` table with fields:
     - `event_id` (UUID, PK)
     - `instance_id` (FK to supervisor_sessions)
     - `event_type` (VARCHAR: epic_started, epic_completed, test_passed, deployment_done, etc.)
     - `sequence_num` (BIGINT, monotonically increasing per instance)
     - `timestamp` (TIMESTAMPTZ, auto-set to NOW())
     - `event_data` (JSONB: structured event payload)
     - `metadata` (JSONB: tags, context)
     - `created_at`, `updated_at` timestamps
   - [ ] Index on `(instance_id, sequence_num)` for fast replay
   - [ ] Index on `(event_type, timestamp)` for queries
   - [ ] Index on `(instance_id, created_at)` for cleanup

2. **Event Types Defined**
   - [ ] Instance lifecycle: `instance_registered`, `instance_heartbeat`, `instance_stale`
   - [ ] Epic lifecycle: `epic_started`, `epic_completed`, `epic_failed`
   - [ ] Testing: `test_started`, `test_passed`, `test_failed`, `validation_passed`, `validation_failed`
   - [ ] Git operations: `commit_created`, `pr_created`, `pr_merged`
   - [ ] Deployment: `deployment_started`, `deployment_completed`, `deployment_failed`
   - [ ] Work state: `context_window_updated`, `checkpoint_created`, `checkpoint_loaded`
   - [ ] Planning: `epic_planned`, `feature_requested`, `task_spawned`

3. **MCP Tools Implementation**
   - [ ] `mcp_meta_emit_event(instance_id, event_type, event_data, metadata?)`
     - Returns: `{ success: bool, event_id: string }`
     - Validates instance exists
     - Assigns monotonic sequence number
     - Stores atomically
   - [ ] `mcp_meta_query_events(instance_id, filters?, limit?, offset?)`
     - Filters: event_type, date_range, keyword search on data
     - Returns: `{ events: [], total_count, has_more }`
     - Performance: <100ms for last 100 events
   - [ ] `mcp_meta_replay_events(instance_id, to_sequence_num?)`
     - Reconstructs state by replaying events in order
     - Returns: `{ final_state, events_replayed, duration }`
   - [ ] `mcp_meta_list_event_types()`
     - Returns: All available event types with descriptions

### Event Emission Integration

4. **Automatic Event Emission**
   - [ ] Heartbeat handler auto-emits `instance_heartbeat` event
   - [ ] Instance registration auto-emits `instance_registered`
   - [ ] Stale detection auto-emits `instance_stale`
   - [ ] Command logger hooks emit `command_logged` (optional, high-volume)

5. **Manual Event Emission**
   - [ ] PS integration guide for emitting events:
     - `emit_event('epic_started', { epic_id, feature_name, estimated_hours })`
     - `emit_event('epic_completed', { epic_id, duration_hours, files_changed })`
     - `emit_event('test_passed', { epic_id, test_count, coverage })`
     - `emit_event('deployment_done', { service, port, health_status })`

### Event Data Schema

6. **Epic Started Event**
   ```json
   {
     "epic_id": "epic-003",
     "feature_name": "authentication-oauth",
     "estimated_hours": 60,
     "spawned_by": "plan-feature-interactive",
     "acceptance_criteria_count": 12
   }
   ```

7. **Epic Completed Event**
   ```json
   {
     "epic_id": "epic-003",
     "duration_hours": 58.5,
     "files_changed": 23,
     "tests_passed": 45,
     "pr_url": "https://github.com/project/pull/123",
     "validation_confidence": 0.96,
     "issues_encountered": ["cors_headers", "token_refresh"]
   }
   ```

8. **Test Passed Event**
   ```json
   {
     "epic_id": "epic-003",
     "test_type": "unit|integration|e2e",
     "passed_count": 45,
     "failed_count": 0,
     "coverage_percent": 87,
     "duration_seconds": 342
   }
   ```

9. **Deployment Done Event**
   ```json
   {
     "service": "supervisor-mcp",
     "port": 8081,
     "health_status": "healthy",
     "response_time_ms": 12,
     "git_commit": "a1b2c3d",
     "docker_image": "supervisor:latest"
   }
   ```

### Performance Requirements

10. **Event Emission Performance**
    - [ ] Event emit must complete in <10ms (p99)
    - [ ] Logging must be async, non-blocking
    - [ ] Database write must be fast (batch if needed)

11. **Event Query Performance**
    - [ ] Last 100 events query: <50ms
    - [ ] Event replay (100 events): <200ms
    - [ ] Complex query (event_type + date range): <100ms

12. **Storage Requirements**
    - [ ] Each event: ~500 bytes average
    - [ ] Retention: 90 days
    - [ ] Expected: ~500KB/day = ~45MB/quarter
    - [ ] Archival: Old events can be compressed to cold storage

### Data Integrity

13. **Event Immutability**
    - [ ] Events are append-only (no updates, no deletes in normal operation)
    - [ ] Sequence numbers are monotonically increasing (enforced in DB)
    - [ ] Timestamps are immutable (set at creation, never modified)

14. **Event Validation**
    - [ ] event_type must be in predefined list
    - [ ] event_data must be valid JSON
    - [ ] instance_id must exist in supervisor_sessions
    - [ ] All required fields present before storing

### Testing Requirements

15. **Unit Tests**
    - [ ] Event emission (all event types)
    - [ ] Event validation (invalid types, missing fields)
    - [ ] Sequence number monotonicity
    - [ ] Event queries with various filters
    - [ ] Event replay correctness

16. **Integration Tests**
    - [ ] Full lifecycle: Register → Emit events → Query → Replay
    - [ ] Event ordering across concurrent instances
    - [ ] Storage growth and cleanup (90-day retention)
    - [ ] Query performance with large datasets (10k events)

17. **Replay Tests**
    - [ ] Replay all events produces correct final state
    - [ ] Partial replay (to_sequence_num) works correctly
    - [ ] State reconstruction matches real-time observations

---

## Technical Specifications

### Database Migration

**File**: `migrations/003-event-store.sql`

```sql
CREATE TABLE event_store (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES supervisor_sessions(instance_id),
  event_type VARCHAR(64) NOT NULL,
  sequence_num BIGINT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_data JSONB NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_sequence UNIQUE (instance_id, sequence_num)
);

CREATE INDEX idx_event_store_instance_seq
  ON event_store(instance_id, sequence_num);

CREATE INDEX idx_event_store_type_timestamp
  ON event_store(event_type, timestamp DESC);

CREATE INDEX idx_event_store_instance_time
  ON event_store(instance_id, created_at DESC);
```

### MCP Tool Specifications

**Tool 1: mcp_meta_emit_event**

```typescript
interface EmitEventRequest {
  instance_id: string;
  event_type: string;
  event_data: Record<string, any>;
  metadata?: Record<string, any>;
}

interface EmitEventResponse {
  success: boolean;
  event_id: string;
  sequence_num: number;
  timestamp: string;
  error?: string;
}
```

**Tool 2: mcp_meta_query_events**

```typescript
interface QueryEventsRequest {
  instance_id: string;
  filters?: {
    event_type?: string | string[];
    start_date?: string; // ISO8601
    end_date?: string;
    keyword?: string;
  };
  limit?: number; // default 100, max 1000
  offset?: number; // default 0
}

interface QueryEventsResponse {
  events: Array<{
    event_id: string;
    event_type: string;
    sequence_num: number;
    timestamp: string;
    event_data: Record<string, any>;
    metadata?: Record<string, any>;
  }>;
  total_count: number;
  has_more: boolean;
}
```

**Tool 3: mcp_meta_replay_events**

```typescript
interface ReplayEventsRequest {
  instance_id: string;
  to_sequence_num?: number;
}

interface ReplayEventsResponse {
  final_state: {
    last_epic?: string;
    last_event_type?: string;
    latest_timestamp?: string;
    total_events_replayed: number;
    checkpoint_state?: Record<string, any>;
  };
  events_replayed: number;
  duration_ms: number;
  success: boolean;
}
```

**Tool 4: mcp_meta_list_event_types**

```typescript
interface ListEventTypesResponse {
  event_types: Array<{
    type: string;
    description: string;
    category: 'instance' | 'epic' | 'testing' | 'git' | 'deployment' | 'work_state' | 'planning';
    required_fields: string[];
    optional_fields: string[];
  }>;
}
```

### Implementation Approach

**Phase 1: Database & Core (Days 1-2)**
1. Create migration for event_store table
2. Implement EventStore class (emit, query, replay)
3. Add MCP tool endpoints

**Phase 2: Integration (Days 3-4)**
1. Wire heartbeat to emit events
2. Wire instance registration to emit events
3. Add event validation layer

**Phase 3: Testing (Day 5)**
1. Unit tests for all event types
2. Integration tests (full lifecycle)
3. Performance tests (query speed, storage)
4. Load tests (concurrent instances)

---

## Files to Create/Modify

### Create

1. **`migrations/003-event-store.sql`**
   - Event store schema
   - Indexes for performance

2. **`src/event-store/event-store.ts`**
   - Core EventStore class
   - Emit, query, replay functions
   - Validation logic

3. **`src/types/event-types.ts`**
   - TypeScript interfaces for all event types
   - Event schema validation (Zod)

4. **`src/mcp/tools/event-tools.ts`**
   - MCP tool implementations (emit, query, replay, list)
   - Error handling, validation

5. **`tests/unit/event-store.test.ts`**
   - Event emission tests
   - Query tests
   - Replay tests
   - Sequence number tests

6. **`tests/integration/event-store-integration.test.ts`**
   - Full lifecycle tests
   - Concurrent instance tests
   - Performance benchmarks

### Modify

1. **`src/db/client.ts`**
   - Add EventStore instance
   - Connect to PostgreSQL

2. **`src/mcp/tools.ts`**
   - Register new event tools

3. **`src/types/index.ts`**
   - Export event types

---

## Testing Requirements

### Unit Tests (70% of coverage)

- Event type validation
- Event data schema validation
- Sequence number generation
- Query filtering
- Replay logic

### Integration Tests (20% of coverage)

- Register → Emit → Query → Replay flow
- Concurrent instance event isolation
- Storage and cleanup
- Performance benchmarks

### Performance Tests (10% of coverage)

- Emit performance (<10ms)
- Query performance (<100ms for 100 events)
- Replay performance (<200ms for 100 events)

---

## Success Criteria

- [ ] All event types defined and documented
- [ ] MCP tools implemented and tested
- [ ] Event emission <10ms (p99)
- [ ] Event query <100ms (p99)
- [ ] Event replay correctness verified
- [ ] Storage within 500KB/day budget
- [ ] Zero lost events (ACID guarantees)
- [ ] Integration tests passing (100%)

---

## Related Documents

- `prd.md` - Feature overview
- `epic-007-A-instance-registry.md` - Dependency (instance registry)
- `epic-007-D-checkpoint-system.md` - Uses event data for checkpoints
- `epic-007-E-resume-engine.md` - Uses events for resume suggestions

---

**Maintained by**: Meta-Supervisor
**Created**: 2026-01-28
**Last Updated**: 2026-01-28
