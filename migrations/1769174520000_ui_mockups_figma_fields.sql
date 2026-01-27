-- Migration: Add Figma-specific fields to ui_mockups table
-- Epic: UI-004 - Figma Design Import Integration
-- Purpose: Store Figma URLs, design context, and component mappings

-- Add Figma-specific columns to ui_mockups table
ALTER TABLE ui_mockups
  ADD COLUMN IF NOT EXISTS figma_url TEXT,
  ADD COLUMN IF NOT EXISTS figma_file_key TEXT,
  ADD COLUMN IF NOT EXISTS figma_node_id TEXT,
  ADD COLUMN IF NOT EXISTS figma_design_context JSONB,
  ADD COLUMN IF NOT EXISTS figma_design_tokens JSONB,
  ADD COLUMN IF NOT EXISTS figma_screenshot_data TEXT;

-- Add indexes for Figma fields
CREATE INDEX IF NOT EXISTS idx_ui_mockups_figma_file_key ON ui_mockups(figma_file_key);
CREATE INDEX IF NOT EXISTS idx_ui_mockups_figma_node_id ON ui_mockups(figma_node_id);
CREATE INDEX IF NOT EXISTS idx_ui_mockups_figma_design_context ON ui_mockups USING GIN (figma_design_context);
CREATE INDEX IF NOT EXISTS idx_ui_mockups_figma_design_tokens ON ui_mockups USING GIN (figma_design_tokens);

-- Comments
COMMENT ON COLUMN ui_mockups.figma_url IS 'Original Figma URL provided by user';
COMMENT ON COLUMN ui_mockups.figma_file_key IS 'Extracted Figma file key from URL';
COMMENT ON COLUMN ui_mockups.figma_node_id IS 'Extracted Figma node ID from URL';
COMMENT ON COLUMN ui_mockups.figma_design_context IS 'Design context from Figma MCP (get_design_context)';
COMMENT ON COLUMN ui_mockups.figma_design_tokens IS 'Design tokens from Figma MCP (get_variable_defs)';
COMMENT ON COLUMN ui_mockups.figma_screenshot_data IS 'Base64-encoded screenshot from Figma MCP (get_screenshot)';
