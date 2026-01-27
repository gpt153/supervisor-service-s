# PIV Per-Step Spawning Design

**Date**: 2026-01-24
**Status**: Implementation Ready

---

## Problem Statement

**Current architecture**: PS spawns one PIV agent that runs all phases internally (Prime → Plan → Execute as one monolithic loop)

**Issues**:
- If any phase hangs, entire PIV loop stalls
- PS has no control between phases
- Cannot restart individual phases
- Cannot validate partial progress
- User waits indefinitely with no visibility

**User request**: "break up multi-step subagents. so instead of ps spawning one piv-loop agent it spawns one for each step, that way ps has more control and if one hangs ps can just restart it."

---

## New Architecture

### High-Level Flow

```
PS Session
  ↓
1. Spawn Prime agent → wait → parse results → validate
  ↓
2. Spawn Plan agent (with Prime results) → wait → parse plan → validate
  ↓
3. Spawn Execute agent (with Plan) → wait → validate → check acceptance criteria
  ↓
4. Create PR, report complete
```

### Benefits

✅ **Granular control**: PS monitors each phase separately
✅ **Restart capability**: Hung phase can be restarted without redoing previous work
✅ **Progress visibility**: PS sees which phase is running
✅ **Timeout detection**: PS can timeout individual phases (e.g., 30 min max)
✅ **Partial recovery**: If Execute fails, can retry without re-running Prime/Plan

---

## Implementation Strategy

### Option 1: Modify PIV Loop Tool (Recommended)

**Add a new parameter to `mcp_meta_start_piv_loop`**:

```typescript
mcp_meta_start_piv_loop({
  epicId: "epic-006",
  mode: "per-step",  // NEW: "monolithic" or "per-step"
  ...
})
```

**When mode = "per-step"**:
- Tool spawns Prime agent via `mcp_meta_spawn_subagent`
- Waits for Prime to complete
- Spawns Plan agent with Prime results
- Waits for Plan to complete
- Spawns Execute agent with Plan
- Waits for Execute to complete
- Returns final result

**Advantages**:
- Backward compatible (default to monolithic)
- PS just calls one tool, tool handles orchestration
- Keeps complexity in meta-supervisor

**Disadvantages**:
- Still blocks PS (but with better monitoring)

---

### Option 2: Expose Individual Phase Tools (More Control)

**Create three new MCP tools**:

```typescript
mcp_meta_run_prime({ epicId, projectName, projectPath })
mcp_meta_run_plan({ epicId, contextPath })
mcp_meta_run_execute({ epicId, planPath })
```

**PS orchestrates directly**:

```
1. Call mcp_meta_run_prime
2. Monitor progress, detect timeout
3. Call mcp_meta_run_plan with Prime results
4. Monitor progress, detect timeout
5. Call mcp_meta_run_execute with Plan results
6. Monitor, validate acceptance criteria
```

**Advantages**:
- Maximum PS control
- PS can implement custom retry logic
- PS can monitor actively between phases
- PS can skip phases if needed

**Disadvantages**:
- More complexity in PS instructions
- PS must understand PIV flow

---

### Option 3: Hybrid Approach (RECOMMENDED)

**Implement both**:

1. **Keep existing `mcp_meta_start_piv_loop`** with `mode` parameter
2. **Add individual phase tools** for advanced use

**Default workflow** (simple):
```typescript
// PS just calls this
mcp_meta_start_piv_loop({ epicId, mode: "per-step" })

// Tool internally:
// - Spawns Prime via mcp_meta_spawn_subagent
// - Waits, validates
// - Spawns Plan via mcp_meta_spawn_subagent
// - Waits, validates
// - Spawns Execute via mcp_meta_spawn_subagent
// - Returns final result
```

**Advanced workflow** (PS wants full control):
```typescript
// PS orchestrates manually
const primeResult = await mcp_meta_run_prime({ epicId })
const planResult = await mcp_meta_run_plan({ epicId, contextPath: primeResult.contextPath })
const executeResult = await mcp_meta_run_execute({ epicId, planPath: planResult.planPath })
```

