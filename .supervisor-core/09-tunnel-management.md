# Tunnel Management

**YOU CREATE PUBLIC URLS AUTONOMOUSLY**

---

## Tunnel Service

**Backend service manages public URLs:**

- Request CNAME: subdomain + target port → public URL (e.g., api.153.se)
- Delete CNAME: remove public URL
- List CNAMEs: view your project's active URLs

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
2. Allocate port via meta-supervisor
3. Start: `docker compose up -d`
4. Request CNAME via tunnel service
5. Commit changes

---

## Rules

✅ Create for allocated ports only
✅ Delete when service removed
❌ Can't use other PSs' ports
❌ Can't delete other PSs' CNAMEs

---

**Complete guide**: `/home/samuel/sv/docs/guides/tunnel-management-guide.md`
