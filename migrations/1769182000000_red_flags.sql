-- Migration: Red Flag Detection System
-- Epic: 006-B
-- Description: Schema for detecting and tracking agent deception patterns in test execution

-- Red flags table: stores detected deception patterns
CREATE TABLE red_flags (
  id SERIAL PRIMARY KEY,
  epic_id TEXT NOT NULL,
  test_id TEXT NOT NULL,
  evidence_id INTEGER REFERENCES evidence_artifacts(id) ON DELETE CASCADE,

  -- Classification
  flag_type TEXT NOT NULL CHECK (flag_type IN (
    'missing_evidence',
    'inconsistent',
    'tool_execution',
    'timing',
    'coverage'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),

  -- Details
  description TEXT NOT NULL,
  proof JSONB NOT NULL, -- Flexible storage for evidence paths, timestamps, diffs, etc.

  -- Lifecycle
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved BOOLEAN DEFAULT FALSE,
  resolution_notes TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_red_flags_epic ON red_flags(epic_id);
CREATE INDEX idx_red_flags_test ON red_flags(test_id);
CREATE INDEX idx_red_flags_severity ON red_flags(severity);
CREATE INDEX idx_red_flags_resolved ON red_flags(resolved);
CREATE INDEX idx_red_flags_flag_type ON red_flags(flag_type);
CREATE INDEX idx_red_flags_detected_at ON red_flags(detected_at DESC);

-- Composite index for filtering unresolved critical/high flags
CREATE INDEX idx_red_flags_active_critical ON red_flags(epic_id, severity, resolved)
  WHERE resolved = FALSE AND severity IN ('critical', 'high');

-- Historical timing data for anomaly detection
CREATE TABLE test_timing_history (
  id SERIAL PRIMARY KEY,
  test_name TEXT NOT NULL,
  test_type TEXT NOT NULL, -- 'ui', 'api', 'unit', 'integration'
  duration_ms INTEGER NOT NULL,
  network_requests INTEGER DEFAULT 0,
  dom_changes INTEGER DEFAULT 0,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  epic_id TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for timing analysis
CREATE INDEX idx_test_timing_name ON test_timing_history(test_name);
CREATE INDEX idx_test_timing_type ON test_timing_history(test_type);
CREATE INDEX idx_test_timing_executed_at ON test_timing_history(executed_at DESC);

-- View for calculating average test timing (last 30 days)
CREATE VIEW test_timing_averages AS
SELECT
  test_name,
  test_type,
  AVG(duration_ms) as avg_duration_ms,
  STDDEV(duration_ms) as stddev_duration_ms,
  AVG(network_requests) as avg_network_requests,
  AVG(dom_changes) as avg_dom_changes,
  COUNT(*) as sample_count,
  MAX(executed_at) as last_executed_at
FROM test_timing_history
WHERE executed_at > NOW() - INTERVAL '30 days'
GROUP BY test_name, test_type;

-- Red flag statistics view for reporting
CREATE VIEW red_flag_statistics AS
SELECT
  epic_id,
  flag_type,
  severity,
  COUNT(*) as flag_count,
  COUNT(*) FILTER (WHERE resolved = TRUE) as resolved_count,
  COUNT(*) FILTER (WHERE resolved = FALSE) as unresolved_count,
  MIN(detected_at) as first_detected_at,
  MAX(detected_at) as last_detected_at
FROM red_flags
GROUP BY epic_id, flag_type, severity;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_red_flags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  IF NEW.resolved = TRUE AND OLD.resolved = FALSE THEN
    NEW.resolved_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER red_flags_updated_at_trigger
  BEFORE UPDATE ON red_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_red_flags_updated_at();

-- Comments for documentation
COMMENT ON TABLE red_flags IS 'Detected deception patterns in agent test execution';
COMMENT ON COLUMN red_flags.flag_type IS 'Category of red flag: missing_evidence, inconsistent, tool_execution, timing, coverage';
COMMENT ON COLUMN red_flags.severity IS 'Impact level: critical (auto-fail), high (manual review), medium (log), low (info)';
COMMENT ON COLUMN red_flags.proof IS 'JSON evidence: artifact paths, timestamps, diffs, expected vs actual values';
COMMENT ON TABLE test_timing_history IS 'Historical test execution timing for anomaly detection';
COMMENT ON VIEW test_timing_averages IS 'Rolling 30-day average test timing for comparison';
