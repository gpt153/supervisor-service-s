# Available Tools and Commands

## Shared Commands

Access via `/home/samuel/sv/.claude/commands/`:

### Analysis and Planning
- `analyze.md` - Analyst agent for codebase analysis
- `create-epic.md` - PM agent for epic creation
- `create-adr.md` - Architect agent for ADR creation
- `plan-feature.md` - Meta-orchestrator for feature planning

### Supervision
- `supervision/supervise.md` - Full project supervision
- `supervision/piv-supervise.md` - PIV-specific supervision
- `supervision/prime-supervisor.md` - Context priming

## AI Service Selection (via Odin)

**CRITICAL: Query Odin BEFORE spawning subagents to get the most cost-effective AI service.**

### Workflow

1. **Get Recommendation** from Odin MCP server:
```python
rec = mcp__odin__recommend_ai_service(
    task_type="code_generation",  # or testing, architecture, etc.
    estimated_tokens=5000,
    complexity="simple"  # simple, medium, or complex
)
```

2. **Execute with Recommended Service AND Model**:
```bash
# Use the CLI command + model from recommendation
bash(f"{rec['cli_command']} 'implement user authentication' . {rec['model']}")

# Example outputs:
# - scripts/ai/gemini_agent.sh . gemini-2.5-flash-lite (fast, free)
# - scripts/ai/codex_agent.sh . gpt-4o-mini (affordable, good for code)
# - scripts/ai/claude_agent.sh . claude-opus-4-5-20251101 (best reasoning)
```

**Model Selection**: Odin automatically picks the optimal model within each service:
- **Simple tasks**: claude-haiku-4-5 / gpt-4o-mini / gemini-2.5-flash-lite (fast, cheap)
- **Medium tasks**: claude-sonnet-4-5-20250929 / gpt-4.1 / gemini-3-pro-preview (balanced)
- **Complex tasks**: claude-opus-4-5-20251101 / o3 / gemini-3-pro-preview (best reasoning)

3. **Usage Tracked Automatically** - Odin logs tokens/cost/model for billing

### Available MCP Tools (Odin)

**Service Routing:**
- `mcp__odin__recommend_ai_service(task_type, estimated_tokens, complexity)` → service + CLI command
- `mcp__odin__get_service_quotas()` → quota status for all services
- `mcp__odin__track_ai_usage(service, tokens_used, task_type)` → manual usage logging

**Cost Monitoring:**
- `mcp__odin__get_usage_summary(days)` → usage across all services
- `mcp__odin__get_cost_breakdown(days)` → detailed cost analysis
- `mcp__odin__forecast_monthly_cost(service)` → predict monthly costs

### Task Type Mapping

| Task Type | Best Service | Reason |
|-----------|--------------|--------|
| `code_generation` | Codex or Gemini | Optimized for code, free/cheap |
| `testing` | Gemini or Codex | Pattern-based, doesn't need Claude |
| `documentation` | Gemini | Excellent for docs, free |
| `architecture` | Claude MAX | Complex reasoning required |
| `planning` | Claude MAX | Strategic thinking needed |
| `debugging` | Codex | Code-focused, good debugging |
| `review` | Claude or Codex | Either works well |
| `refactoring` | Codex | Code transformation focus |

### Complexity Guidelines

- **simple**: Basic CRUD, straightforward implementations
- **medium**: Standard features with moderate logic
- **complex**: Multi-system integration, advanced algorithms, architecture

### Example: Full Workflow

```python
# Step 1: Get recommendation
rec = mcp__odin__recommend_ai_service(
    task_type="code_generation",
    estimated_tokens=3000,
    complexity="simple"
)

# Odin returns:
# {
#   "service": "gemini",
#   "reason": "Google Gemini: free tier available, optimized for code generation",
#   "estimated_cost": "$0.0000",
#   "quota_remaining": "980,000 tokens",
#   "cli_command": "scripts/ai/gemini_agent.sh"
# }

# Step 2: Execute with recommended service
result = bash(f"{rec['cli_command']} 'Write Python function to validate email addresses'")

# Step 3: Usage tracked automatically by CLI wrapper
```

### Cost Optimization Rules

**DO:**
- ✅ Always query Odin first
- ✅ Use Gemini for 60%+ of simple tasks (free)
- ✅ Reserve Claude MAX for architecture/planning only
- ✅ Check quotas before large tasks

**DON'T:**
- ❌ Manually pick service without Odin
- ❌ Use Claude MAX for simple code generation
- ❌ Ignore quota warnings
- ❌ Forget to track usage

### Monitoring

**Check quotas anytime:**
```python
quotas = mcp__odin__get_service_quotas()
# Shows remaining tokens for gemini, codex, claude, claude-max
```

**View cost breakdown:**
```python
costs = mcp__odin__get_cost_breakdown(days=30)
# See spending per service for last 30 days
```

---

**Implementation**: Epic 009 - AI Service Router
**Maintained by**: Odin Project-Supervisor

## Meta-Specific Tools

### MCP Server Tools

Exposed via `supervisor-service` MCP:

- `mcp__meta__regenerate_supervisor` - Regenerate supervisor CLAUDE.md
- `mcp__meta__update_core_instruction` - Update core instruction files
- `mcp__meta__get_service_status` - Check service health
- `mcp__meta__query_issues` - Query issue database

### Database Scripts

```bash
npm run migrate:up        # Apply migrations
npm run migrate:down      # Rollback migrations
npm run db:seed          # Seed development data
```

### Development Tools

```bash
npm run dev              # Watch mode development
npm run build            # Compile TypeScript
npm run test             # Run test suite
```

## External Integrations

- **PostgreSQL**: Issue tracking and metrics
- **GitHub**: Issue synchronization (future)
- **Prometheus**: Metrics export (future)
