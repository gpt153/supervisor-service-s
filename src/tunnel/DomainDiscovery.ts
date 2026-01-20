/**
 * DomainDiscovery - Discover all Cloudflare zones in account
 *
 * Responsibilities:
 * - Query Cloudflare API for all zones
 * - Store discovered domains in database
 * - Refresh domain list periodically
 */

import axios, { AxiosInstance } from 'axios';
import { TunnelDatabase } from './TunnelDatabase.js';

export class DomainDiscovery {
  private api: AxiosInstance;
  private database: TunnelDatabase;
  private accountId: string;

  constructor(apiToken: string, accountId: string, database: TunnelDatabase) {
    this.accountId = accountId;
    this.database = database;

    this.api = axios.create({
      baseURL: 'https://api.cloudflare.com/client/v4',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  /**
   * Discover all zones in Cloudflare account
   */
  async discoverDomains(): Promise<Array<{ domain: string; zone_id: string }>> {
    try {
      const response = await this.api.get(`/zones`, {
        params: {
          account: {
            id: this.accountId
          },
          per_page: 100 // Get up to 100 zones
        }
      });

      if (!response.data.success) {
        throw new Error(`Failed to list zones: ${JSON.stringify(response.data.errors)}`);
      }

      const zones = response.data.result as Array<{ id: string; name: string }>;
      const domains: Array<{ domain: string; zone_id: string }> = [];

      for (const zone of zones) {
        this.database.upsertDomain(zone.name, zone.id);
        domains.push({ domain: zone.name, zone_id: zone.id });
      }

      console.log(`Discovered ${domains.length} domains:`, domains.map(d => d.domain).join(', '));
      return domains;
    } catch (error) {
      console.error('Domain discovery failed:', error);
      throw error;
    }
  }

  /**
   * Get all discovered domains from database
   */
  getDomains(): Array<{ domain: string; zone_id: string }> {
    const domains = this.database.getDomains();
    return domains.map(d => ({
      domain: d.domain,
      zone_id: d.zone_id
    }));
  }
}
