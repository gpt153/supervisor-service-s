# Epic 007-D: Checkpoint System

**Status**: Pending
**Priority**: HIGH
**Estimated Effort**: 60 hours
**Cost**: $0 (infrastructure)
**Dependencies**: epic-007-B (Command Logging), epic-007-C (Event Store)

---

## Overview

Build a checkpoint system that automatically captures the complete work state at critical moments (80% context window, post-epic completion). Checkpoints enable fast recovery without replaying all commands, providing the foundation for intelligent resume.

## Business Value

- **Fast Recovery**: Resume from checkpoint without replaying hundreds of commands
- **Work State Preservation**: Capture exactly what PS was working on, in what state
- **Automatic Triggers**: No manual intervention needed
- **Resume Confidence**: >99% accurate recovery from checkpoint

## Problem Statement

**Current State:**
- Command log has every action but is large (1000+ commands possible)
- Replaying 1000 commands could take 10+ seconds
- At 80% context, user might disconnect mid-epic
- Need to save work state quickly and accurately

**Example Scenario:**
```
Context: 42% → 60% → 75% → 80% [CHECKPOINT TRIGGER #1]
Working on: epic-003 (authentication)
Files modified: 8
Current command: "Implement OAuth handler"
Commands logged: 187

[User continues working...]

Context: 85% → 95% → Epic completed [CHECKPOINT TRIGGER #2]
Epic-003 status: COMPLETED
Tests: 42/42 passed
PRD: Updated v2.0
Files changed: 12
Total time: 4.5 hours

[Machine disconnects]

[User: "resume 8f4a2b"]
System: Load checkpoint → 100ms recovery
Restore exact state → Ready to continue or start epic-004
```

**Without checkpoints**: Replay 187+ commands = 5-10 seconds delay
**With checkpoints**: Load checkpoint = 100ms

## Acceptance Criteria

### Core Checkpoint System

1. **Database Schema**
   - [ ] Create `checkpoints` table with fields:
     - `checkpoint_id` (UUID, PK)
     - `instance_id` (FK to supervisor_sessions)
     - `checkpoint_type` (ENUM: 'context_window', 'epic_completion', 'manual')
     - `sequence_num` (BIGINT, from event_store sequence)
     - `context_window_percent` (INT 0-100)
     - `timestamp` (TIMESTAMPTZ, auto-set)
     - `work_state` (JSONB: serialized work data)
     - `metadata` (JSONB: trigger info, file list)
     - `created_at`, `updated_at` timestamps
   - [ ] Index on `(instance_id, timestamp DESC)` for fast lookup
   - [ ] Index on `(checkpoint_type, created_at)` for analysis

2. **Work State Serialization**
   - [ ] Capture current epic_id
   - [ ] Capture context_window_percent
   - [ ] Capture files modified (paths + line counts)
   - [ ] Capture last N commands (20-50)
   - [ ] Capture git status (staged, unstaged, branch)
   - [ ] Capture environment (current directory, etc.)
   - [ ] Capture last event sequence
   - [ ] Capture PRD status (current version, last update)

3. **Automatic Checkpoint Triggers**
   - [ ] **Context Window Trigger (80%)**
     - Emit when `context_window % >= 80`
     - Via heartbeat signal
     - Record: context_window, current_epic, files_modified
   - [ ] **Epic Completion Trigger**
     - Emit when `event_type == 'epic_completed'`
     - Via event handler hook
     - Record: epic_id, completion_status, duration, test_results
   - [ ] **Manual Trigger (Optional)**
     - PS can call `mcp_meta_create_checkpoint()` explicitly
     - For mid-epic saves (not required)

### Checkpoint Storage

