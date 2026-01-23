-- Migration: Mock Data Generation System
-- Epic: UI-005
-- Purpose: Add mock data generation capabilities to ui_mockups table

-- Add mock data columns to ui_mockups table
ALTER TABLE ui_mockups
  ADD COLUMN IF NOT EXISTS mock_data_spec JSONB,
  ADD COLUMN IF NOT EXISTS mock_data_sample JSONB;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ui_mockups_mock_data_spec ON ui_mockups USING GIN (mock_data_spec);
CREATE INDEX IF NOT EXISTS idx_ui_mockups_mock_data_sample ON ui_mockups USING GIN (mock_data_sample);

-- Comments
COMMENT ON COLUMN ui_mockups.mock_data_spec IS 'Mock data generation specification: { entities: [], fields: {}, generator: "faker" }';
COMMENT ON COLUMN ui_mockups.mock_data_sample IS 'Sample generated mock data for preview: { users: [...], products: [...] }';
