# Session Continuity: Implementation Quick Start

**For**: Implementation subagents starting on Epic 007-C, 007-D, 007-E, or 007-F

---

## Before You Start

1. **Read these first** (in order):
   - `prd.md` - Full context and architecture
   - `EPICS-SUMMARY.md` - Overview of all 6 epics

2. **Then read your epic**:
   - `epics/epic-007-C-event-store.md` (if Event Store)
   - `epics/epic-007-D-checkpoint-system.md` (if Checkpoints)
   - `epics/epic-007-E-resume-engine.md` (if Resume Engine)
   - `epics/epic-007-F-ps-integration.md` (if PS Integration)

3. **Understand existing work** (already done):
   - Epic 007-A: Instance Registry (instance_id generation, sessions table, heartbeat)
   - Epic 007-B: Command Logging (command_log table, auto-wrap, explicit logging)

---

## Epic 007-C: Event Store (Week 5)

### What You're Building

An immutable event log that tracks every state change. Enables replay, analysis, and intelligent resume suggestions.

### Files to Create

```
src/event-store/event-store.ts          [Core class: emit, query, replay]
src/event-store/event-validator.ts      [Validation schema]
src/types/event-types.ts                [TypeScript interfaces + Zod]
src/mcp/tools/event-tools.ts            [MCP endpoints]
migrations/003-event-store.sql          [Database schema]
tests/unit/event-store.test.ts          [Unit tests]
tests/integration/event-store-integration.test.ts
```

### Database Schema

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
  CONSTRAINT unique_sequence UNIQUE (instance_id, sequence_num)
);
CREATE INDEX idx_event_store_instance_seq ON event_store(instance_id, sequence_num);
```

### MCP Tools to Implement

1. `mcp_meta_emit_event(instance_id, event_type, event_data)` → Returns event_id
2. `mcp_meta_query_events(instance_id, filters?, limit?)` → Returns event list
3. `mcp_meta_replay_events(instance_id, to_sequence_num?)` → Returns final state
4. `mcp_meta_list_event_types()` → Returns all event types

### Event Types to Define (12 total)

```
instance_registered      instance_heartbeat        instance_stale
epic_started            epic_completed            epic_failed
test_started            test_passed               test_failed
commit_created          pr_created                pr_merged
validation_passed       validation_failed
deployment_started      deployment_completed      deployment_failed
context_window_updated  checkpoint_created        checkpoint_loaded
epic_planned            feature_requested         task_spawned
```

### Key Implementation Points

- **Sequence numbers**: Must be monotonically increasing per instance
- **Immutability**: Events are append-only (no updates, no deletes)
- **Performance**: Emit <10ms, Query <100ms, Replay <200ms for 100 events
- **Validation**: Strict schema validation before storing
- **Storage**: ~500KB/day estimated

### Testing Strategy

```
Unit Tests:
✓ Emit event (all 12 types)
✓ Validate event schema
✓ Sequence number monotonicity
✓ Query with filters
✓ Replay correctness

