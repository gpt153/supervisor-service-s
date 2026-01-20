/**
 * TunnelManager - Main orchestrator for Cloudflare Tunnel management
 *
 * Responsibilities:
 * - Initialize all components (database, health, restart, ingress, CNAME)
 * - Coordinate tunnel lifecycle
 * - Provide high-level API for MCP tools
 * - Handle startup and shutdown
 */

import { join } from 'path';
import { TunnelDatabase } from './TunnelDatabase.js';
import { HealthMonitor } from './HealthMonitor.js';
import { RestartManager } from './RestartManager.js';
import { IngressManager } from './IngressManager.js';
import { DockerNetworkIntel } from './DockerNetworkIntel.js';
import { DomainDiscovery } from './DomainDiscovery.js';
import { CNAMEManager } from './CNAMEManager.js';
import { CloudflareManager } from '../cloudflare/CloudflareManager.js';
import type { PortManager } from '../ports/PortManager.js';
import type { SecretsManager } from '../secrets/SecretsManager.js';
import type {
  TunnelStatus,
  CNAMERequest,
  CNAMEResult,
  CNAME,
  Domain
} from './types.js';

export class TunnelManager {
  private database!: TunnelDatabase;
  private healthMonitor!: HealthMonitor;
  private restartManager!: RestartManager;
  private ingressManager!: IngressManager;
  private dockerIntel!: DockerNetworkIntel;
  private domainDiscovery!: DomainDiscovery;
  private cnameManager!: CNAMEManager;
  private cloudflareManager!: CloudflareManager;
  private portManager: PortManager;
  private secretsManager: SecretsManager;
  private initialized: boolean = false;

  constructor(portManager: PortManager, secretsManager: SecretsManager) {
    this.portManager = portManager;
    this.secretsManager = secretsManager;
  }

  /**
   * Initialize tunnel manager and all components
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('TunnelManager already initialized');
      return;
    }

    console.log('Initializing TunnelManager...');

    try {
      // Step 1: Initialize database
      const dbPath = join(process.cwd(), 'data', 'tunnel-manager.db');
      this.database = new TunnelDatabase(dbPath);
      console.log('✓ Database initialized');

      // Step 2: Initialize Cloudflare Manager
      const cfToken = await this.secretsManager.get({ keyPath: 'meta/cloudflare/dns_edit_token' });
      const cfAccountId = await this.secretsManager.get({ keyPath: 'meta/cloudflare/account_id' });
      const cfTunnelId = await this.secretsManager.get({ keyPath: 'meta/cloudflare/tunnel_id' });
      const cfZoneId153 = await this.secretsManager.get({ keyPath: 'meta/cloudflare/zone_id_153se' });

      if (!cfToken || !cfAccountId || !cfTunnelId || !cfZoneId153) {
        throw new Error('Missing required Cloudflare secrets');
      }

      this.cloudflareManager = new CloudflareManager({
        apiToken: cfToken,
        accountId: cfAccountId,
        tunnelId: cfTunnelId,
        zoneIds: {
          '153.se': cfZoneId153
        }
      });
      console.log('✓ Cloudflare Manager initialized');

      // Step 3: Initialize Domain Discovery
      this.domainDiscovery = new DomainDiscovery(cfToken, cfAccountId, this.database);
      await this.domainDiscovery.discoverDomains();
      console.log('✓ Domain discovery completed');

      // Step 4: Initialize Docker Network Intel
      this.dockerIntel = new DockerNetworkIntel(this.database);
      await this.dockerIntel.initialize();
      console.log('✓ Docker network intelligence initialized');

      // Step 5: Initialize Ingress Manager
      this.ingressManager = new IngressManager('/etc/cloudflared/config.yml');
      console.log('✓ Ingress manager initialized');

      // Step 6: Initialize CNAME Manager
      this.cnameManager = new CNAMEManager(
        this.database,
        this.dockerIntel,
        this.ingressManager,
        this.cloudflareManager,
        this.portManager
      );
      console.log('✓ CNAME manager initialized');

      // Step 7: Initialize Restart Manager
      this.restartManager = new RestartManager(this.database);
      const cloudflarednLocation = this.dockerIntel.getCloudflarednLocation();
      this.restartManager.setLocation(cloudflarednLocation === 'container' ? 'container' : 'host');
      console.log('✓ Restart manager initialized');

      // Step 8: Initialize Health Monitor
      this.healthMonitor = new HealthMonitor(this.database);

      // Set up health monitor event listeners
      this.healthMonitor.on('tunnel_down', async () => {
        console.log('⚠ Tunnel down detected, triggering auto-restart...');
        this.healthMonitor.markRestarting();
        const success = await this.restartManager.restart();
        this.healthMonitor.markRestartComplete(success);
      });

      this.healthMonitor.on('tunnel_up', () => {
        console.log('✓ Tunnel recovered successfully');
      });

      // Start health monitoring
      this.healthMonitor.start(cloudflarednLocation === 'container' ? 'container' : 'host');
      console.log('✓ Health monitor started');

      this.initialized = true;
      console.log('✅ TunnelManager initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize TunnelManager:', error);
      throw error;
    }
  }

  /**
   * Shutdown tunnel manager
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down TunnelManager...');

    if (this.healthMonitor) {
      this.healthMonitor.stop();
    }

    if (this.dockerIntel) {
      this.dockerIntel.stop();
    }

    if (this.database) {
      this.database.close();
    }

    this.initialized = false;
    console.log('TunnelManager shutdown complete');
  }

  // ==================== Public API Methods ====================

  /**
   * Get tunnel status
   */
  getStatus(): TunnelStatus {
    this.ensureInitialized();
    return this.healthMonitor.getStatus();
  }

  /**
   * Request a new CNAME
   */
  async requestCNAME(request: CNAMERequest): Promise<CNAMEResult> {
    this.ensureInitialized();
    return await this.cnameManager.requestCNAME(request);
  }

  /**
   * Delete a CNAME
   */
  async deleteCNAME(hostname: string, requestingProject: string, isMetaSupervisor: boolean = false): Promise<{ success: boolean; message: string }> {
    this.ensureInitialized();
    return await this.cnameManager.deleteCNAME(hostname, requestingProject, isMetaSupervisor);
  }

  /**
   * List CNAMEs
   */
  listCNAMEs(filters?: { projectName?: string; domain?: string }): CNAME[] {
    this.ensureInitialized();
    return this.cnameManager.listCNAMEs(filters);
  }

  /**
   * List available domains
   */
  listDomains(): Domain[] {
    this.ensureInitialized();
    return this.database.getDomains();
  }

  /**
   * Manual tunnel restart (for debugging/admin)
   */
  async manualRestart(): Promise<boolean> {
    this.ensureInitialized();
    console.log('Manual tunnel restart requested');
    this.healthMonitor.markRestarting();
    const success = await this.restartManager.restart();
    this.healthMonitor.markRestartComplete(success);
    return success;
  }

  /**
   * Get audit log
   */
  getAuditLog(filters?: { projectName?: string; action?: string; limit?: number }) {
    this.ensureInitialized();
    return this.database.getAuditLog(filters);
  }

  /**
   * Refresh domain discovery
   */
  async refreshDomains(): Promise<void> {
    this.ensureInitialized();
    await this.domainDiscovery.discoverDomains();
  }

  // ==================== Helper Methods ====================

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('TunnelManager not initialized. Call initialize() first.');
    }
  }

  /**
   * Check if manager is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}
