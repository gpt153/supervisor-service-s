#!/usr/bin/env tsx

/**
 * Daily Usage Snapshot Collection Script
 * Run this via cron at midnight UTC daily
 *
 * Cron example:
 * 0 0 * * * cd /home/samuel/sv/supervisor-service-s && npm run collect-snapshots
 */

import { UsageMonitor } from '../monitoring/UsageMonitor.js';

const usageMonitor = new UsageMonitor();

async function main() {
  console.log('🔄 Starting daily usage snapshot collection...');
  console.log(`Time: ${new Date().toISOString()}`);

  try {
    await usageMonitor.collectDailySnapshot();
    console.log('✅ Daily snapshot collection complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Snapshot collection failed:', error);
    process.exit(1);
  }
}

main();
