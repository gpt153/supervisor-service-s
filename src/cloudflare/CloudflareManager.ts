/**
 * CloudflareManager - Manages Cloudflare DNS and Tunnel configuration
 *
 * Features:
 * - DNS record creation/update/deletion (CNAME, A records)
 * - Tunnel ingress configuration management
 * - Multi-domain support
 * - Automatic tunnel sync with port allocations
 *
 * Based on: /home/samuel/sv/.bmad/infrastructure/cloudflare-integration.md
 */

import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import type {
  CloudflareAPIResponse,
  DNSRecord,
  DNSRecordResult,
  DNSRecordListItem,
  CreateCNAMEOptions,
  CreateARecordOptions,
  TunnelIngressRule,
  CloudflareSecrets,
} from '../types/cloudflare.js';
import type { PortManager } from '../ports/PortManager.js';

const execAsync = promisify(exec);

/**
 * CloudflareManager class
 *
 * Manages Cloudflare DNS records and tunnel configuration.
 */
export class CloudflareManager {
  private api: AxiosInstance;
  private apiToken: string;
  private accountId: string;
  private zoneIds: Map<string, string>;
  private tunnelId: string;

  constructor(secrets: CloudflareSecrets) {
    this.apiToken = secrets.apiToken;
    this.accountId = secrets.accountId;
    this.zoneIds = new Map(Object.entries(secrets.zoneIds));
    this.tunnelId = secrets.tunnelId;

    this.api = axios.create({
      baseURL: 'https://api.cloudflare.com/client/v4',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 second timeout
    });

    // Add response interceptor for rate limit handling
    this.api.interceptors.response.use(
      response => response,
      async error => {
        if (error.response?.status === 429) {
          // Rate limited - get retry-after header
          const retryAfter = error.response.headers['retry-after'];
          const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000;

          console.warn(`Cloudflare rate limit hit, waiting ${waitTime}ms before retry`);
          await new Promise(resolve => setTimeout(resolve, waitTime));

          // Retry the request
          return this.api.request(error.config);
        }
        throw error;
      }
    );
  }

