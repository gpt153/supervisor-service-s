#!/usr/bin/env tsx
/**
 * Store production secrets in the centralized secrets manager
 */

import { SecretsManager } from '../secrets/SecretsManager.js';

async function main() {
  console.log('🔐 Storing production secrets in secrets manager...\n');

  const secretsManager = new SecretsManager();

  const secrets = [
    // Consilio production secrets
    {
      keyPath: 'project/consilio/db_password',
      value: 'CSY6tsfd9ed3NRuuTsIbxAbm8lqs1lp5VLbmEjebU88=',
      description: 'Production PostgreSQL password for Consilio',
    },
    {
      keyPath: 'project/consilio/jwt_secret',
      value: 'J/7NNjjTztP+CXvXKn2n30UcPeaIHYtCTXyBAP9Q8wGy4YANq4YgmPwIjwLUJ0GU',
      description: 'Production JWT signing secret for Consilio',
    },
    {
      keyPath: 'project/consilio/jwt_refresh_secret',
      value: '5enCh2PSv1OfY+xp1lEuvq3MvUf/vz8LrULyE+hKy3LnKqnAjvc1FWd6FWhypTB6',
      description: 'Production JWT refresh token secret for Consilio',
    },
    {
      keyPath: 'project/consilio/session_secret',
      value: 'LVsu/RtAJ/BXZri7Thtc7kJzRFmDt6NRyPlBUl4HbfuXIjMvSsKgsBMxaRC/YRy3',
      description: 'Production session secret for Consilio',
    },
    // Health-Agent USDA API key
    {
      keyPath: 'project/health-agent/usda_api_key',
      value: 'JGi9EFrDLdyFK4wvqa8Uoxjg1uagMnae4ICqI1Y6',
      description: 'USDA FoodData Central API key for nutrition verification',
    },
  ];

  let successCount = 0;
  let failCount = 0;

  for (const secret of secrets) {
    try {
      await secretsManager.set({
        keyPath: secret.keyPath,
        value: secret.value,
        description: secret.description,
      });
      console.log(`✅ Stored: ${secret.keyPath}`);
      successCount++;
    } catch (error) {
      console.error(`❌ Failed: ${secret.keyPath}`, error);
      failCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Successfully stored: ${successCount} secrets`);
  console.log(`❌ Failed: ${failCount} secrets`);
  console.log('='.repeat(60));

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
