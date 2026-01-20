# Multi-Agent CLI Integration

**Status**: Implemented
**Epic**: 013-multi-agent-cli-integration
**Last Updated**: 2026-01-20

---

## Overview

The multi-agent CLI integration routes tasks to different AI agents (Gemini, Codex, Claude Code) based on task complexity and quota availability, optimizing costs and quota usage.

## Architecture

```
┌─────────────────────────────────────────────┐
│        MultiAgentExecutor                    │
│  - Coordinates execution                     │
│  - Handles fallback logic                    │
└─────────────────┬───────────────────────────┘
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
┌───────────────┐   ┌───────────────┐
│  AgentRouter  │   │ QuotaManager  │
│  - Classifies │   │  - Tracks     │
│  - Routes     │   │    quota      │
└───────┬───────┘   └───────────────┘
        │
        ▼
┌───────────────────────────┐
│   TaskClassifier          │
│  - Analyzes complexity    │
│  - Determines task type   │
└───────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│  CLI Adapters                        │
│  - ClaudeCLIAdapter                  │
│  - GeminiCLIAdapter                  │
│  - CodexCLIAdapter                   │
└─────────────────────────────────────┘
```

## Components

### 1. TaskClassifier

Classifies tasks by:
- **Complexity**: simple, medium, complex
- **Type**: documentation, test-generation, bug-fix, refactoring, architecture, etc.
- **Security**: Flags security-critical tasks

**Examples**:
```typescript
const classifier = new TaskClassifier();

const task = {
  description: "Add authentication to the API",
  files: ["src/auth.ts", "src/middleware.ts"],
  estimatedLines: 200,
};

const classification = classifier.classify(task);
// Result: { complexity: 'complex', type: 'security', ... }
```

### 2. QuotaManager

Manages quota for each agent:
- Tracks remaining quota
- Auto-refreshes when reset time passes
- Provides availability checks

**Methods**:
- `getQuota(agent)` - Get quota status
- `hasQuota(agent)` - Check availability
- `decrementQuota(agent)` - Use quota
- `refreshQuotaIfNeeded(agent)` - Auto-refresh

### 3. AgentRouter

Routes tasks to optimal agent:
- Uses TaskClassifier to understand task
- Checks QuotaManager for availability
- Applies routing preferences
- Provides fallback options

**Routing Preferences**:

| Task Type | Preferred Agents |
|-----------|------------------|
| Documentation | Gemini → Codex → Claude |
| Bug fixes | Codex → Gemini → Claude |
| Architecture | Claude → Codex → Gemini |
| Security | Claude (only) |

| Complexity | Preferred Agents |
|------------|------------------|
| Simple | Gemini → Codex → Claude |
| Medium | Codex → Claude → Gemini |
| Complex | Claude → Codex → Gemini |

### 4. CLI Adapters

Each adapter handles:
- Command construction
- Process execution
- Output parsing
- Error handling

**Supported Agents**:

| Agent | Quota | Reset Period | Best For |
|-------|-------|--------------|----------|
| Gemini | 1000/day | 24 hours | Documentation, research, simple tasks |
| Codex | 150/5hr | 5 hours | Refactoring, debugging, API implementation |
| Claude | 1000/day | 24 hours | Complex tasks, architecture, security |

### 5. MultiAgentExecutor

High-level coordinator:
- Routes tasks automatically
- Executes with fallback
- Logs routing decisions
- Tracks execution metrics

## Database Schema

### agent_quota_status
Tracks quota for each agent:
```sql
CREATE TABLE agent_quota_status (
  id SERIAL PRIMARY KEY,
  agent_type VARCHAR(20) UNIQUE NOT NULL,
  remaining INTEGER NOT NULL,
  limit INTEGER NOT NULL,
  resets_at TIMESTAMP NOT NULL,
  available BOOLEAN NOT NULL DEFAULT true,
  last_updated TIMESTAMP DEFAULT NOW()
);
```

