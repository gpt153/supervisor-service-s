/**
 * GCloud Integration Module
 *
 * Provides Google Cloud VM management, health monitoring, and auto-scaling.
 *
 * Usage:
 *   import { initializeGCloud } from './gcloud/index.js';
 *   const gcloud = await initializeGCloud(secretsManager);
 */

import { GCloudManager } from './GCloudManager.js';
import { HealthMonitor } from './HealthMonitor.js';
import { AutoScaler } from './AutoScaler.js';
import type { SecretsManager } from '../secrets/SecretsManager.js';
import type { ServiceAccountKey } from './types.js';

export { GCloudManager } from './GCloudManager.js';
export { HealthMonitor } from './HealthMonitor.js';
export { AutoScaler } from './AutoScaler.js';
export * from './types.js';

/**
 * GCloud service container
 */
export interface GCloudServices {
  manager: GCloudManager;
  health: HealthMonitor;
  scaler: AutoScaler;
}

/**
 * Initialize GCloud services with projects from secrets
 *
 * Loads service account keys from the secrets manager and initializes
 * all GCloud services (manager, health monitor, auto-scaler).
 *
 * @param secretsManager - Secrets manager instance
 * @returns GCloud services
 * @throws Error if initialization fails
 */
export async function initializeGCloud(
  secretsManager: SecretsManager
): Promise<GCloudServices> {
  const manager = new GCloudManager();
  const health = new HealthMonitor(manager);
  const scaler = new AutoScaler(manager, health);

  // Load all GCloud service account keys from secrets
  const secrets = await secretsManager.list({ scope: 'meta' });

  const gcloudSecrets = secrets.filter((s) => s.keyPath.startsWith('meta/gcloud/'));

  console.log(`Loading ${gcloudSecrets.length} GCloud service account(s)...`);

  for (const secret of gcloudSecrets) {
    try {
      // Extract project name from key path (e.g., meta/gcloud/vm_host_key -> vm_host)
      const keyName = secret.keyPath.split('/').pop() || '';
      const projectName = keyName.replace(/_key$/, '').replace(/_/g, '-');

      // Get the service account key
      const keyJson = await secretsManager.get({ keyPath: secret.keyPath });

      if (!keyJson) {
        console.warn(`Skipping ${secret.keyPath}: empty value`);
        continue;
      }

      const serviceAccountKey: ServiceAccountKey = JSON.parse(keyJson);

      // Add project to GCloud manager
      await manager.addProject(projectName, serviceAccountKey);
    } catch (error) {
      console.error(`Failed to load GCloud project from ${secret.keyPath}:`, error);
      // Continue loading other projects even if one fails
    }
  }

  const loadedProjects = manager.listProjects();
  if (loadedProjects.length === 0) {
    console.warn(
      'No GCloud projects loaded. Add service account keys with: mcp__meta__set_secret'
    );
  } else {
    console.log(`✓ Loaded ${loadedProjects.length} GCloud project(s): ${loadedProjects.join(', ')}`);
  }

  return { manager, health, scaler };
}

/**
 * Manually add a GCloud project
 *
 * @param services - GCloud services
 * @param secretsManager - Secrets manager
 * @param projectName - Friendly project name
 * @param keyPath - Secret key path for service account
 * @throws Error if project cannot be added
 */
export async function addGCloudProject(
  services: GCloudServices,
  secretsManager: SecretsManager,
  projectName: string,
  keyPath: string
): Promise<void> {
  const keyJson = await secretsManager.get({ keyPath });

  if (!keyJson) {
    throw new Error(`Service account key not found: ${keyPath}`);
  }

  const serviceAccountKey: ServiceAccountKey = JSON.parse(keyJson);
  await services.manager.addProject(projectName, serviceAccountKey);

  console.log(`✓ Added GCloud project: ${projectName}`);
}
