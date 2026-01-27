# Feature Request: Tunnel Manager

**Created:** 2026-01-19
**Status:** Analysis Complete
**Complexity:** Level 3 (Large Feature)
**Priority:** High
**Planning Track:** Enterprise

---

## One-Sentence Summary

A comprehensive Cloudflare tunnel management system for the meta-supervisor that monitors tunnel health, auto-restarts on failures, enables PSs to autonomously request CNAMEs for their services, and provides intelligent Docker network awareness for optimal ingress routing.

---

## Problem Statement

Currently, Cloudflare tunnel management is manual and error-prone:

1. **No health monitoring** - Tunnel failures go undetected until services become unreachable
2. **Manual CNAME creation** - PSs must request meta-supervisor intervention to deploy new services
3. **Manual ingress configuration** - Editing config files and restarting tunnel is tedious and error-prone
4. **No Docker network intelligence** - Difficult to determine when to use `localhost:PORT` vs `container-name:PORT` in ingress rules
5. **No state tracking** - No record of which PS owns which CNAME, making cleanup and auditing impossible
6. **Single domain limitation** - Only manages 153.se, but Cloudflare account has multiple domains

This blocks PS autonomy and creates operational bottlenecks at the meta-supervisor level.

---

## User Impact

**Primary Users:** Project Supervisors (PSs) - Consilio, Odin, OpenHorizon, Health-Agent

**Current Pain Points:**
- PSs cannot independently deploy web-accessible services
- Must wait for meta-supervisor manual intervention
- Service deployments delayed by CNAME/ingress configuration
- No visibility into tunnel health or connectivity issues
- Docker networking errors cause silent failures

**Expected Value:**
- **PS Autonomy**: PSs can deploy services end-to-end without MS intervention
- **Faster Deployments**: CNAME + ingress rule creation automated (seconds vs minutes)
- **Reliability**: Auto-restart ensures 99.9% tunnel uptime
- **Better DX**: Clear error messages and recommendations guide PSs through networking issues
- **Audit Trail**: Complete tracking of who created what and when

---

## Business Context

**What Happens If We Don't Build This:**
- PS deployments remain bottlenecked on MS
- Tunnel failures cause extended outages
- Manual operations increase error rate
- No scalability as more PSs added to system

**Timeline:** High priority - enables critical PS functionality

**Dependencies:**
- Existing CloudflareManager (extend functionality)
- Existing PortManager (integration for validation)
- Existing SecretsManager (already storing Cloudflare tokens)
- Docker runtime on VM

---

## Requirements (MoSCoW)

### MUST HAVE (MVP)

**Tunnel Health Monitoring:**
- Monitor tunnel process health every 30 seconds
- Track metrics: status (up/down), uptime, restart count, last successful ping
- Detect failures via process check and connectivity test
- Store health history in database

**Auto-Restart Logic:**
- Auto-restart on: process crash, 3 consecutive failed health checks (90s timeout), manual request
- Exponential backoff: 5s, 15s, 30s, 1min, 5min max intervals
- Unlimited retries (critical infrastructure)
- Graceful restart: SIGTERM → 10s wait → SIGKILL
- Notify all PSs on tunnel down/recovery via MCP events

**Multi-Domain Support:**
- Auto-discover all domains/zones in Cloudflare account on startup
- Cache zone IDs in database for fast lookups
- Support CNAME creation on any domain (not just 153.se)
- Default to 153.se if domain not specified

**CNAME Request Workflow:**
- PS provides: subdomain, domain (optional), targetPort, projectName (auto-detected)
- Validate: port allocated to requesting PS (via PortManager), subdomain available, domain exists
- Auto-execute:
  1. Create CNAME in Cloudflare DNS
  2. Add ingress rule to tunnel config
  3. Reload tunnel gracefully
  4. Store ownership in database
  5. Return success with full URL

**Docker Network Intelligence:**
- Auto-discover all Docker networks on VM
- Track all running containers and their network memberships
- Map containers to ports they expose
- Detect cloudflared location (host vs container) and networks
- Intelligent target selection:
  - Use `localhost:PORT` for host services or exposed container ports
  - Use `container-name:PORT` for containerized services in shared network
  - Validate connectivity before creating CNAME

