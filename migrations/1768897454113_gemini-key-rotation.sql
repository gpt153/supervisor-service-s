-- Gemini API Key Rotation Migration
-- Stores multiple API keys and tracks quota per key

-- API keys table
CREATE TABLE IF NOT EXISTS gemini_api_keys (
  id SERIAL PRIMARY KEY,
  key_name VARCHAR(100) UNIQUE NOT NULL,
  api_key TEXT NOT NULL,
  account_email VARCHAR(255),
  daily_quota INTEGER NOT NULL DEFAULT 1000000,
  current_usage INTEGER NOT NULL DEFAULT 0,
  quota_resets_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMP,
  notes TEXT
);

COMMENT ON TABLE gemini_api_keys IS 'Stores multiple Gemini API keys for rotation';
COMMENT ON COLUMN gemini_api_keys.key_name IS 'Friendly name for the key (e.g., "account1", "personal", etc.)';
COMMENT ON COLUMN gemini_api_keys.api_key IS 'Encrypted or raw API key (starts with AIza...)';
COMMENT ON COLUMN gemini_api_keys.account_email IS 'Associated Gmail/Google account';
COMMENT ON COLUMN gemini_api_keys.daily_quota IS 'Daily token quota (default 1M)';
COMMENT ON COLUMN gemini_api_keys.current_usage IS 'Tokens used today';
COMMENT ON COLUMN gemini_api_keys.quota_resets_at IS 'When usage resets to 0';
COMMENT ON COLUMN gemini_api_keys.is_active IS 'Whether key is available for use';
COMMENT ON COLUMN gemini_api_keys.priority IS 'Lower number = higher priority (0 = highest)';
COMMENT ON COLUMN gemini_api_keys.notes IS 'Optional notes about this key';

-- Key usage log
CREATE TABLE IF NOT EXISTS gemini_key_usage_log (
  id SERIAL PRIMARY KEY,
  key_id INTEGER NOT NULL REFERENCES gemini_api_keys(id) ON DELETE CASCADE,
  tokens_used INTEGER NOT NULL,
  request_success BOOLEAN NOT NULL,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE gemini_key_usage_log IS 'Logs usage per API key for analytics';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_gemini_keys_active ON gemini_api_keys(is_active, priority);
CREATE INDEX IF NOT EXISTS idx_gemini_keys_quota ON gemini_api_keys(current_usage, daily_quota);
CREATE INDEX IF NOT EXISTS idx_gemini_usage_key_id ON gemini_key_usage_log(key_id);
CREATE INDEX IF NOT EXISTS idx_gemini_usage_created_at ON gemini_key_usage_log(created_at);

-- Function to automatically reset quota at midnight
CREATE OR REPLACE FUNCTION reset_gemini_quota()
RETURNS void AS $$
BEGIN
  UPDATE gemini_api_keys
  SET
    current_usage = 0,
    quota_resets_at = NOW() + INTERVAL '24 hours'
  WHERE
    is_active = true
    AND quota_resets_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION reset_gemini_quota() IS 'Resets quota for keys that have passed reset time';

-- View for available keys (sorted by priority)
CREATE OR REPLACE VIEW gemini_available_keys AS
SELECT
  id,
  key_name,
  api_key,
  account_email,
  daily_quota,
  current_usage,
  (daily_quota - current_usage) as remaining,
  ROUND((current_usage::numeric / daily_quota) * 100, 2) as usage_percent,
  quota_resets_at,
  priority,
  last_used_at
FROM gemini_api_keys
WHERE
  is_active = true
  AND current_usage < daily_quota
ORDER BY
  priority ASC,
  current_usage ASC;

COMMENT ON VIEW gemini_available_keys IS 'Shows available keys with remaining quota';
