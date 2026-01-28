-- Migration: Create event_store table for session continuity event tracking
-- Feature: Session Continuity System (Epic 007-C)
-- Date: 2026-01-28
-- Purpose: Immutable event store for tracking all state transitions in supervisor instances

BEGIN;

-- Create event_store table with immutable event logging
CREATE TABLE IF NOT EXISTS event_store (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id VARCHAR(32) NOT NULL REFERENCES supervisor_sessions(instance_id) ON DELETE CASCADE,
  event_type VARCHAR(64) NOT NULL,
  sequence_num BIGINT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_data JSONB NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Enforce unique sequence numbers per instance (monotonically increasing)
  CONSTRAINT unique_sequence UNIQUE (instance_id, sequence_num),

  -- Validate event_type against allowed values
  CONSTRAINT valid_event_type CHECK (event_type IN (
    'instance_registered', 'instance_heartbeat', 'instance_stale',
    'epic_started', 'epic_completed', 'epic_failed',
    'test_started', 'test_passed', 'test_failed', 'validation_passed', 'validation_failed',
    'commit_created', 'pr_created', 'pr_merged',
    'deployment_started', 'deployment_completed', 'deployment_failed',
    'context_window_updated', 'checkpoint_created', 'checkpoint_loaded',
    'epic_planned', 'feature_requested', 'task_spawned'
  ))
);

-- Indexes for performance
-- Index for fast replay by instance and sequence
CREATE INDEX IF NOT EXISTS idx_event_store_instance_seq
  ON event_store(instance_id, sequence_num ASC);

-- Index for querying events by type and timestamp
CREATE INDEX IF NOT EXISTS idx_event_store_type_timestamp
  ON event_store(event_type, timestamp DESC);

-- Index for instance cleanup (by creation time)
CREATE INDEX IF NOT EXISTS idx_event_store_instance_time
  ON event_store(instance_id, created_at DESC);

-- Index for efficient timestamp-based queries
CREATE INDEX IF NOT EXISTS idx_event_store_timestamp
  ON event_store(timestamp DESC);

-- Function to get next sequence number for an instance
CREATE OR REPLACE FUNCTION get_next_sequence_num(p_instance_id VARCHAR(32))
RETURNS BIGINT AS $$
DECLARE
  v_max_seq BIGINT;
BEGIN
  SELECT COALESCE(MAX(sequence_num), 0) INTO v_max_seq
  FROM event_store
  WHERE instance_id = p_instance_id;

  RETURN v_max_seq + 1;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_event_store_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_event_store_timestamp ON event_store;

CREATE TRIGGER trg_event_store_timestamp
BEFORE UPDATE ON event_store
FOR EACH ROW
EXECUTE FUNCTION update_event_store_timestamp();

COMMIT;
