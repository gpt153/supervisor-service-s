# Automatic Secret Detection

**EPIC-012 Implementation**

Automatically detect and store API keys and secrets from user input with zero manual configuration.

---

## Overview

The Auto Secret Detection system automatically:

1. **Detects** API keys and secrets using pattern matching
2. **Validates** detected secrets with confidence scoring
3. **Stores** secrets automatically in encrypted storage
4. **Never logs** secret values (automatic redaction)
5. **Confirms** to user that secret was stored

---

## Key Features

### 1. Pattern Recognition

Supports automatic detection of:

- **Anthropic** API keys (`sk-ant-api03-...`)
- **OpenAI** API keys (`sk-...`)
- **Google/Gemini** API keys (`AIza...`)
- **Stripe** API keys (live, test, publishable, restricted)
- **GitHub** tokens (PAT, OAuth, App)
- **AWS** credentials (access key, secret key)
- **Cloudflare** API tokens
- **Database URLs** (PostgreSQL, MongoDB, MySQL, Redis)
- **JWT tokens**
- **Generic patterns** (Bearer tokens, UUIDs)

### 2. Context-Based Detection

When patterns don't match, uses context from:

- Question asked to user
- Project name
- Service name
- Keywords in conversation

### 3. Automatic Storage

Detected secrets are automatically:

- Encrypted with AES-256-GCM
- Stored in hierarchical key paths
- Tagged with appropriate descriptions
- Never shown in logs or outputs

### 4. Secret Redaction

All secrets are automatically redacted in:

- Log files
- Error messages
- Console output
- API responses

---

## Usage

### Via MCP Tools

#### Detect Secrets in Text

```typescript
// Detect secrets (doesn't store)
const result = await mcp__meta__detect_secrets({
  text: 'My key is sk-ant-api03-...',
  question: 'What is your Anthropic key?',
  projectName: 'consilio',
});

// Result:
{
  success: true,
  count: 1,
  secrets: [
    {
      type: 'anthropic',
      keyPath: 'meta/anthropic/api_key',
      description: 'Anthropic API key for Claude',
      confidence: 1.0
    }
  ]
}
```

#### Detect and Store Automatically

```typescript
// Auto-detect and store
const result = await mcp__meta__detect_secrets({
  text: 'sk-ant-api03-...',
  autoStore: true,
  projectName: 'consilio',
});

// Result:
{
  success: true,
  count: 1,
  stored: 1,
  secrets: [
    {
      type: 'anthropic',
      keyPath: 'meta/anthropic/api_key',
      description: 'Anthropic API key for Claude',
      confidence: 1.0
    }
  ]
}
```

#### Check for Secrets

```typescript
// Check if text contains secrets
const result = await mcp__meta__check_for_secrets({
  text: 'This is my API key: sk_live_...'
});

// Result:
{
  success: true,
  containsSecrets: true,
  message: 'Text contains potential secrets'
}
```

#### Redact Secrets

```typescript
// Redact secrets for logging
const result = await mcp__meta__redact_secrets({
  text: 'Key: sk-ant-api03-abc123...xyz789'
});

// Result:
{
  success: true,
  redactedText: 'Key: sk-a...789'
}
```

#### Create API Key

```typescript
// Get or create API key for provider
const result = await mcp__meta__create_api_key({
  provider: 'google',
  projectName: 'consilio',
  permissions: ['gemini']
});

// For supported providers (Google, Stripe, GitHub):
{
  success: true,
  automated: true,
  provider: 'google',
  keyId: 'projects/.../serviceAccounts/.../keys/...',
  message: 'API key created automatically for google'
}

// For unsupported providers (Anthropic, OpenAI):
{
  success: false,
  automated: false,
  provider: 'anthropic',
  message: 'Automatic creation not supported for anthropic. Please provide the API key manually using mcp__meta__set_secret.',
  supportedProviders: ['google', 'gemini', 'stripe', 'github']
}
```

### Programmatic Usage

```typescript
import { AutoSecretDetector, SecretsManager } from './secrets';

const detector = new AutoSecretDetector();
const secretsManager = new SecretsManager();

// Detect secret
const detection = detector.detectSecret(userInput, {
  question: 'What is your API key?',
  projectName: 'consilio',
});

if (detection) {
  // Store automatically
  await secretsManager.set({
    keyPath: detection.keyPath,
    value: detection.value,
    description: detection.description,
    createdBy: 'auto_detection',
  });

  console.log(`Stored ${detection.description} securely`);
}
```

