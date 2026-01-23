-- Migration: UI Deployments Table
-- Epic: UI-006 - Complete Storybook Deployment
-- Purpose: Track all UI deployments (Storybook, dev servers) with nginx locations

-- UI deployments table (unified tracking for all UI deployments)
CREATE TABLE IF NOT EXISTS ui_deployments (
  id SERIAL PRIMARY KEY,
  project_name TEXT NOT NULL,
  deployment_type TEXT NOT NULL CHECK (deployment_type IN ('storybook', 'dev')),
  port INTEGER NOT NULL,
  url TEXT NOT NULL,
  nginx_location TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'stopped', 'failed')),
  process_id INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(project_name, deployment_type)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ui_deployments_project ON ui_deployments(project_name);
CREATE INDEX IF NOT EXISTS idx_ui_deployments_type ON ui_deployments(deployment_type);
CREATE INDEX IF NOT EXISTS idx_ui_deployments_status ON ui_deployments(status);
CREATE INDEX IF NOT EXISTS idx_ui_deployments_port ON ui_deployments(port);

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_ui_deployments_updated_at ON ui_deployments;
CREATE TRIGGER update_ui_deployments_updated_at
  BEFORE UPDATE ON ui_deployments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE ui_deployments IS 'Unified tracking for all UI deployments (Storybook, dev servers)';
COMMENT ON COLUMN ui_deployments.deployment_type IS 'Type: storybook or dev';
COMMENT ON COLUMN ui_deployments.nginx_location IS 'Nginx location path (e.g., /consilio/storybook/)';
COMMENT ON COLUMN ui_deployments.metadata IS 'Additional deployment metadata (design_system_id, build_directory, etc.)';
