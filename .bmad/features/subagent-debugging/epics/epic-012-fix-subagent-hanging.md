# Epic 012: Fix Subagent Hanging and Timeout Issues

**Status**: 🔴 NOT STARTED
**Priority**: CRITICAL
**Created**: 2026-01-23
**Epic ID**: epic-012

---

## Problem Statement

Subagents spawned by PSes frequently hang indefinitely, causing PSes to wait for hours while doing nothing. This is a critical production issue affecting all projects.

### Root Causes Identified

1. **Orphaned Processes**: Shell pipe execution (`echo | claude`) creates child processes that don't get killed on timeout
2. **Short Timeouts**: 10-minute hard limit is too short for complex implementation tasks
3. **Blocking Execution**: MCP tool blocks indefinitely waiting for subagent completion
4. **No Progress Visibility**: PS cannot check if subagent is making progress or hung

### Evidence

```bash
# 10+ Claude processes running for hours (should be killed at 10min)
PID 1812997 - Running for 137 minutes (2+ hours!)
PID 3098798 - Running for 45 minutes
PID 3151712 - Running for 70 minutes
PID 3162597 - Running for 1:33
PID 3389909 - Running for 1:08
PID 3525711 - Running for 1:46

# All orphaned (PPID = 937 = systemd)
# Timeout failed to kill them
```

---

## Success Criteria

1. ✅ **No Orphaned Processes**: All subagent processes killed cleanly on timeout
2. ✅ **Appropriate Timeouts**: Complex tasks get enough time (30min for implementation)
3. ✅ **PS Not Blocked**: PS can continue working while subagent runs
4. ✅ **Progress Visibility**: PS can check subagent status anytime
5. ✅ **Clean Failures**: Hung processes detected and killed within 5 minutes of stalling

---

## Implementation Phases

### Phase 1: Fix Orphan Process Bug (CRITICAL - Day 1)

**Goal**: Ensure timeout mechanism kills ALL child processes

**Changes**:
- Replace shell pipes with `spawn()` + stdin streaming in `ClaudeCLIAdapter.ts`
- Use `SIGKILL` instead of `SIGTERM` for timeouts
- Ensure process cleanup on timeout

**Files**:
- `src/agents/multi/ClaudeCLIAdapter.ts`
- `src/agents/multi/GeminiCLIAdapter.ts` (if it has same issue)
- `src/agents/multi/CodexCLIAdapter.ts` (if it has same issue)

**Validation**:
- Spawn test agent with 1-minute timeout
- Verify process killed at exactly 1 minute
- Verify NO orphaned processes remain (`ps aux | grep claude`)

---

### Phase 2: Increase Timeouts (CRITICAL - Day 1)

**Goal**: Give complex tasks enough time to complete

**Changes**:
- Implement tiered timeout strategy based on task type
- Research: 10 minutes (keep current)
- Planning: 15 minutes
- Implementation: 30 minutes
- Testing: 30 minutes
- Validation: 10 minutes

**Files**:
- `src/mcp/tools/spawn-subagent-tool.ts`

**Code**:
```typescript
const TIMEOUT_BY_TASK_TYPE: Record<string, number> = {
  research: 10 * 60 * 1000,      // 10 min
  planning: 15 * 60 * 1000,      // 15 min
  implementation: 30 * 60 * 1000, // 30 min
  testing: 30 * 60 * 1000,       // 30 min
  validation: 10 * 60 * 1000,    // 10 min
  documentation: 10 * 60 * 1000, // 10 min
  fix: 20 * 60 * 1000,           // 20 min
  deployment: 15 * 60 * 1000,    // 15 min
  review: 10 * 60 * 1000,        // 10 min
};

const timeout = TIMEOUT_BY_TASK_TYPE[taskType] || 10 * 60 * 1000;
```

**Validation**:
- Spawn implementation task, verify 30-minute timeout
- Spawn research task, verify 10-minute timeout

---

### Phase 3: Async Execution (HIGH PRIORITY - Week 1)

**Goal**: PS doesn't block waiting for subagent completion

**Architecture Change**:
```
CURRENT: PS → spawn() → [BLOCKS 30MIN] → result
NEW:     PS → spawn() → returns agent_id immediately
             PS → poll_status(agent_id) every 60s → check progress
             PS → get_result(agent_id) → retrieve output when done
```

**New MCP Tools**:

1. **mcp_meta_spawn_subagent** (modified)
   - Launch detached process (`spawn({ detached: true })`)
   - Record PID in database
   - Return immediately with `{ agent_id, status: 'running' }`

2. **mcp_meta_get_spawn_status** (new)
   - Check if process still running
   - Read output file for progress
   - Return `{ status: 'running'|'completed'|'failed', output_preview, elapsed_ms }`

3. **mcp_meta_cancel_spawn** (new)
   - Kill process by PID
   - Mark as 'cancelled' in database
   - Clean up output files

