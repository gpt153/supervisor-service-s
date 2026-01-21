/**
 * Daily Optimization Script
 *
 * Runs once per day to analyze subscription usage and generate recommendations.
 * Can be scheduled via cron or systemd timer.
 */

import { AutomatedAccountManager } from '../automation/AutomatedAccountManager.js';
import { SubscriptionOptimizer } from '../monitoring/SubscriptionOptimizer.js';

async function main() {
  console.log(`[${new Date().toISOString()}] Starting daily optimization analysis...`);

  const manager = new AutomatedAccountManager();
  const optimizer = new SubscriptionOptimizer();

  try {
    // Run optimization analysis
    await manager.runDailyOptimization();

    // Get and display recommendations
    const recommendations = await optimizer.getPendingRecommendations();

    console.log('\nOptimization Recommendations:');
    console.log('=============================');

    if (recommendations.length === 0) {
      console.log('\n✅ No optimization opportunities found. All tiers are optimal.');
    } else {
      const totalSavings = recommendations.reduce(
        (sum, r) => sum + (r.potential_savings || 0),
        0
      );

      console.log(`\n💰 Total Potential Savings: $${totalSavings.toFixed(2)}/month`);
      console.log(`📊 Recommendations: ${recommendations.length}\n`);

      for (const rec of recommendations) {
        console.log(`${rec.service.toUpperCase()}:`);
        console.log(`  Current: ${rec.current_tier} ($${rec.current_monthly_cost.toFixed(2)}/month)`);
        console.log(`  Recommended: ${rec.recommended_tier} ($${rec.recommended_monthly_cost?.toFixed(2)}/month)`);
        console.log(`  Savings: $${rec.potential_savings?.toFixed(2)}/month`);
        console.log(`  Confidence: ${((rec.confidence || 0) * 100).toFixed(0)}%`);
        console.log(`  Status: ${rec.status}`);
        console.log('');
      }

      console.log('\nTo execute recommendations, use MCP tools:');
      console.log('  - execute-tier-change');
      console.log('  - dismiss-recommendation');
    }

    // Get recent events
    const events = await manager.getRecentEvents(5);
    console.log('\nRecent Automation Events:');
    console.log('=========================');
    for (const event of events) {
      console.log(`  [${event.createdAt?.toISOString()}] ${event.eventType} - ${event.service || 'all'}`);
    }

    console.log(`\n[${new Date().toISOString()}] Daily optimization complete.`);
    process.exit(0);
  } catch (error) {
    console.error('Error during daily optimization:', error);
    process.exit(1);
  }
}

main();
