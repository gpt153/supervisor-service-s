# Port Management

**Last Updated**: 2026-01-20

---

## 🚨 CRITICAL: Port Range Compliance

**YOU MUST ONLY USE PORTS FROM YOUR ASSIGNED RANGE. NO EXCEPTIONS.**

### Before Configuring ANY Service

**MANDATORY validation checklist:**

1. ✅ **Read your assigned range** from `.supervisor-specific/02-deployment-status.md`
2. ✅ **Verify port is within range** before using it
3. ✅ **Request allocation** if you need a new port
4. ❌ **NEVER use default ports** (3000, 4000, 8080, etc.) without verification

### Common Port Pitfalls (AVOID!)

| ❌ Default Port | ✅ What You Should Do |
|----------------|---------------------|
| 3000, 4000, 8080 | Use port from YOUR range |

**If tempted to use "common" port → STOP and verify your assigned range first.**

---

## Port Allocation Strategy

**Your Project's Port Range:**
- **ALWAYS check** `.supervisor-specific/02-deployment-status.md` for your assigned range
- Typically: 100 ports per project (e.g., 5000-5099, 5100-5199)

**Reserved Infrastructure Ports:**
- **8000-8099**: Supervisor infrastructure (MCP server, etc.)
- **3000-3099**: Legacy/shared ports (DO NOT USE)

---

## Requesting Ports

**MANDATORY workflow:**

1. Identify service (frontend, backend, database, etc.)
2. Read your range from deployment status file
3. Pick next available port from YOUR range
4. Request: `mcp_meta_allocate_port({ port, projectName, purpose })`
5. Update `.env`, `docker-compose.yml`, deployment docs

**MS validates**: Port in your range, not already allocated. Rejects if outside range.

---

## Quick Deployment Workflow

**CRITICAL: Port MUST be in your assigned range.**

**Steps:**
1. Verify port in YOUR range (check deployment docs)
2. Allocate: `mcp_meta_allocate_port({ port, projectName, purpose })`
3. Start service: `docker compose up -d`
4. Request CNAME: `tunnel_request_cname({ subdomain, targetPort })`

---

**Complete guide**: `/home/samuel/sv/docs/guides/port-management-guide.md`

**Maintained by**: Meta-supervisor (MS)
