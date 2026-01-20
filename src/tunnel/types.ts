/**
 * TypeScript type definitions for the Tunnel Manager
 */

export interface TunnelStatus {
  status: 'up' | 'down' | 'restarting';
  uptime_seconds: number;
  restart_count: number;
  last_check: Date;
  cloudflared_location: 'host' | 'container';
  cloudflared_networks?: string[];  // If container
  last_error?: string;
}

export interface CNAMERequest {
  subdomain: string;
  domain?: string;  // Defaults to 153.se
  targetPort: number;
  projectName: string;  // Auto-detected from MCP context
}

export interface CNAMEResult {
  success: boolean;
  url?: string;  // "https://myapp.153.se"
  ingress_target?: string;  // "http://localhost:3105"
  target_type?: 'localhost' | 'container' | 'external';
  container_name?: string;
  docker_network?: string;
  error?: string;
  recommendation?: string;
}

export interface CNAME {
  id: number;
  subdomain: string;
  domain: string;
  full_hostname: string;  // "myapp.153.se"
  target_service: string;  // "http://localhost:3105"
  target_port: number | null;
  target_type: 'localhost' | 'container' | 'external';
  container_name: string | null;
  docker_network: string | null;
  project_name: string;
  cloudflare_record_id: string;
  created_at: Date;
  created_by: string | null;
}

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: 'running' | 'stopped' | 'paused';
  project_name?: string;
  networks: string[];  // Network names
  ports: Array<{ internal: number; host?: number; protocol: string }>;
}

export interface DockerNetwork {
  id: string;
  name: string;
  driver: string;  // "bridge" | "overlay" | "host"
}

export interface IngressRule {
  hostname: string;
  service: string;  // "http://localhost:3105" or "http://container:3105"
  originRequest?: {
    noTLSVerify?: boolean;
  };
}

export interface IngressConfig {
  tunnel: string;
  'credentials-file': string;
  ingress: IngressRule[];
}

export interface TunnelHealthRecord {
  id: number;
  timestamp: Date;
  status: 'up' | 'down' | 'restarting';
  uptime_seconds: number | null;
  restart_count: number | null;
  last_error: string | null;
}

export interface Domain {
  id: number;
  domain: string;
  zone_id: string;
  discovered_at: Date;
  last_seen: Date;
}

export interface AuditLogEntry {
  id: number;
  timestamp: Date;
  action: string;
  project_name: string | null;
  details: string | null;
  success: boolean;
  error_message: string | null;
}

export interface ConnectivityResult {
  reachable: boolean;
  method: 'shared-network' | 'host-port' | 'unreachable';
  target: string | null;  // "http://container-name:PORT" or "http://localhost:PORT"
  recommendation?: string;
}

export interface RestartConfig {
  backoffSequence: number[];  // [5000, 15000, 30000, 60000, 300000]
  maxBackoff: number;  // 300000 (5 minutes)
  unlimitedRetries: boolean;  // true
  gracePeriodMs: number;  // 10000
}
