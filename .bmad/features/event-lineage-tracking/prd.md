# Product Requirements Document: Event Lineage Tracking System

**Feature ID:** event-lineage-tracking
**Created:** 2026-01-31
**Status:** Ready for Implementation
**Version:** 1.0.0
**Priority:** HIGH (Prevents Claude Code-style memory leaks)
**Planning Completed:** 2026-01-31

---

## Executive Summary

Implement a database-backed event lineage tracking system inspired by Claude Code's parent UUID chains, but designed to **avoid the catastrophic memory leaks** that plague Claude Code's in-memory approach.

**Key Innovation:** Store full event chains in PostgreSQL with parent-child relationships, enabling intelligent session recovery and debugging WITHOUT loading entire session history into memory.

**Business Impact:**
- **Session Intelligence**: Trace exact decision chains ("Why did it run that command?")
- **Smart Resume**: Resume sessions with only last 50 events, not entire history
- **Debug Power**: Find root cause of failures by walking parent chain
- **Memory Safety**: 100MB session in DB vs 40GB in RAM (Claude's approach)
- **Audit Trail**: Complete record of every decision and action

---

## Problem Statement

### Current State

Our session continuity system (Epic 007) tracks:
- ✅ Instance registration
- ✅ Heartbeats
- ✅ Command logging (critical actions only)
- ✅ Checkpoints
- ❌ **NO event lineage** (can't trace decisions)
- ❌ **NO parent-child relationships** (can't walk execution chains)
- ❌ **NO full event stream** (only critical operations logged)

**Example of missing capability:**
```
User: "Why did the deployment fail?"
Current system: Check last command log entry
Missing: Cannot trace: User request → Planning → Spawn → Deploy → Error
```

### Claude Code's Approach (DO NOT COPY!)

Claude Code stores events in `.jsonl` files with parent UUIDs:
```json
{"uuid": "msg-1", "parentUuid": null, "type": "user", "content": "Deploy app"}
{"uuid": "msg-2", "parentUuid": "msg-1", "type": "assistant", "content": "..."}
{"uuid": "tool-1", "parentUuid": "msg-2", "type": "tool_use", "name": "Bash"}
```

**The Fatal Flaw:**
- Loads **entire .jsonl** into memory on resume
- 102MB file = 102MB RAM instantly (no streaming)
- Multi-day sessions → 40GB+ RAM → VM crash
- No garbage collection during active session

**Mathematical horror:**
- Session with 475 events: 2.3MB on disk, **40GB in RAM** (140,000x bloat!)

### What We Need

✅ **Parent UUID chains** (Claude's good idea)
❌ **NOT in-memory storage** (Claude's fatal mistake)
✅ **Database-backed** (paginated, streamed, bounded memory)
✅ **Smart queries** (last N events, parent chain only)

---

## Goals & Objectives

### Primary Goal

Build an event lineage tracking system that provides Claude Code-level debugging intelligence WITHOUT the memory leaks.

### Success Criteria

**Event Tracking:**
- ✅ Every significant action generates event (spawn, tool use, result, state change)
- ✅ Every event has unique UUID and parent UUID
- ✅ Can reconstruct execution chain by walking parent pointers
- ✅ Events stored in database, NOT held in memory

**Memory Safety:**
- ✅ Resume loads max 50 events (not entire session)
- ✅ Active session memory bounded (<100MB regardless of duration)
- ✅ Can query 100,000+ event sessions without loading all
- ✅ Pagination prevents memory bloat

**Debugging Power:**
- ✅ Trace failure to root cause: `SELECT * FROM get_parent_chain($error_event_id)`
- ✅ Timeline reconstruction: Show what happened in last hour
- ✅ Decision audit: "What led to this spawn?"
- ✅ Performance analysis: Event duration and parent-child timing

**Performance:**
- ✅ Event insert: <10ms
- ✅ Parent chain query: <50ms (depth 100)
- ✅ Resume query: <100ms (last 50 events)
- ✅ Storage: ~1KB per event (100x smaller than Claude's in-memory)

---

## Technical Specifications

### Database Schema

#### New Table: session_events

```sql
CREATE TABLE session_events (
  id BIGSERIAL PRIMARY KEY,

  -- Identity
  uuid VARCHAR(36) UNIQUE NOT NULL,
  instance_id VARCHAR(36) REFERENCES supervisor_sessions(instance_id),

  -- Lineage (THE KEY FEATURE)
  parent_uuid VARCHAR(36), -- Links to parent event
  root_uuid VARCHAR(36),   -- Top-level event (for fast queries)
  depth INTEGER,           -- Distance from root (for optimization)

  -- Event data
  event_type VARCHAR(50) NOT NULL, -- user_message, assistant_response, tool_use, tool_result, state_change
  timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

  -- Payload
  payload JSONB NOT NULL,  -- Full event data (flexible structure)

  -- Metadata
  duration_ms INTEGER,     -- How long this event took
  success BOOLEAN,         -- Did it succeed?
  error_message TEXT,      -- If failed, why?

  -- Indexes for performance
  INDEX idx_events_instance_time (instance_id, timestamp DESC),
  INDEX idx_events_parent (parent_uuid),
  INDEX idx_events_root (root_uuid),
  INDEX idx_events_uuid (uuid)
);
```

#### Enhanced Table: command_log

```sql
-- Link existing command_log to events
ALTER TABLE command_log
  ADD COLUMN event_uuid VARCHAR(36),
  ADD COLUMN parent_event_uuid VARCHAR(36);

-- Foreign keys
ALTER TABLE command_log
  ADD CONSTRAINT fk_event
    FOREIGN KEY (event_uuid)
    REFERENCES session_events(uuid);
```

### Event Types

| Type | Description | Parent | Payload Example |
|------|-------------|--------|-----------------|
| `user_message` | User input | null | `{"message": "Deploy the app"}` |
| `assistant_start` | PS begins processing | user_message | `{"epic": "epic-003"}` |
| `spawn_decision` | Decides to spawn subagent | assistant_start | `{"reason": "Complex task requires planning"}` |
| `tool_use` | Tool invoked | spawn_decision | `{"tool": "Task", "subagent_type": "general-purpose"}` |
| `tool_result` | Tool completed | tool_use | `{"success": true, "agent_id": "a1b2c3"}` |
| `state_change` | State updated | tool_result | `{"epic": "epic-003", "status": "in_progress"}` |
| `error` | Something failed | any | `{"error": "Spawn failed", "retry_count": 2}` |

### Query Functions

**Get Parent Chain:**
```sql
CREATE FUNCTION get_parent_chain(event_uuid VARCHAR)
RETURNS TABLE (
  uuid VARCHAR,
  event_type VARCHAR,
  timestamp TIMESTAMPTZ,
  payload JSONB
) AS $$
  WITH RECURSIVE chain AS (
    -- Start at given event
    SELECT * FROM session_events WHERE uuid = event_uuid
    UNION ALL
    -- Walk up parent chain
    SELECT e.*
    FROM session_events e
    JOIN chain c ON e.uuid = c.parent_uuid
  )
  SELECT uuid, event_type, timestamp, payload FROM chain;
$$ LANGUAGE SQL;
```

**Get Recent Events:**
```sql
CREATE FUNCTION get_recent_events(inst_id VARCHAR, limit_count INTEGER DEFAULT 50)
RETURNS TABLE (
  uuid VARCHAR,
  parent_uuid VARCHAR,
  event_type VARCHAR,
  timestamp TIMESTAMPTZ,
  payload JSONB
) AS $$
  SELECT uuid, parent_uuid, event_type, timestamp, payload
  FROM session_events
  WHERE instance_id = inst_id
  ORDER BY timestamp DESC
  LIMIT limit_count;
$$ LANGUAGE SQL;
```

**Get Event Timeline:**
```sql
CREATE FUNCTION get_timeline(inst_id VARCHAR, start_time TIMESTAMPTZ, end_time TIMESTAMPTZ)
RETURNS TABLE (
  uuid VARCHAR,
  event_type VARCHAR,
  timestamp TIMESTAMPTZ,
  duration_ms INTEGER
) AS $$
  SELECT uuid, event_type, timestamp, duration_ms
  FROM session_events
  WHERE instance_id = inst_id
    AND timestamp BETWEEN start_time AND end_time
  ORDER BY timestamp;
$$ LANGUAGE SQL;
```

---

## Implementation Details

### Event Logging Pattern

**In PS code:**
```typescript
import { EventLogger } from '../session/EventLogger.js';

const logger = new EventLogger(instanceId);

// Log user message
const userEventUuid = await logger.logEvent({
  type: 'user_message',
  parentUuid: null, // Root event
  payload: { message: userMessage }
});

// Log spawn decision (child of user message)
const spawnEventUuid = await logger.logEvent({
  type: 'spawn_decision',
  parentUuid: userEventUuid,
  payload: {
    reason: 'Complex task requires planning',
    epicId: 'epic-003'
  }
});

// Log tool use (child of spawn decision)
const toolEventUuid = await logger.logEvent({
  type: 'tool_use',
  parentUuid: spawnEventUuid,
  payload: {
    tool: 'Task',
    subagent_type: 'general-purpose',
    model: 'haiku'
  }
});
```

### EventLogger API

```typescript
class EventLogger {
  constructor(instanceId: string);

  async logEvent(event: {
    type: string;
    parentUuid?: string;
    payload: object;
    durationMs?: number;
    success?: boolean;
    errorMessage?: string;
  }): Promise<string>; // Returns event UUID

  async getParentChain(eventUuid: string): Promise<Event[]>;
  async getRecentEvents(limit?: number): Promise<Event[]>;
  async getTimeline(start: Date, end: Date): Promise<Event[]>;
}
```

### Memory Safety Guarantees

**1. Bounded Queries:**
```typescript
// ✅ GOOD - Limited results
const recent = await logger.getRecentEvents(50);

// ❌ BAD - Unbounded (DON'T DO THIS)
const all = await db.query('SELECT * FROM session_events');
```

**2. Streaming Large Results:**
```typescript
// For bulk analysis, stream don't load
async function* streamEvents(instanceId: string) {
  const batchSize = 100;
  let offset = 0;

  while (true) {
    const batch = await db.query(`
      SELECT * FROM session_events
      WHERE instance_id = $1
      ORDER BY timestamp
      LIMIT $2 OFFSET $3
    `, [instanceId, batchSize, offset]);

    if (batch.length === 0) break;

    for (const event of batch) {
      yield event;
    }

    offset += batchSize;
  }
}
```

**3. Automatic Cleanup:**
```sql
-- Archive events older than 90 days
CREATE TABLE session_events_archive (LIKE session_events);

-- Daily job
INSERT INTO session_events_archive
SELECT * FROM session_events
WHERE timestamp < NOW() - INTERVAL '90 days';

DELETE FROM session_events
WHERE timestamp < NOW() - INTERVAL '90 days';
```

---

## Use Cases

### Use Case 1: Debug Deployment Failure

**Scenario:** Deployment failed, user asks "Why?"

**With Event Lineage:**
```sql
-- Find the error event
SELECT uuid, payload FROM session_events
WHERE event_type = 'error'
  AND payload->>'message' LIKE '%deploy%'
ORDER BY timestamp DESC LIMIT 1;

-- Walk parent chain to root cause
SELECT * FROM get_parent_chain('error-uuid-here');

-- Result: Full chain from user message → spawn → deploy → error
```

**Output:**
```
1. user_message: "Deploy the app"
2. assistant_start: Starting deployment workflow
3. spawn_decision: Spawning deployment agent (haiku)
4. tool_use: Task tool invoked
5. tool_result: Agent completed
6. deploy_start: Running docker compose up
7. error: Port 5300 already in use
```

### Use Case 2: Resume Session Intelligence

**Scenario:** VM crashed, resume session

**Smart Resume (NOT Claude's approach):**
```typescript
async function resumeSession(instanceId: string) {
  // Only load last 50 events (NOT entire session!)
  const recent = await logger.getRecentEvents(50);

  // Find last user interaction
  const lastUserMsg = recent.find(e => e.type === 'user_message');

  // Find current epic
  const epicEvent = recent.find(e =>
    e.type === 'state_change' &&
    e.payload.epic
  );

  // Generate resume context
  return {
    lastAction: recent[0]?.type,
    currentEpic: epicEvent?.payload.epic,
    recentCommands: recent
      .filter(e => e.type === 'tool_use')
      .map(e => e.payload.tool)
  };
}
```

**Memory usage:**
- Claude's way: Load 10,000 events = 40GB RAM
- Our way: Load 50 events = ~50KB RAM (800,000x improvement!)

### Use Case 3: Performance Analysis

**Scenario:** "Why is epic implementation so slow?"

**Query:**
```sql
-- Find slowest operations
SELECT
  event_type,
  AVG(duration_ms) as avg_duration,
  MAX(duration_ms) as max_duration,
  COUNT(*) as count
FROM session_events
WHERE instance_id = 'odin-PS-abc123'
  AND timestamp > NOW() - INTERVAL '1 hour'
GROUP BY event_type
ORDER BY avg_duration DESC;
```

**Output:**
```
tool_use (Task spawn): avg 45s, max 120s
deploy_start: avg 30s, max 90s
tool_use (Bash): avg 5s, max 60s
```

---

## Migration Plan

### Phase 1: Schema & Functions (Week 1)

**Deliverables:**
- Create `session_events` table
- Create query functions (get_parent_chain, get_recent_events, get_timeline)
- Add indexes
- Write migration script

**Acceptance criteria:**
- Schema created successfully
- Functions return correct results
- Can insert and query test events

### Phase 2: EventLogger Implementation (Week 2)

**Deliverables:**
- `src/session/EventLogger.ts` class
- Unit tests for logging
- Integration tests for queries
- Documentation

**Acceptance criteria:**
- Can log events with parent UUIDs
- Parent chain queries work correctly
- Memory bounded (<100MB for any query)

### Phase 3: PS Integration (Week 3)

**Deliverables:**
- Update PSBootstrap to use EventLogger
- Log critical events (user messages, spawns, deploys, errors)
- Update resume logic to use event queries
- Update footer to show event stats

**Acceptance criteria:**
- Every significant action logged
- Resume shows intelligent context
- No memory bloat observed

### Phase 4: Analysis Tools (Week 4)

**Deliverables:**
- CLI tool to query events
- Performance dashboard
- Debugging helpers
- Export to .jsonl (Claude-compatible format)

**Acceptance criteria:**
- Can trace any error to root cause in <1 min
- Performance queries run in <100ms
- Can export session for external analysis

---

## Non-Functional Requirements

### Performance

| Metric | Target | Max |
|--------|--------|-----|
| Event insert | <10ms | 50ms |
| Parent chain query (depth 100) | <50ms | 200ms |
| Recent events (50) | <100ms | 500ms |
| Timeline query (1 hour) | <200ms | 1s |

### Storage

| Item | Size | Retention |
|------|------|-----------|
| Event record | ~1KB | 90 days active |
| Session (1000 events) | ~1MB | → Archive after 90d |
| Archive | Compressed | 1 year |

### Reliability

- Event logging failures: Non-fatal (log error, continue)
- Query timeouts: Return partial results
- Database unavailable: Graceful degradation (no events logged)

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Infinite recursion in parent chain** | Low | High | Depth limit (max 1000), cycle detection |
| **Storage growth** | Medium | Medium | Auto-archival, 90-day retention |
| **Query performance degradation** | Medium | Medium | Proper indexes, query limits, monitoring |
| **Parent UUID mismatches** | Low | Medium | Foreign key constraints, validation |

---

## Testing Strategy

### Unit Tests

- Event UUID generation (uniqueness)
- Parent UUID linking
- Payload serialization
- Query function logic

### Integration Tests

- Full event chain (user → spawn → result)
- Parent chain reconstruction
- Resume with event loading
- Performance under load (10,000 events)

### Performance Tests

- Insert 10,000 events
- Query parent chain depth 100
- Timeline query 24 hours
- Memory usage during queries

---

## Success Metrics

**After 30 days:**
- ✅ Zero memory leaks in PS sessions
- ✅ >90% of failures traced to root cause in <2 min
- ✅ Resume time <5 seconds (regardless of session length)
- ✅ Event storage <1GB across all projects

**After 90 days:**
- ✅ Manual handoffs reduced 80% (event-based resume replaces them)
- ✅ Average debug time reduced 60%
- ✅ Session continuity success rate >98%

---

## References

### Research Documents

- Claude Code session continuity research (agent a1ac146)
- Claude Code memory leak investigation (agent a5db358)
- `/home/samuel/sv/CLAUDE_MEMORY_LEAK_INVESTIGATION.md`

### Related Features

- `session-continuity` (Epic 007) - Provides instance tracking foundation
- `automatic-quality-workflows` (Epic 006) - Uses events for verification

### External Resources

- [Claude Code .jsonl format analysis](https://github.com/simonw/claude-code-transcripts)
- [Claude Code Issue #11155 - Bash output memory leak](https://github.com/anthropics/claude-code/issues/11155)
- [Claude Code Issue #21022 - Large session memory leak](https://github.com/anthropics/claude-code/issues/21022)

---

**Maintained by:** Meta-Supervisor (MS)
**Next Review:** After Phase 1 completion (1 week)
**Status:** Ready for Planning
