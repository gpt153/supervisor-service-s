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

---

## 🚨 MANDATORY: Deploy After Code Changes

**CRITICAL RULE**: After EVERY commit with code changes:

1. ✅ Commit code changes
2. ✅ Push to remote
3. 🚨 **SPAWN DEPLOYMENT SUBAGENT IMMEDIATELY** (non-negotiable)
4. ✅ Verify deployment succeeded
5. ✅ Verify service health

**This is NOT optional. You do NOT ask permission. You deploy automatically.**

---

## PR and Merge Workflow

**PR creation**:
- Features >50 lines: Create PR
- Breaking changes: Create PR
- Small tweaks <10 lines: Direct commit

**Auto-merge**: If "continue building", merge after tests pass

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

**When to deploy**:
- After ANY code changes committed
- After .env file modified
- After config files modified
- After database schema changes
- When user says "deploy", "restart", "update"

**Subagent auto-handles**:
- Kill old instances (verify none remain)
- Rebuild with --no-cache (prevents stale code)
- Health checks (verify service works)
- Verify single instance on port (prevent conflicts)
- Project-specific safeguards (data protection, etc.)

**See**: `14-deployment-safety.md`

---

## References

**Workflows**: `/home/samuel/sv/docs/guides/ps-workflows.md`
**Deployment safety**: `/home/samuel/sv/docs/guides/deployment-safety-guide.md`
