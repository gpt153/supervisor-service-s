-- Migration: Add host_machine tracking to supervisor_sessions
-- Feature: Multi-machine session tracking (Epic 007-G)
-- Date: 2026-01-31
-- Purpose: Track which machine (odin3, odin4, laptop) each session is running on for multi-device support

BEGIN;

-- Add host_machine column to supervisor_sessions table
-- Default to 'odin3' for backward compatibility with existing sessions
ALTER TABLE supervisor_sessions
ADD COLUMN IF NOT EXISTS host_machine VARCHAR(64) NOT NULL DEFAULT 'odin3';

-- Add constraint to validate machine names (alphanumeric, hyphens, underscores)
ALTER TABLE supervisor_sessions
ADD CONSTRAINT valid_host_machine CHECK (host_machine ~ '^[a-z0-9][a-z0-9_-]*$');

-- Create indexes for filtering by machine
CREATE INDEX IF NOT EXISTS idx_supervisor_sessions_host_machine
  ON supervisor_sessions(host_machine);

CREATE INDEX IF NOT EXISTS idx_supervisor_sessions_machine_status
  ON supervisor_sessions(host_machine, status);

CREATE INDEX IF NOT EXISTS idx_supervisor_sessions_machine_heartbeat
  ON supervisor_sessions(host_machine, last_heartbeat DESC);

-- Create view for quick machine overview
CREATE OR REPLACE VIEW active_sessions_by_machine AS
SELECT
  host_machine,
  COUNT(*) AS total_sessions,
  COUNT(*) FILTER (WHERE status = 'active') AS active_sessions,
  COUNT(*) FILTER (WHERE status = 'stale') AS stale_sessions,
  COUNT(*) FILTER (WHERE status = 'closed') AS closed_sessions,
  MAX(last_heartbeat) AS last_activity,
  STRING_AGG(DISTINCT project, ', ' ORDER BY project) AS projects
FROM supervisor_sessions
GROUP BY host_machine
ORDER BY last_activity DESC;

-- Create view for all sessions with machine info
CREATE OR REPLACE VIEW sessions_with_machine AS
SELECT
  instance_id,
  project,
  instance_type,
  status,
  host_machine,
  context_percent,
  current_epic,
  last_heartbeat,
  created_at,
  closed_at,
  EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - last_heartbeat))::INTEGER AS age_seconds
FROM supervisor_sessions
ORDER BY host_machine, last_heartbeat DESC;

COMMIT;
