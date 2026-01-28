# Product Requirements Document: Session Continuity System

**Feature ID:** session-continuity
**Created:** 2026-01-28
**Last Updated:** 2026-01-28
**Status:** In Progress
**Version:** 1.0.0

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-28 | Meta-Supervisor | Initial PRD with 6-epic breakdown |

---

## Executive Summary

A comprehensive session continuity system that enables:
1. **Instance Identification**: Unique, user-visible IDs for every PS/MS instance
2. **Command Logging**: Automatic logging of all PS/MS actions to PostgreSQL
3. **Session Recovery**: Resume any specific instance by ID after crashes/disconnects
4. **Multi-Instance Support**: Distinguish between 3+ simultaneous instances of the same project

**Key Innovation**: Instance IDs visible in every PS response footer, enabling precise resume commands like "resume 8f4a2b" to restore exact instance context.

**Business Impact:**
- **Zero context loss**: 95%+ recovery rate after crashes/disconnects
- **Multi-instance clarity**: Manage 3+ instances of same project simultaneously
- **Full audit trail**: Complete record of all PS/MS actions
- **Handoff automation**: System-generated context preservation (manual handoffs become optional)
- **Time savings**: 15-30 min saved per disconnect incident

---

## Problem Statement

### Current State

When VM disconnects, PS instances lose all context. User has no way to:
1. **Identify instances**: 3 Odin PSes open - which was working on what?
2. **Resume specific work**: Cannot say "resume that auth implementation"
3. **Recover context**: Must manually re-explain everything after disconnect
4. **Audit history**: Cannot answer "What did PS do in last hour?"
5. **Debug retroactively**: No record of decisions, spawns, or actions

**Current workaround:** Manual handoffs (requires PS to write document, user to find/read it)

### User Impact

**Frequent scenario:**
- User has 3 Odin PS instances open (epic 003, 007, 012)
- Laptop sleeps, SSH connection drops
- Reconnects → Opens new session
- **Problem:** Which epic was this working on? What was the status? Where to continue?
- **Current solution:** Guess, or spend 10-30 min reconstructing context from git logs

**Pain points:**
- Context reconstruction: 10-30 min per incident
- Wrong instance resumed: Confusion, wasted effort
- Work lost: Uncommitted research, decisions made, progress achieved
- No accountability: Cannot trace back "why did deployment happen at 3am?"

---

## Goals & Objectives

### Primary Goal

Build a session continuity system that **eliminates context loss** through automatic instance tracking, command logging, and intelligent resume.

### Success Criteria

**Instance Management:**
- ✅ Every PS/MS instance has unique, user-visible ID
- ✅ User can identify which instance is working on what (from footer)
- ✅ Resume specific instance by ID: "resume 8f4a2b"
- ✅ Disambiguate multiple instances of same project

**Context Preservation:**
- ✅ Full command log: Every action (spawn, commit, deploy) recorded
- ✅ Event store: Every state change (epic completed, test passed) tracked
- ✅ Checkpoints: Auto-save at 80% context + epic completion
- ✅ Resume success rate: >95% (correct context restored)

**Performance:**
- ✅ Logging overhead: <50ms per command
- ✅ Heartbeat overhead: <20ms per response
- ✅ Resume query: <500ms for full context
- ✅ Storage: <1GB for 90 days of data

**User Experience:**
- ✅ Zero manual effort (automatic logging)
- ✅ Footer always visible (instance ID + status)
- ✅ Resume command intuitive ("resume [id]")
- ✅ Manual handoffs optional (auto-generated from checkpoints)

---

## Epic Status

| Epic | Status | Effort (Hours) | Dependencies | Completion |
|------|--------|----------------|--------------|------------|
| epic-007-A-instance-registry | In Progress | 60 | None | 0% |
| epic-007-B-command-logging | Pending | 80 | 007-A | 0% |
| epic-007-C-event-store | Pending | 50 | 007-A | 0% |
| epic-007-D-checkpoint-system | Pending | 60 | 007-B, 007-C | 0% |
| epic-007-E-resume-engine | Pending | 70 | 007-A through 007-D | 0% |
| epic-007-F-ps-integration | Pending | 40 | 007-A, 007-E | 0% |
| **Total** | **In Progress** | **360 hours** | **-** | **0%** |

**Actual Timeline:** TBD - Started 2026-01-28