**Files**:
- `src/mcp/tools/spawn-subagent-tool.ts` (modify)
- `src/mcp/tools/spawn-status-tools.ts` (new)
- `src/mcp/tools/index.ts` (register new tools)

**Database Changes**:
```sql
ALTER TABLE active_spawns ADD COLUMN pid INTEGER;
ALTER TABLE active_spawns ADD COLUMN heartbeat_at TIMESTAMP;
```

**Validation**:
- Spawn 3 agents in parallel
- Poll status of all 3 concurrently
- Verify PS can continue working while agents run
- Cancel one agent mid-execution, verify clean kill

---

### Phase 4: Heartbeat Detection (MEDIUM PRIORITY - Week 2)

**Goal**: Detect hung processes that aren't making progress

**Mechanism**:
- CLI wrappers write heartbeat every 60 seconds to output file
- Status polling checks if heartbeat updated
- If no heartbeat for 10 minutes → consider stalled
- Send notification to PS to decide: kill or wait

**Files**:
- `scripts/ai/claude_wrapper.sh` (new - wraps CLI with heartbeat)
- `src/mcp/tools/spawn-status-tools.ts` (add heartbeat check)

**Validation**:
- Spawn agent that stalls (e.g., infinite loop)
- Verify heartbeat stops updating
- Verify stall detected within 10 minutes
- Verify PS notified

---

## Acceptance Criteria

### Phase 1 (MUST HAVE - Day 1)
- [ ] All timeout tests pass (no orphaned processes)
- [ ] Existing spawn workflows continue working
- [ ] No regression in success rate

### Phase 2 (MUST HAVE - Day 1)
- [ ] Tiered timeouts implemented
- [ ] Implementation tasks get 30 minutes
- [ ] Timeout config documented

### Phase 3 (SHOULD HAVE - Week 1)
- [ ] Async spawning works
- [ ] Status polling returns accurate data
- [ ] PS can monitor multiple spawns concurrently
- [ ] Cancel functionality works
- [ ] All PSes updated to use new async pattern

### Phase 4 (NICE TO HAVE - Week 2)
- [ ] Heartbeat mechanism working
- [ ] Stalled processes detected within 10 min
- [ ] PS receives stall notifications

---

## Dependencies

- PostgreSQL (active_spawns table already exists)
- Node.js spawn API
- Claude CLI, Gemini CLI, Codex CLI

---

## Rollout Plan

1. **Phase 1+2**: Deploy immediately (same day)
   - Low risk, high impact
   - Backward compatible
   - Just changes timeout behavior

2. **Phase 3**: Test in supervisor-service-s first
   - Update CLAUDE.md instructions for async pattern
   - Deploy to one PS (e.g., consilio-s)
   - Monitor for 2 days
   - Roll out to all PSes

3. **Phase 4**: Optional enhancement
   - Can be added after Phase 3 stable

---

## Testing Plan

### Unit Tests
- `ClaudeCLIAdapter.test.ts`: Timeout behavior
- `spawn-subagent-tool.test.ts`: Tiered timeouts

### Integration Tests
- Spawn agent with 1-min timeout, verify kill at exactly 1 min
- Spawn implementation task, verify 30-min timeout
- Spawn 3 agents in parallel (Phase 3), verify all complete

### Manual Testing
- Deploy to consilio-s
- Spawn implementation agent for real epic
- Monitor process list for orphans
- Verify PS can check status while agent runs

---

## Rollback Plan

**Phase 1+2**: Revert to previous ClaudeCLIAdapter.ts
**Phase 3**: Old `spawn_subagent` still works (blocking mode)
**Phase 4**: Remove heartbeat wrapper, no impact

---

## Monitoring

**Metrics to Track**:
- Orphaned process count (should be 0)
- Timeout events (how often do agents hit timeout?)
- Success rate (should stay same or improve)
- Average spawn duration (expect increase with longer timeouts)

**Alerts**:
- Orphaned processes detected → CRITICAL
- Spawn duration > 50 minutes → WARNING (might need even longer timeout)
- Stalled spawns (Phase 4) → INFO

---

## Documentation Updates

- [ ] Update `/home/samuel/sv/docs/guides/ps-workflows.md` with async spawn pattern
- [ ] Update CLAUDE.md for all PSes with new spawn instructions
- [ ] Add troubleshooting guide for hung spawns
- [ ] Document timeout values and rationale

---

## Related Issues

- Recurring user reports of "PS just waits for hours"
- Production downtime due to hung spawns
- Wasted compute time (orphaned processes running for hours)

---

## Cost/Benefit Analysis

**Cost**: 2-4 days of development
**Benefit**:
- Eliminates critical production issue
- Saves hours of wasted PS time
- Enables parallel spawn execution
- Better resource utilization

**ROI**: EXTREMELY HIGH (this is blocking all PS productivity)
