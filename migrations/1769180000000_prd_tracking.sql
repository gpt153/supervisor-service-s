-- Migration: PRD Tracking System
-- Created: 2026-01-25

-- Create PRDs table
CREATE TABLE IF NOT EXISTS prds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  feature_name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  current_version TEXT NOT NULL DEFAULT '1.0.0',
  status TEXT NOT NULL CHECK (status IN ('Draft', 'In Progress', 'Completed')),
  total_epics INTEGER NOT NULL DEFAULT 0,
  completed_epics INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure unique feature name per project
  UNIQUE(project_id, feature_name)
);

-- Create PRD versions table for changelog tracking
CREATE TABLE IF NOT EXISTS prd_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prd_id UUID NOT NULL REFERENCES prds(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  changelog TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure unique version per PRD
  UNIQUE(prd_id, version)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_prds_project_id ON prds(project_id);
CREATE INDEX IF NOT EXISTS idx_prds_feature_name ON prds(feature_name);
CREATE INDEX IF NOT EXISTS idx_prds_status ON prds(status);
CREATE INDEX IF NOT EXISTS idx_prds_updated_at ON prds(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_prd_versions_prd_id ON prd_versions(prd_id);
CREATE INDEX IF NOT EXISTS idx_prd_versions_created_at ON prd_versions(created_at DESC);

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_prd_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_prd_updated_at
  BEFORE UPDATE ON prds
  FOR EACH ROW
  EXECUTE FUNCTION update_prd_updated_at();

-- Comments for documentation
COMMENT ON TABLE prds IS 'Product Requirement Documents tracking across projects';
COMMENT ON TABLE prd_versions IS 'Version history and changelog for PRDs';
COMMENT ON COLUMN prds.feature_name IS 'Unique feature identifier (kebab-case)';
COMMENT ON COLUMN prds.status IS 'Current PRD status: Draft, In Progress, or Completed';
COMMENT ON COLUMN prds.total_epics IS 'Total number of epics associated with this PRD';
COMMENT ON COLUMN prds.completed_epics IS 'Number of completed epics';
COMMENT ON COLUMN prd_versions.changelog IS 'Description of changes in this version';
