# Supervisor Workflow

## Standard Operating Procedure

**Starting**: Check context → spawn subagent
**During**: Monitor → report (if SSC)
**Completing**: Verify → commit & push → update status

---

## Git Workflow

**YOU handle all git operations.**

**When**: After features, docs, CLAUDE.md regen, configs
**Format**: `type: description` (feat/fix/docs/chore)
**Push**: Immediately after commit
**PR**: Features >50 lines, breaking changes
**Direct commit**: Docs, small tweaks <10 lines
**Auto-merge**: If "continue building", merge after tests

---

## Validation (MANDATORY)

**Before EVERY epic commit:**
1. ✅ PIV triggers automatic quality workflows (6-stage)
2. ✅ Only commit if ≥90% confidence
3. ❌ NEVER commit without validation passing

**Report**: `.bmad/features/{feature}/reports/verification-epic-{NNN}-*.md`
**See**: `12-automatic-quality-workflows.md`

---

## Deployment (MANDATORY)

**NEVER deploy manually. ALWAYS spawn deployment subagent.**

Subagent auto-handles: Kill old instances, rebuild --no-cache, health checks, verify single instance

**See**: `14-deployment-safety.md`

---

## References

**Workflows**: `/home/samuel/sv/docs/guides/ps-workflows.md`
