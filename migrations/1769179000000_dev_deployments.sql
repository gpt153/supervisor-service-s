-- Migration: Dev Deployments Table
-- Epic: UI-007
-- Purpose: Track dev environment deployments for UI mockups

-- Create dev_deployments table
CREATE TABLE IF NOT EXISTS dev_deployments (
  id SERIAL PRIMARY KEY,
  epic_id VARCHAR(100) NOT NULL UNIQUE,
  project_name VARCHAR(100) NOT NULL,
  framework VARCHAR(50) NOT NULL CHECK (framework IN ('vite', 'nextjs')),
  port INTEGER NOT NULL,
  base_path VARCHAR(255) NOT NULL,
  dev_url TEXT NOT NULL,
  process_id INTEGER,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'building', 'running', 'stopped', 'failed')),
  build_output TEXT,
  error_message TEXT,
  hot_reload_enabled BOOLEAN NOT NULL DEFAULT true,
  mock_data_injected BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_dev_deployments_project_name ON dev_deployments(project_name);
CREATE INDEX idx_dev_deployments_epic_id ON dev_deployments(epic_id);
CREATE INDEX idx_dev_deployments_status ON dev_deployments(status);
CREATE INDEX idx_dev_deployments_port ON dev_deployments(port);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_dev_deployments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER dev_deployments_updated_at
  BEFORE UPDATE ON dev_deployments
  FOR EACH ROW
  EXECUTE FUNCTION update_dev_deployments_updated_at();

-- Comments
COMMENT ON TABLE dev_deployments IS 'Tracks dev environment deployments for UI mockups';
COMMENT ON COLUMN dev_deployments.epic_id IS 'Epic ID (e.g., "epic-003-user-management")';
COMMENT ON COLUMN dev_deployments.framework IS 'Dev framework: "vite" or "nextjs"';
COMMENT ON COLUMN dev_deployments.port IS 'Port number where dev server runs';
COMMENT ON COLUMN dev_deployments.base_path IS 'Base path for routing (e.g., "/consilio/dev")';
COMMENT ON COLUMN dev_deployments.dev_url IS 'Full dev URL (e.g., "https://ui.153.se/consilio/dev")';
COMMENT ON COLUMN dev_deployments.process_id IS 'PID of dev server process';
COMMENT ON COLUMN dev_deployments.status IS 'Deployment status';
COMMENT ON COLUMN dev_deployments.hot_reload_enabled IS 'Whether hot reload is enabled';
COMMENT ON COLUMN dev_deployments.mock_data_injected IS 'Whether mock data is injected';
