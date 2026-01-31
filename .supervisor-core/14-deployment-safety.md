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

**Use deployment subagent:**
`/home/samuel/sv/.claude/commands/subagents/deployment/deploy-service-local.md`

**Triggers:** "deploy", "restart service", after code/config changes

**Subagent auto-handles:** Kill old, verify none, rebuild Docker with `--no-cache`, verify one, health checks

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
