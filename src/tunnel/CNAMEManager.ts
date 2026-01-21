/**
 * CNAMEManager - CNAME lifecycle management
 *
 * Responsibilities:
 * - Validate CNAME requests (port allocation, subdomain availability)
 * - Determine optimal ingress target (Docker intelligence)
 * - Create DNS records (Cloudflare API)
 * - Update ingress config (config.yml)
 * - Track CNAME ownership in database
 * - Delete CNAMEs with cleanup
 */

import { TunnelDatabase } from './TunnelDatabase.js';
import { DockerNetworkIntel } from './DockerNetworkIntel.js';
import { IngressManager } from './IngressManager.js';
import { CloudflareManager } from '../cloudflare/CloudflareManager.js';
import type { PortManager } from '../ports/PortManager.js';
import type { CNAMERequest, CNAMEResult, CNAME } from './types.js';

export class CNAMEManager {
  private database: TunnelDatabase;
  private dockerIntel: DockerNetworkIntel;
  private ingressManager: IngressManager;
  private cloudflareManager: CloudflareManager;
  private portManager: PortManager;
  private tunnelDomain: string = 'fe2ec8b5-790f-4973-ad07-e03a4e4dd45b.cfargotunnel.com';

  constructor(
    database: TunnelDatabase,
    dockerIntel: DockerNetworkIntel,
    ingressManager: IngressManager,
    cloudflareManager: CloudflareManager,
    portManager: PortManager
  ) {
    this.database = database;
    this.dockerIntel = dockerIntel;
    this.ingressManager = ingressManager;
    this.cloudflareManager = cloudflareManager;
    this.portManager = portManager;
  }

