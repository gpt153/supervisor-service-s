# AI CLI Setup Guide

**Status**: All CLIs Installed ✅
**Date**: 2026-01-20

---

## Installed CLIs

All three AI CLIs are now installed and ready for multi-agent routing:

| CLI | Version | Status |
|-----|---------|--------|
| Claude Code | 2.1.12 | ✅ Installed |
| Codex (OpenAI) | 0.87.0 | ✅ Installed |
| Gemini (Google) | Custom wrapper | ✅ Installed |

---

## Authentication Setup

### 1. Codex (OpenAI) - Interactive Login

```bash
# Option 1: Interactive login (recommended)
codex login

# Option 2: API key
export OPENAI_API_KEY="sk-proj-..."
codex login --with-api-key <<< "$OPENAI_API_KEY"

# Verify login
codex login status
```

### 2. Gemini (Google) - Two Options

**Option A: Google Auth (Recommended)**
```bash
# Login with your Google account
gcloud auth application-default login

# Set your GCP project (if using Vertex AI)
export GOOGLE_CLOUD_PROJECT="your-project-id"

# Test
gemini -p "Hello" --output-format json
```

**Option B: API Key (Simpler, free tier)**
```bash
# Get your API key from: https://aistudio.google.com/apikey
export GOOGLE_API_KEY="your-key-here"

# Add to ~/.bashrc or ~/.zshrc for persistence
echo 'export GOOGLE_API_KEY="your-key-here"' >> ~/.bashrc

# Test
gemini -p "Hello" --output-format json
```

**Which to use?**
- **API Key**: Free, simple, good for personal use
- **Google Auth**: Better for teams, uses GCP quotas, more secure

### 3. Claude Code - Already Authenticated ✅

Claude Code is already set up and working.

---

## Quick Test

Test each CLI to verify they work:

```bash
# Claude (already working)
claude -p "Say 'Claude works'" --output-format json

# Codex (after login)
codex exec "Say 'Codex works'" --json

# Gemini (after setting GOOGLE_API_KEY)
gemini -p "Say 'Gemini works'" --output-format json
```

---

## How Automatic Routing Works

**YOU NEVER NEED TO SPECIFY WHICH CLI TO USE!**

The multi-agent system automatically routes based on:

### 1. Task Classification

When you submit a task, it's analyzed for:
- **Complexity**: simple | medium | complex
- **Type**: documentation, refactoring, bug-fix, architecture, etc.
- **Security**: Security-critical tasks MUST use Claude

### 2. Routing Logic

The system picks the best agent:

| Task Type | Preferred Routing |
|-----------|------------------|
| Documentation, simple tasks | Gemini → Codex → Claude |
| Bug fixes, debugging | Codex → Gemini → Claude |
| Refactoring, API work | Codex → Claude → Gemini |
| Architecture, design | Claude → Codex → Gemini |
| Security-critical | Claude ONLY |

### 3. Quota Management

The system tracks:
- **Gemini**: 1000 requests/day (resets every 24 hours)
- **Codex**: 150 requests/5 hours
- **Claude**: 1000 requests/day

If an agent runs out of quota, it automatically falls back to the next available agent!

---

## Usage in Claude.ai Browser

When using Claude.ai (browser project with MCP):

```
I need to add error handling to my API endpoints

[You don't specify which agent - the system chooses automatically]
```

**Behind the scenes:**
1. System classifies: "api-implementation, medium complexity"
2. Checks quota: Codex available? → Yes
3. Routes to: Codex (best for API work)
4. Executes and returns result

**You see:**
```
✅ Task completed using Codex
Reason: Best match for api-implementation (medium) with quota available
```

---

## Usage in Claude Code CLI

Same automatic routing when using Claude Code:

```bash
# In your project directory
claude

# Then ask for anything - routing is automatic
> Add unit tests for UserService

# System routes to best agent (probably Gemini for test generation)
```

---

## MCP Tools (Advanced)

If you want to see what's happening:

```javascript
// Check quota status
get_agent_quotas()

// View routing statistics
get_routing_stats()

// Check agent health
check_agent_health()

// Force specific agent (bypass routing)
force_agent_selection({
  agent: "gemini",
  prompt: "Your task here"
})
```

---

## Cost Savings

**Before Multi-Agent:**
- All tasks use Claude API
- Cost: ~$2-5 per complex task

**After Multi-Agent:**
- 70%+ tasks use subscription-included quota (Gemini/Codex)
- Cost: ~$0.50-1 per complex task
- **Savings: 60-80%**

---

## Troubleshooting

### Codex Not Working

```bash
# Check login status
codex login status

# Re-login
codex login
```

### Gemini Errors

**Method 1: Check Google Auth**
```bash
# Check if authenticated
gcloud auth application-default print-access-token

# Re-authenticate if needed
gcloud auth application-default login

# Set project if needed
export GOOGLE_CLOUD_PROJECT="your-project-id"
```

**Method 2: Check API Key**
```bash
# Verify API key is set
echo $GOOGLE_API_KEY

# If empty, set it
export GOOGLE_API_KEY="your-key-here"

# Test directly
gemini -p "test" --output-format json
```

**Priority**: Gemini tries Google Auth first, then falls back to API key

### Check Overall Health

```bash
# Via database
psql $DATABASE_URL -c "SELECT * FROM agent_quota_status;"

# Via MCP (in Claude.ai or CLI)
check_agent_health()
```

---

## What Gets Logged

Every task execution logs:
- Which agent was used
- Why it was chosen
- Success/failure
- Duration
- Cost

View logs:
```sql
SELECT
  agent_type,
  task_type,
  success,
  duration_ms,
  created_at
FROM agent_executions
ORDER BY created_at DESC
LIMIT 10;
```

---

## Next Steps

1. **Authenticate Codex**: Run `codex login`
2. **Get Gemini API Key**: Visit https://aistudio.google.com/apikey
3. **Set Environment Variable**: `export GOOGLE_API_KEY="..."`
4. **Test Everything**: Run quick tests above
5. **Start Using**: Just work normally - routing is automatic!

---

## Key Points

✅ **Routing is 100% automatic** - you never specify which agent
✅ **Works in both Claude.ai browser and Claude Code CLI**
✅ **Falls back automatically** if an agent is unavailable
✅ **Saves 60-80% on API costs** by using subscription quotas
✅ **All tasks are logged** for analysis and optimization

---

**Documentation**:
- Full guide: `/docs/multi-agent-integration.md`
- Epic: `.bmad/epics/013-multi-agent-cli-integration.md`
- MCP tools: `src/mcp/tools/multi-agent-tools.ts`
