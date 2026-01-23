-- Migration: Add Frame0-specific fields to ui_mockups table
-- Epic: UI-003 - Frame0 Design Generation Integration
-- Purpose: Store Frame0 page IDs, design exports, and component mappings

-- Add Frame0-specific columns to ui_mockups table
ALTER TABLE ui_mockups
  ADD COLUMN IF NOT EXISTS frame0_page_id TEXT,
  ADD COLUMN IF NOT EXISTS frame0_design_export TEXT,
  ADD COLUMN IF NOT EXISTS component_mapping JSONB;

-- Add indexes for Frame0 fields
CREATE INDEX IF NOT EXISTS idx_ui_mockups_frame0_page_id ON ui_mockups(frame0_page_id);
CREATE INDEX IF NOT EXISTS idx_ui_mockups_component_mapping ON ui_mockups USING GIN (component_mapping);

-- Comments
COMMENT ON COLUMN ui_mockups.frame0_page_id IS 'Frame0 page identifier for the design';
COMMENT ON COLUMN ui_mockups.frame0_design_export IS 'Base64-encoded image export of the Frame0 design';
COMMENT ON COLUMN ui_mockups.component_mapping IS 'Maps Frame0 shape IDs to acceptance criteria IDs: {"shape-1": "AC-001", ...}';
