# Automatic Quality Workflows

**YOU USE THE AUTOMATIC QUALITY SYSTEM FOR ALL EPIC IMPLEMENTATIONS**

---

## Critical: Two Validation Systems

**NEW (Primary):** Automatic Quality Workflows (Epic 006-A through 006-G)
- Evidence-based verification (screenshots, logs, traces)
- Red flag detection (catches agent lies)
- Independent verification (different model)
- Adaptive fixes (RCA + 3-5-7 pattern)
- Full orchestration

**OLD (Fallback):** validate-acceptance-criteria subagent
- Simple acceptance criteria checking
- Use ONLY if automatic quality workflows unavailable

---

## When to Use Automatic Quality Workflows

**ALWAYS use for:**
- ✅ Epic implementations (after PIV completes)
- ✅ UI/API testing (needs evidence collection)
- ✅ Integration testing (multi-component verification)
- ✅ Complex features (needs RCA if failures)

**Use old validation for:**
- ❌ Simple docs changes (no tests needed)
- ❌ Quick fixes (<50 lines, no functionality changes)

---

## How It Works (6-Stage Workflow)

**The system runs automatically after epic implementation:**

1. **Execution** → Run UI/API tests with evidence collection
2. **Detection** → Detect red flags (missing evidence, lies)
3. **Verification** → Independent verification (Sonnet reviews Haiku's work)
4. **Fixing** → Adaptive fixes if failed (Haiku → Sonnet → Opus)
5. **Learning** → Extract patterns for reuse
6. **Reporting** → Generate unified report

**You don't spawn it manually** - PIV loop triggers it automatically.

---

## What You Get

**Evidence collected:**
- Screenshots (before/after every action)
- Console logs (errors, warnings, info)
- Network traces (all HTTP requests)
- DOM snapshots (state changes)
- Tool execution logs (MCP calls)

**Verification includes:**
- Integrity checks (artifacts exist, valid formats)
- Cross-validation (screenshot vs console consistency)
- Skeptical analysis (timing, patterns, anomalies)
- Confidence score (0-100%)

**If tests fail:**
- Root cause analysis (Opus)
- Adaptive fix attempts (Haiku → Sonnet → Opus)
- Learning stored (reuse successful fixes)
- Max 3 retries, then escalate

---

## Epic Implementation Workflow (Updated)

**When user says "Continue building" or "Implement epic X":**

1. ✅ Spawn implementation subagent (haiku with detailed plan)
2. ✅ **Wait for PIV completion** (PR created)
3. ✅ **Automatic quality workflows trigger** (tests extracted, orchestrated)
4. ✅ **Verification report generated** (unified report with confidence)
5. ✅ **If passed**: Mark epic complete, update PRD
6. ✅ **If failed**: Fixes attempted automatically (up to 3 retries)
7. ✅ Commit only after verification passes

**You don't manually spawn validation anymore** - it's automatic.

---

## Checking Results

**Verification report location:**
```
.bmad/features/{feature}/reports/verification-epic-{NNN}-*.md
```

**Report includes:**
- Overall verdict (PASS/FAIL/NEEDS_REVIEW)
- Confidence score (0-100%)
- Evidence summary (artifacts collected)
- Red flags detected (severity, proof)
- Fix attempts (if any)
- Recommendations (accept/review/reject)

---

## Cost Optimization

**Automatic model selection:**
- Tests execute: Haiku (fast, cheap)
- Verification: Sonnet (reasoning, independent)
- RCA: Opus (deep analysis)
- Fixes: Adaptive (Haiku → Sonnet → Opus based on complexity)

**Result:** 80% cost reduction vs always using Sonnet

---

## Confidence Thresholds

**Auto-pass:** ≥90% confidence
- All evidence complete and consistent
- No critical red flags
- Tests passed with proof

**Manual review:** 60-89% confidence
- Some concerns but not critical
- Ambiguous evidence
- User decides

**Auto-fail:** <60% confidence OR critical red flags
- Missing evidence
- Agent lies detected
- Tests failed with no fixes

---

## Fallback to Old Validation

**If automatic quality workflows not available:**
```javascript
Task({
  description: "Validate acceptance criteria",
  prompt: `Validate epic implementation against acceptance criteria.

  Epic: {epic_id}
  Feature: {feature}
  Path: {path}

  See: /home/samuel/sv/.claude/commands/subagents/validation/validate-acceptance-criteria.md`,
  subagent_type: "general-purpose",
  model: "haiku"
})
```

**But prefer automatic quality workflows when available.**

---

## Quick Decision Tree

```
User: "Continue building" or "Implement epic X"
  ↓
Spawn implementation subagent (haiku)
  ↓
Wait for PIV completion (PR created)
  ↓
Automatic quality workflows trigger
  ↓
Tests run → Evidence collected → Red flags detected → Verified
  ↓
Passed? → Commit & mark complete
  ↓
Failed? → Fixes attempted (auto, up to 3 retries)
  ↓
Still failing? → Escalate with handoff
```

---

## Database Tables

**Evidence & verification stored in:**
- `evidence_artifacts` - All collected evidence
- `red_flags` - Detected deception patterns
- `verification_reports` - Independent verification results
- `root_cause_analyses` - RCA findings
- `fix_attempts` - Fix retry tracking
- `fix_learnings` - Knowledge graph
- `test_workflows` - Workflow state

**Query results:** Use MCP tools or direct database queries

---

## References

**Complete system documentation:**
- PRD: `.bmad/features/automatic-quality-workflows/prd.md`
- Deployment: `.bmad/features/automatic-quality-workflows/DEPLOYMENT-SUMMARY.md`
- Epic 006-E: Independent verification details
- Epic 006-F: RCA & fix agent details
- Epic 006-G: Test orchestrator details

**Old validation (fallback):**
- `/home/samuel/sv/.claude/commands/subagents/validation/validate-acceptance-criteria.md`

---

**Remember:** Automatic quality workflows are now the **PRIMARY** validation system. Use them for all epic implementations.
