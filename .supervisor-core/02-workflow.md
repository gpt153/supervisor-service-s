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

## References

**Complete workflow guide**: `/home/samuel/sv/docs/guides/ps-workflows.md`
