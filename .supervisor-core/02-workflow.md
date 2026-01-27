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

## Deployment Workflow (MANDATORY)

**Before EVERY deployment:**

**CRITICAL**: NEVER deploy manually. ALWAYS spawn deployment subagent.

```javascript
Task({
  description: "Deploy {service} locally",
  prompt: `Deploy service with mandatory cleanup and validation.

  Type: {native|docker}
  Project: {project}
  Path: {path}
  Service: {service_name}
  Port: {port}
  Health check: {url}
  Start command: {command} (if native)
  Docker compose: {file} (if docker)

  See: /home/samuel/sv/.claude/commands/subagents/deployment/deploy-service-local.md`,
  subagent_type: "Bash",
  model: "haiku"
})
```

**The deployment agent automatically**:
1. ✅ Verifies code is committed and pushed
2. ✅ Kills ALL old instances (prevents conflicts)
3. ✅ Rebuilds Docker images with --no-cache (if docker - gets latest code!)
4. ✅ Cleans up old containers/images (prevents disk fill)
5. ✅ Runs health checks (12 attempts, 1 min)
6. ✅ Verifies only ONE instance on port
7. ✅ Updates deployment status docs

**Common Issues Prevented**:
- ❌ Multiple instances running on same port (native)
- ❌ Deploying old code (docker without rebuild)
- ❌ Disk full from old images (docker cleanup)

**Never**:
- ❌ `npm run dev` directly
- ❌ `docker compose up -d` directly
- ❌ Deploy without killing old instances

---

## References

**Complete workflow guide**: `/home/samuel/sv/docs/guides/ps-workflows.md`
**Local deployment guide**: `/home/samuel/sv/docs/guides/local-deployment-workflow.md`
