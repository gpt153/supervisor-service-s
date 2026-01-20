/**
 * HealthMonitor - Background health monitoring for cloudflared tunnel
 *
 * Responsibilities:
 * - Check tunnel health every 30 seconds
 * - Detect failures (3 consecutive failed checks = 90s)
 * - Record health metrics to database
 * - Emit events on status changes
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import { TunnelDatabase } from './TunnelDatabase.js';
import type { TunnelStatus } from './types.js';

const execAsync = promisify(exec);

export class HealthMonitor extends EventEmitter {
  private database: TunnelDatabase;
  private checkInterval: NodeJS.Timeout | null = null;
  private failureCount: number = 0;
  private restartCount: number = 0;
  private startTime: Date | null = null;
  private currentStatus: 'up' | 'down' | 'restarting' = 'down';
  private cloudflarednLocation: 'host' | 'container' = 'host';

  constructor(database: TunnelDatabase) {
    super();
    this.database = database;
  }

  /**
   * Start health monitoring
   */
  start(location: 'host' | 'container' = 'host'): void {
    this.cloudflarednLocation = location;
    this.startTime = new Date();

    // Initial check
    this.performHealthCheck().catch(err => {
      console.error('Initial health check failed:', err);
    });

    // Check every 30 seconds
    this.checkInterval = setInterval(() => {
      this.performHealthCheck().catch(err => {
        console.error('Health check failed:', err);
      });
    }, 30000);

    console.log('Health monitor started (30s interval)');
  }

  /**
   * Stop health monitoring
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    console.log('Health monitor stopped');
  }

  /**
   * Perform a health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const isHealthy = await this.checkTunnelHealth();

      if (isHealthy) {
        // Tunnel is healthy
        this.failureCount = 0;

        if (this.currentStatus !== 'up') {
          this.currentStatus = 'up';
          this.emit('status_change', { status: 'up', message: 'Tunnel is healthy' });
        }

        // Record health
        const uptime = this.startTime ? Math.floor((Date.now() - this.startTime.getTime()) / 1000) : 0;
        this.database.recordHealth('up', uptime, this.restartCount, null);
      } else {
        // Tunnel is unhealthy
        this.failureCount++;

        if (this.failureCount >= 3) {
          // 3 consecutive failures - trigger restart
          if (this.currentStatus !== 'down') {
            this.currentStatus = 'down';
            this.emit('tunnel_down', { failureCount: this.failureCount });
          }

          // Record health
          this.database.recordHealth('down', null, this.restartCount, 'Tunnel health check failed');
        }
      }
    } catch (error) {
      console.error('Health check error:', error);
      this.failureCount++;

      if (this.failureCount >= 3 && this.currentStatus !== 'down') {
        this.currentStatus = 'down';
        this.emit('tunnel_down', { failureCount: this.failureCount, error });
        this.database.recordHealth('down', null, this.restartCount, error instanceof Error ? error.message : 'Unknown error');
      }
    }
  }

  /**
   * Check if tunnel is healthy
   */
  private async checkTunnelHealth(): Promise<boolean> {
    if (this.cloudflarednLocation === 'host') {
      return await this.checkSystemdService();
    } else {
      return await this.checkDockerContainer();
    }
  }

  /**
   * Check systemd service status
   */
  private async checkSystemdService(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('systemctl is-active cloudflared');
      return stdout.trim() === 'active';
    } catch (error) {
      return false;
    }
  }

  /**
   * Check Docker container status
   */
  private async checkDockerContainer(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('docker ps --filter "name=cloudflared" --format "{{.Status}}"');
      return stdout.includes('Up');
    } catch (error) {
      return false;
    }
  }

  /**
   * Get current status
   */
  getStatus(): TunnelStatus {
    const uptime = this.startTime && this.currentStatus === 'up'
      ? Math.floor((Date.now() - this.startTime.getTime()) / 1000)
      : 0;

    return {
      status: this.currentStatus,
      uptime_seconds: uptime,
      restart_count: this.restartCount,
      last_check: new Date(),
      cloudflared_location: this.cloudflarednLocation,
      cloudflared_networks: []
    };
  }

  /**
   * Notify that tunnel is restarting
   */
  markRestarting(): void {
    this.currentStatus = 'restarting';
    this.failureCount = 0;
    this.database.recordHealth('restarting', null, this.restartCount + 1, null);
    this.emit('status_change', { status: 'restarting' });
  }

  /**
   * Notify that restart completed
   */
  markRestartComplete(success: boolean): void {
    if (success) {
      this.restartCount++;
      this.currentStatus = 'up';
      this.failureCount = 0;
      this.startTime = new Date();
      this.emit('tunnel_up', { restartCount: this.restartCount });
    } else {
      this.currentStatus = 'down';
      this.emit('tunnel_down', { restartCount: this.restartCount });
    }
  }
}
