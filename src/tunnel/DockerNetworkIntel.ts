/**
 * DockerNetworkIntel - Docker topology discovery and connectivity analysis
 *
 * Responsibilities:
 * - Discover Docker networks and containers
 * - Detect cloudflared location (host vs container)
 * - Determine optimal ingress targets (localhost vs container-name)
 * - Validate connectivity between cloudflared and services
 */

import Docker from 'dockerode';
import { TunnelDatabase } from './TunnelDatabase.js';
import type { DockerContainer, DockerNetwork, ConnectivityResult } from './types.js';

export class DockerNetworkIntel {
  private docker: Docker;
  private database: TunnelDatabase;
  private cloudflarednLocation: 'host' | 'container' | 'unknown' = 'unknown';
  private cloudflarednContainerId: string | null = null;
  private cloudflarednNetworks: string[] = [];
  private pollingInterval: NodeJS.Timeout | null = null;

  constructor(database: TunnelDatabase) {
    this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
    this.database = database;
  }

  /**
   * Initialize and start polling
   */
  async initialize(): Promise<void> {
    await this.detectCloudflarednLocation();
    await this.discoverAll();

    // Start polling every 60 seconds
    this.pollingInterval = setInterval(() => {
      this.discoverAll().catch(err => {
        console.error('Docker discovery error:', err);
      });
    }, 60000);
  }

