/**
 * PortManager - Manages dynamic port allocation for services
 *
 * Features:
 * - Project-based port range allocation (100 ports per project)
 * - Automatic next-available-port algorithm
 * - Port verification (health checks)
 * - Cloudflare hostname linking
 * - Audit capabilities
 *
 * Port Ranges:
 * - Consilio: 3100-3199
 * - OpenHorizon: 3200-3299
 * - Odin: 3300-3399
 * - Health-Agent: 3400-3499
 * - Shared services: 9000-9999
 */

import { Pool } from 'pg';
import net from 'net';

export interface PortAllocation {
  id: string;
  portNumber: number;
  projectName: string;
  serviceName: string;
  serviceType?: string;
  status: 'allocated' | 'in_use' | 'released';
  hostname: string;
  protocol: string;
  cloudflareHostname?: string;
  allocatedAt: Date;
  lastUsedAt?: Date;
}

export interface PortRange {
  id: string;
  rangeName: string;
  startPort: number;
  endPort: number;
  description?: string;
  isActive: boolean;
}

export interface PortSummary {
  rangeStart: number;
  rangeEnd: number;
  totalPorts: number;
  allocatedPorts: number;
  availablePorts: number;
  utilization: number;
}

export interface AuditResult {
  allocated: number;
  inUse: number;
  notRunning: number;
  conflicts: Array<{
    port: number;
    expected: string;
    actual: string;
  }>;
}

