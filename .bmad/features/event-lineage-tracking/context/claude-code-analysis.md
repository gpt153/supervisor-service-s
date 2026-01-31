# Claude Code Session Continuity Analysis

**Research Date:** 2026-01-31
**Purpose:** Understand Claude Code's event tracking to inform our implementation

---

## Claude Code's Approach

### File Structure

**Location:** `~/.claude/projects/[encoded-path]/[session-uuid].jsonl`

**Format:** JSON Lines (one JSON object per line)

**Example events:**
```json
{"uuid":"msg-1","parentUuid":null,"type":"user","message":{"role":"user","content":"Deploy"},"timestamp":"2026-01-31T08:00:00Z"}
{"uuid":"msg-2","parentUuid":"msg-1","type":"assistant","message":{"content":[{"type":"thinking","thinking":"..."}]},"timestamp":"2026-01-31T08:00:05Z"}
{"uuid":"tool-1","parentUuid":"msg-2","type":"assistant","message":{"content":[{"type":"tool_use","id":"tool-1","name":"Bash"}]},"timestamp":"2026-01-31T08:00:10Z"}
{"uuid":"result-1","parentUuid":"tool-1","type":"assistant","message":{"content":[{"type":"tool_result","tool_use_id":"tool-1","content":"..."}]},"timestamp":"2026-01-31T08:00:15Z"}
```

### Parent UUID Chain Pattern

Every event contains:
- `uuid`: Unique identifier for this event
- `parentUuid`: Links to the event that caused this one
- `type`: Event type (user, assistant, system, etc.)
- `timestamp`: When it occurred
- `payload`: Event-specific data

**Chain example:**
```
User message (uuid: msg-1, parent: null)
  ├─ Assistant thinking (uuid: msg-2, parent: msg-1)
  │   ├─ Tool use (uuid: tool-1, parent: msg-2)
  │   │   └─ Tool result (uuid: result-1, parent: tool-1)
  │   └─ Assistant text (uuid: msg-3, parent: msg-2)
  └─ Summary (uuid: sum-1, parent: msg-1)
```

### The Memory Leak Problem

**GitHub Issue #21022:** Large session files cause memory issues

**Problem:**
```typescript
// Claude Code's approach (SIMPLIFIED)
async function loadSession(sessionId: string) {
  // LOADS ENTIRE FILE INTO MEMORY AT ONCE
  const fileContent = fs.readFileSync(`${sessionId}.jsonl`, 'utf-8');
  const lines = fileContent.split('\n');
  const events = lines.map(line => JSON.parse(line));

  // NOW ALL EVENTS ARE IN MEMORY
  this.sessionEvents = events; // NEVER EVICTED!
}
```

**Real-world impact:**
- 102MB .jsonl file → 90% RAM usage on 16GB system
- 8,366 lines in single file
- Complete UI freeze ("Ruminating..." indefinitely)
- V8 heap crashes (SIGABRT)

**Root cause:** Synchronous full-file loading blocks event loop, no streaming, no pagination.

---

## The Bash Output Memory Leak

**GitHub Issue #11155:** Claude stores ALL bash output in memory

**Problem:**
```typescript
// Pseudocode of what happens
const bashOutputs = [];

function runBash(command: string) {
  const output = executeCommand(command);

  // NEVER DISCARDED!
  bashOutputs.push({
    command,
    output, // Could be 100MB+
    timestamp: Date.now()
  });

  return output;
}

// After 100 commands with large outputs...
// bashOutputs = [100MB, 50MB, 200MB, ...] = TOTAL 40GB
```

**Trigger scenarios:**
- `npm test` with 150+ tests → Stores all output
- `grep -r "pattern" .` with 765K matches → 24.4GB RAM
- `npm run build` → Stores all webpack logs
- Any long-running command with progress output

