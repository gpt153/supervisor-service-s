# Deployment Safety Protocol

**🚨 CRITICAL: ALWAYS Kill Old Instances Before Deploying**

This is a **MANDATORY** rule that has prevented MANY hours of debugging phantom errors.

---

## The Problem

**Multiple instances running simultaneously causes:**
- Confusing errors (which instance is serving requests?)
- Port conflicts
- Wasted hours debugging
- Stale code running
- Database connection exhaustion

**This happens with:**
- ✅ Docker containers
- ✅ Native backends (Node.js, Python, Go)
- ✅ Native frontends (Vite, Next.js, webpack)

---

## MANDATORY RULE

**Before EVERY deployment (Docker, native backend, native frontend):**

```
🚨 KILL ALL OLD INSTANCES FIRST
🚨 VERIFY NONE REMAIN
🚨 THEN START NEW INSTANCE
🚨 VERIFY ONLY ONE INSTANCE RUNNING
```

**NO EXCEPTIONS.**

---

## Quick Checklist

**Docker Deployments:**
- [ ] `docker compose down` (stop old containers)
- [ ] `docker compose rm -f` (remove old containers)
- [ ] Verify: `docker ps | grep <project>` (should be empty)
- [ ] `docker compose up -d` (start new)
- [ ] Verify: `docker ps | grep <project>` (exactly one)

**Native Deployments:**
- [ ] Find old: `ps aux | grep <service>`
- [ ] Kill all: `kill -9 <pids>`
- [ ] Verify: `ps aux | grep <service>` (none)
- [ ] Start new: `npm run dev` (or equivalent)
- [ ] Verify: `ps aux | grep <service>` (exactly one)
- [ ] Verify port: `lsof -i :<port>` (exactly one listener)

---

## Implementation

**Use the deployment subagent:**
- `/home/samuel/sv/.claude/commands/subagents/deployment/deploy-service-local.md`

**This subagent AUTOMATICALLY:**
- ✅ Kills ALL old instances (exhaustive search)
- ✅ Verifies none remain
- ✅ Rebuilds Docker images with `--no-cache`
- ✅ Starts new instance
- ✅ Verifies only ONE instance on port
- ✅ Runs health checks
- ✅ Cleans up old Docker artifacts

**You MUST use this subagent for ALL local deployments.**

---

## When This Applies

**ALWAYS when deploying:**
- New feature implemented
- Bug fix deployed
- Config changed
- Service restarted
- Code updated

**ALL deployment types:**
- Docker containers
- Native Node.js/npm services
- Native Python/FastAPI services
- Native Go services
- Frontend dev servers (Vite, Next.js, webpack)

---

## Verification Steps

**After EVERY deployment, verify:**

```bash
# Check port usage (MUST be exactly 1)
lsof -i :<port> | grep LISTEN

# For Docker
docker ps | grep <project>  # Exactly one container

# For native
ps aux | grep <service> | grep -v grep  # Exactly one process
```

**If multiple instances found:**
1. 🚨 STOP immediately
2. Kill all instances
3. Verify none remain
4. Start deployment again

---

## Why This Is Critical

**Real-world impact:**
- User deploys new backend code
- Old backend still running on port
- New backend fails to start (port conflict)
- OR new backend starts on different port (confusion)
- OR both running (random requests go to old code)
- Hours wasted debugging "why isn't my code change working"
- **Fix**: Kill old instance first

**This rule saves hours every week.**

---

## References

**Detailed Workflow:**
- `/home/samuel/sv/.claude/commands/subagents/deployment/deploy-service-local.md`

**When to use deployment subagent:**
- ALWAYS for local deployments (native or Docker)
- After feature implementation
- After code changes
- When user says "deploy" or "restart service"

---

**Maintained by**: Documentation Expert
**Applies to**: ALL supervisors (PSes and MS)
**Priority**: 🚨 CRITICAL - Non-negotiable
