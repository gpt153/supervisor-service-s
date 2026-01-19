# ADR-001: SQLite for Tunnel Manager State vs PostgreSQL

**Status:** Accepted
**Date:** 2026-01-19
**Decision Maker:** Architect Agent
**Related Epic:** [005-tunnel-manager.md](../epics/005-tunnel-manager.md)
**Review Date:** 2026-04-19 (3 months)

---

## Context

The tunnel-manager feature (Epic 005) requires persistent state storage for:
- CNAME ownership tracking (which PS created which subdomain)
- Tunnel health metrics (uptime, restart count, status history)
- Docker network topology (networks, containers, ports, connectivity)
- Discovered Cloudflare domains (zone IDs, discovery timestamps)
- Audit logging (all operations: who, what, when, success/failure)

The supervisor-service already uses **PostgreSQL 17.7** as its primary database for:
- Secrets management (encrypted storage)
- Port allocation (conflict prevention)
- Project configuration
- PIV loop state
- Learning/RAG vectors

**Decision Question:** Should tunnel-manager use the existing PostgreSQL database or a dedicated SQLite database?

### Forces at Play

**Technical:**
- Tunnel state is tightly coupled to tunnel-manager component (not shared across system)
- Read-heavy workload (health checks query status, PSs list CNAMEs frequently)
- Low write volume (CNAME creation/deletion is infrequent, health checks write every 30s)
- Simple data model (8 tables, no complex joins across system boundaries)
- Need for fast local access (health monitoring every 30 seconds)
- No multi-VM requirements (tunnel runs on single VM, tunnel-manager colocated)

**Operational:**
- PostgreSQL already running and maintained
- Adding SQLite = additional database to manage
- Database migrations needed for both options
- Backup/restore considerations

**Performance:**
- Health monitoring overhead must be <1% CPU
- MCP tool response time must be <500ms
- Docker network polling every 60s must be fast

**Complexity:**
- Team already familiar with PostgreSQL
- SQLite is simpler (no server, embedded)
- Migration complexity if we change our mind later

**Constraints:**
- Tunnel-manager is meta-supervisor infrastructure (not project-specific)
- Must survive VM restarts
- No horizontal scaling required (single VM)
- Low latency critical for health checks

---

## Decision

**We will use SQLite for tunnel-manager state storage.**

Specifically:
- Database file: `/home/samuel/sv/supervisor-service/data/tunnel-manager.db`
- Library: `better-sqlite3` (synchronous API, excellent performance)
- Migrations: Stored in `src/tunnel/migrations/`
- Schema: 8 tables (cnames, tunnel_health, domains, docker_networks, docker_containers, container_networks, container_ports, audit_log)
- The existing PostgreSQL database continues to be used for cross-system state (secrets, ports, PIV, learning)

---

## Rationale

### ✅ Pros of SQLite

1. **Performance:**
   - Zero network latency (embedded in-process)
   - Synchronous API = simpler code, no async overhead for reads
   - Faster for read-heavy workloads (health checks, status queries)
   - Benchmark: SQLite local reads are 10-100x faster than network database calls

2. **Simplicity:**
   - No server to configure or maintain
   - Single file = easy backups (just copy the file)
   - No connection pooling complexity
   - Migrations simpler (no concurrent client issues)

3. **Resource Efficiency:**
   - Lower memory footprint (no connection pool overhead)
   - Lower CPU usage (no network serialization)
   - Critical for <1% CPU overhead requirement

4. **Deployment:**
   - No additional infrastructure required
   - Works immediately (no separate DB provisioning)
   - Survives VM restarts automatically (file-based)

5. **Data Isolation:**
   - Tunnel state is logically separate from system state
   - Clear ownership (tunnel-manager owns this data)
   - No risk of cross-contamination with other components
   - Easier to reason about data lifecycle

6. **Development Experience:**
   - Synchronous API matches use case (no callback hell)
   - better-sqlite3 is fast and well-maintained
   - Simple testing (each test gets fresh in-memory DB)
   - Easy to inspect with sqlite3 CLI

### ❌ Cons of SQLite (and Mitigations)

1. **No Horizontal Scaling:**
   - SQLite doesn't support concurrent writes from multiple processes
   - **Mitigation:** Not needed - tunnel runs on single VM, tunnel-manager is singleton
   - **Future:** If multi-VM support needed, migrate to PostgreSQL (clear upgrade path)

