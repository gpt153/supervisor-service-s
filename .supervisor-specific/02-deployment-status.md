# Deployment Status

**Project**: Supervisor Service (Meta Infrastructure)
**Last Updated**: 2026-01-24

---

## Live Deployments

### Development (Local)

| Service | Status | URL/Port | Notes |
|---------|--------|----------|-------|
| MCP Server | ✅ Running | `localhost:8081` | HTTP endpoint |
| PostgreSQL | ✅ Running | `localhost:5432` | Supervisor database |
| Laptop Agent | ✅ Running | `localhost:8765` | WebSocket server (changed from 5200 due to VS Code conflict) |
| Tunnel Manager | ✅ Running | Cloudflare daemon | Manages public URLs |

### Production

**Tunnel ID**: `aaffe732-9972-4f70-a758-a3ece1df4035`

| Service | Status | Public URL | Target |
|---------|--------|------------|--------|
| Laptop Agent | ✅ Operational | `mac.153.se` | `localhost:8765` |
| Consilio | ✅ Operational | `consilio.153.se` | `localhost:5175` |
| OpenHorizon | ⚠️ Configured | `oh.153.se` | `localhost:5174` (not active) |

**DNS Status**: All `*.153.se` domains operational via Cloudflare Tunnel

---

## Service Ports

**Supervisor Infrastructure (8000-8099)**

| Service | Port | Purpose | Status |
|---------|------|---------|--------|
| MCP Server | 8081 | HTTP MCP endpoint | ✅ Active |
| Laptop Agent | 8765 | WebSocket server | ✅ Active |

**Database**

| Service | Port | Purpose | Status |
|---------|------|---------|--------|
| PostgreSQL | 5432 | Supervisor metadata DB | ✅ Running |

**Port Range Notes**:
- Original laptop agent port was 5200 (from OpenHorizon range)
- Changed to 8765 due to VS Code live server conflict on port 5200
- 8765 is outside managed port ranges (dedicated for laptop agent)

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Tunnel                         │
│                  (aaffe732-9972-4f70-a758...)                │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
  mac.153.se          consilio.153.se         oh.153.se
  (port 8765)         (port 5175)             (port 5174)
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Laptop Agent │     │   Consilio   │     │ OpenHorizon  │
│  (VS Code)   │     │   Frontend   │     │  (inactive)  │
└──────────────┘     └──────────────┘     └──────────────┘

┌─────────────────────────────────────────────────────────────┐
│              Supervisor Service (localhost)                  │
├─────────────────────────────────────────────────────────────┤
│  MCP Server (8081)  │  PostgreSQL (5432)                    │
│  - Project mgmt     │  - Epics & Issues                     │
│  - Health checks    │  - Health metrics                     │
│  - Tunnel mgmt      │  - Service status                     │
│  - Port allocations │  - Learning index                     │
└─────────────────────────────────────────────────────────────┘
         │                           │
         ▼                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Project Supervisors (PSes)                      │
├─────────────────────────────────────────────────────────────┤
│  Consilio PS  │  Odin PS  │  OpenHorizon PS  │ Health PS   │
│  (5000-5099)  │ (5300-5399) │  (5200-5299)   │ (5100-5199) │
└─────────────────────────────────────────────────────────────┘
```

---

## How to Run Locally

### Start Core Services

```bash
# Start PostgreSQL (if not running)
sudo systemctl start postgresql

# Start MCP Server
cd /home/samuel/sv/supervisor-service-s
npm run dev:mcp

# Start Laptop Agent (if needed)
npm run dev:laptop-agent
```

### Verify Services

```bash
# Check MCP Server
curl http://localhost:8081/health

# Check database connection
psql -U supervisor -d supervisor_meta -c "SELECT NOW();"

# Check Cloudflare Tunnel
curl https://mac.153.se/health
```

### Access URLs

**Local Development**:
- MCP Server: `http://localhost:8081`
- Laptop Agent: `ws://localhost:8765`

**Public (Tunnel)**:
- Laptop Agent: `https://mac.153.se`
- Consilio: `https://consilio.153.se`

---

## Environment Variables

**Required in `.env`**:

```bash
# Database
PGUSER=supervisor
PGHOST=localhost
PGDATABASE=supervisor_meta
PGPASSWORD=<from-vault>
PGPORT=5432

# MCP Server
MCP_PORT=8081

# Laptop Agent
LAPTOP_AGENT_PORT=8765

# Cloudflare Tunnel
TUNNEL_ID=aaffe732-9972-4f70-a758-a3ece1df4035
```

**Secrets stored in vault** (use `mcp_meta_get_secret`):
- `meta/database/pgpassword`
- `meta/cloudflare/tunnel-token`

---

## Database Info

**Connection String (Development)**:
```
postgresql://supervisor:<password>@localhost:5432/supervisor_meta
```

**Migrations**:
```bash
# Create migration
npm run migrate:create <name>

# Run migrations
npm run migrate:up

# Rollback
npm run migrate:down
```

**Current Schema**:
- `issues` - Issue tracking
- `epics` - Epic management
- `health_metrics` - Service health data
- `learning_index` - Learning embeddings
- `port_allocations` - Port registry

---

## Deployment Workflow

### Deploy MCP Server Update

1. Test locally: `npm run dev:mcp`
2. Build: `npm run build`
3. Restart: `systemctl restart supervisor-mcp` (if systemd service)
4. Verify: `curl http://localhost:8081/health`

### Update Tunnel Configuration

1. Update `.env` with new `TUNNEL_ID` if changed
2. Restart Cloudflare daemon: `sudo systemctl restart cloudflared`
3. Verify DNS: `dig mac.153.se` and `curl https://mac.153.se/health`

### Database Migration

1. Create migration: `npm run migrate:create <name>`
2. Test locally: `npm run migrate:up`
3. Backup production: `pg_dump supervisor_meta > backup.sql`
4. Run in production: `npm run migrate:up`
5. Verify: Check application logs

---

## Known Issues

**Resolved**:
- ✅ Laptop agent port conflict with VS Code (5200 → 8765)
- ✅ Tunnel ID updated to latest deployment
- ✅ DNS propagation for `mac.153.se` confirmed operational

**Active**:
- None

**Technical Debt**:
- Consider moving laptop agent to dedicated systemd service
- Add health check monitoring for tunnel connectivity
- Implement automatic tunnel failover

---

## Recent Changes

**2026-01-24**:
- Updated laptop agent port from 5200 to 8765 (VS Code conflict)
- Updated tunnel ID to `aaffe732-9972-4f70-a758-a3ece1df4035`
- Confirmed `mac.153.se` DNS operational
- Added port conflict notes to documentation

**2026-01-21**:
- Added secrets management workflow
- Updated tunnel management documentation

**2026-01-20**:
- Port range system implemented
- Migration to project-specific port ranges completed

---

**Maintained by**: Meta-Supervisor (MS)
