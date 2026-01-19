/**
 * TypeScript types for Port Allocation System
 */

/**
 * Port allocation status
 */
export type PortStatus = 'allocated' | 'in_use' | 'released';

/**
 * Network protocol
 */
export type PortProtocol = 'tcp' | 'udp';

/**
 * Service types
 */
export type ServiceType =
  | 'mcp'
  | 'api'
  | 'web'
  | 'websocket'
  | 'database'
  | 'worker'
  | 'metrics'
  | 'other';

/**
 * Port allocation record from database
 */
export interface PortAllocation {
  id: string;
  portNumber: number;
  projectName: string;
  serviceName: string;
  serviceType?: ServiceType;
  status: PortStatus;
  hostname: string;
  protocol: PortProtocol;
  cloudflareHostname?: string;
  description?: string;
  allocatedAt: Date;
  lastUsedAt?: Date;
  releasedAt?: Date;
}

/**
 * Port range definition
 */
export interface PortRange {
  id: string;
  rangeName: string;
  startPort: number;
  endPort: number;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Port range utilization summary
 */
export interface PortRangeUtilization {
  rangeId: string;
  rangeName: string;
  startPort: number;
  endPort: number;
  totalPorts: number;
  allocatedPorts: number;
  releasedPorts: number;
  reservedPorts: number;
  utilizationPercent: number;
}

/**
 * Port summary for a project
 */
export interface PortSummary {
  rangeStart: number;
  rangeEnd: number;
  totalPorts: number;
  allocatedPorts: number;
  availablePorts: number;
  utilization: number;
}

/**
 * Port health check result
 */
export interface PortHealthCheck {
  id: string;
  portAllocationId: string;
  checkType: 'tcp' | 'http' | 'ping';
  status: 'healthy' | 'unhealthy' | 'timeout';
  responseTimeMs?: number;
  errorMessage?: string;
  checkedAt: Date;
}

/**
 * Port audit result
 */
export interface PortAuditResult {
  allocated: number;
  inUse: number;
  notRunning: number;
  conflicts: PortConflict[];
}

/**
 * Port conflict information
 */
export interface PortConflict {
  port: number;
  expected: string;
  actual: string;
}

/**
 * Port reservation
 */
export interface PortReservation {
  id: string;
  projectId: string;
  portRangeId: string;
  portNumber: number;
  serviceName: string;
  reservedBy: string;
  expiresAt: Date;
  createdAt: Date;
}

/**
 * Options for allocating a port
 */
export interface AllocatePortOptions {
  serviceType?: ServiceType;
  description?: string;
  cloudflareHostname?: string;
  hostname?: string;
  protocol?: PortProtocol;
}

/**
 * Options for updating a port
 */
export interface UpdatePortOptions {
  cloudflareHostname?: string;
  description?: string;
  serviceType?: ServiceType;
}

/**
 * Project port range configuration
 * Defines the port ranges for each project
 */
export const PROJECT_PORT_RANGES = {
  'meta-supervisor': { start: 3000, end: 3099 },
  'consilio': { start: 3100, end: 3199 },
  'openhorizon': { start: 3200, end: 3299 },
  'odin': { start: 3300, end: 3399 },
  'health-agent': { start: 3400, end: 3499 },
  'quiculum-monitor': { start: 3500, end: 3599 },
  'shared-services': { start: 9000, end: 9999 },
} as const;

/**
 * Project names with port ranges
 */
export type ProjectWithPortRange = keyof typeof PROJECT_PORT_RANGES;

/**
 * Validate if a port is within a valid range
 */
export function isValidPort(port: number): boolean {
  return port >= 1 && port <= 65535;
}

/**
 * Validate if a port is in the project's allocated range
 */
export function isPortInProjectRange(
  port: number,
  projectName: ProjectWithPortRange
): boolean {
  const range = PROJECT_PORT_RANGES[projectName];
  if (!range) return false;
  return port >= range.start && port <= range.end;
}

/**
 * Get project name from port number
 */
export function getProjectFromPort(port: number): ProjectWithPortRange | null {
  for (const [project, range] of Object.entries(PROJECT_PORT_RANGES)) {
    if (port >= range.start && port <= range.end) {
      return project as ProjectWithPortRange;
    }
  }
  return null;
}

/**
 * Calculate port range size
 */
export function getPortRangeSize(startPort: number, endPort: number): number {
  return endPort - startPort + 1;
}
