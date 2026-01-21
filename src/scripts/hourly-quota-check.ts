/**
 * Hourly Quota Check Script
 *
 * Runs every hour to check API key quotas and trigger alerts.
 * Can be scheduled via cron or systemd timer.
 */

import { AutomatedAccountManager } from '../automation/AutomatedAccountManager.js';

async function main() {
  console.log(`[${new Date().toISOString()}] Starting hourly quota check...`);

  const manager = new AutomatedAccountManager();

  try {
    const results = await manager.checkAllQuotas();

    console.log('\nQuota Check Results:');
    console.log('====================');

    for (const result of results) {
      console.log(`\n${result.service.toUpperCase()}:`);
      console.log(`  Active Keys: ${result.activeKeys}`);
      console.log(`  Total Quota: ${result.totalQuota.toLocaleString()} tokens`);
      console.log(`  Used: ${result.usedQuota.toLocaleString()} tokens`);
      console.log(`  Remaining: ${result.remainingQuota.toLocaleString()} tokens`);
      console.log(`  Usage: ${result.usagePercentage.toFixed(1)}%`);
      console.log(`  Needs Expansion: ${result.needsExpansion ? 'YES ⚠️' : 'No'}`);

      // If quota is critical, trigger key creation workflow
      if (result.usagePercentage >= 95) {
        console.log(`\n  🚨 CRITICAL: Triggering key creation workflow...`);
        const workflow = await manager.triggerKeyCreation(result.service as 'gemini' | 'claude');
        console.log(`  ${workflow.message}`);
        if (workflow.workflow) {
          console.log(`  Next Steps:`);
          workflow.workflow.nextSteps.forEach((step, i) => {
            console.log(`    ${step}`);
          });
        }
      }
    }

    console.log(`\n[${new Date().toISOString()}] Quota check complete.`);
    process.exit(0);
  } catch (error) {
    console.error('Error during quota check:', error);
    process.exit(1);
  }
}

main();
