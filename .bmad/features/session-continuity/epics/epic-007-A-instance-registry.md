---
epic_id: session-continuity-007-A
parent_feature: session-continuity
status: in-progress
complexity: 3
created: 2026-01-28
started: 2026-01-28
completed: null
assigned_to: null
source: prd
---

# Epic 007-A: Instance Registry and ID Generation

**Feature**: Session Continuity System - Foundation Phase
**Epic ID**: session-continuity-007-A
**Status**: In Progress
**Complexity**: 3 (Medium-High)
**Created**: 2026-01-28
**Started**: 2026-01-28
**Completed**: null
**Effort**: 60 hours
**Dependencies**: None (foundation epic)
**Source**: PRD (session-continuity)

---

## Quick Reference

**Purpose**: Generate unique, user-visible instance IDs for every PS/MS session and implement heartbeat tracking

**Key Deliverable**: Foundation for session continuity - enables users to identify which instance they're talking to

**Critical Success Factor**: Instance IDs visible in every PS response footer, accessible via list/query operations

---

## Project Context

- **Project**: Supervisor Service (Meta)
- **Repository**: `/home/samuel/sv/supervisor-service-s/`
- **Tech Stack**: Node.js 20+, TypeScript 5.3+, PostgreSQL 14+, MCP
- **Parent Feature**: session-continuity
- **Related Epics**:
  - 007-B: Command Logging (blocks on this)
  - 007-C: Event Store (blocks on this)
  - 007-D: Checkpoint System (depends on this)
  - 007-E: Resume Engine (depends on this)
  - 007-F: PS Integration (depends on this)

---

## Business Context

### Problem Statement

When a VM disconnects, project supervisor (PS) instances lose all context. Users cannot:
1. **Identify instances**: 3 Odin PSes open - which was working on what?
2. **Resume specific work**: Cannot say "resume that auth implementation"
3. **Recover context**: Must manually re-explain everything after disconnect
4. **Audit history**: Cannot answer "What did PS do in last 2 hours?"
5. **Debug retroactively**: No record of which instance performed which action

**Current impact**: Context reconstruction takes 10-30 minutes per incident

### User Value

- **Instant identification**: See which instance you're talking to (footer)
- **Multi-instance management**: Distinguish 3+ simultaneous instances of same project
- **Resume capability**: Foundation for resuming from instance ID
- **Audit trail foundation**: Enables complete action history in future epics
- **Zero context loss**: 95%+ recovery rate in later epics (enabled by this foundation)

### Success Metrics

- [ ] Every PS/MS instance has unique ID on startup
- [ ] User can list all active instances by project
- [ ] User can query instance by ID/hash
- [ ] Instance marked stale after 2 minutes without heartbeat
- [ ] Instance ID visible in response footer (PS integration in 007-F)
- [ ] Uniqueness rate: >99.999% (6-char hash + project prefix)

---

## Requirements

### Functional Requirements (MoSCoW)

**MUST HAVE:**

- [ ] AC1: Generate unique instance ID on PS/MS startup
  - Format: `{project}-{type}-{short-hash}` (e.g., `odin-PS-8f4a2b`)
  - Collision rate < 1 in 16 million (6-char hash)
  - Globally unique across all instances, all time

- [ ] AC2: Create supervisor_sessions table in PostgreSQL
  - Track: instance_id, project, instance_type, status, last_heartbeat, created_at
  - Indexes on: project, instance_id, status, last_heartbeat
  - Auto-timestamp columns

- [ ] AC3: Implement mcp_meta_register_instance tool
  - Input: project, instance_type (PS|MS), initial_context
  - Output: { instance_id, project, type, created_at, status }
  - Creates row in supervisor_sessions
  - Initializes heartbeat to NOW()

- [ ] AC4: Implement mcp_meta_heartbeat tool
  - Input: instance_id, context_percent (0-100), current_epic
  - Output: { instance_id, status, last_heartbeat, stale }
  - Updates: last_heartbeat, context_percent, current_epic
  - Detects stale instances (no heartbeat for 2 minutes)

- [ ] AC5: Implement mcp_meta_list_instances tool
  - Input: project (optional), active_only (boolean)
  - Output: Array of instances with: id, project, type, status, last_heartbeat, context_percent
  - Sorted by: project, then last_heartbeat DESC
  - Includes stale detection

- [ ] AC6: Database migrations automated
  - Migration file: `migrations/00{NNN}_supervisor_sessions.sql`
  - Creates table with all required columns and indexes
  - Idempotent (can run multiple times)
  - Includes rollback procedure

**SHOULD HAVE:**