**Critical:** Marked "NOT_PLANNED" by Anthropic (won't be fixed!)

---

## What We Can Learn

### ✅ Good Ideas to Adopt

**1. Parent UUID Chains**
- Every event links to its cause
- Enables root cause analysis
- Reconstructs decision flow

**2. Comprehensive Event Types**
- user_message, assistant_response, tool_use, tool_result
- State changes, errors, summaries
- Full audit trail

**3. JSON Payload Flexibility**
- Store arbitrary data in `payload` field
- Easy to extend without schema changes

### ❌ Bad Patterns to Avoid

**1. In-Memory Accumulation**
```typescript
// ❌ DON'T DO THIS
this.events.push(newEvent); // Unbounded growth

// ✅ DO THIS
await db.insert('session_events', newEvent); // Persisted, not in memory
```

**2. Full Session Loading**
```typescript
// ❌ DON'T DO THIS
const allEvents = loadEntireSession(sessionId);

// ✅ DO THIS
const recentEvents = await db.query(`
  SELECT * FROM session_events
  WHERE instance_id = $1
  ORDER BY timestamp DESC
  LIMIT 50
`, [instanceId]);
```

**3. Synchronous File Operations**
```typescript
// ❌ DON'T DO THIS
const data = fs.readFileSync(bigFile);

// ✅ DO THIS
const stream = db.stream('SELECT * FROM session_events...');
for await (const event of stream) {
  process(event);
}
```

**4. Never Discarding Old Data**
```typescript
// ❌ DON'T DO THIS
// Keep everything forever in memory

// ✅ DO THIS
// Archive after 90 days
await db.query(`
  DELETE FROM session_events
  WHERE timestamp < NOW() - INTERVAL '90 days'
`);
```

---

## Our Improved Approach

### Database-Backed Event Storage

**Instead of .jsonl file:**
```sql
CREATE TABLE session_events (
  id BIGSERIAL PRIMARY KEY,
  uuid VARCHAR(36) UNIQUE,
  parent_uuid VARCHAR(36),
  instance_id VARCHAR(36),
  event_type VARCHAR(50),
  timestamp TIMESTAMPTZ,
  payload JSONB
);
```

**Benefits:**
- ✅ Queries load only what's needed (pagination)
- ✅ Indexes enable fast parent chain traversal
- ✅ Automatic archival/cleanup
- ✅ Bounded memory (never load all events)

### Smart Querying

**Parent chain reconstruction:**
```sql
WITH RECURSIVE chain AS (
  SELECT * FROM session_events WHERE uuid = 'error-event-uuid'
  UNION ALL
  SELECT e.*
  FROM session_events e
  JOIN chain c ON e.uuid = c.parent_uuid
)
SELECT * FROM chain;
```

**Recent events only:**
```sql
SELECT * FROM session_events
WHERE instance_id = 'odin-PS-abc123'
ORDER BY timestamp DESC
LIMIT 50;
```

**Memory usage:**
- Claude's way: 10,000 events = 40GB RAM
- Our way: 50 events = 50KB RAM (800,000x improvement!)

---

## Key Insights

### 1. Parent UUIDs Are Powerful

**Enable:**
- Root cause analysis (walk chain backwards)
- Decision auditing (why did it choose that?)
- Context reconstruction (what led to this state?)

### 2. In-Memory Storage Is Fatal

**Causes:**
- Unbounded memory growth
- VM crashes after 3-4 hours
- Cannot resume long sessions

### 3. Database Is The Answer

**Provides:**
- Bounded queries (LIMIT, OFFSET)
- Streaming for bulk operations
- Automatic cleanup
- Persistence without memory cost

---

## Implementation Recommendations

### Phase 1: Minimal Event Storage

```sql
-- Start simple
CREATE TABLE session_events (
  id BIGSERIAL PRIMARY KEY,
  uuid VARCHAR(36),
  parent_uuid VARCHAR(36),
  instance_id VARCHAR(36),
  event_type VARCHAR(50),
  timestamp TIMESTAMPTZ,
  payload JSONB
);
```

### Phase 2: Add Parent Chain Queries

```sql
CREATE FUNCTION get_parent_chain(event_uuid VARCHAR)
RETURNS TABLE (...) AS $$
  WITH RECURSIVE chain AS (...)
  SELECT * FROM chain;
$$ LANGUAGE SQL;
```

### Phase 3: Integrate with PS

```typescript
// Log every significant action
await eventLogger.log({
  type: 'spawn_decision',
  parentUuid: userMessageUuid,
  payload: { reason: '...', epicId: '...' }
});
```

### Phase 4: Smart Resume

```typescript
// Load only recent events, not entire session
const context = await buildResumeContext(instanceId, {
  recentEventCount: 50,
  includeParentChains: true
});
```

---

## Warnings & Gotchas

### Don't Create Infinite Loops

```sql
-- BAD: Could recurse forever if cycle exists
WITH RECURSIVE chain AS (
  SELECT * FROM session_events WHERE uuid = $1
  UNION ALL
  SELECT e.* FROM session_events e JOIN chain c ON e.uuid = c.parent_uuid
)
SELECT * FROM chain; -- NO DEPTH LIMIT!

-- GOOD: Depth limit prevents infinite recursion
WITH RECURSIVE chain(uuid, parent_uuid, depth) AS (
  SELECT uuid, parent_uuid, 0 FROM session_events WHERE uuid = $1
  UNION ALL
  SELECT e.uuid, e.parent_uuid, c.depth + 1
  FROM session_events e
  JOIN chain c ON e.uuid = c.parent_uuid
  WHERE c.depth < 1000 -- SAFETY LIMIT
)
SELECT * FROM chain;
```

### Don't Query Without Limits

```typescript
// ❌ DANGEROUS - Could load millions of rows
const events = await db.query('SELECT * FROM session_events');

// ✅ SAFE - Bounded result set
const events = await db.query(`
  SELECT * FROM session_events
  WHERE instance_id = $1
  ORDER BY timestamp DESC
  LIMIT 100
`, [instanceId]);
```

### Archive Old Data

```sql
-- Move events older than 90 days to archive table
INSERT INTO session_events_archive
SELECT * FROM session_events
WHERE timestamp < NOW() - INTERVAL '90 days';

DELETE FROM session_events
WHERE timestamp < NOW() - INTERVAL '90 days';
```

---

## Comparison Table

| Feature | Claude Code (.jsonl) | Our System (Database) |
|---------|---------------------|----------------------|
| **Storage** | File system | PostgreSQL |
| **Loading** | Full file in memory | Query-based (paginated) |
| **Memory Usage** | 40GB for long sessions | <100MB always |
| **Resume Speed** | Slow (load all events) | Fast (load last 50) |
| **Parent Chains** | ✅ Has them | ✅ Has them |
| **Query Power** | ❌ Must parse entire file | ✅ SQL queries |
| **Cleanup** | ❌ Manual | ✅ Automatic archival |
| **Crash Risk** | ❌ High (OOM kills) | ✅ Low (bounded memory) |

---

## Conclusion

**What to copy from Claude Code:**
- ✅ Parent UUID chain concept
- ✅ Comprehensive event types
- ✅ JSON payload flexibility

**What NOT to copy:**
- ❌ In-memory event accumulation
- ❌ Full-file loading on resume
- ❌ No garbage collection
- ❌ Unbounded growth

**Our advantage:**
- Database provides pagination, streaming, and cleanup
- Memory usage bounded regardless of session length
- Can query and analyze without loading entire session
- Automatic archival prevents infinite growth

**The key insight:** Parent UUIDs are brilliant for tracing execution. In-memory storage of those events is fatal. Database-backed storage gives us the intelligence without the memory leak.

---

## References

- [GitHub - simonw/claude-code-transcripts](https://github.com/simonw/claude-code-transcripts)
- [Claude Code Issue #21022 - Memory leak](https://github.com/anthropics/claude-code/issues/21022)
- [Claude Code Issue #11155 - Bash output leak](https://github.com/anthropics/claude-code/issues/11155)
- Agent a1ac146 research output
- Agent a5db358 research output
