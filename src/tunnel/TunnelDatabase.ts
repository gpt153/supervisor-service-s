/**
 * TunnelDatabase - SQLite database wrapper for Tunnel Manager
 *
 * Handles all database operations for tunnel state including:
 * - CNAME ownership tracking
 * - Health metrics
 * - Docker topology
 * - Domain discovery
 * - Audit logging
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type {
  CNAME,
  TunnelHealthRecord,
  Domain,
  AuditLogEntry,
  DockerContainer,
  DockerNetwork
} from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class TunnelDatabase {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL'); // Enable WAL mode for concurrency
    this.runMigrations();
  }

  /**
   * Run database migrations
   */
  private runMigrations(): void {
    const migrationPath = join(__dirname, 'migrations', '001_initial_schema.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    // Split by semicolons and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      try {
        this.db.exec(statement);
      } catch (error) {
        console.error('Migration error:', error);
        throw error;
      }
    }
  }

  // ==================== CNAME Operations ====================

  /**
   * Create a new CNAME record
   */
  createCNAME(cname: Omit<CNAME, 'id' | 'created_at'>): number {
    const stmt = this.db.prepare(`
      INSERT INTO cnames (
        subdomain, domain, full_hostname, target_service, target_port,
        target_type, container_name, docker_network, project_name,
        cloudflare_record_id, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      cname.subdomain,
      cname.domain,
      cname.full_hostname,
      cname.target_service,
      cname.target_port,
      cname.target_type,
      cname.container_name,
      cname.docker_network,
      cname.project_name,
      cname.cloudflare_record_id,
      cname.created_by
    );

    return result.lastInsertRowid as number;
  }

  /**
   * Get CNAME by hostname
   */
  getCNAME(hostname: string): CNAME | null {
    const stmt = this.db.prepare('SELECT * FROM cnames WHERE full_hostname = ?');
    const row = stmt.get(hostname) as any;
    return row ? this.mapCNAME(row) : null;
  }

  /**
   * List CNAMEs with optional filters
   */
  listCNAMEs(filters?: { projectName?: string; domain?: string }): CNAME[] {
    let query = 'SELECT * FROM cnames WHERE 1=1';
    const params: any[] = [];

    if (filters?.projectName) {
      query += ' AND project_name = ?';
      params.push(filters.projectName);
    }

    if (filters?.domain) {
      query += ' AND domain = ?';
      params.push(filters.domain);
    }

    query += ' ORDER BY created_at DESC';

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    return rows.map(row => this.mapCNAME(row));
  }

  /**
   * Delete CNAME by hostname
   */
  deleteCNAME(hostname: string): boolean {
    const stmt = this.db.prepare('DELETE FROM cnames WHERE full_hostname = ?');
    const result = stmt.run(hostname);
    return result.changes > 0;
  }

  /**
   * Check if subdomain is available
   */
  isSubdomainAvailable(subdomain: string, domain: string): boolean {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM cnames WHERE subdomain = ? AND domain = ?');
    const row = stmt.get(subdomain, domain) as any;
    return row.count === 0;
  }

  // ==================== Health Operations ====================

  /**
   * Record tunnel health check
   */
  recordHealth(status: 'up' | 'down' | 'restarting', uptime: number | null, restartCount: number | null, error: string | null = null): void {
    const stmt = this.db.prepare(`
      INSERT INTO tunnel_health (status, uptime_seconds, restart_count, last_error)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(status, uptime, restartCount, error);
  }

  /**
   * Get latest health record
   */
  getLatestHealth(): TunnelHealthRecord | null {
    const stmt = this.db.prepare('SELECT * FROM tunnel_health ORDER BY timestamp DESC LIMIT 1');
    const row = stmt.get() as any;
    return row ? this.mapHealthRecord(row) : null;
  }

  /**
   * Get health history
   */
  getHealthHistory(limit: number = 100): TunnelHealthRecord[] {
    const stmt = this.db.prepare('SELECT * FROM tunnel_health ORDER BY timestamp DESC LIMIT ?');
    const rows = stmt.all(limit) as any[];
    return rows.map(row => this.mapHealthRecord(row));
  }

  // ==================== Domain Operations ====================

  /**
   * Upsert domain (insert or update last_seen)
   */
  upsertDomain(domain: string, zoneId: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO domains (domain, zone_id, last_seen)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(domain) DO UPDATE SET
        last_seen = CURRENT_TIMESTAMP
    `);
    stmt.run(domain, zoneId);
  }

  /**
   * Get all domains
   */
  getDomains(): Domain[] {
    const stmt = this.db.prepare('SELECT * FROM domains ORDER BY domain ASC');
    const rows = stmt.all() as any[];
    return rows.map(row => this.mapDomain(row));
  }

  /**
   * Get domain by name
   */
  getDomain(domain: string): Domain | null {
    const stmt = this.db.prepare('SELECT * FROM domains WHERE domain = ?');
    const row = stmt.get(domain) as any;
    return row ? this.mapDomain(row) : null;
  }

  // ==================== Docker Operations ====================

  /**
   * Upsert Docker network
   */
  upsertDockerNetwork(networkId: string, networkName: string, driver: string): number {
    const stmt = this.db.prepare(`
      INSERT INTO docker_networks (network_id, network_name, driver, last_seen)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(network_name) DO UPDATE SET
        last_seen = CURRENT_TIMESTAMP
      RETURNING id
    `);
    const row = stmt.get(networkId, networkName, driver) as any;
    return row.id;
  }

  /**
   * Upsert Docker container
   */
  upsertDockerContainer(containerId: string, containerName: string, image: string, status: string, projectName: string | null): number {
    const stmt = this.db.prepare(`
      INSERT INTO docker_containers (container_id, container_name, image, status, project_name, last_seen)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(container_id) DO UPDATE SET
        container_name = excluded.container_name,
        status = excluded.status,
        project_name = excluded.project_name,
        last_seen = CURRENT_TIMESTAMP
      RETURNING id
    `);
    const row = stmt.get(containerId, containerName, image, status, projectName) as any;
    return row.id;
  }

  /**
   * Set container network membership
   */
  setContainerNetwork(containerDbId: number, networkDbId: number, ipAddress: string | null): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO container_networks (container_id, network_id, ip_address)
      VALUES (?, ?, ?)
    `);
    stmt.run(containerDbId, networkDbId, ipAddress);
  }

  /**
   * Add container port mapping
   */
  addContainerPort(containerDbId: number, internalPort: number, hostPort: number | null, protocol: string): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO container_ports (container_id, internal_port, host_port, protocol)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(containerDbId, internalPort, hostPort, protocol);
  }

  /**
   * Get container by name
   */
  getContainerByName(name: string): any | null {
    const stmt = this.db.prepare('SELECT * FROM docker_containers WHERE container_name = ?');
    return stmt.get(name) as any;
  }

  /**
   * Find containers by port
   */
  findContainersByPort(port: number): any[] {
    const stmt = this.db.prepare(`
      SELECT DISTINCT dc.*
      FROM docker_containers dc
      JOIN container_ports cp ON dc.id = cp.container_id
      WHERE cp.internal_port = ? OR cp.host_port = ?
    `);
    return stmt.all(port, port) as any[];
  }

  /**
   * Get networks for container
   */
  getContainerNetworks(containerDbId: number): string[] {
    const stmt = this.db.prepare(`
      SELECT dn.network_name
      FROM docker_networks dn
      JOIN container_networks cn ON dn.id = cn.network_id
      WHERE cn.container_id = ?
    `);
    const rows = stmt.all(containerDbId) as any[];
    return rows.map(row => row.network_name);
  }

  /**
   * Clean up stale Docker data (not seen recently)
   */
  cleanupStaleDockerData(olderThanMinutes: number = 5): void {
    const stmt = this.db.prepare(`
      DELETE FROM docker_containers
      WHERE last_seen < datetime('now', '-${olderThanMinutes} minutes')
    `);
    stmt.run();

    const stmt2 = this.db.prepare(`
      DELETE FROM docker_networks
      WHERE last_seen < datetime('now', '-${olderThanMinutes} minutes')
    `);
    stmt2.run();
  }

  // ==================== Audit Log Operations ====================

  /**
   * Log an action to audit log
   */
  logAction(action: string, projectName: string | null, details: any, success: boolean, errorMessage: string | null = null): void {
    const stmt = this.db.prepare(`
      INSERT INTO audit_log (action, project_name, details, success, error_message)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(action, projectName, JSON.stringify(details), success ? 1 : 0, errorMessage);
  }

  /**
   * Get audit log entries
   */
  getAuditLog(filters?: { projectName?: string; action?: string; limit?: number }): AuditLogEntry[] {
    let query = 'SELECT * FROM audit_log WHERE 1=1';
    const params: any[] = [];

    if (filters?.projectName) {
      query += ' AND project_name = ?';
      params.push(filters.projectName);
    }

    if (filters?.action) {
      query += ' AND action = ?';
      params.push(filters.action);
    }

    query += ' ORDER BY timestamp DESC';

    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    return rows.map(row => this.mapAuditLog(row));
  }

  // ==================== Helper Methods ====================

  private mapCNAME(row: any): CNAME {
    return {
      id: row.id,
      subdomain: row.subdomain,
      domain: row.domain,
      full_hostname: row.full_hostname,
      target_service: row.target_service,
      target_port: row.target_port,
      target_type: row.target_type,
      container_name: row.container_name,
      docker_network: row.docker_network,
      project_name: row.project_name,
      cloudflare_record_id: row.cloudflare_record_id,
      created_at: new Date(row.created_at),
      created_by: row.created_by
    };
  }

  private mapHealthRecord(row: any): TunnelHealthRecord {
    return {
      id: row.id,
      timestamp: new Date(row.timestamp),
      status: row.status,
      uptime_seconds: row.uptime_seconds,
      restart_count: row.restart_count,
      last_error: row.last_error
    };
  }

  private mapDomain(row: any): Domain {
    return {
      id: row.id,
      domain: row.domain,
      zone_id: row.zone_id,
      discovered_at: new Date(row.discovered_at),
      last_seen: new Date(row.last_seen)
    };
  }

  private mapAuditLog(row: any): AuditLogEntry {
    return {
      id: row.id,
      timestamp: new Date(row.timestamp),
      action: row.action,
      project_name: row.project_name,
      details: row.details,
      success: row.success === 1,
      error_message: row.error_message
    };
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}