Integration Tests:
✓ Register → Emit → Query → Replay lifecycle
✓ Concurrent instances don't interfere
✓ Large dataset performance (1000 events)
✓ Event ordering across instances
```

### Success Criteria

- [ ] All 12 event types defined
- [ ] MCP tools working
- [ ] Event emit <10ms (p99)
- [ ] Event query <100ms (p99)
- [ ] Event replay correctness verified
- [ ] Unit tests: 100%
- [ ] Integration tests: 100%

---

## Epic 007-D: Checkpoint System (Weeks 6-7)

### What You're Building

Auto-capture work state snapshots at 80% context and epic completion. Fast recovery without replaying 100+ commands.

### Files to Create

```
src/checkpoint/checkpoint-manager.ts    [Core class: create, get, list]
src/checkpoint/work-state-serializer.ts [Serialize current work to JSON]
src/checkpoint/recovery-generator.ts    [Generate recovery instructions]
src/types/checkpoint-types.ts           [Interfaces + Zod]
src/mcp/tools/checkpoint-tools.ts       [MCP endpoints]
migrations/004-checkpoints.sql          [Database schema]
tests/unit/checkpoint-manager.test.ts
tests/integration/checkpoint-recovery-test.ts
```

### Database Schema

```sql
CREATE TABLE checkpoints (
  checkpoint_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES supervisor_sessions(instance_id),
  checkpoint_type ENUM('context_window', 'epic_completion', 'manual'),
  sequence_num BIGINT NOT NULL,
  context_window_percent INT CHECK (context_window_percent BETWEEN 0 AND 100),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  work_state JSONB NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_checkpoints_instance_time ON checkpoints(instance_id, timestamp DESC);
```

### Work State Structure to Serialize

```json
{
  "current_epic": { epic_id, status, duration_hours, test_results },
  "files_modified": [ { path, status, lines_changed } ],
  "git_status": { branch, staged_files, unstaged_files, commit_count },
  "last_commands": [ { command_id, type, target, timestamp } ],
  "prd_status": { version, epic_status, next_epic },
  "environment": { project, working_directory, hostname }
}
```

### MCP Tools to Implement

1. `mcp_meta_create_checkpoint(instance_id, checkpoint_type?)` → Returns checkpoint_id
2. `mcp_meta_get_checkpoint(checkpoint_id)` → Returns work_state + instructions
3. `mcp_meta_list_checkpoints(instance_id)` → Returns checkpoint list
4. `mcp_meta_cleanup_checkpoints()` → Delete old checkpoints (retention: 30 days)

### Automatic Triggers

1. **Context Window 80%**: Monitor heartbeat, create when threshold hit
2. **Epic Completion**: Hook into event_store, auto-create on epic_completed event

### Key Implementation Points

- **Size optimization**: Keep <5KB per checkpoint
- **Performance**: Create <200ms, retrieve <50ms
- **Serialization**: Capture only what's needed, not full directory
- **Instructions**: Generate plain-language recovery steps
- **Storage**: ~100KB/day estimated

### Testing Strategy

```
Unit Tests:
✓ Work state serialization
✓ Size validation
✓ Instructions generation
✓ Checkpoint creation/retrieval
✓ Trigger conditions

Integration Tests:
✓ Context window trigger → checkpoint created
✓ Epic completion trigger → checkpoint with full state
✓ Load checkpoint → generate instructions
✓ Multiple checkpoints per instance
✓ Concurrent checkpoint creation
```

### Success Criteria

- [ ] Checkpoints created in <200ms
- [ ] Checkpoints retrieved in <50ms
- [ ] Work state captured accurately
- [ ] Recovery instructions actionable
- [ ] Storage within 100KB/day
- [ ] 80% context trigger works
- [ ] Epic completion trigger works
- [ ] Integration tests: 100%

---

## Epic 007-E: Resume Engine (Weeks 8-9)

### What You're Building

Intelligent instance restoration engine. User says "resume 8f4a2b", system restores exact context.

### Files to Create

```
src/resume/resume-engine.ts             [Orchestrator]
src/resume/instance-resolver.ts         [Exact, partial, project, epic ID]
src/resume/context-reconstructor.ts     [Checkpoint, event, command fallback]
src/resume/summary-generator.ts         [Format + confidence scoring]
src/resume/handoff-generator.ts         [Generate recovery docs]
src/types/resume-types.ts               [Interfaces]
src/mcp/tools/resume-tools.ts           [MCP endpoints]
tests/unit/resume-engine.test.ts
tests/integration/resume-workflow.test.ts
```

### Instance Resolution Strategies

```typescript
// User input → Internal resolution
"resume 8f4a2b"       → Exact match: odin-PS-8f4a2b
"resume odin"         → Ambiguous: show 3 Odin instances
"resume epic-003"     → Find instance working on epic-003
"resume"              → Most recent instance
"resume 8f4a"         → Partial match: odin-PS-8f4a2b
```

### Context Reconstruction Priority

1. **Checkpoint** (if recent, <1 hour)
   - Load work_state directly
   - Generate recovery instructions
   - <100ms restore time

2. **Event Replay** (if no checkpoint)
   - Load last events (up to 100)
   - Replay to reconstruct state
   - <500ms restore time

3. **Command Fallback** (if no events)
   - Load last 20 commands
   - Infer state from command types
   - Lower confidence (<80%)

### Confidence Scoring Algorithm

```
score = 100
if checkpoint_age < 5 min: score = 100
elif checkpoint_age < 1 hour: score = 90
elif checkpoint_age < 24 hours: score = 70
else: score = 50

if files_deleted: score -= 10
if branch_deleted: score -= 5
if event_stale > 30 min: score -= 5 per 30 min

final_score = max(50, score)
warn_user if final_score < 80
```

### MCP Tools to Implement

1. `mcp_meta_resume_instance(instance_id_hint?)` → Returns summary + instructions
2. `mcp_meta_get_instance_details(instance_id)` → Returns full state
3. `mcp_meta_list_stale_instances()` → Returns stale instances

### Summary Output Format

```
✅ Resumed: odin-PS-8f4a2b

EPIC 003: Authentication (OAuth)
Status: COMPLETED ✓
- Tests: 42/42 PASSED
- Coverage: 87%
- Time: 4h 32min
- PR: #45 (ready)

NEXT STEPS:
1. Verify CI passes
2. Merge PR #45
3. Start epic 004 (60h)

Confidence: 99%
Ready to continue: "continue building"
```

### Key Implementation Points

- **Stale detection**: >2 min without heartbeat = stale
- **Disambiguation**: Show numbered list if multiple matches
- **Validation**: Verify files/branches still exist
- **Performance**: Resume <500ms (p99)
- **Confidence**: Calibrate scores to match reality

### Testing Strategy

```
Unit Tests:
✓ Instance resolution (all strategies)
✓ Disambiguation logic
✓ Confidence scoring
✓ Error handling

Integration Tests:
✓ Full lifecycle: Register → Work → Checkpoint → Resume
✓ Multi-instance disambiguation
✓ Stale detection
✓ Event reconstruction accuracy
✓ Command-based fallback
```

### Success Criteria

- [ ] Resume command works for all resolution strategies
- [ ] Disambiguation shows clear list
- [ ] Context reconstructed accurately (>95%)
- [ ] Confidence scores calibrated correctly
- [ ] Resume experience <500ms (p99)
- [ ] Stale detection working
- [ ] Integration tests: 100%

---

## Epic 007-F: PS Integration (Week 10)

### What You're Building

Wire session continuity into every PS. Auto-register, show footer, log commands, create checkpoints.

### Files to Create

```
src/ps-integration/ps-bootstrap.ts      [Startup helpers]
src/ps-integration/footer-generator.ts  [Format footer]
docs/guides/ps-session-continuity-guide.md
docs/examples/ps-session-continuity-example.md
```

### Key Integration Points

**1. PS Startup**
```typescript
// One-time on first response
const instanceId = await mcp_meta_register_instance({
  project: 'odin-s',
  instance_type: 'PS'
});
this.sessionState.instanceId = instanceId;
```

**2. Footer on Every Response**
```typescript
// After all response content
const footer = generateFooter({
  instanceId,
  currentEpic,
  contextWindow,
  sessionDuration
});
response.text += `\n${footer}`;

// Async heartbeat (don't wait)
mcp_meta_heartbeat({...}).catch(err => logger.warn('Heartbeat failed'));
```

**3. Explicit Logging**
```typescript
// When spawning task
await mcp_meta_log_command({
  command_type: 'spawn',
  subagent_type,
  description
});

// When committing
await mcp_meta_log_command({
  command_type: 'commit',
  message,
  files_changed
});

// When deploying
await mcp_meta_log_command({
  command_type: 'deploy',
  service,
  port,
  status
});
```

**4. Resume Command Handling**
```typescript
if (userMessage.startsWith('resume ')) {
  const hint = userMessage.slice(7).trim();
  const recovery = await mcp_meta_resume_instance({ instance_id_hint: hint });
  return formatResumeResponse(recovery);
}
```

### Footer Format

```
Instance: odin-PS-8f4a2b | Epic: 003 | Context: 42% | Active: 1.2h
```

### Automatic Command Logging

| Action | Log Type | Data |
|--------|----------|------|
| Spawn subagent | `spawn` | subagent_type, description, model |
| Commit changes | `commit` | message, files_changed, commit_hash |
| Create PR | `pr_created` | pr_url, epic_id, description |
| Deploy service | `deploy` | service, port, health_status |
| Plan feature | `task_created` | description, epic_id |

### CLAUDE.md Updates

Add to every PS's CLAUDE.md:

```markdown
## Session Continuity System

**Automatic tracking enabled.**

### Your Session ID
Shown in footer: `Instance: {id}`

### Resume After Disconnect
Command: `resume {id}`
Restores exact context from checkpoint

### What's Logged Automatically
- Every spawn (subagent type, description)
- Every commit (message, files changed)
- Every deployment (service, port, status)
- Every action (for complete audit trail)

### Checkpoints
- Created automatically at 80% context
- Created after epic completion
- Enables fast recovery without replay

### No Manual Effort Required
- Registration: Automatic on first response
- Heartbeat: Automatic with every response
- Logging: Automatic for critical actions
- Checkpoints: Automatic triggers
```

### Integration Testing

```
Full Lifecycle Test:
1. PS starts → calls mcp_meta_register_instance()
2. PS responds → footer shows instance ID
3. PS spawns task → logs spawn command
4. PS commits → logs commit
5. PS hits 80% context → checkpoint created
6. User: "resume {id}" → recovery summary shown
7. PS continues → works seamlessly

Multi-Instance Test:
1. Start 3 Odin PS instances
2. User: "resume odin" → disambiguation list
3. User picks #1 → Instance 1 resumed
4. Verify no context from other instances mixed in
```

### Files to Update (All Projects)

For each project (consilio-s, odin-s, openhorizon-s, health-agent-s, supervisor-service-s):

1. **`{project}/CLAUDE.md`** - Add session continuity section
2. **`{project}/{supervisor-file}.ts`** - Add integration code

### Success Criteria

- [ ] Every PS shows instance ID in footer
- [ ] Heartbeat called with every response (<20ms overhead)
- [ ] Spawn, commit, deploy automatically logged
- [ ] Checkpoint created at 80% and epic completion
- [ ] Resume command works: "resume {id}"
- [ ] No breaking changes to existing workflows
- [ ] All 5 PSes operational
- [ ] Integration tests: 100%

---

## Shared Dependencies Between Epics

```
007-C (Event Store)
├─ Requires: 007-A (Instance Registry) ✓
└─ Used by: 007-D, 007-E

007-D (Checkpoint System)
├─ Requires: 007-B (Command Logging) ✓
├─ Requires: 007-C (Event Store)
└─ Used by: 007-E

007-E (Resume Engine)
├─ Requires: 007-A through 007-D
└─ Used by: 007-F

007-F (PS Integration)
├─ Requires: 007-A (Instance Registry) ✓
├─ Requires: 007-E (Resume Engine)
└─ Uses: All tools from 007-A through 007-E
```

**Parallel Implementation:**
- 007-C and 007-D can start in parallel (no dependency)
- 007-E must wait for 007-D completion
- 007-F must wait for 007-E completion

---

## Common Pitfalls & Solutions

### Pitfall 1: Lost Sequence Numbers

**Problem**: Event sequence resets or duplicates across instances
**Solution**:
- Use PostgreSQL sequences per instance
- Enforce UNIQUE constraint: `UNIQUE(instance_id, sequence_num)`
- Always query next sequence before inserting

### Pitfall 2: Slow Checkpoint Retrieval

**Problem**: Loading checkpoint takes >200ms
**Solution**:
- Index on `(instance_id, timestamp DESC)`
- Keep work_state JSON compact (<5KB)
- Compress if needed (gzip in JSONB)

### Pitfall 3: Context Reconstruction Inaccuracy

**Problem**: Resumed instance shows wrong epic/state
**Solution**:
- Always validate checkpoint state on load
- Check if files still exist
- Check if branches still exist
- Fall back if validation fails

### Pitfall 4: Resume Ambiguity Confusion

**Problem**: Multiple instances, user confused which to pick
**Solution**:
- Show numbered list (1, 2, 3)
- Include: epic_id, last_heartbeat, context%
- Ask explicitly: "Which instance? (1-3)"

### Pitfall 5: Stale Heartbeat Check

**Problem**: Active instance marked as stale too early
**Solution**:
- Heartbeat timeout: 2 minutes (not 30 seconds)
- Verify heartbeat actually working
- Don't resume active instances (warn user)

---

## Performance Debugging Checklist

```
If event emit is slow:
□ Check event_type validation time
□ Check JSONB serialization time
□ Check database insert time
□ Add indexes if needed

If checkpoint retrieval is slow:
□ Verify index on (instance_id, timestamp)
□ Check JSONB decompression time
□ Check network latency
□ Profile serialization

If resume query is slow:
□ Check instance resolution query plan
□ Check checkpoint load query plan
□ Verify indexes present
□ Profile summary generation

If context reconstruction is slow:
□ Check event query performance
□ Check command query performance
□ Verify event replay logic
□ Profile reconstruction algorithm
```

---

## Testing Checklist Before Completion

```
Unit Tests:
□ All event types emit correctly
□ Checkpoint serialization works
□ Instance resolution handles all cases
□ Confidence scoring accurate
□ Footer formatting correct

Integration Tests:
□ Register → Emit → Query → Replay lifecycle
□ Checkpoint triggers at 80% and epic completion
□ Resume restores correct context
□ Multi-instance disambiguation works
□ Stale detection working
□ PS integration doesn't break existing flows

Performance Tests:
□ Event emit <10ms (p99)
□ Event query <100ms (p99)
□ Checkpoint create <200ms (p99)
□ Checkpoint retrieve <50ms (p99)
□ Resume <500ms (p99)
□ All overhead measurements recorded

Manual Tests:
□ Start PS, verify footer shows ID
□ Work on epic, verify checkpoint at 80%
□ Disconnect, resume, verify state
□ Multiple instances, disambiguate correctly
□ Old checkpoint (24h+), verify low confidence warning
```

---

## Documentation to Create

For each epic, create:
- README.md (quick overview)
- IMPLEMENTATION.md (step-by-step guide)
- API.md (detailed MCP tool specs)
- TESTING.md (test scenarios)

---

**Good luck! You're implementing the final critical component of the session continuity system.**

---

**Created**: 2026-01-28
**For**: Implementation subagents
**Status**: Ready to use