**Critical Path:** 007-A → 007-B, 007-C → 007-D → 007-E → 007-F

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                   Session Continuity System                      │
├──────────────────┬──────────────────┬──────────────────────────┤
│ 1. Instance      │ 2. Command       │ 3. Resume Engine         │
│    Registry      │    Logger        │                          │
│ - Generate IDs   │ - Auto-wrap MCP  │ - Query last state       │
│ - Track active   │ - Log explicit   │ - Reconstruct context    │
│ - Heartbeat      │ - Store in DB    │ - Continue work          │
├──────────────────┼──────────────────┼──────────────────────────┤
│ 4. Event Store   │ 5. Checkpoint    │ 6. UI Footer             │
│                  │    Manager       │                          │
│ - State changes  │ - 80% trigger    │ - Show instance ID       │
│ - Epic events    │ - Post-epic snap │ - Display status         │
│ - Validation     │ - Work state     │ - Enable resume          │
└──────────────────┴──────────────────┴──────────────────────────┘
```

### Database Schema

**4 New Tables:**

1. **supervisor_sessions**: Instance registry (instance_id, project, status, heartbeat)
2. **command_log**: Action history (spawn, commit, deploy, etc.)
3. **event_store**: State transitions (epic completed, test passed)
4. **checkpoints**: Work snapshots (context at 80%, post-epic)

### Instance ID Format

```
{project}-{type}-{short-hash}

