-- Migration: 004_task_timing
-- Description: Create tables for task timing and estimation tracking
-- For EPIC-007: Estimation Learnings

-- Task execution history
-- Tracks every time a task is executed with timing data
CREATE TABLE IF NOT EXISTS task_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  execution_number INTEGER NOT NULL DEFAULT 1,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER, -- Calculated from started_at and completed_at
  estimated_minutes INTEGER, -- Estimate at time of execution
  variance_minutes INTEGER, -- Actual - Estimated
  variance_percent NUMERIC(5,2), -- (Actual - Estimated) / Estimated * 100
  status VARCHAR(50) NOT NULL DEFAULT 'running', -- running, completed, failed, cancelled
  complexity VARCHAR(20), -- simple, moderate, complex
  context_switches INTEGER DEFAULT 0, -- Number of times task was paused/resumed
  interruptions INTEGER DEFAULT 0,
  blockers TEXT[], -- Array of blocker descriptions
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for task executions
CREATE INDEX idx_task_executions_task_id ON task_executions(task_id);
CREATE INDEX idx_task_executions_project_id ON task_executions(project_id);
CREATE INDEX idx_task_executions_status ON task_executions(status);
CREATE INDEX idx_task_executions_started_at ON task_executions(started_at);
CREATE INDEX idx_task_executions_complexity ON task_executions(complexity);

-- Estimation patterns table
-- Learn patterns for better future estimates
CREATE TABLE IF NOT EXISTS estimation_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  pattern_name VARCHAR(255) NOT NULL,
  task_type VARCHAR(100) NOT NULL, -- e.g., "database migration", "API endpoint", "UI component"
  complexity VARCHAR(20) NOT NULL,
  avg_duration_minutes NUMERIC(10,2),
  std_deviation NUMERIC(10,2),
  sample_count INTEGER DEFAULT 1,
  confidence_score NUMERIC(3,2), -- 0.00 to 1.00
  factors JSONB DEFAULT '{}', -- Factors that affect timing (e.g., {"dependencies": 3, "new_tech": true})
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, pattern_name, task_type, complexity)
);

-- Indexes for estimation patterns
CREATE INDEX idx_estimation_patterns_project_id ON estimation_patterns(project_id);
CREATE INDEX idx_estimation_patterns_task_type ON estimation_patterns(task_type);
CREATE INDEX idx_estimation_patterns_complexity ON estimation_patterns(complexity);
CREATE INDEX idx_estimation_patterns_confidence ON estimation_patterns(confidence_score);

-- Time tracking sessions
-- Detailed time tracking with pause/resume capability
CREATE TABLE IF NOT EXISTS time_tracking_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_execution_id UUID REFERENCES task_executions(id) ON DELETE CASCADE,
  session_number INTEGER NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,
  activity_type VARCHAR(100), -- coding, debugging, research, documentation, meeting
  productivity_rating INTEGER CHECK (productivity_rating BETWEEN 1 AND 5),
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for time tracking
CREATE INDEX idx_time_tracking_task_execution ON time_tracking_sessions(task_execution_id);
CREATE INDEX idx_time_tracking_activity_type ON time_tracking_sessions(activity_type);
CREATE INDEX idx_time_tracking_started_at ON time_tracking_sessions(started_at);

-- Estimation factors table
-- Track factors that influence estimation accuracy
CREATE TABLE IF NOT EXISTS estimation_factors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  factor_name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  impact_type VARCHAR(50) NOT NULL, -- multiplier, additive, percentage
  average_impact NUMERIC(10,2), -- How much this factor typically affects estimates
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Task execution factors junction table
-- Links task executions to the factors that affected them
CREATE TABLE IF NOT EXISTS task_execution_factors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_execution_id UUID REFERENCES task_executions(id) ON DELETE CASCADE,
  factor_id UUID REFERENCES estimation_factors(id) ON DELETE CASCADE,
  factor_value NUMERIC(10,2), -- The actual value/impact for this execution
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(task_execution_id, factor_id)
);

-- Indexes for execution factors
CREATE INDEX idx_task_execution_factors_execution ON task_execution_factors(task_execution_id);
CREATE INDEX idx_task_execution_factors_factor ON task_execution_factors(factor_id);

-- Function to calculate task execution duration and variance
CREATE OR REPLACE FUNCTION calculate_execution_metrics()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.completed_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
    -- Calculate duration in minutes
    NEW.duration_minutes := EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at)) / 60;

    -- Calculate variance if estimate exists
    IF NEW.estimated_minutes IS NOT NULL THEN
      NEW.variance_minutes := NEW.duration_minutes - NEW.estimated_minutes;
      NEW.variance_percent := ROUND(
        ((NEW.duration_minutes - NEW.estimated_minutes)::NUMERIC / NEW.estimated_minutes::NUMERIC) * 100,
        2
      );
    END IF;

    -- Update status
    NEW.status := 'completed';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate metrics
