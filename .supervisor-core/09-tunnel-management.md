# Tunnel Management - Autonomous CNAME Creation

**YOU CAN NOW CREATE PUBLIC URLS AUTONOMOUSLY**

PSs can deploy web-accessible services without meta-supervisor intervention using the tunnel manager.

---

## Available MCP Tools

You have 5 tunnel management tools:

### 1. Create CNAME (Main Tool)

```javascript
tunnel_request_cname({
  subdomain: "api",        // e.g., "api" → api.153.se
  domain: "153.se",        // Optional, defaults to 153.se
  targetPort: 5000,        // Port your service listens on
  projectName: "consilio"  // Auto-detected from context
})
```

**What it does:**
1. ✅ Validates port is allocated to your project
2. ✅ Determines optimal routing (localhost vs container-name)
3. ✅ Creates DNS CNAME in Cloudflare
4. ✅ Updates tunnel ingress config
5. ✅ Reloads tunnel gracefully
6. ✅ Returns public URL

**Example output:**
```
✅ CNAME created successfully!

URL: https://api.153.se
Target: http://localhost:5000
Type: localhost
```

### 2. Delete CNAME

```javascript
tunnel_delete_cname({
  hostname: "api.153.se"
})
```

**Note:** You can only delete your own CNAMEs.

### 3. List Your CNAMEs

```javascript
tunnel_list_cnames({
  projectName: "consilio"  // Auto-filtered to your project
})
```

### 4. Get Tunnel Status

```javascript
tunnel_get_status()
```

Shows tunnel health, uptime, restart count.

### 5. List Available Domains

```javascript
tunnel_list_domains()
```

Shows all domains available for CNAME creation.

---

## CRITICAL: ALWAYS Request CNAME for UI Projects

**If your project has ANY user-facing interface, you MUST request a CNAME during deployment.**

### UI Project Detection

Your project is a UI project if it has:
- ✅ `frontend/` or `client/` directory
- ✅ `public/` directory with HTML files
- ✅ UI frameworks in package.json (react, vue, next, svelte, etc.)
- ✅ README mentions "UI", "frontend", "dashboard", "web interface"

### Auto-Request CNAME During Deployment

**When deploying a UI project for the first time:**

```bash
# 1. Deploy service
docker compose up -d

# 2. IMMEDIATELY request CNAME (don't wait for user)
tunnel_request_cname({
  subdomain: "project-name",  # Main UI subdomain
  targetPort: 5000           # Or whatever port UI runs on
})

# 3. Auto-update documentation (see next section)

# 4. Verify tunnel active
tunnel_list_cnames()
```

**Don't ask permission** - this is part of deployment workflow for UI projects.

---

## CRITICAL: Auto-Update Deployment Documentation

**When you receive a successful CNAME creation response:**

The tunnel manager returns `deployment_documentation` in the response. You MUST update project docs automatically.

### Auto-Documentation Workflow

```javascript
// 1. Request CNAME
const response = tunnel_request_cname({
  subdomain: "consilio",
  targetPort: 5000
})

// 2. Response includes deployment_documentation:
{
  success: true,
  cname: "consilio.153.se",
  tunnel_name: "consilio-153-se",
  local_port: 5000,
  deployment_documentation: {
    quick_start_entry: "**Production:** https://consilio.153.se ...",
    deployment_status_entry: { ... },
    instructions_for_ps: "1. Add to QUICK-START.md..."
  }
}

// 3. UPDATE DOCS (automatically):
```

**Steps to execute (NO user permission needed):**

1. **Update .supervisor-specific/QUICK-START.md**:
   - Add `deployment_documentation.quick_start_entry` to "Production (Docker)" section

2. **Update .supervisor-specific/02-deployment-status.md**:
   - Update "Production Environment" section with tunnel details
   - Add public URL, tunnel name, internal port

3. **Regenerate CLAUDE.md**:
   ```bash
   cd /home/samuel/sv/supervisor-service-s
   npm run init-projects -- --project <your-project> --verbose
   ```

4. **Commit changes**:
   ```bash
   git add .supervisor-specific/ CLAUDE.md
   git commit -m "docs: update deployment config with tunnel <cname>"
   git push origin main
   ```

**This ensures deployment documentation stays current automatically.**

**See**: `/home/samuel/sv/docs/guides/auto-documentation-system.md` for complete workflow

---

## Workflow: Deploy Public Service

**Complete deployment in 3 steps:**

### Step 1: Allocate Port (if not already)

```javascript
port_allocate({
  port: 5000,
  projectName: "consilio",
  purpose: "API server"
})
```

### Step 2: Start Your Service

```bash
# Docker (with port mapping)
docker run -d --name consilio-api -p 5000:5000 my-image

# Or host service
npm start  # Listening on port 5000
```

