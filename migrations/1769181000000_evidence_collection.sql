-- Migration: 010_evidence_collection
-- Description: Create evidence collection framework for test verification
-- Tables: evidence_artifacts, evidence_metadata
-- Indexes: epic_id, test_type, pass_fail, timestamp

-- Evidence artifacts table
-- Stores paths and metadata for all test evidence (screenshots, logs, traces, etc.)
CREATE TABLE IF NOT EXISTS evidence_artifacts (
  id SERIAL PRIMARY KEY,
  epic_id VARCHAR(50) NOT NULL,
  test_id VARCHAR(255) NOT NULL,
  test_type VARCHAR(50) NOT NULL, -- 'ui', 'api', 'unit', 'integration'
  verification_level INTEGER, -- 5 (UI) or 6 (API) for verification
  test_name VARCHAR(500) NOT NULL,
  expected_outcome TEXT,
  actual_outcome TEXT,
  pass_fail VARCHAR(20) NOT NULL, -- 'pass', 'fail', 'pending'

  -- Artifact file paths (relative to evidence/ directory)
  screenshot_before VARCHAR(255),
  screenshot_after VARCHAR(255),
  dom_snapshot VARCHAR(255),
  console_logs VARCHAR(255),
  network_trace VARCHAR(255),
  http_request VARCHAR(255),
  http_response VARCHAR(255),
  coverage_report VARCHAR(255),

  -- Metadata
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  duration_ms INTEGER,
  error_message TEXT,
  stack_trace TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast retrieval
CREATE INDEX idx_evidence_epic ON evidence_artifacts(epic_id);
CREATE INDEX idx_evidence_test_id ON evidence_artifacts(test_id);
CREATE INDEX idx_evidence_test_type ON evidence_artifacts(test_type);
CREATE INDEX idx_evidence_pass_fail ON evidence_artifacts(pass_fail);
CREATE INDEX idx_evidence_timestamp ON evidence_artifacts(timestamp);
CREATE INDEX idx_evidence_epic_type ON evidence_artifacts(epic_id, test_type);
CREATE INDEX idx_evidence_epic_status ON evidence_artifacts(epic_id, pass_fail);

-- Evidence metadata table for detailed tracking
-- Stores additional metadata about evidence collection
CREATE TABLE IF NOT EXISTS evidence_metadata (
  id SERIAL PRIMARY KEY,
  evidence_id INTEGER NOT NULL REFERENCES evidence_artifacts(id) ON DELETE CASCADE,
  metadata_key VARCHAR(255) NOT NULL,
  metadata_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_evidence_metadata_evidence_id ON evidence_metadata(evidence_id);
CREATE INDEX idx_evidence_metadata_key ON evidence_metadata(metadata_key);

-- Console logs table for detailed log retrieval
-- Stores individual console log entries
CREATE TABLE IF NOT EXISTS evidence_console_logs (
  id SERIAL PRIMARY KEY,
  evidence_id INTEGER NOT NULL REFERENCES evidence_artifacts(id) ON DELETE CASCADE,
  log_level VARCHAR(20), -- 'log', 'error', 'warning', 'info', 'debug'
  message TEXT,
  timestamp TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_console_logs_evidence_id ON evidence_console_logs(evidence_id);
CREATE INDEX idx_console_logs_level ON evidence_console_logs(log_level);

-- Network traces table for detailed network activity
-- Stores individual network requests/responses
CREATE TABLE IF NOT EXISTS evidence_network_traces (
  id SERIAL PRIMARY KEY,
  evidence_id INTEGER NOT NULL REFERENCES evidence_artifacts(id) ON DELETE CASCADE,
  method VARCHAR(10), -- GET, POST, PUT, DELETE, etc.
  url TEXT,
  status_code INTEGER,
  response_time_ms INTEGER,
  request_body TEXT,
  response_body TEXT,
  timestamp TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_network_traces_evidence_id ON evidence_network_traces(evidence_id);
CREATE INDEX idx_network_traces_url ON evidence_network_traces(url);
CREATE INDEX idx_network_traces_status ON evidence_network_traces(status_code);

-- HTTP request/response pairs table for API test evidence
-- Stores correlated request/response data
CREATE TABLE IF NOT EXISTS evidence_http_pairs (
  id SERIAL PRIMARY KEY,
  evidence_id INTEGER NOT NULL REFERENCES evidence_artifacts(id) ON DELETE CASCADE,
  correlation_id VARCHAR(255),
  request_method VARCHAR(10),
  request_url TEXT,
  request_headers JSONB,
  request_body JSONB,
  response_status INTEGER,
  response_headers JSONB,
  response_body JSONB,
  response_time_ms INTEGER,
  timestamp TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_http_pairs_evidence_id ON evidence_http_pairs(evidence_id);
CREATE INDEX idx_http_pairs_correlation_id ON evidence_http_pairs(correlation_id);

-- MCP tool execution table for API test evidence
-- Stores tool calls and responses
CREATE TABLE IF NOT EXISTS evidence_tool_execution (
  id SERIAL PRIMARY KEY,
  evidence_id INTEGER NOT NULL REFERENCES evidence_artifacts(id) ON DELETE CASCADE,
  tool_name VARCHAR(255),
  tool_params JSONB,
  tool_response JSONB,
  execution_time_ms INTEGER,
  success BOOLEAN,
  error_message TEXT,
  timestamp TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tool_execution_evidence_id ON evidence_tool_execution(evidence_id);
CREATE INDEX idx_tool_execution_tool_name ON evidence_tool_execution(tool_name);

-- Test coverage report table
-- Stores coverage metrics per test
CREATE TABLE IF NOT EXISTS evidence_coverage (
  id SERIAL PRIMARY KEY,
  evidence_id INTEGER NOT NULL REFERENCES evidence_artifacts(id) ON DELETE CASCADE,
  line_coverage_percent NUMERIC(5,2),
  branch_coverage_percent NUMERIC(5,2),
  function_coverage_percent NUMERIC(5,2),
  statement_coverage_percent NUMERIC(5,2),
  coverage_report_path VARCHAR(255),
  timestamp TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_coverage_evidence_id ON evidence_coverage(evidence_id);

-- Cleanup/retention policy tracking
-- Tracks when evidence should be archived (30-day policy)
CREATE TABLE IF NOT EXISTS evidence_retention (
  id SERIAL PRIMARY KEY,
  evidence_id INTEGER NOT NULL REFERENCES evidence_artifacts(id) ON DELETE CASCADE,
  archive_date TIMESTAMP WITH TIME ZONE,
  delete_date TIMESTAMP WITH TIME ZONE,
  archived BOOLEAN DEFAULT FALSE,
  deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_retention_evidence_id ON evidence_retention(evidence_id);
CREATE INDEX idx_retention_archive_date ON evidence_retention(archive_date);