Examples:
- odin-PS-8f4a2b
- consilio-PS-3c7d1e
- meta-MS-a9b2c4
```

### Footer Format

```
---
Instance: odin-PS-8f4a2b | Epic: 003 | Context: 42% | Active: 1.2h
```

---

## Key Features

### 1. Instance Registry (Epic 007-A)

**Problem Solved:** Cannot identify which PS instance is working on what

**Solution:** Unique IDs + visible footer

**How It Works:**
1. PS registers on startup: `mcp_meta_register_instance()`
2. Gets unique ID: `odin-PS-8f4a2b`
3. Shows ID in every response footer
4. Heartbeat updates every response
5. Stale detection after 2 min without heartbeat

**Outcome:** User always knows which instance they're talking to

### 2. Command Logging (Epic 007-B)

**Problem Solved:** No record of PS actions

**Solution:** Automatic + explicit logging

**How It Works:**
1. MCP server auto-wraps all tool calls (automatic)
2. PS explicitly logs: spawns, git ops, planning (manual but required)
3. All logged to `command_log` table
4. Secrets sanitized before storage

**Outcome:** Complete audit trail of every action

### 3. Event Store (Epic 007-C)

**Problem Solved:** Commands logged but state transitions not tracked

**Solution:** Immutable event log

**How It Works:**
1. Events emitted: epic_started, epic_completed, test_passed, etc.
2. Monotonic sequence numbers enable replay
3. Append-only (never modified)

**Outcome:** Full state history for any instance

### 4. Checkpoint System (Epic 007-D)

**Problem Solved:** Context lost at 80% window or after epic completion

**Solution:** Auto-checkpoint with work state snapshot

**How It Works:**
1. Trigger at 80% context (via heartbeat)
2. Trigger after epic completion
3. Snapshot includes: current epic, files modified, last commands, git status
4. Resume instructions generated

**Outcome:** Fast recovery from checkpoint (no replay needed)

### 5. Resume Engine (Epic 007-E)

**Problem Solved:** Cannot resume specific instance after crash

**Solution:** Intelligent context reconstruction

**How It Works:**
1. User: "resume 8f4a2b"
2. Resolve ID → Find instance
3. Load checkpoint (if exists) OR last 20 commands
4. Reconstruct work state
5. Generate summary + next steps
6. Create new instance (inherit from old)

**Outcome:** User continues work seamlessly

### 6. PS Integration (Epic 007-F)

**Problem Solved:** PS doesn't use the system

**Solution:** Instructions + mandatory footer

**How It Works:**
1. PS registers on first message
2. Shows footer in every response
3. Heartbeat with each message
4. Logs critical actions (spawn, git, plan)
5. Creates checkpoints automatically
6. Handles resume requests

**Outcome:** System fully operational, zero user effort

---

## Technical Specifications

### MCP Tools (11 New Tools)

| Category | Tool | Purpose |
|----------|------|---------|
| Session | `mcp_meta_register_instance` | Register new instance |
| Session | `mcp_meta_heartbeat` | Update heartbeat + context |
| Session | `mcp_meta_list_instances` | List active/recent instances |
| Logging | `mcp_meta_log_command` | Explicitly log command |
| Logging | `mcp_meta_search_commands` | Query command history |
| Events | `mcp_meta_emit_event` | Record state event |
| Events | `mcp_meta_query_events` | Query event history |
| Checkpoint | `mcp_meta_create_checkpoint` | Create checkpoint |
| Checkpoint | `mcp_meta_get_checkpoint` | Retrieve checkpoint |
| Resume | `mcp_meta_resume_instance` | Resume from instance |
| Resume | `mcp_meta_get_instance_details` | Get full details |

### Performance Budget

| Metric | Target |
|--------|--------|
| Command log overhead | <50ms |
| Heartbeat overhead | <20ms |
| Resume query | <500ms |
| Event emit | <10ms |
| Checkpoint creation | <200ms |

### Storage Budget

| Data Type | Retention | Size Estimate |
|-----------|-----------|---------------|
| Sessions | 90 days | ~10KB/session |
| Commands | 90 days | ~1MB/day |
| Events | 90 days | ~500KB/day |
| Checkpoints | 30 days | ~100KB/day |
| **Total** | - | **~450MB for 90 days** |

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)

**Epic 007-A: Instance Registry**
- Generate unique IDs
- Session tracking table
- Heartbeat mechanism
- MCP tools: register, heartbeat, list

**Deliverables:**
- PS instances have unique IDs
- User can list all active instances
- Stale detection works

### Phase 2: Logging (Weeks 3-4)

**Epic 007-B: Command Logging**
- Command log table
- Auto-wrap MCP tools
- Explicit logging for git/spawns
- Secret sanitization

**Deliverables:**
- Complete audit trail
- Search command history
- No secrets in logs

### Phase 3: State Tracking (Week 5)

**Epic 007-C: Event Store**
- Event store table
- Event types defined
- Emit/query tools

**Deliverables:**
- State transitions tracked
- Epic completion events logged

### Phase 4: Checkpoints (Weeks 6-7)

**Epic 007-D: Checkpoint System**
- Checkpoints table
- Auto-trigger at 80%, post-epic
- Work state serialization
- Resume instructions generation

**Deliverables:**
- Checkpoints created automatically
- Work state preserved
- Fast recovery possible

### Phase 5: Resume (Weeks 8-9)

**Epic 007-E: Resume Engine**
- Instance resolution (by ID/hash/project)
- Context reconstruction
- Summary generation
- Next steps suggestion

**Deliverables:**
- "resume 8f4a2b" works
- Context restored correctly (>95%)
- Disambiguation for multiple matches

### Phase 6: Integration (Week 10)

**Epic 007-F: PS Integration**
- PS instructions updated
- Footer implementation
- Automatic registration/heartbeat
- Explicit logging integration

**Deliverables:**
- All PSes show instance IDs
- System fully operational
- Manual handoffs optional

---

## Non-Functional Requirements

### Reliability

- Instance ID uniqueness: >99.999% (6-char hash + project prefix)
- Resume success rate: >95%
- Heartbeat reliability: >99%
- Data durability: PostgreSQL ACID guarantees

### Security

- Secrets sanitized before logging (API keys, tokens, passwords)
- No PII in command/event context
- Database access via MCP tools (scoped by project)
- Audit trail tamper-evident (append-only)

### Performance

- Command logging: Async, non-blocking, <50ms
- Heartbeat: <20ms per call
- Resume query: <500ms (checkpoint) or <1s (replay)
- Storage growth: ~50MB/month

### Usability

- Instance ID visible in every response (no searching)
- Resume command intuitive ("resume [id]")
- Disambiguation clear (show numbered list)
- Next steps actionable (plain language)

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Instance ID collisions** | Low | Medium | 6-char hash + project = very low collision rate (~1 in 16M) |
| **Logging overhead slows PS** | Medium | Medium | Async logging, <50ms budget, batch if needed |
| **Resume context inaccurate** | Medium | High | Use checkpoints when available, validate with user |
| **Multiple instances confusion** | High | Medium | Clear footer, disambiguation prompt, test with real users |
| **Storage growth** | Low | Low | 90-day retention, archive to cold storage, compress checkpoints |
| **Heartbeat failures** | Medium | Low | Graceful degradation, don't block on heartbeat errors |

---

## Testing Strategy

### Unit Testing

**Per Epic:**
- 007-A: ID generation, session CRUD, heartbeat
- 007-B: Command logging, sanitization, search
- 007-C: Event emission, query, sequence
- 007-D: Checkpoint creation, serialization, retrieval
- 007-E: Instance resolution, context reconstruction, summary generation
- 007-F: Footer rendering, registration flow

**Coverage Target:** 80% code coverage

### Integration Testing

**Test Scenarios:**
1. **Full lifecycle**: Register → Log commands → Checkpoint → Resume
2. **Multi-instance**: 3 Odin instances, resume by hash
3. **Crash recovery**: Kill session mid-work, resume correctly
4. **Disambiguation**: Multiple matches, user picks correct one
5. **Stale detection**: Old session marked stale, warn on resume

### Performance Testing

**Load Tests:**
- 100 concurrent instances
- 1000 commands/minute logged
- Resume under load (<500ms p95)

**Stress Tests:**
- 90 days of data (450MB)
- Search 100k commands
- Resume with 1000 commands (no checkpoint)

---

## Dependencies

### Existing Infrastructure

**Required (Already Built):**
- ✅ PostgreSQL database (supervisor_meta)
- ✅ MCP server infrastructure
- ✅ Epic/task tracking tables
- ✅ PIV loop (triggers events)

**New Components (To Build):**
- Instance registry
- Command logger
- Event store
- Checkpoint manager
- Resume engine

### External Dependencies

- PostgreSQL 14+
- Node.js 20+
- TypeScript 5+
- No new external dependencies

---

## Deployment Plan

### Pre-Deployment Checklist

- [ ] All 6 epics completed and tested
- [ ] Integration tests passing (>95%)
- [ ] Database migrations tested
- [ ] PS instructions updated
- [ ] Performance benchmarks met
- [ ] Rollback procedure documented

### Rollout Strategy

**Week 1: Internal Testing**
- Deploy to meta-supervisor only
- Test with single project (supervisor-service-s)
- Monitor performance, storage, errors

**Week 2: Gradual Rollout**
- Deploy to 1 project (consilio-s)
- Monitor resume success rate
- Collect user feedback

**Week 3: Full Deployment**
- Deploy to all projects (odin-s, openhorizon-s, health-agent-s)
- Monitor system-wide
- Iterate on issues

### Success Criteria for Rollout

- ✅ Resume success rate ≥95%
- ✅ Command logging overhead ≤50ms
- ✅ Zero crashes due to logging
- ✅ User can identify instances correctly
- ✅ Storage growth within budget (<1GB/90 days)

---

## Change Log

### Version 1.0.0 (2026-01-28) - IN PROGRESS

**Implementation Started:**
- Initial PRD created with 6-epic breakdown
- Research-backed design (SCAR patterns + industry best practices)
- Multi-instance support with visible IDs
- Hybrid logging approach (auto + explicit)
- Checkpoint-based recovery
- Intelligent resume engine

**Epic Status:**
- All 6 epics defined with detailed acceptance criteria
- Database schema designed (4 tables)
- MCP tools specified (11 tools)
- PS instructions outlined
- Implementation timeline: 10 weeks

---

## Related Documents

### Epics
- `epics/epic-007-A-instance-registry.md` - Instance tracking
- `epics/epic-007-B-command-logging.md` - Action logging
- `epics/epic-007-C-event-store.md` - State transitions
- `epics/epic-007-D-checkpoint-system.md` - Work snapshots
- `epics/epic-007-E-resume-engine.md` - Context reconstruction
- `epics/epic-007-F-ps-integration.md` - PS instructions

### Context
- `context/session-continuity-research-scar.md` - SCAR system patterns
- `context/session-continuity-research-industry.md` - Best practices

### Future ADRs
- ADR 007-001: Instance ID format and collision avoidance
- ADR 007-002: Hybrid logging approach (auto + explicit)
- ADR 007-003: Checkpoint trigger strategy (80% + post-epic)
- ADR 007-004: Resume ambiguity resolution (disambiguation UI)

---

**Maintained by**: Meta-Supervisor (MS)
**Next Review**: After Phase 1 completion (2 weeks)
