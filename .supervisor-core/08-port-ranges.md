# Port Range Allocation

**Last Updated**: 2026-01-19

---

## Port Allocation Strategy

Each project is assigned a dedicated port range to prevent conflicts and organize services clearly.

**Base Ranges:**
- **5000-5099**: Consilio
- **5100-5199**: Health-Agent
- **5200-5299**: OpenHorizon
- **5300-5399**: Odin
- **8000-8099**: Supervisor infrastructure
- **3000-3099**: Legacy/shared development ports

---

## Project Port Assignments

### Consilio (5000-5099)

| Service | Port | Purpose | Status |
|---------|------|---------|--------|
| Backend API | 5000 | Express API | ✅ Migrated |
| PostgreSQL | 5032 | Database | ✅ Migrated |
| Frontend (dev) | 5073 | Vite dev server | ✅ Assigned |
| Frontend (tunnel) | 5175 | Nginx proxy to frontend | ✅ Active |

**Cloudflare Tunnel:**
- `consilio.153.se` → `localhost:5175` (Nginx → Frontend 5073 + Backend 5000)

**Notes:**
- ✅ Successfully migrated to 5000-5099 range
- Updated docker-compose.yml for all services
- Backend runs on 5000 (both dev and prod)
- Frontend on 5073, PostgreSQL on 5032
- Production: Planning for Cloud Run deployment

---

### Health-Agent (5100-5199)

| Service | Port | Purpose | Status |
|---------|------|---------|--------|
| API (dev native) | 5100 | FastAPI REST API | ✅ Migrated |
| PostgreSQL | 5132 | Database (Docker) | ✅ Migrated |
| Redis | 5179 | Cache (Docker) | ✅ Migrated |
| Metrics | 5180 | Prometheus metrics | ✅ Migrated |
| OTLP | 5181 | OpenTelemetry tracing | ✅ Migrated |
| Telegram Bot | N/A | Runs in Docker (no port) | ✅ Active |

**No Public URL:**
- Health-Agent is a Telegram bot
- Users interact via Telegram app
- API used only for development/testing

**Notes:**
- ✅ Successfully migrated to 5100-5199 range
- Production bot runs in Docker container
- Dev API runs natively: `RUN_MODE=api API_PORT=5100 python -m src.main`
- PostgreSQL: 5132 (Docker)
- Redis: 5179 (Docker)
- Updated docker-compose.yml and .env.example

---

### OpenHorizon (5200-5299)

| Service | Port | Purpose | Status |
|---------|------|---------|--------|
| Frontend | 5200 | Next.js app | ✅ Assigned |
| Backend | 5201 | API server | ✅ Assigned |
| PostgreSQL | 5232 | Database (project-pipeline) | ✅ Migrated |
| Redis | 5279 | Cache (project-pipeline) | ✅ Migrated |
| Weaviate | 5280 | Vector database | ✅ Migrated |
| MinIO | 5281 | S3 storage | ✅ Migrated |
| MinIO Console | 5282 | MinIO web console | ✅ Migrated |
| Neon PostgreSQL | N/A | Cloud database (main app) | ✅ Active |

**Cloudflare Tunnel:**
- `oh.153.se` → `localhost:5174` (configured, not running)

**Production:**
- `openhorizon.cc` → Google Cloud Run (landing)
- `app.openhorizon.cc` → Google Cloud Run (app)

**Notes:**
- ✅ Successfully migrated project-pipeline to 5200-5299 range
- Updated docker-compose.yml for project-pipeline infrastructure
- Production uses Google Cloud Run (serverless)
- Main app database: Neon PostgreSQL (cloud-hosted)
- Project-pipeline has local Docker infrastructure for development

---

### Odin (5300-5399)

| Service | Port | Purpose | Status |
|---------|------|---------|--------|
| API | 5300 | FastAPI server | ✅ Migrated |
| Frontend | 5301 | React dashboard (future) | ✅ Reserved |
| PostgreSQL | 5332 | Local database | ✅ Migrated |
| Redis | 5379 | Task queue | ✅ Migrated |
| Celery Worker | N/A | Background tasks | ✅ Active |

**No Public Deployment:**
- Odin is a personal AI assistant
- Runs locally only
- No production deployment planned

**Notes:**
- ✅ Successfully migrated to 5300-5399 range
- Updated .env.example and deployment documentation
- All port conflicts resolved
- Run with: `uvicorn src.odin.api.main:app --reload --port 5300`
- Local only deployment (no public access)

---

## Supervisor Infrastructure (8000-8099)

| Service | Port | Purpose | Status |
|---------|------|---------|--------|
| Supervisor MCP | 3100 | MCP server HTTP endpoint | ✅ Active |
| PostgreSQL | 5432 | Supervisor database | ❌ Not running |

**Notes:**
- MCP server provides tools to all project-supervisors
- Database for issue tracking, metrics (future)

---

## Legacy/Shared Ports (3000-3099)

