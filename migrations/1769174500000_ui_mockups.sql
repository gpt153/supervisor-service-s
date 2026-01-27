-- Migration: UI Mockups Table
-- Epic: UI-003, UI-004
-- Purpose: Track feature UI mockups (Frame0 and Figma designs)

-- Create ui_mockups table
CREATE TABLE IF NOT EXISTS ui_mockups (
  id SERIAL PRIMARY KEY,
  epic_id VARCHAR(100) NOT NULL UNIQUE,
  project_name VARCHAR(100) NOT NULL,
  design_method VARCHAR(50) NOT NULL CHECK (design_method IN ('frame0', 'figma')),
  design_url TEXT,
  design_data JSONB,
  dev_port INTEGER,
  dev_url TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'connected', 'archived')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_ui_mockups_project_name ON ui_mockups(project_name);
CREATE INDEX idx_ui_mockups_epic_id ON ui_mockups(epic_id);
CREATE INDEX idx_ui_mockups_status ON ui_mockups(status);
CREATE INDEX idx_ui_mockups_design_method ON ui_mockups(design_method);

-- Create GIN index for JSONB design_data
CREATE INDEX idx_ui_mockups_design_data ON ui_mockups USING GIN (design_data);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ui_mockups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ui_mockups_updated_at
  BEFORE UPDATE ON ui_mockups
  FOR EACH ROW
  EXECUTE FUNCTION update_ui_mockups_updated_at();

-- Comments
COMMENT ON TABLE ui_mockups IS 'Tracks feature UI mockups generated from Frame0 or imported from Figma';
COMMENT ON COLUMN ui_mockups.epic_id IS 'Epic ID (e.g., "epic-003-user-management")';
COMMENT ON COLUMN ui_mockups.design_method IS 'Design generation method: "frame0" or "figma"';
COMMENT ON COLUMN ui_mockups.design_data IS 'JSON design spec (components, colors, etc.)';
COMMENT ON COLUMN ui_mockups.dev_url IS 'Dev environment URL (e.g., https://ui.153.se/consilio/dev)';
COMMENT ON COLUMN ui_mockups.status IS 'Mockup status: draft, approved, connected, archived';
