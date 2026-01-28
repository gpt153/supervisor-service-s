# Session Continuity Feature: Complete Epic Specifications

**Status**: All 6 Epic Specifications Complete
**Created**: 2026-01-28
**Total Lines**: 5,930 specification lines across 9 documents

---

## Documentation Structure

This directory contains complete specifications for the Session Continuity feature:

```
session-continuity/
├── prd.md                          (Master document - start here)
├── README-EPICS.md                 (This file - navigation guide)
│
├── EPICS-SUMMARY.md                (Complete overview of all 6 epics)
├── IMPLEMENTATION-QUICK-START.md   (Developer quick-start guide)
│
└── epics/
    ├── epic-007-A-instance-registry.md      (Complete spec)
    ├── epic-007-B-command-logging.md        (Complete spec)
    ├── epic-007-C-event-store.md            (Complete spec - NEW)
    ├── epic-007-D-checkpoint-system.md      (Complete spec - NEW)
    ├── epic-007-E-resume-engine.md          (Complete spec - NEW)
    └── epic-007-F-ps-integration.md         (Complete spec - NEW)
```

---

## Reading Order

### For Project Supervisors (Big Picture)
1. **Start**: `prd.md` (570 lines)
   - Executive summary
   - Problem statement
   - Architecture overview
   - Business value
   - High-level roadmap

2. **Then**: `EPICS-SUMMARY.md` (1,547 lines)
   - All 6 epics at a glance
   - Dependencies and critical path
   - Database schema summary
   - MCP tools overview
   - Implementation timeline

### For Implementation Subagents (Ready to Code)
1. **Start**: `IMPLEMENTATION-QUICK-START.md` (1,357 lines)
   - Your specific epic overview
   - Files to create/modify
   - Database schema
   - MCP tool specifications
   - Testing strategy
   - Common pitfalls and solutions

2. **Then**: `epics/epic-007-X-{name}.md`
   - Complete specification for your epic
   - Full acceptance criteria
   - Technical details
   - Implementation approach

---

## The 6 Epics

### Phase 1: Foundation (Weeks 1-2, In Progress)

**Epic 007-A: Instance Registry** (1,073 lines)
- Generate unique instance IDs
- Track active instances
- Heartbeat mechanism
- MCP tools: register, heartbeat, list

**Epic 007-B: Command Logging** (1,119 lines)
- Log all PS/MS actions
- Auto-wrap MCP tools
- Explicit logging for git/spawn
- Secret sanitization

### Phase 2-3: New Specifications (Weeks 5-10, Ready for Implementation)

**Epic 007-C: Event Store & State Tracking** (439 lines) NEW
- Immutable event log
- 12 event types (instance, epic, testing, git, deployment)
- MCP tools: emit, query, replay, list
- Event validation and replay capability

**Epic 007-D: Checkpoint System** (436 lines) NEW
- Auto-capture work state at 80% and post-epic
- Work state serialization
- Auto-triggers via heartbeat and events
- MCP tools: create, get, list, cleanup

**Epic 007-E: Resume Engine** (475 lines) NEW
- Intelligent instance restoration
- 5 resolution strategies (exact, partial, project, epic, newest)
- Multi-instance disambiguation
- Context reconstruction (checkpoint → events → commands)
- Confidence scoring (0-100%)
- MCP tools: resume, get_details, list_stale

**Epic 007-F: PS Integration** (484 lines) NEW
- Auto-register PSes on startup
- Show instance ID in footer
- Automatic heartbeat with every response
- Automatic logging (spawn, commit, deploy)
- Automatic checkpoints
- Resume command handling

---

## Key Specifications

### Database (4 Tables)

```
supervisor_sessions     Instance registry (from 007-A)
command_log            Command history (from 007-B)
event_store            State transitions (NEW - 007-C)
checkpoints            Work snapshots (NEW - 007-D)
```

### MCP Tools (13 Total)

**007-A**: register_instance, heartbeat, list_instances
**007-B**: log_command, search_commands
**007-C**: emit_event, query_events, replay_events, list_event_types
**007-D**: create_checkpoint, get_checkpoint, list_checkpoints, cleanup_checkpoints
**007-E**: resume_instance, get_instance_details, list_stale_instances

### Performance Targets

| Operation | Target |
|-----------|--------|
| Event emit | <10ms (p99) |
| Event query (100x) | <100ms |
| Checkpoint create | <200ms |
| Checkpoint retrieve | <50ms |
| Resume | <500ms |

---

## What Each Epic Includes

Every epic specification contains:

- **Overview**: Business value and problem solved
- **Acceptance Criteria**: 20-25 detailed, testable criteria
- **Database Schema**: Migration SQL with indexes
- **MCP Tools**: Complete TypeScript interface definitions
- **Implementation Approach**: Phase-by-phase breakdown
- **Files to Create/Modify**: With purposes
- **Testing Requirements**: Unit, integration, performance
- **Success Criteria**: Measurable completion metrics
- **Related Documents**: Cross-references

---

## Quick Reference: File Locations

