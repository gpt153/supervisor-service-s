/**
 * GCloud Manager
 *
 * Manages Google Cloud VM instances across multiple projects/accounts.
 * Provides VM lifecycle operations, health monitoring, and automatic scaling.
 *
 * Based on: /home/samuel/sv/.bmad/infrastructure/gcloud-integration.md
 */

import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import type {
  ServiceAccountKey,
  VMInstance,
  VMListItem,
  VMHealth,
  CPUMetrics,
  MemoryMetrics,
  DiskMetrics,
  CreateVMOptions,
  GCloudProject,
  ScalingDecision,
  AutoScaleConfig,
} from './types.js';

/**
 * GCloudManager class
 *
 * Manages multiple GCloud projects with full access to Compute Engine,
 * Monitoring, Storage, and other GCloud services.
 */
export class GCloudManager {
  private projects: Map<string, GCloudProject>;

  constructor() {
    this.projects = new Map();
  }

  /**
   * Add a GCloud project (authenticate with service account)
   *
   * @param name - Friendly name for the project (e.g., 'vm-host', 'openhorizon')
   * @param serviceAccountKey - Service account JSON key
   * @throws Error if authentication fails
   */
  async addProject(name: string, serviceAccountKey: ServiceAccountKey): Promise<void> {
    try {
      // Create JWT auth client
      const auth = new JWT({
        email: serviceAccountKey.client_email,
        key: serviceAccountKey.private_key,
        scopes: [
          'https://www.googleapis.com/auth/cloud-platform', // Full access
          'https://www.googleapis.com/auth/compute',
          'https://www.googleapis.com/auth/monitoring',
          'https://www.googleapis.com/auth/devstorage.full_control',
        ],
      });

      // Test authentication
      await auth.authorize();

      // Initialize API clients
      const compute = google.compute({ version: 'v1', auth });
      const monitoring = google.monitoring({ version: 'v3', auth });
      const storage = google.storage({ version: 'v1', auth });
      const run = google.run({ version: 'v1', auth });

      // Store project configuration
      this.projects.set(name, {
        projectId: serviceAccountKey.project_id,
        auth,
        compute,
        monitoring,
        storage,
        run,
      });

      console.log(`✓ Added GCloud project: ${name} (${serviceAccountKey.project_id})`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to add GCloud project "${name}": ${errorMsg}`);
    }
  }

  /**
   * Remove a GCloud project
   *
   * @param name - Project name
   * @returns True if removed, false if not found
   */
  removeProject(name: string): boolean {
    return this.projects.delete(name);
  }

  /**
   * List configured projects
   *
   * @returns Array of project names
   */
  listProjects(): string[] {
    return Array.from(this.projects.keys());
  }

  /**
   * Get VM instance details
   *
   * @param project - Project name
   * @param zone - Zone (e.g., 'us-central1-a')
   * @param instanceName - VM instance name
   * @returns VM instance details
   * @throws Error if project not found or API call fails
   */
  async getVM(project: string, zone: string, instanceName: string): Promise<VMInstance> {
    const proj = this.getProject(project);

    try {
      const result = await proj.compute.instances.get({
        project: proj.projectId,
        zone,
        instance: instanceName,
      });

      const instance = result.data;

      // Parse machine type (e.g., "zones/us-central1-a/machineTypes/n1-standard-1")
      const machineTypeParts = instance.machineType.split('/');
      const machineType = machineTypeParts[machineTypeParts.length - 1];

      // Get machine type details for CPU/RAM
      const machineTypeDetails = await proj.compute.machineTypes.get({
        project: proj.projectId,
        zone,
        machineType,
      });

      const internalIP = instance.networkInterfaces?.[0]?.networkIP || '';
      const externalIP = instance.networkInterfaces?.[0]?.accessConfigs?.[0]?.natIP || '';

      // Calculate disk size
      const diskGB = instance.disks?.[0]?.diskSizeGb
        ? parseInt(instance.disks[0].diskSizeGb as string, 10)
        : 0;

      return {
        name: instance.name,
        status: instance.status as VMInstance['status'],
        zone,
        machineType,
        cpus: machineTypeDetails.data.guestCpus || 0,
        memoryMB: machineTypeDetails.data.memoryMb || 0,
        diskGB,
        internalIP,
        externalIP,
        createdAt: instance.creationTimestamp ? new Date(instance.creationTimestamp) : undefined,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get VM "${instanceName}": ${errorMsg}`);
    }
  }

