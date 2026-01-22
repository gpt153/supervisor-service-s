# ADR 017: Context Threshold Strategy

**Status**: Accepted
**Date**: 2026-01-22
**Deciders**: Meta-Supervisor, User (samuel)
**Context**: Epic 040 - PS Health Monitoring System

---

## Context and Problem Statement

PS sessions have a 200K token context window. When context exhausts mid-task, work gets interrupted and state is lost. We need a strategy for monitoring context usage and triggering handoffs before exhaustion occurs.

**Question**: At what context thresholds should we take which actions to prevent mid-task interruptions?

---

## Decision Drivers

1. **Prevent Interruptions**: Never exhaust context mid-epic
2. **Maximize Continuity**: Delay handoff as long as safe
3. **Safety Margin**: Account for uncertainty in estimates
4. **User Experience**: Minimal handoff overhead
5. **Spawn-Delegation Impact**: PSes now delegate most work, context grows slower

---

## Considered Options

### Option 1: Fixed 50% Handoff Threshold

**Approach**: Trigger handoff when context reaches 50%

**Pros**:
- Safe margin (50% buffer)
- Simple rule

**Cons**:
- Wastes 50% of available context
- Frequent handoffs (3-5 epics per session)
- Poor UX (constant interruptions)
- Doesn't account for spawn delegation

**Verdict**: ❌ Rejected - Too conservative, poor UX

---

### Option 2: Fixed 90% Handoff Threshold

**Approach**: Trigger handoff when context reaches 90%

**Pros**:
- Maximizes context utilization
- Fewer handoffs

**Cons**:
- High risk of exhaustion mid-task
- Handoff creation itself uses context (could hit 100%)
- No safety margin for unexpected spikes
- Dangerous with spawn delegation (PS may spawn multiple agents at once)

**Verdict**: ❌ Rejected - Too risky, insufficient safety margin

---

### Option 3: Graduated Thresholds with Progressive Restrictions (SELECTED)

**Approach**: Multiple thresholds with increasing restrictions

| Context | Behavior | Action |
|---------|----------|--------|
| < 30% | Accept any task | Normal operation |
| 30-50% | Accept any task | Monitor, log |
| 50-70% | Only small tasks | Warn before large tasks |
| 70-85% | Only tiny tasks | Prompt: "High context - consider handoff" |
| > 85% | MANDATORY handoff | Auto-trigger handoff cycle |

**Pros**:
- ✅ Progressive warnings (user awareness)
- ✅ Safety margin (15% buffer at trigger)
- ✅ Balances utilization and safety
- ✅ Accounts for spawn delegation
- ✅ Prevents mid-epic interruptions

**Cons**:
- More complex logic
- PS needs to classify task size (small/large)
- Threshold tuning needed based on real usage

**Verdict**: ✅ **SELECTED** - Best balance of safety and utilization

---

### Option 4: Predictive Handoff Based on Epic Size

**Approach**: Estimate epic token cost, handoff if remaining context insufficient

**Pros**:
- Intelligent planning
- Optimizes handoff timing per epic

**Cons**:
- Requires accurate epic size estimation (hard)
- Complex implementation
- Epic size varies widely (unpredictable)
- Over-engineering for Phase 1

**Verdict**: ❌ Rejected for Phase 1 - Too complex, defer to Phase 2

---

## Decision

**We will use graduated thresholds with 85% as the mandatory handoff trigger.**

### Threshold Definitions

#### Zone 1: Normal Operation (< 30%)
- **Behavior**: Accept all tasks without restriction
- **Action**: None
- **Reasoning**: Plenty of context available, no risk

#### Zone 2: Monitoring Phase (30-50%)
- **Behavior**: Accept all tasks, start logging context
- **Action**: Record context in health_checks with status 'ok'
- **Reasoning**: Awareness building, no restrictions yet

#### Zone 3: Warning Phase (50-70%)
- **Behavior**: Only accept small tasks (<5K estimated tokens)
- **Action**: Warn PS before large tasks: "Context at 65%, complete large tasks after handoff"
- **Reasoning**: Prevent large tasks from causing exhaustion, create handoff window

#### Zone 4: Critical Phase (70-85%)
- **Behavior**: Only accept tiny tasks (<2K estimated tokens)
- **Action**: Prompt PS every 10min: "High context at 75% - create handoff after current work"
- **Reasoning**: Strong warning, prepare for imminent handoff

#### Zone 5: Mandatory Handoff (> 85%)
- **Behavior**: Reject new work, create handoff immediately
- **Action**: Auto-trigger handoff cycle, clear context after handoff created
- **Reasoning**: 15% safety margin for handoff creation + resume

---

## Implementation Details

### Context Tracking

**Source**: System warnings in Claude Code
```
<system-reminder>Token usage: 63153/200000; 136847 remaining</system-reminder>
```

**Parsing**:
```typescript
const parseContext = (response: string): ContextData | null => {
  const match = response.match(/Context:\s+(\d+\.?\d*)%\s+\((\d+)\/(\d+)\s+tokens\)/);
  if (!match) return null;

  return {
    percentage: parseFloat(match[1]) / 100,
    used: parseInt(match[2]),
    total: parseInt(match[3]),
    remaining: parseInt(match[3]) - parseInt(match[2])
  };
};
```

### Threshold Actions

