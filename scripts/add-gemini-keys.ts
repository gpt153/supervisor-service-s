#!/usr/bin/env tsx
/**
 * Add Gemini API keys to both secrets manager and rotation database
 */

import { SecretsManager } from '../src/secrets/SecretsManager.js';
import { GeminiKeyManager } from '../src/agents/multi/GeminiKeyManager.js';

async function main() {
  const secretsManager = new SecretsManager();
  const keyManager = new GeminiKeyManager();

  const keys = [
    {
      keyName: 'samodinson153',
      apiKey: 'AIzaSyD2QTgO6tsZEAzloC9v2IhnLlSqoYs-gYw',
      accountEmail: 'samodinson153@gmail.com',
      description: 'Gemini API key for samodinson153 account',
    },
    {
      keyName: 'klackberg153',
      apiKey: 'AIzaSyA9A8Y719CFE9tXqcRos_-W9kMoLvO2158',
      accountEmail: 'klackberg153@gmail.com',
      description: 'Gemini API key for klackberg153 account',
    },
  ];

  console.log('Adding Gemini API keys...\n');

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];

    // Store in secrets manager
    const secretPath = `meta/gemini/${key.keyName}`;
    await secretsManager.set({
      keyPath: secretPath,
      value: key.apiKey,
      description: key.description,
    });
    console.log(`✅ Stored in secrets: ${secretPath}`);

    // Add to rotation database
    const keyId = await keyManager.addKey({
      keyName: key.keyName,
      apiKey: key.apiKey,
      accountEmail: key.accountEmail,
      dailyQuota: 1000000, // 1M tokens/day
      priority: i, // Priority based on order
      notes: key.description,
    });
    console.log(`✅ Added to rotation: ID=${keyId}, priority=${i}`);
    console.log();
  }

  // Verify keys added
  console.log('Verifying keys...\n');
  const allKeys = await keyManager.getAllKeys();

  console.log(`Total keys: ${allKeys.length}`);
  for (const key of allKeys) {
    console.log(`  - ${key.keyName}: ${key.remaining.toLocaleString()}/${key.dailyQuota.toLocaleString()} tokens (priority: ${key.priority})`);
  }

  console.log('\n✅ All keys added successfully!');
  process.exit(0);
}

main().catch((error) => {
  console.error('Error adding keys:', error);
  process.exit(1);
});