**Ingress Rule Management:**
- Read/write `/etc/cloudflared/config.yml`
- Auto-generate ingress rules with proper target (localhost vs container)
- Maintain catch-all 404 rule at end
- Backup config to git after each change
- Reload tunnel after config update

**State Management (SQLite):**
- Database: `/home/samuel/sv/supervisor-service/data/tunnel-manager.db`
- Tables:
  - `cnames` - Track all CNAMEs (subdomain, domain, target, owner PS, created_at)
  - `tunnel_health` - Health metrics time series
  - `domains` - Discovered Cloudflare domains/zones
  - `docker_networks` - Network tracking
  - `docker_containers` - Container tracking
  - `container_networks` - Network membership
  - `container_ports` - Port mappings
  - `audit_log` - All operations logged

**Integration Points:**
- PortManager: Validate port allocation before CNAME creation
- SecretsManager: Retrieve Cloudflare tokens
- CloudflareManager: Extend with tunnel-specific methods
- Docker API: Network and container discovery

**MCP Tool Suite (Core):**
1. `tunnel_get_status` - Get health metrics, uptime, current status
2. `tunnel_request_cname` - Create CNAME + ingress rule (all PSs)
3. `tunnel_delete_cname` - Remove CNAME + ingress (owner PS or MS)
4. `tunnel_list_cnames` - List CNAMEs (filterable by project)
5. `tunnel_list_domains` - List available domains in account

### SHOULD HAVE (v1.1)

**Enhanced MCP Tools:**
6. `tunnel_restart` - Manual restart (MS only)
7. `tunnel_get_metrics` - Usage stats (request count, errors)
8. `tunnel_check_connectivity` - Test if cloudflared can reach target
9. `tunnel_recommend_config` - Get setup recommendations for PS

**Advanced Features:**
- Audit logging for all operations (who, what, when, success/failure)
- Event notifications to PSs (tunnel status changes, connectivity issues)
- Connectivity validation: test reachability before creating CNAME
- Clear error messages with actionable recommendations
- Configuration drift detection (container network changes)

**Cleanup & Lifecycle:**
- PSs can delete their own CNAMEs
- Orphan detection: weekly scan for CNAMEs pointing to unallocated ports
- Project deletion cleanup: auto-remove all PSs CNAMEs

### COULD HAVE (v2.0)

**Analytics & Monitoring:**
- Traffic analytics per CNAME (request count, bandwidth, errors)
- Network topology visualization
- `tunnel_get_network_topology` - Visual diagram of container networks

**Advanced Management:**
- Rate limiting per PS (prevent abuse)
- Custom origin settings per CNAME (timeout, TLS settings)
- Temporary CNAMEs with expiration
- Blue-green deployment support (multiple CNAMEs → same service)

### WON'T HAVE (Out of Scope)

**Explicitly Not Building:**
- Custom tunnel infrastructure (use existing tunnel ID: fe2ec8b5-790f-4973-ad07-e03a4e4dd45b)
- Multi-tunnel support (multiple VMs - single VM for now)
- Load balancing across multiple backends
- DDoS protection (Cloudflare handles this)
- SSL certificate management (Cloudflare handles this)
- WAF rules or security policies
- Custom DNS record types (only CNAME)

---

## Technical Context

### Current Infrastructure

**Cloudflare Tunnel:**
- Tunnel ID: `fe2ec8b5-790f-4973-ad07-e03a4e4dd45b`
- Tunnel domain: `fe2ec8b5-790f-4973-ad07-e03a4e4dd45b.cfargotunnel.com`
- Primary zone: `153.se` (Zone ID: `f0cd4fffeebf70a32d4dde6c56806ce7`)
- Account ID: `2d3af2bad092943b12b5e9fcde17b7a3`

**Existing CNAMEs:**
- `chat.153.se` → tunnel
- `code.153.se` → tunnel
- `consilio.153.se` → tunnel
- `hejsan.153.se` → tunnel

