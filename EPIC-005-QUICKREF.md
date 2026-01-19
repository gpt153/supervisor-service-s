# EPIC-005: Cloudflare Integration - Quick Reference

**Quick reference for Cloudflare DNS and tunnel management**

---

## MCP Tools

### mcp__meta__create_cname
Create or update CNAME record

```typescript
await mcp__meta__create_cname({
  hostname: 'api.consilio.153.se',
  target: 'tunnel.153.se',
  proxied: true  // optional, default: true
});
```

### mcp__meta__create_a_record
Create or update A record

```typescript
await mcp__meta__create_a_record({
  hostname: '153.se',
  ipAddress: '34.91.182.123',
  proxied: true  // optional, default: true
});
```

### mcp__meta__delete_dns_record
Delete DNS record

```typescript
await mcp__meta__delete_dns_record({
  hostname: 'old-api.consilio.153.se'
});
```

### mcp__meta__list_dns_records
List all DNS records for domain

```typescript
await mcp__meta__list_dns_records({
  domain: '153.se'
});
```

### mcp__meta__sync_tunnel
Sync tunnel routes with port allocations

```typescript
await mcp__meta__sync_tunnel({});
```

---

## Required Secrets

Set these via `mcp__meta__set_secret`:

```typescript
// 1. API Token
meta/cloudflare/api_token

// 2. Account ID
meta/cloudflare/account_id

// 3. Tunnel ID
meta/cloudflare/tunnel_id

// 4. Zone ID for 153.se
meta/cloudflare/zone_id_153se

// 5. Zone ID for openhorizon.cc (optional)
meta/cloudflare/zone_id_openhorizon
```

---

## Common Workflows

### Deploy New Service

```typescript
// 1. Allocate port
const port = await mcp__meta__get_port({
  projectName: 'consilio',
  serviceName: 'api',
  cloudflareHostname: 'api.consilio.153.se'
});

// 2. Create DNS
await mcp__meta__create_cname({
  hostname: 'api.consilio.153.se',
  target: 'tunnel.153.se'
});

// 3. Sync tunnel
await mcp__meta__sync_tunnel({});

// Done! Service live at https://api.consilio.153.se
```

### Remove Service

```typescript
// 1. Delete DNS
await mcp__meta__delete_dns_record({
  hostname: 'old-api.consilio.153.se'
});

// 2. Release port
await mcp__meta__release_port({
  projectName: 'consilio',
  serviceName: 'old-api'
});

// 3. Sync tunnel
await mcp__meta__sync_tunnel({});
```

### List All DNS Records

```typescript
const records = await mcp__meta__list_dns_records({
  domain: '153.se'
});

// Returns array of records with:
// - id, type, name, content, proxied
```

---

## Files

**Source:**
- `/home/samuel/sv/supervisor-service/src/cloudflare/CloudflareManager.ts`
- `/home/samuel/sv/supervisor-service/src/cloudflare/cloudflare-tools.ts`
- `/home/samuel/sv/supervisor-service/src/types/cloudflare.ts`

**Generated:**
- `/etc/cloudflared/config.yml`

**Documentation:**
- `/home/samuel/sv/supervisor-service/EPIC-005-IMPLEMENTATION.md`
- `/home/samuel/sv/.bmad/infrastructure/cloudflare-integration.md`

---

## Troubleshooting

### "Missing Cloudflare secrets"
Set required secrets via `mcp__meta__set_secret`

### "Zone ID not found for domain"
Check domain spelling, ensure zone secret is set

### "Failed to restart cloudflared"
Check logs: `sudo journalctl -u cloudflared -n 50`

### Rate limited
Wait and retry - automatic backoff implemented

---

## Multi-Domain Support

**Supported domains:**
- `153.se` (zone_id_153se secret)
- `openhorizon.cc` (zone_id_openhorizon secret)

Domain automatically detected from hostname:
- `api.consilio.153.se` → uses 153.se zone
- `api.openhorizon.cc` → uses openhorizon.cc zone

---

## API Features

- ✅ Idempotent operations (safe to retry)
- ✅ Automatic rate limit handling
- ✅ IPv4 validation
- ✅ Domain extraction
- ✅ Comprehensive error messages
- ✅ Cloudflared auto-restart
