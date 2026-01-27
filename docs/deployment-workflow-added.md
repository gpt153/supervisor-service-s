# Local Deployment Workflow Added

**Date**: 2026-01-27
**Added by**: Meta-Supervisor (MS)

---

## Summary

Created comprehensive local deployment workflow to fix identified deployment issues.

---

## Files Created

### 1. Deployment Subagent

**Location**: `/home/samuel/sv/.claude/commands/subagents/deployment/deploy-service-local.md`

**Purpose**: Mandatory workflow for ALL local deployments (native and Docker)

**Size**: ~26KB (comprehensive with examples and error recovery)

**Key sections**:
- Pre-deployment validation
- Stop old instances (native/docker)
- Docker cleanup and rebuild
- Deploy new version
- Health check validation
- Port conflict check
- Update deployment status

### 2. Workflow Guide

**Location**: `/home/samuel/sv/docs/guides/local-deployment-workflow.md`

**Purpose**: Explain deployment workflow to PSes and developers

**Size**: ~10KB

**Content**:
- Problems solved
- Workflow phases
- Integration guide
- Error recovery
- Examples

---

## Problems Solved

### 1. Native Deployments: Multiple Instances on Same Port

**Issue**: PS forgets to kill old version before starting new one. Multiple instances run simultaneously.

**Symptoms**:
- Port conflicts
- Random 502/503 errors
- High CPU usage
- Stale code still serving

**Solution**: Exhaustive process search with patterns, SIGTERM then SIGKILL, verify zero instances.

### 2. Docker Deployments: Old Code Deployed

**Issue**: PS forgets to rebuild Docker image after commit/push. Old code runs in container.

**Symptoms**:
- New features don't appear
- Bug fixes don't take effect
- Environment changes ignored
- Image shows old commit

**Solution**: Mandatory `docker compose build --no-cache` before starting containers.

### 3. Docker Cleanup: Disk Fill and VM Crashes

**Issue**: Old containers and images accumulate. Disk fills, VM crashes.

**Symptoms**:
- "No space left on device"
- Build failures
- VM instability
- Manual cleanup required

**Solution**: Automatic cleanup every deployment (remove old images, prune dangling resources, clear cache).

---

## Workflow Overview

1. **Pre-deployment**: Verify code committed/pushed
2. **Stop old**: Kill all instances (native) or containers (docker)
3. **Cleanup**: Remove old Docker artifacts, rebuild with --no-cache
4. **Deploy**: Start service with latest code
5. **Health check**: Verify service running (12 attempts, 1 min)
6. **Port check**: Verify exactly ONE listener on port
7. **Update docs**: Record deployment status

---

## Integration with PSes

**PS spawns deployment subagent**:

```javascript
Task({
  description: "Deploy service locally",
  prompt: `Deploy service to local development environment.

  Type: native|docker
  Project: project-name
  Path: /path/to/project
  Service: service-name
  Port: 5175
  Health: http://localhost:5175/health
  Start: npm run dev (native only)
  Docker compose: docker-compose.yml (docker only)

  See: /home/samuel/sv/.claude/commands/subagents/deployment/deploy-service-local.md`,
  subagent_type: "Bash",
  model: "haiku"
})
```

**Subagent returns JSON**:

Success:
```json
{
  "success": true,
  "deployment_type": "docker",
  "commit_hash": "abc123",
  "old_instances_killed": 2,
  "docker_cleanup": {
    "images_removed": 4,
    "disk_freed_percent": 7
  },
  "health_check": {"status": "passed"},
  "port_verification": {"listeners": 1}
}
```

Failure:
```json
{
  "success": false,
  "phase": "health_check",
  "error": "Health check failed",
  "recovery_suggestions": ["Check logs", "Verify config"]
}
```

---

## Validation Checklist

**ALL must pass**:
- [ ] Code committed and pushed
- [ ] Old instances killed (verified)
- [ ] Docker image rebuilt with --no-cache (if docker)
- [ ] Disk cleanup performed (if docker)
- [ ] Service started successfully
- [ ] Health check passed
- [ ] Only ONE instance on port

**If ANY fails, deployment STOPS.**

---

## Performance

**Native deployment**: 10-15 seconds
**Docker deployment**: 60-90 seconds (rebuild is slow but necessary)
**Docker cleanup**: +10-20 seconds

**Disk freed** (typical): 5-10% (500MB-1GB)

---

## Error Recovery

**Comprehensive recovery procedures for**:
1. Old instances won't die (zombies, systemd)
2. Docker build fails (syntax, disk, base image)
3. Health check never passes (logs, config, timing)
4. Port conflict after deployment (kill conflicting)
5. Disk full during cleanup (emergency prune)

---

## Differences from Production Deployment

**Local** (`deploy-service-local.md`):
- Fast deployment for development
- No staging environment
- No database migrations
- Light validation
- Immediate deployment

**Production** (`deploy-service.md`):
- Safe deployment for production
- Staging first, then production
- Database migrations with backups
- Comprehensive testing
- Blue-green or rolling updates
- Rollback procedures

---

## Next Steps

**PS developers**:
1. Review workflow in `/home/samuel/sv/.claude/commands/subagents/deployment/deploy-service-local.md`
2. Use for ALL local deployments
3. Never manually deploy (always spawn subagent)

**Future enhancements**:
1. Add telemetry (track deployment success rate)
2. Auto-tune health check timeout per service
3. Smart cleanup (keep images used in last 7 days)
4. Pre-deployment validation (lint, type check)

---

## Files Location Summary

```
/home/samuel/sv/
├── .claude/commands/subagents/deployment/
│   ├── deploy-service.md              # Production deployment
│   └── deploy-service-local.md        # ✨ NEW: Local deployment
├── docs/guides/
│   └── local-deployment-workflow.md   # ✨ NEW: Workflow guide
└── supervisor-service-s/docs/
    └── deployment-workflow-added.md   # This file
```

---

**Maintained by**: Meta-Supervisor (MS)
**Date added**: 2026-01-27