### Step 3: Request CNAME

```javascript
tunnel_request_cname({
  subdomain: "api",
  targetPort: 5000
})
```

**Done!** Your service is now live at `https://api.153.se`

---

## Docker Intelligence (Automatic)

The tunnel manager automatically determines the best routing:

### Scenario A: Shared Network (Optimal)
- Your container shares network with cloudflared
- **Routing:** `http://container-name:PORT` (no -p needed!)
- **Advantage:** Better performance, no host port exposure

### Scenario B: Port Binding
- Container has `-p PORT:PORT` flag
- **Routing:** `http://localhost:PORT`
- **Advantage:** Works without shared network

### Scenario C: Host Service
- Service runs on host (not Docker)
- **Routing:** `http://localhost:PORT`
- **Advantage:** Simple, no Docker needed

### Scenario D: Unreachable (Error)
- Container not exposed, no shared network
- **Result:** Request rejected with fix recommendations

**You don't need to think about this** - the tunnel manager figures it out!

---

## Common Patterns

### Pattern 1: Simple API Deployment

```javascript
// Already have port allocated
tunnel_request_cname({
  subdomain: "api",
  targetPort: 5000
})
// → https://api.153.se
```

### Pattern 2: Multiple Services

```javascript
tunnel_request_cname({ subdomain: "api", targetPort: 5000 })
tunnel_request_cname({ subdomain: "web", targetPort: 5073 })
tunnel_request_cname({ subdomain: "admin", targetPort: 5001 })
```

### Pattern 3: Custom Domain

```javascript
tunnel_list_domains()  // See available domains

tunnel_request_cname({
  subdomain: "app",
  domain: "openhorizon.cc",  // Use different domain
  targetPort: 3000
})
// → https://app.openhorizon.cc
```

### Pattern 4: Cleanup

```javascript
tunnel_delete_cname({ hostname: "api.153.se" })
```

---

## Error Handling

### Error: "Port not allocated to project"

**Fix:** Allocate the port first:
```javascript
port_allocate({ port: 5000, projectName: "consilio", purpose: "API" })
```

### Error: "Subdomain already in use"

**Fix:** Choose different subdomain or delete existing:
```javascript
tunnel_delete_cname({ hostname: "api.153.se" })
```

### Error: "Service not reachable by cloudflared"

**Fix Option 1 (Recommended):** Connect cloudflared to your network:
```bash
docker network connect consilio-network cloudflared
```

**Fix Option 2:** Expose port to host:
```bash
docker run -p 5000:5000 my-container
```

---

## Important Rules

✅ **DO:**
- Create CNAMEs for your allocated ports only
- Delete CNAMEs when service is removed
- Use descriptive subdomains (api, web, admin, etc.)

❌ **DON'T:**
- Create CNAMEs for ports not allocated to you (will fail)
- Delete other PSs' CNAMEs (will fail)
- Forget to start your service before creating CNAME (will be unreachable)

---

## Permissions

**You can:**
- ✅ Create CNAMEs with your allocated ports
- ✅ Delete your own CNAMEs
- ✅ List your own CNAMEs
- ✅ View tunnel status
- ✅ List available domains

**You cannot:**
- ❌ Delete other PSs' CNAMEs (meta-supervisor only)
- ❌ Create CNAMEs on ports not allocated to you
- ❌ Manually restart tunnel (automatic only)

---

## Performance

- **CNAME creation:** 3-5 seconds
- **DNS propagation:** Instant (Cloudflare proxied)
- **Tunnel reload:** <2 seconds downtime
- **Health monitoring:** Automatic (30s intervals)
- **Auto-recovery:** <90s if tunnel fails

---

## Troubleshooting

**Check tunnel health:**
```javascript
tunnel_get_status()
```

**List your CNAMEs:**
```javascript
tunnel_list_cnames()
```

**Test your service locally first:**
```bash
curl http://localhost:5000
```

**Verify port allocation:**
```javascript
port_list({ projectName: "consilio" })
```

---

## Full Documentation

**Detailed guides:**
- Complete docs: `/home/samuel/sv/supervisor-service-s/docs/tunnel-manager.md`
- Deployment: `/home/samuel/sv/supervisor-service-s/docs/tunnel-manager-deployment.md`
- Implementation: `/home/samuel/sv/supervisor-service-s/src/tunnel/README.md`

**Epic & ADRs:**
- Epic: `.bmad/epics/005-tunnel-manager.md`
- ADRs: `.bmad/adr/001-sqlite-for-tunnel-state.md` (and 002, 003)

---

**Status:** Production Ready (2026-01-20)
**Maintained by:** Meta-supervisor
**Support:** Autonomous - no manual intervention needed
