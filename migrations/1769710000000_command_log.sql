-- Epic 007-B: Command Logging Infrastructure
-- Creates command logging table with auto-wrapping support and sanitization patterns

BEGIN;

-- Main command log table for tracking all PS/MS actions
CREATE TABLE IF NOT EXISTS command_log (
  -- Primary Key
  id BIGSERIAL PRIMARY KEY,

  -- Association (FK to supervisor_sessions from Epic 007-A)
  instance_id VARCHAR(64) NOT NULL,
  FOREIGN KEY (instance_id) REFERENCES supervisor_sessions(instance_id)
    ON DELETE CASCADE,

  -- Command Details
  command_type VARCHAR(32) NOT NULL,        -- 'mcp_tool' | 'explicit'
  action VARCHAR(128) NOT NULL,             -- 'spawn', 'git_commit', 'log_command'
  tool_name VARCHAR(128),                   -- For MCP tools only

  -- Payload (JSONB for flexibility and indexing)
  parameters JSONB NOT NULL DEFAULT '{}',   -- Input parameters (sanitized)
  result JSONB,                             -- Output result
  error_message TEXT,

  -- Status
  success BOOLEAN DEFAULT true,
  execution_time_ms INTEGER,                -- How long the action took

  -- Context
  tags JSONB NOT NULL DEFAULT '[]',         -- ['deployment', 'critical']
  context_data JSONB DEFAULT '{}',          -- Free-form context

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Metadata
  source VARCHAR(32) DEFAULT 'auto'         -- 'auto' | 'explicit'
);

-- Indexes (CRITICAL for performance)
CREATE INDEX IF NOT EXISTS idx_command_log_instance_ts
  ON command_log(instance_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_command_log_instance_action
  ON command_log(instance_id, action);

CREATE INDEX IF NOT EXISTS idx_command_log_instance_tool
  ON command_log(instance_id, tool_name);

CREATE INDEX IF NOT EXISTS idx_command_log_action
  ON command_log(action);

CREATE INDEX IF NOT EXISTS idx_command_log_timestamp
  ON command_log(created_at DESC);

-- Secret patterns table (for sanitization configuration)
CREATE TABLE IF NOT EXISTS secret_patterns (
  id SERIAL PRIMARY KEY,

  -- Pattern configuration
  pattern_name VARCHAR(64) NOT NULL UNIQUE,
  regex_pattern VARCHAR(512) NOT NULL,

  -- Settings
  enabled BOOLEAN DEFAULT true,
  replacement_text VARCHAR(64) DEFAULT '[REDACTED]',

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial sanitization patterns
INSERT INTO secret_patterns (pattern_name, regex_pattern) VALUES
  ('api_key', '(API_KEY|api_key)\s*=\s*["\']?[a-zA-Z0-9_-]+["\']?'),
  ('password', '(PASSWORD|password)\s*=\s*["\']?[^"\s'']+["\']?'),
  ('token', '(TOKEN|token)\s*=\s*["\']?[a-zA-Z0-9._-]+["\']?'),
  ('jwt_token', '(eyJ[a-zA-Z0-9_-]+\.){2}[a-zA-Z0-9_-]+'),
  ('aws_credentials', '(AKIA[0-9A-Z]{16}|aws_access_key_id|aws_secret_access_key)'),
  ('connection_string', 'postgresql://[^:]+:[^@]+@'),
  ('bearer_token', 'Bearer\s+[a-zA-Z0-9._-]+'),
  ('oauth_token', '(access_token|refresh_token)\s*=\s*["\']?[^"\s'']+["\']?')
ON CONFLICT (pattern_name) DO NOTHING;

-- Grant permissions
GRANT SELECT, INSERT ON command_log TO mcp_server_role;
GRANT SELECT ON secret_patterns TO mcp_server_role;

COMMIT;
