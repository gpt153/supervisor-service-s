-- Agent Quota Tracking Migration
-- Multi-agent CLI integration database schema

-- Agent quota status table
CREATE TABLE IF NOT EXISTS agent_quota_status (
  id SERIAL PRIMARY KEY,
  agent_type VARCHAR(20) UNIQUE NOT NULL,
  remaining INTEGER NOT NULL DEFAULT 0,
  "limit" INTEGER NOT NULL,
  resets_at TIMESTAMP NOT NULL,
  available BOOLEAN NOT NULL DEFAULT true,
  last_updated TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE agent_quota_status IS 'Tracks quota for each AI CLI agent';
COMMENT ON COLUMN agent_quota_status.agent_type IS 'Agent type: gemini, codex, claude';
COMMENT ON COLUMN agent_quota_status.remaining IS 'Remaining quota count';
COMMENT ON COLUMN agent_quota_status.limit IS 'Total quota limit';
COMMENT ON COLUMN agent_quota_status.resets_at IS 'When quota resets';
COMMENT ON COLUMN agent_quota_status.available IS 'Whether agent is currently available';

-- Agent execution history table
CREATE TABLE IF NOT EXISTS agent_executions (
  id SERIAL PRIMARY KEY,
  agent_type VARCHAR(20) NOT NULL,
  task_type VARCHAR(50),
  complexity VARCHAR(20),
  success BOOLEAN NOT NULL,
  duration_ms INTEGER NOT NULL,
  cost DECIMAL(10, 4) DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE agent_executions IS 'Logs all task executions';
COMMENT ON COLUMN agent_executions.agent_type IS 'Agent type used';
COMMENT ON COLUMN agent_executions.task_type IS 'Type of task executed';
COMMENT ON COLUMN agent_executions.complexity IS 'Task complexity: simple, medium, complex';
COMMENT ON COLUMN agent_executions.duration_ms IS 'Execution duration in milliseconds';
COMMENT ON COLUMN agent_executions.cost IS 'Estimated cost in USD';

-- Routing decisions table
CREATE TABLE IF NOT EXISTS agent_routing_decisions (
  id SERIAL PRIMARY KEY,
  selected_agent VARCHAR(20) NOT NULL,
  reason TEXT NOT NULL,
  task_type VARCHAR(50),
  complexity VARCHAR(20),
  confidence DECIMAL(3, 2),
  fallback_agents TEXT[],
  execution_id INTEGER REFERENCES agent_executions(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE agent_routing_decisions IS 'Logs routing decisions';
COMMENT ON COLUMN agent_routing_decisions.selected_agent IS 'Agent selected for task';
COMMENT ON COLUMN agent_routing_decisions.reason IS 'Reason for selection';
COMMENT ON COLUMN agent_routing_decisions.confidence IS 'Classification confidence score';
COMMENT ON COLUMN agent_routing_decisions.fallback_agents IS 'Array of fallback agents';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_executions_agent_type ON agent_executions(agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_executions_created_at ON agent_executions(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_executions_agent_success ON agent_executions(agent_type, success);
CREATE INDEX IF NOT EXISTS idx_agent_routing_selected ON agent_routing_decisions(selected_agent);
CREATE INDEX IF NOT EXISTS idx_agent_routing_created_at ON agent_routing_decisions(created_at);

-- Initialize quota status for all agents
INSERT INTO agent_quota_status (agent_type, remaining, "limit", resets_at)
VALUES
  ('gemini', 1000, 1000, NOW() + INTERVAL '24 hours'),
  ('codex', 150, 150, NOW() + INTERVAL '5 hours'),
  ('claude', 1000, 1000, NOW() + INTERVAL '24 hours')
ON CONFLICT (agent_type) DO NOTHING;
