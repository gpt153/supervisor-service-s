/**
 * RestartManager - Automatic tunnel restart with exponential backoff
 *
 * Responsibilities:
 * - Restart cloudflared on failure
 * - Exponential backoff: 5s → 15s → 30s → 1min → 5min (max)
 * - Unlimited retries
 * - Graceful restart (SIGTERM → SIGKILL)
 * - Log all restart attempts
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import { TunnelDatabase } from './TunnelDatabase.js';
import type { RestartConfig } from './types.js';

const execAsync = promisify(exec);

export class RestartManager extends EventEmitter {
  private database: TunnelDatabase;
  private config: RestartConfig = {
    backoffSequence: [5000, 15000, 30000, 60000, 300000], // 5s, 15s, 30s, 1min, 5min
    maxBackoff: 300000, // 5 minutes
    unlimitedRetries: true,
    gracePeriodMs: 10000 // 10 seconds
  };
  private currentBackoffIndex: number = 0;
  private isRestarting: boolean = false;
  private cloudflarednLocation: 'host' | 'container' = 'host';

  constructor(database: TunnelDatabase) {
    super();
    this.database = database;
  }

  /**
   * Set cloudflared location
   */
  setLocation(location: 'host' | 'container'): void {
    this.cloudflarednLocation = location;
  }

  /**
   * Restart the tunnel
   */
  async restart(): Promise<boolean> {
    if (this.isRestarting) {
      console.log('Restart already in progress, skipping...');
      return false;
    }

    this.isRestarting = true;
    this.emit('restart_started');

    try {
      // Wait for backoff period
      const backoffDelay = this.getBackoffDelay();
      console.log(`Waiting ${backoffDelay}ms before restart attempt...`);

      if (backoffDelay > 0) {
        await this.sleep(backoffDelay);
      }

      // Perform restart
      console.log(`Restarting cloudflared (${this.cloudflarednLocation})...`);
      const success = await this.performRestart();

      if (success) {
        console.log('Tunnel restarted successfully');
        this.currentBackoffIndex = 0; // Reset backoff on success
        this.database.logAction('restart_tunnel', null, {
          location: this.cloudflarednLocation,
          backoff_index: this.currentBackoffIndex
        }, true, null);
        this.emit('restart_success');
        this.isRestarting = false;
        return true;
      } else {
        console.error('Tunnel restart failed');
        this.incrementBackoff();
        this.database.logAction('restart_tunnel', null, {
          location: this.cloudflarednLocation,
          backoff_index: this.currentBackoffIndex
        }, false, 'Restart command failed');
        this.emit('restart_failed');

        // Retry if unlimited retries enabled
        if (this.config.unlimitedRetries) {
          console.log('Scheduling retry...');
          this.isRestarting = false;
          setTimeout(() => this.restart(), 1000);
        } else {
          this.isRestarting = false;
        }

        return false;
      }
    } catch (error) {
      console.error('Restart error:', error);
      this.incrementBackoff();
      this.database.logAction('restart_tunnel', null, {
        location: this.cloudflarednLocation,
        backoff_index: this.currentBackoffIndex
      }, false, error instanceof Error ? error.message : 'Unknown error');
      this.emit('restart_failed', error);

      // Retry if unlimited retries enabled
      if (this.config.unlimitedRetries) {
        console.log('Scheduling retry after error...');
        this.isRestarting = false;
        setTimeout(() => this.restart(), 1000);
      } else {
        this.isRestarting = false;
      }

      return false;
    }
  }

  /**
   * Perform the actual restart
   */
  private async performRestart(): Promise<boolean> {
    try {
      if (this.cloudflarednLocation === 'host') {
        // Graceful restart via systemd
        await execAsync('systemctl restart cloudflared');
        // Wait a bit for service to come up
        await this.sleep(3000);
        // Verify it's running
        const { stdout } = await execAsync('systemctl is-active cloudflared');
        return stdout.trim() === 'active';
      } else {
        // Docker container restart
        await execAsync('docker restart cloudflared');
        // Wait a bit for container to come up
        await this.sleep(3000);
        // Verify it's running
        const { stdout } = await execAsync('docker ps --filter "name=cloudflared" --format "{{.Status}}"');
        return stdout.includes('Up');
      }
    } catch (error) {
      console.error('Restart command failed:', error);
      return false;
    }
  }

  /**
   * Get current backoff delay
   */
  private getBackoffDelay(): number {
    if (this.currentBackoffIndex === 0) {
      return 0; // First attempt - no delay
    }
    return this.config.backoffSequence[this.currentBackoffIndex - 1];
  }

  /**
   * Increment backoff index
   */
  private incrementBackoff(): void {
    if (this.currentBackoffIndex < this.config.backoffSequence.length) {
      this.currentBackoffIndex++;
    }
    // Stay at max backoff level for subsequent retries
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Reset backoff (call on successful restart)
   */
  resetBackoff(): void {
    this.currentBackoffIndex = 0;
  }

  /**
   * Check if restart is in progress
   */
  isRestartInProgress(): boolean {
    return this.isRestarting;
  }
}
