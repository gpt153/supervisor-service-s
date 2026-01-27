# Epic 005: Tunnel Manager - Cloudflare Tunnel Management System

**Epic ID:** 005
**Created:** 2026-01-19
**Status:** Planning
**Priority:** High
**Complexity:** Level 3 (Large Feature - 1-2 days)
**Feature Request:** `.bmad/feature-requests/tunnel-manager.md`

---

## Project Context

**Project:** Supervisor-Service (Meta-Supervisor Infrastructure)
**Repository:** https://github.com/gpt153/supervisor-service
**Workspace:** `/home/samuel/sv/supervisor-service/`

**Tech Stack:**
- **Language:** TypeScript
- **Runtime:** Node.js 20+
- **Database:** PostgreSQL 17.7 (with pgcrypto, pgvector) + SQLite for tunnel-specific state
- **MCP Server:** JSON-RPC 2.0 over stdio transport
- **Cloudflare:** Tunnel ID `fe2ec8b5-790f-4973-ad07-e03a4e4dd45b`
- **Docker:** Container orchestration on VM

**Related Epics:**
- EPIC-003: Secrets Management (integration point)
- EPIC-004: Port Allocation (integration point)
- EPIC-005 (from EPIC-BREAKDOWN.md): Cloudflare Management (base functionality)

**Dependencies:**
- ✅ CloudflareManager exists (`src/cloudflare/CloudflareManager.ts`)
- ✅ PortManager exists (`src/ports/PortManager.ts`)
- ✅ SecretsManager exists (`src/secrets/SecretsManager.ts`)
- ✅ MCP server infrastructure operational
- ✅ Cloudflare API tokens stored in secrets
- ✅ Docker runtime on VM

---

## Business Context

### Problem Statement

Currently, Cloudflare tunnel management is entirely manual, creating significant operational bottlenecks:

1. **No Health Monitoring** - Tunnel failures go undetected until services become unreachable
2. **Manual CNAME Creation** - PSs must request meta-supervisor intervention to deploy new services
3. **Manual Ingress Configuration** - Editing `/etc/cloudflared/config.yml` and restarting tunnel is tedious and error-prone
4. **No Docker Network Intelligence** - Difficult to determine when to use `localhost:PORT` vs `container-name:PORT` in ingress rules
5. **No State Tracking** - No record of which PS owns which CNAME, making cleanup and auditing impossible
6. **Single Domain Limitation** - Only manages 153.se, but Cloudflare account has multiple domains

**Impact:** Blocks PS autonomy, creates manual bottleneck at MS level, increases error rate, prevents scalability.

### Value Proposition

**For Project Supervisors (PSs):**
- Deploy web-accessible services autonomously (no MS intervention)
- CNAME + ingress rule creation in <10 seconds (vs minutes manually)
- Clear error messages guide through Docker networking issues
- Complete visibility into tunnel health

**For Meta-Supervisor:**
- Eliminates manual CNAME/ingress management workload
- 99.9% tunnel uptime via auto-restart
- Complete audit trail for compliance/debugging
- Scales to support many PSs without bottleneck

**For Users:**
- Faster service deployments
- Higher reliability (auto-recovery)
- Better developer experience

### Success Metrics

**Functional:**
- ✅ Tunnel maintains 99.9% uptime (auto-recovery within 60s)
- ✅ PSs create CNAMEs in <10s end-to-end
- ✅ All existing CNAMEs continue working (backward compatible)
- ✅ Docker network detection 100% accurate
- ✅ Zero manual intervention for routine operations

**Non-Functional:**
- ✅ Health monitoring overhead <1% CPU
- ✅ SQLite database <100MB even with 1000 CNAMEs
- ✅ MCP tool response time <500ms (excluding tunnel reload)
- ✅ All operations audited and traceable
- ✅ Clear, actionable error messages for all failure scenarios

---

## Requirements (MoSCoW)

### MUST HAVE (MVP - This Epic)

#### 1. Tunnel Health Monitoring

- [ ] **Background Monitor Service**
  - Monitor tunnel process health every 30 seconds
  - Check via process existence AND connectivity test
  - Track metrics: status (up/down/restarting), uptime_seconds, restart_count, last_healthy_at
  - Store health snapshots in `tunnel_health` table (SQLite)
  - Emit MCP events to all PSs on status change

- [ ] **Health Detection Logic**
  - Detect failure via: process crash, 3 consecutive failed connectivity tests (90s total)
  - Cloudflared location detection: host service OR container (inspect systemd/docker)
  - For container: track which Docker networks cloudflared belongs to

#### 2. Auto-Restart Logic

- [ ] **Restart Strategy**
  - Trigger restart on: process crash, 3 failed health checks, manual MCP request
  - Exponential backoff: 5s, 15s, 30s, 1min, 5min (max), then repeat at 5min
  - Unlimited retries (critical infrastructure)
  - Graceful restart: SIGTERM → 10s grace period → SIGKILL if needed

- [ ] **Restart Execution**
  - For systemd service: `systemctl restart cloudflared`
  - For Docker container: `docker restart cloudflared`
  - Log all restart attempts to `audit_log` table
  - Notify all PSs via MCP event (tunnel_down, tunnel_up)

#### 3. Multi-Domain Support

- [ ] **Domain Discovery**
  - On startup: call Cloudflare API to list all zones in account
  - Store in `domains` table: domain, zone_id, discovered_at
  - Refresh domain list: on startup, on demand via MCP tool, every 24h

- [ ] **Domain Management**
  - Support CNAME creation on any discovered domain
  - Default to `153.se` if domain not specified in request
  - Validate domain exists before attempting CNAME creation
  - MCP tool to list available domains

#### 4. CNAME Request Workflow

- [ ] **Request Validation**
  - PS provides: `subdomain`, `domain` (optional, defaults to 153.se), `targetPort`, `projectName` (auto-detected from MCP context)
  - Validate port is allocated to requesting PS (call PortManager)
  - Validate subdomain not already taken on that domain (check `cnames` table + Cloudflare API)
  - Validate domain exists in account (check `domains` table)

- [ ] **Intelligent Target Selection**
  - Determine if service is containerized or host-based:
    - Query Docker: find container listening on `targetPort` in requesting project
    - If not found in Docker: assume host-based service
  - If containerized:
    - Check if cloudflared shares network with container
    - If yes: use `http://container-name:PORT` (optimal)
    - If no: check if port exposed with `-p` flag
      - If yes: use `http://localhost:HOST_PORT`
      - If no: REJECT with error + recommendations
  - If host-based: use `http://localhost:PORT`

