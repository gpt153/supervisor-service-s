-- Migration: 012 - Verification Reports
-- Epic 006-E: Independent Verification Agent
-- Purpose: Store verification results for test evidence

-- ============================================================================
-- Verification Reports Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS verification_reports (
  id SERIAL PRIMARY KEY,
  test_id TEXT NOT NULL,
  epic_id TEXT NOT NULL,
  evidence_id INTEGER, -- Foreign key will be added when evidence_artifacts table exists

  -- Verification outcome
  verified BOOLEAN NOT NULL,
  confidence_score INTEGER NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
  recommendation TEXT NOT NULL CHECK (recommendation IN ('accept', 'reject', 'manual_review')),

  -- Analysis (stored as JSONB for flexibility)
  evidence_reviewed JSONB NOT NULL, -- {screenshots: 2, logs: 1, traces: 1, etc.}
  cross_validation_results JSONB, -- Array of cross-validation checks
  red_flags_found JSONB, -- {critical: 0, high: 1, medium: 2, low: 0}

  -- Reasoning
  summary TEXT NOT NULL, -- Plain language summary
  reasoning TEXT NOT NULL, -- Why did verification pass/fail
  concerns TEXT[], -- Array of concerns raised

  -- Metadata
  verified_at TIMESTAMP DEFAULT NOW(),
  verifier_model TEXT NOT NULL, -- 'sonnet', 'opus', etc.

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX idx_verification_test_id ON verification_reports(test_id);
CREATE INDEX idx_verification_epic_id ON verification_reports(epic_id);
CREATE INDEX idx_verification_outcome ON verification_reports(verified);
CREATE INDEX idx_verification_confidence ON verification_reports(confidence_score);
CREATE INDEX idx_verification_recommendation ON verification_reports(recommendation);
CREATE INDEX idx_verification_date ON verification_reports(verified_at);

-- Composite index for common queries (epic + outcome)
CREATE INDEX idx_verification_epic_outcome ON verification_reports(epic_id, verified);

-- ============================================================================
-- Verification Statistics View
-- ============================================================================

CREATE OR REPLACE VIEW verification_statistics AS
SELECT
  epic_id,
  COUNT(*) AS total_verifications,
  SUM(CASE WHEN verified = TRUE THEN 1 ELSE 0 END) AS passed_verifications,
  SUM(CASE WHEN verified = FALSE THEN 1 ELSE 0 END) AS failed_verifications,
  SUM(CASE WHEN recommendation = 'manual_review' THEN 1 ELSE 0 END) AS manual_review_required,
  ROUND(AVG(confidence_score), 2) AS avg_confidence_score,
  MAX(verified_at) AS last_verified_at,
  MIN(verified_at) AS first_verified_at
FROM verification_reports
GROUP BY epic_id;

-- ============================================================================
-- Verification Concerns View (Most common concerns)
-- ============================================================================

CREATE OR REPLACE VIEW verification_concerns AS
SELECT
  epic_id,
  unnest(concerns) AS concern,
  COUNT(*) AS occurrence_count
FROM verification_reports
GROUP BY epic_id, concern
ORDER BY epic_id, occurrence_count DESC;

-- ============================================================================
-- Trigger: Update timestamp on modification
-- ============================================================================

CREATE OR REPLACE FUNCTION update_verification_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER verification_updated_at
  BEFORE UPDATE ON verification_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_verification_timestamp();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE verification_reports IS 'Independent verification results for test evidence - uses different model than executor to prevent bias';
COMMENT ON COLUMN verification_reports.test_id IS 'Unique identifier for the test that was verified';
COMMENT ON COLUMN verification_reports.evidence_id IS 'Foreign key to evidence_artifacts table (optional)';
COMMENT ON COLUMN verification_reports.verified IS 'True if verification passed, false if failed';
COMMENT ON COLUMN verification_reports.confidence_score IS 'Confidence score 0-100 based on evidence quality and consistency';
COMMENT ON COLUMN verification_reports.recommendation IS 'Action recommendation: accept, reject, or manual_review';
COMMENT ON COLUMN verification_reports.evidence_reviewed IS 'Summary of evidence artifacts reviewed (JSONB)';
COMMENT ON COLUMN verification_reports.cross_validation_results IS 'Results of cross-validation checks (JSONB array)';
COMMENT ON COLUMN verification_reports.red_flags_found IS 'Summary of red flags by severity (JSONB)';
COMMENT ON COLUMN verification_reports.summary IS 'Plain language summary of verification outcome';
COMMENT ON COLUMN verification_reports.reasoning IS 'Detailed reasoning for verification decision';
COMMENT ON COLUMN verification_reports.concerns IS 'Array of concerns identified during verification';
COMMENT ON COLUMN verification_reports.verifier_model IS 'AI model used for verification (must be different from executor)';