2. **Limited Concurrent Write Performance:**
   - SQLite serializes writes (only one writer at a time)
   - **Mitigation:** Low write volume (CNAME creation is infrequent, health checks are batched)
   - **Mitigation:** Reads don't block (WAL mode enabled)

3. **Separate Database to Manage:**
   - Adds another database to backup/restore
   - **Mitigation:** Simple file copy for backups
   - **Mitigation:** Can be automated in VM snapshot process

4. **No pgcrypto for Encryption:**
   - SQLite doesn't have PostgreSQL's encryption extensions
   - **Mitigation:** Not needed - tunnel state is not sensitive (CNAMEs are public, health metrics are operational)
   - **Mitigation:** Secrets still stored in PostgreSQL via SecretsManager

5. **Team Familiarity:**
   - Team already knows PostgreSQL well
   - **Mitigation:** SQLite API is simpler, less to learn
   - **Mitigation:** better-sqlite3 has excellent docs

### Why SQLite Wins

**Primary Deciding Factor: Performance Requirements**

The tunnel-manager has strict performance requirements:
- Health monitoring overhead <1% CPU
- MCP tool response time <500ms
- Docker polling every 60 seconds

PostgreSQL's network latency (even on localhost) would add 1-5ms per query. With health checks every 30s, status queries from PSs, and Docker polling, this compounds quickly. SQLite's zero-latency embedded access keeps overhead minimal.

**Secondary Factor: Data Isolation & Ownership**

Tunnel state is logically separate from the rest of the supervisor-service:
- CNAME ownership is tunnel-specific
- Health metrics are tunnel-specific
- Docker topology is tunnel-specific
- Audit log is tunnel-specific

Mixing this with system-wide state (secrets, ports, PIV) in PostgreSQL would blur boundaries. Separate databases create clear separation of concerns.

**Tertiary Factor: Simplicity & Resource Efficiency**

