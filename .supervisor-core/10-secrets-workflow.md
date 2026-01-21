# Secrets Management Workflow

**CRITICAL: All project supervisors MUST follow this workflow for secrets.**

---

## 🔒 Mandatory Rule

**When you receive or create ANY secret (API key, password, token, etc.):**

1. ✅ **FIRST**: Store in encrypted secrets manager using MCP tool
2. ✅ **THEN**: Add to project .env file

**NO EXCEPTIONS.** This ensures encrypted backup for continuity.

---

## Standard Workflow

### When User Gives You a Secret

**Example:** User says "Here's the Stripe API key: sk_live_abc123xyz"

**You MUST do:**

```javascript
// Step 1: Store in secrets manager (REQUIRED)
mcp__meta__set_secret({
  keyPath: 'project/consilio/stripe_api_key',
  value: 'sk_live_abc123xyz',
  description: 'Stripe API key for payment processing'
})

// Step 2: Add to .env file (after Step 1 completes)
// Edit /home/samuel/sv/consilio-s/.env
STRIPE_API_KEY=sk_live_abc123xyz
```

**DO NOT skip Step 1.** The encrypted backup is mandatory.

---

### When You Generate a Secret

**Example:** Creating a JWT secret for authentication

**You MUST do:**

```javascript
// Step 1: Generate secret
const secret = generateRandomSecret(); // e.g., openssl rand -base64 48

// Step 2: Store in secrets manager (REQUIRED)
mcp__meta__set_secret({
  keyPath: 'project/myproject/jwt_secret',
  value: secret,
  description: 'JWT signing secret for authentication'
})

// Step 3: Add to .env file (after Step 2 completes)
// Edit .env
JWT_SECRET=<generated-secret>
```

---

## Key Path Format

**Always use:** `project/{project-name}/{secret-name-lowercase}`

**Examples:**
```
project/consilio/stripe_api_key
project/odin/openai_api_key
project/openhorizon/jwt_secret
project/health-agent/telegram_bot_token
```

**For meta-level secrets (system-wide):**
```
meta/cloudflare/api_token
meta/gcloud/service_account_key
```

---

## Description Guidelines

**Write clear descriptions:**

✅ Good:
- "Stripe API key for payment processing"
- "PostgreSQL production database password"
- "SendGrid API key for transactional emails"

❌ Bad:
- "API key"
- "Password"
- "Secret"

---

## Quick Reference Commands

### Store Secret
```javascript
mcp__meta__set_secret({
  keyPath: 'project/{project}/{name}',
  value: 'actual-secret-value',
  description: 'What this secret is for'
})
```

### Retrieve Secret
```javascript
mcp__meta__get_secret({
  keyPath: 'project/{project}/{name}'
})
```

### List Project Secrets
```javascript
mcp__meta__list_secrets({
  scope: 'project',
  project: 'consilio'
})
```

---

## Common Mistakes (DON'T DO THIS)

❌ **Writing to .env first, forgetting to store in vault**
```bash
# WRONG - No backup!
echo "STRIPE_KEY=sk_live_abc" >> .env
```

❌ **Storing without description**
```javascript
// WRONG - No context
mcp__meta__set_secret({
  keyPath: 'project/consilio/key',
  value: 'abc123'
  // Missing description!
})
```

❌ **Using wrong key path format**
```javascript
// WRONG - Not following format
keyPath: 'consilio-stripe-key'  // Missing project/ prefix
keyPath: 'project/CONSILIO/Key'  // Not lowercase
```

---

## Why This Matters

**Encrypted backup ensures:**
- ✅ Recovery if .env file gets corrupted/deleted
- ✅ Audit trail of all secrets
- ✅ Centralized secret discovery
- ✅ Rotation tracking
- ✅ Never lose critical credentials

**Without backup:**
- ❌ Lost .env = lost production credentials = service down
- ❌ No way to know what secrets existed
- ❌ Must ask user to regenerate everything

---

## Verification

**After storing a secret, verify it worked:**

```javascript
// Store
mcp__meta__set_secret({
  keyPath: 'project/consilio/test_key',
  value: 'test-value'
})

// Verify (should return same value)
const result = mcp__meta__get_secret({
  keyPath: 'project/consilio/test_key'
})
// result.value should be 'test-value'
```

---

## Detailed Documentation

**Complete secrets management guide:**
- `/home/samuel/sv/supervisor-service-s/docs/SECRETS_MANAGEMENT.md`

**Production secrets analysis:**
- `/home/samuel/sv/supervisor-service-s/docs/PRODUCTION_SECRETS_ANALYSIS.md`

**Migration scripts:**
- `/home/samuel/sv/supervisor-service-s/src/scripts/migrate-env-secrets.ts`

---

**Remember: Store FIRST, .env SECOND. No exceptions.**

**Last Updated**: 2026-01-21