- [ ] **Execution Pipeline**
  1. Create CNAME record in Cloudflare DNS API
     - Type: CNAME
     - Content: `fe2ec8b5-790f-4973-ad07-e03a4e4dd45b.cfargotunnel.com`
     - Proxied: true
     - TTL: 1 (automatic)
  2. Add ingress rule to `/etc/cloudflared/config.yml`
     - Read existing config (YAML parse)
     - Insert new rule BEFORE catch-all 404 rule
     - Write updated config (atomic operation)
     - Backup config to git: `git add config.yml && git commit -m "Add CNAME: {hostname}"`
  3. Reload tunnel gracefully (SIGHUP or restart based on cloudflared version)
  4. Store CNAME ownership in `cnames` table
  5. Store operation in `audit_log` table
  6. Return success with full URL to PS

#### 5. Docker Network Intelligence

- [ ] **Network Discovery**
  - Poll Docker API every 60 seconds for:
    - All networks: `docker network ls`
    - All containers: `docker ps`
    - Container details: `docker inspect` (networks, ports, labels)
  - Store in SQLite tables: `docker_networks`, `docker_containers`, `container_networks`, `container_ports`

- [ ] **Container-to-Project Mapping**
  - Use naming conventions: `{project}-{service}` (e.g., `consilio-web`)
  - Use labels if present: `com.supervisor.project=consilio`
  - Store `project_name` in `docker_containers` table

- [ ] **Connectivity Validation**
  - Before creating CNAME: validate cloudflared can reach target
  - Test strategies:
    - Shared network: always reachable
    - Host port binding: test with `nc -zv localhost PORT` or HTTP request
    - No connectivity: reject with clear error

- [ ] **Error Messages & Recommendations**
  - **Error:** "Container `odin-api` is not reachable by cloudflared"
  - **Recommendation:** "Options: (1) Add cloudflared to `odin-network`: `docker network connect odin-network cloudflared` (2) Expose port: add `-p 3305:3305` to container (3) Run service on host instead"

#### 6. Ingress Rule Management

- [ ] **Config File Operations**
  - File: `/etc/cloudflared/config.yml`
  - Read: Parse YAML safely (handle malformed config)
  - Validate: Ensure `tunnel`, `credentials-file`, `ingress` sections exist
  - Write: Atomic operation (write to temp file → rename)
  - Backup: Git commit after every change

- [ ] **Ingress Rule Format**
  ```yaml
  ingress:
    - hostname: myapp.153.se
      service: http://localhost:3105
      originRequest:
        noTLSVerify: true  # For local services
    # ... more rules
    - service: http_status:404  # Catch-all (must be last)
  ```

- [ ] **Rule Ordering**
  - Insert new rules BEFORE catch-all 404 rule
  - Maintain catch-all as last rule (Cloudflare requirement)
  - Preserve existing rules when adding new ones

#### 7. State Management (SQLite)

- [ ] **Database Setup**
  - Location: `/home/samuel/sv/supervisor-service/data/tunnel-manager.db`
  - Library: `better-sqlite3` (synchronous API, faster for reads)
  - Migrations: Store in `src/tunnel/migrations/`

- [ ] **Schema**
  ```sql
  -- CNAME ownership tracking
  CREATE TABLE cnames (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subdomain TEXT NOT NULL,
    domain TEXT NOT NULL,
    full_hostname TEXT NOT NULL,  -- "myapp.153.se"
    target_service TEXT NOT NULL,  -- "http://localhost:3105"
    target_port INTEGER,
    target_type TEXT NOT NULL,  -- "localhost" | "container" | "external"
    container_name TEXT,  -- If target_type="container"
    docker_network TEXT,  -- If target_type="container"
    project_name TEXT NOT NULL,
    cloudflare_record_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,  -- PS identifier
    UNIQUE(subdomain, domain)
  );
  CREATE INDEX idx_cnames_project ON cnames(project_name);
  CREATE INDEX idx_cnames_hostname ON cnames(full_hostname);

  -- Tunnel health metrics
  CREATE TABLE tunnel_health (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL,  -- "up" | "down" | "restarting"
    uptime_seconds INTEGER,
    restart_count INTEGER,
    last_error TEXT
  );
  CREATE INDEX idx_tunnel_health_timestamp ON tunnel_health(timestamp);

  -- Discovered Cloudflare domains
  CREATE TABLE domains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT UNIQUE NOT NULL,
    zone_id TEXT NOT NULL,
    discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- Docker networks
  CREATE TABLE docker_networks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    network_name TEXT UNIQUE NOT NULL,
    network_id TEXT NOT NULL,
    driver TEXT,  -- "bridge" | "overlay" | "host"
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- Docker containers
  CREATE TABLE docker_containers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    container_name TEXT NOT NULL,
    container_id TEXT UNIQUE NOT NULL,
    image TEXT,
    status TEXT,  -- "running" | "stopped" | "paused"
    project_name TEXT,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX idx_containers_project ON docker_containers(project_name);

  -- Container network membership
  CREATE TABLE container_networks (
    container_id INTEGER NOT NULL,
    network_id INTEGER NOT NULL,
    ip_address TEXT,
    FOREIGN KEY(container_id) REFERENCES docker_containers(id) ON DELETE CASCADE,
    FOREIGN KEY(network_id) REFERENCES docker_networks(id) ON DELETE CASCADE,
    PRIMARY KEY(container_id, network_id)
  );

  -- Container port mappings
  CREATE TABLE container_ports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    container_id INTEGER NOT NULL,
    internal_port INTEGER NOT NULL,
    host_port INTEGER,  -- NULL if not exposed to host
    protocol TEXT DEFAULT 'tcp',
    FOREIGN KEY(container_id) REFERENCES docker_containers(id) ON DELETE CASCADE
  );
  CREATE INDEX idx_container_ports_internal ON container_ports(internal_port);
  CREATE INDEX idx_container_ports_host ON container_ports(host_port);

  -- Audit log
  CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    action TEXT NOT NULL,  -- "create_cname" | "delete_cname" | "restart_tunnel" | etc
    project_name TEXT,
    details TEXT,  -- JSON: {subdomain, domain, port, etc}
    success BOOLEAN NOT NULL,
    error_message TEXT
  );
  CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp);
  CREATE INDEX idx_audit_log_action ON audit_log(action);
  ```

#### 8. Integration Points

- [ ] **PortManager Integration**
  - Import: `import { PortManager } from '../ports/PortManager'`
  - Before CNAME creation: `await portManager.isPortAllocatedToProject(port, projectName)`
  - Reject if port not allocated to requesting project

- [ ] **SecretsManager Integration**
  - Import: `import { SecretsManager } from '../secrets/SecretsManager'`
  - Retrieve tokens: `await secretsManager.getSecret('meta/cloudflare/dns_edit_token')`
  - Retrieve tunnel ID: `await secretsManager.getSecret('meta/cloudflare/tunnel_id')`

- [ ] **CloudflareManager Extension**
  - Extend existing CloudflareManager with tunnel-specific methods
  - OR create TunnelCloudflareClient that wraps CloudflareManager
  - Methods needed: `createCNAME`, `deleteCNAME`, `listCNAMEs`, `listZones`

