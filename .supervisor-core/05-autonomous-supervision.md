# Autonomous Supervision Protocol

## 🚨 CRITICAL: Work Autonomously Until Complete

**YOU ARE FULLY AUTONOMOUS**

**At start of session:**
- ✅ OK to ask: "Implement epics 003-005 or focus on one?"

**Once scope clear:**
- Execute EVERYTHING without permission
- Work until deployed and verified
- ONLY report when complete or critically blocked

**NEVER ask**: "Should I continue?", "Should I deploy?", "Ready to proceed?"

---

## "Complete" Means

✅ All epics implemented
✅ All PRs merged
✅ All tests passing
✅ Deployed (if applicable)
✅ Post-deploy verified

---

## Epic Implementation (MANDATORY)

**User says "Continue building":**
1. Find next epic from `.bmad/features/{feature}/epics/`
2. Check for Implementation Notes:
   - Has numbered steps? → `mcp_meta_execute_epic_tasks`
   - No steps? → `mcp_meta_run_piv_per_step`
3. Monitor → Report when complete → Start next epic

**User says "Implement [feature]":**
```javascript
mcp_meta_bmad_full_workflow({
  projectName: "project",
  projectPath: "/path",
  featureDescription: "[feature]"
})
```

**If tool fails**: Auto-retries 3 times, reports error if still failing

---

## Status Updates (CLI Only)

**In SSC:**
- Every 5 min: Check status
- Every 10 min: Brief update (2 lines max)
- Format: `[time] project epic-id: Phase (elapsed)`

**NOT in SSB** (browser sessions are stateless)

---

## When to Report vs Continue

**Report and wait (rare):**
- External dependency needed
- Critical architectural decision
- Multiple failures (3+)

**Continue autonomously (default):**
- PIV loop running
- Tests failing (auto-retry)
- Next epic ready
- All normal work

---

## Health Check Protocol

**Respond IMMEDIATELY to health checks:**

**Context window**: `Context: {percentage}% ({used}/{total})`

**Spawn status**:
```
Spawn {id}: {status}
Phase: {phase}
Last activity: {timestamp}
```

**Rules**: Immediate (1 message), brief (2-3 lines), resume work

---

## Primary Tools

**Feature request**: `mcp_meta_bmad_full_workflow`
**Single task**: `Task` tool (with hardcoded model - see 04-tools.md)
**Epic with notes**: `mcp_meta_execute_epic_tasks`
**Epic without notes**: `mcp_meta_run_piv_per_step`

---

## References

- **Complete guide**: `/home/samuel/sv/docs/guides/autonomous-supervision-guide.md`
- **Deprecated tools**: `/home/samuel/sv/docs/guides/deprecated-tools.md`

**AUTONOMOUS = Execute everything until complete. NO permission needed.**
