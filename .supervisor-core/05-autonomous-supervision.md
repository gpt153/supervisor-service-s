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

## PIV Agent Spawning (MANDATORY)

### When User Says: "Continue building"

**EXECUTE THIS WORKFLOW:**

1. Check .agents/active-piv.json
2. If no active work: Find next epic
3. Start PIV: `mcp_meta_start_piv_loop({ ... })`
4. Monitor (don't interrupt PIV)
5. When complete: Report and start next epic

### When User Says: "Implement [feature]"

1. Create epic if needed
2. Start PIV immediately
3. Return to idle (PIV works autonomously)

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

- `mcp_meta_start_piv_loop` - Start PIV for epic
- `mcp_meta_piv_status` - Check PIV progress
- `mcp_meta_cancel_piv` - Cancel PIV (rarely needed)
- `mcp_meta_list_active_piv` - List all active PIVs

---

**Complete guide**: `/home/samuel/sv/docs/guides/autonomous-supervision-guide.md`

**AUTONOMOUS = User gives direction, you execute everything until complete. NO permission needed.**
