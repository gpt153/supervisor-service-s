#!/usr/bin/env node
/**
 * CLI entry point for PS Health Monitor
 *
 * Starts the health monitoring service as a long-running process.
 * Can be run manually, via systemd, or as a background process.
 *
 * Usage:
 *   npm run health-monitor                    # Run with defaults
 *   npm run health-monitor -- --interval 5    # Check every 5 minutes
 *   npm run health-monitor -- --no-handoff    # Disable auto-handoff
 */

import { PSHealthMonitor } from '../monitoring/ps-health-monitor.js';

/**
 * Parse command line arguments
 */
interface CLIOptions {
  interval?: number; // Check interval in minutes
  stallThreshold?: number; // Stall threshold in minutes
  warningThreshold?: number; // Context warning threshold (0-100)
  criticalThreshold?: number; // Context critical threshold (0-100)
  noHandoff?: boolean; // Disable auto-handoff
  help?: boolean; // Show help
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--interval':
        options.interval = parseInt(args[++i], 10);
        break;
      case '--stall-threshold':
        options.stallThreshold = parseInt(args[++i], 10);
        break;
      case '--warning-threshold':
        options.warningThreshold = parseInt(args[++i], 10);
        break;
      case '--critical-threshold':
        options.criticalThreshold = parseInt(args[++i], 10);
        break;
      case '--no-handoff':
        options.noHandoff = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        console.error(`Unknown option: ${arg}`);
        process.exit(1);
    }
  }

  return options;
}

function showHelp(): void {
  console.log(`
PS Health Monitor - Automated health checking for Project Supervisors

Usage:
  npm run health-monitor [options]

Options:
  --interval <minutes>           Check interval in minutes (default: 10)
  --stall-threshold <minutes>    Spawn stall threshold in minutes (default: 15)
  --warning-threshold <percent>  Context warning threshold 0-100 (default: 70)
  --critical-threshold <percent> Context critical threshold 0-100 (default: 85)
  --no-handoff                   Disable automated handoff cycle
  --help, -h                     Show this help message

Examples:
  npm run health-monitor                        # Run with defaults (10 min interval)
  npm run health-monitor -- --interval 5        # Check every 5 minutes
  npm run health-monitor -- --stall-threshold 20  # 20 min stall threshold
  npm run health-monitor -- --no-handoff        # Disable auto-handoff

Requirements:
  - PostgreSQL database (supervisor_meta)
  - Project supervisors running in tmux sessions ({project}-ps)
  - Active spawns tracked in database

Phase 1 Support: CLI sessions only (tmux)
Phase 2: SDK/Browser sessions (coming soon)
`);
}

/**
 * Main function
 */
async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  console.log('\n=== PS Health Monitor ===\n');

  // Build configuration from CLI options
  const config: any = {};

  if (options.interval !== undefined) {
    config.checkInterval = options.interval * 60 * 1000;
    console.log(`Check interval: ${options.interval} minutes`);
  }

  if (options.stallThreshold !== undefined) {
    config.stallThresholdMinutes = options.stallThreshold;
    console.log(`Stall threshold: ${options.stallThreshold} minutes`);
  }

  if (options.warningThreshold !== undefined || options.criticalThreshold !== undefined) {
    config.contextThresholds = {
      warning: (options.warningThreshold || 70) / 100,
      critical: (options.criticalThreshold || 85) / 100,
    };
    console.log(`Context warning threshold: ${options.warningThreshold || 70}%`);
    console.log(`Context critical threshold: ${options.criticalThreshold || 85}%`);
  }

  if (options.noHandoff) {
    config.enableAutoHandoff = false;
    console.log('Auto-handoff: DISABLED');
  }

  console.log('');

  // Create and start monitor
  const monitor = new PSHealthMonitor(config);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\nReceived SIGINT, shutting down gracefully...');
    monitor.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n\nReceived SIGTERM, shutting down gracefully...');
    monitor.stop();
    process.exit(0);
  });

  // Start monitoring
  monitor.start();

  // Keep process alive
  console.log('Health monitor is running. Press Ctrl+C to stop.\n');
}

// Run main function
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
