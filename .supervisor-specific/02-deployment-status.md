# Deployment Status

**Project**: Supervisor Service (Meta)
**Updated**: 2026-01-27

---

## Live Deployments

| Service | Status | URL/Port |
|---------|--------|----------|
| MCP Server | ✅ | `localhost:8081` |
| PostgreSQL | ✅ | `localhost:5432` |
| Laptop Agent | ✅ | `localhost:8765` |
| Tunnel Manager | ✅ | Cloudflare daemon |

**Public (Tunnel ID: `aaffe732-9972-4f70-a758-a3ece1df4035`)**

| Service | URL | Target |
|---------|-----|--------|
| Laptop Agent | `mac.153.se` | `localhost:8765` |
| Consilio | `consilio.153.se` | `localhost:5175` |
| OpenHorizon | `oh.153.se` | `localhost:5174` (inactive) |

---

## Ports

**Meta (8000-8099)**

| Service | Port | Status |
|---------|------|--------|
| MCP Server | 8081 | ✅ |
| Laptop Agent | 8765* | ✅ |
| PostgreSQL | 5432 | ✅ |

*Outside managed range (VS Code conflict on 5200)

---

## Quick Start

```bash
# Start services
sudo systemctl start postgresql
cd /home/samuel/sv/supervisor-service-s
npm run dev:mcp
npm run dev:laptop-agent  # if needed

# Verify
curl http://localhost:8081/health
psql -U supervisor -d supervisor_meta -c "SELECT NOW();"
curl https://mac.153.se/health
```

---

## Environment

**Required in `.env`:**
```bash
PGUSER=supervisor
PGHOST=localhost
PGDATABASE=supervisor_meta
PGPASSWORD=<from-vault>
PGPORT=5432
MCP_PORT=8081
LAPTOP_AGENT_PORT=8765
TUNNEL_ID=aaffe732-9972-4f70-a758-a3ece1df4035
```

**Secrets:** `mcp_meta_get_secret` for:
- `meta/database/pgpassword`
- `meta/cloudflare/tunnel-token`
- `meta/cloudflare/api-token`

---

## Tunnel Manager

**Features (2026-01-27):**
- ✅ Health monitoring (30s checks, 3-strike)
- ✅ Auto-restart (exponential backoff)
- ✅ Docker intelligence
- ✅ CNAME lifecycle (create/delete)
- ✅ Ingress automation
- ✅ Port sync (5min)
- ✅ Config recovery

**MCP Tools:** `tunnel_get_status`, `tunnel_request_cname`, `tunnel_delete_cname`, `tunnel_list_cnames`, `tunnel_sync_port_allocations`, `tunnel_check_port_ingress`

**DB:** SQLite at `data/tunnel-manager.db`

---

## Known Issues

**Active:** None
**Debt:** Consider systemd for laptop agent

---

## Recent Changes

**2026-01-27:** Optimized Docker (blue-green: 10s vs 90s downtime)
**2026-01-24:** Laptop agent port 5200 → 8765, Tunnel ID updated, DNS operational

---

## References

**Guide:** `/home/samuel/sv/docs/guides/meta-supervisor-deployment-guide.md`
**Tunnel:** `/docs/tunnel-manager.md`, `/docs/tunnel-manager-deployment.md`
**Ports:** `.supervisor-core/08-port-ranges.md`, `.supervisor-meta/04-port-allocations.md`
