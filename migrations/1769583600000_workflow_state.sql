-- Epic 006-G: Test Orchestrator Workflow State
-- Created: 2026-01-27

-- Test workflow orchestration state
CREATE TABLE test_workflows (
  id SERIAL PRIMARY KEY,
  test_id TEXT NOT NULL UNIQUE,
  epic_id TEXT NOT NULL,
  test_type TEXT NOT NULL, -- 'ui', 'api', 'unit', 'integration'

  -- Workflow state
  current_stage TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'execution', 'detection', 'verification', 'fixing', 'learning', 'completed', 'failed'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'failed'

  -- Stage results (JSON)
  execution_result JSONB,
  detection_result JSONB,
  verification_result JSONB,
  fixing_result JSONB,
  learning_result JSONB,

  -- Timing
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  duration_ms INTEGER,

  -- Metadata
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  escalated BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_workflow_test ON test_workflows(test_id);
CREATE INDEX idx_workflow_epic ON test_workflows(epic_id);
CREATE INDEX idx_workflow_status ON test_workflows(status);
CREATE INDEX idx_workflow_stage ON test_workflows(current_stage);
CREATE INDEX idx_workflow_type ON test_workflows(test_type);

-- Trigger for automatic updated_at
CREATE OR REPLACE FUNCTION update_workflow_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_workflow_updated_at
  BEFORE UPDATE ON test_workflows
  FOR EACH ROW
  EXECUTE FUNCTION update_workflow_updated_at();

-- Add workflow statistics view
CREATE VIEW workflow_statistics AS
SELECT
  test_type,
  current_stage,
  status,
  COUNT(*) as workflow_count,
  AVG(duration_ms) as avg_duration_ms,
  MAX(duration_ms) as max_duration_ms,
  SUM(CASE WHEN escalated THEN 1 ELSE 0 END) as escalation_count,
  AVG(retry_count) as avg_retry_count
FROM test_workflows
GROUP BY test_type, current_stage, status;

COMMENT ON TABLE test_workflows IS 'Orchestration state for test workflows (Epic 006-G)';
COMMENT ON COLUMN test_workflows.test_id IS 'Unique identifier for the test (e.g., epic-006-A-ui-001)';
COMMENT ON COLUMN test_workflows.epic_id IS 'Epic this test belongs to';
COMMENT ON COLUMN test_workflows.current_stage IS 'Current stage in workflow (pending → execution → detection → verification → fixing → learning → completed)';
COMMENT ON COLUMN test_workflows.status IS 'Overall workflow status (pending, in_progress, completed, failed)';
COMMENT ON COLUMN test_workflows.execution_result IS 'Result from test execution stage (UITestExecutor or APITestExecutor)';
COMMENT ON COLUMN test_workflows.detection_result IS 'Result from red flag detection stage';
COMMENT ON COLUMN test_workflows.verification_result IS 'Result from independent verification stage';
COMMENT ON COLUMN test_workflows.fixing_result IS 'Result from adaptive fix agent (if verification failed)';
COMMENT ON COLUMN test_workflows.learning_result IS 'Patterns extracted to learning store';
COMMENT ON COLUMN test_workflows.escalated IS 'Whether workflow was escalated to user after failures';
