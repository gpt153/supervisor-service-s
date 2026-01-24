# PIV Per-Step Implementation Summary

**Date**: 2026-01-24
**Status**: ✅ Implemented and ready for testing

---

## What Was Built

### 1. Per-Step PIV Orchestrator Tool

**File**: `/src/mcp/tools/piv-per-step-tool.ts`

**Tool**: `mcp_meta_run_piv_per_step`

**What it does**:
- Spawns PIV phases individually instead of monolithic loop
- Prime → validate → Plan → validate → Execute → validate acceptance criteria
- PS has full visibility between phases
- Can detect hung phases (35 min timeout per phase)
- Validates ALL acceptance criteria at the end

**Key features**:
- Per-phase timeout handling
- Acceptance criteria validation AFTER Execute
- Clear error reporting (which phase failed)
- Saves partial results if fails mid-way

---

### 2. Individual Phase Tools

**File**: `/src/mcp/tools/piv-phase-tools.ts`

**Tools**:
- `mcp_meta_run_prime` - Run only Prime (research) phase
- `mcp_meta_run_plan` - Run only Plan (design) phase
- `mcp_meta_run_execute` - Run only Execute (implementation) phase

**Use case**: PS wants maximum control
- Run phases independently
- Restart individual phase if hung
- Skip phases if needed
- Custom retry logic

---

### 3. Updated Implementation Template

**File**: `/home/samuel/sv/.claude/commands/subagents/implementation/implement-feature.md`

**Added**: Explicit warning at top:
```markdown
## 🔥 CRITICAL: You MUST Write Actual Code

**"IMPLEMENTATION" MEANS CODE, NOT DOCUMENTATION**

**SUCCESS** = Code files modified AND committed to git
**FAILURE** = Only documentation or design files

If you produce ONLY documentation/design files, you have FAILED the task.
```

**Why**: Addresses root cause from diagnosis - agents confusing research/planning with implementation

---

### 4. Tool Registration

**File**: `/src/mcp/tools/index.ts`

**Added**:
- Import `getPerStepPIVTools()` from `piv-per-step-tool.js`
- Import `getPIVPhaseTools()` from `piv-phase-tools.js`
- Added both to `getAllTools()` return

**Result**: New tools available in MCP server

---

## How PS Will Use This

### Simple Workflow (Recommended for Most Cases)

```typescript
// PS calls one tool
const result = await mcp_meta_run_piv_per_step({
  projectName: "consilio",
  projectPath: "/home/samuel/sv/consilio-s",
  epicId: "epic-006",
  epicTitle: "GDPR Compliance",
  epicDescription: "...",
  acceptanceCriteria: [
    "User can export all personal data",
    "User can delete account and all data",
    "Cookie consent banner implemented",
    "Privacy policy displayed"
  ]
});

// Tool internally:
// 1. Spawns Prime agent via mcp_meta_spawn_subagent (30 min timeout)
// 2. Validates Prime results
// 3. Spawns Plan agent with Prime results (30 min timeout)
// 4. Validates Plan results
// 5. Spawns Execute agent with Plan (30 min timeout)
// 6. Validates acceptance criteria (spawns validation agents)
// 7. Returns final result with all phases

// If any phase hangs → timeout error
// If acceptance criteria not met → success: false
```

### Advanced Workflow (Maximum Control)

```typescript
// PS orchestrates manually
const primeResult = await mcp_meta_run_prime({
  epicId: "epic-006",
  epicTitle: "GDPR Compliance",
  ...
});

if (!primeResult.success) {
  // Retry Prime
  primeResult = await mcp_meta_run_prime(...);
}

const planResult = await mcp_meta_run_plan({
  epicId: "epic-006",
  contextFile: primeResult.context_path,
  ...
});

if (!planResult.success) {
  // Retry Plan without re-running Prime
  planResult = await mcp_meta_run_plan(...);
}

const executeResult = await mcp_meta_run_execute({
  epicId: "epic-006",
  planFile: planResult.plan_path,
  ...
});

// PS has full control, can retry individual phases
```

---

## Comparison: Old vs New

### OLD (Monolithic PIV)

```
PS calls: mcp__meta__start_piv_loop
  ↓
Spawns ONE PIV agent
  ↓
PIV agent runs internally:
  - Prime
  - Plan
  - Execute
  ↓
Returns final result
```

**Problems**:
- If any phase hangs → entire loop stalls
- PS has no visibility between phases
- Cannot restart individual phases
- No acceptance criteria validation
- Agent claims "complete" but epic half-done

### NEW (Per-Step PIV)

```
PS calls: mcp_meta_run_piv_per_step
  ↓
Tool spawns Prime agent → waits → validates
  ↓
Tool spawns Plan agent → waits → validates
  ↓
Tool spawns Execute agent → waits → validates
  ↓
Tool validates ALL acceptance criteria
  ↓
Returns result: success only if ALL criteria met
```

