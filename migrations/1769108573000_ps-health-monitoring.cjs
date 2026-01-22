/**
 * PS Health Monitoring Migration
 * Implements database schema for Project Supervisor health monitoring system
 * Phase 1: CLI Support (tmux-based monitoring)
 *
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
-- 1. PS Sessions Table
-- Tracks active project-supervisor sessions (CLI or SDK)
CREATE TABLE IF NOT EXISTS ps_sessions (
  id SERIAL PRIMARY KEY,
  project VARCHAR(50) UNIQUE NOT NULL,
  session_type VARCHAR(10) NOT NULL CHECK (session_type IN ('cli', 'sdk')),
  session_id VARCHAR(100),
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_activity TIMESTAMP NOT NULL DEFAULT NOW(),
  last_context_check TIMESTAMP,
  context_usage FLOAT CHECK (context_usage >= 0 AND context_usage <= 1),
  estimated_tokens_used INTEGER,
  estimated_tokens_total INTEGER DEFAULT 200000,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ps_sessions IS 'Tracks active project-supervisor sessions';
COMMENT ON COLUMN ps_sessions.project IS 'Project name (consilio, odin, etc.)';
COMMENT ON COLUMN ps_sessions.session_type IS 'Session type: cli (tmux) or sdk (browser)';
COMMENT ON COLUMN ps_sessions.session_id IS 'tmux session name or browser session ID';
COMMENT ON COLUMN ps_sessions.context_usage IS 'Context window usage (0.0 to 1.0)';
COMMENT ON COLUMN ps_sessions.estimated_tokens_used IS 'Estimated tokens consumed';
COMMENT ON COLUMN ps_sessions.estimated_tokens_total IS 'Total token budget (default 200k)';

-- 2. Active Spawns Table
-- Tracks all spawned subagents
CREATE TABLE IF NOT EXISTS active_spawns (
  id SERIAL PRIMARY KEY,
  project VARCHAR(50) NOT NULL,
  task_id VARCHAR(100) NOT NULL,
  task_type VARCHAR(50),
  description TEXT,
  spawn_time TIMESTAMP NOT NULL DEFAULT NOW(),
  last_output_change TIMESTAMP,
  output_file TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'stalled', 'abandoned')),
  exit_code INTEGER,
  error_message TEXT,
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(project, task_id)
);

COMMENT ON TABLE active_spawns IS 'Tracks all spawned subagents';
COMMENT ON COLUMN active_spawns.project IS 'Project that spawned the agent';
COMMENT ON COLUMN active_spawns.task_id IS 'Unique task identifier';
COMMENT ON COLUMN active_spawns.task_type IS 'Type of task (research, planning, implementation, etc.)';
COMMENT ON COLUMN active_spawns.last_output_change IS 'Last time output file was modified';
COMMENT ON COLUMN active_spawns.output_file IS 'Path to spawn output file';
COMMENT ON COLUMN active_spawns.status IS 'Current status of spawn';

-- 3. Health Checks Table
-- Audit trail of all health check operations
CREATE TABLE IF NOT EXISTS health_checks (
  id SERIAL PRIMARY KEY,
  project VARCHAR(50) NOT NULL,
  check_time TIMESTAMP NOT NULL DEFAULT NOW(),
  check_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('ok', 'warning', 'critical')),
  details JSONB,
  action_taken TEXT,
  ps_response TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE health_checks IS 'Audit trail of all health check operations';
COMMENT ON COLUMN health_checks.project IS 'Project being monitored';
COMMENT ON COLUMN health_checks.check_type IS 'Type of check (spawn, context, handoff, orphaned_work)';
COMMENT ON COLUMN health_checks.status IS 'Check result: ok, warning, or critical';
COMMENT ON COLUMN health_checks.details IS 'JSON details about the check';
COMMENT ON COLUMN health_checks.action_taken IS 'Action taken by monitor';
COMMENT ON COLUMN health_checks.ps_response IS 'Response from PS (if applicable)';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ps_sessions_project ON ps_sessions(project);
CREATE INDEX IF NOT EXISTS idx_ps_sessions_context_usage ON ps_sessions(context_usage);
CREATE INDEX IF NOT EXISTS idx_ps_sessions_last_activity ON ps_sessions(last_activity);

CREATE INDEX IF NOT EXISTS idx_active_spawns_project ON active_spawns(project);
CREATE INDEX IF NOT EXISTS idx_active_spawns_status ON active_spawns(status);
CREATE INDEX IF NOT EXISTS idx_active_spawns_project_status ON active_spawns(project, status);
CREATE INDEX IF NOT EXISTS idx_active_spawns_spawn_time ON active_spawns(spawn_time);

CREATE INDEX IF NOT EXISTS idx_health_checks_project ON health_checks(project);
CREATE INDEX IF NOT EXISTS idx_health_checks_check_time ON health_checks(check_time DESC);
CREATE INDEX IF NOT EXISTS idx_health_checks_status ON health_checks(status);
CREATE INDEX IF NOT EXISTS idx_health_checks_project_status ON health_checks(project, status);

-- Functions for health monitoring

-- Function: Get stalled spawns (no output change for 15+ minutes)
CREATE OR REPLACE FUNCTION get_stalled_spawns(p_project VARCHAR)
RETURNS TABLE(
  id INTEGER,
  task_id VARCHAR,
  task_type VARCHAR,
  spawn_time TIMESTAMP,
  minutes_stalled INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.task_id,
    s.task_type,
    s.spawn_time,
    EXTRACT(EPOCH FROM (NOW() - COALESCE(s.last_output_change, s.spawn_time)))::INTEGER / 60 as minutes_stalled
  FROM active_spawns s
  WHERE
    s.project = p_project
    AND s.status = 'running'
    AND (
      s.last_output_change IS NULL
      OR s.last_output_change < NOW() - INTERVAL '15 minutes'
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_stalled_spawns IS 'Returns spawns with no output for 15+ minutes';

-- Function: Get active sessions needing context check
CREATE OR REPLACE FUNCTION get_sessions_needing_context_check()
RETURNS TABLE(
  project VARCHAR,
  session_type VARCHAR,
  session_id VARCHAR,
  minutes_since_check INTEGER,
  current_usage FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.project,
    s.session_type,
    s.session_id,
    EXTRACT(EPOCH FROM (NOW() - COALESCE(s.last_context_check, s.started_at)))::INTEGER / 60 as minutes_since_check,
    s.context_usage
  FROM ps_sessions s
  WHERE
    s.last_activity > NOW() - INTERVAL '1 hour'
    AND (
      s.last_context_check IS NULL
      OR s.last_context_check < NOW() - INTERVAL '10 minutes'
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_sessions_needing_context_check IS 'Returns sessions that need context check';

-- Function: Update session context
CREATE OR REPLACE FUNCTION update_session_context(
  p_project VARCHAR,
  p_context_percentage FLOAT,
  p_tokens_used INTEGER,
  p_tokens_total INTEGER
)
RETURNS VOID AS $$
BEGIN
  UPDATE ps_sessions
  SET
    context_usage = p_context_percentage / 100,
    estimated_tokens_used = p_tokens_used,
    estimated_tokens_total = p_tokens_total,
    last_context_check = NOW(),
    last_activity = NOW(),
    updated_at = NOW()
  WHERE project = p_project;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_session_context IS 'Updates context usage for a session';

-- Function: Record health check
CREATE OR REPLACE FUNCTION record_health_check(
  p_project VARCHAR,
  p_check_type VARCHAR,
  p_status VARCHAR,
  p_details JSONB,
  p_action_taken TEXT
)
RETURNS INTEGER AS $$
DECLARE
  check_id INTEGER;
BEGIN
  INSERT INTO health_checks (
    project,
    check_type,
    status,
    details,
    action_taken
  )
  VALUES (
    p_project,
    p_check_type,
    p_status,
    p_details,
    p_action_taken
  )
  RETURNING id INTO check_id;

  RETURN check_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION record_health_check IS 'Records a health check event';

-- View: Active monitoring targets
CREATE OR REPLACE VIEW active_monitoring_targets AS
SELECT DISTINCT
  COALESCE(s.project, sp.project) as project,
  s.session_type,
  s.session_id,
  s.context_usage,
  s.last_context_check,
  COUNT(sp.id) FILTER (WHERE sp.status = 'running') as active_spawns_count,
  MAX(sp.spawn_time) as latest_spawn_time
FROM ps_sessions s
FULL OUTER JOIN active_spawns sp ON s.project = sp.project
WHERE
  (s.last_activity > NOW() - INTERVAL '1 hour' OR s.last_activity IS NULL)
  OR sp.status = 'running'
GROUP BY
  COALESCE(s.project, sp.project),
  s.session_type,
  s.session_id,
  s.context_usage,
  s.last_context_check;

COMMENT ON VIEW active_monitoring_targets IS 'Shows all projects requiring health monitoring';

-- View: Health check summary
CREATE OR REPLACE VIEW health_check_summary AS
SELECT
  project,
  DATE(check_time) as check_date,
  check_type,
  status,
  COUNT(*) as check_count,
  MAX(check_time) as last_check_time
FROM health_checks
WHERE check_time > NOW() - INTERVAL '7 days'
GROUP BY project, DATE(check_time), check_type, status
ORDER BY check_date DESC, project;

COMMENT ON VIEW health_check_summary IS 'Daily summary of health checks by project';

-- Trigger: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ps_sessions_updated_at
  BEFORE UPDATE ON ps_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_active_spawns_updated_at
  BEFORE UPDATE ON active_spawns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.sql(`
    -- Drop triggers
    DROP TRIGGER IF EXISTS update_active_spawns_updated_at ON active_spawns;
    DROP TRIGGER IF EXISTS update_ps_sessions_updated_at ON ps_sessions;
    DROP FUNCTION IF EXISTS update_updated_at_column();

    -- Drop views
    DROP VIEW IF EXISTS health_check_summary;
    DROP VIEW IF EXISTS active_monitoring_targets;

    -- Drop functions
    DROP FUNCTION IF EXISTS record_health_check(VARCHAR, VARCHAR, VARCHAR, JSONB, TEXT);
    DROP FUNCTION IF EXISTS update_session_context(VARCHAR, FLOAT, INTEGER, INTEGER);
    DROP FUNCTION IF EXISTS get_sessions_needing_context_check();
    DROP FUNCTION IF EXISTS get_stalled_spawns(VARCHAR);

    -- Drop tables
    DROP TABLE IF EXISTS health_checks;
    DROP TABLE IF EXISTS active_spawns;
    DROP TABLE IF EXISTS ps_sessions;
  `);
};