CREATE TRIGGER calculate_task_execution_metrics
  BEFORE INSERT OR UPDATE ON task_executions
  FOR EACH ROW
  EXECUTE FUNCTION calculate_execution_metrics();

-- Function to update estimation patterns based on new executions
CREATE OR REPLACE FUNCTION update_estimation_pattern(
  p_project_id UUID,
  p_task_type VARCHAR,
  p_complexity VARCHAR,
  p_duration_minutes INTEGER
)
RETURNS VOID AS $$
DECLARE
  v_pattern estimation_patterns%ROWTYPE;
  v_new_avg NUMERIC;
  v_new_count INTEGER;
BEGIN
  -- Get existing pattern or create new
  SELECT * INTO v_pattern
  FROM estimation_patterns
  WHERE project_id = p_project_id
    AND task_type = p_task_type
    AND complexity = p_complexity
  FOR UPDATE;

  IF FOUND THEN
    -- Update existing pattern with running average
    v_new_count := v_pattern.sample_count + 1;
    v_new_avg := ((v_pattern.avg_duration_minutes * v_pattern.sample_count) + p_duration_minutes) / v_new_count;

    UPDATE estimation_patterns
    SET
      avg_duration_minutes = v_new_avg,
      sample_count = v_new_count,
      confidence_score = LEAST(1.0, v_new_count::NUMERIC / 10.0), -- Max confidence at 10 samples
      updated_at = NOW()
    WHERE id = v_pattern.id;
  ELSE
    -- Create new pattern
    INSERT INTO estimation_patterns (
      project_id,
      pattern_name,
      task_type,
      complexity,
      avg_duration_minutes,
      sample_count,
      confidence_score
    ) VALUES (
      p_project_id,
      p_task_type || '_' || p_complexity,
      p_task_type,
      p_complexity,
      p_duration_minutes,
      1,
      0.1
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to get recommended estimate based on patterns
CREATE OR REPLACE FUNCTION get_recommended_estimate(
  p_project_id UUID,
  p_task_type VARCHAR,
  p_complexity VARCHAR
)
RETURNS INTEGER AS $$
DECLARE
  v_estimate INTEGER;
BEGIN
  SELECT ROUND(avg_duration_minutes)::INTEGER INTO v_estimate
  FROM estimation_patterns
  WHERE project_id = p_project_id
    AND task_type = p_task_type
    AND complexity = p_complexity
    AND sample_count >= 3 -- Require at least 3 samples
  ORDER BY confidence_score DESC
  LIMIT 1;

  RETURN COALESCE(v_estimate, NULL);
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers
CREATE TRIGGER update_task_executions_updated_at BEFORE UPDATE ON task_executions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_estimation_patterns_updated_at BEFORE UPDATE ON estimation_patterns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_time_tracking_sessions_updated_at BEFORE UPDATE ON time_tracking_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_estimation_factors_updated_at BEFORE UPDATE ON estimation_factors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View for estimation accuracy by project
CREATE OR REPLACE VIEW estimation_accuracy_by_project AS
SELECT
  p.id as project_id,
  p.name as project_name,
  COUNT(te.id) as total_executions,
  AVG(te.variance_percent) as avg_variance_percent,
  STDDEV(te.variance_percent) as stddev_variance_percent,
  COUNT(*) FILTER (WHERE ABS(te.variance_percent) <= 10) as within_10_percent,
  COUNT(*) FILTER (WHERE ABS(te.variance_percent) <= 25) as within_25_percent,
  COUNT(*) FILTER (WHERE te.variance_percent > 0) as over_estimated,
  COUNT(*) FILTER (WHERE te.variance_percent < 0) as under_estimated
FROM projects p
LEFT JOIN task_executions te ON p.id = te.project_id
WHERE te.status = 'completed' AND te.estimated_minutes IS NOT NULL
GROUP BY p.id, p.name;

-- View for task performance trends
CREATE OR REPLACE VIEW task_performance_trends AS
SELECT
  t.id as task_id,
  t.title as task_title,
  t.project_id,
  COUNT(te.id) as execution_count,
  AVG(te.duration_minutes) as avg_duration,
  MIN(te.duration_minutes) as min_duration,
  MAX(te.duration_minutes) as max_duration,
  AVG(te.variance_percent) as avg_variance_percent,
  SUM(te.context_switches) as total_context_switches,
  SUM(te.interruptions) as total_interruptions
FROM tasks t
JOIN task_executions te ON t.id = te.task_id
WHERE te.status = 'completed'
GROUP BY t.id, t.title, t.project_id
HAVING COUNT(te.id) > 1;
