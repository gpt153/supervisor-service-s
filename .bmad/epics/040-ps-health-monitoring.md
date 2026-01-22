# Epic: PS Health Monitoring System

**Epic ID:** 040
**Created:** 2026-01-22
**Status:** Planned
**Complexity Level:** 3
**Feature:** Autonomous Supervision Infrastructure

## Business Context

Project-supervisors (PSes) currently cannot monitor their own health autonomously. When subagent spawns stall or fail, PS sits idle for hours without detection. When context windows exhaust, work gets interrupted mid-task. This epic delivers an external health monitoring service that forces PS to report status every 10 minutes via tmux prompting, enabling truly autonomous long-running supervision sessions.

**Problem:** PSes are stateless and can't run monitoring loops themselves.
**Solution:** External monitor service prompts PS via tmux send-keys, forcing reactive health reporting.

## Requirements

### Phase 1: CLI Support (MVP)

**MUST HAVE:**
- [ ] Database schema for ps_sessions, active_spawns, health_checks tables
- [ ] Monitor service runs every 10 minutes (systemd timer or internal loop)
- [ ] Track all spawned subagents in active_spawns table
- [ ] Detect stalled spawns (no output file changes for 15+ minutes)
- [ ] Prompt PS for context usage via tmux send-keys
- [ ] Parse PS context responses and store in database
- [ ] Automated handoff cycle when context > 85%
- [ ] Health check audit trail with all prompts and responses
- [ ] Update spawn-subagent tool to record spawns in database
- [ ] Update PS instructions to respond to health check prompts

**SHOULD HAVE:**
- [ ] Configurable monitor interval (default 10 minutes)
- [ ] Stalled spawn auto-retry logic
- [ ] Multi-project health dashboard query
- [ ] Health check notification system (console warnings)

**WON'T HAVE (Phase 1):**
- Browser/SDK support (requires different prompting mechanism)
- ML-based spawn failure prediction
- Multi-PS coordination for handoff timing

### Phase 2: SDK/Browser Support (Future)

**Deferred to Phase 2:**
- [ ] Heuristic context tracking for browser sessions
- [ ] Manual prompting workflow documentation
- [ ] Warning system for browser PSes via database

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────┐
│  Health Monitor Service (10-min interval)               │
│  - Query active spawns from DB                          │
│  - Check spawn output files (mtime)                     │
│  - Prompt PS via tmux send-keys                         │
│  - Parse PS responses                                   │
│  - Trigger handoff when context > 85%                   │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │   tmux send-keys       │
              │   "{project}-ps"       │
              └────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  PS (running in tmux)  │
              │  - Receives prompt     │
              │  - Reports status      │
              │  - Takes action        │
              └────────────────────────┘
