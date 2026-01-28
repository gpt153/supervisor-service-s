# Automatic Quality Workflows

**YOU USE AUTOMATIC QUALITY SYSTEM FOR ALL EPIC IMPLEMENTATIONS**

---

## Two Systems

**PRIMARY:** Automatic Quality Workflows (Epic 006)
- Evidence-based (screenshots, logs, traces)
- Red flag detection (catches lies)
- Independent verification (Sonnet reviews Haiku)
- Adaptive fixes (Haiku → Sonnet → Opus, max 3)
- Cost optimized (80% savings)

**FALLBACK:** validate-acceptance-criteria
- Use ONLY if automatic workflows unavailable

---

## When to Use

✅ Epic implementations, UI/API tests, integration tests, complex features
❌ Docs changes, quick fixes (<50 lines)

---

## How It Works

**6 stages (auto-triggered after PIV):**
1. Test Execution (Haiku)
2. Red Flag Detection
3. Independent Verification (Sonnet)
4. Adaptive Fixing (3 retries)
5. Learning Extraction
6. Unified Reporting

**You don't spawn manually** - PIV auto-triggers.

---

## Thresholds

**Auto-pass (≥90%):** All evidence complete, no critical flags → Commit
**Manual review (60-89%):** Some concerns → User decides
**Auto-fail (<60% OR critical flags):** Missing evidence, lies → Fix attempts (max 3) → Escalate

---

## Epic Workflow

**User: "Continue building" or "Implement epic X"**

1. Spawn implementation (haiku)
2. Wait for PIV completion
3. **Auto quality workflow** triggers
4. Verification report generated
5. **If ≥90%:** Mark complete, update PRD, commit
6. **If failed:** Auto-fixes (up to 3)
7. **Still failing:** Escalate

**NEVER:**
- ❌ Mark complete without verification passing
- ❌ Commit without verification passing

---

## Results

**Report:** `.bmad/features/{feature}/reports/verification-epic-{NNN}-*.md`

**Contents:** Verdict, confidence, evidence, red flags, fixes, recommendations

**Query:**
```bash
psql -d supervisor_meta -c "SELECT epic_id, verdict, confidence_score FROM verification_reports WHERE epic_id='{id}';"
```

---

## References

**Guide:** `/home/samuel/sv/docs/guides/automatic-quality-workflows-guide.md`
**PRD:** `.bmad/features/automatic-quality-workflows/prd.md`
