# Gemini API Key Rotation Setup Guide

**Last Updated**: 2026-01-20

Complete guide for setting up and using automatic Gemini API key rotation with multiple free accounts.

---

## Overview

The multi-agent system supports **automatic rotation** of multiple Gemini API keys:
- Store multiple API keys in database
- Automatically rotate when one exhausts quota
- Priority-based key selection
- Per-key usage tracking
- 1M tokens/day per key (free tier)

**Benefits:**
- ✅ 3M+ tokens/day with 3 accounts (FREE)
- ✅ Automatic failover when quota exhausted
- ✅ Usage analytics per account
- ✅ Zero manual intervention

---

## Part 1: Create Gmail Accounts

### Why Personal Gmail Accounts?

**Recommended:** Use free personal Gmail accounts

| Option | Cost | Tokens/Day | Setup Time |
|--------|------|------------|------------|
| **Personal Gmail** | $0 | 1M per account | 5 minutes |
| Google Workspace | $6/user/month | 1M per account | 30 minutes |
| GCP Service Accounts | N/A | Won't work | N/A |

**Google Workspace is not worth it** - you're paying $18/mo for 3 accounts when personal Gmail is free.

### Steps to Create Gmail Accounts

**Create 2-3 accounts:**

1. Go to https://accounts.google.com/signup
2. Fill out account details
   - Name: Any name
   - Username: Pick available username
   - Password: Strong password (save it!)
3. Verify with phone number
   - Can reuse same phone for multiple accounts
   - Google allows ~3 accounts per phone
4. Complete security setup
5. Done! Account created

**Repeat for 2-3 total accounts.**

**Example accounts:**
```
yourname.dev1@gmail.com
yourname.dev2@gmail.com
yourname.dev3@gmail.com
```

---

## Part 2: Get API Keys

### Get Gemini API Key from Each Account

**For EACH Gmail account:**

1. Log into the account
2. Go to https://aistudio.google.com/apikey
3. Click **"Create API key"**
4. Copy the key (starts with `AIza...`)
5. Save it somewhere secure

**You'll have:**
```
Account 1: AIzaSyABCDEF123456...
Account 2: AIzaSyGHIJKL789012...
Account 3: AIzaSyMNOPQR345678...
```

**Important:**
- Each key is tied to ONE Google account
- Each gets 1M tokens/day quota
- Keys don't expire (unless revoked)
- Free tier, no payment required

---

## Part 3: Configure Environment

### Set Environment Variables

**In your shell or `.bashrc`:**

```bash
# Set Gemini API keys (one per account)
export GEMINI_KEY_1="AIzaSyABCDEF123456..."  # Account 1
export GEMINI_KEY_2="AIzaSyGHIJKL789012..."  # Account 2
export GEMINI_KEY_3="AIzaSyMNOPQR345678..."  # Account 3

# Optional: Add account emails for tracking
export GEMINI_EMAIL_1="yourname.dev1@gmail.com"
export GEMINI_EMAIL_2="yourname.dev2@gmail.com"
export GEMINI_EMAIL_3="yourname.dev3@gmail.com"
```

**Make permanent:**
```bash
cat >> ~/.bashrc << 'EOF'
# Gemini API Keys
export GEMINI_KEY_1="AIzaSyABCDEF123456..."
export GEMINI_KEY_2="AIzaSyGHIJKL789012..."
export GEMINI_KEY_3="AIzaSyMNOPQR345678..."
EOF

source ~/.bashrc
```

**Verify:**
```bash
echo $GEMINI_KEY_1  # Should print your key
echo $GEMINI_KEY_2
echo $GEMINI_KEY_3
```

---

## Part 4: Load Keys into System

### Option A: Automatic (Recommended)

Use MCP tool to auto-load from environment:

```typescript
// In supervisor session (browser or CLI)
Use MCP tool: mcp__meta__init-gemini-keys

// Output:
{
  "success": true,
  "loadedCount": 3,
  "message": "Loaded 3 Gemini API keys from environment"
}
```

**What it does:**
- Reads `GEMINI_KEY_1`, `GEMINI_KEY_2`, etc.
- Creates database entries for each
- Sets priority: Key 1 = highest priority
- Skips keys already in database

