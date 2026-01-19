/**
 * Auto Scaler
 *
 * Implements automatic VM scaling based on health metrics.
 * Monitors VMs and scales up when resource usage exceeds thresholds.
 */

import type { GCloudManager } from './GCloudManager.js';
import type { HealthMonitor } from './HealthMonitor.js';
import type { AutoScaleConfig, ScalingDecision, VMHealth } from './types.js';

/**
 * Machine type tiers for auto-scaling
 */
const MACHINE_TYPE_TIERS = [
  { type: 'e2-micro', cpus: 2, memoryMB: 1024 },
  { type: 'e2-small', cpus: 2, memoryMB: 2048 },
  { type: 'e2-medium', cpus: 2, memoryMB: 4096 },
  { type: 'n1-standard-1', cpus: 1, memoryMB: 3840 },
  { type: 'n1-standard-2', cpus: 2, memoryMB: 7680 },
  { type: 'n1-standard-4', cpus: 4, memoryMB: 15360 },
  { type: 'n1-standard-8', cpus: 8, memoryMB: 30720 },
  { type: 'n1-standard-16', cpus: 16, memoryMB: 61440 },
];

/**
 * Default auto-scale configuration
 */
const DEFAULT_CONFIG: AutoScaleConfig = {
  enabled: true,
  cpuThresholdPercent: 80,
  cpuDurationMinutes: 120, // 2 hours
  diskThresholdPercent: 85,
  memoryThresholdPercent: 85,
  scaleUpMachineType: 'n1-standard-4',
};

/**
 * AutoScaler class
 *
 * Monitors VM health and automatically scales up when thresholds are exceeded.
 */
export class AutoScaler {
  constructor(
    private gcloudManager: GCloudManager,
    private healthMonitor: HealthMonitor
  ) {}

  /**
   * Evaluate if VM should be scaled
   *
   * @param project - Project name
   * @param zone - Zone
   * @param instanceName - VM instance name
   * @param config - Auto-scale configuration
   * @returns Scaling decision
   * @throws Error if evaluation fails
   */
  async evaluateScaling(
    project: string,
    zone: string,
    instanceName: string,
    config: Partial<AutoScaleConfig> = {}
  ): Promise<ScalingDecision> {
    const fullConfig = { ...DEFAULT_CONFIG, ...config };

    if (!fullConfig.enabled) {
      return {
        shouldScale: false,
        reason: 'Auto-scaling is disabled',
        currentMetrics: await this.healthMonitor.getVMHealth(
          project,
          zone,
          instanceName,
          fullConfig.cpuDurationMinutes
        ),
        currentMachineType: (await this.gcloudManager.getVM(project, zone, instanceName))
          .machineType,
      };
    }

    // Get current VM info
    const vm = await this.gcloudManager.getVM(project, zone, instanceName);

    // Get health metrics for the configured duration
    const health = await this.healthMonitor.getVMHealth(
      project,
      zone,
      instanceName,
      fullConfig.cpuDurationMinutes
    );

    // Check CPU threshold
    if (health.cpu.average > fullConfig.cpuThresholdPercent) {
      const nextTier = this.getNextMachineType(vm.machineType);
      return {
        shouldScale: true,
        reason: `CPU usage (${health.cpu.average.toFixed(1)}%) exceeded threshold (${fullConfig.cpuThresholdPercent}%) for ${fullConfig.cpuDurationMinutes} minutes`,
        currentMetrics: health,
        currentMachineType: vm.machineType,
        recommendedMachineType: nextTier || fullConfig.scaleUpMachineType,
      };
    }

    // Check memory threshold
    if (health.memory.average > fullConfig.memoryThresholdPercent) {
      const nextTier = this.getNextMachineType(vm.machineType);
      return {
        shouldScale: true,
        reason: `Memory usage (${health.memory.average.toFixed(1)}%) exceeded threshold (${fullConfig.memoryThresholdPercent}%)`,
        currentMetrics: health,
        currentMachineType: vm.machineType,
        recommendedMachineType: nextTier || fullConfig.scaleUpMachineType,
      };
    }

    // Check disk threshold (alert only, don't auto-scale)
    if (health.disk.usedPercent > fullConfig.diskThresholdPercent) {
      return {
        shouldScale: false,
        reason: `Disk usage (${health.disk.usedPercent.toFixed(1)}%) exceeded threshold (${fullConfig.diskThresholdPercent}%). Manual intervention required to expand disk.`,
        currentMetrics: health,
        currentMachineType: vm.machineType,
      };
    }

    return {
      shouldScale: false,
      reason: 'All metrics within normal range',
      currentMetrics: health,
      currentMachineType: vm.machineType,
    };
  }