### agent_executions
Logs all task executions:
```sql
CREATE TABLE agent_executions (
  id SERIAL PRIMARY KEY,
  agent_type VARCHAR(20) NOT NULL,
  task_type VARCHAR(50),
  complexity VARCHAR(20),
  success BOOLEAN NOT NULL,
  duration_ms INTEGER NOT NULL,
  cost DECIMAL(10, 4) DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### agent_routing_decisions
Logs routing decisions:
```sql
CREATE TABLE agent_routing_decisions (
  id SERIAL PRIMARY KEY,
  selected_agent VARCHAR(20) NOT NULL,
  reason TEXT NOT NULL,
  task_type VARCHAR(50),
  complexity VARCHAR(20),
  confidence DECIMAL(3, 2),
  fallback_agents TEXT[],
  execution_id INTEGER REFERENCES agent_executions(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

## MCP Tools

### get-agent-quotas
Get quota status for all agents.

**Response**:
```json
{
  "success": true,
  "quotas": [
    {
      "agent": "gemini",
      "remaining": 850,
      "limit": 1000,
      "resetsAt": "2026-01-21T00:00:00Z",
      "available": true,
      "percentageUsed": 15
    }
  ]
}
```

### execute-with-routing
Execute task with automatic routing.

**Parameters**:
- `prompt` (required): Task prompt
- `description` (required): Task description for classification
- `files` (optional): Files to be modified
- `estimatedLines` (optional): Lines of code estimate
- `securityCritical` (optional): Security flag
- `timeout` (optional): Timeout in ms

**Response**:
```json
{
  "success": true,
  "output": { ... },
  "agent": "gemini",
  "duration": 3500,
  "cost": 0,
  "routing": {
    "selectedAgent": "gemini",
    "reason": "Best match for documentation (simple) with quota available",
    "complexity": "simple",
    "taskType": "documentation",
    "confidence": 0.85
  }
}
```

### force-agent-selection
Execute with specific agent, bypassing routing.

**Parameters**:
- `agent` (required): gemini | codex | claude
- `prompt` (required): Task prompt
- `timeout` (optional): Timeout in ms

### get-routing-stats
Get routing statistics.

**Parameters**:
- `since` (optional): ISO timestamp

**Response**:
```json
{
  "success": true,
  "stats": {
    "totalDecisions": 150,
    "decisionsByAgent": {
      "gemini": 80,
      "codex": 45,
      "claude": 25
    },
    "decisionsByComplexity": {
      "simple": 90,
      "medium": 40,
      "complex": 20
    },
    "averageConfidence": 0.78
  }
}
```

### check-agent-health
Check CLI availability and quota.

**Response**:
```json
{
  "success": true,
  "agents": {
    "gemini": { "available": false, "hasQuota": true },
    "codex": { "available": false, "hasQuota": true },
    "claude": { "available": true, "hasQuota": true }
  },
  "summary": {
    "totalAgents": 3,
    "availableAgents": 1,
    "agentsWithQuota": 3
  }
}
```

### refresh-agent-quota
Force refresh quota for an agent.

**Parameters**:
- `agent` (required): Agent to refresh

## Installation Requirements

### Required CLI Tools

**Claude Code** (installed):
```bash
claude --version  # 2.1.12
```

**Gemini CLI** (pending):
```bash
# Install from: https://github.com/google-gemini/gemini-cli
npm install -g @google/gemini-cli
gemini auth login
```

**Codex/ChatGPT CLI** (pending):
```bash
# Install from OpenAI or similar
npm install -g openai-cli
codex auth login
```

### Quota Setup

Quotas are initialized automatically via migration:
- Gemini: 1000 requests/day
- Codex: 150 requests/5hr
- Claude: 1000 requests/day

## Usage Examples

### Programmatic Usage

```typescript
import { MultiAgentExecutor } from './agents/multi';

const executor = new MultiAgentExecutor();

// Execute with automatic routing
const { result, routing } = await executor.execute({
  prompt: 'Generate unit tests for UserService',
  description: 'Generate unit tests',
  cwd: '/path/to/project',
  files: ['src/services/UserService.ts'],
  estimatedLines: 100,
  outputFormat: 'json',
});

console.log(`Executed with: ${routing.selectedAgent}`);
console.log(`Reason: ${routing.reason}`);
console.log(`Output:`, result.output);

// Execute with specific agent
const result = await executor.executeWithAgent(
  {
    prompt: 'Refactor this function',
    cwd: '/path/to/project',
    outputFormat: 'json',
  },
  'codex'
);
```

### MCP Tool Usage

From Claude.ai or supervisor sessions:
```
Use tool: get-agent-quotas
# Check which agents have quota

Use tool: execute-with-routing
Parameters:
  prompt: "Add error handling to API endpoints"
  description: "Add error handling"
  files: ["src/api/routes.ts"]
  estimatedLines: 50

# System routes to best agent automatically
```

## Cost Savings

**Before Multi-Agent**:
- All tasks use Claude API
- Estimated: $2-5 per PIV cycle
- Monthly: $150-300 for moderate usage

**After Multi-Agent**:
- 70%+ tasks use subscription-included quota
- Estimated: $0.50-1 per PIV cycle
- Monthly: $30-80 for moderate usage
- **Savings: 60-80%**

## Fallback Logic

When primary agent fails or lacks quota:
1. Try next preferred agent
2. Try any available agent
3. Fall back to Claude (forced)

**Example Flow**:
```
Task: Generate docs
Classification: simple
Preferred: gemini → codex → claude

1. Try gemini → No quota
2. Try codex → Not installed
3. Try claude → Success!
```

## Monitoring

### Check Health
```bash
# Via MCP tool
check-agent-health

# Via database
SELECT * FROM agent_quota_status;
```

### View Stats
```bash
# Via MCP tool
get-routing-stats

# Via database
SELECT
  agent_type,
  COUNT(*) as executions,
  AVG(duration_ms) as avg_duration,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful
FROM agent_executions
GROUP BY agent_type;
```

## Troubleshooting

### Agent Not Available

**Check**: CLI installed?
```bash
which claude gemini codex
```

**Fix**: Install missing CLI

### Quota Exhausted

**Check**: Quota status
```bash
# Use tool: get-agent-quotas
```

**Fix**: Wait for reset or force refresh
```bash
# Use tool: refresh-agent-quota
# agent: "gemini"
```

### All Agents Failing

**Check**: Logs
```sql
SELECT * FROM agent_executions
WHERE success = false
ORDER BY created_at DESC
LIMIT 10;
```

**Fix**: Check error messages, verify CLI auth

## Future Enhancements

1. **ML-Based Routing**: Learn which agent performs best for each task type
2. **Batch Execution**: Queue multiple tasks per CLI
3. **Quality Scoring**: Rate output quality, adjust routing
4. **API Fallback**: Use paid APIs when all quotas exhausted
5. **Cost Dashboard**: Real-time visualization

---

## References

- Epic: `.bmad/epics/013-multi-agent-cli-integration.md`
- Migration: `migrations/*_agent-quota-tracking.js`
- Source: `src/agents/multi/`
- MCP Tools: `src/mcp/tools/multi-agent-tools.ts`