### Option B: Manual

Add keys manually via MCP tool:

```typescript
// Add first key
Use MCP tool: mcp__meta__add-gemini-key

Parameters:
{
  "keyName": "personal_account_1",
  "apiKey": "AIzaSyABCDEF123456...",
  "accountEmail": "yourname.dev1@gmail.com",
  "dailyQuota": 1000000,
  "priority": 0,
  "notes": "Primary personal Gmail account"
}

// Add second key
Use MCP tool: mcp__meta__add-gemini-key

Parameters:
{
  "keyName": "personal_account_2",
  "apiKey": "AIzaSyGHIJKL789012...",
  "accountEmail": "yourname.dev2@gmail.com",
  "dailyQuota": 1000000,
  "priority": 1,
  "notes": "Secondary personal Gmail account"
}
```

---

## Part 5: Verify Setup

### Check Loaded Keys

```typescript
Use MCP tool: mcp__meta__get-gemini-keys

Parameters: {}

// Output:
{
  "success": true,
  "keys": [
    {
      "id": 1,
      "keyName": "env_key_1",
      "accountEmail": null,
      "dailyQuota": 1000000,
      "currentUsage": 0,
      "remaining": 1000000,
      "percentageUsed": 0,
      "quotaResetsAt": "2026-01-21T08:30:00.000Z",
      "isActive": true,
      "priority": 0,
      "lastUsedAt": null
    },
    {
      "id": 2,
      "keyName": "env_key_2",
      "accountEmail": null,
      "dailyQuota": 1000000,
      "currentUsage": 0,
      "remaining": 1000000,
      "percentageUsed": 0,
      "quotaResetsAt": "2026-01-21T08:30:00.000Z",
      "isActive": true,
      "priority": 1,
      "lastUsedAt": null
    }
  ],
  "total": 2,
  "totalRemaining": 2000000
}
```

**What to look for:**
- ✅ `isActive: true` - Keys are enabled
- ✅ `remaining: 1000000` - Full quota available
- ✅ `priority: 0, 1, 2...` - Priority order set

### Test Execution

```typescript
Use MCP tool: mcp__meta__execute-with-routing

Parameters:
{
  "prompt": "Explain what a REST API is in 2 sentences",
  "description": "Simple documentation task"
}

// Output will show which key was used:
{
  "success": true,
  "output": "...",
  "agent": "gemini",
  "duration": 1523,
  "routing": {
    "selectedAgent": "gemini",
    "reason": "Best for documentation tasks with available quota"
  }
}
```

**Check key usage:**
```typescript
Use MCP tool: mcp__meta__get-gemini-keys

// You'll see currentUsage incremented
{
  "keys": [
    {
      "id": 1,
      "currentUsage": 150,  // ← Used tokens
      "remaining": 999850,
      "lastUsedAt": "2026-01-20T08:35:12.000Z"  // ← Last used
    }
  ]
}
```

---

## How Automatic Rotation Works

### Selection Algorithm

**When you execute a task:**

1. System calls `GeminiKeyManager.getNextAvailableKey()`
2. Manager queries database for available keys:
   ```sql
   SELECT * FROM gemini_api_keys
   WHERE is_active = true AND current_usage < daily_quota
   ORDER BY priority ASC, current_usage ASC
   LIMIT 1
   ```
3. Returns highest priority key with quota
4. If no keys available, returns `null`

### Execution Flow

```
Task Request
    ↓
Get next available key
    ↓
Has available key? ──NO──→ Return error: "All keys exhausted"
    ↓ YES
Execute with selected key
    ↓
Record usage in database
    ↓
Update current_usage
    ↓
Done
```

### Priority-Based Selection

**Priority determines order:**
- `priority: 0` = Highest priority (used first)
- `priority: 1` = Second priority
- `priority: 2` = Third priority

**Within same priority:**
- Key with lowest `current_usage` selected
- Balances load across keys at same priority

**Example:**
```
Key 1: priority=0, usage=500K   ← Selected (highest priority)
Key 2: priority=0, usage=800K
Key 3: priority=1, usage=100K   ← Not selected (lower priority)
```

