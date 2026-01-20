-- Initial schema for Tunnel Manager SQLite database
-- Created: 2026-01-20
-- Related: Epic 005 - Tunnel Manager

-- CNAME ownership tracking
CREATE TABLE IF NOT EXISTS cnames (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subdomain TEXT NOT NULL,
  domain TEXT NOT NULL,
  full_hostname TEXT NOT NULL,  -- "myapp.153.se"
  target_service TEXT NOT NULL,  -- "http://localhost:3105"
  target_port INTEGER,
  target_type TEXT NOT NULL CHECK(target_type IN ('localhost', 'container', 'external')),
  container_name TEXT,  -- If target_type="container"
  docker_network TEXT,  -- If target_type="container"
  project_name TEXT NOT NULL,
  cloudflare_record_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,  -- PS identifier
  UNIQUE(subdomain, domain)
);

CREATE INDEX IF NOT EXISTS idx_cnames_project ON cnames(project_name);
CREATE INDEX IF NOT EXISTS idx_cnames_hostname ON cnames(full_hostname);

-- Tunnel health metrics
CREATE TABLE IF NOT EXISTS tunnel_health (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL CHECK(status IN ('up', 'down', 'restarting')),
  uptime_seconds INTEGER,
  restart_count INTEGER,
  last_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_tunnel_health_timestamp ON tunnel_health(timestamp);

-- Discovered Cloudflare domains
CREATE TABLE IF NOT EXISTS domains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domain TEXT UNIQUE NOT NULL,
  zone_id TEXT NOT NULL,
  discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Docker networks
CREATE TABLE IF NOT EXISTS docker_networks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  network_name TEXT UNIQUE NOT NULL,
  network_id TEXT NOT NULL,
  driver TEXT,  -- "bridge" | "overlay" | "host"
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Docker containers
CREATE TABLE IF NOT EXISTS docker_containers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  container_name TEXT NOT NULL,
  container_id TEXT UNIQUE NOT NULL,
  image TEXT,
  status TEXT CHECK(status IN ('running', 'stopped', 'paused')),
  project_name TEXT,
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_containers_project ON docker_containers(project_name);

-- Container network membership
CREATE TABLE IF NOT EXISTS container_networks (
  container_id INTEGER NOT NULL,
  network_id INTEGER NOT NULL,
  ip_address TEXT,
  FOREIGN KEY(container_id) REFERENCES docker_containers(id) ON DELETE CASCADE,
  FOREIGN KEY(network_id) REFERENCES docker_networks(id) ON DELETE CASCADE,
  PRIMARY KEY(container_id, network_id)
);

-- Container port mappings
CREATE TABLE IF NOT EXISTS container_ports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  container_id INTEGER NOT NULL,
  internal_port INTEGER NOT NULL,
  host_port INTEGER,  -- NULL if not exposed to host
  protocol TEXT DEFAULT 'tcp',
  FOREIGN KEY(container_id) REFERENCES docker_containers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_container_ports_internal ON container_ports(internal_port);
CREATE INDEX IF NOT EXISTS idx_container_ports_host ON container_ports(host_port);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  action TEXT NOT NULL,  -- "create_cname" | "delete_cname" | "restart_tunnel" | etc
  project_name TEXT,
  details TEXT,  -- JSON: {subdomain, domain, port, etc}
  success BOOLEAN NOT NULL,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);

-- Enable WAL mode for better concurrency
PRAGMA journal_mode=WAL;
