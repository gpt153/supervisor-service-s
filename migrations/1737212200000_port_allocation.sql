-- Migration: 003_port_allocation
-- Description: Create tables for dynamic port allocation
-- For EPIC-004: Port Allocation

-- Port ranges table
-- Defines ranges of ports that can be allocated
CREATE TABLE IF NOT EXISTS port_ranges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  range_name VARCHAR(255) NOT NULL UNIQUE,
  start_port INTEGER NOT NULL,
  end_port INTEGER NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK (start_port > 0 AND start_port <= 65535),
  CHECK (end_port > 0 AND end_port <= 65535),
  CHECK (end_port >= start_port)
);

-- Indexes for port ranges
CREATE INDEX idx_port_ranges_active ON port_ranges(is_active);
CREATE INDEX idx_port_ranges_start_end ON port_ranges(start_port, end_port);

-- Port allocations table
-- Tracks which ports are allocated to which services
CREATE TABLE IF NOT EXISTS port_allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  port_range_id UUID REFERENCES port_ranges(id) ON DELETE RESTRICT,
  port_number INTEGER NOT NULL,
  service_name VARCHAR(255) NOT NULL,
  service_type VARCHAR(100), -- mcp, api, websocket, database, etc.
  status VARCHAR(50) NOT NULL DEFAULT 'allocated', -- allocated, in_use, released
  process_id INTEGER, -- PID of the process using the port
  hostname VARCHAR(255) DEFAULT 'localhost',
  protocol VARCHAR(10) DEFAULT 'tcp', -- tcp, udp
  metadata JSONB DEFAULT '{}',
  allocated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  released_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(port_number, hostname, protocol)
);

-- Indexes for port allocations
CREATE INDEX idx_port_allocations_project_id ON port_allocations(project_id);
CREATE INDEX idx_port_allocations_port ON port_allocations(port_number);
CREATE INDEX idx_port_allocations_service ON port_allocations(service_name);
CREATE INDEX idx_port_allocations_status ON port_allocations(status);
CREATE INDEX idx_port_allocations_hostname ON port_allocations(hostname);

-- Port health checks table
-- Monitor health of services on allocated ports
CREATE TABLE IF NOT EXISTS port_health_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  port_allocation_id UUID REFERENCES port_allocations(id) ON DELETE CASCADE,
  check_type VARCHAR(50) NOT NULL, -- tcp, http, ping
  status VARCHAR(50) NOT NULL, -- healthy, unhealthy, timeout
  response_time_ms INTEGER,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for health checks
CREATE INDEX idx_port_health_checks_allocation_id ON port_health_checks(port_allocation_id);
CREATE INDEX idx_port_health_checks_status ON port_health_checks(status);
CREATE INDEX idx_port_health_checks_checked_at ON port_health_checks(checked_at);

-- Port reservation table
-- Pre-reserve ports for future use
CREATE TABLE IF NOT EXISTS port_reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  port_range_id UUID REFERENCES port_ranges(id) ON DELETE RESTRICT,
  port_number INTEGER NOT NULL,
  service_name VARCHAR(255) NOT NULL,
  reserved_by VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(port_number)
);

-- Indexes for reservations
CREATE INDEX idx_port_reservations_project_id ON port_reservations(project_id);
CREATE INDEX idx_port_reservations_port ON port_reservations(port_number);
CREATE INDEX idx_port_reservations_expires_at ON port_reservations(expires_at);

-- Function to find next available port in a range
CREATE OR REPLACE FUNCTION find_available_port(
  p_range_id UUID,
  p_hostname VARCHAR DEFAULT 'localhost',
  p_protocol VARCHAR DEFAULT 'tcp'
)
RETURNS INTEGER AS $$
DECLARE
  v_start_port INTEGER;
  v_end_port INTEGER;
  v_port INTEGER;