### Automatic Quota Reset

**Daily at midnight:**
- Function `reset_gemini_quota()` runs
- Resets `current_usage = 0` for expired keys
- Updates `quota_resets_at` to next day
- Keys become available again

**Manual reset:**
```typescript
// If needed, can manually reset via database
UPDATE gemini_api_keys
SET current_usage = 0, quota_resets_at = NOW() + INTERVAL '24 hours'
WHERE id = 1;
```

---

## Management Operations

### View All Keys

```typescript
Use MCP tool: mcp__meta__get-gemini-keys

Parameters: {
  "availableOnly": false  // Show all keys (including exhausted)
}
```

### View Only Available Keys

```typescript
Use MCP tool: mcp__meta__get-gemini-keys

Parameters: {
  "availableOnly": true  // Only show keys with quota
}
```

### Disable a Key

```typescript
Use MCP tool: mcp__meta__toggle-gemini-key

Parameters: {
  "keyId": 2,
  "enabled": false
}

// Key will be skipped in rotation
```

### Enable a Key

```typescript
Use MCP tool: mcp__meta__toggle-gemini-key

Parameters: {
  "keyId": 2,
  "enabled": true
}

// Key will be included in rotation again
```

### Remove a Key

```typescript
Use MCP tool: mcp__meta__remove-gemini-key

Parameters: {
  "keyId": 2
}

// Key permanently deleted from database
// Usage logs are also deleted (CASCADE)
```

### Get Usage Statistics

```typescript
Use MCP tool: mcp__meta__get-gemini-key-stats

Parameters: {}

// Output:
{
  "success": true,
  "totalRequests": 45,
  "totalTokens": 125000,
  "successRate": 97.78,
  "keyStats": {
    "env_key_1": {
      "requests": 30,
      "tokens": 85000,
      "successRate": 96.67
    },
    "env_key_2": {
      "requests": 15,
      "tokens": 40000,
      "successRate": 100.0
    }
  },
  "period": "All time"
}
```

**Filter by date:**
```typescript
Use MCP tool: mcp__meta__get-gemini-key-stats

Parameters: {
  "since": "2026-01-20T00:00:00.000Z"
}
```

---

## Troubleshooting

### "No Gemini API keys available"

**Problem:** All keys exhausted quota

**Solutions:**
1. Wait for midnight reset (automatic)
2. Add more keys to rotation
3. Check if keys are active:
   ```typescript
   Use MCP tool: mcp__meta__get-gemini-keys
   // Look for isActive: false
   ```
4. Enable disabled keys:
   ```typescript
   Use MCP tool: mcp__meta__toggle-gemini-key
   Parameters: { "keyId": X, "enabled": true }
   ```

### Keys Not Loading from Environment

**Problem:** `init-gemini-keys` returns 0 loaded

**Solutions:**
1. Check environment variables:
   ```bash
   echo $GEMINI_KEY_1
   echo $GEMINI_KEY_2
   ```
2. Verify variable names (must be `GEMINI_KEY_1`, `GEMINI_KEY_2`, etc.)
3. Source .bashrc:
   ```bash
   source ~/.bashrc
   ```
4. Restart terminal or supervisor service

### High Usage on One Key

**Problem:** One key has 900K usage, others at 100K

**Solutions:**
1. Keys at same priority load-balance automatically
2. Check priorities are correct:
   ```typescript
   Use MCP tool: mcp__meta__get-gemini-keys
   // Verify priority values
   ```
3. Set all to same priority for even distribution:
   ```sql
   UPDATE gemini_api_keys SET priority = 0;
   ```

### API Key Invalid

**Problem:** Requests failing with "API key invalid"

**Solutions:**
1. Verify key still valid in AI Studio:
   - Go to https://aistudio.google.com/apikey
   - Check if key exists and not revoked
2. Regenerate key if revoked:
   - Delete old key in AI Studio
   - Create new key
   - Update in database:
     ```sql
     UPDATE gemini_api_keys
     SET api_key = 'NEW_KEY_HERE'
     WHERE id = X;
     ```
3. Test key directly:
   ```bash
   GEMINI_API_KEY="your_key" gemini -p "test"
   ```

