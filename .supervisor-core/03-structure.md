# Meta Infrastructure Structure

## Directory Organization

```
/home/samuel/sv/supervisor-service/
├── .supervisor-core/          # Core instruction templates (this)
├── .supervisor-meta/          # Meta-specific instructions
├── src/
│   ├── db/                   # Database client and queries
│   ├── mcp/                  # MCP server implementation
│   ├── instructions/         # Instruction management
│   ├── monitoring/           # Health checks and metrics
│   ├── scripts/              # Utility scripts
│   └── types/                # TypeScript type definitions
├── migrations/               # Database migrations
├── tests/                    # Test suites
├── docs/                     # Service-specific documentation
└── CLAUDE.md                 # Auto-generated (DO NOT EDIT)
```

## Key Files

- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `.env` - Environment variables (not committed)
- `.env.example` - Template for environment setup

## Shared Resources

Located in `/home/samuel/sv/`:

- `.claude/commands/` - Shared subagent commands
- `templates/` - Shared templates
- `docs/` - System-wide documentation
- `.bmad/` - BMAD planning artifacts

## Database Schema

Managed via migrations in `migrations/`:

- Issues tracking
- Epic management
- Health metrics
- Service status
- Instruction versioning
