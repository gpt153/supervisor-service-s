/**
 * Usage Monitoring & Cost Tracking Migration
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  // Run all SQL as a single transaction
  pgm.sql(`
-- 1. Subscription Tiers Table
CREATE TABLE IF NOT EXISTS subscription_tiers (
  id SERIAL PRIMARY KEY,
  service VARCHAR(50) NOT NULL,
  tier VARCHAR(50) NOT NULL,
  monthly_cost DECIMAL(10, 2) NOT NULL,
  quota_limit BIGINT,
  quota_period VARCHAR(20),
  features JSONB,
  is_active BOOLEAN DEFAULT true,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(service, tier, started_at)
);

COMMENT ON TABLE subscription_tiers IS 'Tracks active and historical subscription tiers';

-- 2. Usage Snapshots Table
CREATE TABLE IF NOT EXISTS usage_snapshots (
  id SERIAL PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  service VARCHAR(50) NOT NULL,
  tier VARCHAR(50) NOT NULL,
  tokens_used BIGINT NOT NULL DEFAULT 0,
  requests_made INTEGER NOT NULL DEFAULT 0,
  cost_usd DECIMAL(10, 2) NOT NULL DEFAULT 0,
  overage_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
  quota_percentage DECIMAL(5, 2),
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(snapshot_date, service)
);

COMMENT ON TABLE usage_snapshots IS 'Daily usage snapshots for all AI services';

-- 3. Cost Optimizations Table
CREATE TABLE IF NOT EXISTS cost_optimizations (
  id SERIAL PRIMARY KEY,
  analysis_date DATE NOT NULL,
  service VARCHAR(50) NOT NULL,
  current_tier VARCHAR(50) NOT NULL,
  current_monthly_cost DECIMAL(10, 2) NOT NULL,
  recommended_tier VARCHAR(50),
  recommended_monthly_cost DECIMAL(10, 2),
  potential_savings DECIMAL(10, 2),
  reasoning TEXT NOT NULL,
  confidence DECIMAL(3, 2),
  usage_period_days INTEGER NOT NULL DEFAULT 30,
  status VARCHAR(20) DEFAULT 'pending',
  executed_at TIMESTAMP,
  execution_error TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE cost_optimizations IS 'Subscription tier optimization recommendations';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscription_tiers_active ON subscription_tiers(service, is_active);
CREATE INDEX IF NOT EXISTS idx_usage_snapshots_date ON usage_snapshots(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_usage_snapshots_service ON usage_snapshots(service, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_cost_optimizations_status ON cost_optimizations(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cost_optimizations_service ON cost_optimizations(service, analysis_date DESC);

-- Functions
CREATE OR REPLACE FUNCTION get_active_tier(p_service VARCHAR)
RETURNS TABLE(
  service VARCHAR,
  tier VARCHAR,
  monthly_cost DECIMAL,
  quota_limit BIGINT,
  quota_period VARCHAR,
  started_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    st.service,
    st.tier,
    st.monthly_cost,
    st.quota_limit,
    st.quota_period,
    st.started_at
  FROM subscription_tiers st
  WHERE st.service = p_service AND st.is_active = true
  ORDER BY st.started_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calculate_period_cost(
  p_service VARCHAR,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS DECIMAL AS $$
DECLARE
  total_cost DECIMAL;
BEGIN
  SELECT COALESCE(SUM(cost_usd), 0)
  INTO total_cost
  FROM usage_snapshots
  WHERE
    service = p_service
    AND snapshot_date >= p_start_date
    AND snapshot_date <= p_end_date;
  RETURN total_cost;
END;
$$ LANGUAGE plpgsql;

-- View
CREATE OR REPLACE VIEW current_subscriptions AS
SELECT
  st.service,
  st.tier,
  st.monthly_cost,
  st.quota_limit,
  st.quota_period,
  st.started_at,
  (
    SELECT SUM(us.tokens_used)
    FROM usage_snapshots us
    WHERE us.service = st.service
      AND us.snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
  ) as tokens_last_30_days,
  (
    SELECT AVG(us.quota_percentage)
    FROM usage_snapshots us
    WHERE us.service = st.service
      AND us.snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
  ) as avg_quota_usage_pct
FROM subscription_tiers st
WHERE st.is_active = true
ORDER BY st.service;

-- Seed data
INSERT INTO subscription_tiers (service, tier, monthly_cost, quota_limit, quota_period, features, is_active)
VALUES
  ('claude', 'free', 0, 50000, 'monthly', '{"rate_limit": "low"}', false),
  ('claude', 'pro', 20, 2000000, 'monthly', '{"rate_limit": "medium"}', false),
  ('claude', 'max', 200, 500000, '5-hours', '{"rate_limit": "high", "extended_context": true}', true),
  ('openai', 'free', 0, 0, 'monthly', '{"limited_access": true}', false),
  ('openai', 'chatgpt-plus', 20, 0, 'monthly', '{"gpt4_access": true}', true),
  ('gemini', 'free', 0, 1000000, 'daily', '{"rate_limit": "60rpm"}', true)
ON CONFLICT (service, tier, started_at) DO NOTHING;
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.sql(`
    DROP VIEW IF EXISTS current_subscriptions;
    DROP FUNCTION IF EXISTS calculate_period_cost(VARCHAR, DATE, DATE);
    DROP FUNCTION IF EXISTS get_active_tier(VARCHAR);
    DROP TABLE IF EXISTS cost_optimizations;
    DROP TABLE IF EXISTS usage_snapshots;
    DROP TABLE IF EXISTS subscription_tiers;
  `);
};
