-- Migration: 002_secrets_management
-- Description: Create simplified secrets table with hierarchical key paths
-- For EPIC-003: Secrets Management
-- Based on: /home/samuel/sv/.bmad/infrastructure/secrets-management-system.md

-- Enable pgcrypto extension for encryption helpers
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Secrets table with hierarchical key paths
-- No foreign key to projects - supports meta/project/service scopes
CREATE TABLE IF NOT EXISTS secrets (
  id SERIAL PRIMARY KEY,

  -- Hierarchical key path (e.g., "meta/cloudflare/api_token")
  key_path TEXT NOT NULL UNIQUE,

  -- Encrypted value (contains IV + Auth Tag + Encrypted Data)
  encrypted_value BYTEA NOT NULL,

  -- Metadata
  description TEXT,
  scope TEXT NOT NULL,  -- 'meta', 'project', 'service'
  project_name TEXT,    -- NULL for meta-level secrets
  service_name TEXT,    -- NULL for project-level secrets

  -- Tracking
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT DEFAULT 'supervisor',
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  access_count INTEGER DEFAULT 0,

  -- Optional rotation
  expires_at TIMESTAMP WITH TIME ZONE,
  rotation_required BOOLEAN DEFAULT FALSE
);

-- Indexes for fast lookup
CREATE INDEX idx_secrets_key_path ON secrets(key_path);
CREATE INDEX idx_secrets_scope ON secrets(scope);
CREATE INDEX idx_secrets_project ON secrets(project_name) WHERE project_name IS NOT NULL;
CREATE INDEX idx_secrets_service ON secrets(service_name) WHERE service_name IS NOT NULL;
CREATE INDEX idx_secrets_expires ON secrets(expires_at) WHERE expires_at IS NOT NULL;

-- Secret access log table
-- Audit trail for secret access (simplified)
CREATE TABLE IF NOT EXISTS secret_access_log (
  id SERIAL PRIMARY KEY,
  key_path TEXT NOT NULL,
  accessed_by TEXT NOT NULL DEFAULT 'supervisor',
  access_type TEXT NOT NULL, -- 'read', 'create', 'update', 'delete'
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for access log
CREATE INDEX idx_secret_access_log_key_path ON secret_access_log(key_path);
CREATE INDEX idx_secret_access_log_accessed_at ON secret_access_log(accessed_at);
CREATE INDEX idx_secret_access_log_success ON secret_access_log(success);

-- Apply update trigger
CREATE TRIGGER update_secrets_updated_at BEFORE UPDATE ON secrets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View for secrets near expiration
CREATE OR REPLACE VIEW secrets_expiring_soon AS
SELECT
  id,
  key_path,
  description,
  scope,
  expires_at,
  expires_at - NOW() as time_until_expiry
FROM secrets
WHERE expires_at IS NOT NULL
  AND expires_at > NOW()
  AND expires_at < NOW() + INTERVAL '30 days'
ORDER BY expires_at;

-- View for secrets needing rotation
CREATE OR REPLACE VIEW secrets_needing_rotation AS
SELECT
  id,
  key_path,
  description,
  scope,
  last_accessed_at,
  rotation_required
FROM secrets
WHERE rotation_required = TRUE
ORDER BY last_accessed_at ASC NULLS FIRST;