**This gives both simplicity AND control.**

---

## Implementation Plan

### Phase 1: Update Spawn Tool (2 hours)

**Modify `/src/mcp/tools/spawn-subagent-tool.ts`**:

Add support for PIV phase task types:
- `task_type: "piv-prime"`
- `task_type: "piv-plan"`
- `task_type: "piv-execute"`

These automatically select correct subagent templates:
- `piv-prime` → `.claude/commands/subagents/prime-research.md`
- `piv-plan` → `.claude/commands/subagents/plan-implementation.md`
- `piv-execute` → `.claude/commands/subagents/implement-feature.md`

---

### Phase 2: Create PIV Orchestrator (3 hours)

**New file**: `/src/mcp/tools/piv-orchestrator-tool.ts`

```typescript
export const pivOrchestratorTool: ToolDefinition = {
  name: 'mcp_meta_run_piv_per_step',
  description: 'Run PIV loop with per-step spawning for granular control',
  handler: async (params) => {
    const { epicId, projectName, projectPath } = params;

    // Step 1: Spawn Prime agent
    console.log('[PIV] Spawning Prime agent...');
    const primeResult = await spawnSubagent({
      task_type: 'piv-prime',
      description: `Research codebase for epic ${epicId}`,
      context: { epic_id: epicId, project_path: projectPath }
    });

    if (!primeResult.success) {
      return { success: false, phase: 'prime', error: primeResult.error };
    }

    // Step 2: Spawn Plan agent
    console.log('[PIV] Spawning Plan agent...');
    const planResult = await spawnSubagent({
      task_type: 'piv-plan',
      description: `Create implementation plan for epic ${epicId}`,
      context: {
        epic_id: epicId,
        context_path: primeResult.context_path
      }
    });

    if (!planResult.success) {
      return { success: false, phase: 'plan', error: planResult.error };
    }

    // Step 3: Spawn Execute agent
    console.log('[PIV] Spawning Execute agent...');
    const executeResult = await spawnSubagent({
      task_type: 'piv-execute',
      description: `Implement epic ${epicId} following plan`,
      context: {
        epic_id: epicId,
        plan_path: planResult.plan_path
      }
    });

    if (!executeResult.success) {
      return { success: false, phase: 'execute', error: executeResult.error };
    }

    return {
      success: true,
      prime: primeResult,
      plan: planResult,
      execute: executeResult
    };
  }
};
```

---

### Phase 3: Create Individual Phase Tools (2 hours)

**New file**: `/src/mcp/tools/piv-phase-tools.ts`

```typescript
export const runPrimeTool: ToolDefinition = {
  name: 'mcp_meta_run_prime',
  description: 'Run only the Prime phase (research)',
  handler: async (params) => {
    return await spawnSubagent({
      task_type: 'piv-prime',
      description: `Research codebase for epic ${params.epicId}`,
      context: params
    });
  }
};

export const runPlanTool: ToolDefinition = {
  name: 'mcp_meta_run_plan',
  description: 'Run only the Plan phase (requires Prime results)',
  handler: async (params) => {
    return await spawnSubagent({
      task_type: 'piv-plan',
      description: `Create implementation plan for epic ${params.epicId}`,
      context: params
    });
  }
};

export const runExecuteTool: ToolDefinition = {
  name: 'mcp_meta_run_execute',
  description: 'Run only the Execute phase (requires Plan results)',
  handler: async (params) => {
    return await spawnSubagent({
      task_type: 'piv-execute',
      description: `Implement epic ${params.epicId} following plan`,
      context: params
    });
  }
};
```

---

### Phase 4: Update Subagent Templates (1 hour)

**Modify templates to emphasize CODE MODIFICATION**:

**`prime-research.md`** (already correct - research only)
- No changes needed

**`plan-implementation.md`** (already correct - planning only)
- No changes needed

**`implement-feature.md`** (CRITICAL - emphasize CODE not DOCS):