- [ ] AC7: Instance query tool (mcp_meta_get_instance_details)
  - Input: instance_id or partial ID (prefix match)
  - Output: Full instance record with status, heartbeat age, context
  - Disambiguation if multiple matches

- [ ] AC8: Performance optimizations
  - Heartbeat queries < 20ms (indexed)
  - List instances < 100ms for 100 active instances
  - Register instance < 50ms

- [ ] AC9: Stale instance handling
  - Automatic stale marking after 120 seconds without heartbeat
  - User warning when resuming stale instance (>2 hours old)
  - Cleanup of 30+ day old instances (scheduled job, optional for 007-A)

**COULD HAVE:**

- [ ] Instance offline graceful shutdown logging
- [ ] Automatic instance cleanup job
- [ ] Instance grouping by session (parent/child relationships)

**WON'T HAVE (this iteration):**

- Instance permission scoping (covered in 007-F)
- Encryption of sensitive instance data (handled at DB level)
- Instance preview/dashboard UI (covered in 007-F)

### Non-Functional Requirements

**Performance:**

- Instance registration: < 50ms
- Heartbeat update: < 20ms
- List instances: < 100ms (100 active instances)
- Query instance by ID: < 50ms
- Collision detection: < 100ms

**Security:**

- Instance IDs non-guessable (6-char hash: 2.8 trillion combinations)
- No sensitive data in instance_id itself
- Database access only via MCP tools (not direct SQL)
- Audit trail: insert_ts timestamps all operations

**Reliability:**

- Uniqueness guarantee: >99.999% (6-char hash prefix + project = ~1 in 16M)
- Heartbeat detection accuracy: >99% (2-min timeout)
- Zero data loss on shutdown (commit after insert)

**Maintainability:**

- Type-safe TypeScript (no `any`)
- JSDoc comments on all public functions
- Clear separation: ID generation, DB schema, MCP tools
- Testable components (dependency injection)

---

## Architecture

### Technical Approach

**Instance ID Generation:**
- Format: `{project}-{type}-{short-hash}`
- Short-hash: First 6 chars of SHA256(timestamp + random + project + type)
- Collision rate: ~1 in 16 million per project (mathematically sound)
- Example: `odin-PS-8f4a2b`, `meta-MS-a9b2c4`, `consilio-PS-3c7d1e`

**Heartbeat Strategy:**
- Every PS/MS response includes heartbeat call
- Non-blocking (async, fire-and-forget)
- Updates: last_heartbeat, context_percent, current_epic
- Timeout: 120 seconds = stale

**Database Pattern:**
- Append-only supervisor_sessions (insert new row on registration)
- status column: 'active' | 'stale' | 'closed'
- Indexes on: (project, status), (instance_id), (last_heartbeat)

### Integration Points

- **PostgreSQL**: supervisor_sessions table (new)
- **MCP Server**: 3 new tools (register, heartbeat, list)
- **Future epics**: 007-B, 007-C, 007-D, 007-E, 007-F build on this
- **PS Integration**: Footer display (in 007-F)

### Key Technical Decisions

See ADRs:
- [ADR-007-001: Instance ID Format and Collision Avoidance](../adr/ADR-007-001-instance-id-format.md)
- [ADR-007-002: Heartbeat Timeout (120s)](../adr/ADR-007-002-heartbeat-timeout.md)

**Why SHA256 hash instead of UUID?**
- User-visible (short, memorable)
- Project-scoped (collision unlikely across projects)
- Timestamp-based (enables sorting, debugging)

**Why 6 characters?**
- 256^6 = ~281 trillion combinations
- ~1 collision per 16 million instances
- Practical uniqueness for 10-year system
- Short enough to type/share

**Why 2-minute timeout?**
- VM disconnects detected within 2 min
- Long enough for normal operation pauses
- Short enough for practical recovery
- Matches SSH keep-alive defaults

### Data Flow

```
PS/MS Startup
  ↓
Call: mcp_meta_register_instance(project, type, context)
  ↓
Service: Generate ID {project}-{type}-{hash}
  ↓
DB: Insert row into supervisor_sessions (status='active')
  ↓
Return: { instance_id, created_at, project, type }
  ↓
PS/MS stores instance_id locally
  ↓
Every response: Call mcp_meta_heartbeat(instance_id, context_percent, epic)
  ↓
DB: UPDATE last_heartbeat, context_percent, current_epic
  ↓
Return: { status, stale, last_update_age }
  ↓
[After 120s without heartbeat]
  ↓
mark instance as 'stale' on next query

User: list_instances()
  ↓
DB: SELECT * FROM supervisor_sessions ORDER BY project, last_heartbeat DESC
  ↓
Return: Formatted list with instance IDs, status, age
```

