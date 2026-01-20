# Multi-Agent CLI Integration

Intelligent routing system for distributing tasks across multiple AI CLI agents (Gemini, Codex, Claude Code) based on task complexity and quota availability.

## Quick Start

```typescript
import { MultiAgentExecutor } from './agents/multi';

const executor = new MultiAgentExecutor();

// Execute with automatic routing
const { result, routing } = await executor.execute({
  prompt: 'Generate unit tests for UserService',
  description: 'Generate unit tests',
  cwd: '/path/to/project',
  files: ['src/services/UserService.ts'],
  outputFormat: 'json',
});

console.log(`Routed to: ${routing.selectedAgent}`);
console.log(`Output:`, result.output);
```

## Components

### TaskClassifier
Analyzes tasks to determine:
- **Complexity**: simple | medium | complex
- **Type**: documentation, refactoring, bug-fix, architecture, etc.
- **Security**: Flags security-critical tasks

### QuotaManager
Tracks quota usage for each agent:
- Auto-refreshes when quota resets
- Provides availability checks
- Logs usage to database

### AgentRouter
Routes tasks intelligently:
- Considers task complexity
- Checks quota availability
- Applies agent preferences
- Provides fallback options

### CLI Adapters
- **ClaudeCLIAdapter**: Complex tasks, architecture, security
- **GeminiCLIAdapter**: Documentation, research, simple tasks (1000/day quota)
- **CodexCLIAdapter**: Refactoring, debugging, APIs (150/5hr quota)

## Routing Logic

| Task Type | Preferred Order |
|-----------|----------------|
| Documentation | Gemini → Codex → Claude |
| Bug fixes | Codex → Gemini → Claude |
| Refactoring | Codex → Claude → Gemini |
| Architecture | Claude → Codex → Gemini |
| Security | Claude (only) |

## MCP Tools

Available via supervisor MCP server:

- `get-agent-quotas` - Check quota status
- `execute-with-routing` - Auto-route task
- `force-agent-selection` - Use specific agent
- `get-routing-stats` - View statistics
- `check-agent-health` - Health check
- `refresh-agent-quota` - Force refresh

## Database Tables

- `agent_quota_status` - Quota tracking
- `agent_executions` - Execution logs
- `agent_routing_decisions` - Routing logs

## Installation

Currently only Claude Code is installed:
```bash
claude --version  # 2.1.12
```

Pending installations:
```bash
# Gemini CLI
npm install -g @google/gemini-cli

# Codex CLI
npm install -g openai-cli
```

## Cost Savings

**Before**: All tasks use Claude API (~$2-5 per PIV cycle)

**After**: 70%+ tasks use subscription-included quota (~$0.50-1 per PIV cycle)

**Savings: 60-80% reduction**

## Files

- `types.ts` - TypeScript type definitions
- `CLIAdapter.ts` - Base adapter class
- `ClaudeCLIAdapter.ts` - Claude Code adapter
- `GeminiCLIAdapter.ts` - Gemini adapter
- `CodexCLIAdapter.ts` - Codex adapter
- `TaskClassifier.ts` - Task classification
- `QuotaManager.ts` - Quota management
- `AgentRouter.ts` - Routing logic
- `MultiAgentExecutor.ts` - High-level coordinator
- `index.ts` - Public exports

## Documentation

See `/docs/multi-agent-integration.md` for detailed documentation.

## Epic

Epic 013: `.bmad/epics/013-multi-agent-cli-integration.md`
