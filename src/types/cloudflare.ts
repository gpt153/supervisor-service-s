/**
 * TypeScript types for Cloudflare integration
 */

/**
 * DNS record types supported by Cloudflare
 */
export type DNSRecordType = 'A' | 'AAAA' | 'CNAME' | 'TXT' | 'MX' | 'SRV';

/**
 * DNS record from Cloudflare API
 */
export interface DNSRecord {
  id: string;
  type: DNSRecordType;
  name: string;
  content: string;
  proxied: boolean;
  ttl: number;
  created_on?: string;
  modified_on?: string;
}

/**
 * Cloudflare API response wrapper
 */
export interface CloudflareAPIResponse<T> {
  success: boolean;
  errors: Array<{
    code: number;
    message: string;
  }>;
  messages: string[];
  result: T;
  result_info?: {
    page: number;
    per_page: number;
    count: number;
    total_count: number;
  };
}

/**
 * Tunnel ingress rule
 */
export interface TunnelIngressRule {
  hostname?: string;
  service: string;
  originRequest?: {
    connectTimeout?: number;
    noTLSVerify?: boolean;
    httpHostHeader?: string;
  };
}

/**
 * Tunnel configuration
 */
export interface TunnelConfig {
  tunnel: string;
  credentials_file: string;
  ingress: TunnelIngressRule[];
}

/**
 * Cloudflare secrets structure
 */
export interface CloudflareSecrets {
  apiToken: string;
  accountId: string;
  zoneIds: Record<string, string>; // domain → zone_id
  tunnelId: string;
}

/**
 * Options for creating CNAME record
 */
export interface CreateCNAMEOptions {
  proxied?: boolean;
  ttl?: number;
}

/**
 * Options for creating A record
 */
export interface CreateARecordOptions {
  proxied?: boolean;
  ttl?: number;
}

/**
 * DNS record creation result
 */
export interface DNSRecordResult {
  id: string;
  name: string;
  content: string;
}

/**
 * DNS record list item
 */
export interface DNSRecordListItem {
  id: string;
  type: DNSRecordType;
  name: string;
  content: string;
  proxied: boolean;
}