```

### Database Schema

**ps_sessions:**
```sql
CREATE TABLE ps_sessions (
  id SERIAL PRIMARY KEY,
  project VARCHAR(50) UNIQUE NOT NULL,
  session_type VARCHAR(10) DEFAULT 'cli',
  session_id VARCHAR(100),   -- tmux session name: {project}-ps
  started_at TIMESTAMP DEFAULT NOW(),
  last_activity TIMESTAMP DEFAULT NOW(),
  last_context_check TIMESTAMP,
  context_usage FLOAT,       -- 0.0 to 1.0
  estimated_tokens_used INT
);
```

**active_spawns:**
```sql
CREATE TABLE active_spawns (
  id SERIAL PRIMARY KEY,
  project VARCHAR(50) NOT NULL,
  task_id VARCHAR(100) NOT NULL,
  task_type VARCHAR(50),
  description TEXT,
  spawn_time TIMESTAMP DEFAULT NOW(),
  last_output_change TIMESTAMP,
  output_file TEXT,
  status VARCHAR(20) DEFAULT 'running',
  UNIQUE(project, task_id)
);
```

**health_checks:**
```sql
CREATE TABLE health_checks (
  id SERIAL PRIMARY KEY,
  project VARCHAR(50) NOT NULL,
  check_time TIMESTAMP DEFAULT NOW(),
  check_type VARCHAR(50), -- 'spawn', 'context', 'handoff'
  status VARCHAR(20),     -- 'ok', 'warning', 'critical'
  details JSONB,
  action_taken TEXT
);
```

### Context Decision Logic

| Context Usage | Behavior | Action |
|--------------|----------|--------|
| < 30% | Accept any task | Normal operation |
| 30-50% | Accept any task | Start considering handoff timing |
| 50-70% | Only small tasks | Warn before large tasks |
| 70-85% | Only tiny tasks | Prompt: "High context - consider handoff" |
| > 85% | MANDATORY handoff | Auto-trigger handoff cycle |

## Implementation Tasks

### Database (2 hours)
- [ ] Create migration: `migrations/007-ps-health-monitoring.sql`
- [ ] Define ps_sessions, active_spawns, health_checks tables
- [ ] Add indexes on project, status, check_time columns
- [ ] Test migration up/down

### Monitor Service (6 hours)
- [ ] Create `src/monitoring/ps-health-monitor.ts`
- [ ] Implement main monitoring loop (setInterval 10min)
- [ ] Query active spawns from database
- [ ] Check spawn output file modification times
- [ ] Generate appropriate prompts based on health status
- [ ] Execute tmux send-keys for each prompt
- [ ] Record all health checks in database
- [ ] Implement context threshold logic

### Spawn Tracking Integration (2 hours)
- [ ] Update `src/mcp/tools/spawn-subagent-tool.ts`
- [ ] Record spawn in active_spawns table on launch
- [ ] Include project, task_id, output_file path
- [ ] Update spawn status on completion/failure

### Prompt Generator (2 hours)
- [ ] Create `src/monitoring/prompt-generator.ts`
- [ ] Template: "Check active spawn {task_id} and provide progress update"
- [ ] Template: "Spawn {task_id} stalled (no output 15+ min) - investigate"
- [ ] Template: "Report your current context window usage from system warnings"
- [ ] Template: "Create handoff document now - context at {percentage}%"

### Context Parsing (2 hours)
- [ ] Create `src/monitoring/context-parser.ts`
- [ ] Parse PS response: "Context: 31.6% (63,153/200,000 tokens)"
- [ ] Extract percentage, used tokens, total tokens
- [ ] Update ps_sessions table with parsed data
- [ ] Handle malformed responses gracefully

### Automated Handoff (3 hours)
- [ ] Detect handoff file creation in `.bmad/handoffs/`
- [ ] Wait for file creation (poll every 30 seconds, max 5 min)
- [ ] Execute tmux send-keys: C-c to interrupt
- [ ] Execute tmux send-keys: /clear to reset context
- [ ] Execute tmux send-keys: "Read handoff from {path} and resume"
- [ ] Record handoff cycle in health_checks

### PS Instructions Update (1 hour)
- [ ] Update `.supervisor-core/05-autonomous-supervision.md`
- [ ] Add: "Respond to health check prompts immediately"
- [ ] Add: "When prompted for context, report from system warnings"
- [ ] Add: "When prompted for spawn status, check TaskOutput and report"
- [ ] Add: "Format context as: 'Context: X.X% (used/total tokens)'"
- [ ] Regenerate CLAUDE.md for all projects

### Testing (4 hours)
- [ ] Test spawn tracking records correctly
- [ ] Test stalled spawn detection (simulate 15min stall)
- [ ] Test context prompting and parsing
- [ ] Test handoff trigger at 85% context
- [ ] Test automated handoff cycle end-to-end
- [ ] Test multi-project monitoring
- [ ] Verify health check audit trail completeness

### Documentation (2 hours)
- [ ] Create `/home/samuel/sv/docs/guides/ps-health-monitoring.md`
- [ ] Document tmux session naming convention
- [ ] Document how to start monitored PS session
- [ ] Document context thresholds and behaviors
- [ ] Document handoff workflow
- [ ] Document troubleshooting (spawn stuck, context not updating)

**Estimated Effort:** 24 hours (3 days)

## Acceptance Criteria

### Core Functionality
- [ ] Monitor service runs every 10 minutes without manual intervention
- [ ] All spawned subagents tracked in active_spawns table
- [ ] Stalled spawns (no output 15+ min) detected within 10 minutes
- [ ] PS reports context usage every 10 minutes via tmux prompting
- [ ] Context usage accurately parsed and stored (matches PS system warnings)
- [ ] Automated handoff triggered when context > 85%
- [ ] Handoff cycle completes: handoff file created → context cleared → work resumed

### Reliability
- [ ] PS session runs >24 hours without context exhaustion
- [ ] Zero mid-task context interruptions (all handoffs before 90%)
- [ ] Health check audit trail records 100% of prompts and responses
- [ ] Monitor survives PS restart (re-initializes session tracking)

### Validation Tests
- [ ] Consilio PS monitored successfully for 2+ hours
- [ ] Spawn stall detected and reported within 10 minutes
- [ ] Context handoff executed automatically at 85% threshold
- [ ] Multiple projects monitored simultaneously
- [ ] Health check history queryable via SQL

## Dependencies

**Blocked By:**
- Database infrastructure (already exists)
- tmux requirement for CLI sessions (already documented)
- Subagent spawn tool (already implemented)

**External Dependencies:**
- PostgreSQL database
- tmux (required for CLI sessions)
- System warnings in Claude Code (proven functional)

**Blocks:**
- Long-running autonomous PS sessions
- Multi-epic implementation without manual supervision
- Reliable 24/7 PS operation

## Risks & Mitigations

**Risk:** tmux send-keys interrupts PS mid-thought
**Mitigation:** PS handles interruptions gracefully (context preserved in conversation history)

**Risk:** Context parsing fails if PS response format changes
**Mitigation:** Regex parser with fallback, logs malformed responses for manual review

**Risk:** Handoff file creation times out (PS doesn't create file)
**Mitigation:** 5-minute timeout with manual intervention warning

**Risk:** Monitor service crashes and doesn't restart
**Mitigation:** Systemd service with auto-restart, health check endpoint for monitoring

**Risk:** Multiple PSes handoff simultaneously (resource spike)
**Mitigation:** Phase 2 feature (multi-PS coordination), not blocking for Phase 1

## Success Metrics

**Phase 1 (CLI):**
- 100% of stalled spawns detected within 10 minutes
- 0 context exhaustion interruptions (all handoffs before 90%)
- <5 minutes from handoff trigger to context clear + resume
- PS session uptime >24 hours without manual intervention
- Health check audit trail 100% complete (no missed checks)

## Related ADRs

**To be created:**
- ADR: tmux Prompting Mechanism for PS Health Checks
- ADR: Database Schema for Health Monitoring
- ADR: Context Threshold Strategy
- ADR: Automated Handoff Cycle Design

## Notes

**Why External Monitor?**
- PSes are stateless and cannot run internal monitoring loops
- External forcing via tmux makes PS reactive (responds when prompted)
- Proven today: PS can see context usage in system warnings

**Why 10-minute interval?**
- Balance between responsiveness and noise
- Spawns rarely complete in <10 minutes
- Context grows slowly with spawn-delegation strategy

**Why 85% context threshold?**
- Provides safety margin before 90% hard limit
- Enough room for handoff creation + response
- Prevents mid-epic interruptions

**Future Enhancements (Phase 2+):**
- SDK/Browser support (different prompting mechanism)
- ML-based spawn failure prediction
- Predictive handoff timing (before hitting threshold)
- Multi-PS coordination (stagger handoffs)
- Integration with Odin for cost optimization
