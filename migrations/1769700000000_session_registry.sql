-- Migration: Create supervisor_sessions table for session continuity foundation
-- Feature: Session Continuity System (Epic 007-A)
-- Date: 2026-01-28
-- Purpose: Instance registry for tracking PS/MS sessions with heartbeat monitoring

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

  CONSTRAINT valid_instance_id CHECK (instance_id ~ '^[a-z0-9-]+-(PS|MS)-[a-z0-9]{6}$')
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_supervisor_sessions_project_status
  ON supervisor_sessions(project, status);

CREATE INDEX IF NOT EXISTS idx_supervisor_sessions_instance_id
  ON supervisor_sessions(instance_id);

CREATE INDEX IF NOT EXISTS idx_supervisor_sessions_last_heartbeat
  ON supervisor_sessions(last_heartbeat DESC);

CREATE INDEX IF NOT EXISTS idx_supervisor_sessions_project_heartbeat
  ON supervisor_sessions(project, last_heartbeat DESC);

-- Trigger to auto-update heartbeat timestamp on heartbeat updates
CREATE OR REPLACE FUNCTION update_last_heartbeat()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_heartbeat = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_supervisor_sessions_heartbeat ON supervisor_sessions;

CREATE TRIGGER trg_supervisor_sessions_heartbeat
BEFORE UPDATE ON supervisor_sessions
FOR EACH ROW
WHEN (OLD.context_percent IS DISTINCT FROM NEW.context_percent OR
      OLD.current_epic IS DISTINCT FROM NEW.current_epic)
EXECUTE FUNCTION update_last_heartbeat();

COMMIT;
