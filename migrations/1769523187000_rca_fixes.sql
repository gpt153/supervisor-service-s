-- Migration: RCA & Fix Schema
-- Epic: 006-F
-- Created: 2026-01-27

-- Root cause analyses table
CREATE TABLE IF NOT EXISTS root_cause_analyses (
  id SERIAL PRIMARY KEY,
  test_id TEXT NOT NULL,
  epic_id TEXT NOT NULL,
  evidence_id INTEGER,

  -- RCA
  failure_category TEXT NOT NULL, -- 'syntax', 'logic', 'integration', 'environment'
  root_cause TEXT NOT NULL, -- Plain language root cause
  complexity TEXT NOT NULL, -- 'simple', 'moderate', 'complex', 'requires_human'
  estimated_fix_difficulty INTEGER, -- 1-3 retries

  -- Analysis
  symptoms TEXT[], -- List of observed symptoms
  diagnosis_reasoning TEXT, -- How we determined root cause
  recommended_strategy TEXT, -- Which fix strategy to try

  analyzed_at TIMESTAMP DEFAULT NOW(),
  analyzer_model TEXT -- 'opus', 'sonnet'
);

-- Fix attempts table
CREATE TABLE IF NOT EXISTS fix_attempts (
  id SERIAL PRIMARY KEY,
  test_id TEXT NOT NULL,
  rca_id INTEGER REFERENCES root_cause_analyses(id),

  -- Retry info
  retry_number INTEGER NOT NULL, -- 1, 2, 3
  model_used TEXT NOT NULL, -- 'haiku', 'sonnet', 'opus'

  -- Fix details
  fix_strategy TEXT NOT NULL, -- 'typo_correction', 'import_fix', 'refactor', etc.
  changes_made TEXT NOT NULL, -- Git diff or description
  commit_sha TEXT, -- If changes committed

  -- Outcome
  success BOOLEAN NOT NULL,
  verification_passed BOOLEAN,
  error_message TEXT,

  -- Cost tracking
  cost_usd DECIMAL(10, 6),
  tokens_used INTEGER,

  attempted_at TIMESTAMP DEFAULT NOW()
);

-- Fix learnings table (knowledge graph)
CREATE TABLE IF NOT EXISTS fix_learnings (
  id SERIAL PRIMARY KEY,
  failure_pattern TEXT NOT NULL, -- 'ModuleNotFoundError: boto3'
  fix_strategy TEXT NOT NULL, -- 'add_dependency'
  success_rate DECIMAL(5, 2), -- 0.95 = 95% success rate
  times_tried INTEGER DEFAULT 1,
  times_succeeded INTEGER DEFAULT 0,

  -- Pattern matching
  error_regex TEXT, -- Regex to match this error
  file_pattern TEXT, -- Which files this applies to
  complexity TEXT, -- 'simple', 'moderate', 'complex'

  created_at TIMESTAMP DEFAULT NOW(),
  last_used TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_rca_test ON root_cause_analyses(test_id);
CREATE INDEX IF NOT EXISTS idx_rca_epic ON root_cause_analyses(epic_id);
CREATE INDEX IF NOT EXISTS idx_fix_attempts_test ON fix_attempts(test_id);
CREATE INDEX IF NOT EXISTS idx_fix_attempts_rca ON fix_attempts(rca_id);
CREATE INDEX IF NOT EXISTS idx_fix_learnings_pattern ON fix_learnings(failure_pattern);
CREATE INDEX IF NOT EXISTS idx_fix_learnings_strategy ON fix_learnings(fix_strategy);

-- Composite index for learning lookup
CREATE INDEX IF NOT EXISTS idx_fix_learnings_pattern_strategy ON fix_learnings(failure_pattern, fix_strategy);
