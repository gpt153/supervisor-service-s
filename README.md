# Supervisor Service

Meta infrastructure service for the SV supervisor system.

## Overview

This service provides the core infrastructure that powers all project supervisors:

- **Database**: PostgreSQL-based issue tracking and metrics
- **MCP Server**: Model Context Protocol server for supervisor tools
- **Instruction Management**: Layered instruction system for CLAUDE.md generation
- **Monitoring**: Health checks and service status tracking

## Features

- ✅ MCP protocol support with @modelcontextprotocol/sdk
- ✅ Fastify-based HTTP server on port 8080
- ✅ PostgreSQL database integration
- ✅ Layered instruction system for CLAUDE.md generation
- ✅ Secrets management with AES-256-GCM encryption
- ✅ Port allocation system (8000-9999 range)
- ✅ Cloudflare integration (DNS, tunnels, workers)
- ✅ **GCloud integration (VM management, health monitoring, auto-scaling)**
- ✅ Task timing and estimation learning
- ✅ RAG knowledge index with pgvector
- ✅ Health check endpoint
- ✅ Tool routing system
- ✅ Request/response logging with Pino
- ✅ Error handling and validation
- ✅ Graceful shutdown support
- ✅ TypeScript with strict typing
- ✅ Systemd service file included

## Quick Start

### Installation

```bash
npm install
```

### Configuration

Copy environment template:

```bash
cp .env.example .env
```

Edit `.env` with your database credentials:

```
PGUSER=supervisor
PGHOST=localhost
PGDATABASE=supervisor_meta
PGPASSWORD=your_password
PGPORT=5432
```

### Database Setup

#### Prerequisites

1. Install PostgreSQL 14+:
```bash
sudo apt install postgresql postgresql-contrib
```

2. Install pgvector extension:
```bash
sudo apt install postgresql-14-pgvector
```

3. Create database user and database:
```bash
sudo -u postgres psql
CREATE USER supervisor WITH PASSWORD 'supervisor';
CREATE DATABASE supervisor_service OWNER supervisor;
GRANT ALL PRIVILEGES ON DATABASE supervisor_service TO supervisor;
\q
```

#### Initialize Database

```bash
# Run migrations (creates all tables and extensions)
npm run migrate:up

# Seed development data (optional)
npm run db:seed

# Test migrations
./test-migrations.sh
```

#### Database Schema

The database includes:
- **Projects, Epics, Issues, Tasks** - Core tracking tables
- **Secrets Management** - Encrypted storage with pgcrypto
- **Port Allocation** - Dynamic port management
- **Task Timing** - Estimation learning system
- **Knowledge Index** - RAG with pgvector embeddings

See [DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) for complete schema documentation.

### Development

```bash
# Start in development mode with auto-reload
npm run dev
```

### Production

```bash
# Build TypeScript
npm run build

# Start production server
npm start
```

### Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env`:
```env
NODE_ENV=development
PORT=8080
LOG_LEVEL=debug
```

## API Endpoints

- `GET /` - Service information
- `GET /health` - Health check
- `POST /mcp/meta` - MCP protocol endpoint

See [API.md](./API.md) for detailed API documentation.

## Architecture

```
src/
├── index.ts              # Entry point
├── server/
│   ├── app.ts           # Fastify app setup
│   └── routes.ts        # HTTP routes
├── mcp/
│   ├── protocol.ts      # MCP protocol handler
│   └── state.ts         # In-memory state
├── tools/
│   └── example.ts       # Example tools
├── utils/
│   ├── logger.ts        # Pino logger
│   └── errors.ts        # Error handling
└── types/
    └── index.ts         # TypeScript types
```

## MCP Protocol

The service implements the Model Context Protocol (MCP) for tool execution:

1. **Initialize**: Establish connection with protocol version negotiation
2. **List Tools**: Discover available tools
3. **Call Tool**: Execute a tool with validated parameters
4. **Ping**: Test connectivity

## Adding New Tools

1. Create a tool definition in `src/tools/`:

```typescript
import { z } from 'zod';
import { Tool } from '../types/index.js';

export const myTool: Tool = {
  name: 'my_tool',
  description: 'Does something useful',
  inputSchema: z.object({
    param: z.string().describe('Parameter description'),
  }),
  handler: async (input, context) => {
    // Tool implementation
    return { result: 'success' };
  },
};
```

2. Register the tool in `src/index.ts`:

```typescript
import { myTool } from './tools/my-tool.js';

registerTool(myTool);
```

## Systemd Service

Install as a systemd service:

```bash
# Copy service file
sudo cp supervisor-service.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable and start
sudo systemctl enable supervisor-service
sudo systemctl start supervisor-service

# Check status
sudo systemctl status supervisor-service

# View logs
sudo journalctl -u supervisor-service -f
```

## Development

### Scripts

#### MCP Server