export class PortManager {
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;
  }

  /**
   * Get or allocate port for a service
   * If service already has a port allocated, return it
   * Otherwise allocate next available port in project's range
   *
   * @param projectName - Name of the project
   * @param serviceName - Name of the service
   * @param options - Additional options
   * @returns Allocated port number
   */
  async getOrAllocate(
    projectName: string,
    serviceName: string,
    options?: {
      serviceType?: string;
      description?: string;
      cloudflareHostname?: string;
      hostname?: string;
      protocol?: string;
    }
  ): Promise<number> {
    const hostname = options?.hostname || 'localhost';
    const protocol = options?.protocol || 'tcp';

    // Check if service already has a port allocated
    const existing = await this.db.query<{ port_number: number }>(`
      SELECT pa.port_number
      FROM port_allocations pa
      JOIN projects p ON pa.project_id = p.id
      WHERE p.name = $1
        AND pa.service_name = $2
        AND pa.hostname = $3
        AND pa.protocol = $4
        AND pa.status IN ('allocated', 'in_use')
    `, [projectName, serviceName, hostname, protocol]);

    if (existing.rows.length > 0) {
      return existing.rows[0].port_number;
    }

    // Allocate new port
    return await this.allocate(projectName, serviceName, options);
  }

  /**
   * Allocate next available port for a service
   *
   * @param projectName - Name of the project
   * @param serviceName - Name of the service
   * @param options - Additional options
   * @returns Allocated port number
   */
  async allocate(
    projectName: string,
    serviceName: string,
    options?: {
      serviceType?: string;
      description?: string;
      cloudflareHostname?: string;
      hostname?: string;
      protocol?: string;
    }
  ): Promise<number> {
    const hostname = options?.hostname || 'localhost';
    const protocol = options?.protocol || 'tcp';

    // Get project ID and port range
    const projectQuery = await this.db.query<{ id: string; range_id: string }>(`
      SELECT p.id, pr.id as range_id
      FROM projects p
      JOIN port_ranges pr ON pr.range_name = p.name
      WHERE p.name = $1
        AND pr.is_active = true
    `, [projectName]);

    if (projectQuery.rows.length === 0) {
      throw new Error(`Project '${projectName}' not found or has no active port range`);
    }

    const { id: projectId, range_id: rangeId } = projectQuery.rows[0];

    // Use database function to allocate port
    const result = await this.db.query<{ allocate_port: number }>(`
      SELECT allocate_port(
        $1::UUID,
        $2::UUID,
        $3,
        $4,
        $5,
        $6
      ) as allocate_port
    `, [
      projectId,
      rangeId,
      serviceName,
      options?.serviceType || null,
      hostname,
      protocol
    ]);

    const portNumber = result.rows[0].allocate_port;

    // Update with cloudflare hostname if provided
    if (options?.cloudflareHostname) {
      await this.db.query(`
        UPDATE port_allocations
        SET metadata = metadata || jsonb_build_object('cloudflare_hostname', $1, 'description', $2)
        WHERE port_number = $3
          AND hostname = $4
          AND protocol = $5
      `, [
        options.cloudflareHostname,
        options.description || null,
        portNumber,
        hostname,
        protocol
      ]);
    }

    return portNumber;
  }

  /**
   * Release a port allocation
   *
   * @param projectName - Name of the project
   * @param serviceName - Name of the service
   * @param hostname - Hostname (default: localhost)
   * @returns True if port was released
   */
  async release(
    projectName: string,
    serviceName: string,
    hostname: string = 'localhost'
  ): Promise<boolean> {
    const result = await this.db.query(`
      UPDATE port_allocations pa
      SET
        status = 'released',
        released_at = NOW()
      FROM projects p
      WHERE pa.project_id = p.id
        AND p.name = $1
        AND pa.service_name = $2
        AND pa.hostname = $3
        AND pa.status IN ('allocated', 'in_use')
    `, [projectName, serviceName, hostname]);

    return (result.rowCount || 0) > 0;
  }

  /**
   * List all port allocations for a project
   *
   * @param projectName - Name of the project
   * @returns Array of port allocations
   */
  async listByProject(projectName: string): Promise<PortAllocation[]> {
    const result = await this.db.query<{
      id: string;
      port_number: number;
      project_name: string;
      service_name: string;
      service_type: string;
      status: string;
      hostname: string;
      protocol: string;
      cloudflare_hostname: string;
      allocated_at: Date;
      last_used_at: Date;
    }>(`
      SELECT
        pa.id,
        pa.port_number,
        p.name as project_name,
        pa.service_name,
        pa.service_type,
        pa.status,
        pa.hostname,
        pa.protocol,
        pa.metadata->>'cloudflare_hostname' as cloudflare_hostname,
        pa.allocated_at,
        pa.last_used_at
      FROM port_allocations pa
      JOIN projects p ON pa.project_id = p.id
      WHERE p.name = $1
        AND pa.status IN ('allocated', 'in_use')
      ORDER BY pa.port_number
    `, [projectName]);

    return result.rows.map(row => ({
      id: row.id,
      portNumber: row.port_number,
      projectName: row.project_name,
      serviceName: row.service_name,
      serviceType: row.service_type,
      status: row.status as PortAllocation['status'],
      hostname: row.hostname,
      protocol: row.protocol as PortAllocation['protocol'],
      cloudflareHostname: row.cloudflare_hostname,
      allocatedAt: row.allocated_at,
      lastUsedAt: row.last_used_at,
    }));
  }

  /**
   * List all port allocations across all projects
   *
   * @returns Array of port allocations
   */
  async listAll(): Promise<PortAllocation[]> {
    const result = await this.db.query<{
      id: string;
      port_number: number;
      project_name: string;
      service_name: string;
      service_type: string;
      status: string;
      hostname: string;
      protocol: string;
      cloudflare_hostname: string;
      allocated_at: Date;
      last_used_at: Date;
    }>(`
      SELECT
        pa.id,
        pa.port_number,
        p.name as project_name,
        pa.service_name,
        pa.service_type,
        pa.status,
        pa.hostname,
        pa.protocol,
        pa.metadata->>'cloudflare_hostname' as cloudflare_hostname,
        pa.allocated_at,
        pa.last_used_at
      FROM port_allocations pa
      JOIN projects p ON pa.project_id = p.id
      WHERE pa.status IN ('allocated', 'in_use')
      ORDER BY pa.port_number
    `);

    return result.rows.map(row => ({
      id: row.id,
      portNumber: row.port_number,
      projectName: row.project_name,
      serviceName: row.service_name,
      serviceType: row.service_type,
      status: row.status as PortAllocation['status'],
      hostname: row.hostname,
      protocol: row.protocol as PortAllocation['protocol'],
      cloudflareHostname: row.cloudflare_hostname,
      allocatedAt: row.allocated_at,
      lastUsedAt: row.last_used_at,
    }));
  }

  /**
   * Get port allocation summary for a project
   *
   * @param projectName - Name of the project
   * @returns Port summary
   */
  async getProjectSummary(projectName: string): Promise<PortSummary> {
    const result = await this.db.query<{
      range_start: number;
      range_end: number;
      total_ports: number;
      allocated_ports: number;
      available_ports: number;
      utilization: number;
    }>(`
      SELECT
        pr.start_port as range_start,
        pr.end_port as range_end,
        (pr.end_port - pr.start_port + 1) as total_ports,
        COUNT(pa.id) FILTER (WHERE pa.status IN ('allocated', 'in_use')) as allocated_ports,
        (pr.end_port - pr.start_port + 1) - COUNT(pa.id) FILTER (WHERE pa.status IN ('allocated', 'in_use')) as available_ports,
        ROUND(
          (COUNT(pa.id) FILTER (WHERE pa.status IN ('allocated', 'in_use'))::NUMERIC /
          (pr.end_port - pr.start_port + 1)::NUMERIC) * 100,
          2
        ) as utilization
      FROM port_ranges pr
      JOIN projects p ON pr.range_name = p.name
      LEFT JOIN port_allocations pa ON pr.id = pa.port_range_id
      WHERE p.name = $1
        AND pr.is_active = true
      GROUP BY pr.start_port, pr.end_port
    `, [projectName]);

    if (result.rows.length === 0) {
      throw new Error(`Project '${projectName}' not found or has no active port range`);
    }

    return {
      rangeStart: result.rows[0].range_start,
      rangeEnd: result.rows[0].range_end,
      totalPorts: result.rows[0].total_ports,
      allocatedPorts: result.rows[0].allocated_ports,
      availablePorts: result.rows[0].available_ports,
      utilization: parseFloat(result.rows[0].utilization.toString()),
    };
  }

  /**
   * Verify if a port is currently in use
   * Uses TCP connection test to check if port is listening
   *
   * @param port - Port number to verify
   * @param hostname - Hostname to check (default: localhost)
   * @returns True if port is in use
   */
  async verifyPort(port: number, hostname: string = 'localhost'): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();

      server.once('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          resolve(true);  // Port is in use
        } else {
          resolve(false); // Other error, assume not in use
        }
      });

      server.once('listening', () => {
        server.close();
        resolve(false); // Port is free
      });

      server.listen(port, hostname);
    });
  }

  /**
   * Audit all allocated ports to verify they match running services
   *
   * @returns Audit results
   */
  async auditPorts(): Promise<AuditResult> {
    const allocations = await this.listAll();
    let inUse = 0;
    let notRunning = 0;
    const conflicts: Array<{ port: number; expected: string; actual: string }> = [];

    for (const allocation of allocations) {
      const isUsed = await this.verifyPort(allocation.portNumber, allocation.hostname);

      if (isUsed) {
        inUse++;

        // Update status to in_use and record last verification
        await this.db.query(`
          UPDATE port_allocations
          SET
            status = 'in_use',
            last_used_at = NOW()
          WHERE id = $1
        `, [allocation.id]);
      } else {
        notRunning++;

        // Port allocated but not in use (service down?)
        conflicts.push({
          port: allocation.portNumber,
          expected: `${allocation.projectName}/${allocation.serviceName}`,
          actual: 'not running',
        });
      }
    }

    return {
      allocated: allocations.length,
      inUse,
      notRunning,
      conflicts,
    };
  }

  /**
   * Get all port ranges
   *
   * @returns Array of port ranges
   */
  async getPortRanges(): Promise<PortRange[]> {
    const result = await this.db.query<{
      id: string;
      range_name: string;
      start_port: number;
      end_port: number;
      description: string;
      is_active: boolean;
    }>(`
      SELECT
        id,
        range_name,
        start_port,
        end_port,
        description,
        is_active
      FROM port_ranges
      WHERE is_active = true
      ORDER BY start_port
    `);

    return result.rows.map(row => ({
      id: row.id,
      rangeName: row.range_name,
      startPort: row.start_port,
      endPort: row.end_port,
      description: row.description,
      isActive: row.is_active,
    }));
  }

  /**
   * Update port metadata (e.g., Cloudflare hostname)
   *
   * @param projectName - Name of the project
   * @param serviceName - Name of the service
   * @param updates - Fields to update
   * @returns True if port was updated
   */
  async updatePort(
    projectName: string,
    serviceName: string,
    updates: {
      cloudflareHostname?: string;
      description?: string;
      serviceType?: string;
    }
  ): Promise<boolean> {
    const metadata: any = {};
    if (updates.cloudflareHostname !== undefined) {
      metadata.cloudflare_hostname = updates.cloudflareHostname;
    }
    if (updates.description !== undefined) {
      metadata.description = updates.description;
    }

    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (Object.keys(metadata).length > 0) {
      setClauses.push(`metadata = metadata || $${paramIndex}::jsonb`);
      values.push(JSON.stringify(metadata));
      paramIndex++;
    }

    if (updates.serviceType !== undefined) {
      setClauses.push(`service_type = $${paramIndex}`);
      values.push(updates.serviceType);
      paramIndex++;
    }

    if (setClauses.length === 0) {
      return false; // Nothing to update
    }

    values.push(projectName, serviceName);

    const result = await this.db.query(`
      UPDATE port_allocations pa
      SET
        ${setClauses.join(', ')},
        updated_at = NOW()
      FROM projects p
      WHERE pa.project_id = p.id
        AND p.name = $${paramIndex}
        AND pa.service_name = $${paramIndex + 1}
        AND pa.status IN ('allocated', 'in_use')
    `, values);

    return (result.rowCount || 0) > 0;
  }
}