- [ ] **Docker API Integration**
  - Use `dockerode` library: `npm install dockerode @types/dockerode`
  - Methods: `listNetworks()`, `listContainers()`, `inspectContainer(id)`
  - Poll every 60 seconds, cache results in SQLite

#### 9. MCP Tool Suite (Core - 5 Tools)

All tools registered with MCP server at startup. Tools prefixed with `tunnel_`.

- [ ] **`tunnel_get_status`**
  - **Access:** All PSs + MS
  - **Input:** None
  - **Output:** `{ status: "up" | "down" | "restarting", uptime_seconds: number, restart_count: number, last_check: timestamp }`
  - **Implementation:** Query latest row from `tunnel_health` table

- [ ] **`tunnel_request_cname`**
  - **Access:** All PSs (scoped to their project) + MS
  - **Input:** `{ subdomain: string, domain?: string, targetPort: number, projectName?: string }`
  - **Output:** `{ success: true, url: string, ingress_target: string, target_type: string } | { success: false, error: string, recommendation: string }`
  - **Implementation:** Execute full validation → DNS → ingress → reload pipeline (see step 4)

- [ ] **`tunnel_delete_cname`**
  - **Access:** PS (own CNAMEs only) + MS (all CNAMEs)
  - **Input:** `{ hostname: string }`  (e.g., "myapp.153.se")
  - **Output:** `{ success: boolean, message: string }`
  - **Implementation:**
    1. Validate ownership (PS can only delete their own)
    2. Delete DNS record via Cloudflare API
    3. Remove ingress rule from config.yml
    4. Reload tunnel
    5. Delete from `cnames` table
    6. Log to `audit_log`

- [ ] **`tunnel_list_cnames`**
  - **Access:** All PSs (see own CNAMEs) + MS (see all)
  - **Input:** `{ projectName?: string, domain?: string }`
  - **Output:** `Array<{ hostname: string, target: string, project: string, created_at: timestamp }>`
  - **Implementation:** Query `cnames` table with filters, respect PS ownership

- [ ] **`tunnel_list_domains`**
  - **Access:** All PSs + MS
  - **Input:** None
  - **Output:** `Array<{ domain: string, zone_id: string }>`
  - **Implementation:** Query `domains` table (discovered zones)

---

### SHOULD HAVE (v1.1 - Future Epic)

#### Enhanced MCP Tools (4 Additional)

- [ ] `tunnel_restart` - Manual restart (MS only)
- [ ] `tunnel_get_metrics` - Usage stats per CNAME
- [ ] `tunnel_check_connectivity` - Test reachability pre-flight
- [ ] `tunnel_recommend_config` - Get setup recommendations

#### Advanced Features

- [ ] Audit logging UI/query tool
- [ ] PS event subscriptions (tunnel status webhooks)
- [ ] Pre-flight connectivity validation (dry-run mode)
- [ ] Configuration drift detection (container moved networks)
- [ ] Orphan detection & cleanup (weekly cron job)
- [ ] Project deletion cleanup (auto-remove all CNAMEs when PS deleted)

---

### COULD HAVE (v2.0 - Future)

- [ ] Traffic analytics per CNAME (request count, bandwidth)
- [ ] Network topology visualization
- [ ] Rate limiting per PS (prevent abuse)
- [ ] Custom origin settings per CNAME (timeout, TLS)
- [ ] Temporary CNAMEs with expiration
- [ ] Blue-green deployment support (multiple CNAMEs → same service)

---

### WON'T HAVE (Out of Scope)

- ❌ Custom tunnel infrastructure (use existing tunnel ID)
- ❌ Multi-tunnel support (multiple VMs)
- ❌ Load balancing across backends
- ❌ DDoS/WAF configuration (Cloudflare handles)
- ❌ SSL certificate management (Cloudflare handles)
- ❌ Custom DNS record types (only CNAME)
- ❌ Traffic routing based on headers/paths (Cloudflare handles)

---

## Architecture & Technical Approach

### Component Structure

```
src/tunnel/
├── TunnelManager.ts           # Main orchestrator
├── HealthMonitor.ts           # Background health checks (30s interval)
├── RestartManager.ts          # Auto-restart logic + exponential backoff
├── CNAMEManager.ts            # CNAME lifecycle (create/delete)
├── IngressManager.ts          # Config file operations (read/write/backup)
├── DockerNetworkIntel.ts      # Docker discovery + connectivity logic
├── TunnelDatabase.ts          # SQLite operations (schema + queries)
├── types.ts                   # TypeScript interfaces
├── migrations/
│   ├── 001_initial_schema.sql
│   └── ... (future migrations)
└── __tests__/
    ├── TunnelManager.test.ts
    ├── HealthMonitor.test.ts
    ├── CNAMEManager.test.ts
    └── DockerNetworkIntel.test.ts

src/mcp/tools/
├── tunnel_get_status.ts
├── tunnel_request_cname.ts
├── tunnel_delete_cname.ts
├── tunnel_list_cnames.ts
└── tunnel_list_domains.ts
```

### Key Classes & Interfaces

```typescript
// src/tunnel/types.ts
export interface TunnelStatus {
  status: 'up' | 'down' | 'restarting';
  uptime_seconds: number;
  restart_count: number;
  last_check: Date;
  cloudflared_location: 'host' | 'container';
  cloudflared_networks?: string[];  // If container
}

export interface CNAMERequest {
  subdomain: string;
  domain?: string;  // Defaults to 153.se
  targetPort: number;
  projectName: string;  // Auto-detected from MCP context
}

export interface CNAMEResult {
  success: boolean;
  url?: string;  // "https://myapp.153.se"
  ingress_target?: string;  // "http://localhost:3105"
  target_type?: 'localhost' | 'container' | 'external';
  container_name?: string;
  docker_network?: string;
  error?: string;
  recommendation?: string;
}

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: 'running' | 'stopped' | 'paused';
  project_name?: string;
  networks: string[];  // Network names
  ports: Array<{ internal: number; host?: number; protocol: string }>;
}

export interface IngressRule {
  hostname: string;
  service: string;  // "http://localhost:3105" or "http://container:3105"
  originRequest?: {
    noTLSVerify?: boolean;
  };
}

export interface IngressConfig {
  tunnel: string;
  credentials_file: string;
  ingress: IngressRule[];
}

// src/tunnel/TunnelManager.ts
export class TunnelManager {
  constructor(
    private cloudflareManager: CloudflareManager,
    private portManager: PortManager,
    private secretsManager: SecretsManager,
    private database: TunnelDatabase,
    private healthMonitor: HealthMonitor,
    private restartManager: RestartManager,
    private cnameManager: CNAMEManager,
    private ingressManager: IngressManager,
    private dockerIntel: DockerNetworkIntel
  ) {}

  async initialize(): Promise<void> {
    // 1. Initialize SQLite database (run migrations)
    // 2. Discover Cloudflare domains
    // 3. Start Docker network polling (60s)
    // 4. Start health monitoring (30s)
  }

  async requestCNAME(request: CNAMERequest): Promise<CNAMEResult> {
    // Main entry point for CNAME creation
    // Orchestrates validation → DNS → ingress → reload
  }

  async deleteCNAME(hostname: string, requestingProject: string): Promise<boolean> {
    // Main entry point for CNAME deletion
  }

  async getStatus(): Promise<TunnelStatus> {
    return this.healthMonitor.getStatus();
  }

  async listCNAMEs(filters?: { projectName?: string; domain?: string }): Promise<CNAME[]> {
    return this.database.queryCNAMEs(filters);
  }

  async listDomains(): Promise<Array<{ domain: string; zone_id: string }>> {
    return this.database.queryDomains();
  }
}
```

