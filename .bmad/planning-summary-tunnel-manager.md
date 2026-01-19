# Planning Summary: Tunnel Manager (Epic 005)

**Date:** 2026-01-19
**Status:** Planning Complete - Ready for Implementation
**Epic:** [005-tunnel-manager.md](epics/005-tunnel-manager.md)
**Priority:** High
**Complexity:** Level 3 (Large Feature - 1-2 days)

---

## Overview

The tunnel-manager feature provides comprehensive Cloudflare tunnel management for the meta-supervisor, enabling Project Supervisors (PSs) to autonomously deploy web-accessible services without manual intervention.

### Key Capabilities

1. **Tunnel Health Monitoring** - 30-second health checks with auto-recovery
2. **Auto-Restart** - Exponential backoff with unlimited retries
3. **Multi-Domain Support** - Manage CNAMEs across all Cloudflare domains
4. **CNAME Self-Service** - PSs create/delete CNAMEs via MCP tools
5. **Docker Intelligence** - Automatic localhost vs container-name routing
6. **Ingress Automation** - Auto-update `/etc/cloudflared/config.yml`
7. **State Tracking** - SQLite database for ownership and audit
8. **MCP Integration** - 5 core tools exposed to all PSs

---

## Planning Documents Created

### 1. Feature Request
**File:** [feature-requests/tunnel-manager.md](feature-requests/tunnel-manager.md)

**Contents:**
- Problem statement and user impact
- Complete requirements (MoSCoW format)
- Technical context and constraints
- Success criteria
- Scope boundaries
- Complexity rationale (Level 3)

### 2. Epic Document
**File:** [epics/005-tunnel-manager.md](epics/005-tunnel-manager.md) (self-contained, 1000+ lines)

**Contents:**
- Complete project context (repo, tech stack, dependencies)
- Business context and value proposition
- Full requirements (MoSCoW)
- Architecture and technical approach
- Component structure and data flow
- Database schema (8 tables)
- 12 GitHub issues (task breakdown)
- Feature-level acceptance criteria
- Dependencies and risks
- Testing strategy
- Deployment plan