**Benefits**:
- ✅ Granular control per phase
- ✅ Can restart hung phase
- ✅ Validates acceptance criteria
- ✅ Accurate success/failure reporting
- ✅ Clear error messages (which phase failed)

---

## Testing Plan

### Test 1: Simple Epic End-to-End

```bash
# Create test epic
cat > /home/samuel/sv/.bmad/epics/test-piv-001.md << 'EOF'
---
id: test-piv-001
title: Add Hello World Function
description: Create a simple hello() function that returns "Hello, World!"
acceptanceCriteria:
  - Function hello() exists in src/hello.ts
  - Function returns "Hello, World!"
  - Unit tests pass
---
EOF

# Run per-step PIV
curl -X POST http://localhost:8081/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "mcp_meta_run_piv_per_step",
      "arguments": {
        "projectName": "supervisor-service-s",
        "projectPath": "/home/samuel/sv/supervisor-service-s",
        "epicId": "test-piv-001",
        "epicTitle": "Add Hello World Function",
        "epicDescription": "Create a simple hello() function",
        "acceptanceCriteria": [
          "Function hello() exists in src/hello.ts",
          "Function returns \"Hello, World!\"",
          "Unit tests pass"
        ]
      }
    }
  }'

# Expected:
# - Prime agent researches codebase
# - Plan agent creates implementation plan
# - Execute agent writes src/hello.ts + tests
# - Validation agents check acceptance criteria
# - Returns: success: true (if all criteria met)
```

### Test 2: Hung Phase Recovery

```bash
# If Execute phase hangs (>30 min):
# - Tool returns error: "Execute phase timeout"
# - PS can retry just Execute:

curl -X POST http://localhost:8081/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "mcp_meta_run_execute",
      "arguments": {
        "epicId": "test-piv-001",
        "planFile": ".agents/plans/test-piv-001.json",
        ...
      }
    }
  }'

# No need to re-run Prime/Plan
```

### Test 3: Acceptance Criteria Validation

```bash
# Epic with multiple criteria
curl -X POST http://localhost:8081/mcp ... {
  "acceptanceCriteria": [
    "User can export data",
    "User can delete account",
    "Cookie consent banner",
    "Privacy policy displayed"
  ]
}

# Expected:
# - Execute implements code
# - Tool spawns 4 validation agents (one per criterion)
# - If only 2 criteria met → success: false
# - Returns:
#   {
#     "success": false,
#     "criteria_validation": {
#       "all_met": false,
#       "results": [
#         { "criterion": "User can export data", "met": true },
#         { "criterion": "User can delete account", "met": true },
#         { "criterion": "Cookie consent banner", "met": false },
#         { "criterion": "Privacy policy displayed", "met": false }
#       ]
#     }
#   }
```

---

## Files Created/Modified

**New files**:
- `/src/mcp/tools/piv-per-step-tool.ts` (374 lines)
- `/src/mcp/tools/piv-phase-tools.ts` (172 lines)
- `/docs/PIV-PER-STEP-SPAWNING-DESIGN.md` (design doc)
- `/docs/PIV-PER-STEP-IMPLEMENTATION-SUMMARY.md` (this file)

**Modified files**:
- `/src/mcp/tools/index.ts` (added tool imports and registration)
- `/home/samuel/sv/.claude/commands/subagents/implementation/implement-feature.md` (added CODE vs DOCS warning)

**Total lines added**: ~800 lines

---

## Next Steps

### Immediate (Before Testing)

1. ✅ Build TypeScript: `npm run build`
2. ✅ Restart MCP server: `npm run start:mcp`
3. ✅ Verify tools registered: `curl http://localhost:8081/mcp -X POST -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`

### Testing (This Week)

1. [ ] Test simple epic (hello world function)
2. [ ] Test acceptance criteria validation
3. [ ] Test hung phase recovery
4. [ ] Test complex epic (GDPR compliance)

### Production Rollout (Next Week)

1. [ ] Update PS instructions to use per-step mode by default
2. [ ] Monitor real usage metrics
3. [ ] Gather feedback from user
4. [ ] Document best practices

---

## Success Metrics

**Before per-step spawning**:
- Epic completion rate: ~30%
- Hung processes: Frequent
- Acceptance criteria validation: None
- User intervention: Every epic

**After per-step spawning (Target)**:
- Epic completion rate: >80%
- Hung processes: Rare (can restart individual phases)
- Acceptance criteria validation: 100% of epics
- User intervention: <20%

---

## Integration with Existing System

**Backwards compatible**: Old `mcp__meta__start_piv_loop` still works
**New tools**: Additional options for PS
**Template update**: Applies to ALL implementations (old and new)

No breaking changes.

---

**Status**: ✅ Ready for testing
**Next**: Build + Test with simple epic