---

## Implementation Notes

### Task Breakdown

**Task 1: Database Schema and Migrations (14 hours)**
- Create `migrations/00{NNN}_supervisor_sessions.sql` migration
  - Table: supervisor_sessions (instance_id PK, project, type, status, last_heartbeat, context_percent, current_epic, created_at)
  - Indexes: (project, status), instance_id, last_heartbeat
  - Constraints: status IN ('active', 'stale', 'closed')
  - Timestamps: auto-update last_heartbeat on heartbeat calls
- Test migration: idempotent, reversible
- Verify indexes created
- Load test: Can create 1000 instances in <5s

**Task 2: Instance ID Generation Service (10 hours)**
- Create `src/services/instance-registry.ts`
  - Function: generateInstanceId(project: string, type: 'PS'|'MS'): string
  - Function: validateInstanceId(id: string): boolean
  - Pattern: {project}-{type}-{6-char-hash}
  - Hash: SHA256(Date.now() + crypto.random() + project + type).substring(0, 6)
- Unit tests: 100 generated IDs have no collisions, valid format
- Type definitions: `src/types/instance.ts`
  - Type: InstanceType = 'PS' | 'MS'
  - Type: Instance = { id, project, type, status, lastHeartbeat, contextPercent, createdAt }

**Task 3: Database Client Functions (16 hours)**
- Create `src/db/instance-registry.ts`
  - Function: registerInstance(project, type, context): Promise<Instance>
    - INSERT into supervisor_sessions
    - Return full instance record
  - Function: updateHeartbeat(instanceId, contextPercent, epic): Promise<Instance>
    - UPDATE last_heartbeat = NOW()
    - UPDATE context_percent, current_epic
    - Return updated instance
  - Function: listInstances(project?, activeOnly?): Promise<Instance[]>
    - SELECT all matching, sorted by project then last_heartbeat DESC
    - Mark stale if last_heartbeat > 2 minutes ago
    - Return sorted array
  - Function: getInstanceDetails(instanceId): Promise<Instance | null>
    - SELECT by instance_id
    - Support partial match (prefix)
  - Function: markInstanceClosed(instanceId): Promise<void>
    - UPDATE status = 'closed'
  - Error handling: specific exceptions for duplicate ID, not found
  - Performance: all queries indexed, <100ms for 100 instances

**Task 4: MCP Tool Implementations (12 hours)**
- Create `src/mcp/tools/register-instance.ts`
  - Tool: mcp_meta_register_instance
  - Input schema: { project: string, instance_type: 'PS'|'MS', initial_context?: object }
  - Output schema: { instance_id, project, type, created_at, status }
  - Implementation: Call registerInstance(), return formatted result
- Create `src/mcp/tools/heartbeat.ts`
  - Tool: mcp_meta_heartbeat
  - Input schema: { instance_id: string, context_percent: number (0-100), current_epic?: string }
  - Output schema: { instance_id, status, last_heartbeat, age_seconds, stale }
  - Implementation: Call updateHeartbeat(), mark stale if needed
- Create `src/mcp/tools/list-instances.ts`
  - Tool: mcp_meta_list_instances
  - Input schema: { project?: string, active_only?: boolean }
  - Output schema: Array of instances with formatted last_heartbeat
  - Implementation: Call listInstances(), format for display
- Create `src/mcp/tools/get-instance.ts`
  - Tool: mcp_meta_get_instance_details
  - Input schema: { instance_id: string }
  - Output schema: Full instance record or disambigation list
  - Validation: Reject if >1 partial match without exact match

**Task 5: Type Definitions and Interfaces (6 hours)**
- Create `src/types/instance.ts`
  - Enum: InstanceStatus = 'active' | 'stale' | 'closed'
  - Enum: InstanceType = 'PS' | 'MS'
  - Interface: Instance = { id, project, type, status, lastHeartbeat, contextPercent, currentEpic, createdAt }
  - Interface: RegisterInstanceInput
  - Interface: HeartbeatInput
  - Interface: ListInstancesInput
  - Interface: InstanceResponse (formatted for MCP)
- Validation: Type guards for all inputs
- JSDoc: Every interface documented

**Task 6: Unit Tests (10 hours)**
- Test `services/instance-registry.ts`
  - [ ] ID generation produces valid format
  - [ ] 100 generated IDs have zero collisions
  - [ ] ID validation accepts valid, rejects invalid
  - [ ] Project prefix correctly applied
