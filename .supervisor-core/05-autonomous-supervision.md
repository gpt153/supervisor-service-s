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
2. **If epic has Implementation Notes**: Use `mcp_meta_bmad_implement_epic`
3. **If epic only has description**: Use `mcp_meta_run_piv_per_step`
4. Monitor progress
5. When complete: Report and start next epic

### When User Says: "Implement [feature]"

**Decision tree:**

**User provides BMAD epic file?**
- ✅ YES → Use `mcp_meta_bmad_implement_epic({ epicFile: "path" })`
- ❌ NO → Use `mcp_meta_run_piv_per_step({ epicDescription: "..." })`

### PIV Per-Step (From Description)

**Use when**: User describes feature WITHOUT detailed technical plan

```typescript
mcp_meta_run_piv_per_step({
  projectName: "consilio",
  projectPath: "/home/samuel/sv/consilio-s",
  epicId: "epic-006",
  epicTitle: "GDPR Compliance",
  epicDescription: "Implement GDPR compliance features...",
  acceptanceCriteria: [
    "User can export all personal data",
    "User can delete account and all data"
  ]
})
```

**Phases**: Prime (research) → Plan (design) → Execute (code) → Validate (test)

### BMAD (From Epic File)

**Use when**: Epic file EXISTS with Technical Requirements and Implementation Notes

```typescript
mcp_meta_bmad_implement_epic({
  projectName: "consilio",
  projectPath: "/home/samuel/sv/consilio-s",
  epicFile: ".bmad/epics/epic-006-gdpr.md"
})
```

**Workflow**: Reads notes → Executes tasks → Validates criteria

### If Tool Hangs or Fails

**35-minute timeout per phase/task. If timeout:**

```typescript
// PIV: Restart failed phase
mcp_meta_run_execute({ epicId: "epic-006" })

// BMAD: Tool auto-retries failed task
// If still failing after 3 retries, reports error
```

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
- `mcp_meta_spawn_subagent` - Spawn agent for single task (research, implementation, etc.)

**Epic from description:**
- `mcp_meta_run_piv_per_step` - Research → Plan → Implement from feature description
- `mcp_meta_run_prime` - Run Prime phase only (research)
- `mcp_meta_run_plan` - Run Plan phase only (design)
- `mcp_meta_run_execute` - Run Execute phase only (implementation)

**Epic from BMAD file:**
- `mcp_meta_bmad_implement_epic` - Execute Implementation Notes from epic file

### Legacy (Deprecated)

- `mcp__meta__start_piv_loop` - ⚠️ DEPRECATED: Basic file analysis only, no AI
- `mcp__meta__piv_status` - ⚠️ DEPRECATED: Only works with legacy tool
- `mcp__meta__cancel_piv` - ⚠️ DEPRECATED
- `mcp__meta__list_active_piv` - ⚠️ DEPRECATED

---

**Complete guide**: `/home/samuel/sv/docs/guides/autonomous-supervision-guide.md`

**AUTONOMOUS = User gives direction, you execute everything until complete. NO permission needed.**