### Data Flow

**CNAME Creation Flow:**
```
PS calls tunnel_request_cname
  ↓
TunnelManager.requestCNAME()
  ↓
[1. Validate]
  → PortManager: check port allocation
  → TunnelDatabase: check subdomain availability
  → TunnelDatabase: validate domain exists
  ↓
[2. Docker Intelligence]
  → DockerNetworkIntel: find container on port
  → DockerNetworkIntel: check cloudflared connectivity
  → Determine target: localhost vs container-name
  ↓
[3. DNS Creation]
  → CloudflareManager: create CNAME record
  → Store cloudflare_record_id
  ↓
[4. Ingress Update]
  → IngressManager: read config.yml
  → IngressManager: add rule (before catch-all)
  → IngressManager: write config atomically
  → IngressManager: git commit backup
  ↓
[5. Tunnel Reload]
  → RestartManager: graceful reload (SIGHUP)
  ↓
[6. State Tracking]
  → TunnelDatabase: insert into cnames table
  → TunnelDatabase: insert into audit_log
  ↓
[7. Return Result]
  ← CNAMEResult { success: true, url: "https://myapp.153.se", ... }
```

**Health Monitoring Flow:**
```
HealthMonitor (runs every 30s)
  ↓
[1. Check Process]
  → systemctl status cloudflared OR docker ps | grep cloudflared
  ↓
[2. Check Connectivity]
  → HTTP request to tunnel status endpoint OR ping test
  ↓
[3. Record Result]
  → TunnelDatabase: insert into tunnel_health
  ↓
[4. Detect Failure]
  → If 3 consecutive failures (90s):
      ↓
      RestartManager.restart()
        ↓
        [Restart with exponential backoff]
        [Emit MCP event: tunnel_down]
        ↓
        [Wait for recovery]
        ↓
        [Emit MCP event: tunnel_up]
```

### Key Technical Decisions (ADRs Created)

All ADRs created and documented in `.bmad/adr/`:

1. **[ADR-001: SQLite for Tunnel State vs PostgreSQL](../adr/001-sqlite-for-tunnel-state.md)**
   - Decision: Use SQLite for tunnel-specific state
   - Rationale: Low overhead, no network latency, simple deployment, sufficient for read-heavy workload
   - Trade-offs: No multi-VM support (but out of scope)
   - Status: Accepted

2. **[ADR-002: Ingress Target Selection Algorithm](../adr/002-ingress-target-selection-algorithm.md)**
   - Decision: Prefer container names over localhost when shared network exists
   - Rationale: Better performance (no port binding overhead), more secure (no host exposure)
   - Trade-offs: Requires Docker network discovery overhead
   - Status: Accepted

3. **[ADR-003: Health Monitoring and Auto-Restart Strategy](../adr/003-health-monitoring-and-restart-strategy.md)**
   - Decision: 30-second interval with 3-strike failure detection
   - Decision: Exponential backoff with unlimited retries
   - Rationale: Balance between responsiveness (90s to detect) and overhead (<1% CPU); tunnel is critical infrastructure
   - Trade-offs: Not instant detection; no circuit breaker
   - Status: Accepted

### Files to Create

**New Files:**
```
src/tunnel/TunnelManager.ts                     (Main orchestrator)
src/tunnel/HealthMonitor.ts                     (Health checks + event emitter)
src/tunnel/RestartManager.ts                    (Restart logic + backoff)
src/tunnel/CNAMEManager.ts                      (CNAME lifecycle)
src/tunnel/IngressManager.ts                    (Config YAML operations)
src/tunnel/DockerNetworkIntel.ts                (Docker discovery)
src/tunnel/TunnelDatabase.ts                    (SQLite wrapper)
src/tunnel/types.ts                             (TypeScript interfaces)
src/tunnel/migrations/001_initial_schema.sql    (Database schema)
src/mcp/tools/tunnel_get_status.ts              (MCP tool)
src/mcp/tools/tunnel_request_cname.ts           (MCP tool)
src/mcp/tools/tunnel_delete_cname.ts            (MCP tool)
src/mcp/tools/tunnel_list_cnames.ts             (MCP tool)
src/mcp/tools/tunnel_list_domains.ts            (MCP tool)
src/tunnel/__tests__/TunnelManager.test.ts      (Unit tests)
src/tunnel/__tests__/HealthMonitor.test.ts      (Unit tests)
src/tunnel/__tests__/CNAMEManager.test.ts       (Unit tests)
src/tunnel/__tests__/DockerNetworkIntel.test.ts (Unit tests)
```

**Modified Files:**
```
src/index.ts                                    (Register TunnelManager + MCP tools)
src/cloudflare/CloudflareManager.ts             (Add tunnel-specific methods if needed)
package.json                                    (Add dependencies: better-sqlite3, dockerode, yaml, js-yaml)
```

### Dependencies to Add

```json
{
  "dependencies": {
    "better-sqlite3": "^9.2.2",
    "dockerode": "^4.0.2",
    "js-yaml": "^4.1.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.8",
    "@types/dockerode": "^3.3.23",
    "@types/js-yaml": "^4.0.9"
  }
}
```

---

## Implementation Tasks (GitHub Issues)

Break this epic into the following GitHub issues for SCAR implementation:

### Phase 1: Foundation (Database + Core Infrastructure)

**Issue #1: Database Schema & Migrations**
- **Title:** "Tunnel Manager: SQLite Database Schema Setup"
- **Description:** Create SQLite database with 8 tables for tunnel state tracking
- **Tasks:**
  - [ ] Create `TunnelDatabase.ts` class
  - [ ] Write migration `001_initial_schema.sql` (8 tables)
  - [ ] Implement migration runner
  - [ ] Add CRUD methods for each table
  - [ ] Unit tests for database operations
- **Acceptance:**
  - [ ] Database created at `/home/samuel/sv/supervisor-service/data/tunnel-manager.db`
  - [ ] All 8 tables exist with correct schema
  - [ ] Migrations run automatically on startup
  - [ ] Unit tests pass with 90%+ coverage
