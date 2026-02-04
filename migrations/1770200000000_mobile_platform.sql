-- Mobile Platform Database Schema
-- Epic M-001: Foundation tables for mobile app development

-- Track mobile projects
CREATE TABLE IF NOT EXISTS mobile_projects (
  id SERIAL PRIMARY KEY,
  project_name TEXT NOT NULL UNIQUE,
  framework TEXT NOT NULL CHECK (framework IN ('react-native', 'flutter')),
  project_path TEXT NOT NULL,
  android_package_id TEXT,
  ios_bundle_id TEXT,
  metro_port INTEGER,
  port_range_start INTEGER,
  port_range_end INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  last_build TIMESTAMP,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'error'))
);

-- Track test runs on Firebase Test Lab
CREATE TABLE IF NOT EXISTS mobile_test_runs (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES mobile_projects(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios')),
  test_matrix_id TEXT,
  device_model TEXT,
  os_version TEXT,
  test_type TEXT CHECK (test_type IN ('instrumentation', 'robo', 'xctest')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'passed', 'failed', 'error')),
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  test_duration_seconds INTEGER,
  results_url TEXT,
  artifacts_path TEXT,
  failure_reason TEXT
);

-- Track deployments to TestFlight/Play Store
CREATE TABLE IF NOT EXISTS mobile_deployments (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES mobile_projects(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios')),
  version_code INTEGER NOT NULL,
  version_name TEXT NOT NULL,
  build_number INTEGER NOT NULL,
  deployment_type TEXT CHECK (deployment_type IN ('testflight', 'play-internal', 'play-beta', 'play-production')),
  deployed_at TIMESTAMP DEFAULT NOW(),
  deployed_by TEXT,
  status TEXT DEFAULT 'uploading' CHECK (status IN ('uploading', 'processing', 'available', 'failed')),
  distribution_url TEXT,
  release_notes TEXT,
  commit_hash TEXT
);

-- Firebase Test Lab device catalog
CREATE TABLE IF NOT EXISTS mobile_devices (
  id SERIAL PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios')),
  model_name TEXT NOT NULL,
  model_id TEXT NOT NULL,
  os_version TEXT NOT NULL,
  is_virtual BOOLEAN DEFAULT false,
  firebase_device_id TEXT UNIQUE,
  available BOOLEAN DEFAULT true,
  last_used TIMESTAMP,
  form_factor TEXT CHECK (form_factor IN ('phone', 'tablet'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_mobile_test_runs_project ON mobile_test_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_mobile_test_runs_status ON mobile_test_runs(status);
CREATE INDEX IF NOT EXISTS idx_mobile_deployments_project ON mobile_deployments(project_id);
CREATE INDEX IF NOT EXISTS idx_mobile_devices_platform ON mobile_devices(platform);

-- Seed common Android virtual devices
INSERT INTO mobile_devices (platform, model_name, model_id, os_version, is_virtual, firebase_device_id, form_factor)
VALUES
  ('android', 'Pixel 5', 'redfin', '30', true, 'redfin', 'phone'),
  ('android', 'Pixel 6', 'oriole', '33', true, 'oriole', 'phone'),
  ('android', 'Pixel 7', 'panther', '33', true, 'panther', 'phone'),
  ('android', 'Samsung Galaxy S21', 'x1q', '31', false, 'x1q', 'phone'),
  ('android', 'Pixel Tablet', 'tangorpro', '33', true, 'tangorpro', 'tablet')
ON CONFLICT (firebase_device_id) DO NOTHING;

-- Seed common iOS devices (Firebase Test Lab)
INSERT INTO mobile_devices (platform, model_name, model_id, os_version, is_virtual, firebase_device_id, form_factor)
VALUES
  ('ios', 'iPhone 13 Pro', 'iphone13pro', '16.6', false, 'iphone13pro', 'phone'),
  ('ios', 'iPhone 14', 'iphone14', '17.0', false, 'iphone14', 'phone'),
  ('ios', 'iPhone 15', 'iphone15', '17.5', false, 'iphone15', 'phone'),
  ('ios', 'iPad Pro 12.9"', 'ipadpro129', '17.0', false, 'ipadpro129', 'tablet')
ON CONFLICT (firebase_device_id) DO NOTHING;
