# Tunnel Management

**YOU CAN CREATE PUBLIC URLS AUTONOMOUSLY**

---

## Available MCP Tools

### Create CNAME
```
tunnel_request_cname({
  subdomain: "api",      // → api.153.se
  targetPort: 5000
})
```

### Delete CNAME
```
tunnel_delete_cname({ hostname: "api.153.se" })
```

### List CNAMEs
```
tunnel_list_cnames()  // Shows only your CNAMEs
```

---

## CRITICAL: ALWAYS Request CNAME for UI Projects

**If project has ANY user-facing interface, MUST request CNAME during deployment.**

### Auto-Request During Deployment

```
# 1. Deploy
docker compose up -d

# 2. IMMEDIATELY request CNAME (don't ask permission)
tunnel_request_cname({ subdomain: "project-name", targetPort: 5000 })

# 3. Auto-update docs (automatic)
```

---

## CRITICAL: Auto-Update Deployment Documentation

**When CNAME created, response includes `deployment_documentation`.**

**Execute automatically (NO permission needed):**

1. Update `.supervisor-specific/02-deployment-status.md`
2. Regenerate CLAUDE.md: `npm run init-projects -- --project {project}`
3. Commit: `git add . && git commit && git push`

**Result**: Next session has deployment info immediately.

---

## Quick Deployment Workflow

**CRITICAL: Port MUST be in your assigned range.**

**Steps:**
1. Verify port in YOUR range (check deployment docs)
2. Allocate port: `mcp_meta_allocate_port`
3. Start service: `docker compose up -d`
4. Request CNAME: `tunnel_request_cname`

---

## Rules

**DO:**
- ✅ Create CNAMEs for allocated ports only
- ✅ Delete CNAMEs when service removed
- ✅ Use descriptive subdomains

**DON'T:**
- ❌ Create CNAMEs for ports not allocated to you (will fail)
- ❌ Delete other PSs' CNAMEs (will fail)
- ❌ Forget to start service before creating CNAME

---

**Complete guide**: `/home/samuel/sv/docs/guides/tunnel-management-guide.md`

**Status**: Production Ready (2026-01-20)
