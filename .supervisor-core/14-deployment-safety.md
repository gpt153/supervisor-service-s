# Deployment Safety

**🚨 CRITICAL: ALWAYS Kill Old Instances Before Deploying**

---

## MANDATORY RULE

**Before EVERY deployment:**

```
🚨 KILL ALL OLD INSTANCES
🚨 VERIFY NONE REMAIN
🚨 START NEW
🚨 VERIFY ONLY ONE RUNNING
```

**NO EXCEPTIONS. Applies to: Docker, native backends, native frontends.**

---

## Verification

**After deployment:**
```bash
lsof -i :<port> | grep LISTEN  # Must be exactly 1
docker ps | grep <project>     # Exactly 1 (if Docker)
ps aux | grep <service>        # Exactly 1 (if native)
```

**If multiple: STOP, kill all, redeploy.**

---

## Implementation

❌ **NEVER DEPLOY MANUALLY**
✅ **MUST USE DEPLOYMENT SUBAGENT**

**MANDATORY**: ALL deployments MUST use Task tool to invoke:
`/home/samuel/sv/.claude/commands/subagents/deployment/deploy-service-local.md`

**DO NOT**:
- ❌ Run `npm run dev` directly
- ❌ Run `docker compose up` directly
- ❌ Run `npm start` directly
- ❌ Start services without using the subagent

**ONLY THE SUBAGENT** can deploy because it:
- Kills ALL old instances (exhaustive search patterns)
- Verifies NONE remain (ps/docker ps verification)
- Rebuilds Docker with `--no-cache` (prevents stale code)
- Verifies ONLY ONE instance on port (lsof check)
- Runs health checks (ensures service actually works)

**Triggers:** User says "deploy", "restart service", after code/config changes, after commits

**If you deploy manually, you WILL create multiple instances. Use the subagent.**

---

## Why Critical

Multiple instances cause:
- Port conflicts
- Random requests to old code
- Hours wasted debugging

**Saves 10+ hours/week.**

---

## References

**Guide**: `/home/samuel/sv/docs/guides/deployment-safety-guide.md`
- Detailed workflows
- Issue resolution
- Real scenarios

---

**Priority**: 🚨 CRITICAL