- **Estimated:** 2 hours
- **Dependencies:** None

**Issue #2: Docker Network Intelligence**
- **Title:** "Tunnel Manager: Docker Network Discovery & Tracking"
- **Description:** Implement Docker API integration for network/container discovery
- **Tasks:**
  - [ ] Create `DockerNetworkIntel.ts` class
  - [ ] Implement `discoverNetworks()` - poll every 60s
  - [ ] Implement `discoverContainers()` - track ports, networks, project mapping
  - [ ] Implement `detectCloudflareden()` - find cloudflared location
  - [ ] Implement `canReach(container, port)` - connectivity validation
  - [ ] Unit tests with Docker mocks
- **Acceptance:**
  - [ ] Docker networks stored in `docker_networks` table
  - [ ] Containers stored in `docker_containers` table
  - [ ] Port mappings stored in `container_ports` table
  - [ ] Cloudflared location detected correctly (host vs container)
  - [ ] Connectivity validation works for all 4 scenarios
  - [ ] Unit tests pass
- **Estimated:** 3 hours
- **Dependencies:** Issue #1 (database)

### Phase 2: Tunnel Lifecycle Management

**Issue #3: Health Monitoring Service**
- **Title:** "Tunnel Manager: Background Health Monitoring"
- **Description:** Implement 30-second health checks with failure detection
- **Tasks:**
  - [ ] Create `HealthMonitor.ts` class
  - [ ] Implement process check (systemd OR docker)
  - [ ] Implement connectivity test (HTTP ping)
  - [ ] Store health snapshots every 30s in `tunnel_health` table
  - [ ] Detect failure: 3 consecutive failed checks
  - [ ] Emit MCP events: `tunnel_status_change`
  - [ ] Unit tests with time mocking
- **Acceptance:**
  - [ ] Health checks run every 30 seconds
  - [ ] Process + connectivity both validated
  - [ ] Failure detected after 90 seconds (3 strikes)
  - [ ] Health history stored in database
  - [ ] MCP events emitted on status change
  - [ ] Unit tests pass
- **Estimated:** 2 hours
- **Dependencies:** Issue #1 (database), Issue #2 (Docker detection)

**Issue #4: Auto-Restart Manager**
- **Title:** "Tunnel Manager: Auto-Restart with Exponential Backoff"
- **Description:** Implement graceful restart with retry strategy
- **Tasks:**
  - [ ] Create `RestartManager.ts` class
  - [ ] Implement `restart()` with exponential backoff (5s → 5min)
  - [ ] Graceful restart: SIGTERM → 10s → SIGKILL
  - [ ] Handle systemd service: `systemctl restart cloudflared`
  - [ ] Handle Docker container: `docker restart cloudflared`
  - [ ] Log all restarts to `audit_log` table
  - [ ] Emit MCP events: `tunnel_down`, `tunnel_up`
  - [ ] Unit tests with exponential backoff timing
- **Acceptance:**
  - [ ] Restart triggered on health failure
  - [ ] Exponential backoff implemented correctly
  - [ ] Graceful SIGTERM before SIGKILL
  - [ ] Unlimited retries (never gives up)
  - [ ] All restarts logged to audit_log
  - [ ] MCP events emitted
  - [ ] Unit tests pass
- **Estimated:** 2 hours
- **Dependencies:** Issue #3 (health monitor)

### Phase 3: Ingress & DNS Management

**Issue #5: Ingress Config Manager**
- **Title:** "Tunnel Manager: Cloudflared Config YAML Management"
- **Description:** Implement safe read/write/backup of `/etc/cloudflared/config.yml`
- **Tasks:**
  - [ ] Create `IngressManager.ts` class
  - [ ] Implement `readConfig()` - parse YAML safely
  - [ ] Implement `addIngressRule()` - insert before catch-all 404
  - [ ] Implement `removeIngressRule()` - delete by hostname
  - [ ] Implement `writeConfig()` - atomic write (temp file → rename)
  - [ ] Implement `backupConfig()` - git commit after each change
  - [ ] Validate config structure after write
  - [ ] Unit tests with temp config files
- **Acceptance:**
  - [ ] Config read/write operations are atomic
  - [ ] New rules inserted before catch-all
  - [ ] Catch-all 404 rule always remains last
  - [ ] Git backup on every config change
  - [ ] Config validated after write
  - [ ] Unit tests pass with 90%+ coverage
- **Estimated:** 2.5 hours
- **Dependencies:** Issue #1 (database for audit logging)

**Issue #6: Multi-Domain Discovery**
- **Title:** "Tunnel Manager: Cloudflare Domain/Zone Discovery"
- **Description:** Auto-discover all domains in Cloudflare account on startup
- **Tasks:**
  - [ ] Extend CloudflareManager OR create TunnelCloudflareClient
  - [ ] Implement `discoverZones()` - list all zones via CF API
  - [ ] Store in `domains` table (domain, zone_id)
  - [ ] Refresh on: startup, manual request, every 24h
  - [ ] Unit tests with Cloudflare API mocks
- **Acceptance:**
  - [ ] All domains discovered and stored
  - [ ] 153.se set as default domain
  - [ ] Zone IDs cached for fast lookups
  - [ ] Refresh works on demand
  - [ ] Unit tests pass
- **Estimated:** 1.5 hours
- **Dependencies:** Issue #1 (database)

### Phase 4: CNAME Lifecycle

**Issue #7: CNAME Creation Pipeline**
- **Title:** "Tunnel Manager: CNAME Request Workflow (Create)"
- **Description:** Implement end-to-end CNAME creation with validation
- **Tasks:**
  - [ ] Create `CNAMEManager.ts` class
  - [ ] Implement `requestCNAME()`:
    - Validate port allocation (PortManager)
    - Validate subdomain availability
    - Determine ingress target (Docker intelligence)
    - Create DNS record (Cloudflare API)
    - Add ingress rule (IngressManager)
    - Reload tunnel
    - Store in `cnames` table
    - Log to `audit_log`
  - [ ] Implement error handling with recommendations
  - [ ] Unit tests for all validation scenarios
  - [ ] Integration test: end-to-end CNAME creation
- **Acceptance:**
  - [ ] CNAME created in Cloudflare DNS
  - [ ] Ingress rule added to config
  - [ ] Tunnel reloaded successfully
  - [ ] CNAME ownership stored in database
  - [ ] Error messages actionable for PSs
  - [ ] All tests pass
- **Estimated:** 4 hours
- **Dependencies:** Issue #2 (Docker), Issue #5 (Ingress), Issue #6 (Domains)

