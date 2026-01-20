# Multi-Agent MCP Tools Reference

**Last Updated**: 2026-01-20

Quick reference for all MCP tools available in the multi-agent CLI integration system.

---

## Core Multi-Agent Tools

### `get-agent-quotas`
Get quota status for all AI agents.

**Parameters:** None

**Returns:**
```json
{
  "success": true,
  "quotas": [
    {
      "agent": "gemini",
      "remaining": 2850000,
      "limit": 3000000,
      "resetsAt": "2026-01-21T00:00:00.000Z",
      "available": true,
      "percentageUsed": 5
    }
  ]
}
```

### `execute-with-routing`
Execute task with automatic agent routing.

**Parameters:**
```json
{
  "prompt": "Write a function to validate email addresses",
  "description": "Email validation utility",
  "files": ["src/utils/validation.ts"],
  "estimatedLines": 20,
  "securityCritical": false,
  "timeout": 60000
}
```

**Returns:**
```json
{
  "success": true,
  "output": {...},
  "agent": "codex",
  "duration": 2345,
  "routing": {
    "selectedAgent": "codex",
    "reason": "Best for bug fixes with available quota",
    "complexity": "medium",
    "taskType": "bug-fix",
    "confidence": 0.85
  }
}
```

### `force-agent-selection`
Execute with specific agent, bypassing routing.

**Parameters:**
```json
{
  "agent": "gemini",
  "prompt": "Explain REST API principles",
  "timeout": 30000
}
```

**Returns:**
```json
{
  "success": true,
  "output": {...},
  "agent": "gemini",
  "duration": 1523
}
```

### `get-routing-stats`
Get agent routing decision statistics.

**Parameters:**
```json
{
  "since": "2026-01-20T00:00:00.000Z"
}
```

**Returns:**
```json
{
  "success": true,
  "stats": {
    "totalDecisions": 156,
    "decisionsByAgent": {
      "gemini": 78,
      "codex": 45,
      "claude": 33
    },
    "decisionsByComplexity": {
      "simple": 62,
      "medium": 71,
      "complex": 23
    },
    "averageConfidence": 0.87
  },
  "period": "Since 2026-01-20T00:00:00.000Z"
}
```

### `check-agent-health`
Check health and availability of all agents.

**Parameters:** None

**Returns:**
```json
{
  "success": true,
  "agents": {
    "gemini": {
      "available": true,
      "hasQuota": true,
      "installed": true
    },
    "codex": {
      "available": true,
      "hasQuota": false,
      "installed": true
    },
    "claude": {
      "available": false,
      "hasQuota": true,
      "installed": false
    }
  },
  "summary": {
    "totalAgents": 3,
    "availableAgents": 2,
    "agentsWithQuota": 2
  }
}
```

### `refresh-agent-quota`
Force refresh quota for specific agent.

**Parameters:**
```json
{
  "agent": "codex"
}
```

**Returns:**
```json
{
  "success": true,
  "agent": "codex",
  "quota": {
    "remaining": 150,
    "limit": 150,
    "resetsAt": "2026-01-20T13:30:00.000Z"
  }
}
```

---

## Gemini Key Management Tools

### `get-gemini-keys`
Get all Gemini API keys and their status.

**Parameters:**
```json
{
  "availableOnly": false
}
```

**Returns:**
```json
{
  "success": true,
  "keys": [
    {
      "id": 1,
      "keyName": "env_key_1",
      "accountEmail": "user1@gmail.com",
      "dailyQuota": 1000000,
      "currentUsage": 125000,
      "remaining": 875000,
      "percentageUsed": 13,
      "quotaResetsAt": "2026-01-21T00:00:00.000Z",
      "isActive": true,
      "priority": 0,
      "lastUsedAt": "2026-01-20T08:45:23.000Z"
    }
  ],
  "total": 3,
  "totalRemaining": 2650000
}
```

### `add-gemini-key`
Add new Gemini API key to rotation.

**Parameters:**
```json
{
  "keyName": "personal_account_1",
  "apiKey": "AIzaSyABCDEF123456...",
  "accountEmail": "yourname@gmail.com",
  "dailyQuota": 1000000,
  "priority": 0,
  "notes": "Primary personal Gmail account"
}
```

**Required:** `keyName`, `apiKey`

**Returns:**
```json
{
  "success": true,
  "keyId": 4,
  "message": "Added Gemini API key: personal_account_1"
}
```

### `remove-gemini-key`
Remove Gemini API key from rotation.

**Parameters:**
```json
{
  "keyId": 2
}
```

**Returns:**
```json
{
  "success": true,
  "message": "Removed Gemini API key with ID 2"
}
```

### `toggle-gemini-key`
Enable or disable a Gemini API key.

**Parameters:**
```json
{
  "keyId": 3,
  "enabled": false
}
```

**Returns:**
```json
{
  "success": true,
  "message": "Disabled Gemini API key with ID 3"
}
```

### `get-gemini-key-stats`
Get usage statistics for Gemini keys.

**Parameters:**
```json
{
  "since": "2026-01-20T00:00:00.000Z"
}
```

**Returns:**
```json
{
  "success": true,
  "totalRequests": 245,
  "totalTokens": 785000,
  "successRate": 98.37,
  "keyStats": {
    "env_key_1": {
      "requests": 120,
      "tokens": 380000,
      "successRate": 99.17
    },
    "env_key_2": {
      "requests": 85,
      "tokens": 275000,
      "successRate": 97.65
    },
    "env_key_3": {
      "requests": 40,
      "tokens": 130000,
      "successRate": 97.50
    }
  },
  "period": "Since 2026-01-20T00:00:00.000Z"
}
```