---

## Supported Providers

### Fully Supported (Pattern + Auto-Creation)

| Provider | Pattern Detection | Auto-Creation | Key Path |
|----------|------------------|---------------|----------|
| Google/Gemini | ✅ `AIza...` | ✅ Via Service Accounts | `meta/google/api_key` |
| Stripe | ✅ `sk_live_...`, `pk_live_...` | ✅ Via Restricted Keys API | `project/{name}/stripe_*_key` |
| GitHub | ✅ `ghp_...`, `gho_...` | ✅ Via App Tokens | `meta/github/pat` |

### Pattern Detection Only

| Provider | Pattern | Auto-Creation | Key Path |
|----------|---------|---------------|----------|
| Anthropic | ✅ `sk-ant-api03-...` | ❌ Manual | `meta/anthropic/api_key` |
| OpenAI | ✅ `sk-...` (48 chars) | ❌ Manual | `meta/openai/api_key` |
| AWS | ✅ `AKIA...` | ❌ Manual | `meta/aws/access_key` |
| Cloudflare | ✅ 40-char token | ❌ Manual | `meta/cloudflare/api_token` |

### Context Detection

| Type | Keywords | Pattern | Key Path |
|------|----------|---------|----------|
| Database | "database", "postgres", "mongodb" | Connection URLs | `project/{name}/database_url` |
| Password | "password", "secret" | 8+ chars | `project/{name}/password` |
| JWT | "jwt", "token" | `eyJ...` | `project/{name}/jwt_secret` |

---

## Automatic Workflows

### Workflow 1: User Provides Secret

```
Supervisor: "I need a Stripe API key for consilio"
User: "sk_live_abc123xyz..."

Auto-detection:
  1. Detect pattern: stripe_live_secret
  2. Generate path: project/consilio/stripe_secret_key
  3. Store encrypted value
  4. Log access (no value)
  5. Confirm to user

Supervisor: "✅ Stored Stripe live secret key for consilio securely
             ✅ I'll use this automatically when needed"
```

### Workflow 2: Multiple Secrets

```
User: "Here are my keys:
       Anthropic: sk-ant-api03-...
       OpenAI: sk-...
       Stripe: sk_live_..."

Auto-detection:
  1. Extract all secrets (3 found)
  2. Store each with appropriate path
  3. Track all in access log

Supervisor: "✅ Stored 3 secrets securely:
             - Anthropic API key for Claude
             - OpenAI API key
             - Stripe live secret key for consilio"
```

### Workflow 3: Safe Logging

```
User provides: sk-ant-api03-abc123...xyz789

Before logging: detector.redactSecrets(message)
Logged message: "User provided key: sk-a...789"

Secret never appears in:
  - Console logs
  - Error messages
  - Database logs
  - API responses
```

---

## Key Path Hierarchy

Secrets are stored in hierarchical paths:

### Meta-Level (Shared)

```
meta/anthropic/api_key         # Claude API key
meta/openai/api_key            # OpenAI API key
meta/google/api_key            # Google/Gemini API key
meta/github/pat                # GitHub personal access token
meta/cloudflare/api_token      # Cloudflare API token
meta/aws/access_key            # AWS access key
meta/aws/secret_key            # AWS secret key
```

### Project-Level

```
project/consilio/stripe_secret_key        # Stripe for Consilio
project/consilio/database_url             # Database for Consilio
project/openhorizon/google_api_key        # Google for OpenHorizon
project/health-agent/openai_api_key       # OpenAI for Health Agent
```

### Service-Level

```
project/consilio/backend/jwt_secret       # JWT for backend service
project/odin/frontend/api_key             # API key for frontend
```

---

## Pattern Matching Details

### Anthropic

```
Pattern: ^sk-ant-api03-[a-zA-Z0-9-_]{95,}$
Example: sk-ant-api03-abc123...xyz789
Confidence: 1.0 (very high)
```

### OpenAI

```
Pattern: ^sk-[a-zA-Z0-9]{48}$
Example: sk-abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGH
Confidence: 1.0 (very high)
```

### Google/Gemini

```
Pattern: ^AIza[0-9A-Za-z-_]{35}$
Example: AIzaSyAbc123Xyz789...
Confidence: 1.0 (very high)
```

