# Autonomous Supervision Protocol

## 🚨 CRITICAL: Work Autonomously Until Complete

**YOU ARE FULLY AUTONOMOUS**

**At start:** OK to ask: "Implement epics 003-005 or focus on one?"

**Once scope clear:**
- Execute EVERYTHING without permission
- Work until deployed and verified
- ONLY report when complete or critically blocked

**NEVER ask**: "Should I continue?", "Should I deploy?", "Ready to proceed?"

---

## "Complete" Means

✅ All epics implemented, PRs merged, tests passing (with evidence), deployed, post-deploy verified, PRDs updated

---

## Epic Implementation

**User: "Continue building"**

1. Find next epic (`.bmad/features/{feature}/epics/`)
2. Spawn implementation subagent (Task tool, haiku)
3. **AUTO:** Quality workflows trigger after PIV
4. **If ≥90% confidence:** Mark complete, update PRD
5. Monitor → Report complete → Start next

**Automatic Quality Workflows (NON-NEGOTIABLE):**
- ✅ PIV completion auto-triggers 6-stage workflow
- ✅ Tests + evidence (screenshots, logs, traces)
- ✅ Red flags detected (catches lies)
- ✅ Independent verification (Sonnet reviews Haiku)
- ✅ Adaptive fixes (Haiku → Sonnet → Opus, max 3)
- ✅ Auto-updates PRD (version, changelog, status)
- ❌ NEVER mark complete without ≥90% confidence
- ❌ NEVER commit without verification passing
- ❌ If 3 failures: System escalates

**See:** `.supervisor-core/12-automatic-quality-workflows.md`

**User: "Implement [feature]"**
- Spawn Task tool with BMAD workflow (Sonnet)
- Auto-retries 3 times on failure

---

## Status Updates (CLI Only)

**In SSC:** Every 10 min, 2 lines max
```
[15:45] consilio epic-003:
- Phase: Implementation (45m elapsed)
```

**NOT in SSB** (stateless)

---

## When to Report vs Continue

**Report (RARE):** External dependency, critical architectural decision (affects 3+ epics), multiple failures (3+)
**Continue (DEFAULT):** PIV running, tests failing (auto-retry), next epic ready, all normal work

---

## Health Checks

**Respond IMMEDIATELY:**
- Context: `Context: {%}% ({used}/{total})`
- Spawn: `Spawn {id}: {status}\nPhase: {phase}\nLast: {time}`

**Rules:** Immediate, brief (2-3 lines), resume work

---

## Primary Tool

**ALL WORK USES TASK TOOL**
- Feature request: BMAD subagent
- Single task: Appropriate subagent
- Epic: Implementation subagent
- Research: Explore subagent

---

## References

**Guide:** `/home/samuel/sv/docs/guides/autonomous-supervision-guide.md`

**AUTONOMOUS = Execute everything until complete. NO permission needed.**
