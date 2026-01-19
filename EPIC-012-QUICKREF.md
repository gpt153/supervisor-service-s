# EPIC-012: Auto Secret Detection - Quick Reference

**One-page guide for using automatic secret detection**

---

## Installation

```bash
cd /home/samuel/sv/supervisor-service
npm install
npm run build
```

No additional configuration needed. Uses existing secrets infrastructure.

---

## Supported Secret Types

| Provider | Pattern | Example | Confidence |
|----------|---------|---------|------------|
| Anthropic | `sk-ant-api03-...` | `sk-ant-api03-aaaa...` | 1.0 |
| OpenAI | `sk-...` (48 chars) | `sk-aaaa...` | 1.0 |
| Google | `AIza...` | `AIzaSyAaaa...` | 1.0 |
| Stripe Live | `sk_live_...` | `sk_live_aaaa...` | 1.0 |
| Stripe Test | `sk_test_...` | `sk_test_aaaa...` | 1.0 |
| GitHub PAT | `ghp_...` | `ghp_aaaa...` | 1.0 |
| AWS Access | `AKIA...` | `AKIAIOSFODNN7EXAMPLE` | 1.0 |
| PostgreSQL | `postgresql://...` | `postgresql://user:pass@host/db` | 0.8 |
| MongoDB | `mongodb://...` | `mongodb://user:pass@host/db` | 0.8 |

---

## MCP Tools

### 1. Detect Secrets

```typescript
mcp__meta__detect_secrets({
  text: "My key is sk-ant-api03-...",
  question: "What is your API key?", // Optional
  projectName: "consilio",            // Optional
  autoStore: true                     // Auto-save detected secrets
})
```

**Returns**:
```json
{
  "success": true,
  "count": 1,
  "stored": 1,
  "secrets": [
    {
      "type": "anthropic",
      "keyPath": "meta/anthropic/api_key",
      "description": "Anthropic API key for Claude",
      "confidence": 1.0
    }
  ]
}
```

### 2. Create API Key

```typescript
mcp__meta__create_api_key({
  provider: "google",
  projectName: "consilio",
  permissions: ["gemini"]
})
```

**Supported**: Google, Gemini, Stripe, GitHub
**Manual**: Anthropic, OpenAI (returns instructions)

### 3. Check for Secrets

```typescript
mcp__meta__check_for_secrets({
  text: "This is my API key: sk_live_..."
})
```

**Returns**:
```json
{
  "success": true,
  "containsSecrets": true,
  "message": "Text contains potential secrets"
}
```

### 4. Redact Secrets

```typescript
mcp__meta__redact_secrets({
  text: "Key: sk-ant-api03-abc123...xyz789"
})
```

**Returns**:
```json
{
  "success": true,
  "redactedText": "Key: sk-a...789"
}
```

---

## Programmatic Usage

### Basic Detection

```typescript
import { AutoSecretDetector } from './secrets';

const detector = new AutoSecretDetector();

// Detect
const detection = detector.detectSecret(userInput);

if (detection) {
  console.log(`Found: ${detection.type}`);
  console.log(`Path: ${detection.keyPath}`);
  console.log(`Confidence: ${detection.confidence}`);
}
```

### With Context

```typescript
const detection = detector.detectSecret(value, {
  question: "What is your Stripe key?",
  projectName: "consilio",
  serviceName: "payments"
});
```

### Auto-Store

```typescript
import { AutoSecretDetector, SecretsManager } from './secrets';

const detector = new AutoSecretDetector();
const manager = new SecretsManager();

const detection = detector.detectSecret(userInput, context);

if (detection) {
  await manager.set({
    keyPath: detection.keyPath,
    value: detection.value,
    description: detection.description,
  });

  console.log(`✅ Stored ${detection.description} securely`);
}
```

### Extract Multiple

```typescript
const text = `
  Anthropic: sk-ant-api03-...
  OpenAI: sk-...
  Stripe: sk_live_...
`;

const secrets = detector.extractAllSecrets(text, {
  projectName: "consilio"
});

console.log(`Found ${secrets.length} secrets`);
```

### Safe Logging

```typescript
// NEVER log secrets directly!
// console.log(userInput); // ❌ BAD

// Always redact first
const safe = detector.redactSecrets(userInput);
console.log(safe); // ✅ GOOD
```

---

## Key Path Hierarchy

```
meta/
  anthropic/api_key          # Shared across all projects
  openai/api_key
  google/api_key
  github/pat
  cloudflare/api_token

project/
  consilio/
    stripe_secret_key        # Project-specific
    database_url
    backend/                 # Service-specific
      jwt_secret

  openhorizon/
    google_api_key
    database_url
```

---

## Confidence Levels

| Level | Range | Meaning |
|-------|-------|---------|
| Very High | 1.0 | Exact pattern match (Anthropic, OpenAI, etc.) |
| High | 0.8 | Strong pattern (Database URLs, Stripe) |
| Medium | 0.7 | Context-based detection |
| Low | 0.6 | Generic pattern (UUID, etc.) |