4. **Work State Data Structure**
   ```json
   {
     "checkpoint_id": "cp_8f4a2b_001",
     "instance_id": "odin-PS-8f4a2b",
     "checkpoint_type": "epic_completion",
     "sequence_num": 342,
     "timestamp": "2026-01-28T14:32:15Z",
     "context_window_percent": 95,

     "work_state": {
       "current_epic": {
         "epic_id": "epic-003",
         "feature_name": "authentication-oauth",
         "status": "COMPLETED",
         "duration_hours": 4.5,
         "test_results": {
           "passed": 42,
           "failed": 0,
           "coverage": 87
         }
       },

       "files_modified": [
         {
           "path": "src/auth/oauth-handler.ts",
           "status": "modified",
           "lines_changed": 127,
           "last_modified": "2026-01-28T14:15:00Z"
         },
         {
           "path": "tests/auth.test.ts",
           "status": "modified",
           "lines_changed": 89,
           "last_modified": "2026-01-28T14:28:00Z"
         }
       ],

       "git_status": {
         "branch": "feat/epic-003-auth",
         "staged_files": 2,
         "unstaged_files": 0,
         "untracked_files": 0,
         "commit_count": 7
       },

       "last_commands": [
         {
           "command_id": "cmd_335",
           "type": "spawn",
           "target": "implementation subagent",
           "timestamp": "2026-01-28T12:00:00Z"
         },
         {
           "command_id": "cmd_339",
           "type": "git_commit",
           "message": "feat: add OAuth token refresh",
           "timestamp": "2026-01-28T13:45:00Z"
         },
         {
           "command_id": "cmd_343",
           "type": "task_complete",
           "epic_id": "epic-003",
           "timestamp": "2026-01-28T14:32:00Z"
         }
       ],

       "prd_status": {
         "version": "2.0.0",
         "epic_003_status": "COMPLETED",
         "next_epic": "epic-004-mfa",
         "last_updated": "2026-01-28T14:32:00Z"
       },

       "environment": {
         "project": "odin-s",
         "working_directory": "/home/samuel/sv/odin-s",
         "hostname": "dev-machine-01"
       }
     },

     "metadata": {
       "trigger": "event_epic_completed",
       "event_id": "evt_003_complete",
       "manual": false,
       "size_bytes": 4821
     }
   }
   ```

### MCP Tool Specifications

5. **mcp_meta_create_checkpoint (Explicit)**
   - [ ] Allows PS to manually create checkpoint
   - [ ] Captures current state immediately
   - [ ] Returns checkpoint_id + recovery instructions

6. **mcp_meta_get_checkpoint (Retrieval)**
   - [ ] Load checkpoint by checkpoint_id
   - [ ] Returns full work_state
   - [ ] Returns recovery instructions

7. **mcp_meta_list_checkpoints (Query)**
   - [ ] List checkpoints for instance_id
   - [ ] Filter by checkpoint_type
   - [ ] Returns: checkpoint_id, timestamp, trigger, epic_id
   - [ ] Most recent first

8. **mcp_meta_cleanup_checkpoints (Maintenance)**
   - [ ] Delete checkpoints older than retention period (30 days)
   - [ ] Called daily via scheduled job
   - [ ] Returns: deleted_count, freed_bytes

### Recovery Workflow Integration

9. **Resume Instructions Generation**
   - [ ] When checkpoint loaded, generate plain-language instructions
   - [ ] Example:
     ```
     Epic 003 (Authentication) COMPLETED successfully!
     - 42/42 tests passed
     - PRD updated to v2.0
     - Branch: feat/epic-003-auth
     - Time invested: 4.5 hours

     Next steps:
     1. Merge PR #45 (already created)
     2. Start epic 004 (MFA implementation)
     3. Estimated effort: 60 hours
     ```

10. **Checkpoint Size & Compression**
    - [ ] Work state target size: <5KB per checkpoint
    - [ ] Compression: Store files list as summary, not full diff
    - [ ] Storage estimate: ~100KB/day = 3MB/month

### Performance Requirements