  /**
   * Stop polling
   */
  stop(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Detect cloudflared location (host service or container)
   */
  private async detectCloudflarednLocation(): Promise<void> {
    try {
      // Check if cloudflared is running as a Docker container
      const containers = await this.docker.listContainers({ all: true });
      const cloudflarednContainer = containers.find(c =>
        c.Names.some(name => name.includes('cloudflared')) ||
        c.Image.includes('cloudflare/cloudflared')
      );

      if (cloudflarednContainer) {
        this.cloudflarednLocation = 'container';
        this.cloudflarednContainerId = cloudflarednContainer.Id;

        // Get container details to extract networks
        const container = this.docker.getContainer(cloudflarednContainer.Id);
        const info = await container.inspect();
        this.cloudflarednNetworks = Object.keys(info.NetworkSettings.Networks || {});

        console.log(`Cloudflared detected as container: ${cloudflarednContainer.Names[0]}`);
        console.log(`Cloudflared networks:`, this.cloudflarednNetworks);
      } else {
        // Assume cloudflared is running as host service (systemd)
        this.cloudflarednLocation = 'host';
        this.cloudflarednNetworks = [];
        console.log('Cloudflared detected as host service');
      }
    } catch (error) {
      console.error('Failed to detect cloudflared location:', error);
      // Default to host if detection fails
      this.cloudflarednLocation = 'host';
    }
  }

  /**
   * Discover all Docker networks and containers
   */
  async discoverAll(): Promise<void> {
    try {
      await this.discoverNetworks();
      await this.discoverContainers();
      this.database.cleanupStaleDockerData(5); // Clean up data not seen in 5 minutes
    } catch (error) {
      console.error('Docker discovery failed:', error);
      throw error;
    }
  }

  /**
   * Discover Docker networks
   */
  private async discoverNetworks(): Promise<void> {
    const networks = await this.docker.listNetworks();

    for (const network of networks) {
      this.database.upsertDockerNetwork(
        network.Id,
        network.Name,
        network.Driver
      );
    }
  }

  /**
   * Discover Docker containers
   */
  private async discoverContainers(): Promise<void> {
    const containers = await this.docker.listContainers({ all: false }); // Only running containers

    for (const container of containers) {
      const containerObj = this.docker.getContainer(container.Id);
      const info = await containerObj.inspect();

      // Extract project name from container name or labels
      const projectName = this.extractProjectName(info.Name, info.Config.Labels);

      // Upsert container
      const containerDbId = this.database.upsertDockerContainer(
        info.Id,
        info.Name.replace(/^\//, ''), // Remove leading slash
        info.Config.Image,
        info.State.Status,
        projectName
      );

      // Store network memberships
      const networks = info.NetworkSettings.Networks || {};
      for (const [networkName, networkInfo] of Object.entries(networks)) {
        const networkDbId = this.database.getNetworkIdByName(networkName);
        if (networkDbId) {
          const ipAddress = (networkInfo as any).IPAddress || null;
          this.database.setContainerNetwork(containerDbId, networkDbId, ipAddress);
        }
      }

      // Store port mappings
      const ports = info.NetworkSettings.Ports || {};
      for (const [portSpec, bindings] of Object.entries(ports)) {
        const match = portSpec.match(/^(\d+)\/(tcp|udp)$/);
        if (match) {
          const internalPort = parseInt(match[1], 10);
          const protocol = match[2];
          const hostPort = bindings && bindings[0] ? parseInt(bindings[0].HostPort, 10) : null;

          this.database.addContainerPort(containerDbId, internalPort, hostPort, protocol);
        }
      }
    }
  }

  /**
   * Extract project name from container name or labels
   */
  private extractProjectName(containerName: string, labels: Record<string, string>): string | null {
    // Check label first
    if (labels['com.supervisor.project']) {
      return labels['com.supervisor.project'];
    }

    // Parse from container name: {project}-{service} pattern
    const name = containerName.replace(/^\//, '');
    const parts = name.split('-');
    if (parts.length >= 2) {
      // Common patterns: consilio-web, odin-api, etc.
      const knownProjects = ['consilio', 'odin', 'openhorizon', 'health-agent', 'supervisor-service'];
      const firstPart = parts[0];
      if (knownProjects.includes(firstPart)) {
        return firstPart;
      }
    }

    return null;
  }

  /**
   * Determine connectivity and optimal target for a service
   */
  async determineTarget(projectName: string, targetPort: number): Promise<ConnectivityResult> {
    // Find container(s) listening on the target port
    const containers = this.database.findContainersByPort(targetPort);

    if (containers.length === 0) {
      // No container found - assume host-based service
      return {
        reachable: true,
        method: 'host-port',
        target: `http://localhost:${targetPort}`
      };
    }

    // Use the first container (ideally should match project)
    const container = containers.find(c => c.project_name === projectName) || containers[0];
    const containerName = container.container_name;
    const containerDbId = container.id;

    // Get container's networks
    const containerNetworks = this.database.getContainerNetworks(containerDbId);

    if (this.cloudflarednLocation === 'host') {
      // Cloudflared is on host - can only use localhost
      // Check if container has host port binding
      const ports = await this.getContainerPorts(containerDbId);
      const portMapping = ports.find(p => p.internal_port === targetPort);

      if (portMapping && portMapping.host_port) {
        return {
          reachable: true,
          method: 'host-port',
          target: `http://localhost:${portMapping.host_port}`
        };
      } else {
        return {
          reachable: false,
          method: 'unreachable',
          target: null,
          recommendation: `Container "${containerName}" does not expose port ${targetPort} to host. Options: (1) Add port mapping: -p ${targetPort}:${targetPort} (2) Run cloudflared in container and connect to same network`
        };
      }
    } else if (this.cloudflarednLocation === 'container') {
      // Cloudflared is in container - check for shared network
      const sharedNetworks = containerNetworks.filter(net => this.cloudflarednNetworks.includes(net));

      if (sharedNetworks.length > 0) {
        // Shared network - use container name (optimal)
        return {
          reachable: true,
          method: 'shared-network',
          target: `http://${containerName}:${targetPort}`
        };
      } else {
        // No shared network - check if port is exposed to host
        const ports = await this.getContainerPorts(containerDbId);
        const portMapping = ports.find(p => p.internal_port === targetPort);

        if (portMapping && portMapping.host_port) {
          return {
            reachable: true,
            method: 'host-port',
            target: `http://localhost:${portMapping.host_port}`
          };
        } else {
          return {
            reachable: false,
            method: 'unreachable',
            target: null,
            recommendation: `Container "${containerName}" is not reachable by cloudflared. Options: (1) Connect cloudflared to network: docker network connect ${containerNetworks[0] || '{network}'} cloudflared (2) Expose port: -p ${targetPort}:${targetPort}`
          };
        }
      }
    } else {
      // Unknown cloudflared location - default to localhost
      return {
        reachable: true,
        method: 'host-port',
        target: `http://localhost:${targetPort}`
      };
    }
  }

  /**
   * Get container ports from database
   */
  private async getContainerPorts(containerDbId: number): Promise<Array<{ internal_port: number; host_port: number | null; protocol: string }>> {
    return this.database.getContainerPorts(containerDbId);
  }

  /**
   * Get cloudflared location
   */
  getCloudflarednLocation(): 'host' | 'container' | 'unknown' {
    return this.cloudflarednLocation;
  }

  /**
   * Get cloudflared networks (if container)
   */
  getCloudflarednNetworks(): string[] {
    return this.cloudflarednNetworks;
  }

  /**
   * Force re-detection of cloudflared
   */
  async redetectCloudflared(): Promise<void> {
    await this.detectCloudflarednLocation();
  }
}