**Best Practice**: Only auto-store secrets with confidence ≥ 0.7

---

## Common Workflows

### User Provides Secret

```typescript
// 1. Supervisor asks
const question = "What is your Stripe API key for consilio?";
const answer = await askUser(question);

// 2. Auto-detect
const detection = detector.detectSecret(answer, {
  question,
  projectName: "consilio"
});

// 3. Auto-store
if (detection) {
  await manager.set({
    keyPath: detection.keyPath,
    value: detection.value,
    description: detection.description,
  });

  console.log(`✅ Stored ${detection.description} securely`);
  console.log(`✅ I'll use this automatically when needed`);
}
```

### Scan User Message

```typescript
const message = `
  Here are my credentials:
  Anthropic: sk-ant-api03-...
  Stripe: sk_live_...
`;

const secrets = detector.extractAllSecrets(message, {
  projectName: "consilio"
});

for (const secret of secrets) {
  await manager.set({
    keyPath: secret.keyPath,
    value: secret.value,
    description: secret.description,
  });
}

console.log(`✅ Stored ${secrets.length} secrets securely`);
```

### Pre-Commit Check

```typescript
// Check if code contains secrets
const code = readFileSync('script.js', 'utf-8');

if (detector.containsSecrets(code)) {
  console.error('❌ Code contains secrets! Please remove.');
  process.exit(1);
}
```

---

## Error Handling

### Secret Not Detected

```typescript
const detection = detector.detectSecret(value, {
  question: "What is your API key?",
  projectName: "consilio"
});

if (!detection) {
  // Fallback to manual storage
  await manager.set({
    keyPath: "project/consilio/api_key",
    value: value,
    description: "API key"
  });
}
```

### Low Confidence

```typescript
const detection = detector.detectSecret(value);

if (detection && detection.confidence < 0.7) {
  // Ask user to confirm
  const confirmed = await askUser(
    `Is this a ${detection.type}? (y/n)`
  );

  if (confirmed === 'y') {
    await manager.set({ ... });
  }
}
```

---

## Security Best Practices

1. **Always redact before logging**
   ```typescript
   console.log(detector.redactSecrets(message));
   ```

2. **Never expose secrets in responses**
   ```typescript
   // Don't return detection.value
   return {
     type: detection.type,
     keyPath: detection.keyPath,
     // value: detection.value, // ❌ NO!
   };
   ```

3. **Use high confidence thresholds**
   ```typescript
   if (detection.confidence >= 0.8) {
     await manager.set({ ... });
   }
   ```

4. **Always provide context**
   ```typescript
   detector.detectSecret(value, {
     question: lastQuestion,
     projectName: currentProject
   });
   ```

5. **Check access logs regularly**
   ```sql
   SELECT * FROM secret_access_log
   WHERE success = false
   ORDER BY accessed_at DESC;
   ```

---

## Testing

### Unit Tests

```bash
npm test -- AutoSecretDetector.test.ts
```

### Integration Tests

```bash
npm test -- auto-secret-integration.test.ts
```

### Manual Test

```typescript
import { AutoSecretDetector } from './secrets';

const detector = new AutoSecretDetector();

// Test Anthropic
console.log(detector.detectSecret('sk-ant-api03-' + 'a'.repeat(95)));

// Test Stripe
console.log(detector.detectSecret('sk_live_' + 'b'.repeat(24)));

// Test Context
console.log(detector.detectSecret('mykey123', {
  question: 'What is your Stripe key?'
}));
```

---

## API Reference

### AutoSecretDetector

```typescript
class AutoSecretDetector {
  // Detect single secret
  detectSecret(value: string, context?: DetectionContext): SecretDetection | null;

  // Extract all secrets from text
  extractAllSecrets(text: string, context?: DetectionContext): SecretDetection[];

  // Check if text contains secrets
  containsSecrets(text: string): boolean;

  // Redact secrets for safe logging
  redactSecrets(text: string): string;
}
```

### Types

```typescript
interface SecretDetection {
  type: string;
  value: string;
  keyPath: string;
  description: string;
  confidence: number;
}

interface DetectionContext {
  question?: string;
  projectName?: string;
  serviceName?: string;
}
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Secret not detected | Add context (question, project name) |
| False positive | Check confidence score |
| Wrong key path | Verify project/service name in context |
| Redaction too aggressive | Check pattern regex |

---

## Related Files

- **Implementation**: `/home/samuel/sv/supervisor-service/src/secrets/AutoSecretDetector.ts`
- **Manager**: `/home/samuel/sv/supervisor-service/src/secrets/APIKeyManager.ts`
- **MCP Tools**: `/home/samuel/sv/supervisor-service/src/mcp/tools/secrets-tools.ts`
- **Tests**: `/home/samuel/sv/supervisor-service/src/__tests__/AutoSecretDetector.test.ts`
- **Docs**: `/home/samuel/sv/supervisor-service/docs/AUTO_SECRET_DETECTION.md`

---

**Status**: ✅ Production Ready
**Version**: 1.0.0
**Date**: 2026-01-18