BEGIN
  -- Get range bounds
  SELECT start_port, end_port INTO v_start_port, v_end_port
  FROM port_ranges
  WHERE id = p_range_id AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Port range not found or not active';
  END IF;

  -- Find first available port
  FOR v_port IN v_start_port..v_end_port LOOP
    -- Check if port is allocated and not released
    IF NOT EXISTS (
      SELECT 1 FROM port_allocations
      WHERE port_number = v_port
        AND hostname = p_hostname
        AND protocol = p_protocol
        AND status IN ('allocated', 'in_use')
    ) AND NOT EXISTS (
      -- Also check reservations
      SELECT 1 FROM port_reservations
      WHERE port_number = v_port
        AND expires_at > NOW()
    ) THEN
      RETURN v_port;
    END IF;
  END LOOP;

  RAISE EXCEPTION 'No available ports in range';
END;
$$ LANGUAGE plpgsql;

-- Function to allocate a port
CREATE OR REPLACE FUNCTION allocate_port(
  p_project_id UUID,
  p_range_id UUID,
  p_service_name VARCHAR,
  p_service_type VARCHAR DEFAULT NULL,
  p_hostname VARCHAR DEFAULT 'localhost',
  p_protocol VARCHAR DEFAULT 'tcp'
)
RETURNS INTEGER AS $$
DECLARE
  v_port INTEGER;
BEGIN
  -- Find available port
  v_port := find_available_port(p_range_id, p_hostname, p_protocol);

  -- Allocate the port
  INSERT INTO port_allocations (
    project_id,
    port_range_id,
    port_number,
    service_name,
    service_type,
    hostname,
    protocol,
    status
  ) VALUES (
    p_project_id,
    p_range_id,
    v_port,
    p_service_name,
    p_service_type,
    p_hostname,
    p_protocol,
    'allocated'
  );

  RETURN v_port;
END;
$$ LANGUAGE plpgsql;

-- Function to release a port
CREATE OR REPLACE FUNCTION release_port(p_port_number INTEGER, p_hostname VARCHAR DEFAULT 'localhost')
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE port_allocations
  SET
    status = 'released',
    released_at = NOW()
  WHERE port_number = p_port_number
    AND hostname = p_hostname
    AND status IN ('allocated', 'in_use');

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired reservations
CREATE OR REPLACE FUNCTION cleanup_expired_reservations()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM port_reservations
  WHERE expires_at < NOW();

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers
CREATE TRIGGER update_port_ranges_updated_at BEFORE UPDATE ON port_ranges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_port_allocations_updated_at BEFORE UPDATE ON port_allocations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_port_reservations_updated_at BEFORE UPDATE ON port_reservations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View for port utilization by range
CREATE OR REPLACE VIEW port_range_utilization AS
SELECT
  pr.id as range_id,
  pr.range_name,
  pr.start_port,
  pr.end_port,
  (pr.end_port - pr.start_port + 1) as total_ports,
  COUNT(pa.id) FILTER (WHERE pa.status IN ('allocated', 'in_use')) as allocated_ports,
  COUNT(pa.id) FILTER (WHERE pa.status = 'released') as released_ports,
  COUNT(pr2.id) as reserved_ports,
  ROUND(
    (COUNT(pa.id) FILTER (WHERE pa.status IN ('allocated', 'in_use'))::NUMERIC /
    (pr.end_port - pr.start_port + 1)::NUMERIC) * 100,
    2
  ) as utilization_percent
FROM port_ranges pr
LEFT JOIN port_allocations pa ON pr.id = pa.port_range_id
LEFT JOIN port_reservations pr2 ON pr2.port_number BETWEEN pr.start_port AND pr.end_port
  AND pr2.expires_at > NOW()
WHERE pr.is_active = true
GROUP BY pr.id, pr.range_name, pr.start_port, pr.end_port;

-- View for active port allocations with project info
CREATE OR REPLACE VIEW active_port_allocations AS
SELECT
  pa.id,
  pa.port_number,
  pa.service_name,
  pa.service_type,
  pa.status,
  pa.hostname,
  pa.protocol,
  pa.allocated_at,
  pa.last_used_at,
  p.name as project_name,
  pr.range_name
FROM port_allocations pa
JOIN projects p ON pa.project_id = p.id
JOIN port_ranges pr ON pa.port_range_id = pr.id
WHERE pa.status IN ('allocated', 'in_use')
ORDER BY pa.port_number;
