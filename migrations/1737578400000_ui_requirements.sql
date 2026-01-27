-- Migration: UI Requirements Table
-- Epic: UI-001
-- Purpose: Store structured UI requirements extracted from epic acceptance criteria

-- UI requirements table
CREATE TABLE IF NOT EXISTS ui_requirements (
  id SERIAL PRIMARY KEY,
  epic_id TEXT NOT NULL UNIQUE,
  project_name TEXT NOT NULL,
  acceptance_criteria JSONB NOT NULL DEFAULT '[]',
  user_stories JSONB NOT NULL DEFAULT '[]',
  data_requirements JSONB NOT NULL DEFAULT '{"entities": [], "operations": []}',
  navigation_needs JSONB NOT NULL DEFAULT '{"pages": [], "transitions": []}',
  design_constraints JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index for faster epic lookups
CREATE INDEX IF NOT EXISTS idx_ui_requirements_epic ON ui_requirements(epic_id);

-- Create index for project filtering
CREATE INDEX IF NOT EXISTS idx_ui_requirements_project ON ui_requirements(project_name);

-- Create GIN index for JSONB queries (find specific UI components)
CREATE INDEX IF NOT EXISTS idx_ui_requirements_ac_gin ON ui_requirements USING gin (acceptance_criteria);

-- Trigger for updated_at timestamp
DROP TRIGGER IF EXISTS update_ui_requirements_updated_at ON ui_requirements;
CREATE TRIGGER update_ui_requirements_updated_at
  BEFORE UPDATE ON ui_requirements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE ui_requirements IS 'Structured UI requirements extracted from epic acceptance criteria';
COMMENT ON COLUMN ui_requirements.epic_id IS 'Epic identifier (e.g., "epic-003-user-management")';
COMMENT ON COLUMN ui_requirements.acceptance_criteria IS 'JSONB: Array of acceptance criteria with UI elements and user flows';
COMMENT ON COLUMN ui_requirements.user_stories IS 'JSONB: Array of user stories in "As a... I want... So that..." format';
COMMENT ON COLUMN ui_requirements.data_requirements IS 'JSONB: Entity and operation requirements for the UI';
COMMENT ON COLUMN ui_requirements.navigation_needs IS 'JSONB: Pages and navigation transitions';
COMMENT ON COLUMN ui_requirements.design_constraints IS 'JSONB: Accessibility, responsive, branding, performance constraints';
