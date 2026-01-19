# Meta Infrastructure Dependencies

## Technology Stack

### Runtime
- **Node.js**: v20+ (ES modules)
- **TypeScript**: v5.3+ (strict mode)

### Database
- **PostgreSQL**: v14+
- **node-pg-migrate**: Database migrations
- **pg**: PostgreSQL client

### Development
- **tsx**: TypeScript execution and watch mode
- **@types/node**: Node.js type definitions
- **@types/pg**: PostgreSQL type definitions

## External Services

### Required
- PostgreSQL database (configured via .env)
- File system access for instruction management

### Optional
- GitHub API (for issue sync - future)
- Prometheus (for metrics - future)

## Environment Variables

Required in `.env`:

```
PGUSER=supervisor
PGHOST=localhost
PGDATABASE=supervisor_meta
PGPASSWORD=<password>
PGPORT=5432
```

## Shared Dependencies

This service depends on shared resources in `/home/samuel/sv/`:

- `.claude/commands/` - Command templates
- `docs/` - Documentation
- `templates/` - Shared templates
- `.bmad/` - Planning artifacts

**DO NOT** modify these shared resources without coordination across all projects.

## Version Management

- Use semantic versioning for package.json
- Lock file (package-lock.json) committed to repo
- Regular dependency updates via npm audit
