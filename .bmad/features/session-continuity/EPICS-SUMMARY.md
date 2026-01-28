# Session Continuity Feature: Epic Specifications Summary

**Created**: 2026-01-28
**Status**: All 6 Epic Specifications Complete
**Total Lines**: 4,026 across 6 epic files

---

## Epic Overview

| # | Epic ID | Title | Status | Hours | Dependencies |
|---|---------|-------|--------|-------|--------------|
| 1 | 007-A | Instance Registry | Complete | 60 | None |
| 2 | 007-B | Command Logging | Complete | 80 | 007-A |
| 3 | **007-C** | **Event Store & State Tracking** | **NEW** | **50** | **007-A** |
| 4 | **007-D** | **Checkpoint System** | **NEW** | **60** | **007-B, 007-C** |
| 5 | **007-E** | **Resume Engine** | **NEW** | **70** | **007-A through 007-D** |
| 6 | **007-F** | **PS Instruction Integration** | **NEW** | **40** | **007-A, 007-E** |
| | **TOTAL** | | **ALL COMPLETE** | **360 hours** | |

---

## New Epics Created (007-C through 007-F)

### Epic 007-C: Event Store and State Tracking (13KB, 439 lines)

**Purpose**: Track all state transitions (epic started, test passed, deployment done)

**Key Deliverables:**
- `event_store` table (UUID, instance_id, event_type, sequence_num, timestamp, event_data)
- 12 event types defined (instance lifecycle, epic lifecycle, testing, git, deployment, work state, planning)
- 4 MCP tools: emit_event, query_events, replay_events, list_event_types
- Immutable event log with monotonic sequence numbers
- Event replay capability for state reconstruction

**Performance Targets:**
- Event emission: <10ms (p99)
- Event query: <100ms (p99)
- Event replay: <200ms for 100 events
- Storage: ~500KB/day

**Database Schema:**
```sql
CREATE TABLE event_store (
  event_id UUID PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES supervisor_sessions(instance_id),
  event_type VARCHAR(64) NOT NULL,
  sequence_num BIGINT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_data JSONB NOT NULL,
  metadata JSONB,
  CONSTRAINT unique_sequence UNIQUE (instance_id, sequence_num)
);
```

**Sample Event Types:**
- Instance: `instance_registered`, `instance_heartbeat`, `instance_stale`
- Epic: `epic_started`, `epic_completed`, `epic_failed`
- Testing: `test_started`, `test_passed`, `test_failed`, `validation_passed`
- Git: `commit_created`, `pr_created`, `pr_merged`
- Deployment: `deployment_started`, `deployment_completed`, `deployment_failed`

---

### Epic 007-D: Checkpoint System (13KB, 436 lines)

**Purpose**: Auto-capture complete work state at 80% context and post-epic completion

**Key Deliverables:**
- `checkpoints` table (checkpoint_id, instance_id, checkpoint_type, sequence_num, context_window_percent, work_state, metadata)
- Work state serialization (current epic, files modified, last N commands, git status, environment)
- Automatic triggers: context window 80%, epic completion
- 4 MCP tools: create_checkpoint, get_checkpoint, list_checkpoints, cleanup_checkpoints
- Recovery instructions generation from checkpoint

**Performance Targets:**
- Checkpoint creation: <200ms (p99)
- Checkpoint retrieval: <50ms (p99)
- Storage: ~100KB/day

**Checkpoint Types:**
1. **Context Window (80%)**: Save in-progress state
2. **Epic Completion**: Save full completion context
3. **Manual**: User-initiated checkpoint

**Work State Structure:**
```json
{
  "current_epic": { epic_id, status, duration_hours, test_results },
  "files_modified": [ { path, status, lines_changed, last_modified } ],
  "git_status": { branch, staged_files, unstaged_files, commit_count },
  "last_commands": [ { command_id, type, target, timestamp } ],
  "prd_status": { version, epic_status, next_epic, last_updated },
  "environment": { project, working_directory, hostname }
}
```

