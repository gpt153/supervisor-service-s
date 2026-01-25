# Port Allocation Registry

**Last Updated**: 2026-01-21

---

## Project Port Ranges

| Project | Range | Status |
|---------|-------|--------|
| Consilio | 5000-5099 | ✅ Active |
| Health-Agent | 5100-5199 | ✅ Active |
| OpenHorizon | 5200-5299 | ✅ Active |
| Odin | 5300-5399 | ✅ Active |
| Supervisor Infrastructure | 8000-8099 | ✅ Active |
| Legacy/Shared | 3000-3099 | ⚠️ Deprecated |

**Detailed assignments**: See `/home/samuel/sv/docs/guides/port-allocations-detailed.md`

---

## Cloudflare Tunnel Configuration

**File:** `~/.cloudflared/config.yml`

```yaml
ingress:
  - hostname: consilio.153.se
    service: http://localhost:5175
  - hostname: oh.153.se
    service: http://localhost:5174
```

**Status:**
- ✅ `consilio.153.se` → Working
- ⚠️ `oh.153.se` → Configured but not active

**Migration history**: See detailed guide

---

## Resolved Port Conflicts

| Original Port | Conflict | Resolution |
|---------------|----------|------------|
| 3000 | Consilio + OpenHorizon | Consilio → 5000, OpenHorizon → 5201 |
| 5432 | Consilio + Odin | Consilio → 5032, Odin → 5332 |
| 8080 | Health-Agent | → 5100 |
| 6379 | Health-Agent + Odin | Health-Agent → 5179, Odin → 5379 |

✅ **All conflicts resolved**

---

## Reserved Ports (Never Allocate)

| Port | Reserved For | Reason |
|------|--------------|--------|
| 22 | SSH | System service |
| 80 | HTTP | Web servers |
| 443 | HTTPS | Web servers |
| 3737 | Archon | Old system (avoid conflicts) |
| 8051 | Archon MCP | Old system (avoid conflicts) |
| 8081 | Super | Old system (avoid conflicts) |
| 8082 | Super MCP | Old system (avoid conflicts) |

---

## Port Allocation Workflow

**When a PS requests a port:**

1. **Identify project** - Determine which project needs port
2. **Check range** - Look up project's allocated range above
3. **Find available** - Check which ports in range are unused
4. **Assign next** - Allocate next sequential port in range
5. **Update registry** - Update this document
6. **Notify PS** - Return assigned port to project-supervisor

**Example:**
- Health-Agent PS needs a new cache service
- Health-Agent range: 5100-5199
- Currently using: 5100, 5132, 5179, 5180, 5181
- Next available: 5182
- Assign: 5182 for new cache service

---

**Maintained by**: Meta-supervisor (MS) only
**Update frequency**: Every port allocation change