```markdown
# CRITICAL: You MUST Write Actual Code

**YOU ARE IMPLEMENTING, NOT PLANNING OR DOCUMENTING.**

## SUCCESS = Code Committed to Git

**Your task is complete ONLY when:**
1. ✅ Source code files modified/created
2. ✅ Tests written and passing
3. ✅ Changes committed to git
4. ✅ Validation commands pass

## FAILURE = Only Docs/Design

**You have FAILED if:**
- ❌ Only documentation written
- ❌ Only design/planning done
- ❌ No git commits made
- ❌ Only config files created without actual code

## Your Task

{{TASK_DESCRIPTION}}

## Implementation Checklist

**Before claiming completion, verify:**
1. [ ] Actual code files modified (not just docs)
2. [ ] Tests written
3. [ ] Validations run and pass
4. [ ] Git commit created
5. [ ] No "TODO" or "placeholder" comments

**If you only created docs/plans, you FAILED the task.**
```

---

### Phase 5: Add Timeout and Retry Logic (2 hours)

**In PIV orchestrator**, add timeout per phase:

```typescript
const PHASE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

async function spawnWithTimeout(params, timeoutMs) {
  return Promise.race([
    spawnSubagent(params),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeoutMs)
    )
  ]);
}

// In orchestrator:
try {
  const primeResult = await spawnWithTimeout({
    task_type: 'piv-prime',
    ...
  }, PHASE_TIMEOUT_MS);
} catch (error) {
  if (error.message === 'Timeout') {
    // Retry once
    const retryResult = await spawnWithTimeout(...);
  }
}
```

---

## Testing Plan

### Test 1: Simple Epic End-to-End

```bash
# Create test epic
cat > /home/samuel/sv/.bmad/epics/test-epic-001.md << 'EOF'
---
id: test-epic-001
title: Add Hello World Function
description: Create a simple hello() function that returns "Hello, World!"
acceptanceCriteria:
  - Function hello() exists
  - Function returns "Hello, World!"
  - Tests pass
---
EOF

# Run per-step PIV
mcp_meta_run_piv_per_step({
  epicId: "test-epic-001",
  projectName: "supervisor-service-s",
  projectPath: "/home/samuel/sv/supervisor-service-s"
})

# Verify:
# - Prime created context file
# - Plan created implementation plan
# - Execute created actual code + tests
# - Git commit exists
```

### Test 2: Hung Phase Recovery

```bash
# Simulate hung Execute phase
# (manually kill agent mid-execution)

# Restart just Execute phase
mcp_meta_run_execute({
  epicId: "test-epic-001",
  planPath: ".agents/plans/test-epic-001.json"
})

# Verify:
# - Execute restarts from plan
# - No need to re-run Prime/Plan
```

### Test 3: Acceptance Criteria Validation

```bash
# Epic with multiple criteria
mcp_meta_run_piv_per_step({
  epicId: "epic-006",  // GDPR compliance with 4 criteria
  ...
})

# Verify:
# - All 4 criteria checked
# - If only 2 met, success = false
# - Clear report of which criteria failed
```

---

## Migration Path

### Week 1: Implement per-step spawning
- ✅ Update spawn tool with PIV phase types
- ✅ Create orchestrator tool
- ✅ Create individual phase tools
- ✅ Test with simple epic

### Week 2: Update templates and add validation
- ✅ Update implement-feature.md template
- ✅ Add acceptance criteria validation
- ✅ Add timeout/retry logic
- ✅ Test with complex epic

### Week 3: Production rollout
- ✅ Update PS instructions to use per-step mode
- ✅ Monitor real usage
- ✅ Gather metrics (success rate, retry rate)
- ✅ Deprecate monolithic mode

---

## Success Metrics

**Before per-step spawning**:
- Epic completion rate: ~30%
- Hung processes: Frequent
- User intervention: Every epic

**After per-step spawning**:
- Epic completion rate: >80%
- Hung processes: Rare (can restart)
- User intervention: <20%

---

## Conclusion

The per-step spawning architecture gives PS the control it needs to:
- Monitor progress per phase
- Detect and restart hung phases
- Validate between phases
- Recover from partial failures

**Next Step**: Implement Phase 1 (update spawn tool with PIV phase types)
