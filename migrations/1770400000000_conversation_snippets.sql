-- Migration: Create conversation_snippets table for snippet extraction (Epic 009-B)
-- Feature: Conversation Snippet Extraction - Claude Session Integration
-- Date: 2026-02-04
-- Purpose: Store extracted conversation snippets (2-5KB) from Claude Code transcripts
-- Description: Enables pattern analysis and knowledge extraction from sessions at 99.5% storage reduction

BEGIN;

-- Create conversation_snippets table
CREATE TABLE IF NOT EXISTS conversation_snippets (
  snippet_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id VARCHAR(32) NOT NULL REFERENCES supervisor_sessions(instance_id) ON DELETE CASCADE,
  event_id UUID REFERENCES event_store(event_id) ON DELETE SET NULL,
  snippet_type VARCHAR(32) NOT NULL
    CHECK (snippet_type IN ('error_reasoning', 'decision_rationale', 'learning_pattern')),
  title VARCHAR(256) NOT NULL,
  content TEXT NOT NULL
    CHECK (LENGTH(content) >= 100 AND LENGTH(content) <= 10240),
  source_file TEXT,
  source_line_start INTEGER,
  source_line_end INTEGER,
  tags JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
-- Index for fast lookup by instance and type (e.g., all error_reasoning snippets for an instance)
CREATE INDEX IF NOT EXISTS idx_snippets_instance_type
  ON conversation_snippets(instance_id, snippet_type);

-- Index for querying by type and creation time
CREATE INDEX IF NOT EXISTS idx_snippets_type_created
  ON conversation_snippets(snippet_type, created_at DESC);

-- Index for recent snippets query
CREATE INDEX IF NOT EXISTS idx_snippets_created
  ON conversation_snippets(created_at DESC);

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_conversation_snippets_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_conversation_snippets_timestamp ON conversation_snippets;

CREATE TRIGGER trg_conversation_snippets_timestamp
BEFORE UPDATE ON conversation_snippets
FOR EACH ROW
EXECUTE FUNCTION update_conversation_snippets_timestamp();

COMMIT;
