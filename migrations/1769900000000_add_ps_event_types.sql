-- Migration: Add PS integration event types for Epic 008-C
-- Feature: PS/MS Integration for Event Lineage
-- Date: 2026-01-31
-- Purpose: Add event types for user messages, processing, spawns, tool use, and errors

BEGIN;

-- Drop and recreate the valid_event_type constraint with new event types
ALTER TABLE event_store
DROP CONSTRAINT valid_event_type;

ALTER TABLE event_store
ADD CONSTRAINT valid_event_type CHECK (event_type IN (
  -- Original event types
  'instance_registered', 'instance_heartbeat', 'instance_stale',
  'epic_started', 'epic_completed', 'epic_failed',
  'test_started', 'test_passed', 'test_failed', 'validation_passed', 'validation_failed',
  'commit_created', 'pr_created', 'pr_merged',
  'deployment_started', 'deployment_completed', 'deployment_failed',
  'context_window_updated', 'checkpoint_created', 'checkpoint_loaded',
  'epic_planned', 'feature_requested', 'task_spawned',
  -- New event types for PS integration (Epic 008-C)
  'user_message',      -- User sends message (root event)
  'assistant_start',   -- PS starts processing
  'spawn_decision',    -- PS decides to spawn subagent
  'tool_use',          -- Tool invoked (Task, Bash, etc.)
  'tool_result',       -- Tool completed with result
  'error'              -- Error during processing
));

COMMIT;