  /**
   * Start a stopped VM
   *
   * @param project - Project name
   * @param zone - Zone
   * @param instanceName - VM instance name
   * @param waitForRunning - Wait for VM to reach RUNNING status (default: true)
   * @param timeoutSeconds - Timeout in seconds (default: 120)
   * @throws Error if operation fails or timeout occurs
   */
  async startVM(
    project: string,
    zone: string,
    instanceName: string,
    waitForRunning: boolean = true,
    timeoutSeconds: number = 120
  ): Promise<void> {
    const proj = this.getProject(project);

    try {
      await proj.compute.instances.start({
        project: proj.projectId,
        zone,
        instance: instanceName,
      });

      console.log(`Started VM: ${instanceName}`);

      if (waitForRunning) {
        await this.waitForVMStatus(project, zone, instanceName, 'RUNNING', timeoutSeconds);
        console.log(`VM ${instanceName} is now RUNNING`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to start VM "${instanceName}": ${errorMsg}`);
    }
  }

  /**
   * Stop a running VM
   *
   * @param project - Project name
   * @param zone - Zone
   * @param instanceName - VM instance name
   * @param waitForStopped - Wait for VM to reach TERMINATED status (default: true)
   * @param timeoutSeconds - Timeout in seconds (default: 120)
   * @throws Error if operation fails or timeout occurs
   */
  async stopVM(
    project: string,
    zone: string,
    instanceName: string,
    waitForStopped: boolean = true,
    timeoutSeconds: number = 120
  ): Promise<void> {
    const proj = this.getProject(project);

    try {
      await proj.compute.instances.stop({
        project: proj.projectId,
        zone,
        instance: instanceName,
      });

      console.log(`Stopped VM: ${instanceName}`);

      if (waitForStopped) {
        await this.waitForVMStatus(project, zone, instanceName, 'TERMINATED', timeoutSeconds);
        console.log(`VM ${instanceName} is now TERMINATED`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to stop VM "${instanceName}": ${errorMsg}`);
    }
  }

  /**
   * Resize VM (change machine type)
   *
   * Note: VM must be stopped before resizing. This method handles stop/resize/start automatically.
   *
   * @param project - Project name
   * @param zone - Zone
   * @param instanceName - VM instance name
   * @param newMachineType - New machine type (e.g., 'n1-standard-4')
   * @throws Error if operation fails
   */
  async resizeVM(
    project: string,
    zone: string,
    instanceName: string,
    newMachineType: string
  ): Promise<void> {
    const proj = this.getProject(project);

    try {
      // Get current VM status
      const vm = await this.getVM(project, zone, instanceName);
      const wasRunning = vm.status === 'RUNNING';

      console.log(`Resizing VM ${instanceName}: ${vm.machineType} → ${newMachineType}`);

      // Stop VM if running
      if (wasRunning) {
        console.log('Stopping VM for resize...');
        await this.stopVM(project, zone, instanceName);
      }

      // Change machine type
      await proj.compute.instances.setMachineType({
        project: proj.projectId,
        zone,
        instance: instanceName,
        requestBody: {
          machineType: `zones/${zone}/machineTypes/${newMachineType}`,
        },
      });

      console.log(`Changed machine type to ${newMachineType}`);

      // Restart VM if it was running
      if (wasRunning) {
        console.log('Restarting VM...');
        await this.startVM(project, zone, instanceName);
      }

      console.log(`✓ VM ${instanceName} resized successfully`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to resize VM "${instanceName}": ${errorMsg}`);
    }
  }

  /**
   * Create a new VM instance
   *
   * @param project - Project name
   * @param zone - Zone
   * @param options - VM creation options
   * @param waitForRunning - Wait for VM to be running (default: true)
   * @param timeoutSeconds - Timeout in seconds (default: 300)
   * @throws Error if creation fails
   */
  async createVM(
    project: string,
    zone: string,
    options: CreateVMOptions,
    waitForRunning: boolean = true,
    timeoutSeconds: number = 300
  ): Promise<void> {
    const proj = this.getProject(project);

    try {
      console.log(`Creating VM: ${options.name} (${options.machineType})`);

      await proj.compute.instances.insert({
        project: proj.projectId,
        zone,
        requestBody: {
          name: options.name,
          machineType: `zones/${zone}/machineTypes/${options.machineType}`,
          disks: [
            {
              boot: true,
              autoDelete: true,
              initializeParams: {
                sourceImage: `projects/${options.imageProject}/global/images/family/${options.imageFamily}`,
                diskSizeGb: options.diskSizeGB.toString(),
              },
            },
          ],
          networkInterfaces: [
            {
              network: 'global/networks/default',
              accessConfigs: [
                {
                  type: 'ONE_TO_ONE_NAT',
                  name: 'External NAT',
                },
              ],
            },
          ],
          tags: {
            items: options.networkTags || [],
          },
          metadata: options.metadata
            ? {
                items: Object.entries(options.metadata).map(([key, value]) => ({
                  key,
                  value,
                })),
              }
            : undefined,
          scheduling: {
            preemptible: options.preemptible || false,
            automaticRestart: options.autoRestart !== false,
          },
        },
      });

      console.log(`VM creation initiated: ${options.name}`);

      if (waitForRunning) {
        await this.waitForVMStatus(project, zone, options.name, 'RUNNING', timeoutSeconds);
        const vm = await this.getVM(project, zone, options.name);
        console.log(
          `✓ VM ${options.name} created successfully (IP: ${vm.externalIP || vm.internalIP})`
        );
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to create VM "${options.name}": ${errorMsg}`);
    }
  }

  /**
   * Delete a VM instance
   *
   * @param project - Project name
   * @param zone - Zone
   * @param instanceName - VM instance name
   * @throws Error if deletion fails
   */
  async deleteVM(project: string, zone: string, instanceName: string): Promise<void> {
    const proj = this.getProject(project);

    try {
      console.log(`Deleting VM: ${instanceName}`);

      await proj.compute.instances.delete({
        project: proj.projectId,
        zone,
        instance: instanceName,
      });

      console.log(`✓ VM ${instanceName} deleted successfully`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to delete VM "${instanceName}": ${errorMsg}`);
    }
  }

  /**
   * List VMs in project
   *
   * @param project - Project name
   * @param zone - Optional zone filter (if not provided, lists all zones)
   * @returns Array of VM summaries
   * @throws Error if listing fails
   */
  async listVMs(project: string, zone?: string): Promise<VMListItem[]> {
    const proj = this.getProject(project);

    try {
      if (zone) {
        // List VMs in specific zone
        const result = await proj.compute.instances.list({
          project: proj.projectId,
          zone,
        });

        return (result.data.items || []).map((instance: any) => ({
          name: instance.name || '',
          zone,
          status: instance.status || 'UNKNOWN',
          machineType: instance.machineType?.split('/').pop() || '',
        }));
      } else {
        // List VMs across all zones
        const result = await proj.compute.instances.aggregatedList({
          project: proj.projectId,
        });

        const vms: VMListItem[] = [];
        const items = result.data.items || {};

        for (const [zoneUrl, zoneData] of Object.entries(items)) {
          const zoneInstances = (zoneData as any).instances;
          if (!zoneInstances) continue;

          const zoneName = zoneUrl.split('/').pop() || '';

          for (const instance of zoneInstances) {
            vms.push({
              name: instance.name || '',
              zone: zoneName,
              status: instance.status || 'UNKNOWN',
              machineType: instance.machineType?.split('/').pop() || '',
            });
          }
        }

        return vms;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to list VMs in project "${project}": ${errorMsg}`);
    }
  }

  /**
   * Wait for VM to reach specific status
   *
   * @param project - Project name
   * @param zone - Zone
   * @param instanceName - VM instance name
   * @param targetStatus - Target status to wait for
   * @param timeoutSeconds - Timeout in seconds
   * @throws Error if timeout occurs or VM not found
   */
  private async waitForVMStatus(
    project: string,
    zone: string,
    instanceName: string,
    targetStatus: VMInstance['status'],
    timeoutSeconds: number
  ): Promise<void> {
    const startTime = Date.now();
    const pollInterval = 5000; // 5 seconds

    while (true) {
      try {
        const vm = await this.getVM(project, zone, instanceName);

        if (vm.status === targetStatus) {
          return;
        }

        // Check timeout
        const elapsed = (Date.now() - startTime) / 1000;
        if (elapsed > timeoutSeconds) {
          throw new Error(
            `Timeout waiting for VM ${instanceName} to reach status ${targetStatus} ` +
              `(current: ${vm.status}, elapsed: ${elapsed.toFixed(1)}s)`
          );
        }

        // Wait before next check
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      } catch (error) {
        // If VM not found yet (during creation), keep waiting
        if (error instanceof Error && error.message.includes('not found')) {
          const elapsed = (Date.now() - startTime) / 1000;
          if (elapsed > timeoutSeconds) {
            throw new Error(`Timeout waiting for VM ${instanceName} to be created`);
          }
          await new Promise((resolve) => setTimeout(resolve, pollInterval));
          continue;
        }
        throw error;
      }
    }
  }

  /**
   * Get project configuration
   *
   * @param name - Project name
   * @returns Project configuration
   * @throws Error if project not found
   */
  private getProject(name: string): GCloudProject {
    const proj = this.projects.get(name);
    if (!proj) {
      const available = Array.from(this.projects.keys()).join(', ');
      throw new Error(
        `Project "${name}" not configured. Available projects: ${available || '(none)'}`
      );
    }
    return proj;
  }
}
