# Folder Structure

**Project**: Supervisor Service (Meta Infrastructure)
**Last Updated**: 2026-01-27

This document describes the folder structure of the supervisor-service-s project and how it aligns with the standard Project-Supervisor (PS) pattern used across all SV projects.

---

## Standard PS Pattern

All project-supervisors in the SV system follow a common folder structure pattern:

```
/home/samuel/sv/{project}/
├── .agents/              # Agent context and plans
│   ├── context/          # Subagent context files
│   └── plans/            # Subagent plan files
├── .bmad/                # BMAD planning artifacts
├── .claude/              # Shared subagent commands
├── .github/              # CI/CD workflows
│   └── workflows/        # GitHub Actions workflows
├── .supervisor-specific/ # Project-specific deployment/status docs
├── docs/                 # Documentation
├── migrations/           # Database migrations
├── scripts/              # Utility scripts
├── src/                  # Source code
├── tests/                # Test suites
├── .env.example          # Environment template
├── .gitignore            # Git ignore rules
├── CLAUDE.md             # Auto-generated instructions
├── package.json          # Dependencies and scripts
├── README.md             # Project overview
└── tsconfig.json         # TypeScript configuration
```

---

## Meta-Supervisor Specific Structure

The meta-supervisor (MS) follows the standard PS pattern with additional meta-specific directories:

### Standard Directories

- **`.agents/`** - Agent execution context
  - `context/` - Subagent context files
  - `plans/` - Subagent execution plans
  - `active-piv.json` - Active PIV loop state

- **`.bmad/`** - BMAD planning artifacts
  - `adr/` - Architecture Decision Records
  - `epics/` - Epic definitions
  - `features/` - Feature planning
  - `prd/` - Product Requirements Documents
  - `reports/` - Implementation reports
  - And more...

- **`.claude/`** - Shared subagent commands (symlink to `/home/samuel/sv/.claude/commands/`)

- **`.github/`** - CI/CD workflows
  - `workflows/test.yml` - Test automation
  - `workflows/instruction-validation.yml` - Instruction validation

- **`.supervisor-specific/`** - Deployment and status documentation
  - `02-deployment-status.md` - Current deployment status

- **`docs/`** - Documentation
  - `api/` - API documentation
  - `guides/` - How-to guides
  - `handoffs/` - Session handoffs
  - `setup/` - Setup guides
  - `templates/` - Document templates

- **`migrations/`** - Database migrations (PostgreSQL)

- **`scripts/`** - Utility scripts

- **`src/`** - Source code (TypeScript)
  - `db/` - Database client and queries
  - `instructions/` - Instruction assembly logic
  - `mcp/` - MCP server implementation
  - `monitoring/` - Health checks and metrics
  - `ports/` - Port allocation service
  - `secrets/` - Secrets management
  - `tunnel/` - Tunnel management
  - And more...

- **`tests/`** - Test suites
  - `ui/` - UI tests

### Meta-Specific Directories

These directories are unique to the meta-supervisor:

- **`.supervisor-core/`** - Core instruction templates
  - Template files for CLAUDE.md generation
  - Shared across all project-supervisors
  - Each file is 60-270 lines

- **`.supervisor-meta/`** - Meta-specific instructions
  - Meta-supervisor identity and configuration
  - Port allocation registry
  - Infrastructure patterns

- **`config/`** - Configuration files
  - Database configuration
  - MCP server configuration

- **`data/`** - Local data storage
  - SQLite databases
  - Temporary files

- **`dist/`** - Build output (TypeScript compiled to JavaScript)

- **`examples/`** - Example files and demos

- **`home/`** - Home directory simulation (for testing)

- **`systemd/`** - Systemd service files
  - Service definitions for production deployment

- **`templates/`** - Shared templates
  - Configuration templates
  - Document templates
  - Used by all project-supervisors

---

## Key Files

- **`CLAUDE.md`** - Auto-generated supervisor instructions
  - Generated from `.supervisor-core/`, `.supervisor-meta/`, and `.supervisor-specific/`
  - Regenerated via `npm run init-projects`
  - Should be under 50KB

- **`package.json`** - Node.js dependencies and scripts
  - Key scripts: `dev:mcp`, `build`, `test`, `migrate:up`

- **`tsconfig.json`** - TypeScript configuration
  - Strict mode enabled
  - ES modules

- **`.env`** - Environment variables (not committed)
  - Database credentials
  - MCP server port
  - Secrets (use vault first!)

- **`.env.example`** - Environment variable template

---

## Comparison with Other PSes

| Directory | Consilio | Odin | Health-Agent | MS | Purpose |
|-----------|----------|------|--------------|-----|---------|
| `.agents/` | ✅ | ✅ | ✅ | ✅ | Agent context |
| `.bmad/` | ✅ | ✅ | ✅ | ✅ | Planning artifacts |
| `.claude/` | ✅ | ✅ | ✅ | ✅ | Subagent commands |
| `.github/` | ✅ | ❌ | ✅ | ✅ | CI/CD workflows |
| `.supervisor-specific/` | ✅ | ✅ | ✅ | ✅ | Deployment docs |
| `.supervisor-core/` | ❌ | ❌ | ❌ | ✅ | Core instruction templates (meta only) |
| `.supervisor-meta/` | ❌ | ❌ | ❌ | ✅ | Meta-specific config (meta only) |
| `backend/` | ✅ | ❌ | ❌ | ❌ | Backend service |
| `frontend/` | ✅ | ❌ | ❌ | ❌ | Frontend service |
| `mcp_servers/` | ❌ | ✅ | ❌ | ❌ | MCP servers |
| `observability/` | ❌ | ❌ | ✅ | ❌ | Monitoring stack |

---

## Regenerating CLAUDE.md

The meta-supervisor is responsible for generating CLAUDE.md for all projects:

```bash
# Test generation for one project
npm run init-projects -- --project supervisor-service-s --verbose

# Regenerate all projects
npm run init-projects -- --verbose

# Verify sizes
wc -c /home/samuel/sv/*/CLAUDE.md
```

**Assembly logic**: See `src/instructions/InstructionAssembler.ts`

---

## Migration Notes

**2026-01-27**: MS structure validated against PS pattern
- ✅ Added `.github/workflows/` for CI/CD
- ✅ Updated `.gitignore` to match PS pattern
- ✅ Documented folder structure
- ✅ Verified all standard directories present
- ✅ Confirmed meta-specific directories are appropriate

**Previous structure**: MS already followed PS pattern, minimal changes needed

---

## References

- **PS Pattern Guide**: `/home/samuel/sv/docs/guides/project-structure-guide.md` (if exists)
- **Instruction System**: `/home/samuel/sv/docs/guides/instruction-system-maintenance.md`
- **Core Instructions**: `.supervisor-core/README.md`