11. **Checkpoint Creation**
    - [ ] Create checkpoint in <200ms (p99)
    - [ ] Serialize work state in <100ms
    - [ ] Store to DB in <50ms
    - [ ] Non-blocking (async, don't wait for result)

12. **Checkpoint Retrieval**
    - [ ] Get checkpoint in <50ms
    - [ ] Generate instructions in <100ms
    - [ ] Total: <150ms for resume experience

13. **Checkpoint Query**
    - [ ] List 10 checkpoints: <30ms
    - [ ] Search by epic: <50ms

### Checkpoint Types & Triggers

14. **Context Window Checkpoints**
    - [ ] Trigger at 80% context window
    - [ ] Store: current_epic, files_modified, last_commands (20)
    - [ ] Purpose: Fast recovery if machine disconnects

15. **Epic Completion Checkpoints**
    - [ ] Trigger when event_type == 'epic_completed'
    - [ ] Store: complete work state, test results, commit history
    - [ ] Purpose: Handoff to next epic, audit trail
    - [ ] Retention: Keep indefinitely (audit)

16. **Manual Checkpoints (Optional)**
    - [ ] PS can create anytime: `mcp_meta_create_checkpoint(note?)`
    - [ ] Useful for mid-epic milestones
    - [ ] Type: 'manual'

### Data Integrity

17. **Checkpoint Immutability**
    - [ ] Once created, checkpoints never updated
    - [ ] Only delete for retention cleanup (>30 days)
    - [ ] Timestamped and auditable

18. **State Consistency**
    - [ ] Work state must be internally consistent
    - [ ] All referenced epic_ids must exist
    - [ ] All file paths must be valid
    - [ ] Git status must match actual repo state

### Testing Requirements

19. **Unit Tests**
    - [ ] Checkpoint creation (all types)
    - [ ] Work state serialization
    - [ ] Instructions generation
    - [ ] Size validation
    - [ ] Compression effectiveness

20. **Integration Tests**
    - [ ] Context window trigger → checkpoint created
    - [ ] Epic completion event → checkpoint created
    - [ ] Checkpoint retrieval → correct state restored
    - [ ] Multiple checkpoints per instance
    - [ ] Concurrent checkpoint creation

21. **Recovery Tests**
    - [ ] Load checkpoint → generate instructions
    - [ ] Instructions are actionable
    - [ ] Resume engine can use checkpoint state
    - [ ] Storage growth within budget

---

## Technical Specifications

### Database Migration

**File**: `migrations/004-checkpoints.sql`

```sql
CREATE TYPE checkpoint_type AS ENUM (
  'context_window',
  'epic_completion',
  'manual'
);

CREATE TABLE checkpoints (
  checkpoint_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES supervisor_sessions(instance_id),
  checkpoint_type checkpoint_type NOT NULL,
  sequence_num BIGINT NOT NULL,
  context_window_percent INT CHECK (context_window_percent BETWEEN 0 AND 100),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  work_state JSONB NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_checkpoints_instance_time
  ON checkpoints(instance_id, timestamp DESC);

CREATE INDEX idx_checkpoints_type_time
  ON checkpoints(checkpoint_type, created_at DESC);
```

### Implementation Approach

**Phase 1: Schema & Core (Days 1-2)**
1. Create migration for checkpoints table
2. Implement CheckpointManager class
3. Add MCP tool endpoints

**Phase 2: Triggers (Days 3)**
1. Wire context window trigger to heartbeat
2. Wire epic completion trigger to event store
3. Implement work state serialization

**Phase 3: Recovery Integration (Days 4)**
1. Generate recovery instructions
2. Test checkpoint → resume flow
3. Optimize storage/compression

**Phase 4: Testing (Day 5)**
1. Unit tests (all checkpoint types)
2. Integration tests (trigger flows)
3. Performance tests (retrieval speed)

---

## Files to Create/Modify

### Create

1. **`migrations/004-checkpoints.sql`**
   - Checkpoint schema
   - Indexes

2. **`src/checkpoint/checkpoint-manager.ts`**
   - Core CheckpointManager class
   - Create, get, list, cleanup functions

3. **`src/checkpoint/work-state-serializer.ts`**
   - Serialize work state to JSON
   - Compression logic
   - Size optimization

4. **`src/checkpoint/recovery-generator.ts`**
   - Generate plain-language recovery instructions
   - Format: markdown with action items

5. **`src/types/checkpoint-types.ts`**
   - TypeScript interfaces
   - Zod schemas for validation

6. **`src/mcp/tools/checkpoint-tools.ts`**
   - MCP tool implementations

7. **`tests/unit/checkpoint-manager.test.ts`**
   - Creation, serialization, instructions

8. **`tests/integration/checkpoint-recovery.test.ts`**
   - Trigger flows, resume integration

### Modify

1. **`src/heartbeat/heartbeat-handler.ts`**
   - Add context window trigger

2. **`src/event-store/event-store.ts`**
   - Add checkpoint trigger on epic_completed

3. **`src/mcp/tools.ts`**
   - Register checkpoint tools

---

## Success Criteria

- [ ] Checkpoints created in <200ms
- [ ] Checkpoints retrieved in <50ms
- [ ] All work state captured accurately
- [ ] Recovery instructions generated and actionable
- [ ] Storage within 100KB/day budget
- [ ] Context window trigger fires at 80%
- [ ] Epic completion checkpoint captures all results
- [ ] Integration tests passing (100%)

---

## Related Documents

- `prd.md` - Feature overview
- `epic-007-B-command-logging.md` - Dependency
- `epic-007-C-event-store.md` - Dependency
- `epic-007-E-resume-engine.md` - Uses checkpoint data

---

**Maintained by**: Meta-Supervisor
**Created**: 2026-01-28
**Last Updated**: 2026-01-28
