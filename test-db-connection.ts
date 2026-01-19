#!/usr/bin/env tsx
/**
 * Test database connection
 */

import { testConnection, closePool } from './src/db/client.js';

async function main() {
  console.log('Testing database connection...');
  try {
    await testConnection();
    console.log('✅ Connection test passed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection test failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

main();
