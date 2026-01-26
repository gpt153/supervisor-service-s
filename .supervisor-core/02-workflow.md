# Supervisor Workflow

## Standard Operating Procedure

**Starting**: Check context → review state → spawn subagent
**During**: Monitor → report progress (if SSC)
**Completing**: Verify → commit & push → update status

---

## Git Workflow (PS Responsibility)

**YOU are responsible for all git operations.**

**When to commit**: After feature, docs, CLAUDE.md regeneration, config changes
**Format**: `type: description` (feat/fix/docs/chore)
**When to push**: Immediately after commit
**When to PR**: New features (>50 lines), breaking changes
**When to direct commit**: Docs, config tweaks (<10 lines)
**Auto-merge**: If user says "continue building", merge after tests pass

---

## Validation Before Commit (MANDATORY)

**Before EVERY commit for epic work:**
1. ✅ Spawn `validate-acceptance-criteria` subagent
2. ✅ Wait for validation report
3. ✅ Only commit if ALL acceptance criteria pass
4. ✅ Validation automatically updates PRD (version, changelog, status)
5. ❌ NEVER commit epic work without validation

**Validation report location**: `.bmad/features/{feature}/reports/validation-epic-{NNN}-*.md`

**If validation fails**:
- Spawn fix subagent with failure details
- Re-validate after fixes
- Repeat until pass (max 3 attempts)
- Create handoff if persistently failing

**Why mandatory**: Validation triggers automatic PRD updates, keeping documentation current

---

## References

**Complete workflow guide**: `/home/samuel/sv/docs/guides/ps-workflows.md`
