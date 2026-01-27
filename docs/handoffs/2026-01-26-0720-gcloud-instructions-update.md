# Handoff: Update Core Instructions for GCloud OAuth Capabilities

**Date:** 2026-01-26 07:20 UTC
**From:** Meta-Supervisor (GCloud implementation session)
**To:** docs-expert
**Priority:** Medium
**Estimated Time:** 15-20 minutes

---

## Context

**What was implemented:**
- Full OAuth 2.0 credential management (6 new MCP tools)
- Extended VM management capabilities (now 11 total VM tools)
- 3 GCloud projects configured (odin, odin3, openhorizon)
- Cross-project OAuth support documented

**Current problem:**
The core instructions in `.supervisor-core/04-tools.md` are outdated and don't reflect the full GCloud capabilities.

---

## Current State (Outdated)

**File:** `.supervisor-core/04-tools.md`
**Lines:** 72-78

```markdown
## Infrastructure MCP Tools

| Category | Tools |
|----------|-------|
| **Tunnels** | `tunnel_request_cname`, `tunnel_delete_cname`, `tunnel_list_cnames` |
| **Secrets** | `mcp_meta_set_secret`, `mcp_meta_get_secret`, `mcp_meta_list_secrets` |
| **Ports** | `mcp_meta_allocate_port` |
| **GCloud** | `mcp_gcloud_create_vm`, `mcp_gcloud_delete_vm`, `mcp_gcloud_create_bucket` |
```

**Problems:**
1. Only lists 3 GCloud tools (we now have 17)
2. Doesn't mention OAuth management at all
3. Doesn't reference the new comprehensive documentation

---

## Desired State

**Replace lines 72-78 in `.supervisor-core/04-tools.md` with:**

```markdown
## Infrastructure MCP Tools

| Category | Tools | Count |
|----------|-------|-------|
| **Tunnels** | `tunnel_request_cname`, `tunnel_delete_cname`, `tunnel_list_cnames` | 3 |
| **Secrets** | `mcp_meta_set_secret`, `mcp_meta_get_secret`, `mcp_meta_list_secrets` | 3 |
| **Ports** | `mcp_meta_allocate_port`, `mcp_meta_get_port`, `mcp_meta_list_ports` | 3 |
| **GCloud VM** | `gcloud_create_vm`, `gcloud_list_vms`, `gcloud_start_vm`, `gcloud_stop_vm`, `gcloud_resize_vm`, `gcloud_delete_vm`, `gcloud_vm_health`, `gcloud_auto_scale`, and 3 more | 11 |
| **GCloud OAuth** | `gcloud_create_oauth_brand`, `gcloud_create_oauth_client`, `gcloud_list_oauth_brands`, `gcloud_list_oauth_clients`, and 2 more | 6 |

**GCloud capabilities:**
- VM management across 3 projects (odin, odin3, openhorizon)
- OAuth 2.0 credential creation and management
- Auto-scaling based on CPU/memory metrics
- Health monitoring and alerts
- Cross-project support (any PS can manage any project)

**GCloud documentation:**
- Complete guide: `/home/samuel/sv/supervisor-service-s/docs/gcloud-oauth-management.md`
- PS examples: `/home/samuel/sv/supervisor-service-s/docs/gcloud-ps-examples.md`
- Cross-project setup: `/home/samuel/sv/supervisor-service-s/docs/oauth-cross-project-setup.md`
- Full status: `/home/samuel/sv/supervisor-service-s/docs/gcloud-full-status.md`
```

---

## Additional Instructions Section (Optional Enhancement)

**Consider adding a new section after line 86:**

```markdown
---

## GCloud Management

**PSes have full autonomous access to:**

### VM Operations
- Create/delete VMs in any project
- Start/stop/resize VMs
- Monitor health (CPU, RAM, disk)
- Auto-scale based on metrics
- List VMs across all projects

### OAuth Operations
- Create OAuth consent screens (brands)
- Create OAuth 2.0 clients
- Retrieve client IDs and secrets
- Store credentials in vault automatically
- Delete/rotate credentials

### Cross-Project Support
- Any PS can manage VMs in any GCloud project
- OAuth credentials from one project (e.g., odin) can be used by VMs in another project (e.g., odin3)
- Service accounts have Owner role permissions

**Quick examples:**
```javascript
// Create VM and tunnel
const vm = await gcloud_create_vm({
  project: "odin3",
  zone: "us-central1-a",
  name: "app-server",
  machineType: "e2-medium",
  diskSizeGB: 30
});

const tunnel = await tunnel_request_cname({
  subdomain: "app",
  targetPort: 8080
});
// Result: https://app.153.se