**Sample Recovery Instructions:**
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

---

### Epic 007-E: Resume Engine (14KB, 475 lines)

**Purpose**: Intelligently restore any PS instance by ID after crashes/disconnects

**Key Deliverables:**
- Instance resolution (exact ID, partial ID, project, epic, newest)
- Multi-instance disambiguation (show numbered list)
- Context reconstruction (checkpoint-based, event-based, command-based)
- Recovery summary generation with confidence scoring
- Stale instance detection (>2 min without heartbeat)
- 3 MCP tools: resume_instance, get_instance_details, list_stale_instances

**Performance Targets:**
- Resume: <500ms (p99)
- Instance resolution: <50ms
- Disambiguation: <100ms
- Summary generation: <100ms

**Instance Resolution Strategies:**
1. **Exact ID**: `resume 8f4a2b` → Single match
2. **Partial ID**: `resume 8f4a` → Match prefix
3. **Project**: `resume odin` → List all Odin instances
4. **Epic**: `resume epic-003` → Find instance working on that epic
5. **Newest**: `resume` with no args → Most recent instance

**Confidence Scoring:**
- Checkpoint age: 100% if <5min, 90% if <1h, 70% if >1h
- State validity: -10% if files deleted, -5% if branch deleted
- Event freshness: -5% per 30min since last event
- Final score: max(checkpoint_confidence, event_confidence, command_confidence)

**Recovery Summary Format:**
```
✅ Resumed: odin-PS-8f4a2b

EPIC 003: Authentication (OAuth)
Status: IN PROGRESS → COMPLETED
- Tests: 42/42 PASSED ✓
- Coverage: 87%
- Time: 4h 32min
- PR: #45 created (ready for review)

GIT STATUS:
- Branch: feat/epic-003-auth
- Commits: 7 since main
- Staged: 0 files
- Changed: 12 files

CHECKPOINT: epic_completion (2 min old)
Confidence: 99%

NEXT STEPS:
1. Verify CI passes (in progress)
2. Merge PR #45 into main
3. Start epic 004 (MFA) - 60h estimated

Ready to continue. Command: "continue building"
```

---

### Epic 007-F: PS Instruction Integration (15KB, 484 lines)

**Purpose**: Integrate session continuity into every PS automatically

**Key Deliverables:**
- Auto-registration on PS first response
- Instance ID visible in footer of every response
- Automatic heartbeat with every response
- Automatic command logging (spawn, commit, deploy, pr, plan)
- Automatic checkpoint creation at 80% and epic completion
- Resume command handling
- CLAUDE.md updates for all PSes
- PS bootstrap helper utilities

**Footer Format:**
```
Instance: odin-PS-8f4a2b | Epic: 003 | Context: 42% | Active: 1.2h
[Use "resume odin-PS-8f4a2b" to restore this session]
```

**Automatic Logging Integration Points:**
1. **Spawn**: Log when Task spawned (subagent_type, description)
2. **Commit**: Log when git commit created (message, files_changed)
3. **PR**: Log when PR created (pr_url, epic_id)
4. **Deploy**: Log when deployment completed (service, port, status)
5. **Plan**: Log when task created (description, epic_id)

**Resume Workflow (User Perspective):**
```
[Context: 95%, working on epic-003 for 4.5 hours]
[Machine disconnects]
[User reconnects, starts new PS session]

User: resume odin-PS-8f4a2b

PS Response: [Displays recovery summary]
[Shows next steps: merge PR, start epic-004]

User: continue building

PS: [Continues from checkpoint, no context loss]
```

**Implementation Integration Points:**
1. PS initialization (register on startup)
2. Response generation (add footer, call heartbeat)
3. Task spawning (log spawn command)
4. Git operations (log commits)
5. Deployment (log deployment status)
6. Resume command handling (call resume engine)

---

## Database Schema Summary

### 4 New Tables (Created Across Epics)