**Issue #8: CNAME Deletion Pipeline**
- **Title:** "Tunnel Manager: CNAME Deletion Workflow"
- **Description:** Implement CNAME removal with ownership validation
- **Tasks:**
  - [ ] Implement `deleteCNAME()` in CNAMEManager:
    - Validate ownership (PS can only delete own)
    - Delete DNS record (Cloudflare API)
    - Remove ingress rule (IngressManager)
    - Reload tunnel
    - Delete from `cnames` table
    - Log to `audit_log`
  - [ ] Handle errors gracefully
  - [ ] Unit tests for ownership validation
  - [ ] Integration test: end-to-end deletion
- **Acceptance:**
  - [ ] PS can only delete their own CNAMEs
  - [ ] MS can delete any CNAME
  - [ ] DNS record removed from Cloudflare
  - [ ] Ingress rule removed from config
  - [ ] Tunnel reloaded successfully
  - [ ] Database updated correctly
  - [ ] All tests pass
- **Estimated:** 2 hours
- **Dependencies:** Issue #7 (CNAME creation)

### Phase 5: MCP Tool Integration

**Issue #9: MCP Tools - Status & Listing**
- **Title:** "Tunnel Manager: MCP Tools (tunnel_get_status, tunnel_list_*)"
- **Description:** Implement read-only MCP tools for tunnel status and listings
- **Tasks:**
  - [ ] Create `tunnel_get_status.ts` - current tunnel health
  - [ ] Create `tunnel_list_cnames.ts` - list CNAMEs with filters
  - [ ] Create `tunnel_list_domains.ts` - list available domains
  - [ ] Register all 3 tools with MCP server
  - [ ] Implement PS ownership filtering (PSs see only their CNAMEs)
  - [ ] Integration tests via MCP endpoint
- **Acceptance:**
  - [ ] `tunnel_get_status` returns current health
  - [ ] `tunnel_list_cnames` filters by project correctly
  - [ ] `tunnel_list_domains` returns all discovered domains
  - [ ] PS ownership enforced for listings
  - [ ] All tools registered and accessible
  - [ ] Integration tests pass
- **Estimated:** 2 hours
- **Dependencies:** Issue #1 (database), Issue #3 (health), Issue #6 (domains)

**Issue #10: MCP Tools - CNAME Operations**
- **Title:** "Tunnel Manager: MCP Tools (tunnel_request_cname, tunnel_delete_cname)"
- **Description:** Implement write MCP tools for CNAME lifecycle
- **Tasks:**
  - [ ] Create `tunnel_request_cname.ts` - wrapper for CNAMEManager.requestCNAME()
  - [ ] Create `tunnel_delete_cname.ts` - wrapper for CNAMEManager.deleteCNAME()
  - [ ] Extract project context from MCP request
  - [ ] Implement permission checks (PS scoped to their project)
  - [ ] Register both tools with MCP server
  - [ ] Integration tests via MCP endpoint
- **Acceptance:**
  - [ ] `tunnel_request_cname` creates CNAME end-to-end
  - [ ] `tunnel_delete_cname` removes CNAME end-to-end
  - [ ] Project context auto-detected from MCP
  - [ ] PS permissions enforced
  - [ ] Clear error messages on failure
  - [ ] Integration tests pass
- **Estimated:** 2 hours
- **Dependencies:** Issue #7 (CNAME create), Issue #8 (CNAME delete)

### Phase 6: Integration & Testing

**Issue #11: TunnelManager Orchestrator**
- **Title:** "Tunnel Manager: Main Orchestrator & Initialization"
- **Description:** Create main TunnelManager class that ties all components together
- **Tasks:**
  - [ ] Create `TunnelManager.ts` main class
  - [ ] Inject all dependencies (health, restart, cname, ingress, docker, db)
  - [ ] Implement `initialize()` - startup sequence
  - [ ] Start background services (health monitor, Docker polling)
  - [ ] Export TunnelManager singleton
  - [ ] Update `src/index.ts` to initialize TunnelManager
  - [ ] Integration test: full system initialization
- **Acceptance:**
  - [ ] TunnelManager initializes all components
  - [ ] Background services start automatically
  - [ ] All MCP tools registered
  - [ ] System survives restart
  - [ ] Integration tests pass
- **Estimated:** 2 hours
- **Dependencies:** All previous issues

**Issue #12: Documentation & Deployment**
- **Title:** "Tunnel Manager: Documentation, Deployment Guide, E2E Tests"
- **Description:** Complete documentation and end-to-end testing
- **Tasks:**
  - [ ] Create `/docs/tunnel-manager.md` - architecture overview
  - [ ] Create `/docs/tunnel-manager-mcp-tools.md` - MCP tool reference
  - [ ] Update main README with tunnel-manager section
  - [ ] Create deployment guide (install deps, run migrations)
  - [ ] E2E test: PS creates CNAME for containerized service
  - [ ] E2E test: PS creates CNAME for host service
  - [ ] E2E test: Tunnel auto-restarts on failure
  - [ ] E2E test: CNAME deletion workflow
- **Acceptance:**
  - [ ] Documentation complete and accurate
  - [ ] Deployment guide tested on clean VM
  - [ ] All E2E tests pass
  - [ ] No TypeScript errors
  - [ ] Build succeeds
- **Estimated:** 3 hours
- **Dependencies:** Issue #11 (full system)

---

## Acceptance Criteria (Feature-Level)

### Functional Requirements

- [ ] **Health Monitoring:**
  - [ ] Tunnel status checked every 30 seconds
  - [ ] Failure detected after 3 consecutive failed checks (90s)
  - [ ] Health history stored in database
  - [ ] MCP events emitted on status change

- [ ] **Auto-Restart:**
  - [ ] Tunnel auto-restarts on process crash
  - [ ] Tunnel auto-restarts after 3 failed health checks
  - [ ] Exponential backoff implemented (5s → 5min)
  - [ ] Unlimited retry attempts
  - [ ] Graceful restart (SIGTERM → SIGKILL)

- [ ] **Multi-Domain Support:**
  - [ ] All Cloudflare domains discovered on startup
  - [ ] CNAME creation works on any discovered domain
  - [ ] 153.se used as default domain
  - [ ] Domain list refreshable via MCP tool

- [ ] **CNAME Creation:**
  - [ ] PS can request CNAME via `tunnel_request_cname` MCP tool
  - [ ] Port allocation validated via PortManager
  - [ ] Subdomain availability checked
  - [ ] Docker network intelligence determines target (localhost vs container)
  - [ ] DNS CNAME created in Cloudflare
  - [ ] Ingress rule added to `/etc/cloudflared/config.yml`
  - [ ] Tunnel reloaded gracefully
  - [ ] CNAME ownership stored in database
  - [ ] Audit log entry created
  - [ ] Full URL returned to PS
  - [ ] Clear error messages on failure

- [ ] **CNAME Deletion:**
  - [ ] PS can delete own CNAMEs via `tunnel_delete_cname`
  - [ ] MS can delete any CNAME
  - [ ] DNS record removed from Cloudflare
  - [ ] Ingress rule removed from config
  - [ ] Tunnel reloaded
  - [ ] Database records deleted
  - [ ] Audit log entry created

