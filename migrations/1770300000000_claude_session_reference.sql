-- Migration: Add Claude Code session reference fields
-- Feature: Claude Code Session Reference Integration (Epic 009-A)
-- Date: 2026-02-04
-- Purpose: Add columns to track Claude Code transcript UUIDs and paths for session continuity

BEGIN;

-- Add Claude Code session reference columns
ALTER TABLE supervisor_sessions
  ADD COLUMN IF NOT EXISTS claude_session_uuid VARCHAR(64),
  ADD COLUMN IF NOT EXISTS claude_session_path TEXT;

-- Partial index for efficient UUID lookups (only indexes non-NULL values)
-- This keeps the index small since most historical sessions will have NULL UUIDs
CREATE INDEX IF NOT EXISTS idx_supervisor_sessions_claude_uuid
  ON supervisor_sessions(claude_session_uuid)
  WHERE claude_session_uuid IS NOT NULL;

COMMIT;
