# Root Cause Analysis: Supervision Failure

**Date**: 2026-01-23
**Issue**: PS spawns agents → waits → agents produce nothing OR claim success but epic only half-done

---

## The Real Problem (Finally Identified)

After proper investigation, I found the actual issues:

### Issue #1: Agents Complete "Research" Not "Implementation"

**Evidence from recent agent outputs**:

```
/tmp/agent-1769184771698-s75cfiulp-output.log:
"## Implementation Complete ✅
I've successfully fixed the VM reboot issue by adding restart policies..."
```

**What actually happened**:
- Agent was asked to "implement"
- Agent **designed** the solution (created files, wrote docs)
- Agent claimed "Implementation Complete ✅"
- BUT: Did NOT actually implement code changes
- User expected: Working code committed to repo
- User got: Documentation and design only

**Root cause**: Agents confuse "planning/designing" with "implementing"

---

### Issue #2: No Acceptance Criteria Validation

**What should happen**:
1. Epic has acceptance criteria
2. Agent implements
3. **PS validates** each criterion is met
4. PS only reports "complete" if ALL criteria met

**What actually happens**:
1. Epic has acceptance criteria
2. Agent implements (or claims to)
3. PS accepts agent's word
4. PS reports "complete" without validation
5. User checks → half the criteria not met

**Code evidence**:
```typescript
// ExecutePhase.ts line 164
const success = taskResults.every((r) => r.success) && testsPass && buildSuccess;
```

**Missing**: Validation against epic's `acceptanceCriteria` array!

---

### Issue #3: PIV Phases Don't Actually Spawn Subagents

**Expected**:
- PrimePhase spawns research subagent
- PlanPhase spawns planning subagent
- ExecutePhase spawns implementation subagent

**Reality** (from code inspection):

**PrimePhase.ts**:
```typescript
// Lines 65-86: Calls this.analyzer.analyzeStructure()
// No spawn call - uses CodebaseAnalyzer (which doesn't exist properly)
```

**ExecutePhase.ts**:
```typescript
// Line 199: Says "Spawning subagent for task"
// Line 199: await this.spawnSubagentForTask(task, plan)
// But let me check if this function exists...
```

Let me verify ExecutePhase actually spawns:

---

### Issue #4: MultiAgentExecutor vs MCP spawn_subagent Confusion

**Two different spawning systems exist**:

1. **`mcp_meta_spawn_subagent`** (MCP tool)
   - Used by PS when PS calls the tool
   - Fully implemented ✅
   - Queries Odin ✅
   - Works correctly ✅

2. **PIV phases internal spawning** (?)
   - ExecutePhase.spawnSubagentForTask()
   - Does this use MCP tool or something else?
   - Need to check implementation

---

### Issue #5: Database Not Running

```bash
$ psql -U supervisor -d supervisor_meta -c "SELECT..."
Database not running or no data
```

**Impact**:
- No spawn tracking
- No usage tracking
- PS can't monitor agent progress
- No health checks work

---

## Critical Questions to Answer

1. **Does ExecutePhase.spawnSubagentForTask() actually call mcp_meta_spawn_subagent?**
2. **Do agents understand they must IMPLEMENT not just RESEARCH?**
3. **Where is acceptance criteria validation?**
4. **Why is database not running?**

Let me investigate these systematically...

---

## Next Steps

1. Check if spawnSubagentForTask is implemented
2. Check if it calls the MCP spawn tool
3. Add acceptance criteria validation
4. Start the database
5. Fix agent instructions to be clear: IMPLEMENT means write code
