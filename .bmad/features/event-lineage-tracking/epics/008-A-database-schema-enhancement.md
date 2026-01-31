# Epic 008-A: Database Schema Enhancement for Event Lineage

**Status**: Pending
**Priority**: HIGH
**Estimated Effort**: 8 hours
**Dependencies**: None (enhances existing event_store)
**Feature**: event-lineage-tracking

---

## Overview

Enhance the existing `event_store` table with parent UUID chains to enable root cause analysis and intelligent session recovery WITHOUT the memory leaks that plague Claude Code's in-memory approach.

## Business Value

- **Root Cause Analysis**: Trace any error back to originating user request
- **Decision Audit**: Understand why PS made specific choices
- **Smart Resume**: Reconstruct context using parent chains, not full session
- **Zero Memory Bloat**: Database queries are bounded, never load entire session

## Problem Statement

**Current State:**
- `event_store` has `sequence_num` for ordering
- Cannot answer: "What caused this error?" (no parent pointers)
- Resume loads last N events by time, not by causal chain

**With Lineage:**
```
User message (uuid: msg-1, parent: null)
  └─ spawn_decision (uuid: spawn-1, parent: msg-1)
      └─ tool_use (uuid: tool-1, parent: spawn-1)
          └─ error (uuid: err-1, parent: tool-1)

Query: SELECT * FROM get_parent_chain('err-1')
Result: Complete causal chain in 50ms
```

## Acceptance Criteria

### 1. Schema Migration

- [ ] Create migration file: `migrations/1769820000000_event_lineage.sql`
- [ ] Add columns to `event_store`:
  - `parent_uuid VARCHAR(36)` - Links to parent event's event_id
  - `root_uuid VARCHAR(36)` - Top-level event for fast queries
  - `depth INTEGER` - Distance from root (0 = root event)
- [ ] Add index: `idx_event_store_parent_uuid` on `parent_uuid`
- [ ] Add index: `idx_event_store_root_uuid` on `root_uuid`
- [ ] Add self-referencing foreign key with validation trigger

### 2. Recursive Query Functions

- [ ] Create `get_parent_chain(event_uuid VARCHAR, max_depth INTEGER DEFAULT 1000)`
  - Uses recursive CTE to walk parent chain
  - Returns: uuid, event_type, timestamp, event_data, depth
  - Has depth limit to prevent infinite recursion
  - Performance: <50ms for depth 100

- [ ] Create `get_child_events(event_uuid VARCHAR)`
  - Finds all events with given parent_uuid
  - Returns immediate children only (not recursive)

- [ ] Create `get_event_tree(root_uuid VARCHAR, max_depth INTEGER DEFAULT 10)`
  - Returns all descendants of a root event
  - Ordered by timestamp within each depth level
  - Performance: <200ms for 100 descendants

### 3. Helper Functions

- [ ] Create `calculate_root_uuid(parent_uuid VARCHAR)`
  - Returns root_uuid by walking to top of chain
  - Called during insert to set root_uuid
  - Cached via root_uuid column

- [ ] Create `validate_no_cycles(event_uuid VARCHAR, parent_uuid VARCHAR)`
  - Trigger function to prevent circular references
  - Raises exception if cycle detected

### 4. Data Integrity

- [ ] Trigger to auto-calculate depth on insert
- [ ] Trigger to auto-calculate root_uuid on insert
- [ ] Trigger to validate parent_uuid exists (if not null)
- [ ] Constraint: depth >= 0
- [ ] Constraint: if parent_uuid is null, depth = 0

### 5. Backward Compatibility

- [ ] Existing events get parent_uuid = null, depth = 0, root_uuid = event_id
- [ ] Migration runs without downtime
- [ ] All existing queries continue to work

---

## Technical Specifications

### Migration SQL