### Stripe

```
Live Secret:    ^sk_live_[a-zA-Z0-9]{24,}$
Test Secret:    ^sk_test_[a-zA-Z0-9]{24,}$
Publishable:    ^pk_(live|test)_[a-zA-Z0-9]{24,}$
Restricted:     ^rk_(live|test)_[a-zA-Z0-9]{24,}$
Confidence: 1.0 (very high)
```

### GitHub

```
PAT:     ^ghp_[a-zA-Z0-9]{36}$
OAuth:   ^gho_[a-zA-Z0-9]{36}$
App:     ^(ghu|ghs)_[a-zA-Z0-9]{36}$
Refresh: ^ghr_[a-zA-Z0-9]{36}$
Confidence: 1.0 (very high)
```

### Database URLs

```
PostgreSQL: ^postgres(ql)?:\/\/.+$
MongoDB:    ^mongodb(\+srv)?:\/\/.+$
MySQL:      ^mysql:\/\/.+$
Redis:      ^redis:\/\/.+$
Confidence: 0.8 (high)
```

---

## Security Features

### 1. Encryption

All detected secrets are encrypted with:

- **Algorithm**: AES-256-GCM
- **Unique IV**: Per secret
- **Auth Tag**: Prevents tampering
- **Key Storage**: Environment variable only

### 2. Redaction

Secrets are automatically redacted in:

- Log files (console, file, database)
- Error messages
- API responses
- Debug output

**Redaction format**:
- Short secrets (≤12 chars): `[REDACTED]`
- Long secrets: `sk-a...789` (first 4 + last 4)

### 3. Access Logging

Every secret access is logged:

```sql
SELECT * FROM secret_access_log;

key_path                    | accessed_by      | access_type | success
---------------------------|------------------|-------------|--------
meta/anthropic/api_key     | auto_detection   | create      | true
meta/anthropic/api_key     | supervisor       | read        | true
project/consilio/stripe... | deployment       | read        | true
```

### 4. No Value Exposure

Secret values NEVER appear in:

- MCP tool responses
- API responses
- Log files
- Error messages
- Database queries (only encrypted)

---

## API Reference

### AutoSecretDetector

```typescript
class AutoSecretDetector {
  /**
   * Detect if string is a secret
   */
  detectSecret(value: string, context?: DetectionContext): SecretDetection | null;

  /**
   * Extract all secrets from text
   */
  extractAllSecrets(text: string, context?: DetectionContext): SecretDetection[];

  /**
   * Check if text contains secrets
   */
  containsSecrets(text: string): boolean;

  /**
   * Redact secrets from text
   */
  redactSecrets(text: string): string;
}
```

### Types

```typescript
interface SecretDetection {
  type: string;              // 'anthropic', 'openai', etc.
  value: string;             // The actual secret
  keyPath: string;           // Where to store it
  description: string;       // Human-readable description
  confidence: number;        // 0.0 - 1.0
}

interface DetectionContext {
  question?: string;         // Question asked to user
  projectName?: string;      // Current project
  serviceName?: string;      // Current service
}
```

---

## Examples

### Example 1: Anthropic Key Detection

```typescript
const detector = new AutoSecretDetector();

const key = 'sk-ant-api03-abc123...xyz789';
const detection = detector.detectSecret(key);

console.log(detection);
// {
//   type: 'anthropic',
//   value: 'sk-ant-api03-abc123...xyz789',
//   keyPath: 'meta/anthropic/api_key',
//   description: 'Anthropic API key for Claude',
//   confidence: 1.0
// }
```

### Example 2: Context-Based Detection

```typescript
const detector = new AutoSecretDetector();

const value = 'mySecretKey123';
const detection = detector.detectSecret(value, {
  question: 'What is your Stripe API key for consilio?',
  projectName: 'consilio',
});

console.log(detection);
// {
//   type: 'stripe_api',
//   value: 'mySecretKey123',
//   keyPath: 'project/consilio/stripe_api_key',
//   description: 'Stripe API key for consilio',
//   confidence: 0.7
// }
```

### Example 3: Multiple Secrets

```typescript
const detector = new AutoSecretDetector();

const text = `
  Anthropic: sk-ant-api03-...
  OpenAI: sk-...
  Stripe: sk_live_...
