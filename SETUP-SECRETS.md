# Secrets Management Setup Checklist

Quick setup guide for EPIC-003: Secrets Management

---

## Prerequisites

- ✅ PostgreSQL running (EPIC-001)
- ✅ MCP Server running (EPIC-002)
- ✅ Node.js v20+ installed

---

## Setup Steps

### 1. Generate Encryption Key

```bash
# Generate a 256-bit (32-byte) random encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Example output:**
```
a3f8c9d2e1b4a6f7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1
```

**⚠️ SAVE THIS KEY SECURELY!**
- Store in password manager
- Store in ~/.bashrc or .env
- **NEVER commit to Git**

---

### 2. Set Environment Variable

**Option A: For current session only**
```bash
export SECRETS_ENCRYPTION_KEY='<your-key-from-step-1>'
```

**Option B: Persist in ~/.bashrc (recommended)**
```bash
echo "export SECRETS_ENCRYPTION_KEY='<your-key-from-step-1>'" >> ~/.bashrc
source ~/.bashrc
```

**Option C: Use .env file (development)**
```bash
cd /home/samuel/sv/supervisor-service
echo "SECRETS_ENCRYPTION_KEY=<your-key-from-step-1>" >> .env
```

---

### 3. Run Database Migration

```bash
cd /home/samuel/sv/supervisor-service
npm run migrate:up
```

**Expected output:**
```
> MIGRATION 002_secrets_management UP
```

**If migration already ran:**
```
# Skip this step - tables already exist
```

---

### 4. Verify Setup

```bash
cd /home/samuel/sv/supervisor-service
tsx src/secrets/test-secrets.ts
```

**Expected output:**
```
🔐 Testing Secrets Management

1. Testing database connection...
   ✅ Database connected

2. Initializing SecretsManager...
   ✅ SecretsManager initialized

... (all tests passing)

✅ All tests passed!
```

**If you get an error about SECRETS_ENCRYPTION_KEY:**
```
# Go back to step 2 and set the environment variable
```

---

### 5. Start Service

```bash
cd /home/samuel/sv/supervisor-service
npm run dev
```

The service should start without errors. If you see:
```
Error: SECRETS_ENCRYPTION_KEY not set
```
Go back to step 2.

---

## Quick Test Via MCP

Once the service is running, test the MCP tools:

### Store a test secret
```typescript
mcp__meta__set_secret({
  keyPath: 'meta/test/hello',
  value: 'world',
  description: 'Test secret'
})
```

### Retrieve the secret
```typescript
mcp__meta__get_secret({
  keyPath: 'meta/test/hello'
})
// Should return: { success: true, value: 'world' }
```

### List all secrets
```typescript
mcp__meta__list_secrets({})
// Should show your test secret
```

### Delete the test secret
```typescript
mcp__meta__delete_secret({
  keyPath: 'meta/test/hello'
})
```

---

## Common Issues

### "SECRETS_ENCRYPTION_KEY not set"

**Solution:**
```bash
# Check if variable is set
echo $SECRETS_ENCRYPTION_KEY

# If empty, set it:
export SECRETS_ENCRYPTION_KEY='<your-key>'

# Make it permanent:
echo "export SECRETS_ENCRYPTION_KEY='<your-key>'" >> ~/.bashrc
source ~/.bashrc
```

---

### "SECRETS_ENCRYPTION_KEY must be 64 hexadecimal characters"

**Solution:**
The key must be exactly 64 hex characters (0-9, a-f).

Regenerate:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### Migration fails with "relation already exists"

**Solution:**
Migration already ran. Nothing to do.

If you need to re-run:
```bash
npm run migrate:down  # Roll back
npm run migrate:up    # Apply again
```

---

### Test script fails to connect to database

**Solution:**
Check PostgreSQL is running and .env has correct credentials:

```bash
# Check if PostgreSQL is running
pg_isready

# Check .env file
cat .env | grep PG

# Should show:
# PGHOST=localhost
# PGPORT=5432
# PGUSER=supervisor
# PGPASSWORD=<password>
# PGDATABASE=supervisor_service
```

---

## Next Steps

Once setup is complete:

1. **Read the documentation**
   - `/home/samuel/sv/supervisor-service/docs/SECRETS_MANAGEMENT.md`

2. **Import existing secrets**
   - Find all current secrets (.env files, etc.)
   - Import via `mcp__meta__set_secret`
   - Verify via `mcp__meta__get_secret`
   - Delete old secret files

3. **Set up monitoring**
   - Periodic checks for expiring secrets
   - Review access logs
   - Plan rotation schedule

---

## Documentation

- **Setup Guide:** This file
- **User Guide:** `docs/SECRETS_MANAGEMENT.md`
- **Implementation Details:** `EPIC-003-IMPLEMENTATION.md`
- **Completion Summary:** `EPIC-003-COMPLETE.md`

---

## Support

If you encounter issues:

1. Check environment variable is set: `echo $SECRETS_ENCRYPTION_KEY`
2. Check database is running: `pg_isready`
3. Run test script: `tsx src/secrets/test-secrets.ts`
4. Check service logs for errors
5. Review documentation in `docs/SECRETS_MANAGEMENT.md`

---

**Status:** Ready for use
**Date:** 2026-01-18
