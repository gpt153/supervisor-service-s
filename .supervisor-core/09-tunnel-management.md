# Tunnel Management

**YOU CAN CREATE PUBLIC URLS AUTONOMOUSLY**

---

## Available MCP Tools

### 1. Create CNAME
```javascript
tunnel_request_cname({
  subdomain: "api",      // → api.153.se
  targetPort: 5000
})
```

### 2. Delete CNAME
```javascript
tunnel_delete_cname({ hostname: "api.153.se" })
```

### 3. List CNAMEs
```javascript
tunnel_list_cnames()  // Shows only your CNAMEs
```

### 4. Get Status
```javascript
tunnel_get_status()  // Tunnel health
```

### 5. List Domains
```javascript
tunnel_list_domains()  // Available domains
```

---

## CRITICAL: ALWAYS Request CNAME for UI Projects

**If project has ANY user-facing interface, MUST request CNAME during deployment.**

### UI Project Detection

✅ Has `frontend/` or `client/` directory
✅ Has `public/` with HTML
✅ Has UI frameworks (react, vue, next, svelte) in package.json
✅ README mentions "UI", "frontend", "dashboard"

### Auto-Request During Deployment

```bash
# 1. Deploy
docker compose up -d

# 2. IMMEDIATELY request CNAME (don't wait)
tunnel_request_cname({
  subdomain: "project-name",
  targetPort: 5000
})

# 3. Auto-update docs (see next section)
```

**Don't ask permission** - this is part of deployment workflow.

---

## CRITICAL: Auto-Update Deployment Documentation

**When CNAME created, response includes `deployment_documentation`:**

```json
{
  "deployment_documentation": {
    "quick_start_entry": "**Production:** https://consilio.153.se...",
    "deployment_status_entry": { ... },
    "instructions_for_ps": "1. Update... 2. Regenerate... 3. Commit..."
  }
}
```

**Execute automatically (NO permission needed):**

1. Update `.supervisor-specific/02-deployment-status.md` with production URL
2. Regenerate CLAUDE.md:
   ```bash
   cd /home/samuel/sv/supervisor-service-s
   npm run init-projects -- --project <your-project> --verbose
   ```
3. Commit changes:
   ```bash
   git add .supervisor-specific/ CLAUDE.md
   git commit -m "docs: update deployment config with tunnel <cname>"
   git push origin main
   ```

**Result**: Next session has deployment info in context immediately.

**See**: `/home/samuel/sv/docs/guides/auto-documentation-system.md`

---

## Quick Deployment Workflow

**3 steps:**

1. **Allocate port** (if not already):
   ```javascript
   port_allocate({ port: 5000, projectName: "consilio", purpose: "API" })
   ```

2. **Start service**:
   ```bash
   docker compose up -d
   ```

3. **Request CNAME**:
   ```javascript
   tunnel_request_cname({ subdomain: "api", targetPort: 5000 })
   ```

**Done!** Service live at `https://api.153.se`

---

## Error Handling

### "Port not allocated to project"
```javascript
port_allocate({ port: 5000, projectName: "consilio", purpose: "API" })
```

### "Subdomain already in use"
```javascript
tunnel_delete_cname({ hostname: "api.153.se" })
// Then create new one
```

### "Service not reachable"
```bash
# Expose port to host
docker run -p 5000:5000 my-container
```

---

## Rules

**DO:**
- ✅ Create CNAMEs for your allocated ports only
- ✅ Delete CNAMEs when service removed
- ✅ Use descriptive subdomains (api, web, admin)

**DON'T:**
- ❌ Create CNAMEs for ports not allocated to you (will fail)
- ❌ Delete other PSs' CNAMEs (will fail)
- ❌ Forget to start service before creating CNAME

---

**Complete guide**: `/home/samuel/sv/supervisor-service-s/docs/tunnel-manager.md`

**Status**: Production Ready (2026-01-20)
