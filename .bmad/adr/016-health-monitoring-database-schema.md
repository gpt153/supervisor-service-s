# ADR 016: Database Schema for Health Monitoring

**Status**: Accepted
**Date**: 2026-01-22
**Deciders**: Meta-Supervisor, User (samuel)
**Context**: Epic 040 - PS Health Monitoring System

---

## Context and Problem Statement

The PS Health Monitoring system needs to track:
- Active PS sessions and their context usage
- Spawned subagents and their output status
- Health check history for debugging and analytics

**Question**: How should we structure the database to support efficient health monitoring queries while maintaining data integrity?

---

## Decision Drivers

1. **Query Performance**: Fast lookups for active spawns and session state
2. **Data Integrity**: Prevent duplicate tracking, ensure consistency
3. **Audit Trail**: Complete history of health checks for debugging
4. **Extensibility**: Easy to add new health check types
5. **Simplicity**: Minimal joins, straightforward queries

---

## Considered Options

### Option 1: Single Unified Table

**Approach**: One table with all health monitoring data

```sql
CREATE TABLE health_monitoring (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(20), -- 'session', 'spawn', 'check'
  project VARCHAR(50),
  data JSONB, -- All attributes in JSON
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Pros**:
- Simple schema (one table)
- Flexible (JSON for different entity types)

**Cons**:
- Poor query performance (full table scans)
- No type safety or constraints
- Hard to index effectively
- Difficult to query (JSON path queries)

**Verdict**: ❌ Rejected - Performance and maintainability issues

---

### Option 2: Separate Tables per Entity Type (SELECTED)

**Approach**: Three focused tables with explicit columns

```sql
CREATE TABLE ps_sessions (...);
CREATE TABLE active_spawns (...);
CREATE TABLE health_checks (...);
```

**Pros**:
- ✅ Fast queries (indexed columns)
- ✅ Type safety (column constraints)
- ✅ Clear data model
- ✅ Easy to query (simple WHERE clauses)
- ✅ Separate concerns (session vs spawn vs audit)

**Cons**:
- More tables to maintain
- Slight schema complexity

**Verdict**: ✅ **SELECTED** - Best balance of performance and maintainability

---

### Option 3: NoSQL/Document Store

**Approach**: Use MongoDB or similar for flexible schema

**Pros**:
- Schema flexibility
- Good for unstructured health data

**Cons**:
- Adds new dependency (PostgreSQL already available)
- Overkill for structured data
- Less query power than SQL
- No foreign key constraints

**Verdict**: ❌ Rejected - Unnecessary complexity, PostgreSQL sufficient

---

## Decision

**We will use three separate tables: ps_sessions, active_spawns, health_checks.**

### Schema Design

#### Table 1: ps_sessions

**Purpose**: Track active PS sessions and their context state

```sql
CREATE TABLE ps_sessions (
  id SERIAL PRIMARY KEY,
  project VARCHAR(50) UNIQUE NOT NULL,
  session_type VARCHAR(10) DEFAULT 'cli',  -- 'cli' or 'sdk'
  session_id VARCHAR(100),                 -- tmux session name
  started_at TIMESTAMP DEFAULT NOW(),
  last_activity TIMESTAMP DEFAULT NOW(),
  last_context_check TIMESTAMP,
  context_usage FLOAT CHECK (context_usage >= 0 AND context_usage <= 1),
  estimated_tokens_used INT CHECK (estimated_tokens_used >= 0),

  INDEX idx_project (project),
  INDEX idx_last_activity (last_activity),
  INDEX idx_context_usage (context_usage)
);
```

**Key Design Decisions**:
- `project` is UNIQUE (only one active session per project)
- `context_usage` stored as float 0.0-1.0 (percentage)
- Timestamps for activity tracking
- Indexes on common query columns

---

#### Table 2: active_spawns

**Purpose**: Track spawned subagents and their health status

```sql
CREATE TABLE active_spawns (
  id SERIAL PRIMARY KEY,
  project VARCHAR(50) NOT NULL,
  task_id VARCHAR(100) NOT NULL,
  task_type VARCHAR(50),                   -- 'research', 'implementation', etc.
  description TEXT,
  spawn_time TIMESTAMP DEFAULT NOW(),
  last_output_change TIMESTAMP,
  output_file TEXT,                        -- Path to agent output file
  status VARCHAR(20) DEFAULT 'running',    -- 'running', 'completed', 'failed', 'stalled'

  UNIQUE(project, task_id),
  INDEX idx_project_status (project, status),
  INDEX idx_spawn_time (spawn_time),
  INDEX idx_status (status)
);
```

**Key Design Decisions**:
- `(project, task_id)` is UNIQUE (one tracking record per spawn)
- `output_file` stores path for file modification time checks
- `last_output_change` tracks activity (detect stalls)
- `status` enum for lifecycle tracking

---

#### Table 3: health_checks

**Purpose**: Audit trail of all health checks performed

```sql
CREATE TABLE health_checks (
  id SERIAL PRIMARY KEY,
  project VARCHAR(50) NOT NULL,
  check_time TIMESTAMP DEFAULT NOW(),
  check_type VARCHAR(50),                  -- 'spawn', 'context', 'handoff', 'orphaned_work'
  status VARCHAR(20),                      -- 'ok', 'warning', 'critical'
  details JSONB,                           -- Flexible data per check type
  action_taken TEXT,                       -- Human-readable action description

  INDEX idx_project_time (project, check_time),
  INDEX idx_check_type (check_type),
  INDEX idx_status (status),
  INDEX idx_check_time (check_time DESC)
);
```

**Key Design Decisions**:
- No UNIQUE constraint (multiple checks of same type allowed)
- `details` JSONB for flexible per-check-type data
- `action_taken` for audit trail clarity
- Indexes optimized for time-range queries

---

## Query Patterns

### Get Active Spawns for a Project
```sql
SELECT * FROM active_spawns
WHERE project = 'consilio' AND status = 'running'
ORDER BY spawn_time DESC;
```

### Get Session Context Usage
```sql
SELECT project, context_usage, estimated_tokens_used, last_context_check
FROM ps_sessions
WHERE project = 'consilio';
```

### Get Recent Health Check History
```sql
SELECT check_time, check_type, status, action_taken
FROM health_checks
WHERE project = 'consilio' AND check_time > NOW() - INTERVAL '24 hours'
ORDER BY check_time DESC;
```

### Find Stalled Spawns
```sql
SELECT * FROM active_spawns
WHERE status = 'running'
  AND last_output_change < NOW() - INTERVAL '15 minutes';