### `init-gemini-keys`
Load keys from environment variables.

**Parameters:** None

**Environment variables read:**
- `GEMINI_KEY_1`
- `GEMINI_KEY_2`
- `GEMINI_KEY_3`
- ... up to `GEMINI_KEY_10`
- `GOOGLE_API_KEY` (fallback)
- `GEMINI_API_KEY` (fallback)

**Returns:**
```json
{
  "success": true,
  "loadedCount": 3,
  "message": "Loaded 3 Gemini API keys from environment"
}
```

---

## Tool Usage Patterns

### Initial Setup

```typescript
// 1. Load keys from environment
Use MCP tool: init-gemini-keys

// 2. Verify keys loaded
Use MCP tool: get-gemini-keys
Parameters: { "availableOnly": false }

// 3. Check agent health
Use MCP tool: check-agent-health
```

### Daily Operations

```typescript
// Execute tasks with automatic routing
Use MCP tool: execute-with-routing
Parameters: {
  "prompt": "Your task here",
  "description": "Brief description"
}

// Check quota status
Use MCP tool: get-agent-quotas

// View Gemini key status
Use MCP tool: get-gemini-keys
Parameters: { "availableOnly": true }
```

### Monitoring

```typescript
// Get routing statistics
Use MCP tool: get-routing-stats
Parameters: { "since": "2026-01-20T00:00:00.000Z" }

// Get Gemini key usage
Use MCP tool: get-gemini-key-stats
Parameters: { "since": "2026-01-20T00:00:00.000Z" }

// Check agent health
Use MCP tool: check-agent-health
```

### Key Management

```typescript
// Add new key
Use MCP tool: add-gemini-key
Parameters: {
  "keyName": "new_account",
  "apiKey": "AIza..."
}

// Disable temporary key
Use MCP tool: toggle-gemini-key
Parameters: { "keyId": 3, "enabled": false }

// Re-enable key
Use MCP tool: toggle-gemini-key
Parameters: { "keyId": 3, "enabled": true }

// Remove old key
Use MCP tool: remove-gemini-key
Parameters: { "keyId": 2 }
```

### Troubleshooting

```typescript
// All keys exhausted?
Use MCP tool: get-gemini-keys
Parameters: { "availableOnly": true }

// Check specific agent
Use MCP tool: force-agent-selection
Parameters: {
  "agent": "gemini",
  "prompt": "test"
}

// Refresh quota manually
Use MCP tool: refresh-agent-quota
Parameters: { "agent": "gemini" }
```

---

## Error Responses

### No Available Keys

```json
{
  "success": false,
  "output": null,
  "error": "No Gemini API keys available (all exhausted quota)",
  "agent": "gemini"
}
```

**Solution:** Wait for quota reset or add more keys

### Invalid Key ID

```json
{
  "success": false,
  "error": "Key with ID 99 not found"
}
```

**Solution:** Check key ID with `get-gemini-keys`

### Duplicate Key Name

```json
{
  "success": false,
  "error": "Key with name 'env_key_1' already exists"
}
```

**Solution:** Use different key name or update existing key

### Agent Not Available

```json
{
  "success": false,
  "error": "claude adapter is disabled"
}
```

**Solution:** Check agent health with `check-agent-health`

---

## Best Practices

### Key Rotation

1. **Use priority for cost optimization:**
   - Free keys: `priority: 0`
   - Paid keys: `priority: 100`

2. **Load balance at same priority:**
   - Set all free keys to `priority: 0`
   - System automatically balances by `current_usage`

3. **Monitor usage regularly:**
   ```typescript
   Use MCP tool: get-gemini-key-stats
   ```

### Quota Management

1. **Check quota before large batches:**
   ```typescript
   Use MCP tool: get-agent-quotas
   ```

2. **Use routing for optimal agent selection:**
   ```typescript
   Use MCP tool: execute-with-routing
   // Don't manually pick agents
   ```

3. **Set reasonable timeouts:**
   ```json
   { "timeout": 60000 }  // 1 minute for most tasks
   ```

### Security

1. **Never commit API keys:**
   - Store in environment variables
   - Add `.env` to `.gitignore`

2. **Rotate keys periodically:**
   - Every 6-12 months
   - Immediately if compromised

3. **Use separate keys per environment:**
   - Development: Keys 1-3
   - Production: Different keys

---

## Quick Reference

| Task | Tool | Key Parameters |
|------|------|----------------|
| Execute task | `execute-with-routing` | `prompt`, `description` |
| Check quotas | `get-agent-quotas` | None |
| View keys | `get-gemini-keys` | `availableOnly` |
| Add key | `add-gemini-key` | `keyName`, `apiKey` |
| Remove key | `remove-gemini-key` | `keyId` |
| Toggle key | `toggle-gemini-key` | `keyId`, `enabled` |
| Load keys | `init-gemini-keys` | None |
| Get stats | `get-gemini-key-stats` | `since` (optional) |
| Force agent | `force-agent-selection` | `agent`, `prompt` |
| Check health | `check-agent-health` | None |

---

**See also:**
- Setup guide: `/home/samuel/sv/supervisor-service-s/docs/gemini-key-rotation-setup.md`
- Main docs: `/home/samuel/sv/supervisor-service-s/docs/multi-agent-integration.md`