- Test `db/instance-registry.ts`
  - [ ] registerInstance creates row
  - [ ] updateHeartbeat updates last_heartbeat only
  - [ ] listInstances returns sorted array
  - [ ] getInstanceDetails finds by ID
  - [ ] getInstanceDetails handles prefix match
  - [ ] Stale detection (2-min timeout)
  - [ ] Performance: <100ms for 100 instances
- Test `mcp/tools/*`
  - [ ] register-instance validates input, returns valid output
  - [ ] heartbeat validates context_percent (0-100)
  - [ ] list-instances handles filters
  - [ ] get-instance handles disambiguation
- Coverage: >80% code coverage

### Estimated Effort

- Task 1 (Database): 14 hours
- Task 2 (ID Generation): 10 hours
- Task 3 (DB Client): 16 hours
- Task 4 (MCP Tools): 12 hours
- Task 5 (Types): 6 hours
- Task 6 (Tests): 10 hours
- **Total**: 60 hours (estimate, ~1-2 weeks with experienced developer)

---

## Acceptance Criteria

**Feature-Level Acceptance:**

- [ ] AC1: Instance ID generation
  - Every PS/MS instance has unique ID on startup
  - Format: `{project}-{type}-{short-hash}` (e.g., odin-PS-8f4a2b)
  - Collision rate < 1 in 16 million
  - 100 test IDs generated, zero collisions

- [ ] AC2: supervisor_sessions table
  - PostgreSQL table created with columns: instance_id (PK), project, type, status, last_heartbeat, context_percent, current_epic, created_at
  - Indexes on: (project, status), instance_id, last_heartbeat
  - Migration file created, idempotent, reversible

- [ ] AC3: mcp_meta_register_instance tool
  - Accepts: project, instance_type, initial_context
  - Returns: instance_id, project, type, created_at, status
  - Creates row in supervisor_sessions
  - Response validated in unit tests

- [ ] AC4: mcp_meta_heartbeat tool
  - Accepts: instance_id, context_percent (0-100), current_epic
  - Updates: last_heartbeat, context_percent, current_epic
  - Detects stale (120s timeout)
  - Returns: status, age_seconds, stale boolean
  - Performance: <20ms per call

- [ ] AC5: mcp_meta_list_instances tool
  - Accepts: project (optional), active_only (boolean)
  - Returns: Array of instances sorted by project, then last_heartbeat DESC
  - Marks stale instances
  - Performance: <100ms for 100 instances
  - Manual test: Lists all active Odin instances

- [ ] AC6: Instance query capability
  - User can query instance by full ID: `get_instance(odin-PS-8f4a2b)`
  - User can query by prefix: `get_instance(8f4a2b)`
  - Disambiguation if multiple matches
  - Performance: <50ms

- [ ] AC7: Stale detection
  - Instance marked stale after 120s without heartbeat
  - list_instances marks stale instances
  - User warned on resume of stale instance
  - Automated test: Verify stale detection

**Code Quality:**

- [ ] All code type-safe (no `any` types)
- [ ] JSDoc comments on all public functions
- [ ] No security vulnerabilities (npm audit)
- [ ] No mocks in production code
- [ ] Tests cover critical paths (>80% coverage)

**Documentation:**

- [ ] Database schema documented in migration file
- [ ] MCP tools documented in tool specifications
- [ ] Instance ID format documented in code comments
- [ ] Integration points documented for 007-B, 007-C, 007-D, 007-E, 007-F

---

## Dependencies

**Blocked By:**

- None (foundation epic)

**Blocks:**

- Epic 007-B: Command Logging (depends on instance_id for logging context)
- Epic 007-C: Event Store (depends on instance_id for event attribution)
- Epic 007-D: Checkpoint System (depends on instance_id for checkpoint association)
- Epic 007-E: Resume Engine (depends on instance_id for context reconstruction)
- Epic 007-F: PS Integration (depends on instance_id for footer display)

**External Dependencies:**

- PostgreSQL 14+ (already deployed)
- Node.js 20+ (already deployed)
- TypeScript 5.3+ (already deployed)
- MCP server infrastructure (already deployed)

---

## Database Migration

### Migration File: 00{NNN}_supervisor_sessions.sql