**Key Sections:**
- Requirements broken into MUST/SHOULD/COULD/WON'T
- Architecture with TypeScript interfaces
- Implementation tasks (Issue #1-#12)
- Complete database schema (SQLite)
- Integration points (PortManager, CloudflareManager, Docker API)

### 3. Architecture Decision Records (ADRs)

#### ADR-001: SQLite for Tunnel State vs PostgreSQL
**File:** [adr/001-sqlite-for-tunnel-state.md](adr/001-sqlite-for-tunnel-state.md)

**Decision:** Use SQLite for tunnel-manager state (not PostgreSQL)

**Rationale:**
- Zero network latency (embedded in-process)
- Perfect for read-heavy workload (health checks, status queries)
- Lower CPU/memory overhead (<0.03% vs 0.2%)
- Data isolation (tunnel state logically separate)
- Simple deployment (no server configuration)

**Trade-offs:**
- No horizontal scaling (acceptable - single VM only)
- Separate database to manage (mitigated - file-based, simple backups)

#### ADR-002: Ingress Target Selection Algorithm
**File:** [adr/002-ingress-target-selection-algorithm.md](adr/002-ingress-target-selection-algorithm.md)

**Decision:** Intelligent automatic selection (localhost vs container-name)

**Algorithm:**
1. Detect cloudflared location (host vs container)
2. Find service location (host vs container)
3. Check Docker network connectivity
4. Select optimal target:
   - Prefer container-name when shared network exists
   - Fallback to localhost when needed
   - Reject with clear error if unreachable

**Rationale:**
- Better performance (container-name avoids port binding overhead)
- Better security (no host exposure)
- Zero manual configuration for PSs
- Handles all 4 deployment scenarios correctly

**Trade-offs:**
- Complex implementation (~400 lines DockerNetworkIntel)
- Docker API dependency (mitigated - cached in SQLite)

#### ADR-003: Health Monitoring and Restart Strategy
**File:** [adr/003-health-monitoring-and-restart-strategy.md](adr/003-health-monitoring-and-restart-strategy.md)

**Decisions:**
1. **Health Check Frequency:** 30 seconds
2. **Failure Detection:** 3-strike rule (90s to detect)
3. **Restart Strategy:** Exponential backoff (5s → 5min max)
4. **Retry Policy:** Unlimited retries (never give up)

**Rationale:**
- **30s frequency:** Balanced (fast detection, low overhead <0.03% CPU)
- **3 strikes:** Avoids false positives from transient blips
- **Exponential backoff:** Prevents restart loops, backs off for persistent issues
- **Unlimited retries:** Tunnel is critical infrastructure, must always attempt recovery

**Trade-offs:**
- 90s detection latency (acceptable for non-critical infrastructure)
- No circuit breaker (mitigated - ops can monitor logs)

---

## Implementation Roadmap

### 12 GitHub Issues (Sequential Phases)

**Phase 1: Foundation (Issues #1-#2)**
- Issue #1: SQLite database schema and migrations (2 hours)
- Issue #2: Docker network intelligence (3 hours)

**Phase 2: Tunnel Lifecycle (Issues #3-#4)**
- Issue #3: Health monitoring service (2 hours)
- Issue #4: Auto-restart manager (2 hours)

**Phase 3: Ingress & DNS (Issues #5-#6)**
- Issue #5: Ingress config manager (2.5 hours)
- Issue #6: Multi-domain discovery (1.5 hours)

**Phase 4: CNAME Lifecycle (Issues #7-#8)**
- Issue #7: CNAME creation pipeline (4 hours)
- Issue #8: CNAME deletion pipeline (2 hours)

**Phase 5: MCP Integration (Issues #9-#10)**
- Issue #9: MCP tools - status & listing (2 hours)
- Issue #10: MCP tools - CNAME operations (2 hours)

**Phase 6: Integration (Issues #11-#12)**
- Issue #11: TunnelManager orchestrator (2 hours)
- Issue #12: Documentation & E2E tests (3 hours)

**Total Estimated Time:** 28 hours (1-2 days with focus)

### Dependencies (All Exist - No Blockers)

- ✅ CloudflareManager (src/cloudflare/CloudflareManager.ts)
- ✅ PortManager (src/ports/PortManager.ts)
- ✅ SecretsManager (src/secrets/SecretsManager.ts)
- ✅ MCP server infrastructure
- ✅ Cloudflare API tokens stored
- ✅ Docker runtime on VM

---

## Key Technical Components

### Database Schema (SQLite)

8 tables in `/home/samuel/sv/supervisor-service/data/tunnel-manager.db`:

1. **cnames** - CNAME ownership tracking
2. **tunnel_health** - Health metrics time series
3. **domains** - Discovered Cloudflare zones
4. **docker_networks** - Network topology
5. **docker_containers** - Container tracking
6. **container_networks** - Network membership
7. **container_ports** - Port mappings
8. **audit_log** - All operations logged

### MCP Tools (5 Core)

1. **tunnel_get_status** - Get health metrics (all PSs)
2. **tunnel_request_cname** - Create CNAME + ingress (all PSs, scoped to project)
3. **tunnel_delete_cname** - Remove CNAME (owner PS + MS)
4. **tunnel_list_cnames** - List CNAMEs (filtered by project)
5. **tunnel_list_domains** - List available domains (all PSs)

### Core Classes

```
TunnelManager.ts           - Main orchestrator
HealthMonitor.ts           - 30s health checks
RestartManager.ts          - Auto-restart with backoff
CNAMEManager.ts            - CNAME lifecycle
IngressManager.ts          - Config YAML operations
DockerNetworkIntel.ts      - Docker topology analysis
TunnelDatabase.ts          - SQLite wrapper
```

---

## Success Criteria

### Functional Requirements

- [ ] Tunnel maintains 99.9% uptime (auto-recovery <60s)
- [ ] PSs create CNAMEs in <10 seconds
- [ ] All existing CNAMEs continue working
- [ ] Docker network detection 100% accurate
- [ ] Zero manual intervention for routine operations

### Non-Functional Requirements

- [ ] Health monitoring overhead <1% CPU
- [ ] SQLite database <100MB with 1000 CNAMEs
- [ ] MCP tool response time <500ms
- [ ] All operations audited and traceable
- [ ] Clear error messages for all failure scenarios

### User Experience

- [ ] PS receives immediate feedback on CNAME requests
- [ ] Error messages include actionable recommendations
- [ ] No need to understand tunnel internals

---

## Risk Mitigation

### Risk 1: Config File Corruption
- **Mitigation:** Atomic writes (temp file → rename), YAML validation, git backups

### Risk 2: Race Conditions
- **Mitigation:** Database transactions, unique constraints, lock files

### Risk 3: Tunnel Restart Downtime
- **Mitigation:** Graceful restart (SIGTERM), <5s outage, documented

### Risk 4: Docker Network Detection Fails
- **Mitigation:** Fallback to localhost, connectivity validation, clear error messages

### Risk 5: Cloudflared Process Detection Ambiguity
- **Mitigation:** Check both systemd AND Docker, test both deployment scenarios

---

## Next Steps

### Option A: Create GitHub Issues Now
Break epic into 12 GitHub issues and assign to SCAR for implementation.

### Option B: Review Planning First
Review all planning documents (feature request, epic, ADRs) before proceeding.

### Option C: Start Implementation Immediately
If planning approved, begin with Issue #1 (database schema).

---

## Planning Quality Metrics

✅ **Feature Request:** Complete, detailed, all sections filled
✅ **Epic:** Self-contained, 1000+ lines, all context included
✅ **ADRs:** 3 key decisions documented with rationale
✅ **Requirements:** MoSCoW format, clear boundaries
✅ **Architecture:** Component structure, data flow, interfaces
✅ **Tasks:** 12 issues, estimated times, clear acceptance criteria
✅ **Testing:** Unit, integration, E2E strategies defined
✅ **Deployment:** Step-by-step plan, rollback procedure

**Planning Completeness:** 100% - Ready for implementation

---

## Files Created

```
.bmad/
├── feature-requests/
│   └── tunnel-manager.md                          (Feature request - 457 lines)
├── epics/
│   └── 005-tunnel-manager.md                      (Epic - 1000+ lines)
├── adr/
│   ├── 001-sqlite-for-tunnel-state.md            (ADR - SQLite decision)
│   ├── 002-ingress-target-selection-algorithm.md (ADR - Target selection)
│   └── 003-health-monitoring-and-restart-strategy.md (ADR - Health & restart)
└── planning-summary-tunnel-manager.md             (This file)
```

**Total Planning Output:** ~3500 lines of comprehensive documentation

---

## Approval Checklist

Before proceeding to implementation:

- [ ] Feature request reviewed and approved
- [ ] Epic self-contained and complete
- [ ] All ADRs reviewed and accepted
- [ ] Requirements clear and unambiguous
- [ ] Architecture sound and well-reasoned
- [ ] Task breakdown appropriate (not too big/small)
- [ ] Testing strategy comprehensive
- [ ] Deployment plan viable
- [ ] Risks identified and mitigated

---

**Planning Phase:** Complete ✅
**Status:** Ready for Implementation
**Estimated Implementation Time:** 1-2 days (28 hours)
**Blocked By:** None (all dependencies exist)
**Blocks:** PS autonomous deployments, multi-service architectures

**Next Action:** Create GitHub issues from epic task breakdown and begin implementation with Issue #1 (Database Schema)
