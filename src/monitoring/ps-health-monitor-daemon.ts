#!/usr/bin/env node
/**
 * PS Health Monitor Daemon
 *
 * Entry point for running PS Health Monitor as a systemd service or standalone daemon
 * Runs periodic health checks on all active project-supervisor sessions
 */

import { PSHealthMonitor } from './ps-health-monitor.js';
import { pool } from '../db/client.js';

// Handle graceful shutdown
let monitor: PSHealthMonitor | null = null;
let isShuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`\n[PS Health Monitor] Received ${signal}, shutting down gracefully...`);

  try {
    // Stop the monitor
    if (monitor) {
      monitor.stop();
    }

    // Close database connection
    await pool.end();

    console.log('[PS Health Monitor] ✅ Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('[PS Health Monitor] ❌ Error during shutdown:', error);
    process.exit(1);
  }
}

// Register signal handlers
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('[PS Health Monitor] ❌ Uncaught exception:', error);
  shutdown('uncaughtException').catch(() => process.exit(1));
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[PS Health Monitor] ❌ Unhandled rejection at:', promise, 'reason:', reason);
  shutdown('unhandledRejection').catch(() => process.exit(1));
});

// Main function
async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('PS Health Monitor Daemon');
  console.log('='.repeat(60));
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log(`Process ID: ${process.pid}`);
  console.log(`Node version: ${process.version}`);
  console.log(`Working directory: ${process.cwd()}`);
  console.log('='.repeat(60));

  try {
    // Test database connection
    console.log('[PS Health Monitor] Testing database connection...');
    const dbTest = await pool.query('SELECT NOW()');
    console.log('[PS Health Monitor] ✅ Database connected:', dbTest.rows[0].now);

    // Create and start monitor
    console.log('[PS Health Monitor] Initializing health monitor...');
    monitor = new PSHealthMonitor({
      checkInterval: 10 * 60 * 1000, // 10 minutes
      stallThresholdMinutes: 15,
      contextThresholds: {
        warning: 0.70,
        critical: 0.85,
      },
      enableAutoHandoff: true,
    });

    console.log('[PS Health Monitor] Starting periodic health checks...');
    monitor.start();

    console.log('[PS Health Monitor] ✅ Daemon running');
    console.log('[PS Health Monitor] Press Ctrl+C to stop');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('[PS Health Monitor] ❌ Failed to start:', error);
    process.exit(1);
  }
}

// Start the daemon
main().catch((error) => {
  console.error('[PS Health Monitor] ❌ Fatal error:', error);
  process.exit(1);
});
