/**
 * VM Health Monitor
 *
 * Monitors VM health metrics (CPU, memory, disk) using Google Cloud Monitoring API.
 * Provides historical metrics and health status checks.
 */

import type { GCloudManager } from './GCloudManager.js';
import type {
  VMHealth,
  CPUMetrics,
  MemoryMetrics,
  DiskMetrics,
  GCloudProject,
} from './types.js';

/**
 * HealthMonitor class
 *
 * Fetches and analyzes VM health metrics from Google Cloud Monitoring.
 */
export class HealthMonitor {
  constructor(private gcloudManager: GCloudManager) {}

  /**
   * Get comprehensive VM health status
   *
   * @param project - Project name
   * @param zone - Zone
   * @param instanceName - VM instance name
   * @param minutes - Time window in minutes (default: 60)
   * @returns VM health metrics
   * @throws Error if metrics cannot be retrieved
   */
  async getVMHealth(
    project: string,
    zone: string,
    instanceName: string,
    minutes: number = 60
  ): Promise<VMHealth> {
    try {
      const [cpu, memory, disk] = await Promise.all([
        this.getCPUUsage(project, zone, instanceName, minutes),
        this.getMemoryUsage(project, zone, instanceName, minutes),
        this.getDiskUsage(project, zone, instanceName),
      ]);

      return {
        cpu,
        memory,
        disk,
        timestamp: new Date(),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get VM health for "${instanceName}": ${errorMsg}`);
    }
  }

  /**
   * Get CPU usage metrics
   *
   * @param project - Project name
   * @param zone - Zone
   * @param instanceName - VM instance name
   * @param minutes - Time window in minutes
   * @returns CPU metrics (percentage: 0-100)
   * @throws Error if metrics cannot be retrieved
   */
  async getCPUUsage(
    project: string,
    zone: string,
    instanceName: string,
    minutes: number = 60
  ): Promise<CPUMetrics> {
    const proj = (this.gcloudManager as any).getProject(project);

    try {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - minutes * 60 * 1000);

      const result = await proj.monitoring.projects.timeSeries.list({
        name: `projects/${proj.projectId}`,
        filter: `metric.type="compute.googleapis.com/instance/cpu/utilization" AND resource.labels.instance_name="${instanceName}"`,
        'interval.startTime': startTime.toISOString(),
        'interval.endTime': endTime.toISOString(),
        'aggregation.alignmentPeriod': '60s',
        'aggregation.perSeriesAligner': 'ALIGN_MEAN',
      });

      const timeSeries = result.data.timeSeries?.[0];
      if (!timeSeries || !timeSeries.points || timeSeries.points.length === 0) {
        // No data available (VM might be stopped or monitoring agent not installed)
        return { average: 0, max: 0, current: 0 };
      }

      // Convert from 0-1 to percentage (0-100)
      const values = timeSeries.points.map((p: any) => (p.value?.doubleValue || 0) * 100);

      return {
        average: values.reduce((a: number, b: number) => a + b, 0) / values.length,
        max: Math.max(...values),
        current: values[values.length - 1] || 0,
      };
    } catch (error) {
      // If monitoring data not available, return zeros instead of failing
      console.warn(`CPU metrics unavailable for ${instanceName}:`, error);
      return { average: 0, max: 0, current: 0 };
    }
  }

  /**
   * Get memory usage metrics
   *
   * Note: Requires Cloud Monitoring agent to be installed on VM.
   *
   * @param project - Project name
   * @param zone - Zone
   * @param instanceName - VM instance name
   * @param minutes - Time window in minutes
   * @returns Memory metrics (percentage: 0-100)
   * @throws Error if metrics cannot be retrieved
   */
  async getMemoryUsage(
    project: string,
    zone: string,
    instanceName: string,
    minutes: number = 60
  ): Promise<MemoryMetrics> {
    const proj = (this.gcloudManager as any).getProject(project);

    try {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - minutes * 60 * 1000);

      // Try new agent metrics first
      let result = await proj.monitoring.projects.timeSeries.list({
        name: `projects/${proj.projectId}`,
        filter: `metric.type="agent.googleapis.com/memory/percent_used" AND resource.labels.instance_id="${instanceName}"`,
        'interval.startTime': startTime.toISOString(),
        'interval.endTime': endTime.toISOString(),
        'aggregation.alignmentPeriod': '60s',
        'aggregation.perSeriesAligner': 'ALIGN_MEAN',
      });

      let timeSeries = result.data.timeSeries?.[0];

      // Fallback to legacy metrics if new agent not available
      if (!timeSeries || !timeSeries.points || timeSeries.points.length === 0) {
        result = await proj.monitoring.projects.timeSeries.list({
          name: `projects/${proj.projectId}`,
          filter: `metric.type="compute.googleapis.com/instance/memory/balloon/ram_used" AND resource.labels.instance_name="${instanceName}"`,
          'interval.startTime': startTime.toISOString(),
          'interval.endTime': endTime.toISOString(),
          'aggregation.alignmentPeriod': '60s',
          'aggregation.perSeriesAligner': 'ALIGN_MEAN',
        });

        timeSeries = result.data.timeSeries?.[0];
      }

      if (!timeSeries || !timeSeries.points || timeSeries.points.length === 0) {
        // No monitoring agent installed
        return { average: 0, max: 0, current: 0 };
      }

      const values = timeSeries.points.map((p: any) => p.value?.doubleValue || 0);

      return {
        average: values.reduce((a: number, b: number) => a + b, 0) / values.length,
        max: Math.max(...values),
        current: values[values.length - 1] || 0,
      };
    } catch (error) {
      console.warn(`Memory metrics unavailable for ${instanceName}:`, error);
      return { average: 0, max: 0, current: 0 };
    }
  }

  /**
   * Get disk usage metrics
   *
   * Note: Requires Cloud Monitoring agent to be installed on VM.
   *
   * @param project - Project name
   * @param zone - Zone
   * @param instanceName - VM instance name
   * @returns Disk metrics
   * @throws Error if metrics cannot be retrieved
   */
  async getDiskUsage(
    project: string,
    zone: string,
    instanceName: string
  ): Promise<DiskMetrics> {
    const proj = (this.gcloudManager as any).getProject(project);

    try {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 5 * 60 * 1000); // Last 5 minutes

      const result = await proj.monitoring.projects.timeSeries.list({
        name: `projects/${proj.projectId}`,
        filter: `metric.type="agent.googleapis.com/disk/percent_used" AND resource.labels.instance_id="${instanceName}"`,
        'interval.startTime': startTime.toISOString(),
        'interval.endTime': endTime.toISOString(),
      });

      const timeSeries = result.data.timeSeries?.[0];
      if (!timeSeries || !timeSeries.points || timeSeries.points.length === 0) {
        // Fallback: Get disk size from VM config
        const vm = await this.gcloudManager.getVM(project, zone, instanceName);
        return {
          totalGB: vm.diskGB,
          usedGB: 0,
          freeGB: vm.diskGB,
          usedPercent: 0,
        };
      }

      const usedPercent = timeSeries.points[timeSeries.points.length - 1].value?.doubleValue || 0;
      const vm = await this.gcloudManager.getVM(project, zone, instanceName);
      const totalGB = vm.diskGB;
      const usedGB = (totalGB * usedPercent) / 100;

      return {
        totalGB,
        usedGB,
        freeGB: totalGB - usedGB,
        usedPercent,
      };
    } catch (error) {
      // If monitoring not available, get disk size only
      try {
        const vm = await this.gcloudManager.getVM(project, zone, instanceName);
        return {
          totalGB: vm.diskGB,
          usedGB: 0,
          freeGB: vm.diskGB,
          usedPercent: 0,
        };
      } catch (vmError) {
        throw new Error(`Failed to get disk metrics: ${error}`);
      }
    }
  }

  /**
   * Check if VM needs attention (high CPU, memory, or disk usage)
   *
   * @param health - VM health metrics
   * @param thresholds - Optional custom thresholds
   * @returns Array of warning messages (empty if healthy)
   */
  checkHealthWarnings(
    health: VMHealth,
    thresholds: {
      cpu?: number;
      memory?: number;
      disk?: number;
    } = {}
  ): string[] {
    const warnings: string[] = [];

    const cpuThreshold = thresholds.cpu || 80;
    const memoryThreshold = thresholds.memory || 85;
    const diskThreshold = thresholds.disk || 85;

    if (health.cpu.average > cpuThreshold) {
      warnings.push(
        `High CPU usage: ${health.cpu.average.toFixed(1)}% average (threshold: ${cpuThreshold}%)`
      );
    }

    if (health.memory.average > memoryThreshold) {
      warnings.push(
        `High memory usage: ${health.memory.average.toFixed(1)}% average (threshold: ${memoryThreshold}%)`
      );
    }

    if (health.disk.usedPercent > diskThreshold) {
      warnings.push(
        `Disk almost full: ${health.disk.usedPercent.toFixed(1)}% used (threshold: ${diskThreshold}%)`
      );
    }

    return warnings;
  }

  /**
   * Format health metrics as human-readable string
   *
   * @param health - VM health metrics
   * @returns Formatted string
   */
  formatHealthReport(health: VMHealth): string {
    const lines = [
      `VM Health Report (${health.timestamp.toISOString()})`,
      '',
      'CPU Usage:',
      `  Current: ${health.cpu.current.toFixed(1)}%`,
      `  Average: ${health.cpu.average.toFixed(1)}%`,
      `  Peak: ${health.cpu.max.toFixed(1)}%`,
      '',
      'Memory Usage:',
      `  Current: ${health.memory.current.toFixed(1)}%`,
      `  Average: ${health.memory.average.toFixed(1)}%`,
      `  Peak: ${health.memory.max.toFixed(1)}%`,
      '',
      'Disk Usage:',
      `  Used: ${health.disk.usedGB.toFixed(1)} GB / ${health.disk.totalGB} GB (${health.disk.usedPercent.toFixed(1)}%)`,
      `  Free: ${health.disk.freeGB.toFixed(1)} GB`,
    ];

    const warnings = this.checkHealthWarnings(health);
    if (warnings.length > 0) {
      lines.push('', 'Warnings:');
      warnings.forEach((warning) => lines.push(`  - ${warning}`));
    }

    return lines.join('\n');
  }
}
