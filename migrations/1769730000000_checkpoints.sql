-- Migration: Create checkpoints table for session continuity
-- Feature: Session Continuity System (Epic 007-D)
-- Date: 2026-01-28
-- Purpose: Checkpoint system for fast recovery from 80% context window or epic completion

BEGIN;

-- Create checkpoint_type enum for type discrimination
CREATE TYPE checkpoint_type AS ENUM (
  'context_window',
  'epic_completion',
  'manual'
);

-- Create checkpoints table for storing work state snapshots
CREATE TABLE IF NOT EXISTS checkpoints (
  checkpoint_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id VARCHAR(32) NOT NULL REFERENCES supervisor_sessions(instance_id) ON DELETE CASCADE,
  checkpoint_type checkpoint_type NOT NULL,
  sequence_num BIGINT NOT NULL,
  context_window_percent INT CHECK (context_window_percent BETWEEN 0 AND 100),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  work_state JSONB NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraint: checkpoints are immutable (no updates allowed)
  CONSTRAINT checkpoint_immutable CHECK (created_at = updated_at)
);

-- Index for fast retrieval by instance and timestamp (most recent first)
CREATE INDEX IF NOT EXISTS idx_checkpoints_instance_time
  ON checkpoints(instance_id, timestamp DESC);

-- Index for efficient filtering by checkpoint type and creation time
CREATE INDEX IF NOT EXISTS idx_checkpoints_type_time
  ON checkpoints(checkpoint_type, created_at DESC);

-- Index for cleanup queries (retention period)
CREATE INDEX IF NOT EXISTS idx_checkpoints_created_at
  ON checkpoints(created_at DESC);

-- Index for querying by instance and type
CREATE INDEX IF NOT EXISTS idx_checkpoints_instance_type
  ON checkpoints(instance_id, checkpoint_type);

-- Function to prevent checkpoint updates (enforce immutability)
CREATE OR REPLACE FUNCTION prevent_checkpoint_update()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Checkpoints are immutable: cannot update checkpoint_id %', OLD.checkpoint_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce immutability
DROP TRIGGER IF EXISTS trg_prevent_checkpoint_update ON checkpoints;

CREATE TRIGGER trg_prevent_checkpoint_update
BEFORE UPDATE ON checkpoints
FOR EACH ROW
EXECUTE FUNCTION prevent_checkpoint_update();

-- Function to auto-update updated_at on insert (matches creation time)
CREATE OR REPLACE FUNCTION set_checkpoint_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NEW.created_at;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to set updated_at = created_at for new checkpoints
DROP TRIGGER IF EXISTS trg_set_checkpoint_updated_at ON checkpoints;

CREATE TRIGGER trg_set_checkpoint_updated_at
BEFORE INSERT ON checkpoints
FOR EACH ROW
EXECUTE FUNCTION set_checkpoint_updated_at();

COMMIT;