**30-50% (Monitoring)**:
```typescript
if (context.percentage >= 0.30 && context.percentage < 0.50) {
  await recordHealthCheck({
    project,
    check_type: 'context',
    status: 'ok',
    details: { context_usage: context.percentage }
  });
}
```

**50-70% (Warning)**:
```typescript
if (context.percentage >= 0.50 && context.percentage < 0.70) {
  await recordHealthCheck({
    project,
    check_type: 'context',
    status: 'warning',
    details: { context_usage: context.percentage }
  });
  // PS instructions handle this (warn before large tasks)
}
```

**70-85% (Critical)**:
```typescript
if (context.percentage >= 0.70 && context.percentage < 0.85) {
  await promptPS(
    project,
    `High context usage: ${Math.round(context.percentage * 100)}% - create handoff after current work`
  );
  await recordHealthCheck({
    project,
    check_type: 'context',
    status: 'critical',
    details: { context_usage: context.percentage }
  });
}
```

**> 85% (Mandatory Handoff)**:
```typescript
if (context.percentage >= 0.85) {
  await promptPS(
    project,
    `Create handoff document now - context at ${Math.round(context.percentage * 100)}%`
  );

  // Wait for handoff file creation
  await waitForHandoff(project, { timeout: 300000 }); // 5 min

  // Clear context
  await clearContext(project);

  // Resume from handoff
  await promptPS(
    project,
    `Read handoff from .bmad/handoffs/handoff-${timestamp}.md and resume work`
  );

  await recordHealthCheck({
    project,
    check_type: 'handoff',
    status: 'critical',
    details: { context_usage: context.percentage, handoff_triggered: true }
  });
}
```

---

## Rationale for 85% Threshold

**Why 85% and not 90%?**

1. **Handoff Creation Cost**: Creating handoff uses 3-5K tokens (~2.5%)
2. **PS Response Cost**: PS response to prompt uses 1-2K tokens (~1%)
3. **Buffer for Variation**: System warnings update every few messages (~2%)
4. **Resume Cost**: Loading handoff and resuming uses 3-5K tokens (~2.5%)
5. **Safety Margin**: Unexpected context spikes (multi-file reads, etc.)

**Total Safety Margin**: ~15% provides comfortable buffer

**Example**:
- Context at 85%: 170K used, 30K remaining
- Handoff creation: 4K tokens → 174K used
- Resume: 4K tokens → 178K used
- Remaining: 22K tokens (11% buffer for work)

---

## Spawn Delegation Impact

**Key Insight**: PSes now delegate most execution work to subagents via `mcp_meta_spawn_subagent`

**Context Growth Before Delegation**:
- PS writes code directly: ~500 tokens/min
- PS exhausts context in ~6-8 hours (3-5 epics)

**Context Growth With Delegation**:
- PS spawns agents: ~50 tokens/min (10x slower)
- PS exhausts context in ~60-80 hours (20-30 epics)

**Impact on Thresholds**:
- ✅ More time in each zone (slower progression)
- ✅ Fewer handoffs needed (days instead of hours)
- ✅ Better warning coverage (zone transitions more visible)

---

## Consequences

### Positive

- **No Mid-Task Interruptions**: 15% safety margin prevents exhaustion
- **Long Session Life**: Spawn delegation + 85% threshold = 20-30 epics per session
- **Progressive Warnings**: User awareness builds gradually
- **Flexible**: Easy to tune thresholds based on real data
- **Safe Defaults**: Conservative enough for unpredictable context spikes

### Negative

- **Some Context Unused**: 15% buffer means ~30K tokens never used per session
- **Complexity**: More zones than simple threshold
- **Tuning Required**: May need adjustment based on real usage patterns

### Neutral

- PS must follow zone restrictions (enforced via instructions)
- User sees handoff cycle occasionally (every 20-30 epics)
- Monitor checks context every 10 minutes (may miss rapid spikes)

---

## Validation Plan

**Metrics to Track**:
- Context exhaustion rate (target: 0%)
- Handoffs per session (target: <1 per 20 epics)
- False positive handoffs (triggered but <90% actual usage)
- Zone transition frequency
- Average context at handoff trigger

**Test Scenarios**:
- Simulate gradual context growth (normal operation)
- Simulate rapid context spike (multi-file reads)
- Test handoff at exactly 85%
- Test handoff creation failure (timeout)
- Test multiple projects hitting threshold simultaneously

**Success Criteria**:
- 0 context exhaustion incidents in 30 days
- >90% of handoffs occur between 85-90%
- <5 minutes average handoff cycle time
- No lost work during handoff cycles

---

## Future Considerations

**Phase 2 Enhancements**:
- Predictive handoff (ML model based on epic size)
- Dynamic thresholds (adjust based on spawn activity)
- Multi-PS coordination (stagger handoffs across projects)
- Context compression (remove old summaries before handoff)

**Threshold Tuning**:
- Collect 30 days of context growth data
- Analyze zone transitions and handoff triggers
- Adjust thresholds if needed (e.g., 80% or 90%)
- Consider per-project thresholds (different workloads)

---

## References

- Epic 040: PS Health Monitoring System
- ADR 015: tmux Prompting Mechanism
- ADR 016: Database Schema for Health Monitoring
- Claude Code system warnings documentation
- Spawn delegation impact analysis (PRD-PS-Delegation-Enforcement.md)
