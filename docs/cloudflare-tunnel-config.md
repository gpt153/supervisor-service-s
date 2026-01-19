# Cloudflare Tunnel Configuration

## Current Setup

**Tunnel ID**: `fe2ec8b5-790f-4973-ad07-e03a4e4dd45b`

**Tunnel Domain**: `fe2ec8b5-790f-4973-ad07-e03a4e4dd45b.cfargotunnel.com`

**Zone**: `153.se` (Zone ID: `f0cd4fffeebf70a32d4dde6c56806ce7`)

## CNAME Pattern

All subdomains must follow this pattern to route through the tunnel:

```
{subdomain}.153.se → fe2ec8b5-790f-4973-ad07-e03a4e4dd45b.cfargotunnel.com
```

**Configuration**:
- Type: `CNAME`
- Content: `fe2ec8b5-790f-4973-ad07-e03a4e4dd45b.cfargotunnel.com`
- Proxied: `true`
- TTL: `1` (automatic)

## Existing CNAMEs

Currently active subdomains:
- `chat.153.se`
- `code.153.se`
- `consilio.153.se`
- `hejsan.153.se`
- And others...

## Secrets Storage

All tunnel-related credentials stored in secrets manager:

- `meta/cloudflare/tunnel_id`: Tunnel UUID
- `meta/cloudflare/api_token`: Main API token
- `meta/cloudflare/dns_edit_token`: DNS edit token (`H5zxOd7zg9uznWWyagmVPnvodX4SPs8zhCcbRL81`)
- `meta/cloudflare/account_id`: Cloudflare account ID
- `meta/cloudflare/zone_id_153se`: Zone ID for 153.se domain

## Tunnel Ingress Configuration

The tunnel ingress rules map incoming hostnames to local services:

```yaml
# Example ingress pattern
ingress:
  - hostname: chat.153.se
    service: http://localhost:3XXX
  - hostname: consilio.153.se
    service: http://localhost:3XXX
  # Catch-all
  - service: http_status:404
```

## Port Allocation for Services

When PSs request new CNAMEs, they should:
1. Allocate a port from their project range
2. Request CNAME creation pointing to tunnel
3. Request tunnel ingress rule addition
4. Deploy service on allocated port

## Future: Tunnel Manager

A dedicated tunnel-manager will:
- Monitor tunnel health
- Restart tunnel on failures
- Manage ingress rules
- Handle CNAME creation requests from PSs
- Maintain tunnel configuration
- Propagate tunnel status to all PSs via MCP