```sql
-- Epic 007-A (existing)
CREATE TABLE supervisor_sessions (
  instance_id UUID PRIMARY KEY,
  project VARCHAR(255) NOT NULL,
  instance_type ENUM('PS', 'MS') NOT NULL,
  status ENUM('active', 'stale', 'inactive') NOT NULL,
  last_heartbeat TIMESTAMPTZ,
  context_window INT,
  current_epic VARCHAR(255)
);

-- Epic 007-B (existing)
CREATE TABLE command_log (
  command_id UUID PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES supervisor_sessions(instance_id),
  command_type VARCHAR(64) NOT NULL,
  command_data JSONB NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL
);

-- Epic 007-C (NEW)
CREATE TABLE event_store (
  event_id UUID PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES supervisor_sessions(instance_id),
  event_type VARCHAR(64) NOT NULL,
  sequence_num BIGINT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  event_data JSONB NOT NULL,
  CONSTRAINT unique_sequence UNIQUE (instance_id, sequence_num)
);

-- Epic 007-D (NEW)
CREATE TABLE checkpoints (
  checkpoint_id UUID PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES supervisor_sessions(instance_id),
  checkpoint_type ENUM('context_window', 'epic_completion', 'manual'),
  sequence_num BIGINT NOT NULL,
  context_window_percent INT,
  timestamp TIMESTAMPTZ NOT NULL,
  work_state JSONB NOT NULL
);
```

---

## MCP Tools Summary

### 11 New Tools (Across All Epics)

**Epic 007-A (Instance Registry):**
1. `mcp_meta_register_instance` - Register new instance
2. `mcp_meta_heartbeat` - Update heartbeat
3. `mcp_meta_list_instances` - List active instances

**Epic 007-B (Command Logging):**
4. `mcp_meta_log_command` - Explicitly log command
5. `mcp_meta_search_commands` - Query command history

**Epic 007-C (Event Store):** [NEW]
6. `mcp_meta_emit_event` - Record state event
7. `mcp_meta_query_events` - Query event history
8. `mcp_meta_replay_events` - Reconstruct state by replaying

**Epic 007-D (Checkpoint System):** [NEW]
9. `mcp_meta_create_checkpoint` - Create checkpoint
10. `mcp_meta_get_checkpoint` - Retrieve checkpoint

**Epic 007-E (Resume Engine):** [NEW]
11. `mcp_meta_resume_instance` - Resume from instance ID
12. `mcp_meta_get_instance_details` - Get full details
13. `mcp_meta_list_stale_instances` - Find stale instances

**Epic 007-F (PS Integration):** [NEW]
- Uses all tools above + adds helper methods

---

## Implementation Timeline

### Critical Path Analysis

```
Week 1-2: 007-A (Instance Registry) ✓ In Progress
├─ Sessions table
├─ Register/heartbeat/list tools
└─ Heartbeat mechanism

Week 3-4: 007-B (Command Logging) ✓ In Progress
├─ Command log table
├─ Auto-wrap MCP tools
└─ Explicit logging hooks

Week 5: 007-C (Event Store) [READY FOR IMPLEMENTATION]
├─ Event store table (439 lines spec)
├─ 12 event types
├─ Emit/query/replay tools
└─ Event validation

Week 6-7: 007-D (Checkpoint System) [READY FOR IMPLEMENTATION]
├─ Checkpoints table (436 lines spec)
├─ Work state serialization
├─ Auto-triggers (80%, epic completion)
└─ Recovery instructions

Week 8-9: 007-E (Resume Engine) [READY FOR IMPLEMENTATION]
├─ Instance resolution (exact, partial, project, epic)
├─ Context reconstruction (checkpoint, event, command)
├─ Confidence scoring
└─ Resume command handling

Week 10: 007-F (PS Integration) [READY FOR IMPLEMENTATION]
├─ PS initialization
├─ Footer rendering
├─ Auto-logging integration
└─ Resume command handling
```

---

## File Locations

