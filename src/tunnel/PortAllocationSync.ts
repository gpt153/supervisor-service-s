/**
 * PortAllocationSync - Auto-sync ingress rules from port allocations
 *
 * Responsibilities:
 * - Detect when ports are allocated with CNAME metadata
 * - Auto-create ingress rules for allocated ports
 * - Remove ingress rules when ports released
 * - Periodic sync to catch missed events
 */

import type { PortManager } from '../ports/PortManager.js';
import type { IngressManager } from './IngressManager.js';
import type { TunnelDatabase } from './TunnelDatabase.js';
import type { DockerNetworkIntel } from './DockerNetworkIntel.js';

export interface PortAllocationSyncConfig {
  syncIntervalMinutes?: number; // Default: 5 minutes
  autoCreateIngress?: boolean;  // Default: true
  autoRemoveIngress?: boolean;  // Default: true
}

export class PortAllocationSync {
  private portManager: PortManager;
  private ingressManager: IngressManager;
  private database: TunnelDatabase;
  private dockerIntel: DockerNetworkIntel;
  private config: Required<PortAllocationSyncConfig>;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor(
    portManager: PortManager,
    ingressManager: IngressManager,
    database: TunnelDatabase,
    dockerIntel: DockerNetworkIntel,
    config?: PortAllocationSyncConfig
  ) {
    this.portManager = portManager;
    this.ingressManager = ingressManager;
    this.database = database;
    this.dockerIntel = dockerIntel;

    // Default config
    this.config = {
      syncIntervalMinutes: config?.syncIntervalMinutes ?? 5,
      autoCreateIngress: config?.autoCreateIngress ?? true,
      autoRemoveIngress: config?.autoRemoveIngress ?? true
    };
  }

  /**
   * Start periodic sync
   */
  start(): void {
    if (this.syncInterval) {
      console.log('PortAllocationSync already running');
      return;
    }

    // Initial sync
    this.performSync().catch(err => {
      console.error('Initial port allocation sync failed:', err);
    });

    // Periodic sync
    const intervalMs = this.config.syncIntervalMinutes * 60 * 1000;
    this.syncInterval = setInterval(() => {
      this.performSync().catch(err => {
        console.error('Port allocation sync failed:', err);
      });
    }, intervalMs);

    console.log(`PortAllocationSync started (${this.config.syncIntervalMinutes}min interval)`);
  }

  /**
   * Stop periodic sync
   */
  stop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('PortAllocationSync stopped');
    }
  }

  /**
   * Perform sync operation
   */
  private async performSync(): Promise<void> {
    console.log('🔄 Syncing port allocations with ingress rules...');

    try {
      // Get all CNAMEs from database
      const cnames = this.database.listCNAMEs();
      const cnameHostnames = new Set(cnames.map(c => c.full_hostname));

      // Get all ingress rules from config
      const ingressRules = this.ingressManager.getIngressRules();
      const ingressHostnames = new Set(ingressRules.map(r => r.hostname).filter(Boolean));

      // Find CNAMEs missing from ingress (need to add)
      const missingInIngress = cnames.filter(c => !ingressHostnames.has(c.full_hostname));

      // Find ingress rules not in CNAMEs (need to remove)
      const orphanedIngress = ingressRules.filter(r => r.hostname && !cnameHostnames.has(r.hostname));

      if (missingInIngress.length === 0 && orphanedIngress.length === 0) {
        console.log('✅ Port allocations and ingress rules in sync');
        return;
      }

      // Add missing ingress rules
      if (this.config.autoCreateIngress && missingInIngress.length > 0) {
        console.log(`Adding ${missingInIngress.length} missing ingress rule(s)...`);
        for (const cname of missingInIngress) {
          try {
            this.ingressManager.addIngressRule(cname.full_hostname, cname.target_service);
            console.log(`  ✓ Added ingress: ${cname.full_hostname} → ${cname.target_service}`);
          } catch (error) {
            console.error(`  ✗ Failed to add ingress for ${cname.full_hostname}:`, error);
          }
        }
      }

      // Remove orphaned ingress rules
      if (this.config.autoRemoveIngress && orphanedIngress.length > 0) {
        console.log(`Removing ${orphanedIngress.length} orphaned ingress rule(s)...`);
        for (const rule of orphanedIngress) {
          if (rule.hostname) {
            try {
              this.ingressManager.removeIngressRule(rule.hostname);
              console.log(`  ✓ Removed ingress: ${rule.hostname}`);
            } catch (error) {
              console.error(`  ✗ Failed to remove ingress for ${rule.hostname}:`, error);
            }
          }
        }
      }

      // Reload tunnel if changes were made
      if (missingInIngress.length > 0 || orphanedIngress.length > 0) {
        const location = this.dockerIntel.getCloudflarednLocation() === 'container' ? 'container' : 'host';
        console.log('Reloading tunnel after sync...');
        await this.ingressManager.reloadTunnel(location);
      }

      console.log('✅ Port allocation sync complete');
    } catch (error) {
      console.error('Port allocation sync error:', error);
      throw error;
    }
  }

  /**
   * Manual sync trigger
   */
  async syncNow(): Promise<void> {
    await this.performSync();
  }

  /**
   * Check if specific port needs ingress rule
   */
  async checkPort(port: number, projectName: string): Promise<{
    needsIngress: boolean;
    hasIngress: boolean;
    recommendation?: string;
  }> {
    // Check if port has CNAME in database
    const cnames = this.database.listCNAMEs({ projectName });
    const cnameForPort = cnames.find(c => c.target_port === port);

    if (!cnameForPort) {
      return {
        needsIngress: false,
        hasIngress: false,
        recommendation: 'No CNAME created for this port'
      };
    }

    // Check if ingress rule exists
    const hasIngress = this.ingressManager.hasIngressRule(cnameForPort.full_hostname);

    return {
      needsIngress: true,
      hasIngress,
      recommendation: hasIngress
        ? `Ingress rule exists: ${cnameForPort.full_hostname} → ${cnameForPort.target_service}`
        : `Missing ingress rule - will be added on next sync`
    };
  }
}