**Secrets Stored:**
- `meta/cloudflare/tunnel_id`
- `meta/cloudflare/api_token`
- `meta/cloudflare/dns_edit_token`
- `meta/cloudflare/account_id`
- `meta/cloudflare/zone_id_153se`

**Port Allocation Ranges:**
- meta-supervisor: 3000-3099
- consilio: 3100-3199
- openhorizon: 3200-3299
- odin: 3300-3399
- shared-services: 9000-9999

### Docker Infrastructure

**Networking Scenarios to Handle:**

1. **Host-based service:**
   - Service runs directly on VM
   - Cloudflared on host
   - Ingress target: `http://localhost:PORT`

2. **Container in shared network:**
   - Service in container
   - Cloudflared in container
   - Both on same Docker network
   - Ingress target: `http://container-name:PORT`

3. **Container with port binding:**
   - Service in container
   - Port exposed with `-p` flag
   - Cloudflared on host OR different network
   - Ingress target: `http://localhost:HOST_PORT`

4. **Connectivity failure:**
   - Service in container
   - Cloudflared cannot reach it
   - No shared network, no port binding
   - Must provide clear error + recommendations

### Integration Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Meta Supervisor                       │
│                                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │              Tunnel Manager                        │ │
│  │                                                     │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐│ │
│  │  │ Health       │  │ CNAME        │  │ Docker   ││ │
│  │  │ Monitor      │  │ Manager      │  │ Network  ││ │
│  │  │ (30s poll)   │  │              │  │ Intel    ││ │
│  │  └──────────────┘  └──────────────┘  └──────────┘│ │
│  │                                                     │ │
│  │  ┌─────────────────────────────────────────────┐  │ │
│  │  │         MCP Tool Suite (8-9 tools)          │  │ │
│  │  └─────────────────────────────────────────────┘  │ │
│  │                                                     │ │
│  │  Integrations:                                      │ │
│  │  - CloudflareManager (DNS API)                     │ │
│  │  - PortManager (validation)                        │ │
│  │  - SecretsManager (tokens)                         │ │
│  │  - Docker API (network discovery)                  │ │
│  │  - SQLite (state)                                  │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                           │
                           │ MCP Protocol
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  Project Supervisors                     │
│                                                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ Consilio │  │   Odin   │  │OpenHorizon│ │ Health  │ │
│  │          │  │          │  │           │  │ Agent   │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
│                                                           │
│  Each PS can:                                            │
│  - Request CNAME creation for their services            │
│  - Delete their own CNAMEs                              │
│  - List their CNAMEs                                    │
│  - Check tunnel status                                  │
│  - Receive tunnel health notifications                 │
└─────────────────────────────────────────────────────────┘
```

---

## Success Criteria

**Functional:**
- ✓ Tunnel maintains 99.9% uptime (auto-recovery within 60 seconds)
- ✓ PSs can create CNAMEs in <10 seconds
- ✓ All existing CNAMEs continue working after tunnel-manager deployment
- ✓ Docker network detection 100% accurate
- ✓ Zero manual intervention required for routine operations

**Non-Functional:**
- ✓ Health monitoring overhead <1% CPU
- ✓ SQLite database <100MB even with 1000 CNAMEs
- ✓ MCP tool response time <500ms (excluding tunnel reload)
- ✓ All operations fully audited and traceable
- ✓ Clear error messages for all failure scenarios

**User Experience:**
- ✓ PS receives immediate feedback on CNAME request success/failure
- ✓ Error messages include actionable recommendations
- ✓ No need to understand tunnel internals - tool handles complexity

---

## Scope Boundaries

**Definitely IN Scope:**
- Tunnel lifecycle management (monitor, restart)
- CNAME creation/deletion for all domains in account
- Ingress rule automation
- Docker network intelligence
- State tracking and audit logging
- MCP tool suite for PS access
- PortManager integration

**Explicitly OUT of Scope:**
- Tunnel infrastructure changes (keep existing tunnel)
- Multi-VM tunnel management
- Custom DNS record types (A, AAAA, TXT, etc.)
- Cloudflare security features (WAF, DDoS)
- SSL/TLS certificate management
- Traffic load balancing
- Non-Cloudflare tunnel solutions

---

## Constraints

**Technical:**
- Must work with existing tunnel ID (no migration)
- Must maintain backward compatibility with existing CNAMEs
- Must not disrupt running services during deployment
- Must handle concurrent PS requests safely

**Operational:**
- Zero-downtime deployment required
- Must survive VM restarts (systemd integration)
- Database must be backed up automatically

**Resource:**
- Minimal CPU/memory overhead (<100MB RAM, <1% CPU)
- Database storage <100MB expected

---

## Dependencies

**Blockers (Must Exist Before Implementation):**
- ✓ CloudflareManager (exists)
- ✓ PortManager (exists)
- ✓ SecretsManager (exists)
- ✓ MCP server infrastructure (exists)
- ✓ Cloudflare tokens stored (exists)
- ✓ Docker runtime on VM (exists)

**Parallel Dependencies (Can Build Alongside):**
- PS deployment workflows (PSs will adopt tool once available)

**Blocks (Enables Future Work):**
- PS autonomous deployments
- Multi-service architectures per project
- Internal tooling deployments
- Development/staging environments

---

## Related Features & Context

**Related Epics:**
- EPIC-005: Cloudflare Management (base functionality)
- EPIC-006: GCloud Management (similar pattern for VMs)
- EPIC-004: Port Allocation (integration point)
- EPIC-003: Secrets Management (integration point)

**Related Documentation:**
- `/home/samuel/sv/supervisor-service/docs/cloudflare-tunnel-config.md`
- `/home/samuel/sv/supervisor-service/src/cloudflare/CloudflareManager.ts`
- `/home/samuel/sv/supervisor-service/src/ports/PortManager.ts`

---

## Complexity Rationale

**Why Level 3 (Large Feature):**

1. **Multiple Integration Points:** CloudflareManager, PortManager, SecretsManager, Docker API
2. **State Management:** Complex database schema (8 tables) with relationships
3. **Background Services:** Health monitoring daemon, network discovery polling
4. **Config File Management:** YAML parsing, editing, version control
5. **Docker Complexity:** Network topology analysis, connectivity validation
6. **MCP Tool Suite:** 8-9 tools with different permission models
7. **Error Handling:** Many failure modes require specific handling and recommendations
8. **Testing Requirements:** Must test across multiple Docker networking scenarios

**Estimated Implementation Time:** 1-2 days

**Recommended Epic Breakdown:**
1. Epic 1: Tunnel monitoring and lifecycle management
2. Epic 2: Multi-domain discovery and CNAME management
3. Epic 3: Ingress rule automation and config management
4. Epic 4: Docker network intelligence and connectivity validation
5. Epic 5: MCP tool suite and PS integration
6. Epic 6: State management, audit logging, and cleanup

---

## Next Steps

1. **Planning Phase:** Create comprehensive epic breakdown with `/create-epic tunnel-manager`
2. **Architecture Phase:** Create ADRs for key technical decisions:
   - ADR: SQLite vs PostgreSQL for state management
   - ADR: Ingress target selection algorithm
   - ADR: Health monitoring frequency and restart strategy
3. **Implementation Prep:** Break epics into GitHub issues for SCAR
4. **Testing Strategy:** Define test scenarios for all networking configurations

---

## Notes from Analysis

**Key Insights:**
- Docker network awareness is critical - wrong ingress target = silent failure
- Multi-domain support future-proofs as infrastructure grows
- Audit logging essential for debugging and compliance
- PS autonomy is primary goal - reduce MS bottleneck

**Risk Areas:**
- Config file corruption during edit (mitigation: backup before edit, validate after)
- Race conditions on concurrent CNAME requests (mitigation: database transactions)
- Tunnel restart causing brief downtime (mitigation: graceful restart, <5s outage)

**Open Questions (Resolved):**
- ✓ Monitor frequency: 30 seconds (balance between responsiveness and overhead)
- ✓ Restart strategy: Exponential backoff with unlimited retries
- ✓ Target selection: Intelligent algorithm based on Docker topology
- ✓ Tool permissions: PS can manage own CNAMEs, MS can manage all

---

**Analyst:** Claude Sonnet 4.5
**Review:** Ready for PM Agent - Epic Creation Phase
