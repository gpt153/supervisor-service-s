# ADR 018: Automated Handoff Cycle Design

**Status**: Accepted
**Date**: 2026-01-22
**Deciders**: Meta-Supervisor, User (samuel)
**Context**: Epic 040 - PS Health Monitoring System

---

## Context and Problem Statement

When PS context reaches 85%, a handoff is required to prevent mid-task interruption. Manual handoff cycles require user intervention: prompt PS to create handoff, wait for completion, clear context, paste handoff to resume. This blocks autonomous operation.

**Question**: How can we automate the complete handoff cycle to enable truly autonomous 24/7 PS operation?

---

## Decision Drivers

1. **Zero Manual Intervention**: Must work without user involvement
2. **Continuity**: No lost state or work during cycle
3. **Reliability**: Must handle failures gracefully
4. **Speed**: Complete cycle in <5 minutes
5. **CLI Only (Phase 1)**: Browser sessions deferred to Phase 2

---

## Considered Options

### Option 1: Manual Handoff (Status Quo)

**Approach**: User manually triggers handoff when prompted

**Steps**:
1. User sees warning: "Context high"
2. User sends message: "Create handoff"
3. User waits for handoff file
4. User runs: `/clear`
5. User sends message: "Read handoff and resume"

**Pros**:
- Simple (no automation)
- User has full control

**Cons**:
- ❌ Requires manual intervention (blocks autonomy)
- ❌ User might not be available (PS stalls)
- ❌ Defeats purpose of autonomous supervision
- ❌ Tedious for user (every 20 epics)

**Verdict**: ❌ Rejected - Incompatible with autonomy goal

---

### Option 2: Database-Driven State Machine

**Approach**: Store handoff state in database, PS polls for state changes

**Steps**:
1. Monitor writes: `UPDATE ps_sessions SET handoff_required = true`
2. PS polls database every minute
3. PS sees flag, creates handoff
4. PS writes: `UPDATE ps_sessions SET handoff_created = true`
5. Monitor sees flag, clears context
6. Monitor writes: `UPDATE ps_sessions SET resume_from_handoff = '{path}'`
7. PS polls, sees resume flag, loads handoff

**Pros**:
- Decoupled components
- State persistence