- `npm run dev` - Development mode with auto-reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server

#### Database

- `npm run migrate:up` - Apply migrations
- `npm run migrate:down` - Rollback migrations
- `npm run migrate:create <name>` - Create new migration
- `npm run db:seed` - Seed development data

#### Instruction Management

- `npm run assemble` - Generate CLAUDE.md
- `npm run regenerate` - Regenerate preserving project content
- `npm run init-projects` - Initialize/update all project supervisors
- `npm run watch:planning` - Watch for planning file changes
- `npm run verify` - Verify instruction system

#### Testing

- `npm test` - Run test suite (TODO)

### Logging

Logs are output to stdout/stderr using Pino. In development mode, logs are prettified.

Log levels: `error`, `warn`, `info`, `debug`

Set via environment: `LOG_LEVEL=debug`

### Error Handling

All errors follow the JSON-RPC 2.0 error format:

```json
{
  "code": -32603,
  "message": "Error description",
  "data": { "additional": "context" }
}
```

## Testing

Test the server with curl:

```bash
# Health check
curl http://localhost:8080/health

# List tools
curl -X POST http://localhost:8080/mcp/meta \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'

# Call echo tool
curl -X POST http://localhost:8080/mcp/meta \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "echo",
      "arguments": {
        "message": "Hello!"
      }
    }
  }'
```

## Instruction Management

This service includes a layered instruction system for managing CLAUDE.md files across all projects.

### Quick Commands

```bash
# Initialize/update all project supervisors
npm run init-projects

# Initialize/update specific project
npm run init-projects -- --project consilio

# Watch for planning file changes (auto-regenerate)
npm run watch:planning

# Regenerate supervisor-service CLAUDE.md
npm run regenerate

# Verify instruction system integrity
npm run verify
```

### MCP Tools

```typescript
// List all projects
mcp__meta__list_projects({ includeDetails: true })

// Regenerate all projects
mcp__meta__regenerate_supervisor({ dryRun: false })

// Update core instruction
mcp__meta__update_core_instruction({
  filename: "01-identity.md",
  content: "...",
  layer: "core",
  regenerateAll: true
})

// List core instructions
mcp__meta__list_core_instructions({ layer: "all" })
```

### Documentation

- **[Instruction Management Guide](docs/INSTRUCTION_MANAGEMENT.md)** - Complete system documentation
- **[Quick Reference](docs/QUICK_REFERENCE_INSTRUCTIONS.md)** - Common tasks and commands

### Instruction Layers

The system uses three layers:

1. **Core** (`.supervisor-core/`) - Shared by all supervisors
2. **Meta** (`.supervisor-meta/`) - Meta-service specific
3. **Project** (`.supervisor-specific/`) - Project customizations

### Automatic Regeneration

Run `npm run watch:planning` to automatically regenerate CLAUDE.md when:
- Planning files in `.bmad/` change
- Project-specific instructions in `.supervisor-specific/` change

Changes are debounced by 2 seconds to avoid excessive regenerations.

## Documentation

### Instruction Management
- **[Instruction Management Guide](docs/INSTRUCTION_MANAGEMENT.md)** - Complete system documentation
- **[Quick Reference](docs/QUICK_REFERENCE_INSTRUCTIONS.md)** - Common tasks

### Service Documentation
- [API Documentation](./API.md) - MCP API details
- [Database Schema](docs/DATABASE_SCHEMA.md) - Database documentation
- [GCloud Quick Start](docs/gcloud-quickstart.md) - GCloud integration guide
- [GCloud Implementation](EPIC-006-GCLOUD.md) - Full GCloud documentation
- [Secrets Setup](SETUP-SECRETS.md) - Secrets management setup

### Planning
- [EPIC-008 Specification](../.bmad/epics/EPIC-BREAKDOWN.md) - Instruction system epic

## Related Projects

This service is part of the SV ecosystem:

- `/home/samuel/sv/consilio/` - Consilio project supervisor
- `/home/samuel/sv/odin/` - Odin project supervisor
- `/home/samuel/sv/openhorizon/` - OpenHorizon project supervisor
- `/home/samuel/sv/health-agent/` - Health Agent project supervisor

## Future Enhancements

- [x] MCP tools for remote instruction management (EPIC-008) ✓
- [x] Project supervisor initialization system (EPIC-008) ✓
- [x] Watch script for automatic regeneration (EPIC-008) ✓
- [ ] AdaptLocalClaude agent for automatic updates (EPIC-008)
- [ ] Automatic triggers (epic complete, PR merge, monthly) (EPIC-008)
- [ ] Multiple project endpoints
- [ ] Authentication/authorization
- [ ] Rate limiting
- [ ] WebSocket support for real-time updates
- [ ] Comprehensive test suite
- [ ] Prometheus metrics
- [ ] OpenAPI/Swagger documentation

## License

ISC