```sql
-- Migration: Add event lineage support
-- File: migrations/1769820000000_event_lineage.sql

BEGIN;

-- Add lineage columns
ALTER TABLE event_store
  ADD COLUMN parent_uuid UUID,
  ADD COLUMN root_uuid UUID,
  ADD COLUMN depth INTEGER DEFAULT 0;

-- Self-referencing foreign key (nullable for root events)
ALTER TABLE event_store
  ADD CONSTRAINT fk_event_parent
    FOREIGN KEY (parent_uuid)
    REFERENCES event_store(event_id)
    ON DELETE SET NULL;

-- Indexes for lineage queries
CREATE INDEX idx_event_store_parent_uuid ON event_store(parent_uuid);
CREATE INDEX idx_event_store_root_uuid ON event_store(root_uuid);
CREATE INDEX idx_event_store_depth ON event_store(depth);

-- Set existing events as root events
UPDATE event_store
SET root_uuid = event_id, depth = 0
WHERE parent_uuid IS NULL;

-- Function: Get parent chain (recursive)
CREATE OR REPLACE FUNCTION get_parent_chain(
  p_event_uuid UUID,
  p_max_depth INTEGER DEFAULT 1000
)
RETURNS TABLE (
  uuid UUID,
  event_type VARCHAR(64),
  timestamp TIMESTAMPTZ,
  event_data JSONB,
  depth INTEGER
) AS $$
WITH RECURSIVE chain AS (
  -- Base case: start event
  SELECT
    e.event_id as uuid,
    e.event_type,
    e.timestamp,
    e.event_data,
    0 as chain_depth
  FROM event_store e
  WHERE e.event_id = p_event_uuid

  UNION ALL

  -- Recursive case: walk up parent chain
  SELECT
    e.event_id,
    e.event_type,
    e.timestamp,
    e.event_data,
    c.chain_depth + 1
  FROM event_store e
  INNER JOIN chain c ON e.event_id = c.uuid
  WHERE c.chain_depth < p_max_depth
    AND c.uuid IS NOT NULL
)
SELECT * FROM chain ORDER BY chain_depth DESC;
$$ LANGUAGE SQL STABLE;

-- Function: Get child events (immediate only)
CREATE OR REPLACE FUNCTION get_child_events(p_event_uuid UUID)
RETURNS TABLE (
  uuid UUID,
  event_type VARCHAR(64),
  timestamp TIMESTAMPTZ,
  event_data JSONB
) AS $$
  SELECT event_id, event_type, timestamp, event_data
  FROM event_store
  WHERE parent_uuid = p_event_uuid
  ORDER BY timestamp;
$$ LANGUAGE SQL STABLE;

-- Function: Calculate root UUID by walking chain
CREATE OR REPLACE FUNCTION calculate_root_uuid(p_parent_uuid UUID)
RETURNS UUID AS $$
DECLARE
  v_root UUID;
  v_current UUID := p_parent_uuid;
  v_depth INTEGER := 0;
BEGIN
  IF p_parent_uuid IS NULL THEN
    RETURN NULL; -- Will use event_id as root
  END IF;

  LOOP
    SELECT parent_uuid, event_id INTO v_current, v_root
    FROM event_store
    WHERE event_id = v_current;

    IF v_current IS NULL THEN
      RETURN v_root;
    END IF;

    v_depth := v_depth + 1;
    IF v_depth > 1000 THEN
      RAISE EXCEPTION 'Cycle detected in event chain';
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql STABLE;

-- Trigger: Auto-set depth and root_uuid on insert
CREATE OR REPLACE FUNCTION set_event_lineage()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_uuid IS NULL THEN
    NEW.depth := 0;
    NEW.root_uuid := NEW.event_id;
  ELSE
    -- Get parent's depth
    SELECT depth + 1 INTO NEW.depth
    FROM event_store
    WHERE event_id = NEW.parent_uuid;

    IF NEW.depth IS NULL THEN
      RAISE EXCEPTION 'Parent event not found: %', NEW.parent_uuid;
    END IF;

    -- Get root from parent
    SELECT root_uuid INTO NEW.root_uuid
    FROM event_store
    WHERE event_id = NEW.parent_uuid;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_event_lineage ON event_store;
CREATE TRIGGER trg_set_event_lineage
BEFORE INSERT ON event_store
FOR EACH ROW
EXECUTE FUNCTION set_event_lineage();

-- Constraint: depth must be non-negative
ALTER TABLE event_store
  ADD CONSTRAINT chk_depth_non_negative CHECK (depth >= 0);

COMMIT;
```

### Files to Create/Modify

**Create:**
1. `migrations/1769820000000_event_lineage.sql` - Schema enhancement

**Modify:**
1. `src/types/event-store.ts` - Add parent_uuid, root_uuid, depth to interfaces

---

## Testing Requirements

### Unit Tests

```typescript
// tests/unit/event-lineage-schema.test.ts
describe('Event Lineage Schema', () => {
  it('should auto-set depth=0 for root events', async () => {
    const event = await emitEvent(instanceId, 'user_message', {}, null);
    expect(event.depth).toBe(0);
    expect(event.root_uuid).toBe(event.event_id);
  });

  it('should auto-calculate depth for child events', async () => {
    const parent = await emitEvent(instanceId, 'user_message', {}, null);
    const child = await emitEvent(instanceId, 'spawn_decision', {}, parent.event_id);
    expect(child.depth).toBe(1);
    expect(child.root_uuid).toBe(parent.event_id);
  });

  it('should prevent cycles', async () => {
    // Attempt to set parent to self or descendant should fail
  });
});
```

### Integration Tests

```typescript
// tests/integration/event-lineage.test.ts
describe('Parent Chain Queries', () => {
  it('should return full chain from error to root', async () => {
    // Create chain: user -> spawn -> tool -> error
    const chain = await getParentChain(errorEventId);
    expect(chain).toHaveLength(4);
    expect(chain[0].event_type).toBe('user_message');
    expect(chain[3].event_type).toBe('error');
  });

  it('should complete in <50ms for depth 100', async () => {
    const start = Date.now();
    await getParentChain(deepEventId);
    expect(Date.now() - start).toBeLessThan(50);
  });
});
```

---

## Success Criteria

- [ ] Migration runs without errors on existing database
- [ ] All existing events have depth=0, root_uuid=event_id
- [ ] New events with parent_uuid correctly calculate depth and root_uuid
- [ ] get_parent_chain returns correct chain
- [ ] Performance: <50ms for depth 100 query
- [ ] Cycle prevention works (exception raised)
- [ ] Zero data loss during migration

---

## Implementation Steps (for Haiku Agent)

1. **Create migration file** at exact path shown above
2. **Run migration**: `npm run migrate`
3. **Update types** in `src/types/event-store.ts`:
   - Add `parent_uuid?: string` to EventItem
   - Add `root_uuid?: string` to EventItem
   - Add `depth?: number` to EventItem
4. **Test migration**: Run unit tests
5. **Verify existing data**: All old events should have depth=0

---

**Maintained by**: Meta-Supervisor
**Created**: 2026-01-31
**Last Updated**: 2026-01-31