- [ ] **Docker Intelligence:**
  - [ ] All Docker networks discovered and tracked
  - [ ] All containers discovered and tracked
  - [ ] Container ports mapped correctly
  - [ ] Cloudflared location detected (host vs container)
  - [ ] Connectivity validation accurate (4 scenarios handled)
  - [ ] Error messages include actionable recommendations

- [ ] **MCP Tools:**
  - [ ] `tunnel_get_status` returns current health
  - [ ] `tunnel_request_cname` creates CNAME end-to-end
  - [ ] `tunnel_delete_cname` removes CNAME end-to-end
  - [ ] `tunnel_list_cnames` lists CNAMEs with project filtering
  - [ ] `tunnel_list_domains` lists available domains
  - [ ] All tools respect PS ownership/permissions

### Non-Functional Requirements

- [ ] **Performance:**
  - [ ] Health monitoring overhead <1% CPU
  - [ ] Docker polling overhead <1% CPU
  - [ ] MCP tool response time <500ms (excluding tunnel reload)
  - [ ] SQLite database <100MB with 1000 CNAMEs

- [ ] **Reliability:**
  - [ ] Tunnel uptime 99.9% (including auto-recovery)
  - [ ] Zero data loss during tunnel restart
  - [ ] Config file operations are atomic
  - [ ] Database operations are transactional

- [ ] **Security:**
  - [ ] PS can only create CNAMEs with their allocated ports
  - [ ] PS can only delete their own CNAMEs
  - [ ] MS has full access to all operations
  - [ ] All operations logged to audit_log

- [ ] **Maintainability:**
  - [ ] Code coverage >85% on all components
  - [ ] All TypeScript with strict mode
  - [ ] No TypeScript errors
  - [ ] Build succeeds without warnings
  - [ ] ESLint passes with zero errors

### User Experience

- [ ] **PS Experience:**
  - [ ] CNAME created in <10 seconds
  - [ ] Error messages are clear and actionable
  - [ ] Recommendations guide through networking issues
  - [ ] No need to understand tunnel internals

- [ ] **MS Experience:**
  - [ ] Zero manual intervention for routine operations
  - [ ] Complete visibility into tunnel health
  - [ ] Full audit trail for debugging
  - [ ] Can manually restart if needed

### Backward Compatibility

- [ ] **Existing Infrastructure:**
  - [ ] All existing CNAMEs continue working
  - [ ] Existing tunnel config preserved
  - [ ] No disruption to running services during deployment
  - [ ] Can deploy without downtime

---

## Dependencies & Risks

### Blockers

- ✅ None (all dependencies already exist)

### Dependencies

- CloudflareManager: Extend or wrap for tunnel-specific operations
- PortManager: Integration for port validation
- SecretsManager: Retrieve Cloudflare tokens
- MCP Server: Register new tools
- Docker: Runtime must be available on VM
- Git: For config file backup

### Risks & Mitigations

**Risk 1: Config File Corruption**
- **Impact:** High - Could break tunnel entirely
- **Probability:** Low
- **Mitigation:**
  - Atomic write (temp file → rename)
  - Validate config after write (YAML parse)
  - Git backup before and after change
  - Test rollback procedure

**Risk 2: Race Conditions on Concurrent Requests**
- **Impact:** Medium - Could create duplicate CNAMEs or corrupt database
- **Probability:** Medium (multiple PSs requesting simultaneously)
- **Mitigation:**
  - Database transactions (SQLite serialized mode)
  - Unique constraint on (subdomain, domain)
  - Lock file during config write
  - Test concurrent requests in E2E tests

**Risk 3: Tunnel Restart Causes Brief Downtime**
- **Impact:** Medium - Services unreachable for 5-10 seconds
- **Probability:** High (every CNAME creation triggers reload)
- **Mitigation:**
  - Graceful restart (SIGTERM allows in-flight requests to complete)
  - Batch multiple CNAME requests if possible
  - Document expected downtime (<5s)
  - Consider future: hot-reload without restart (if cloudflared supports)

**Risk 4: Docker Network Discovery Fails**
- **Impact:** High - Wrong ingress target = silent failure
- **Probability:** Low-Medium (Docker API should be stable)
- **Mitigation:**
  - Fallback to localhost if Docker unreachable
  - Require manual target specification as escape hatch
  - Extensive testing across all 4 networking scenarios
  - Clear error messages guide user through fix

**Risk 5: Cloudflared Process Detection Ambiguity**
- **Impact:** Medium - Wrong detection leads to failed restart
- **Probability:** Low (should be deterministic)
- **Mitigation:**
  - Check both systemd AND Docker on every health check
  - Prefer method that returns success
  - Document expected deployment method
  - Test both deployment scenarios (systemd vs Docker)

---

## Testing Strategy

### Unit Tests (per component)

**TunnelDatabase:**
- Schema creation and migrations
- CRUD operations for all tables
- Query filtering (by project, domain)
- Transaction handling

**DockerNetworkIntel:**
- Network discovery with Docker mocks
- Container discovery with port mapping
- Cloudflared location detection
- Connectivity validation (4 scenarios)
- Project name extraction from container names

**HealthMonitor:**
- Process check (systemd + Docker mocks)
- Connectivity test (HTTP mock)
- Failure detection (3-strike rule)
- MCP event emission
- Time-based testing (30s interval)

**RestartManager:**
- Exponential backoff timing
- Graceful restart (SIGTERM → SIGKILL)
- Restart counter incrementation
- Audit logging
- MCP event emission

**IngressManager:**
- YAML read/parse (valid and malformed)
- Add ingress rule (correct position before catch-all)
- Remove ingress rule by hostname
- Atomic write (temp file → rename)
- Git backup (commit after change)
- Config validation after write

**CNAMEManager:**
- Port validation (PortManager integration)
- Subdomain availability check
- Target selection logic (all 4 Docker scenarios)
- DNS creation (Cloudflare mock)
- Ingress rule addition (IngressManager integration)
- Tunnel reload trigger
- Database storage
- Error handling with recommendations

### Integration Tests

**Test 1: Full CNAME Creation (Host Service)**
- PS requests CNAME for service running on host (port 3105)
- Validates port allocation
- Determines target: `http://localhost:3105`
- Creates DNS record
- Adds ingress rule
- Reloads tunnel
- Verifies CNAME accessible via HTTPS

**Test 2: Full CNAME Creation (Container in Shared Network)**
- PS requests CNAME for containerized service
- Cloudflared shares network with container
- Determines target: `http://container-name:3105`
- Creates CNAME end-to-end
- Verifies CNAME accessible

**Test 3: Full CNAME Creation (Container with Port Binding)**
- PS requests CNAME for containerized service
- Container has port exposed: `-p 3105:3105`
- No shared network with cloudflared
- Determines target: `http://localhost:3105`
- Creates CNAME end-to-end