```sql
-- Migration: Create supervisor_sessions table for session continuity foundation
-- Feature: Session Continuity System (Epic 007-A)
-- Date: 2026-01-28

BEGIN;

-- Create supervisor_sessions table
CREATE TABLE IF NOT EXISTS supervisor_sessions (
  instance_id VARCHAR(32) PRIMARY KEY,
  project VARCHAR(64) NOT NULL,
  instance_type VARCHAR(16) NOT NULL CHECK (instance_type IN ('PS', 'MS')),
  status VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'stale', 'closed')),
  context_percent INTEGER DEFAULT 0 CHECK (context_percent >= 0 AND context_percent <= 100),
  current_epic VARCHAR(256),
  last_heartbeat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP,

  CONSTRAINT valid_instance_id CHECK (instance_id ~ '^[a-z-]+-(PS|MS)-[a-z0-9]{6}$')
);

-- Indexes for performance
CREATE INDEX idx_supervisor_sessions_project_status
  ON supervisor_sessions(project, status);

CREATE INDEX idx_supervisor_sessions_instance_id
  ON supervisor_sessions(instance_id);

CREATE INDEX idx_supervisor_sessions_last_heartbeat
  ON supervisor_sessions(last_heartbeat DESC);

CREATE INDEX idx_supervisor_sessions_project_heartbeat
  ON supervisor_sessions(project, last_heartbeat DESC);

-- Trigger to auto-update heartbeat timestamp (optional, can be done in app)
CREATE OR REPLACE FUNCTION update_last_heartbeat()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_heartbeat = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_supervisor_sessions_heartbeat
BEFORE UPDATE ON supervisor_sessions
FOR EACH ROW
WHEN (OLD.last_heartbeat IS DISTINCT FROM NEW.last_heartbeat OR
      OLD.context_percent IS DISTINCT FROM NEW.context_percent OR
      OLD.current_epic IS DISTINCT FROM NEW.current_epic)
EXECUTE FUNCTION update_last_heartbeat();

COMMIT;
```

### Rollback

```sql
BEGIN;

DROP TRIGGER IF EXISTS trg_supervisor_sessions_heartbeat ON supervisor_sessions;
DROP FUNCTION IF EXISTS update_last_heartbeat();
DROP INDEX IF EXISTS idx_supervisor_sessions_project_heartbeat;
DROP INDEX IF EXISTS idx_supervisor_sessions_last_heartbeat;
DROP INDEX IF EXISTS idx_supervisor_sessions_instance_id;
DROP INDEX IF EXISTS idx_supervisor_sessions_project_status;
DROP TABLE IF EXISTS supervisor_sessions;

COMMIT;
```

---

## MCP Tool Specifications

### Tool 1: mcp_meta_register_instance

**Purpose**: Register new PS/MS instance on startup

**Input Schema**:
```typescript
{
  project: string,           // e.g., "odin", "consilio", "meta"
  instance_type: "PS" | "MS", // Project-Supervisor or Meta-Supervisor
  initial_context?: object   // Optional context (for future checkpoints)
}
```

**Output Schema**:
```typescript
{
  instance_id: string,       // e.g., "odin-PS-8f4a2b"
  project: string,
  type: "PS" | "MS",
  status: "active",
  created_at: string,        // ISO 8601 timestamp
  context_percent: 0
}
```

**Implementation**:
1. Validate input (project exists, type valid)
2. Generate instance ID via `generateInstanceId(project, type)`
3. INSERT into supervisor_sessions
4. Return formatted instance record
5. Error: DuplicateInstanceError (collision), ValidationError (invalid project)

**Performance Target**: <50ms

---

### Tool 2: mcp_meta_heartbeat

**Purpose**: Update instance heartbeat and context on every PS/MS response

**Input Schema**:
```typescript
{
  instance_id: string,       // e.g., "odin-PS-8f4a2b"
  context_percent: number,   // 0-100, context window usage
  current_epic?: string      // Optional, e.g., "007-A"
}
```

**Output Schema**:
```typescript
{
  instance_id: string,
  status: "active" | "stale",
  last_heartbeat: string,    // ISO 8601
  age_seconds: number,       // Seconds since last heartbeat
  stale: boolean,            // True if >120s since last update
  context_percent: number
}
```

**Implementation**:
1. Validate instance_id exists
2. Validate context_percent (0-100)
3. UPDATE last_heartbeat, context_percent, current_epic
4. If no update in 120+ seconds, mark status='stale'
5. Return formatted response

**Performance Target**: <20ms

---

### Tool 3: mcp_meta_list_instances

**Purpose**: List all active/recent instances, filtered by project

**Input Schema**:
```typescript
{
  project?: string,         // Optional filter, e.g., "odin"
  active_only?: boolean     // If true, exclude stale/closed
}
```

**Output Schema**:
```typescript
{
  instances: [
    {
      instance_id: string,     // e.g., "odin-PS-8f4a2b"
      project: string,
      type: "PS" | "MS",
      status: "active" | "stale" | "closed",
      last_heartbeat: string,  // ISO 8601
      age_seconds: number,
      context_percent: number,
      current_epic?: string
    }
  ],
  total_count: number,
  active_count: number,
  stale_count: number
}
```

