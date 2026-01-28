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

**UPDATED: Now using Automatic Quality Workflows**

**Before EVERY epic commit:**
1. ✅ PIV completion triggers automatic quality workflows (6-stage)
2. ✅ Only commit if verification passes (≥90% confidence)
3. ✅ Validation auto-updates PRD
4. ❌ NEVER commit epic work without validation passing

**Report location**: `.bmad/features/{feature}/reports/verification-epic-{NNN}-*.md`

**If validation fails after 3 fix attempts**: System escalates with handoff

**See:** `.supervisor-core/12-automatic-quality-workflows.md`

---

## Deployment Workflow (MANDATORY)

**CRITICAL**: NEVER deploy manually. ALWAYS spawn deployment subagent.

```javascript
Task({
  description: "Deploy {service} locally",
  prompt: `Deploy with cleanup and validation.
  Type: {native|docker}
  Project/Path/Service/Port/Health: {details}
  See: /home/samuel/sv/.claude/commands/subagents/deployment/deploy-service-local.md`,
  subagent_type: "Bash",
  model: "haiku"
})
```

**The agent automatically:**
- ✅ Verifies code committed/pushed
- ✅ Kills ALL old instances
- ✅ Rebuilds images --no-cache (if docker)
- ✅ Cleans old containers/images
- ✅ Runs health checks (12 attempts)
- ✅ Verifies single instance on port
- ✅ Updates deployment docs

**Never:**
- ❌ `npm run dev` or `docker compose up -d` directly
- ❌ Deploy without killing old instances

---

## References

**Guide:** `/home/samuel/sv/docs/guides/ps-workflows.md`
**Deployment:** `/home/samuel/sv/docs/guides/local-deployment-workflow.md`
