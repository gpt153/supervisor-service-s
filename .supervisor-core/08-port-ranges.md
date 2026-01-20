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

| ❌ Default Port | Project Using It | ✅ What You Should Do |
|----------------|------------------|---------------------|
| 3000 | Common Node.js default | Use port from YOUR range |
| 4000 | Common API default | Use port from YOUR range |
| 5000 | Flask/Python default | Check if it's in YOUR range |
| 8000 | Common server default | Reserved for infrastructure |
| 8080 | Common alt-HTTP | Use port from YOUR range |

**If you're tempted to use a "common" port → STOP and verify your assigned range first.**

---

## Port Allocation Strategy

Each project in the SV system is assigned a dedicated port range to prevent conflicts.

**Your Project's Port Range:**
- **ALWAYS check** `.supervisor-specific/02-deployment-status.md` for your assigned range
- Typically: 100 ports per project (e.g., 5000-5099, 5100-5199)
- **Example ranges:**
  - consilio-s: 5000-5099
  - odin-s: 5100-5199
  - openhorizon-s: 5200-5299
  - health-agent-s: 5300-5399

**Reserved Infrastructure Ports:**
- **8000-8099**: Supervisor infrastructure (MCP server, etc.)
- **3000-3099**: Legacy/shared ports (DO NOT USE)

---

## Requesting Ports

### Before Using a New Port

**MANDATORY workflow:**

1. Identify service (frontend, backend, database, etc.)
2. Read your range from `.supervisor-specific/02-deployment-status.md`
3. Pick next available port from YOUR range
4. Request allocation:
   - **SSB**: Use `mcp__meta__allocate_port` MCP tool
   - **SSC**: Contact meta-supervisor (MS)
5. Update `.env`, `docker-compose.yml`, deployment docs

**MS validates:** Port in your range, not already allocated. Rejects if outside range.

---

## Checking Port Usage

**Quick commands:**
- Check port: `lsof -i :5000`
- Kill process: `kill $(lsof -ti:5000)`
- Docker ports: `docker ps --format "table {{.Names}}\t{{.Ports}}"`

---

## Port Configuration Files

**MUST update these when using new ports:**
- `docker-compose.yml` - Docker port mappings
- `.env` - Runtime configuration
- `.env.example` - Template for new environments
- `.supervisor-specific/02-deployment-status.md` - Document allocation

**Key Rule:** External/host ports MUST be in your range. Internal container ports can be anything.

**Examples:** See `/home/samuel/sv/docs/guides/port-management-examples.md` for complete configuration examples

---

## Reserved System Ports (Never Use)

| Port | Reserved For |
|------|--------------|
| 22 | SSH |
| 80 | HTTP |
| 443 | HTTPS |
| 3737 | Old Archon system |
| 8051 | Old Archon MCP |

---

## Port Conflicts

**If you encounter a port conflict:**
1. Check what's using it: `lsof -i :5000`
2. Ask meta-supervisor (MS) for available port from your range
3. Update docker-compose.yml, .env files, and restart services

---

**Maintained by**: Meta-supervisor (MS)
**Port Registry**: Centrally managed by meta-supervisor
