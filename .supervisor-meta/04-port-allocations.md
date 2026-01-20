# Port Allocation Registry

**Last Updated**: 2026-01-19

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

---

## Detailed Port Assignments

### Consilio (5000-5099)

| Service | Port | Purpose | Status |
|---------|------|---------|--------|
| Backend API | 5000 | Express API | ✅ Migrated |
| PostgreSQL | 5032 | Database | ✅ Migrated |
| Frontend (dev) | 5073 | Vite dev server | ✅ Assigned |
| Frontend (tunnel) | 5175 | Nginx proxy | ✅ Active |

**Public Access:**
- `consilio.153.se` → `localhost:5175`

---

### Health-Agent (5100-5199)

| Service | Port | Purpose | Status |
|---------|------|---------|--------|
| API (dev) | 5100 | FastAPI REST API | ✅ Migrated |
| PostgreSQL | 5132 | Database | ✅ Migrated |
| Redis | 5179 | Cache | ✅ Migrated |
| Metrics | 5180 | Prometheus | ✅ Migrated |
| OTLP | 5181 | OpenTelemetry | ✅ Migrated |
| Telegram Bot | N/A | No port needed | ✅ Active |

**Public Access:**
- No public URL (Telegram bot only)

---

### OpenHorizon (5200-5299)

| Service | Port | Purpose | Status |
|---------|------|---------|--------|
| Frontend | 5200 | Next.js app | ✅ Assigned |
| Backend | 5201 | API server | ✅ Assigned |
| PostgreSQL | 5232 | Database (pipeline) | ✅ Migrated |
| Redis | 5279 | Cache (pipeline) | ✅ Migrated |
| Weaviate | 5280 | Vector DB | ✅ Migrated |
| MinIO | 5281 | S3 storage | ✅ Migrated |
| MinIO Console | 5282 | Admin UI | ✅ Migrated |

**Public Access:**
- `oh.153.se` → `localhost:5174` (configured, not active)
- Production: `openhorizon.cc` (Cloud Run)
- Production: `app.openhorizon.cc` (Cloud Run)

---

### Odin (5300-5399)

| Service | Port | Purpose | Status |
|---------|------|---------|--------|
| API | 5300 | FastAPI server | ✅ Migrated |
| Frontend | 5301 | React dashboard | ✅ Reserved |
| PostgreSQL | 5332 | Database | ✅ Migrated |
| Redis | 5379 | Task queue | ✅ Migrated |

**Public Access:**
- No public deployment (local only)

---

### Supervisor Infrastructure (8000-8099)

| Service | Port | Purpose | Status |
|---------|------|---------|--------|
| Supervisor MCP | 3100 | MCP HTTP endpoint | ✅ Active |
| PostgreSQL | 5432 | Supervisor DB | ❌ Not running |

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

---

## Migration Status

### Completed Migrations ✅

**Consilio (5000-5099):**
- ✅ Backend: 3000 → 5000
- ✅ PostgreSQL: 5432 → 5032
- ✅ Frontend: 5173 → 5073
- ✅ Nginx: Updated to proxy 5073 + 5000

**Health-Agent (5100-5199):**
- ✅ API: 8080 → 5100
- ✅ PostgreSQL: 5436 → 5132
- ✅ Redis: 6379 → 5179
- ✅ Metrics: 8000 → 5180
- ✅ OTLP: 4318 → 5181

**OpenHorizon (5200-5299):**
- ✅ PostgreSQL: 15432 → 5232
- ✅ Redis: 6381 → 5279
- ✅ Weaviate: 8081 → 5280
- ✅ MinIO: 9000 → 5281
- ✅ MinIO Console: 9001 → 5282

**Odin (5300-5399):**
- ✅ API: 8000 → 5300
- ✅ PostgreSQL: 5432 → 5332
- ✅ Redis: 6379 → 5379

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
