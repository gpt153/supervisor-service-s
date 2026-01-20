# Port Management

**Last Updated**: 2026-01-19

---

## Port Allocation Strategy

Each project in the SV system is assigned a dedicated port range to prevent conflicts.

**Your Project's Port Range:**
- Check `.supervisor-specific/` files for your assigned range
- Typically: 100 ports per project (e.g., 5000-5099, 5100-5199)

**Reserved Infrastructure Ports:**
- **8000-8099**: Supervisor infrastructure (MCP server, etc.)
- **3000-3099**: Legacy/shared ports (avoid using)

---

## Requesting Ports

### Need a New Port?

Ask the meta-supervisor (MS) to allocate a port from your range:

**In Supervisor Session in Browser (SSB):**
```
Use MCP tool: mcp__meta__allocate_port

Parameters:
- projectName: your-project-name
- serviceName: postgres | redis | api | frontend | etc.
- purpose: Brief description
```

**In Supervisor Session in CLI (SSC):**
```
Contact meta-supervisor to request port allocation
```

The meta-supervisor (MS) will:
1. Check your project's allocated range
2. Find next available port
3. Update central port registry
4. Return assigned port

---

## Checking Port Usage

**See what's using a port:**
```bash
# Check specific port
lsof -i :5000

# All listening ports on system
sudo lsof -i -P -n | grep LISTEN

# Docker port mappings
docker ps --format "table {{.Names}}\t{{.Ports}}"
```

**Kill process on port:**
```bash
# Find and kill
kill $(lsof -ti:5000)
```

---

## Port Configuration Files

**Update these when using new ports:**
- `docker-compose.yml` - Docker port mappings
- `.env.example` - Document port variables
- `README.md` - Update deployment docs

**Example docker-compose.yml:**
```yaml
services:
  postgres:
    ports:
      - "5032:5432"  # Map external:internal
```

**Example .env:**
```bash
API_PORT=5000
DATABASE_PORT=5032
```

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

1. **Check what's using it:**
   ```bash
   lsof -i :5000
   ```

2. **Ask meta-supervisor (MS):**
   - "Which port should I use for [service]?"
   - MS will consult central registry
   - MS will assign available port from your range

3. **Update configuration:**
   - Update docker-compose.yml
   - Update .env.example
   - Restart services

---

**Maintained by**: Meta-supervisor (MS)
**Port Registry**: Centrally managed by meta-supervisor
