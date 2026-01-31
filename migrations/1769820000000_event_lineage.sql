-- Migration: Add event lineage support
-- Feature: Event Lineage Tracking (Epic 008-A)
-- Date: 2026-01-31
-- Purpose: Enable parent-child relationships and causal chains in event store

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
  "timestamp" TIMESTAMPTZ,
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
    e.parent_uuid,
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
    e.parent_uuid,
    c.chain_depth + 1
  FROM event_store e
  INNER JOIN chain c ON e.event_id = c.parent_uuid
  WHERE c.chain_depth < p_max_depth
    AND c.parent_uuid IS NOT NULL
)
SELECT uuid, event_type, "timestamp", event_data, chain_depth as depth FROM chain ORDER BY chain_depth DESC;
$$ LANGUAGE SQL STABLE;

-- Function: Get child events (immediate only)
CREATE OR REPLACE FUNCTION get_child_events(p_event_uuid UUID)
RETURNS TABLE (
  uuid UUID,
  event_type VARCHAR(64),
  "timestamp" TIMESTAMPTZ,
  event_data JSONB
) AS $$
  SELECT event_id, event_type, timestamp, event_data
  FROM event_store
  WHERE parent_uuid = p_event_uuid
  ORDER BY timestamp;
$$ LANGUAGE SQL STABLE;

-- Function: Get event tree (all descendants)
CREATE OR REPLACE FUNCTION get_event_tree(
  p_root_uuid UUID,
  p_max_depth INTEGER DEFAULT 10
)
RETURNS TABLE (
  uuid UUID,
  event_type VARCHAR(64),
  "timestamp" TIMESTAMPTZ,
  event_data JSONB,
  depth INTEGER
) AS $$
WITH RECURSIVE tree AS (
  -- Base case: root event
  SELECT
    e.event_id as uuid,
    e.event_type,
    e.timestamp,
    e.event_data,
    0 as tree_depth
  FROM event_store e
  WHERE e.event_id = p_root_uuid

  UNION ALL

  -- Recursive case: all children
  SELECT
    e.event_id,
    e.event_type,
    e.timestamp,
    e.event_data,
    t.tree_depth + 1
  FROM event_store e
  INNER JOIN tree t ON e.parent_uuid = t.uuid
  WHERE t.tree_depth < p_max_depth
)
SELECT * FROM tree ORDER BY tree_depth ASC, timestamp ASC;
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

  v_current := p_parent_uuid;

  LOOP
    SELECT parent_uuid, event_id INTO v_current, v_root
    FROM event_store
    WHERE event_id = v_current;

    IF v_root IS NULL THEN
      -- Parent not found
      RAISE EXCEPTION 'Parent event not found: %', v_current;
    END IF;

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
