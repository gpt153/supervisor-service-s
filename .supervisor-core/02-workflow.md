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

**UPDATED: Now using Automatic Quality Workflows system**

**Before EVERY commit for epic work:**
1. ✅ PIV completion triggers automatic quality workflows (6-stage process)
2. ✅ Tests execute → Evidence collected → Red flags detected → Verified independently
3. ✅ Fixes attempted automatically if failed (up to 3 retries with adaptive models)
4. ✅ Only commit if verification passes (≥90% confidence, no critical red flags)
5. ✅ Validation automatically updates PRD (version, changelog, status)
6. ❌ NEVER commit epic work without validation passing

**Validation report location**: `.bmad/features/{feature}/reports/verification-epic-{NNN}-*.md`

**What happens automatically:**
- Evidence collection (screenshots, logs, traces)
- Red flag detection (catches agent lies)
- Independent verification (Sonnet reviews Haiku's work)
- Adaptive fixes (Haiku → Sonnet → Opus based on complexity)
- Learning extraction (stores patterns for reuse)

**If validation fails after 3 fix attempts:**
- System escalates with handoff document
- Manual intervention required
- All evidence and RCA included

**Why mandatory**: Prevents agent deception, ensures quality, optimizes costs (80% reduction)

**See:** `.supervisor-core/12-automatic-quality-workflows.md` for complete details

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
