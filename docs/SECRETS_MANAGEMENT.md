# Secrets Management

**EPIC-003 Implementation**

Secure encrypted storage and retrieval of secrets using AES-256-GCM encryption with hierarchical key paths.

---

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [MCP Tools](#mcp-tools)
- [Key Path Structure](#key-path-structure)
- [Security Considerations](#security-considerations)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)

---

## Overview

The secrets management system provides:

- **AES-256-GCM Encryption**: Industry-standard authenticated encryption
- **Hierarchical Key Paths**: Organized as `scope/context/name` (e.g., `meta/cloudflare/api_token`)
- **Access Tracking**: Full audit trail of all secret access
- **Expiration Support**: Automatic expiration and rotation notifications
- **MCP Integration**: Accessible via MCP tools for supervisors

### Why This Approach?

**Simple and predictable:**
- No searching for secrets across multiple locations
- No complex file-based storage
- Single database table with encrypted values
- Easy to backup and restore

**Secure:**
- Encryption key stored outside database (environment variable)
- Unique IV per secret (prevents pattern analysis)
- Authentication tags (prevents tampering)
- Audit trail for compliance

---

## Quick Start

### 1. Generate Encryption Key

```bash
# Generate a 256-bit (32-byte) encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Example output:
# a3f8c9d2e1b4a6f7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1
```

### 2. Store Encryption Key

**Option A: User's .bashrc (simple)**
```bash
echo "export SECRETS_ENCRYPTION_KEY='<your-key-from-step-1>'" >> ~/.bashrc
source ~/.bashrc
```

**Option B: .env file (development)**
```bash
# /home/samuel/sv/supervisor-service/.env
SECRETS_ENCRYPTION_KEY=<your-key-from-step-1>
```

**Option C: systemd service (production)**
```ini
# /etc/systemd/system/supervisor-service.service
[Service]
Environment="SECRETS_ENCRYPTION_KEY=<your-key-from-step-1>"
```

**⚠️ NEVER commit the encryption key to git!**

### 3. Run Database Migration

```bash
cd /home/samuel/sv/supervisor-service
npm run migrate:up
```

This creates the `secrets` and `secret_access_log` tables.

### 4. Verify Setup

```bash
# Start the service
npm run dev

# The service will fail if SECRETS_ENCRYPTION_KEY is not set
```

---

## Architecture

### Database Schema

```sql
CREATE TABLE secrets (
  id SERIAL PRIMARY KEY,
  key_path TEXT NOT NULL UNIQUE,           -- Hierarchical path
  encrypted_value BYTEA NOT NULL,          -- IV + Auth Tag + Encrypted Data
  description TEXT,
  scope TEXT NOT NULL,                     -- 'meta', 'project', 'service'
  project_name TEXT,                       -- NULL for meta-level
  service_name TEXT,                       -- NULL for project-level
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT DEFAULT 'supervisor',
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  access_count INTEGER DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE,
  rotation_required BOOLEAN DEFAULT FALSE
);

CREATE TABLE secret_access_log (
  id SERIAL PRIMARY KEY,
  key_path TEXT NOT NULL,
  accessed_by TEXT NOT NULL DEFAULT 'supervisor',
  access_type TEXT NOT NULL,               -- 'read', 'create', 'update', 'delete'
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Encryption Format

Each encrypted value is stored as:

```
[IV (16 bytes)] + [Auth Tag (16 bytes)] + [Encrypted Data (variable)]
```

- **IV (Initialization Vector)**: Random, unique per secret
- **Auth Tag**: Ensures data hasn't been tampered with
- **Encrypted Data**: AES-256-GCM encrypted plaintext

### SecretsManager Class

Located at: `/home/samuel/sv/supervisor-service/src/secrets/SecretsManager.ts`

**Key methods:**
- `set(params)` - Store or update a secret
- `get(params)` - Retrieve and decrypt a secret
- `list(params)` - List secrets (without values)
- `delete(params)` - Delete a secret
- `getExpiringSoon(days)` - Find expiring secrets
- `getNeedingRotation()` - Find secrets marked for rotation
- `markForRotation(keyPath)` - Mark secret for rotation

---

## MCP Tools

All tools are available via the MCP protocol with the `mcp__meta__` prefix.

### 1. Get Secret

```typescript
mcp__meta__get_secret({
  keyPath: 'meta/cloudflare/api_token'
})

// Response:
{
  success: true,
  keyPath: 'meta/cloudflare/api_token',
  value: 'sk_live_abc123...'
}
```

**Error cases:**
- Secret not found: `success: false, error: 'Secret not found: ...'`
- Secret expired: Throws error with expiration message
- Decryption failed: `success: false, error: 'Decryption failed'`

### 2. Set Secret

```typescript
mcp__meta__set_secret({
  keyPath: 'meta/cloudflare/api_token',
  value: 'sk_live_abc123...',
  description: 'Cloudflare API token for DNS management',
  expiresAt: '2027-01-18T00:00:00Z'  // Optional
})

// Response:
{
  success: true,
  keyPath: 'meta/cloudflare/api_token',
  message: 'Secret stored successfully'
}
```

**Notes:**
- Creates new secret if doesn't exist
- Updates existing secret if key path matches
- `expiresAt` is optional (ISO 8601 format)

### 3. List Secrets

```typescript
mcp__meta__list_secrets({
  scope: 'project',        // Optional: 'meta', 'project', 'service'
  project: 'consilio',     // Optional: filter by project name
  service: 'storybook'     // Optional: filter by service name
})

// Response:
{
  success: true,
  count: 3,
  secrets: [
    {
      keyPath: 'project/consilio/database_url',
      description: 'Consilio production database',
      scope: 'project',
      lastAccessed: '2026-01-18T10:30:00Z',
      accessCount: 15,
      expiresAt: null
    },
    // ...
  ]
}
```

**Note:** Secret values are NOT included in list responses.

### 4. Delete Secret

```typescript
mcp__meta__delete_secret({
  keyPath: 'meta/cloudflare/api_token'
})

// Response:
{
  success: true,
  keyPath: 'meta/cloudflare/api_token',
  message: 'Secret deleted successfully'
}
```

**Warning:** This action cannot be undone.

### 5. Get Expiring Secrets

```typescript
mcp__meta__get_expiring_secrets({
  daysAhead: 30  // Optional, defaults to 30
})

// Response:
{
  success: true,
  count: 2,
  daysAhead: 30,
  secrets: [
    {
      keyPath: 'meta/api/token',
      description: 'API token',
      scope: 'meta',
      expiresAt: '2026-02-15T00:00:00Z'
    }
  ]
}
```

### 6. Get Rotation Secrets

```typescript
mcp__meta__get_rotation_secrets({})

// Response:
{
  success: true,
  count: 1,
  secrets: [
    {
      keyPath: 'meta/api/key',
      description: 'Old API key',
      scope: 'meta',
      lastAccessed: '2026-01-10T12:00:00Z'
    }
  ]
}
```

### 7. Mark Secret for Rotation

```typescript
mcp__meta__mark_secret_rotation({
  keyPath: 'meta/cloudflare/api_token'
})

// Response:
{
  success: true,
  keyPath: 'meta/cloudflare/api_token',
  message: 'Secret marked for rotation'
}
```

---

## Key Path Structure

### Format

```
{scope}/{context}/{name}
```

### Meta-Level Secrets (scope=meta)

For system-wide credentials not tied to a specific project:

```
meta/cloudflare/api_token
meta/cloudflare/account_id
meta/gcloud/vm_host_key
meta/gcloud/openhorizon_key
meta/openai/api_key
meta/github/pat
meta/postgres/master_password
```

**Scope:** `meta`
**Project Name:** `null`
**Service Name:** `null`

### Project-Level Secrets (scope=project)

For credentials specific to a project:

```
project/consilio/database_url
project/consilio/jwt_secret
project/consilio/stripe_api_key
project/odin/google_sheets_api_key
project/openhorizon/sendgrid_api_key
```

**Scope:** `project`
**Project Name:** Second path component (e.g., `consilio`)
**Service Name:** `null`

### Service-Level Secrets (scope=service)

For credentials specific to a service:

```
service/storybook/auth_token
service/penpot/admin_password
service/archon/supabase_key
```

**Scope:** `service`
**Project Name:** `null`
**Service Name:** Second path component (e.g., `storybook`)

---

## Security Considerations

### What's Secure

✅ **AES-256-GCM encryption** - Industry standard
✅ **Unique IV per secret** - Prevents pattern analysis
✅ **Authentication tag** - Prevents tampering
✅ **Encryption key stored outside database** - Separation of concerns
✅ **Encrypted at rest in PostgreSQL** - Database-level protection
✅ **Access tracking** - Full audit trail
✅ **Secrets never logged** - Error messages sanitized

### What's NOT Protected Against

⚠️ **Root access to VM** - Can read encryption key from environment
⚠️ **Root access to PostgreSQL** - Can dump encrypted data
⚠️ **Compromise of supervisor-service process** - Has decryption capability

### Why This Is Acceptable

- Single-user system (you control the VM)
- No external attackers have access
- Better than plaintext or Git storage
- Secrets not committed to public repos
- Encryption key not in codebase

### Additional Hardening (Optional)

For production systems requiring higher security:

1. **Use external secrets manager**: AWS Secrets Manager, GCP Secret Manager
2. **Implement PostgreSQL row-level security**
3. **Add IP whitelisting** for database access
4. **Regular key rotation** schedule
5. **Hardware security module (HSM)** for encryption key storage

---

## Examples

### Example 1: Store Cloudflare API Token

```typescript
// Supervisor needs to store Cloudflare credentials
await mcp__meta__set_secret({
  keyPath: 'meta/cloudflare/api_token',
  value: 'sk_live_abc123xyz...',
  description: 'Cloudflare API token for DNS management'
});

// Later, retrieve it
const token = await mcp__meta__get_secret({
  keyPath: 'meta/cloudflare/api_token'
});

// Use it
await cloudflareAPI.createCNAME(token.value, { /* ... */ });
```

### Example 2: Store GCloud Service Account

```typescript
// Service account JSON from GCloud
const serviceAccountJson = JSON.stringify({
  "type": "service_account",
  "project_id": "openhorizon-prod",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...",
  "client_email": "supervisor@openhorizon.iam.gserviceaccount.com",
  // ... rest of JSON
});

// Store as secret
await mcp__meta__set_secret({
  keyPath: 'meta/gcloud/openhorizon_key',
  value: serviceAccountJson,
  description: 'GCloud service account for OpenHorizon project (Owner role)'
});

// Later, retrieve and use
const jsonString = await mcp__meta__get_secret({
  keyPath: 'meta/gcloud/openhorizon_key'
});

const serviceAccount = JSON.parse(jsonString.value);

// Authenticate with GCloud SDK
const auth = new GoogleAuth({
  credentials: serviceAccount,
  scopes: ['https://www.googleapis.com/auth/cloud-platform']
});
```

### Example 3: List Available Secrets for a Project

```typescript
// Supervisor doesn't know what secrets exist
const result = await mcp__meta__list_secrets({
  scope: 'project',
  project: 'consilio'
});

// Returns:
{
  success: true,
  count: 3,
  secrets: [
    {
      keyPath: 'project/consilio/database_url',
      description: 'Consilio production database',
      scope: 'project',
      lastAccessed: '2026-01-18T10:30:00Z',
      accessCount: 15
    },
    {
      keyPath: 'project/consilio/jwt_secret',
      description: 'JWT signing key',
      scope: 'project',
      lastAccessed: '2026-01-17T14:22:00Z',
      accessCount: 8
    },
    {
      keyPath: 'project/consilio/stripe_api_key',
      description: 'Stripe API key for payments',
      scope: 'project',
      lastAccessed: null,
      accessCount: 0
    }
  ]
}
```

### Example 4: Check for Expiring Secrets

```typescript
// Weekly cron job or supervisor check
const expiring = await mcp__meta__get_expiring_secrets({
  daysAhead: 7
});

if (expiring.count > 0) {
  console.log(`⚠️ ${expiring.count} secrets expiring in next 7 days:`);
  expiring.secrets.forEach(s => {
    console.log(`  - ${s.keyPath}: expires ${s.expiresAt}`);
  });
}
```

---

## Troubleshooting

### Error: SECRETS_ENCRYPTION_KEY not set

**Symptom:**
```
Error: SECRETS_ENCRYPTION_KEY environment variable not set.
Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Solution:**
1. Generate a key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. Add to environment (see Quick Start section)
3. Restart service

### Error: SECRETS_ENCRYPTION_KEY must be 64 hexadecimal characters

**Symptom:**
```
Error: SECRETS_ENCRYPTION_KEY must be 64 hexadecimal characters (32 bytes).
```

**Solution:**
The key must be exactly 64 hex characters (0-9, a-f). Regenerate with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Error: Secret has expired

**Symptom:**
```
Error: Secret "meta/api/token" has expired
```

**Solution:**
1. Generate new secret value
2. Update with `mcp__meta__set_secret` (sets new `expiresAt`)
3. Or remove expiration: set `expiresAt: null`

### Error: Decryption failed

**Symptom:**
```
{ success: false, error: 'Decryption failed' }
```

**Possible causes:**
1. **Wrong encryption key**: The key used to decrypt is different from the one used to encrypt
2. **Corrupted data**: Database value was modified
3. **Wrong algorithm**: Database value format is incorrect

**Solution:**
- If you lost the original encryption key, secrets cannot be recovered
- You must delete and recreate affected secrets
- Always backup your encryption key securely

### Secret Not Found

**Symptom:**
```
{ success: false, error: 'Secret not found: meta/api/token' }
```

**Solution:**
1. Check key path spelling and format
2. List all secrets: `mcp__meta__list_secrets({})`
3. Verify secret exists in database:
   ```sql
   SELECT key_path FROM secrets WHERE key_path LIKE 'meta/%';
   ```

### Database Migration Failed

**Symptom:**
```
ERROR: relation "secrets" already exists
```

**Solution:**
Migration already ran. To re-run:
```bash
npm run migrate:down  # Roll back
npm run migrate:up    # Apply again
```

---

## Migration from Existing Secrets

If you have secrets in files, environment variables, or old SCAR storage:

### From Files

```bash
# Import from file
cat /path/to/secret.txt | \
  # Store via MCP tool (requires service running)
  mcp__meta__set_secret({
    keyPath: 'meta/service/api_key',
    value: '<paste-value>',
    description: 'Migrated from file'
  })
```

### From Environment Variables

```bash
# Read from current environment
echo $CLOUDFLARE_API_TOKEN | \
  # Store via MCP tool
  mcp__meta__set_secret({
    keyPath: 'meta/cloudflare/api_token',
    value: '<value>',
    description: 'Migrated from environment'
  })
```

### From .env Files

```bash
# Parse .env file
while IFS='=' read -r key value; do
  # Store each key-value pair
  mcp__meta__set_secret({
    keyPath: "project/consilio/${key,,}",  # lowercase key
    value: "$value",
    description: 'Migrated from .env'
  })
done < .env
```

---

## Related Files

- **SecretsManager class**: `/home/samuel/sv/supervisor-service/src/secrets/SecretsManager.ts`
- **MCP tools**: `/home/samuel/sv/supervisor-service/src/mcp/tools/secrets-tools.ts`
- **Database migration**: `/home/samuel/sv/supervisor-service/migrations/1737212100000_secrets_management.sql`
- **Type definitions**: `/home/samuel/sv/supervisor-service/src/types/database.ts`
- **Design document**: `/home/samuel/sv/.bmad/infrastructure/secrets-management-system.md`

---

## Security Best Practices

1. **Never commit secrets to Git**
   - Add `.env` to `.gitignore`
   - Never hardcode secrets in code
   - Use secrets management tools only

2. **Rotate secrets regularly**
   - Set expiration dates for sensitive keys
   - Use `mcp__meta__mark_secret_rotation` to track
   - Generate new keys before expiration

3. **Limit access**
   - Only grant supervisor access to necessary secrets
   - Use scoped secrets (project/service) instead of meta when possible
   - Monitor access logs for suspicious activity

4. **Backup encryption key**
   - Store encryption key in secure password manager
   - Document key location for disaster recovery
   - Never email or Slack encryption keys

5. **Monitor audit trail**
   - Review `secret_access_log` regularly
   - Alert on failed access attempts
   - Track which secrets are accessed most

---

## Next Steps

After implementing EPIC-003:

1. ✅ Generate and store encryption key
2. ✅ Run database migration
3. ✅ Test MCP tools via supervisor
4. ✅ Migrate existing secrets
5. ⏭️ Implement EPIC-004 (Port Allocation) - already completed
6. ⏭️ Implement EPIC-005 (Task Timing) - already completed
7. ⏭️ Implement EPIC-006 (Learnings Index) - already completed

---

**Implementation completed: 2026-01-18**
**Epic: EPIC-003 Secrets Management**
