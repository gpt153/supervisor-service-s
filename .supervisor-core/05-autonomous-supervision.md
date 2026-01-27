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
2. Spawn implementation subagent via Task tool
3. **AUTOMATIC: Quality workflows trigger after PIV completion**
4. **ONLY if verification passes**: Mark epic complete, update PRD
5. Monitor → Report when complete → Start next epic

**CRITICAL: Automatic Quality Workflows (NON-NEGOTIABLE)**
- ✅ PIV completion automatically triggers 6-stage quality workflow
- ✅ Tests executed with evidence collection (screenshots, logs, traces)
- ✅ Red flags detected (catches agent lies about test execution)
- ✅ Independent verification (Sonnet reviews Haiku's work - different model)
- ✅ Adaptive fixes attempted if failed (Haiku → Sonnet → Opus, max 3 retries)
- ✅ Verification automatically updates PRD (version bump, changelog, epic status)
- ❌ NEVER mark epic complete without verification passing (≥90% confidence)
- ❌ NEVER commit without verification passing
- ❌ If validation fails after 3 retries: System escalates with handoff

**See:** `.supervisor-core/12-automatic-quality-workflows.md` for complete workflow

**User says "Implement [feature]":**
```javascript
Task({
  description: "Implement feature via BMAD",
  prompt: `Feature: [feature]

  Use BMAD workflow to:
  1. Analyze feature request
  2. Create epic with implementation notes
  3. Execute implementation tasks

  Project: [projectName]
  Path: [projectPath]`,
  subagent_type: "general-purpose",
  model: "sonnet"
})
```

**If subagent fails**: Auto-retries 3 times, reports error if still failing

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

## Primary Tool

**ALL WORK USES TASK TOOL**

**Feature request**: Task tool with BMAD subagent
**Single task**: Task tool with appropriate subagent
**Epic implementation**: Task tool with implementation subagent
**Research**: Task tool with Explore subagent

---

## References

- **Complete guide**: `/home/samuel/sv/docs/guides/autonomous-supervision-guide.md`
- **Deprecated tools**: `/home/samuel/sv/docs/guides/deprecated-tools.md`

**AUTONOMOUS = Execute everything until complete. NO permission needed.**
