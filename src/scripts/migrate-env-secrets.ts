#!/usr/bin/env tsx
/**
 * Migrate project .env secrets to centralized secrets manager
 *
 * This script copies all secrets from project .env files into the
 * encrypted secrets manager for backup/continuity purposes.
 *
 * The original .env files are kept as-is.
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { SecretsManager } from '../secrets/SecretsManager.js';

interface EnvFile {
  projectName: string;
  filePath: string;
  description: string;
}

// Define all .env files to migrate
const ENV_FILES: EnvFile[] = [
  {
    projectName: 'consilio',
    filePath: '/home/samuel/sv/consilio-s/.env',
    description: 'Consilio project .env',
  },
  {
    projectName: 'odin',
    filePath: '/home/samuel/sv/odin-s/.env',
    description: 'Odin project .env',
  },
  {
    projectName: 'openhorizon',
    filePath: '/home/samuel/sv/openhorizon-s/backend/.env',
    description: 'OpenHorizon backend .env',
  },
  {
    projectName: 'health-agent',
    filePath: '/home/samuel/sv/health-agent-s/.env.production',
    description: 'Health-Agent production .env',
  },
];

/**
 * Parse .env file content into key-value pairs
 */
function parseEnvFile(content: string): Map<string, string> {
  const secrets = new Map<string, string>();
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines and comments
    if (!line || line.startsWith('#')) {
      continue;
    }

    // Parse KEY=VALUE
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match) {
      const [, key, value] = match;

      // Handle multi-line values (values ending with \)
      let fullValue = value;
      while (fullValue.endsWith('\\') && i < lines.length - 1) {
        i++;
        fullValue = fullValue.slice(0, -1) + '\n' + lines[i].trim();
      }

      // Remove surrounding quotes if present
      fullValue = fullValue.replace(/^["']|["']$/g, '');

      secrets.set(key, fullValue);
    }
  }

  return secrets;
}

/**
 * Migrate secrets from one .env file
 */
async function migrateEnvFile(
  envFile: EnvFile,
  secretsManager: SecretsManager
): Promise<{ success: number; failed: number; skipped: number }> {
  const stats = { success: 0, failed: 0, skipped: 0 };

  console.log(`\n📄 Migrating: ${envFile.filePath}`);
  console.log(`   Project: ${envFile.projectName}`);

  // Check if file exists
  if (!existsSync(envFile.filePath)) {
    console.log(`   ⚠️  File not found, skipping`);
    return stats;
  }

  // Read and parse file
  const content = await readFile(envFile.filePath, 'utf-8');
  const secrets = parseEnvFile(content);

  console.log(`   Found ${secrets.size} secrets to migrate`);

  // Migrate each secret
  for (const [key, value] of secrets) {
    // Skip empty values
    if (!value || value === '') {
      console.log(`   ⏭️  Skipping ${key} (empty value)`);
      stats.skipped++;
      continue;
    }

    // Skip placeholder values
    if (
      value.includes('CHANGE_ME') ||
      value.includes('TODO') ||
      value === 'placeholder' ||
      value === 'your-key-here'
    ) {
      console.log(`   ⏭️  Skipping ${key} (placeholder value)`);
      stats.skipped++;
      continue;
    }

    // Create key path: project/{project-name}/{key-lowercase}
    const keyPath = `project/${envFile.projectName}/${key.toLowerCase()}`;

    try {
      await secretsManager.set({
        keyPath,
        value,
        description: `${key} from ${envFile.description}`,
      });

      console.log(`   ✅ Stored: ${keyPath}`);
      stats.success++;
    } catch (error) {
      console.error(`   ❌ Failed: ${keyPath}`, error instanceof Error ? error.message : error);
      stats.failed++;
    }
  }

  return stats;
}

/**
 * Main migration function
 */
async function main() {
  console.log('🔐 Migrating .env secrets to centralized secrets manager\n');
  console.log('This will copy secrets to encrypted storage for backup/continuity.');
  console.log('Original .env files will remain unchanged.\n');

  const secretsManager = new SecretsManager();

  const totalStats = { success: 0, failed: 0, skipped: 0 };

  // Migrate each env file
  for (const envFile of ENV_FILES) {
    try {
      const stats = await migrateEnvFile(envFile, secretsManager);
      totalStats.success += stats.success;
      totalStats.failed += stats.failed;
      totalStats.skipped += stats.skipped;
    } catch (error) {
      console.error(`\n❌ Error migrating ${envFile.filePath}:`, error);
      totalStats.failed++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Migration Summary');
  console.log('='.repeat(60));
  console.log(`✅ Successfully migrated: ${totalStats.success} secrets`);
  console.log(`❌ Failed: ${totalStats.failed} secrets`);
  console.log(`⏭️  Skipped: ${totalStats.skipped} secrets`);
  console.log('='.repeat(60));

  if (totalStats.failed > 0) {
    console.log('\n⚠️  Some secrets failed to migrate. Check errors above.');
    process.exit(1);
  } else {
    console.log('\n🎉 All secrets migrated successfully!');
    process.exit(0);
  }
}

// Run migration
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
