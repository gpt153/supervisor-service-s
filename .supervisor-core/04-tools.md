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