`;

const secrets = detector.extractAllSecrets(text, {
  projectName: 'consilio',
});

console.log(secrets.length); // 3
```

### Example 4: Safe Logging

```typescript
const detector = new AutoSecretDetector();

const message = 'User key: sk-ant-api03-abc123...xyz789';
const safe = detector.redactSecrets(message);

console.log(safe);
// 'User key: sk-a...789'
```

---

## Integration with Secrets Manager

Auto-detected secrets integrate seamlessly with SecretsManager:

```typescript
import { AutoSecretDetector, SecretsManager } from './secrets';

const detector = new AutoSecretDetector();
const manager = new SecretsManager();

// User provides input
const userInput = 'sk-ant-api03-...';

// Auto-detect
const detection = detector.detectSecret(userInput);

if (detection) {
  // Auto-store
  await manager.set({
    keyPath: detection.keyPath,
    value: detection.value,
    description: detection.description,
    createdBy: 'auto_detection',
  });

  console.log(`✅ Stored ${detection.description}`);
}

// Later: retrieve
const apiKey = await manager.get({
  keyPath: 'meta/anthropic/api_key',
  accessedBy: 'supervisor',
});
```

---

## Testing

### Unit Tests

```bash
npm test -- AutoSecretDetector.test.ts
```

Covers:
- Pattern matching for all providers
- Context-based detection
- Key path generation
- Description generation
- Secret redaction
- Contains/extract methods
- Edge cases

### Integration Tests

```bash
npm test -- auto-secret-integration.test.ts
```

Covers:
- Detect and store workflow
- Multiple secrets
- Database encryption verification
- Access logging
- Safe logging with redaction

---

## Troubleshooting

### Secret Not Detected

**Problem**: User provides secret but it's not detected

**Solutions**:
1. Check pattern matches supported providers
2. Provide context (question, project name)
3. Use manual storage via `mcp__meta__set_secret`

### False Positives

**Problem**: Regular text detected as secret

**Solutions**:
1. Check confidence score (should be ≥0.7)
2. Review pattern matching regex
3. Add exception to detector

### Redaction Too Aggressive

**Problem**: Legitimate text being redacted

**Solutions**:
1. Check patterns in detector
2. Adjust redaction format
3. Whitelist specific patterns

---

## Best Practices

1. **Always use auto-detection for user input**
   ```typescript
   const detection = detector.detectSecret(userInput, context);
   ```

2. **Never log secrets directly**
   ```typescript
   const safe = detector.redactSecrets(message);
   console.log(safe);
   ```

3. **Provide context when possible**
   ```typescript
   detector.detectSecret(value, {
     question: lastQuestion,
     projectName: currentProject,
   });
   ```

4. **Check confidence before storing**
   ```typescript
   if (detection && detection.confidence >= 0.7) {
     await manager.set({ ... });
   }
   ```

5. **Use access logging**
   ```typescript
   await manager.get({
     keyPath: '...',
     accessedBy: 'service_name', // Always specify!
   });
   ```

---

## MCP Tools Summary

| Tool | Purpose | Auto-Store |
|------|---------|-----------|
| `mcp__meta__detect_secrets` | Detect secrets in text | Optional |
| `mcp__meta__create_api_key` | Get/create API key | Yes |
| `mcp__meta__check_for_secrets` | Check if text has secrets | No |
| `mcp__meta__redact_secrets` | Redact secrets from text | No |

---

## Future Enhancements

### Planned

- [ ] Azure API key patterns
- [ ] SendGrid API keys
- [ ] Twilio credentials
- [ ] JWT secret strength validation
- [ ] Secret rotation reminders
- [ ] Duplicate detection

### Under Consideration

- [ ] ML-based detection (beyond patterns)
- [ ] Secret strength scoring
- [ ] Automatic key rotation
- [ ] Integration with 1Password/Vault
- [ ] Browser extension for detection

---

## Related Documentation

- **Secrets Management**: `/home/samuel/sv/supervisor-service/docs/SECRETS_MANAGEMENT.md`
- **EPIC-003**: `/home/samuel/sv/supervisor-service/EPIC-003-COMPLETE.md`
- **Design Doc**: `/home/samuel/sv/.bmad/infrastructure/automatic-secrets-and-api-key-creation.md`

---

**Status**: ✅ Implemented (EPIC-012)
**Date**: 2026-01-18
**Version**: 1.0.0