**Implementation**:
1. Query supervisor_sessions with optional filters
2. Calculate age_seconds = NOW() - last_heartbeat
3. Mark stale if age > 120 seconds
4. Sort by: project ASC, last_heartbeat DESC
5. Return formatted array with counts

**Performance Target**: <100ms for 100 instances

---

### Tool 4: mcp_meta_get_instance_details

**Purpose**: Query instance by ID or prefix

**Input Schema**:
```typescript
{
  instance_id: string  // Full ID (odin-PS-8f4a2b) or prefix (8f4a2b)
}
```

**Output Schema**:
```typescript
{
  // If exact match:
  instance: {
    instance_id: string,
    project: string,
    type: "PS" | "MS",
    status: "active" | "stale" | "closed",
    last_heartbeat: string,
    age_seconds: number,
    context_percent: number,
    current_epic?: string,
    created_at: string
  }
}

// If multiple matches (prefix):
{
  matches: [
    { instance_id, project, type, status, age_seconds },
    { instance_id, project, type, status, age_seconds }
  ],
  message: "Multiple matches found. Specify full ID or project."
}

// If no match:
{
  error: "Instance not found",
  searched_for: string
}
```

**Implementation**:
1. Try exact match on instance_id
2. If not found, try prefix match (WHERE instance_id LIKE '{prefix}%')
3. If exactly 1 match, return full details
4. If multiple matches, return list for disambiguation
5. If no match, return error

**Performance Target**: <50ms

---

## Testing Requirements

### Unit Tests

**Instance Registry Service (`tests/unit/services/instance-registry.test.ts`)**

```typescript
describe('InstanceRegistry', () => {
  describe('generateInstanceId', () => {
    it('generates valid instance ID format', () => {
      const id = generateInstanceId('odin', 'PS');
      expect(id).toMatch(/^odin-PS-[a-z0-9]{6}$/);
    });

    it('generates 100 unique IDs with zero collisions', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(generateInstanceId('odin', 'PS'));
      }
      expect(ids.size).toBe(100);
    });

    it('includes project prefix correctly', () => {
      const id1 = generateInstanceId('consilio', 'PS');
      const id2 = generateInstanceId('odin', 'MS');
      expect(id1).toMatch(/^consilio-PS-/);
      expect(id2).toMatch(/^odin-MS-/);
    });
  });

  describe('validateInstanceId', () => {
    it('accepts valid instance IDs', () => {
      expect(validateInstanceId('odin-PS-8f4a2b')).toBe(true);
      expect(validateInstanceId('meta-MS-a9b2c4')).toBe(true);
    });

    it('rejects invalid formats', () => {
      expect(validateInstanceId('invalid')).toBe(false);
      expect(validateInstanceId('odin-INVALID-8f4a2b')).toBe(false);
      expect(validateInstanceId('odin-PS-short')).toBe(false);
    });
  });
});
```

**Database Client (`tests/unit/db/instance-registry.test.ts`)**

```typescript
describe('Instance Registry DB', () => {
  describe('registerInstance', () => {
    it('creates instance record with correct fields', async () => {
      const instance = await registerInstance('odin', 'PS', {});
      expect(instance.project).toBe('odin');
      expect(instance.type).toBe('PS');
      expect(instance.status).toBe('active');
    });

    it('throws on duplicate instance_id', async () => {
      const id = 'odin-PS-8f4a2b';
      // This would require mocking the hash
      expect(async () => {
        await registerInstance('odin', 'PS');
      }).not.toThrow();
    });
  });

  describe('updateHeartbeat', () => {
    it('updates last_heartbeat timestamp', async () => {
      const instance = await registerInstance('odin', 'PS');
      await new Promise(resolve => setTimeout(resolve, 100));
      const updated = await updateHeartbeat(instance.instance_id, 50);
      expect(updated.last_heartbeat).toBeGreater(instance.last_heartbeat);
    });

    it('updates context_percent correctly', async () => {
      const instance = await registerInstance('odin', 'PS');
      const updated = await updateHeartbeat(instance.instance_id, 75);
      expect(updated.context_percent).toBe(75);
    });

    it('marks instance stale after 120s without update', async () => {
      const instance = await registerInstance('odin', 'PS');
      // Mock time, then check stale detection
      const instances = await listInstances();
      // Should not be marked stale yet
      expect(instances[0].status).toBe('active');
    });
  });

  describe('listInstances', () => {
    it('returns all instances sorted by project, then last_heartbeat', async () => {
      await registerInstance('odin', 'PS');
      await registerInstance('consilio', 'PS');
      await registerInstance('odin', 'MS');
      const instances = await listInstances();
      expect(instances.length).toBe(3);
      expect(instances[0].project).toBe('consilio');
      expect(instances[1].project).toBe('odin');
    });

    it('filters by project', async () => {
      await registerInstance('odin', 'PS');
      await registerInstance('consilio', 'PS');
      const instances = await listInstances('odin');
      expect(instances.length).toBe(1);
      expect(instances[0].project).toBe('odin');
    });

    it('filters by active_only', async () => {
      const instance = await registerInstance('odin', 'PS');
      // Mock stale marking
      const active = await listInstances(undefined, true);
      expect(active.length).toBeGreaterThan(0);
    });

    it('handles 100 instances within 100ms', async () => {
      const start = Date.now();
      const instances = await listInstances();
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100);
    });
  });

  describe('getInstanceDetails', () => {
    it('finds instance by full ID', async () => {
      const instance = await registerInstance('odin', 'PS');
      const details = await getInstanceDetails(instance.instance_id);
      expect(details).toEqual(instance);
    });

    it('finds instance by prefix', async () => {
      const instance = await registerInstance('odin', 'PS');
      const hash = instance.instance_id.split('-')[2];
      const details = await getInstanceDetails(hash);
      expect(details).toEqual(instance);
    });

    it('returns disambiguation list for multiple matches', async () => {
      const instance = await registerInstance('odin', 'PS');
      // Would need to mock to create realistic prefix match scenario
    });

    it('returns error for non-existent instance', async () => {
      const details = await getInstanceDetails('nonexistent-PS-000000');
      expect(details).toBeNull();
    });
  });
});
```