**Test 4: CNAME Creation Failure (No Connectivity)**
- PS requests CNAME for containerized service
- No shared network, no port binding
- Rejects request with clear error
- Provides recommendations (add to network OR expose port)

**Test 5: CNAME Deletion**
- PS creates CNAME
- PS deletes own CNAME
- Verifies DNS record removed
- Verifies ingress rule removed
- Verifies database entry removed

**Test 6: Permission Enforcement**
- PS1 creates CNAME
- PS2 tries to delete PS1's CNAME → rejected
- MS deletes PS1's CNAME → success

**Test 7: Tunnel Auto-Restart**
- Simulate tunnel process crash
- Health monitor detects failure after 90s
- Restart manager triggers restart
- Tunnel recovers
- Existing CNAMEs still work

**Test 8: Multi-Domain Support**
- Discover multiple domains in Cloudflare account
- Create CNAME on non-default domain
- Verify DNS record created in correct zone

### E2E Tests

**E2E 1: PS Deploys Service End-to-End**
1. PS allocates port via PortManager
2. PS starts service on allocated port
3. PS requests CNAME via `tunnel_request_cname`
4. Service becomes accessible via HTTPS URL
5. PS verifies service reachable
6. PS deletes CNAME via `tunnel_delete_cname`
7. Service no longer accessible via HTTPS

**E2E 2: Tunnel Survives VM Restart**
1. Create several CNAMEs
2. Restart VM
3. TunnelManager initializes on startup
4. All CNAMEs still work
5. Health monitoring resumes

**E2E 3: Concurrent CNAME Requests**
1. Multiple PSs request CNAMEs simultaneously
2. All requests succeed without conflicts
3. All CNAMEs accessible
4. Database consistent

---

## Deployment Plan

### Pre-Deployment

- [ ] Backup current `/etc/cloudflared/config.yml`
- [ ] Snapshot VM
- [ ] Test deployment in staging environment

### Deployment Steps

1. **Install Dependencies:**
   ```bash
   cd /home/samuel/sv/supervisor-service
   npm install better-sqlite3 dockerode js-yaml
   ```

2. **Run Database Migrations:**
   ```bash
   npm run migrate:tunnel  # Or let TunnelManager.initialize() run them
   ```

3. **Initialize TunnelManager:**
   - Update `src/index.ts` to initialize TunnelManager singleton
   - Register all 5 MCP tools

4. **Restart Supervisor Service:**
   ```bash
   systemctl restart supervisor-service
   ```

5. **Verify Functionality:**
   - Call `tunnel_get_status` via MCP → should return "up"
   - Call `tunnel_list_domains` → should list all domains
   - Call `tunnel_list_cnames` → should list existing CNAMEs (migrate existing ones manually if needed)

### Post-Deployment

- [ ] Monitor logs for errors
- [ ] Verify existing CNAMEs still work
- [ ] Test CNAME creation with PS
- [ ] Monitor health checks (should show "up")
- [ ] Verify auto-restart works (simulate failure)

### Rollback Plan

If deployment fails:
1. Stop supervisor service: `systemctl stop supervisor-service`
2. Restore config backup: `cp /etc/cloudflared/config.yml.backup /etc/cloudflared/config.yml`
3. Restart tunnel: `systemctl restart cloudflared`
4. Revert code: `git checkout <previous-commit>`
5. Remove database: `rm /home/samuel/sv/supervisor-service/data/tunnel-manager.db`
6. Restart supervisor service: `systemctl start supervisor-service`

---

## Metrics & Monitoring

### Success Metrics (Post-Launch)

- **Tunnel Uptime:** Target 99.9% (measure over 30 days)
- **CNAME Creation Time:** Target <10s (p95)
- **Auto-Recovery Time:** Target <60s from failure to healthy
- **PS CNAME Requests:** Track adoption rate (how many PSs use it)
- **Manual Interventions:** Target 0 (measure over 30 days)

### Monitoring Dashboards

- **Health Dashboard:**
  - Current tunnel status (up/down/restarting)
  - Uptime percentage (last 24h, 7d, 30d)
  - Restart count
  - Health check latency

- **CNAME Dashboard:**
  - Total CNAMEs created
  - CNAMEs per project
  - CNAME creation success rate
  - CNAME deletion rate

- **Docker Dashboard:**
  - Networks discovered
  - Containers tracked
  - Cloudflared location (host vs container)
  - Connectivity validation results

---

## Future Enhancements (Out of Scope for This Epic)

### v1.1 Features
- Manual restart via MCP tool (MS only)
- Traffic metrics per CNAME
- Pre-flight connectivity test
- Configuration drift detection
- Orphan CNAME cleanup (weekly cron)
- Project deletion cleanup automation

### v2.0 Features
- Network topology visualization
- Traffic analytics (request count, bandwidth)
- Rate limiting per PS
- Custom origin settings per CNAME
- Temporary CNAMEs with expiration
- Blue-green deployment support

### v3.0 Features (Scalability)
- Multi-tunnel support (multiple VMs)
- Load balancing across backends
- Global tunnel management (multiple regions)
- Tunnel mesh networking

---

## Appendix

### Reference Documentation

- **Cloudflare Tunnel Docs:** https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/
- **Cloudflare API Docs:** https://developers.cloudflare.com/api/
- **Docker API Docs:** https://docs.docker.com/engine/api/
- **SQLite Docs:** https://www.sqlite.org/docs.html
- **MCP Protocol Spec:** https://modelcontextprotocol.io/

### Current Infrastructure Details

**Cloudflare Tunnel:**
- Tunnel ID: `fe2ec8b5-790f-4973-ad07-e03a4e4dd45b`
- Tunnel domain: `fe2ec8b5-790f-4973-ad07-e03a4e4dd45b.cfargotunnel.com`
- Account ID: `2d3af2bad092943b12b5e9fcde17b7a3`

**Primary Zone (153.se):**
- Zone ID: `f0cd4fffeebf70a32d4dde6c56806ce7`

**Secrets Paths:**
- `meta/cloudflare/tunnel_id`
- `meta/cloudflare/dns_edit_token` = `H5zxOd7zg9uznWWyagmVPnvodX4SPs8zhCcbRL81`
- `meta/cloudflare/account_id`
- `meta/cloudflare/zone_id_153se`

**Existing CNAMEs:**
- `chat.153.se`
- `code.153.se`
- `consilio.153.se`
- `hejsan.153.se`

**Port Ranges:**
- meta-supervisor: 3000-3099
- consilio: 3100-3199
- openhorizon: 3200-3299
- odin: 3300-3399
- shared-services: 9000-9999

---

**Epic Author:** Claude Sonnet 4.5 (PM Agent)
**Review Status:** Ready for ADR Phase
**Next Steps:** Create ADRs for key technical decisions, then break into GitHub issues for SCAR