  /**
   * Automatically scale VM if needed
   *
   * @param project - Project name
   * @param zone - Zone
   * @param instanceName - VM instance name
   * @param config - Auto-scale configuration
   * @returns Scaling decision with execution result
   * @throws Error if scaling fails
   */
  async autoScale(
    project: string,
    zone: string,
    instanceName: string,
    config: Partial<AutoScaleConfig> = {}
  ): Promise<ScalingDecision & { scaled: boolean }> {
    const decision = await this.evaluateScaling(project, zone, instanceName, config);

    if (!decision.shouldScale) {
      return { ...decision, scaled: false };
    }

    if (!decision.recommendedMachineType) {
      console.warn(`No recommended machine type for ${instanceName}, skipping scale`);
      return { ...decision, scaled: false };
    }

    try {
      console.log(
        `Auto-scaling ${instanceName}: ${decision.currentMachineType} → ${decision.recommendedMachineType}`
      );
      console.log(`Reason: ${decision.reason}`);

      await this.gcloudManager.resizeVM(
        project,
        zone,
        instanceName,
        decision.recommendedMachineType
      );

      console.log(`✓ Successfully scaled ${instanceName} to ${decision.recommendedMachineType}`);
      return { ...decision, scaled: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to auto-scale ${instanceName}:`, errorMsg);
      throw new Error(`Auto-scale failed: ${errorMsg}`);
    }
  }

  /**
   * Monitor multiple VMs and auto-scale if needed
   *
   * This method should be called periodically (e.g., hourly via cron).
   *
   * @param vms - Array of VMs to monitor
   * @param config - Auto-scale configuration
   * @returns Summary of scaling actions
   */
  async monitorAndScale(
    vms: Array<{ project: string; zone: string; instanceName: string }>,
    config: Partial<AutoScaleConfig> = {}
  ): Promise<{
    checked: number;
    scaled: number;
    alerts: string[];
  }> {
    const alerts: string[] = [];
    let scaledCount = 0;

    console.log(`Monitoring ${vms.length} VMs for auto-scaling...`);

    for (const vm of vms) {
      try {
        const result = await this.autoScale(vm.project, vm.zone, vm.instanceName, config);

        if (result.scaled) {
          scaledCount++;
          alerts.push(
            `Scaled ${vm.instanceName}: ${result.currentMachineType} → ${result.recommendedMachineType} (${result.reason})`
          );
        } else if (result.reason.includes('Disk usage')) {
          // Alert for disk issues (manual intervention needed)
          alerts.push(`${vm.instanceName}: ${result.reason}`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        alerts.push(`Failed to check ${vm.instanceName}: ${errorMsg}`);
        console.error(`Error monitoring ${vm.instanceName}:`, errorMsg);
      }
    }

    console.log(`Auto-scale check complete: ${scaledCount} VMs scaled, ${alerts.length} alerts`);

    return {
      checked: vms.length,
      scaled: scaledCount,
      alerts,
    };
  }

  /**
   * Get next machine type tier for scaling up
   *
   * @param currentType - Current machine type
   * @returns Next tier machine type, or null if already at max
   */
  private getNextMachineType(currentType: string): string | null {
    const currentIndex = MACHINE_TYPE_TIERS.findIndex((tier) => tier.type === currentType);

    if (currentIndex === -1) {
      // Unknown machine type, default to n1-standard-2
      return 'n1-standard-2';
    }

    if (currentIndex >= MACHINE_TYPE_TIERS.length - 1) {
      // Already at highest tier
      return null;
    }

    return MACHINE_TYPE_TIERS[currentIndex + 1].type;
  }

  /**
   * Get machine type tier for scaling down
   *
   * @param currentType - Current machine type
   * @returns Previous tier machine type, or null if already at minimum
   */
  private getPreviousMachineType(currentType: string): string | null {
    const currentIndex = MACHINE_TYPE_TIERS.findIndex((tier) => tier.type === currentType);

    if (currentIndex <= 0) {
      return null;
    }

    return MACHINE_TYPE_TIERS[currentIndex - 1].type;
  }

  /**
   * Suggest machine type based on target CPU/memory requirements
   *
   * @param targetCPUs - Desired number of CPUs
   * @param targetMemoryGB - Desired memory in GB
   * @returns Recommended machine type
   */
  suggestMachineType(targetCPUs: number, targetMemoryGB: number): string {
    const targetMemoryMB = targetMemoryGB * 1024;

    // Find smallest machine type that meets requirements
    for (const tier of MACHINE_TYPE_TIERS) {
      if (tier.cpus >= targetCPUs && tier.memoryMB >= targetMemoryMB) {
        return tier.type;
      }
    }

    // If no match, return highest tier
    return MACHINE_TYPE_TIERS[MACHINE_TYPE_TIERS.length - 1].type;
  }
}