  /**
   * Create CNAME record
   *
   * If record already exists, updates it instead of creating.
   *
   * @param hostname - Full hostname (e.g., 'api.consilio.153.se')
   * @param target - Target hostname (e.g., 'tunnel.153.se' or '@')
   * @param options - Optional configuration
   * @returns Record details
   */
  async createCNAME(
    hostname: string,
    target: string,
    options?: CreateCNAMEOptions
  ): Promise<DNSRecordResult> {
    const domain = this.extractDomain(hostname);
    const zoneId = this.zoneIds.get(domain);

    if (!zoneId) {
      throw new Error(`Zone ID not found for domain: ${domain}. Available domains: ${Array.from(this.zoneIds.keys()).join(', ')}`);
    }

    // Check if record already exists
    const existing = await this.findDNSRecord(hostname);
    if (existing) {
      // Update existing record
      return await this.updateDNSRecord(existing.id, zoneId, {
        type: 'CNAME',
        name: hostname,
        content: target,
        proxied: options?.proxied ?? true,
        ttl: options?.ttl ?? 1,
      });
    }

    // Create new record
    try {
      const response = await this.api.post<CloudflareAPIResponse<DNSRecord>>(
        `/zones/${zoneId}/dns_records`,
        {
          type: 'CNAME',
          name: hostname,
          content: target,
          proxied: options?.proxied ?? true,
          ttl: options?.ttl ?? 1,
        }
      );

      if (!response.data.success) {
        throw new Error(`Failed to create CNAME: ${JSON.stringify(response.data.errors)}`);
      }

      const record = response.data.result;
      return {
        id: record.id,
        name: record.name,
        content: record.content,
      };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(`Cloudflare API error: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  /**
   * Create A record
   *
   * If record already exists, updates it instead of creating.
   *
   * @param hostname - Full hostname (e.g., '153.se' or 'server.153.se')
   * @param ipAddress - IP address (e.g., '34.91.182.123')
   * @param options - Optional configuration
   * @returns Record details
   */
  async createARecord(
    hostname: string,
    ipAddress: string,
    options?: CreateARecordOptions
  ): Promise<DNSRecordResult> {
    const domain = this.extractDomain(hostname);
    const zoneId = this.zoneIds.get(domain);

    if (!zoneId) {
      throw new Error(`Zone ID not found for domain: ${domain}. Available domains: ${Array.from(this.zoneIds.keys()).join(', ')}`);
    }

    // Validate IP address format
    if (!this.isValidIPv4(ipAddress)) {
      throw new Error(`Invalid IPv4 address: ${ipAddress}`);
    }

    // Check if record already exists
    const existing = await this.findDNSRecord(hostname);
    if (existing) {
      return await this.updateDNSRecord(existing.id, zoneId, {
        type: 'A',
        name: hostname,
        content: ipAddress,
        proxied: options?.proxied ?? true,
        ttl: options?.ttl ?? 1,
      });
    }

    // Create new record
    try {
      const response = await this.api.post<CloudflareAPIResponse<DNSRecord>>(
        `/zones/${zoneId}/dns_records`,
        {
          type: 'A',
          name: hostname,
          content: ipAddress,
          proxied: options?.proxied ?? true,
          ttl: options?.ttl ?? 1,
        }
      );

      if (!response.data.success) {
        throw new Error(`Failed to create A record: ${JSON.stringify(response.data.errors)}`);
      }

      const record = response.data.result;
      return {
        id: record.id,
        name: record.name,
        content: record.content,
      };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(`Cloudflare API error: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  /**
   * Delete DNS record by hostname
   *
   * @param hostname - Full hostname to delete
   * @returns True if deleted, false if not found
   */
  async deleteDNSRecord(hostname: string): Promise<boolean> {
    const record = await this.findDNSRecord(hostname);
    if (!record) {
      return false; // Already deleted or never existed
    }

    const domain = this.extractDomain(hostname);
    const zoneId = this.zoneIds.get(domain);

    if (!zoneId) {
      throw new Error(`Zone ID not found for domain: ${domain}`);
    }

    try {
      const response = await this.api.delete<CloudflareAPIResponse<{ id: string }>>(
        `/zones/${zoneId}/dns_records/${record.id}`
      );

      return response.data.success;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(`Cloudflare API error: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  /**
   * List all DNS records for a domain
   *
   * @param domain - Domain name (e.g., '153.se', 'openhorizon.cc')
   * @returns Array of DNS records
   */
  async listDNSRecords(domain: string): Promise<DNSRecordListItem[]> {
    const zoneId = this.zoneIds.get(domain);
    if (!zoneId) {
      throw new Error(`Zone ID not found for domain: ${domain}. Available domains: ${Array.from(this.zoneIds.keys()).join(', ')}`);
    }

    try {
      const response = await this.api.get<CloudflareAPIResponse<DNSRecord[]>>(
        `/zones/${zoneId}/dns_records`,
        {
          params: {
            per_page: 100, // Get up to 100 records
          },
        }
      );

      if (!response.data.success) {
        throw new Error(`Failed to list DNS records: ${JSON.stringify(response.data.errors)}`);
      }

      return response.data.result.map(record => ({
        id: record.id,
        type: record.type,
        name: record.name,
        content: record.content,
        proxied: record.proxied,
      }));
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(`Cloudflare API error: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  /**
   * Update Cloudflare Tunnel ingress rules
   *
   * Generates YAML config and restarts cloudflared service.
   *
   * @param rules - Array of ingress rules
   */
  async updateTunnelIngress(rules: TunnelIngressRule[]): Promise<void> {
    // Add catch-all rule (required by cloudflared)
    const ingressRules = [
      ...rules,
      { service: 'http_status:404' },
    ];

    // Generate YAML config
    const yamlConfig = this.generateYAMLConfig(this.tunnelId, ingressRules);

    // Write to /etc/cloudflared/config.yml
    try {
      await fs.writeFile('/etc/cloudflared/config.yml', yamlConfig);
      console.log('Updated /etc/cloudflared/config.yml');
    } catch (error) {
      throw new Error(`Failed to write tunnel config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Restart cloudflared service
    try {
      await execAsync('sudo systemctl restart cloudflared');
      console.log('Restarted cloudflared service');
    } catch (error) {
      // Get logs for debugging
      try {
        const { stdout: logs } = await execAsync('sudo journalctl -u cloudflared -n 50 --no-pager');
        throw new Error(`Failed to restart cloudflared:\n${logs}`);
      } catch {
        throw new Error(`Failed to restart cloudflared: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Sync port allocations to tunnel ingress
   *
   * Reads all port allocations with Cloudflare hostnames and updates tunnel config.
   *
   * @param portManager - PortManager instance
   */
  async syncPortAllocationsToTunnel(portManager: PortManager): Promise<void> {
    // Get all port allocations
    const allocations = await portManager.listAll();

    // Filter to only allocations with Cloudflare hostnames
    const rules = allocations
      .filter(alloc => alloc.cloudflareHostname)
      .map(alloc => ({
        hostname: alloc.cloudflareHostname!,
        service: `http://localhost:${alloc.portNumber}`,
      }));

    console.log(`Syncing ${rules.length} tunnel routes from port allocations`);

    // Update tunnel
    await this.updateTunnelIngress(rules);
  }

  /**
   * Add a single tunnel route
   *
   * Convenience method for adding one route without affecting others.
   *
   * @param hostname - Hostname for the route
   * @param port - Local port number
   */
  async addTunnelRoute(hostname: string, port: number): Promise<void> {
    // This is a simplified version - in production you might want to:
    // 1. Read existing config
    // 2. Add new rule
    // 3. Update config
    // For now, we'll just throw an error suggesting to use syncPortAllocationsToTunnel
    throw new Error(
      'addTunnelRoute is not implemented. Use syncPortAllocationsToTunnel() to sync all routes, ' +
      'or manually add the Cloudflare hostname to the port allocation and then sync.'
    );
  }

  /**
   * Generate YAML config for cloudflared
   *
   * @param tunnelId - Tunnel ID
   * @param ingress - Ingress rules
   * @returns YAML config string
   */
  private generateYAMLConfig(tunnelId: string, ingress: TunnelIngressRule[]): string {
    const lines = [
      `tunnel: ${tunnelId}`,
      `credentials-file: /home/samuel/.cloudflared/${tunnelId}.json`,
      '',
      'ingress:',
    ];

    for (const rule of ingress) {
      if (rule.hostname) {
        lines.push(`  - hostname: ${rule.hostname}`);
        lines.push(`    service: ${rule.service}`);

        // Add origin request config if present
        if (rule.originRequest) {
          lines.push('    originRequest:');
          if (rule.originRequest.connectTimeout) {
            lines.push(`      connectTimeout: ${rule.originRequest.connectTimeout}s`);
          }
          if (rule.originRequest.noTLSVerify !== undefined) {
            lines.push(`      noTLSVerify: ${rule.originRequest.noTLSVerify}`);
          }
          if (rule.originRequest.httpHostHeader) {
            lines.push(`      httpHostHeader: ${rule.originRequest.httpHostHeader}`);
          }
        }
      } else {
        // Catch-all rule
        lines.push(`  - service: ${rule.service}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Find DNS record by hostname
   *
   * @param hostname - Hostname to find
   * @returns Record ID and type, or null if not found
   */
  private async findDNSRecord(hostname: string): Promise<{ id: string; type: string } | null> {
    const domain = this.extractDomain(hostname);
    const zoneId = this.zoneIds.get(domain);

    if (!zoneId) {
      return null;
    }

    try {
      const response = await this.api.get<CloudflareAPIResponse<DNSRecord[]>>(
        `/zones/${zoneId}/dns_records`,
        {
          params: { name: hostname },
        }
      );

      if (!response.data.success || response.data.result.length === 0) {
        return null;
      }

      return {
        id: response.data.result[0].id,
        type: response.data.result[0].type,
      };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Update existing DNS record
   *
   * @param recordId - Record ID
   * @param zoneId - Zone ID
   * @param data - Record data
   * @returns Updated record details
   */
  private async updateDNSRecord(
    recordId: string,
    zoneId: string,
    data: {
      type: string;
      name: string;
      content: string;
      proxied: boolean;
      ttl: number;
    }
  ): Promise<DNSRecordResult> {
    try {
      const response = await this.api.put<CloudflareAPIResponse<DNSRecord>>(
        `/zones/${zoneId}/dns_records/${recordId}`,
        data
      );

      if (!response.data.success) {
        throw new Error(`Failed to update DNS record: ${JSON.stringify(response.data.errors)}`);
      }

      const record = response.data.result;
      return {
        id: record.id,
        name: record.name,
        content: record.content,
      };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(`Cloudflare API error: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  /**
   * Extract domain from hostname
   *
   * Examples:
   * - 'api.consilio.153.se' → '153.se'
   * - 'www.openhorizon.cc' → 'openhorizon.cc'
   * - '153.se' → '153.se'
   *
   * @param hostname - Full hostname
   * @returns Domain (last two parts)
   */
  private extractDomain(hostname: string): string {
    const parts = hostname.split('.');
    if (parts.length < 2) {
      throw new Error(`Invalid hostname: ${hostname}`);
    }

    // Return last two parts
    return parts.slice(-2).join('.');
  }

  /**
   * Validate IPv4 address format
   *
   * @param ip - IP address to validate
   * @returns True if valid IPv4
   */
  private isValidIPv4(ip: string): boolean {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipv4Regex.test(ip)) {
      return false;
    }

    const parts = ip.split('.');
    return parts.every(part => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  }
}