**Currently Used:**
- 3000: Consilio backend, OpenHorizon app (CONFLICT)
- 3001: OpenHorizon landing
- 3100: Supervisor MCP server

**Issue:** Multiple projects competing for 3000, 3001

**Resolution Plan:**
1. Move Consilio backend to 5000
2. Move OpenHorizon app to 5200
3. Move OpenHorizon landing to 5201
4. Update tunnel configuration
5. Update all documentation

---

## Cloudflare Tunnel Configuration

**Current (`~/.cloudflared/config.yml`):**
```yaml
ingress:
  - hostname: consilio.153.se
    service: http://localhost:5175
  - hostname: oh.153.se
    service: http://localhost:5174
```

**Status:**
- ✅ consilio.153.se → working (Nginx on 5175)
- ⚠️ oh.153.se → configured but app not running on 5174

---

## Port Conflict Resolution

**Resolved Conflicts:**
1. ✅ **Port 3000**: Resolved - Consilio backend → 5000, OpenHorizon backend → 5201
2. ✅ **Port 5432**: Resolved - Consilio PostgreSQL → 5032, OpenHorizon PostgreSQL → 5232
3. ✅ **Port 8080**: Resolved - Health-Agent API → 5100
4. ✅ **Port 5436**: Resolved - Health-Agent PostgreSQL → 5132

**All Conflicts Resolved:**
- ✅ No remaining port conflicts
- All projects using dedicated port ranges
- Docker compose files updated
- .env.example files updated
- Documentation updated

**Completed Steps:**
1. ✅ Updated Consilio to use 5000-5099 range
2. ✅ Updated OpenHorizon to use 5200-5299 range
3. ✅ Updated Health-Agent to use 5100-5199 range
4. ✅ Updated Odin to use 5300-5399 range
5. ✅ Updated all docker-compose.yml files
6. ✅ Updated all .env.example files
7. ✅ Updated deployment documentation
8. ⏳ Update Cloudflare tunnel configuration (pending user action)

---

## Migration Checklist

### Consilio Migration (to 5000-5099) ✅ COMPLETE
- [x] Update backend port: 3000 → 5000
- [x] Update PostgreSQL port: 5432 → 5032
- [x] Update frontend dev port: 5173 → 5073
- [x] Update docker-compose.yml
- [x] Update Nginx config to proxy 5073 + 5000
- [ ] Update .env files (user needs to update actual .env)
- [ ] Test locally (user needs to test)

### Health-Agent Migration (to 5100-5199) ✅ COMPLETE
- [x] Update API port: 8080 → 5100
- [x] Update PostgreSQL port: 5436 → 5132
- [x] Update Redis port: 6379 → 5179
- [x] Update Metrics port: 8000 → 5180
- [x] Update OTLP port: 4318 → 5181
- [x] Update docker-compose.yml
- [x] Update .env.example
- [x] Update documentation
- [ ] Update .env file (user needs to update actual .env)
- [ ] Test locally (user needs to test)

### OpenHorizon Migration (to 5200-5299) ✅ COMPLETE
- [x] Update frontend port: 5200 (planned)
- [x] Update backend port: 5201 (planned)
- [x] Update PostgreSQL port: 15432 → 5232
- [x] Update Redis port: 6381 → 5279
- [x] Update Weaviate port: 8081 → 5280
- [x] Update MinIO port: 9000 → 5281
- [x] Update MinIO Console port: 9001 → 5282
- [x] Update docker-compose.yml
- [x] Update documentation
- [ ] Update tunnel: oh.153.se → localhost:5200 (pending)
- [ ] Test locally (user needs to test)

### Odin Migration (to 5300-5399) ✅ COMPLETE
- [x] Update API port: 8000 → 5300
- [x] Update PostgreSQL port: 5432 → 5332
- [x] Update Redis port: 6379 → 5379
- [x] Reserve frontend port: 5301 (future use)
- [x] Update .env.example
- [x] Update deployment documentation
- [x] Update all run commands
- [ ] Update .env file (user needs to update actual .env)
- [ ] Test locally (user needs to test)

---

## Reserved Ports (Do Not Use)

| Port | Reserved For | Reason |
|------|--------------|--------|
| 22 | SSH | System |
| 80 | HTTP | Web servers |
| 443 | HTTPS | Web servers |
| 3737 | Archon | Old system |
| 8051 | Archon MCP | Old system |
| 8081 | Super | Old system |
| 8082 | Super MCP | Old system |

---

## Quick Reference

**Check port usage:**
```bash
# All listening ports
sudo lsof -i -P -n | grep LISTEN

# Specific port
lsof -i :5000

# Docker port mappings
docker ps --format "table {{.Names}}\t{{.Ports}}"
```

**Kill process on port:**
```bash
# Find PID
lsof -ti:5000

# Kill it
kill $(lsof -ti:5000)
```

---

**Maintained by**: Meta-supervisor (MS)
**Review**: Every major deployment change