**Cons**:
- PS cannot poll autonomously (stateless)
- Complex state machine (7+ states)
- Race conditions possible
- Still requires PS initiative (doesn't work)

**Verdict**: ❌ Rejected - PS cannot poll, defeats statelessness

---

### Option 3: Sequential tmux Prompting (SELECTED)

**Approach**: Monitor orchestrates full cycle via sequential tmux send-keys

**Steps**:
1. **Trigger**: Monitor prompts: "Create handoff document now - context at 87%"
2. **Wait**: Monitor polls for handoff file creation (max 5 min)
3. **Clear**: Monitor sends: Ctrl-C (interrupt), then `/clear` (reset context)
4. **Resume**: Monitor prompts: "Read handoff from {path} and resume work"
5. **Verify**: Monitor confirms PS resumed successfully

**Pros**:
- ✅ Fully automated (no user intervention)
- ✅ Simple linear flow (easy to debug)
- ✅ Uses proven tmux prompting mechanism
- ✅ Handles PS state transitions explicitly
- ✅ Fast (<5 min total cycle time)

**Cons**:
- CLI only (tmux dependency)
- Interrupts PS (Ctrl-C mid-response)
- File polling overhead

**Verdict**: ✅ **SELECTED** - Optimal for autonomous CLI operation

---

### Option 4: API-Based Conversation Injection

**Approach**: Use Claude API to inject handoff prompt mid-conversation

**Pros**:
- Could work for browser sessions
- No tmux dependency

**Cons**:
- Claude API may not support message injection
- Unknown feasibility (requires research)
- Complex authentication
- Not available for CLI sessions

**Verdict**: ❌ Rejected for Phase 1 - Deferred to Phase 2 browser support

---

## Decision

**We will automate handoff cycle using sequential tmux prompting.**

---

## Implementation

### Step 1: Trigger Handoff

**Condition**: `context_usage >= 0.85`

**Action**:
```bash
tmux send-keys -t "{project}-ps" "Create handoff document now - context at ${percentage}%" Enter
```

**Expected PS Behavior**:
- PS creates handoff file: `.bmad/handoffs/handoff-YYYY-MM-DD-HH-MM.md`
- Handoff contains: current epic, progress, next steps, critical state

**Timeout**: 5 minutes (if no file created, log error and retry later)

---

### Step 2: Wait for Handoff Creation

**Polling Logic**:
```typescript
async function waitForHandoff(
  project: string,
  options: { timeout: number } = { timeout: 300000 }
): Promise<string | null> {
  const handoffDir = `/home/samuel/sv/${project}/.bmad/handoffs/`;
  const startTime = Date.now();

  while (Date.now() - startTime < options.timeout) {
    // Find most recent handoff file
    const files = await fs.readdir(handoffDir);
    const handoffFiles = files
      .filter(f => f.startsWith('handoff-'))
      .sort()
      .reverse();

    if (handoffFiles.length > 0) {
      const latestFile = path.join(handoffDir, handoffFiles[0]);
      const stat = await fs.stat(latestFile);

      // Check if file was created in last 5 minutes
      if (Date.now() - stat.mtimeMs < 300000) {
        return latestFile;
      }
    }

    // Wait 30 seconds before next check
    await new Promise(resolve => setTimeout(resolve, 30000));
  }

  // Timeout - handoff not created
  return null;
}
```

**Error Handling**:
- If timeout: Log critical error, notify user, abort cycle
- If PS fails to create handoff: Retry once, then manual intervention

---

### Step 3: Clear Context

**Goal**: Interrupt current PS response and reset context

**Commands**:
```bash
# Interrupt current response (if any)
tmux send-keys -t "{project}-ps" C-c

# Wait 2 seconds for graceful stop
sleep 2

# Clear context via Claude Code /clear command
tmux send-keys -t "{project}-ps" "/clear" Enter

# Wait 3 seconds for context to clear
sleep 3
```

**Risks**:
- Ctrl-C might interrupt mid-critical-operation
  - Mitigation: PS state preserved in handoff, safe to interrupt
- /clear might fail
  - Mitigation: Verify via next prompt response, retry if needed

---

### Step 4: Resume from Handoff

**Goal**: Load handoff and continue work

**Command**:
```bash
tmux send-keys -t "{project}-ps" "Read handoff from ${handoff_path} and resume work" Enter
```

**Expected PS Behavior**:
- PS reads handoff file
- PS understands current state (epic, progress, next steps)
- PS continues work from where it left off

**Verification**:
- PS should respond with: "Resuming work from handoff..."
- PS should continue with next task from handoff

---

### Step 5: Verify Resume

**Check**: Monitor sends status prompt 1 minute after resume

**Command**:
```bash
sleep 60
tmux send-keys -t "{project}-ps" "Confirm you have resumed work from handoff" Enter
```

**Expected Response**:
- PS confirms handoff loaded
- PS reports current task

**Error Handling**:
- If no response: Manual intervention required
- If PS confused: Log error, consider second clear+resume cycle

---

## Complete Cycle Implementation

```typescript
async function executeHandoffCycle(project: string, context_percentage: number): Promise<boolean> {
  try {
    // Step 1: Trigger handoff
    console.log(`[${project}] Triggering handoff (context: ${context_percentage}%)`);
    await tmuxSendKeys(
      `${project}-ps`,
      `Create handoff document now - context at ${Math.round(context_percentage * 100)}%`
    );

    // Step 2: Wait for handoff creation
    console.log(`[${project}] Waiting for handoff file...`);
    const handoffPath = await waitForHandoff(project, { timeout: 300000 });

    if (!handoffPath) {
      console.error(`[${project}] Handoff timeout - file not created in 5 minutes`);
      await recordHealthCheck({
        project,
        check_type: 'handoff',
        status: 'critical',
        details: { error: 'handoff_timeout' },
        action_taken: 'Manual intervention required'
      });
      return false;
    }

    console.log(`[${project}] Handoff created: ${handoffPath}`);

    // Step 3: Clear context
    console.log(`[${project}] Clearing context...`);
    await tmuxSendKeys(`${project}-ps`, 'C-c'); // Interrupt
    await sleep(2000);
    await tmuxSendKeys(`${project}-ps`, '/clear'); // Clear
    await sleep(3000);

    // Step 4: Resume from handoff
    console.log(`[${project}] Resuming from handoff...`);
    await tmuxSendKeys(
      `${project}-ps`,
      `Read handoff from ${handoffPath} and resume work`
    );

    // Step 5: Verify resume
    await sleep(60000); // Wait 1 minute
    await tmuxSendKeys(`${project}-ps`, 'Confirm you have resumed work from handoff');

    // Record successful handoff
    await recordHealthCheck({
      project,
      check_type: 'handoff',
      status: 'ok',
      details: {
        context_at_trigger: context_percentage,
        handoff_file: handoffPath,
        cycle_duration_ms: Date.now() - startTime
      },
      action_taken: 'Automated handoff cycle completed successfully'
    });

    // Reset context tracking
    await pool.query(
      `UPDATE ps_sessions
       SET context_usage = 0.0, estimated_tokens_used = 0, last_context_check = NOW()
       WHERE project = $1`,
      [project]
    );

    console.log(`[${project}] Handoff cycle completed successfully`);
    return true;

  } catch (error) {
    console.error(`[${project}] Handoff cycle failed:`, error);
    await recordHealthCheck({
      project,
      check_type: 'handoff',
      status: 'critical',
      details: { error: error.message },
      action_taken: 'Manual intervention required'
    });
    return false;
  }
}
```

---

## Handoff File Format

**Location**: `.bmad/handoffs/handoff-YYYY-MM-DD-HH-MM.md`

**Required Sections**:
```markdown
# Handoff Document

**Created**: 2026-01-22 14:30:00
**Context Usage**: 87%
**Project**: consilio

## Current Work

**Active Epic**: Epic 003 - Authentication System
**Progress**: 65% complete
**Current Task**: Implementing JWT refresh tokens

## Completed Since Last Handoff

- [ ] Created database migration for refresh_tokens table
- [ ] Implemented token generation logic
- [ ] Added token validation middleware

## Next Steps

1. Complete JWT refresh endpoint
2. Add token rotation logic
3. Write tests for token refresh
4. Update API documentation

## Critical State

- Database schema updated (migration 005 applied)
- Environment variables: JWT_SECRET, REFRESH_TOKEN_EXPIRY set
- Active spawns: None

## Blockers / Issues

- None

## Notes

- Refresh token expiry set to 30 days
- Access token expiry remains 1 hour
```

---

## Consequences

### Positive

- **Autonomous Operation**: PS sessions run 24/7 without manual intervention
- **Fast Cycle**: <5 minutes from trigger to resume
- **Continuity**: No lost state (handoff preserves everything)
- **Reliability**: Simple linear flow, easy to debug
- **Scalability**: Works for all CLI-based PS sessions simultaneously

### Negative

- **CLI Only**: Doesn't work for browser sessions (Phase 2)
- **File Polling**: Overhead from checking handoff directory
- **Interruption**: Ctrl-C could interrupt PS mid-thought (rare)
- **Timeout Risk**: If PS fails to create handoff, cycle fails

### Neutral

- User sees handoff files accumulate in `.bmad/handoffs/`
- Handoff creation varies (1-3 minutes typical)
- Monitor logs all handoff cycles for debugging

---

## Error Scenarios and Recovery

### Error: Handoff File Not Created

**Detection**: Timeout after 5 minutes
**Recovery**:
1. Log critical error
2. Record in health_checks
3. Retry once (send prompt again)
4. If second timeout: Manual intervention required

### Error: /clear Command Fails

**Detection**: Next prompt shows old context
**Recovery**:
1. Retry /clear command
2. Verify via system warnings
3. If still failing: Manual session restart required

### Error: PS Fails to Resume from Handoff

**Detection**: Verification prompt gets confused response
**Recovery**:
1. Retry resume prompt
2. Check handoff file validity
3. If still failing: Manual intervention

### Error: Multiple Handoffs in 1 Hour

**Detection**: Track handoff frequency
**Recovery**:
1. Log warning (context growing too fast)
2. Investigate context leak (bug in spawn tracking?)
3. Increase handoff threshold temporarily

---

## Testing Strategy

**Unit Tests**:
- `waitForHandoff()` with mock file system
- `executeHandoffCycle()` with mock tmux
- Handoff file parsing

**Integration Tests**:
- Real PS session handoff cycle end-to-end
- Timeout scenarios (no file created)
- Rapid context growth (multiple handoffs)
- Multi-project handoffs simultaneously

**Manual Tests**:
- Trigger handoff at exactly 85%
- Interrupt PS mid-response (Ctrl-C safety)
- Verify work continuity after handoff
- Test with 3+ projects simultaneously

---

## Future Enhancements (Phase 2+)

**Browser Session Support**:
- Investigate Claude API conversation forking
- Manual workflow documentation (user-triggered handoff)
- Browser extension for automated handoff?

**Optimizations**:
- Parallel handoff (don't wait 5 min if file appears in 30 sec)
- Intelligent retry (exponential backoff on timeout)
- Context compression (remove old summaries before handoff)

**Smart Timing**:
- Handoff between epics (not mid-epic)
- Multi-PS coordination (stagger handoffs)
- Predictive handoff (before hitting 85%)

---

## References

- Epic 040: PS Health Monitoring System
- ADR 015: tmux Prompting Mechanism
- ADR 017: Context Threshold Strategy
- Handoff instruction templates (.supervisor-core/05-autonomous-supervision.md)
