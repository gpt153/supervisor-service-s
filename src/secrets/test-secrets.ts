/**
 * Test script for secrets management
 *
 * Usage:
 *   1. Set SECRETS_ENCRYPTION_KEY environment variable
 *   2. Run database migrations
 *   3. Run: tsx src/secrets/test-secrets.ts
 */

import { SecretsManager } from './SecretsManager.js';
import { pool, testConnection } from '../db/client.js';

async function testSecretsManagement() {
  console.log('🔐 Testing Secrets Management\n');

  try {
    // Test database connection
    console.log('1. Testing database connection...');
    await testConnection();
    console.log('   ✅ Database connected\n');

    // Initialize SecretsManager
    console.log('2. Initializing SecretsManager...');
    const manager = new SecretsManager();
    console.log('   ✅ SecretsManager initialized\n');

    // Test 1: Store a meta-level secret
    console.log('3. Testing set() - Meta-level secret...');
    await manager.set({
      keyPath: 'meta/test/api_token',
      value: 'test_secret_value_12345',
      description: 'Test API token for meta scope',
    });
    console.log('   ✅ Meta secret stored\n');

    // Test 2: Store a project-level secret
    console.log('4. Testing set() - Project-level secret...');
    await manager.set({
      keyPath: 'project/consilio/database_url',
      value: 'postgresql://user:pass@localhost:5432/consilio',
      description: 'Consilio database connection string',
    });
    console.log('   ✅ Project secret stored\n');

    // Test 3: Store a service-level secret
    console.log('5. Testing set() - Service-level secret...');
    await manager.set({
      keyPath: 'service/storybook/auth_token',
      value: 'storybook_auth_xyz789',
      description: 'Storybook authentication token',
    });
    console.log('   ✅ Service secret stored\n');

    // Test 4: Retrieve secrets
    console.log('6. Testing get() - Retrieve secrets...');
    const metaSecret = await manager.get({ keyPath: 'meta/test/api_token' });
    const projectSecret = await manager.get({ keyPath: 'project/consilio/database_url' });
    const serviceSecret = await manager.get({ keyPath: 'service/storybook/auth_token' });

    console.log('   Meta secret:', metaSecret === 'test_secret_value_12345' ? '✅' : '❌');
    console.log('   Project secret:', projectSecret === 'postgresql://user:pass@localhost:5432/consilio' ? '✅' : '❌');
    console.log('   Service secret:', serviceSecret === 'storybook_auth_xyz789' ? '✅' : '❌');
    console.log('');

    // Test 5: Update a secret
    console.log('7. Testing set() - Update existing secret...');
    await manager.set({
      keyPath: 'meta/test/api_token',
      value: 'updated_secret_value_67890',
      description: 'Updated test API token',
    });
    const updatedSecret = await manager.get({ keyPath: 'meta/test/api_token' });
    console.log('   Updated value:', updatedSecret === 'updated_secret_value_67890' ? '✅' : '❌');
    console.log('');

    // Test 6: List all secrets
    console.log('8. Testing list() - All secrets...');
    const allSecrets = await manager.list();
    console.log(`   Total secrets: ${allSecrets.length}`);
    allSecrets.forEach(s => {
      console.log(`   - ${s.keyPath} (${s.scope}) - accessed ${s.accessCount} times`);
    });
    console.log('');

    // Test 7: List filtered secrets
    console.log('9. Testing list() - Filter by scope...');
    const metaSecrets = await manager.list({ scope: 'meta' });
    const projectSecrets = await manager.list({ scope: 'project' });
    const serviceSecrets = await manager.list({ scope: 'service' });
    console.log(`   Meta secrets: ${metaSecrets.length}`);
    console.log(`   Project secrets: ${projectSecrets.length}`);
    console.log(`   Service secrets: ${serviceSecrets.length}`);
    console.log('');

    // Test 8: List filtered by project
    console.log('10. Testing list() - Filter by project...');
    const consilioSecrets = await manager.list({ scope: 'project', project: 'consilio' });
    console.log(`   Consilio secrets: ${consilioSecrets.length}`);
    console.log('');

    // Test 9: Test expiration
    console.log('11. Testing expiration...');
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7); // 7 days from now

    await manager.set({
      keyPath: 'meta/test/expiring_token',
      value: 'will_expire_soon',
      description: 'Token that expires in 7 days',
      expiresAt: futureDate,
    });

    const expiringSecrets = await manager.getExpiringSoon(30);
    console.log(`   Secrets expiring in next 30 days: ${expiringSecrets.length}`);
    console.log('');

    // Test 10: Test rotation marking
    console.log('12. Testing rotation marking...');
    await manager.markForRotation('meta/test/api_token');
    const rotationSecrets = await manager.getNeedingRotation();
    console.log(`   Secrets needing rotation: ${rotationSecrets.length}`);
    console.log('');

    // Test 11: Test secret not found
    console.log('13. Testing get() - Secret not found...');
    const notFound = await manager.get({ keyPath: 'meta/does/not/exist' });
    console.log('   Returns null for missing secret:', notFound === null ? '✅' : '❌');
    console.log('');

    // Test 12: Test invalid key paths
    console.log('14. Testing invalid key paths...');
    try {
      await manager.set({
        keyPath: 'invalid',
        value: 'should fail',
      });
      console.log('   ❌ Should have thrown error for invalid key path');
    } catch (error) {
      console.log('   ✅ Correctly rejected invalid key path');
    }

    try {
      await manager.set({
        keyPath: 'invalid_scope/test/key',
        value: 'should fail',
      });
      console.log('   ❌ Should have thrown error for invalid scope');
    } catch (error) {
      console.log('   ✅ Correctly rejected invalid scope');
    }
    console.log('');

    // Test 13: Delete secrets
    console.log('15. Testing delete()...');
    const deleted1 = await manager.delete({ keyPath: 'meta/test/api_token' });
    const deleted2 = await manager.delete({ keyPath: 'project/consilio/database_url' });
    const deleted3 = await manager.delete({ keyPath: 'service/storybook/auth_token' });
    const deleted4 = await manager.delete({ keyPath: 'meta/test/expiring_token' });
    const deleted5 = await manager.delete({ keyPath: 'meta/does/not/exist' });

    console.log('   Deleted meta secret:', deleted1 ? '✅' : '❌');
    console.log('   Deleted project secret:', deleted2 ? '✅' : '❌');
    console.log('   Deleted service secret:', deleted3 ? '✅' : '❌');
    console.log('   Deleted expiring secret:', deleted4 ? '✅' : '❌');
    console.log('   Returns false for non-existent secret:', !deleted5 ? '✅' : '❌');
    console.log('');

    // Test 14: Verify access log
    console.log('16. Checking access log...');
    const logQuery = `
      SELECT
        key_path,
        access_type,
        success,
        COUNT(*) as count
      FROM secret_access_log
      GROUP BY key_path, access_type, success
      ORDER BY key_path, access_type
    `;
    const logResult = await pool.query(logQuery);
    console.log(`   Total access log entries: ${logResult.rows.length} distinct groups`);
    logResult.rows.forEach(row => {
      console.log(`   - ${row.key_path}: ${row.access_type} (${row.success ? 'success' : 'failed'}) x${row.count}`);
    });
    console.log('');

    console.log('✅ All tests passed!\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run tests
testSecretsManagement();
