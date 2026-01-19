/**
 * GCloud Integration Types
 *
 * Type definitions for Google Cloud VM management and monitoring.
 */

/**
 * Service account key JSON structure
 */
export interface ServiceAccountKey {
  type: 'service_account';
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

/**
 * VM instance details
 */
export interface VMInstance {
  name: string;
  status: 'RUNNING' | 'STOPPED' | 'TERMINATED' | 'PROVISIONING' | 'STAGING' | 'STOPPING';
  zone: string;
  machineType: string;
  cpus: number;
  memoryMB: number;
  diskGB: number;
  internalIP: string;
  externalIP: string;
  createdAt?: Date;
}

/**
 * VM list item (summary)
 */
export interface VMListItem {
  name: string;
  zone: string;
  status: string;
  machineType: string;
}

/**
 * CPU usage metrics
 */
export interface CPUMetrics {
  average: number;
  max: number;
  current: number;
}

/**
 * Memory usage metrics
 */
export interface MemoryMetrics {
  average: number;
  max: number;
  current: number;
}

/**
 * Disk usage metrics
 */
export interface DiskMetrics {
  totalGB: number;
  usedGB: number;
  freeGB: number;
  usedPercent: number;
}

/**
 * VM health status
 */
export interface VMHealth {
  cpu: CPUMetrics;
  memory: MemoryMetrics;
  disk: DiskMetrics;
  timestamp: Date;
}

/**
 * Create VM options
 */
export interface CreateVMOptions {
  name: string;
  machineType: string;
  diskSizeGB: number;
  imageFamily: string;
  imageProject: string;
  networkTags?: string[];
  metadata?: Record<string, string>;
  preemptible?: boolean;
  autoRestart?: boolean;
}

/**
 * GCloud project configuration
 */
export interface GCloudProject {
  projectId: string;
  auth: any; // JWT from google-auth-library
  compute: any; // Compute API client
  monitoring: any; // Monitoring API client
  storage?: any; // Storage API client
  run?: any; // Cloud Run API client
}

/**
 * Auto-scaling configuration
 */
export interface AutoScaleConfig {
  enabled: boolean;
  cpuThresholdPercent: number;
  cpuDurationMinutes: number;
  diskThresholdPercent: number;
  memoryThresholdPercent: number;
  scaleUpMachineType: string;
  notificationEmail?: string;
}

/**
 * Scaling decision
 */
export interface ScalingDecision {
  shouldScale: boolean;
  reason: string;
  currentMetrics: VMHealth;
  recommendedMachineType?: string;
  currentMachineType: string;
}

/**
 * GCloud operation result
 */
export interface GCloudOperationResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}
