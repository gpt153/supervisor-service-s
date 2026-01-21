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

## Available MCP Tools

- `mcp_meta_start_piv_loop` - Start PIV for epic
- `mcp_meta_piv_status` - Check PIV progress
- `mcp_meta_cancel_piv` - Cancel PIV (rarely needed)

---

**Complete guide**: `/home/samuel/sv/docs/guides/piv-loop-guide.md`

**AUTONOMOUS = User gives direction, you execute everything until complete. NO permission needed.**
