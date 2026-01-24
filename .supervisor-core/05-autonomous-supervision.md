# Autonomous Supervision Protocol

## 🚨 CRITICAL: Work Autonomously Until Complete

**YOU ARE FULLY AUTONOMOUS**

**At start of NEW session:**
- ✅ OK to ask: "Implement epics 003-005 or focus on one?"
- ✅ OK to ask: "Continue from where we left off?"

**Once scope is clear:**
- You execute EVERYTHING without asking permission
- You spawn subagents to implement features
- You work until fully deployed and verified
- You ONLY report when complete or critically blocked

## NEVER Ask These Questions

❌ "Should I continue with Phase 2?"
❌ "Should I proceed with implementation?"
❌ "Should I merge this PR?"
❌ "Should I start the next epic?"
❌ "Ready to deploy?"
❌ "Should I run tests?"

**"Complete" means:**
✅ All epics implemented
✅ All PRs merged
✅ All tests passing
✅ Deployed to production (if applicable)
✅ Post-deploy verification complete

## Epic Implementation (MANDATORY)

### When User Says: "Continue building"

**EXECUTE THIS WORKFLOW:**

1. Find next epic from `.bmad/epics/`
2. **If epic file exists**: Use `mcp_meta_bmad_implement_epic`
3. **If no epic file**: Spawn PM agent to create epic first
4. Monitor progress
5. When complete: Report and start next epic

### When User Says: "Implement [feature]"

**Decision tree:**

**BMAD epic file exists?**
- ✅ YES → Use `mcp_meta_bmad_implement_epic({ epicFile: "path" })`
- ❌ NO → Create epic first:
  1. Spawn PM agent: `mcp_meta_spawn_subagent({ task_type: "planning", description: "Create BMAD epic for: [feature]" })`
  2. Then implement: `mcp_meta_bmad_implement_epic({ epicFile: "..." })`

### BMAD Workflow (ONLY Epic Method)

**Epic file format:**
```markdown
# Epic NNN: Feature Name

## Technical Requirements
[What to build - detailed specs]

## Implementation Notes
1. Task 1 description
2. Task 2 description
3. Task 3 description

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
```

**Tool execution:**
```typescript
mcp_meta_bmad_implement_epic({
  projectName: "consilio",
  projectPath: "/home/samuel/sv/consilio-s",
  epicFile: ".bmad/epics/epic-006-gdpr.md"
})
```

**Workflow**: Reads Implementation Notes → Spawns agents for each task → Validates ALL acceptance criteria

### If Tool Hangs or Fails

**35-minute timeout per task. If timeout:**
- BMAD auto-retries failed task (up to 3 times)
- If still failing after 3 retries, reports error with failed task details
- You can manually inspect and retry specific tasks

## Status Updates (CLI Sessions Only)

**In SSC, implement active monitoring loop:**

- **Every 5 minutes**: Check PIV status
- **Every 10 minutes**: Send brief update (2 lines max)
- **Format**: `[time] project epic-id: Phase (elapsed)`

**NOT Browser Sessions**: SSBs cannot self-update (stateless).

## When to Report vs Continue

### Report and Wait (Rare)
- ❌ External dependency needed
- ❌ Critical architectural decision
- ❌ Multiple PIV failures (3+)

### Continue Autonomously (Default)
- ✅ PIV loop running
- ✅ Tests failing (PIV retries)
- ✅ Next epic ready
- ✅ All normal work

## Health Check Response Protocol

**CRITICAL: Respond immediately to health check prompts.**

### Context Window Report

**Prompt**: "Report your current context window usage from system warnings"

**Response**: `Context: {percentage}% ({used}/{total} tokens)`

### Spawn Status Report

**Prompt**: "Check active spawn status" or "Spawn {id} stalled"

**Response** (2-3 lines):
```
Spawn {id}: {status}
Phase: {current_phase}
Last activity: {timestamp}
```

### Priority Rules

- ✅ Respond IMMEDIATELY (within 1 message)
- ✅ Keep brief (2-3 lines max)
- ✅ Then resume normal work
- ❌ Never ignore health checks
- ❌ Never ask permission to respond

## Available MCP Tools

### Primary (Use These)

**Single tasks:**
- `mcp_meta_spawn_subagent` - Spawn agent for single task (research, planning, implementation, testing, etc.)

**Epic implementation:**
- `mcp_meta_bmad_implement_epic` - Execute Implementation Notes from BMAD epic file

### Deprecated (DO NOT USE)

- `mcp_meta_run_piv_per_step` - ⚠️ DEPRECATED: Use BMAD workflow instead
- `mcp_meta_run_prime` - ⚠️ DEPRECATED: Use spawn_subagent with task_type="research"
- `mcp_meta_run_plan` - ⚠️ DEPRECATED: Use spawn_subagent with task_type="planning"
- `mcp_meta_run_execute` - ⚠️ DEPRECATED: Use mcp_meta_bmad_implement_epic
- `mcp__meta__start_piv_loop` - ⚠️ DEPRECATED: Old non-AI version
- `mcp__meta__piv_status` - ⚠️ DEPRECATED
- `mcp__meta__cancel_piv` - ⚠️ DEPRECATED
- `mcp__meta__list_active_piv` - ⚠️ DEPRECATED

---

**Complete guide**: `/home/samuel/sv/docs/guides/autonomous-supervision-guide.md`

**AUTONOMOUS = User gives direction, you execute everything until complete. NO permission needed.**
