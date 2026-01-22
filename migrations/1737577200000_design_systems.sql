-- Migration: Design Systems Foundation
-- Epic: UI-002
-- Purpose: Create tables for design systems and Storybook deployments

-- Design systems table
CREATE TABLE IF NOT EXISTS design_systems (
  id SERIAL PRIMARY KEY,
  project_name TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  style_config JSONB NOT NULL DEFAULT '{}',
  component_library JSONB NOT NULL DEFAULT '{"components": [], "version": "1.0.0"}',
  storybook_port INTEGER,
  storybook_url TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(project_name, name)
);

-- Create index for faster project lookups
CREATE INDEX IF NOT EXISTS idx_design_systems_project ON design_systems(project_name);

-- Create index for Storybook URL lookups
CREATE INDEX IF NOT EXISTS idx_design_systems_url ON design_systems(storybook_url) WHERE storybook_url IS NOT NULL;

-- Storybook deployments table (tracks deployment status)
CREATE TABLE IF NOT EXISTS storybook_deployments (
  id SERIAL PRIMARY KEY,
  design_system_id INTEGER NOT NULL REFERENCES design_systems(id) ON DELETE CASCADE,
  port INTEGER NOT NULL,
  url TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'building', 'running', 'stopped', 'failed')),
  build_directory TEXT NOT NULL,
  process_id INTEGER,
  last_deployed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(design_system_id)
);

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS idx_storybook_status ON storybook_deployments(status);

-- Create index for foreign key lookups
CREATE INDEX IF NOT EXISTS idx_storybook_design_system ON storybook_deployments(design_system_id);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for design_systems
DROP TRIGGER IF EXISTS update_design_systems_updated_at ON design_systems;
CREATE TRIGGER update_design_systems_updated_at
  BEFORE UPDATE ON design_systems
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for storybook_deployments
DROP TRIGGER IF EXISTS update_storybook_deployments_updated_at ON storybook_deployments;
CREATE TRIGGER update_storybook_deployments_updated_at
  BEFORE UPDATE ON storybook_deployments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE design_systems IS 'Design systems with style configuration and component definitions';
COMMENT ON TABLE storybook_deployments IS 'Storybook deployment status and process tracking';
COMMENT ON COLUMN design_systems.style_config IS 'JSONB: Design tokens (colors, typography, spacing, etc.)';
COMMENT ON COLUMN design_systems.component_library IS 'JSONB: Component definitions and variants';
COMMENT ON COLUMN storybook_deployments.status IS 'Deployment status: pending, building, running, stopped, failed';