// Create OAuth credentials
const client = await gcloud_create_oauth_client({
  project: "odin",
  displayName: "Production Client"
});
// Returns: { clientId, secret }
// Automatically stores in vault
```

**Documentation:**
- All GCloud docs: `/home/samuel/sv/supervisor-service-s/docs/gcloud-*.md`
```

---

## Files to Update

**Primary file:**
- `.supervisor-core/04-tools.md` (lines 72-78, possibly add new section)

**After updating, regenerate CLAUDE.md:**
```bash
cd /home/samuel/sv/supervisor-service-s
npm run init-projects -- --verbose
```

**Then commit:**
```bash
git add .supervisor-core/04-tools.md CLAUDE.md
git commit -m "docs: update core instructions with GCloud OAuth capabilities"
```

---

## Verification Checklist

After making changes, verify:

- [ ] `.supervisor-core/04-tools.md` lists all 17 GCloud tools (or grouped as shown above)
- [ ] OAuth management capabilities are mentioned
- [ ] References to new documentation files are included
- [ ] CLAUDE.md has been regenerated
- [ ] File size of CLAUDE.md is still < 40KB
- [ ] New instructions are clear and concise (following core instruction style)
- [ ] Changes committed to git

---

## Reference Information

**Total GCloud tools implemented:** 17

**VM Management (11):**
1. gcloud-list-projects
2. gcloud-list-vms
3. gcloud-get-vm
4. gcloud-create-vm
5. gcloud-start-vm
6. gcloud-stop-vm
7. gcloud-delete-vm
8. gcloud-resize-vm
9. gcloud-vm-health
10. gcloud-evaluate-scaling
11. gcloud-auto-scale

**OAuth Management (6):**
12. gcloud-list-oauth-brands
13. gcloud-create-oauth-brand
14. gcloud-list-oauth-clients
15. gcloud-create-oauth-client
16. gcloud-get-oauth-client
17. gcloud-delete-oauth-client

**Configured projects:**
- odin (odin-455918)
- odin3 (odin3-477909)
- openhorizon (openhorizon-cc)

**Documentation created:**
- `docs/gcloud-oauth-management.md` (300+ lines)
- `docs/gcloud-ps-examples.md` (250+ lines)
- `docs/oauth-cross-project-setup.md` (400+ lines)
- `docs/gcloud-full-status.md` (400+ lines)

**Commits with implementation:**
- `499b97a` - OAuth management tools
- `90ad55f` - Odin3 project setup and docs

---

## Questions to Consider

1. **Should we add a dedicated section for GCloud in 04-tools.md?**
   - Pro: Makes capabilities more visible
   - Con: Increases file size (currently ~87 lines)
   - Recommendation: Add if it fits within size guidelines (~130 lines max)

2. **Should we mention OAuth in 01-identity.md?**
   - Pro: PSes know they can handle OAuth autonomously
   - Con: 01-identity.md is focused on role/principles
   - Recommendation: Leave as-is, OAuth is covered in tools

3. **Should we create a new `.supervisor-core/12-gcloud-integration.md`?**
   - Pro: Dedicated file for GCloud capabilities
   - Con: Adds another file to maintain
   - Recommendation: Only if 04-tools.md becomes too large

---

## Style Guidelines

**When updating core instructions:**
- Keep it concise (core files are 60-130 lines)
- Use tables for quick reference
- Include "and X more" to avoid listing every tool
- Reference detailed docs for complete information
- Use ✅ for capabilities that work
- Use examples sparingly (save for detailed docs)

**Follow existing patterns in 04-tools.md:**
- Infrastructure tools table (lines 72-78)
- Quick reference format
- References section at bottom (lines 82-86)

---

## Additional Context

**Why this matters:**
- PSes currently don't know about OAuth capabilities in their core instructions
- Users may not realize PSes can autonomously set up OAuth
- Without updated instructions, PSes might not use these powerful tools
- Current instructions make GCloud appear limited (only 3 tools mentioned)

**Expected outcome:**
- PSes understand full GCloud capabilities
- OAuth setup becomes standard practice
- Users realize PSes can handle end-to-end infrastructure
- Better visibility of the 95% automation we've achieved

---

## Resume Commands

```bash
# Navigate to correct directory
cd /home/samuel/sv/supervisor-service-s

# Read current instructions
cat .supervisor-core/04-tools.md

# Edit the file
# (Use your preferred method)

# Regenerate CLAUDE.md
npm run init-projects -- --verbose

# Verify
wc -l .supervisor-core/04-tools.md CLAUDE.md
wc -c CLAUDE.md  # Should be < 40KB

# Commit
git add .supervisor-core/04-tools.md CLAUDE.md
git commit -m "docs: update core instructions with GCloud OAuth capabilities"
```

---

**Status:** Ready for docs-expert
**Blocking:** No (existing instructions still work, just incomplete)
**Priority:** Medium (improves PS awareness, not critical)