### Integration Tests

**Full Registration Flow (`tests/integration/instance-registry.test.ts`)**

```typescript
describe('Instance Registry Integration', () => {
  it('completes full lifecycle: register → heartbeat → list → query', async () => {
    // 1. Register instance
    const instance = await mcp_register_instance({
      project: 'odin',
      instance_type: 'PS'
    });
    expect(instance.status).toBe('active');

    // 2. Send heartbeat
    const beat = await mcp_heartbeat({
      instance_id: instance.instance_id,
      context_percent: 50
    });
    expect(beat.status).toBe('active');

    // 3. List instances
    const instances = await mcp_list_instances({ project: 'odin' });
    expect(instances.instances.length).toBeGreaterThan(0);

    // 4. Query by ID
    const details = await mcp_get_instance_details({
      instance_id: instance.instance_id
    });
    expect(details.instance.instance_id).toBe(instance.instance_id);
  });

  it('detects stale instances after 2 minutes', async () => {
    const instance = await mcp_register_instance({
      project: 'odin',
      instance_type: 'PS'
    });

    // Mock time advance (120 seconds)
    // ... time manipulation in test ...

    const list = await mcp_list_instances();
    const stale = list.instances.find(i => i.instance_id === instance.instance_id);
    expect(stale.status).toBe('stale');
  });

  it('handles multiple instances of same project', async () => {
    const i1 = await mcp_register_instance({ project: 'odin', instance_type: 'PS' });
    const i2 = await mcp_register_instance({ project: 'odin', instance_type: 'PS' });
    const i3 = await mcp_register_instance({ project: 'odin', instance_type: 'PS' });

    const list = await mcp_list_instances({ project: 'odin' });
    expect(list.instances.length).toBe(3);
    expect(new Set(list.instances.map(i => i.instance_id)).size).toBe(3);
  });
});
```

### Manual Testing Checklist

- [ ] Register PS instance for 'odin' project, verify ID generated
- [ ] Register MS instance for 'meta' project, verify different ID
- [ ] List all instances, verify output includes all registered instances
- [ ] List instances for single project, verify filtering works
- [ ] Query instance by full ID, verify returns exact match
- [ ] Query instance by 6-char prefix, verify returns instance
- [ ] Wait 2 minutes without heartbeat, verify marked stale
- [ ] Send heartbeat, verify updates last_heartbeat
- [ ] Update context_percent to 75%, verify stored correctly
- [ ] List 100 instances, verify completes in <100ms
- [ ] Verify database migration runs and creates table
- [ ] Verify indexes created and used in queries

---

## Integration Points

### For Epic 007-B (Command Logging)

**Epic 007-B will depend on:**
- instance_id column in supervisor_sessions (✓ created in 007-A)
- mcp_meta_list_instances tool (✓ provided by 007-A)
- Instance resolution by ID (✓ provided by 007-A)

**Integration**: Command logger will use instance_id as FK for all logged commands

### For Epic 007-C (Event Store)

**Epic 007-C will depend on:**
- instance_id from supervisor_sessions (✓ available in 007-A)
- Instance query capability (✓ provided by mcp_meta_get_instance_details in 007-A)