```
/home/samuel/sv/supervisor-service-s/.bmad/features/session-continuity/

Master Documents:
├── prd.md                          Feature overview and architecture
├── README-EPICS.md                 Navigation guide (this file)
├── EPICS-SUMMARY.md                All 6 epics at a glance
├── IMPLEMENTATION-QUICK-START.md   Developer quick-start

Epic Specifications:
└── epics/
    ├── epic-007-A-instance-registry.md
    ├── epic-007-B-command-logging.md
    ├── epic-007-C-event-store.md
    ├── epic-007-D-checkpoint-system.md
    ├── epic-007-E-resume-engine.md
    └── epic-007-F-ps-integration.md

Supporting Directories:
├── adr/          Architecture decision records
├── context/      Research and design context
└── reports/      Implementation reports
```

---

## Implementation Timeline

```
Week 1-2:  Epic 007-A (In Progress)
Week 3-4:  Epic 007-B (In Progress)
───────────────────────────────────
Week 5:    Epic 007-C (50 hours) [READY]
Week 6-7:  Epic 007-D (60 hours) [READY]
Week 8-9:  Epic 007-E (70 hours) [READY]
Week 10:   Epic 007-F (40 hours) [READY]
───────────────────────────────────
Total:     360 hours
```

---

## Dependencies & Parallelization

```
Critical Path:
007-A → {007-B, 007-C} → 007-D → 007-E → 007-F

Parallel Opportunities:
- 007-B and 007-C can start in parallel (no dependency)
- 007-D can start after 007-C completes
- 007-E must wait for all prior epics
- 007-F must wait for 007-E
```

---

## Starting an Epic Implementation

**Step 1: Orient Yourself**
```
Read prd.md (10 min)
Read EPICS-SUMMARY.md (20 min)
Read IMPLEMENTATION-QUICK-START.md (30 min)
```

**Step 2: Understand Your Epic**
```
Read epics/epic-007-X-{name}.md (60 min)
Review all acceptance criteria
Note database schema requirements
Review MCP tool specifications
```

**Step 3: Start Building**
```
Create database migration
Create core classes
Implement MCP tools
Write tests
```

---

## Quality Checklist

Before marking an epic complete:

- [ ] All acceptance criteria implemented
- [ ] Database migrations tested
- [ ] MCP tools working with correct interfaces
- [ ] Unit tests: ≥80% coverage
- [ ] Integration tests: full lifecycle
- [ ] Performance tests: all targets met
- [ ] Documentation updated
- [ ] Related epics notified of completion
- [ ] PRs merged
- [ ] Deployment validated

---

## Key Concepts

### Instance ID
Unique identifier for each PS/MS instance
Format: `{project}-{type}-{hash}`
Example: `odin-PS-8f4a2b`

### Event Store
Immutable log of state transitions
Enables replay, analysis, intelligent resume

### Checkpoint
Snapshot of work state at critical moments
Enables fast recovery without replaying commands

### Resume Engine
Restores PS instance by ID after disconnect
Reconstructs context from checkpoint/events/commands

### Footer
Shows instance ID in every PS response
Example: `Instance: odin-PS-8f4a2b | Epic: 003 | Context: 42% | Active: 1.2h`

---

## Success Criteria for Feature

- Session continuity system fully operational
- All 6 epics implemented and tested
- 95%+ resume success rate
- <500ms resume latency (p99)
- All PSes show instance IDs in footer
- Complete audit trail of all actions
- Zero manual intervention required
- Integration tests passing (100%)

---

## Support Resources

### For Questions About:

**Architecture & Design**
→ See: `prd.md` (sections: Architecture Overview, Technical Specifications)

**Specific Epic Details**
→ See: `epics/epic-007-X-{name}.md` (full specification)

**Implementation Guidance**
→ See: `IMPLEMENTATION-QUICK-START.md` (phase-by-phase)

**Overview of All Epics**
→ See: `EPICS-SUMMARY.md` (complete reference)

**Common Issues & Solutions**
→ See: `IMPLEMENTATION-QUICK-START.md` (Common Pitfalls section)

---

## Total Deliverables

| Document | Lines | Size | Purpose |
|----------|-------|------|---------|
| prd.md | 570 | 18KB | Master feature document |
| EPICS-SUMMARY.md | 1,547 | 15KB | All 6 epics overview |
| IMPLEMENTATION-QUICK-START.md | 1,357 | 19KB | Developer guide |
| epic-007-A | 1,073 | 36KB | Instance registry spec |
| epic-007-B | 1,119 | 32KB | Command logging spec |
| epic-007-C | 439 | 13KB | Event store spec |
| epic-007-D | 436 | 13KB | Checkpoint spec |
| epic-007-E | 475 | 14KB | Resume engine spec |
| epic-007-F | 484 | 15KB | PS integration spec |
| **TOTAL** | **7,500** | **208KB** | Complete specs |

---

## Status

**All 6 epic specifications complete and ready for implementation.**

Recommended next action:
- **Week 5**: Spawn implementation subagent for epic-007-C (Event Store)
- **Week 6**: Spawn implementation subagent for epic-007-D (Checkpoint System) - can overlap with 007-C
- **Week 8**: After 007-D, spawn epic-007-E (Resume Engine)
- **Week 10**: After 007-E, spawn epic-007-F (PS Integration)

---

**Created by**: Meta-Supervisor
**Date**: 2026-01-28
**Status**: Ready for Implementation
