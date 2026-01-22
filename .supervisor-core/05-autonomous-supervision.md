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

## Status Updates (CLI Sessions)

**In SSC, implement active monitoring loop:**

1. **After spawning PIV**, note the time
2. **Every 5 minutes**, check PIV status: `mcp_meta_piv_status({ epicId })`
3. **Every 10 minutes**, send brief update:
   ```
   [15:45] Consilio epic-003:
   - Phase: Implementation (45m elapsed)
   ```
4. **Repeat** until PIV completes

**Implementation pattern:**
- Use `mcp_meta_piv_status` regularly (don't just wait)
- Calculate elapsed time: current_time - start_time
- Output update message every 10 minutes
- Keep to 2 lines maximum

**NOT Browser Sessions**: SSBs cannot self-update (stateless).

## When to Report vs Continue

### Report and Wait (Rare)
- ❌ External dependency: "Need API key"
- ❌ Critical architectural decision
- ❌ Multiple PIV failures (3+)

### Continue Autonomously (Default)
- ✅ PIV loop running
- ✅ Tests failing (PIV retries)
- ✅ Next epic ready
- ✅ All normal work

## Health Check Response Protocol

**CRITICAL: Respond immediately to health check prompts from monitoring system.**

### When Prompted for Context Report

**Prompt format:** "Report your current context window usage from system warnings"

**Your response format:**
```
Context: {percentage}% ({used}/{total} tokens)
```

**How to get values:**
1. Check most recent `<system-reminder>` after tool calls
2. Extract token usage: `Token usage: 63153/200000; 136847 remaining`
3. Calculate percentage: `(63153 / 200000) * 100 = 31.6%`
4. Report: `Context: 31.6% (63,153/200,000 tokens)`

**Example:**
```
User/Monitor: Report your current context window usage from system warnings
You: Context: 31.6% (63,153/200,000 tokens)
```

### When Prompted for Spawn Status

**Prompt formats:**
- "Check active spawn status and provide brief progress update"
- "Spawn {task_id} has not produced output for 15+ minutes. Investigate and report."

**Your response:**
1. Call `mcp_meta_piv_status({ epicId })` or check spawn output file
2. Report status in 2-3 lines:
   ```
   Spawn {task_id}: {status}
   Phase: {current_phase}
   Last activity: {timestamp or "no recent output"}
   ```

**Example stalled spawn:**
```
User/Monitor: Spawn epic-003-implementation stalled - investigate
You: [Checks output file]
Spawn epic-003-implementation: Appears stalled
Phase: Testing (no output for 18 minutes)
Action: Cancelling and restarting spawn
```

### Health Check Priorities

**These prompts override normal work:**
- ✅ Health check prompts take precedence over ongoing tasks
- ✅ Respond IMMEDIATELY (within 1 message)
- ✅ Keep responses brief (2-3 lines)
- ✅ Then resume normal work

**Don't:**
- ❌ Ignore health check prompts
- ❌ Give verbose explanations
- ❌ Ask permission to respond

## Available MCP Tools

- `mcp_meta_start_piv_loop` - Start PIV for epic
- `mcp_meta_piv_status` - Check PIV progress
- `mcp_meta_cancel_piv` - Cancel PIV (rarely needed)

---

**Complete guide**: `/home/samuel/sv/docs/guides/piv-loop-guide.md`

**AUTONOMOUS = User gives direction, you execute everything until complete. NO permission needed.**