**Integration**: Event store will use instance_id as FK for attribution

### For Epic 007-D (Checkpoint System)

**Epic 007-D will depend on:**
- supervisor_sessions table (✓ created in 007-A)
- Heartbeat updates (✓ provided by mcp_meta_heartbeat in 007-A)
- Instance resolution (✓ provided by 007-A)

**Integration**: Checkpoints triggered when context reaches 80% (via heartbeat)

### For Epic 007-E (Resume Engine)

**Epic 007-E will depend on:**
- instance_id query tools (✓ provided by 007-A)
- supervisor_sessions data (✓ created in 007-A)
- Instance listing (✓ provided by mcp_meta_list_instances)

**Integration**: Resume engine will use instance_id to reconstruct context

### For Epic 007-F (PS Integration)

**Epic 007-F will depend on:**
- mcp_meta_register_instance (✓ provided by 007-A)
- mcp_meta_heartbeat (✓ provided by 007-A)
- Instance ID in response footer (requires instance_id from PS state)

**Integration**: PS instructions will include register on startup, heartbeat on every response

---

## Risks & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Instance ID collisions** | Low | High | Use 6-char hash + project prefix = ~1 in 16M; monitor for actual collisions; test with 100k generated IDs |
| **Heartbeat timeout too aggressive** | Medium | Medium | Start with 120s; monitor disconnect patterns; adjust based on real-world data if needed |
| **Database performance degrades** | Medium | High | Index on (project, status) and last_heartbeat; test with 10k concurrent instances; optimize queries as needed |
| **Stale detection false positives** | Medium | Medium | Use 120s timeout (conservative); test with network latency; implement grace period in resume |
| **Migration fails in production** | Low | High | Test migration in staging; make reversible; monitor rollback procedure; plan rollback strategy |
| **Logging overhead slows PS** | Medium | Medium | Heartbeat is async, non-blocking; budget <20ms; fire-and-forget pattern; don't block on DB failure |

---

## Notes

### Design Decisions

**Why instance ID instead of UUID?**
- **Instance ID**: Short (8 chars), memorable, human-readable (project prefix visible)
- **UUID**: Long (36 chars), globally unique but not readable

We chose instance ID because users need to identify instances visually in footers/lists.

**Why project prefix?**
- Scopes collision risk per project (each project gets its own namespace)
- Enables per-project instance listing without full table scan
- Makes it easy to see which project an instance belongs to (footer visibility)

**Why 120-second timeout?**
- Default SSH keep-alive is 60s, so 120s gives buffer for network delays
- Longer than typical command execution pause
- Short enough to detect VM disconnects quickly
- Matches industry standards (Jenkins, GitHub Actions both use 2-5 min)

**Why not use UUIDs or database auto-increment?**
- Auto-increment: Not suitable for distributed systems, not memorable
- UUID v4: Too long (36 chars) for footer/cli usage
- UUID v5: Requires stable namespace, less memorable
- Custom hash: Short, memorable, scoped, deterministic

### Known Limitations

- Instance ID format is project-specific (cannot query across projects in single call without parsing)
- No parent/child relationship tracking (for instance inheritance in 007-E)
- No permission scoping (all instances visible to all users)
- No automatic cleanup job (handled in 007-D or later optimization)
- No instance preview/dashboard (covered in later UI work)

### Future Enhancements

- Instance grouping by user (multi-user support in future)
- Instance tags/labels (for custom categorization)
- Instance metrics dashboard (duration, actions, success rate)
- Automatic instance cleanup (>30 days old)
- Parent instance tracking (for resume inheritance chain)
- Cross-project instance federation (for multi-service resume)

---

## Related Artifacts

**Feature PRD**: [prd.md](../prd.md)

**ADRs**:
- [ADR-007-001: Instance ID Format and Collision Avoidance](../adr/ADR-007-001-instance-id-format.md)
- [ADR-007-002: Heartbeat Timeout Strategy](../adr/ADR-007-002-heartbeat-timeout.md)

**Related Epics**:
- [Epic 007-B: Command Logging](./epic-007-B-command-logging.md)
- [Epic 007-C: Event Store](./epic-007-C-event-store.md)
- [Epic 007-D: Checkpoint System](./epic-007-D-checkpoint-system.md)
- [Epic 007-E: Resume Engine](./epic-007-E-resume-engine.md)
- [Epic 007-F: PS Integration](./epic-007-F-ps-integration.md)

---

**Specification Version**: 1.0
**Last Updated**: 2026-01-28
**Maintained by**: Meta-Supervisor (MS)
**Status**: Ready for Implementation
