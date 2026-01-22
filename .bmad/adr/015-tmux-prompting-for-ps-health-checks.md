# ADR 015: tmux Prompting Mechanism for PS Health Checks

**Status**: Accepted
**Date**: 2026-01-22
**Deciders**: Meta-Supervisor, User (samuel)
**Context**: Epic 040 - PS Health Monitoring System

---

## Context and Problem Statement

Project-Supervisors (PS) cannot autonomously monitor their own health because they are stateless AI agents that cannot run internal monitoring loops. When subagent spawns stall or context windows exhaust, PS sits idle without detecting the problem.

**Question**: How do we force a stateless PS to proactively report health status?

---

## Decision Drivers

1. **Statelessness Constraint**: PS cannot run background loops or timers
2. **Reactivity Requirement**: PS must respond when prompted
3. **Non-Intrusive**: Prompting should not interrupt critical work
4. **Reliability**: Prompting mechanism must work 100% of the time
5. **Simplicity**: No complex infrastructure or external services

---

## Considered Options

### Option 1: Instruct PS to Self-Monitor (Status Quo)

**Approach**: Add instructions like "Check every 10 minutes for spawn status"

**Pros**:
- No new infrastructure needed
- Simple documentation change

**Cons**:
- PS never follows these instructions (proven through repeated attempts)
- Stateless agents cannot run loops
- Relies on PS initiative (doesn't work)

**Verdict**: ❌ Rejected - Proven to fail in practice

---

### Option 2: Webhook-Based Prompting

**Approach**: External service sends HTTP requests to Claude API to inject messages into conversation

**Pros**:
- Could work for browser sessions (SDK)
- Centralized prompting service

**Cons**:
- Claude API may not support message injection to existing conversations
- Complex authentication and session management
- Not supported for CLI sessions
- Unknown feasibility (requires API research)

**Verdict**: ❌ Rejected for Phase 1 - Too complex, unclear feasibility

---

### Option 3: File-Based Signaling

**Approach**: Monitor service writes files to watched directory, PS polls directory

**Pros**:
- Works for CLI and SDK
- No tmux dependency

**Cons**:
- PS still cannot poll autonomously (stateless)
- Requires PS to check files proactively (doesn't work)
- Same fundamental problem as Option 1

**Verdict**: ❌ Rejected - Doesn't solve statelessness constraint

---

### Option 4: tmux send-keys Prompting (SELECTED)

**Approach**: External monitor service sends prompts directly to PS via tmux send-keys

```bash
tmux send-keys -t "{project}-ps" "{prompt}" Enter
```

**Pros**:
- ✅ Forces PS to react (prompt appears as user input)
- ✅ Works immediately in CLI sessions
- ✅ 100% reliable (tmux guarantees delivery)
- ✅ Simple implementation (single bash command)
- ✅ No PS cooperation required (external forcing)
- ✅ Preserves conversation context (normal user input)

**Cons**:
- Only works for CLI sessions (not browser/SDK)
- Requires named tmux sessions
- Could interrupt PS mid-response (rare, handled gracefully)

**Verdict**: ✅ **SELECTED** - Optimal for CLI Phase 1

---

## Decision

**We will use tmux send-keys to prompt PS for health checks.**

### Implementation

**Session Naming Convention**:
```bash
# Format: {project}-ps
tmux new -s consilio-ps
tmux new -s odin-ps
tmux new -s supervisor-ps
```

**Prompting Command**:
```bash
tmux send-keys -t "{project}-ps" "{prompt}" Enter
```

**Prompt Examples**:
- "Check active spawn status and provide brief progress update"
- "Spawn task-123 has not produced output for 15+ minutes. Investigate and report."
- "Report your current context window usage from system warnings"
- "Create handoff document now - context at 87%"

---

## Consequences

### Positive

- **Guaranteed Delivery**: tmux ensures prompts reach PS 100% reliably
- **Zero PS Changes**: PS doesn't need new capabilities, just reacts to normal input
- **Conversation Context Preserved**: Prompts appear as user messages, maintain thread
- **Simple Infrastructure**: One bash command, no APIs or services
- **Proven Technology**: tmux is stable and well-understood

### Negative

- **CLI Only**: Doesn't work for browser/SDK sessions (deferred to Phase 2)
- **tmux Dependency**: Requires PS runs in named tmux sessions
- **User Interference Risk**: User might manually send conflicting commands
- **Interrupt Risk**: Could interrupt PS mid-response (handled gracefully by Claude)

### Neutral

- PS instructions updated to respond immediately to health check prompts
- User must follow tmux session naming convention
- Monitor service requires tmux access on same host as PS

---

## Validation

**Test Plan**:
- [ ] Start PS in tmux session: `tmux new -s test-ps`
- [ ] Send prompt via tmux: `tmux send-keys -t "test-ps" "Report status" Enter`
- [ ] Verify PS receives and responds to prompt
- [ ] Test interruption mid-response (PS handles gracefully)
- [ ] Test multiple prompts in sequence
- [ ] Test prompting multiple projects simultaneously

**Success Criteria**:
- 100% prompt delivery rate
- PS responds within 30 seconds of prompt
- Conversation context preserved across prompts
- No PS crashes or errors from prompting

---

## Future Considerations

**Phase 2 (Browser/SDK Support)**:
- Investigate Claude API message injection capabilities
- Consider webhook-based prompting for browser sessions
- Heuristic context tracking as fallback for browser PSes

**Optimizations**:
- Rate limiting (max 1 prompt per 5 minutes per project)
- Prompt batching (combine multiple health checks into one prompt)
- Smart scheduling (don't prompt if PS actively responding)

---

## References

- Epic 040: PS Health Monitoring System
- `.bmad/feature-requests/ps-health-monitoring.md`
- tmux documentation: https://github.com/tmux/tmux/wiki
- Proven today: PS can see system warnings with context usage
