#!/usr/bin/env tsx
/**
 * CLI tool to retrieve secrets from the vault
 *
 * Usage: tsx get-secret-cli.ts <key-path>
 * Example: tsx get-secret-cli.ts project/consilio/backup-encryption-key
 */

import { SecretsManager } from '../secrets/index.js';

async function main() {
  const keyPath = process.argv[2];

  if (!keyPath) {
    console.error('Usage: tsx get-secret-cli.ts <key-path>');
    console.error('Example: tsx get-secret-cli.ts project/consilio/backup-encryption-key');
    process.exit(1);
  }

  try {
    const manager = new SecretsManager();
    const value = await manager.get({ keyPath });

    if (value === null) {
      console.error(`Secret not found: ${keyPath}`);
      process.exit(1);
    }

    // Output only the secret value (no extra formatting) for use in scripts
    console.log(value);
    process.exit(0);
  } catch (error) {
    console.error(`Error retrieving secret: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

main();
