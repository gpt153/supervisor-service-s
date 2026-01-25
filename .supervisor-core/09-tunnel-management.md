# Tunnel Management

**YOU CREATE PUBLIC URLS AUTONOMOUSLY**

---

## MCP Tools

```javascript
tunnel_request_cname({ subdomain: "api", targetPort: 5000 })  // → api.153.se
tunnel_delete_cname({ hostname: "api.153.se" })
tunnel_list_cnames()  // Your CNAMEs only
```

---

## CRITICAL: Auto-Request for UI Projects

**If project has user-facing interface, MUST request CNAME during deployment.**

**Workflow:**
1. Deploy: `docker compose up -d`
2. **IMMEDIATELY** request CNAME (no permission needed)
3. Auto-update docs (response includes deployment_documentation)
4. Regenerate CLAUDE.md
5. Commit

**Port MUST be in your assigned range.**

---

## Quick Deployment

1. Verify port in YOUR range
2. Allocate: `mcp_meta_allocate_port`
3. Start: `docker compose up -d`
4. CNAME: `tunnel_request_cname`
5. Commit changes

---

## Rules

✅ Create for allocated ports only
✅ Delete when service removed
❌ Can't use other PSs' ports
❌ Can't delete other PSs' CNAMEs

---

**Complete guide**: `/home/samuel/sv/docs/guides/tunnel-management-guide.md`