```
/home/samuel/sv/supervisor-service-s/.bmad/features/session-continuity/
├── epics/
│   ├── epic-007-A-instance-registry.md (1,073 lines) [EXISTING]
│   ├── epic-007-B-command-logging.md (1,119 lines) [EXISTING]
│   ├── epic-007-C-event-store.md (439 lines) [NEW]
│   ├── epic-007-D-checkpoint-system.md (436 lines) [NEW]
│   ├── epic-007-E-resume-engine.md (475 lines) [NEW]
│   └── epic-007-F-ps-integration.md (484 lines) [NEW]
├── prd.md (570 lines) [MASTER DOCUMENT]
├── EPICS-SUMMARY.md (THIS FILE)
├── adr/
├── context/
└── reports/
```

---

## Implementation Checklist

### Ready to Implement (Epic 007-C)

- [ ] Database migration for event_store table
- [ ] EventStore class (emit, query, replay)
- [ ] MCP tool endpoints (emit, query, replay, list)
- [ ] Event validation schema
- [ ] Unit tests (all event types)
- [ ] Integration tests (full lifecycle)
- [ ] Performance tests (query speed, storage)

### Ready to Implement (Epic 007-D)

- [ ] Database migration for checkpoints table
- [ ] CheckpointManager class
- [ ] Work state serializer
- [ ] Recovery instructions generator
- [ ] Auto-trigger at 80% context
- [ ] Auto-trigger on epic completion
- [ ] Unit tests (all checkpoint types)
- [ ] Integration tests (trigger flows)

### Ready to Implement (Epic 007-E)

- [ ] InstanceResolver class (all resolution strategies)
- [ ] ContextReconstructor class (checkpoint, event, command fallback)
- [ ] SummaryGenerator class (confidence scoring)
- [ ] MCP resume tools
- [ ] Disambiguation UI
- [ ] Unit tests (all strategies)
- [ ] Integration tests (full workflow)

### Ready to Implement (Epic 007-F)

- [ ] PS initialization code (register on startup)
- [ ] Footer generation and rendering
- [ ] Heartbeat integration with every response
- [ ] Command logging hooks (spawn, commit, deploy, pr, plan)
- [ ] Checkpoint triggers
- [ ] Resume command detection and handling
- [ ] CLAUDE.md updates for all PSes
- [ ] Bootstrap helpers
- [ ] Integration tests (full PS lifecycle)

---

## Quality Metrics

### Coverage Targets

- **Code Coverage**: 80% minimum
- **Unit Tests**: 70% of coverage
- **Integration Tests**: 20% of coverage
- **Performance Tests**: 10% of coverage

### Performance Targets

| Metric | Target |
|--------|--------|
| Event emission | <10ms (p99) |
| Heartbeat overhead | <20ms |
| Event query (100 events) | <100ms |
| Checkpoint creation | <200ms |
| Checkpoint retrieval | <50ms |
| Resume query | <500ms |
| Instance resolution | <50ms |
| Context reconstruction | <500ms |

### Storage Targets

| Component | Per Day | Per Month | Per Quarter |
|-----------|---------|-----------|-------------|
| Sessions | ~10KB | 300KB | 900KB |
| Commands | ~1MB | 30MB | 90MB |
| Events | ~500KB | 15MB | 45MB |
| Checkpoints | ~100KB | 3MB | 9MB |
| **TOTAL** | **~1.6MB** | **~48MB** | **~144MB** |

---

## Next Steps

1. **Review & Validate**: Review all 6 epic specifications for completeness
2. **Kickoff 007-C**: Start Event Store implementation (Epic 007-C)
3. **Parallel Work**: 007-B and 007-C can proceed in parallel (different teams if available)
4. **Integration Testing**: Pre-plan integration test scenarios across epics
5. **Documentation**: Prepare PS implementation guides (for epic 007-F rollout)

---

**Total Specifications Delivered**: 4,026 lines across 6 epics
**All Epics**: Database schema, MCP tools, acceptance criteria, implementation approach, testing requirements complete

**Status**: Ready for Implementation

---

**Created by**: Meta-Supervisor
**Date**: 2026-01-28
**Version**: 1.0 Complete