```

### Find High-Context Sessions
```sql
SELECT project, context_usage, last_context_check
FROM ps_sessions
WHERE context_usage > 0.70
ORDER BY context_usage DESC;
```

---

## Consequences

### Positive

- **Fast Queries**: Indexed columns provide sub-millisecond lookups
- **Data Integrity**: Constraints prevent invalid states
- **Clear Model**: Each table has focused purpose
- **Audit Trail**: Complete history in health_checks table
- **Extensibility**: Easy to add columns or new check types

### Negative

- **Schema Migrations**: Changes require migration files
- **Multiple Tables**: More tables to maintain than single-table approach
- **Storage**: Audit trail grows indefinitely (need cleanup policy)

### Neutral

- JSONB used sparingly (only for flexible health check details)
- Foreign keys not enforced (projects managed externally)
- No cascading deletes (manual cleanup)

---

## Migration Strategy

**Migration File**: `migrations/007-ps-health-monitoring.sql`

**Up Migration**:
```sql
-- Create tables in order
CREATE TABLE ps_sessions (...);
CREATE TABLE active_spawns (...);
CREATE TABLE health_checks (...);

-- Create indexes
CREATE INDEX ...;
```

**Down Migration**:
```sql
DROP TABLE health_checks;
DROP TABLE active_spawns;
DROP TABLE ps_sessions;
```

---

## Data Retention Policy

**Active Data**:
- `ps_sessions`: Cleaned when session ends (manual or timeout)
- `active_spawns`: Cleaned when spawn completes/fails
- `health_checks`: Retain 30 days (configurable)

**Cleanup Query** (run daily):
```sql
DELETE FROM health_checks
WHERE check_time < NOW() - INTERVAL '30 days';
```

---

## Future Considerations

**Analytics**:
- Aggregate health_checks for spawn success rate
- Context usage patterns per project
- Average spawn duration by task type

**Optimizations**:
- Partitioning health_checks by month (if volume grows)
- Materialized views for dashboard queries
- Archive old health checks to separate table

**Extensions**:
- Add `failure_reason` column to active_spawns
- Add `handoff_file_path` to ps_sessions
- Add `parent_spawn_id` to active_spawns (spawn chains)

---

## References

- Epic 040: PS Health Monitoring System
- ADR 015: tmux Prompting Mechanism
- PostgreSQL documentation: Indexes and JSONB
- Existing supervisor database schema (issues, epics tables)