---

## Cost Analysis

### With Key Rotation (3 accounts)

```
Setup Cost: $0
Monthly Cost: $0

Daily Quota: 3M tokens (3 x 1M)
Monthly Quota: 90M tokens

Estimated Usage:
- Multi-agent routing: ~300K tokens/day
- Remaining: 2.7M tokens/day unused
- Utilization: 10%

Savings vs Paid: $20/month (vs Gemini Advanced)
```

### Scaling Up

**If you need more:**
```
5 accounts = 5M tokens/day = 150M/month ($0)
10 accounts = 10M tokens/day = 300M/month ($0)
```

**At what point to pay?**
- Only if you need >10M tokens/day consistently
- Even then, pay-as-you-go is cheap: $0.075/1M tokens
- You'd need to use 15M tokens/day to spend $20/month

---

## Advanced Configuration

### Custom Quota Limits

**If a key has higher quota (e.g., paid tier):**

```typescript
Use MCP tool: mcp__meta__add-gemini-key

Parameters: {
  "keyName": "paid_account",
  "apiKey": "AIza...",
  "dailyQuota": 10000000,  // 10M tokens/day
  "priority": 0,  // Highest priority
  "notes": "Paid Gemini API tier"
}
```

### Priority Strategy

**Common strategies:**

**1. Cost Optimization (default)**
```
Free keys: priority=0 (use first)
Paid keys: priority=100 (use last, only if free exhausted)
```

**2. Performance Optimization**
```
Fast keys: priority=0
Slow keys: priority=10
```

**3. Account Protection**
```
Throwaway accounts: priority=0 (use first)
Primary account: priority=100 (use last)
```

### Database Direct Access

**View keys:**
```sql
SELECT id, key_name, current_usage, daily_quota, remaining, is_active, priority
FROM gemini_api_keys
ORDER BY priority ASC;
```

**View usage log:**
```sql
SELECT k.key_name, l.tokens_used, l.request_success, l.created_at
FROM gemini_key_usage_log l
JOIN gemini_api_keys k ON l.key_id = k.id
ORDER BY l.created_at DESC
LIMIT 20;
```

**Usage by key:**
```sql
SELECT k.key_name,
  COUNT(*) as requests,
  SUM(l.tokens_used) as total_tokens,
  ROUND(AVG(CASE WHEN l.request_success THEN 100 ELSE 0 END), 2) as success_rate
FROM gemini_key_usage_log l
JOIN gemini_api_keys k ON l.key_id = k.id
GROUP BY k.key_name;
```

---

## Security Best Practices

### Protect API Keys

**DO:**
- ✅ Store in environment variables
- ✅ Add `.env` to `.gitignore`
- ✅ Use database encryption for storage
- ✅ Rotate keys periodically (every 6-12 months)
- ✅ Keep keys in secure password manager

**DON'T:**
- ❌ Commit keys to git
- ❌ Share keys publicly
- ❌ Use same key across multiple services
- ❌ Store keys in plain text files

### Revoke Compromised Keys

**If key compromised:**

1. Revoke in AI Studio:
   - Go to https://aistudio.google.com/apikey
   - Delete the compromised key

2. Disable in system:
   ```typescript
   Use MCP tool: mcp__meta__toggle-gemini-key
   Parameters: { "keyId": X, "enabled": false }
   ```

3. Remove from database:
   ```typescript
   Use MCP tool: mcp__meta__remove-gemini-key
   Parameters: { "keyId": X }
   ```

4. Create new key and add to rotation

---

## Next Steps

1. ✅ Create 2-3 Gmail accounts
2. ✅ Get API keys from AI Studio
3. ✅ Set environment variables
4. ✅ Load keys into system
5. ✅ Verify setup with test execution
6. ✅ Monitor usage with MCP tools

**You now have automatic Gemini API key rotation working!**

**Benefits:**
- 3M+ tokens/day FREE
- Automatic failover
- Usage tracking per key
- Zero manual intervention

---

**Questions?** See main multi-agent documentation: `/home/samuel/sv/supervisor-service-s/docs/multi-agent-integration.md`