For this specific use case:
- Read-heavy workload (perfect for SQLite)
- Single-writer model (tunnel-manager singleton)
- No cross-component queries (no need for PostgreSQL's advanced features)
- Embedded simplicity beats network complexity

**Counter-Argument Addressed:**

"But we already have PostgreSQL, why add another database?"

Response: While PostgreSQL is excellent for shared state, using it for every component creates unnecessary coupling. Tunnel-manager's state is self-contained and has different performance characteristics. The simplicity and performance gains of SQLite outweigh the marginal cost of managing a file-based database.

---

## Consequences

### Positive Consequences

1. **Faster Performance:**
   - Health checks complete in microseconds instead of milliseconds
   - MCP tools respond instantly (<100ms for status queries)
   - CPU overhead stays well below 1% target
   - Docker polling doesn't impact system performance

2. **Simpler Code:**
   - Synchronous API eliminates async complexity for reads
   - No connection pooling logic needed
   - No connection timeout handling
   - Cleaner, more readable code

3. **Easier Testing:**
   - Each unit test creates in-memory SQLite database
   - No need for test database provisioning
   - Faster test execution (no network calls)
   - Parallel test execution without conflicts

4. **Clear Boundaries:**
   - Tunnel state physically separated from system state
   - Easy to understand data ownership
   - Reduced risk of accidental cross-component dependencies

5. **Deployment Simplicity:**
   - No additional infrastructure setup
   - No database credentials to manage (beyond file permissions)
   - Works immediately on any VM with Node.js

### Negative Consequences

1. **Two Databases to Manage:**
   - Backup strategy must include both PostgreSQL and SQLite
   - Two sets of migrations to maintain
   - Must monitor two databases instead of one

2. **No Built-in Replication:**
   - If multi-VM support needed in future, will require migration
   - No hot standby capability (but not required for MVP)

3. **Limited Advanced Features:**
   - No pgvector for RAG (but tunnel data doesn't need RAG)
   - No pgcrypto for encryption (but tunnel data isn't sensitive)
   - No advanced indexing options (but simple queries don't need them)

4. **Migration Path:**
   - If we change our mind, migrating from SQLite → PostgreSQL requires data migration
   - **Mitigation:** Schema is simple (8 tables), migration would be straightforward
   - **Mitigation:** Can be done with zero downtime (write to both during transition)

### Neutral Consequences

1. **Different Query Patterns:**
   - Tunnel-manager uses better-sqlite3 API
   - Rest of system uses pg API
   - Not better or worse, just different

2. **Two Migration Systems:**
   - Tunnel-manager has its own migration runner
   - System-wide migrations separate
   - Adds structure but also separation

---

## Alternatives Considered

### Alternative 1: PostgreSQL (Existing Database)

**Description:** Use the existing PostgreSQL 17.7 database for tunnel state, adding tunnel tables alongside secrets, ports, and other system tables.

**Pros:**
- ✅ Only one database to manage
- ✅ Team already familiar with PostgreSQL
- ✅ Existing migration infrastructure
- ✅ Can use advanced features (pgcrypto, pgvector) if needed
- ✅ Better for future horizontal scaling

**Cons:**
- ❌ Network latency (1-5ms per query) even on localhost
- ❌ Connection pooling overhead
- ❌ Async API complexity for simple reads
- ❌ Higher CPU/memory usage
- ❌ Couples tunnel state to system database
- ❌ Harder to achieve <1% CPU overhead target

**Why Rejected:**

Performance requirements are too strict for network database. Health checks every 30s + frequent status queries + Docker polling = hundreds of queries per minute. Even 2ms latency per query compounds to significant overhead. The coupling of tunnel-specific state with system-wide state also violates separation of concerns.

**When This Might Be Right:**

If tunnel-manager needed to scale across multiple VMs, PostgreSQL would be the correct choice. But that's explicitly out of scope for MVP.

### Alternative 2: In-Memory Only (No Persistence)

**Description:** Store tunnel state purely in-memory (JavaScript objects, Maps) with no database persistence.

**Pros:**
- ✅ Absolute fastest performance (no disk I/O)
- ✅ Simplest code (no database layer)
- ✅ No database to manage
- ✅ No migrations needed

**Cons:**
- ❌ Data lost on restart (unacceptable)
- ❌ No audit trail (unacceptable for compliance)
- ❌ No historical health metrics
- ❌ CNAME ownership lost on crash
- ❌ Cannot recover state after failure

**Why Rejected:**

Persistence is a hard requirement. Tunnel-manager must survive VM restarts and crashes. CNAME ownership tracking is critical for audit and security. Health metrics history is needed for debugging. In-memory storage is non-starter.

### Alternative 3: Redis

**Description:** Use Redis for tunnel state storage (key-value store with persistence).

**Pros:**
- ✅ Very fast (in-memory with persistence)
- ✅ Simple key-value model
- ✅ Pub/sub for events (useful for PS notifications)
- ✅ Can scale horizontally if needed

**Cons:**
- ❌ Another service to deploy and manage
- ❌ Overkill for simple relational data
- ❌ No transactions (CNAME creation pipeline needs atomicity)
- ❌ Complex queries harder (no SQL)
- ❌ Data modeling awkward for relational data (CNAMEs ↔ projects)
- ❌ Additional infrastructure cost

**Why Rejected:**

Redis excels at caching and pub/sub, but tunnel state is primarily relational (CNAMEs belong to projects, containers belong to networks, etc.). SQL is a better fit. Redis would add complexity without clear benefits over SQLite.

### Alternative 4: Hybrid (PostgreSQL + Redis)

**Description:** Use PostgreSQL for persistent state (CNAMEs, audit log) and Redis for transient state (health metrics, Docker topology).

**Pros:**
- ✅ PostgreSQL for durable, important data
- ✅ Redis for fast, frequently-updated data
- ✅ Separation of concerns by durability requirements

**Cons:**
- ❌ Most complex option (two external databases)
- ❌ Synchronization challenges (what lives where?)
- ❌ Over-engineering for the scale (hundreds of CNAMEs, not millions)
- ❌ Double the operational burden

**Why Rejected:**

Premature optimization. The data volume is tiny (hundreds of CNAMEs, not millions). SQLite handles this easily. Hybrid approach adds massive complexity for negligible benefit.

---

## Implementation Plan

### Phase 1: Setup (Issue #1)

1. **Install better-sqlite3:**
   ```bash
   npm install better-sqlite3
   npm install --save-dev @types/better-sqlite3
   ```

2. **Create Database Class:**
   - `src/tunnel/TunnelDatabase.ts`
   - Initialize database at `/home/samuel/sv/supervisor-service/data/tunnel-manager.db`
   - Implement migration runner

3. **Write Initial Migration:**
   - `src/tunnel/migrations/001_initial_schema.sql`
   - 8 tables: cnames, tunnel_health, domains, docker_networks, docker_containers, container_networks, container_ports, audit_log
   - Indexes for common queries

### Phase 2: Integration (Issues #2-#11)

4. **Wrap Database Operations:**
   - CRUD methods for each table
   - Transaction support for multi-step operations (CNAME creation)
   - Query methods with filters (list CNAMEs by project)

5. **Configure WAL Mode:**
   - Enable Write-Ahead Logging for better concurrency
   - `PRAGMA journal_mode=WAL;`
   - Allows concurrent reads during writes

6. **Backup Strategy:**
   - Automated backups via VM snapshot (tunnel-manager.db included)
   - Manual backup: `cp tunnel-manager.db tunnel-manager.backup.db`
   - Backup before risky operations (major migrations)

### Phase 3: Monitoring

7. **Database Metrics:**
   - File size (should stay <100MB per epic requirements)
   - Query performance (log slow queries >100ms)
   - Write conflicts (should be zero with singleton model)

8. **Health Checks:**
   - Verify database file exists and is readable
   - Test write capability on startup
   - Validate schema matches current migration version

### Phase 4: Future Migration Path (If Needed)

If multi-VM support required in future:

1. **Create PostgreSQL schema** (copy from SQLite schema)
2. **Build migration script:**
   - Read all rows from SQLite
   - Write to PostgreSQL in batches
   - Verify data integrity
3. **Cutover:**
   - Write to both databases during transition
   - Switch reads to PostgreSQL
   - Stop writing to SQLite
   - Archive SQLite database

Estimated effort: 4-8 hours (straightforward data migration)

---

## Success Metrics

Measure after 30 days of production use:

### Quantitative Metrics

- [ ] **Performance:** Health check query time <1ms (p95)
- [ ] **Performance:** MCP tool response time <500ms (p95)
- [ ] **Performance:** CPU overhead <1% (measure via system monitoring)
- [ ] **Reliability:** Zero database corruption incidents
- [ ] **Reliability:** Zero data loss incidents
- [ ] **Storage:** Database file size <100MB (even with 1000 CNAMEs)

### Qualitative Metrics

- [ ] **Developer Experience:** Developers find better-sqlite3 API easy to use
- [ ] **Maintainability:** No significant issues with migrations
- [ ] **Debugging:** Easy to inspect database with sqlite3 CLI
- [ ] **Operations:** Backup/restore process is straightforward

### Decision Validation

- [ ] **Revisit after 3 months:** Are performance targets met?
- [ ] **Revisit after 3 months:** Has the two-database complexity caused issues?
- [ ] **Revisit after 3 months:** Would PostgreSQL have been simpler in hindsight?

If any metric fails or qualitative feedback is poor, consider ADR to supersede this decision.

---

## Related Decisions

- **ADR-002 (future):** Ingress Target Selection Algorithm - relies on Docker topology data stored in SQLite
- **ADR-003 (future):** Health Monitoring Frequency - health metrics stored in SQLite
- **ADR-004 (future):** Restart Strategy - restart events logged to SQLite audit_log

---

## References

- **Epic 005:** [005-tunnel-manager.md](../epics/005-tunnel-manager.md)
- **SQLite Documentation:** https://www.sqlite.org/docs.html
- **better-sqlite3 Docs:** https://github.com/WiseLibs/better-sqlite3
- **SQLite vs PostgreSQL:** https://www.sqlite.org/whentouse.html
- **Benchmarks:** https://www.sqlite.org/speed.html

---

## Notes

### Why Not Just Use PostgreSQL?

This is the question future maintainers will ask. The answer:

**PostgreSQL is excellent for shared, system-wide state.** Secrets, ports, PIV loop data, learning vectors - these benefit from PostgreSQL's features and need to be accessible across components.

**Tunnel state is different.** It's:
- Component-local (only tunnel-manager accesses it)
- Read-heavy (status checks, listings)
- Performance-critical (<1% CPU requirement)
- Simple relational model (no complex joins across system boundaries)
- No scaling requirements (single VM)

**SQLite is the right tool for this job.** It's not about "avoiding PostgreSQL" - it's about choosing the best database for the specific use case. We use PostgreSQL where it shines, and SQLite where it shines.

### When to Reconsider This Decision

Reconsider if:
1. **Multi-VM requirement emerges** - Need horizontal scaling → migrate to PostgreSQL
2. **Performance targets missed** - Overhead >1% CPU → profile and optimize, then consider alternatives
3. **Complex cross-component queries needed** - Joining tunnel state with system state → might need shared database
4. **Team finds SQLite too complex** - Two databases too much overhead → consolidate to PostgreSQL

---

**Author:** Claude Sonnet 4.5 (Architect Agent)
**Approved By:** [Pending]
**Implementation Status:** Ready for Epic 005 Implementation
**Next Review:** 2026-04-19