  /**
   * Request a new CNAME
   */
  async requestCNAME(request: CNAMERequest): Promise<CNAMEResult> {
    const domain = request.domain || '153.se';
    const fullHostname = `${request.subdomain}.${domain}`;

    try {
      // Step 1: Validate port allocation
      const portAllocations = await this.portManager.listByProject(request.projectName);
      const portAllocation = portAllocations.find(a => a.portNumber === request.targetPort && a.status !== 'released');

      if (!portAllocation) {
        return {
          success: false,
          error: `Port ${request.targetPort} not allocated to project ${request.projectName}`,
          recommendation: `Use mcp_meta_allocate_port to allocate port ${request.targetPort} first.\n\nExample:\nmcp_meta_allocate_port({\n  projectName: "${request.projectName}",\n  serviceName: "your-service",\n  port: ${request.targetPort}\n})\n\nCheck your project's assigned port range in .supervisor-specific/02-deployment-status.md`
        };
      }

      // Step 1b: Validate port is in assigned range
      const summary = await this.portManager.getProjectSummary(request.projectName);

      if (request.targetPort < summary.rangeStart || request.targetPort > summary.rangeEnd) {
        return {
          success: false,
          error: `Port ${request.targetPort} outside assigned range (${summary.rangeStart}-${summary.rangeEnd})`,
          recommendation: `Your project's assigned port range is ${summary.rangeStart}-${summary.rangeEnd}. Choose a port within this range.`
        };
      }

      // Step 1c: Validate service is running on that port
      const portInUse = await this.portManager.verifyPort(request.targetPort);
      if (!portInUse) {
        return {
          success: false,
          error: `Service not running on port ${request.targetPort}`,
          recommendation: `Start your service first, then create tunnel.\n\nVerify service is running:\ncurl localhost:${request.targetPort}\n\nOr:\nlsof -i :${request.targetPort}`
        };
      }

      // Step 2: Check subdomain availability
      const available = this.database.isSubdomainAvailable(request.subdomain, domain);
      if (!available) {
        return {
          success: false,
          error: `Subdomain ${fullHostname} is already in use`,
          recommendation: 'Choose a different subdomain or delete the existing CNAME first'
        };
      }

      // Step 3: Validate domain exists
      const domainExists = this.database.getDomain(domain);
      if (!domainExists) {
        return {
          success: false,
          error: `Domain ${domain} not found in discovered domains`,
          recommendation: `Available domains: ${this.database.getDomains().map(d => d.domain).join(', ')}`
        };
      }

      // Step 4: Determine ingress target (Docker intelligence)
      const connectivityResult = await this.dockerIntel.determineTarget(
        request.projectName,
        request.targetPort
      );

      if (!connectivityResult.reachable) {
        return {
          success: false,
          error: connectivityResult.method === 'unreachable' ? 'Service not reachable by cloudflared' : 'Unknown connectivity issue',
          recommendation: connectivityResult.recommendation
        };
      }

      // Step 5: Create DNS CNAME record
      const dnsRecord = await this.cloudflareManager.createCNAME(
        fullHostname,
        this.tunnelDomain,
        { proxied: true, ttl: 1 }
      );

      // Step 6: Add ingress rule to config
      this.ingressManager.addIngressRule(fullHostname, connectivityResult.target!);

      // Step 7: Reload tunnel
      const cloudflarednLocation = this.dockerIntel.getCloudflarednLocation() === 'container' ? 'container' : 'host';
      const reloaded = await this.ingressManager.reloadTunnel(cloudflarednLocation);

      if (!reloaded) {
        // Rollback DNS record if tunnel reload fails
        await this.cloudflareManager.deleteDNSRecord(fullHostname);
        throw new Error('Failed to reload tunnel after adding ingress rule');
      }

      // Step 8: Store CNAME ownership
      this.database.createCNAME({
        subdomain: request.subdomain,
        domain,
        full_hostname: fullHostname,
        target_service: connectivityResult.target!,
        target_port: request.targetPort,
        target_type: connectivityResult.method === 'shared-network' ? 'container' : 'localhost',
        container_name: connectivityResult.method === 'shared-network' ? connectivityResult.target!.split('://')[1].split(':')[0] : null,
        docker_network: null,
        project_name: request.projectName,
        cloudflare_record_id: dnsRecord.id,
        created_by: request.projectName
      });

      // Step 9: Log to audit
      this.database.logAction('create_cname', request.projectName, {
        subdomain: request.subdomain,
        domain,
        port: request.targetPort,
        target: connectivityResult.target
      }, true, null);

      // Step 10: Return success
      return {
        success: true,
        url: `https://${fullHostname}`,
        ingress_target: connectivityResult.target!,
        target_type: connectivityResult.method === 'shared-network' ? 'container' : 'localhost',
        container_name: connectivityResult.method === 'shared-network' ? connectivityResult.target!.split('://')[1].split(':')[0] : undefined,
        docker_network: undefined
      };
    } catch (error) {
      console.error('CNAME creation failed:', error);
      this.database.logAction('create_cname', request.projectName, {
        subdomain: request.subdomain,
        domain,
        port: request.targetPort
      }, false, error instanceof Error ? error.message : 'Unknown error');

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        recommendation: 'Check logs for details'
      };
    }
  }

  /**
   * Delete a CNAME
   */
  async deleteCNAME(hostname: string, requestingProject: string, isMetaSupervisor: boolean = false): Promise<{ success: boolean; message: string }> {
    try {
      // Step 1: Get CNAME from database
      const cname = this.database.getCNAME(hostname);

      if (!cname) {
        return {
          success: false,
          message: `CNAME ${hostname} not found`
        };
      }

      // Step 2: Check ownership (unless meta-supervisor)
      if (!isMetaSupervisor && cname.project_name !== requestingProject) {
        return {
          success: false,
          message: `Permission denied: CNAME ${hostname} belongs to project ${cname.project_name}`
        };
      }

      // Step 3: Delete DNS record
      const dnsDeleted = await this.cloudflareManager.deleteDNSRecord(hostname);

      if (!dnsDeleted) {
        console.warn(`DNS record for ${hostname} not found in Cloudflare (may have been manually deleted)`);
      }

      // Step 4: Remove ingress rule
      const ingressRemoved = this.ingressManager.removeIngressRule(hostname);

      if (!ingressRemoved) {
        console.warn(`Ingress rule for ${hostname} not found in config (may have been manually removed)`);
      }

      // Step 5: Reload tunnel
      const cloudflarednLocation = this.dockerIntel.getCloudflarednLocation() === 'container' ? 'container' : 'host';
      await this.ingressManager.reloadTunnel(cloudflarednLocation);

      // Step 6: Delete from database
      this.database.deleteCNAME(hostname);

      // Step 7: Log to audit
      this.database.logAction('delete_cname', requestingProject, {
        hostname,
        project: cname.project_name
      }, true, null);

      return {
        success: true,
        message: `CNAME ${hostname} deleted successfully`
      };
    } catch (error) {
      console.error('CNAME deletion failed:', error);
      this.database.logAction('delete_cname', requestingProject, {
        hostname
      }, false, error instanceof Error ? error.message : 'Unknown error');

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * List CNAMEs with optional filters
   */
  listCNAMEs(filters?: { projectName?: string; domain?: string }): CNAME[] {
    return this.database.listCNAMEs(filters);
  }

  /**
   * Get specific CNAME
   */
  getCNAME(hostname: string): CNAME | null {
    return this.database.getCNAME(hostname);
  }
}
