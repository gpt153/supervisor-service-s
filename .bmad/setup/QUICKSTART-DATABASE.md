# Database Quick Start

## TL;DR

```bash
# 1. Install PostgreSQL and extensions
sudo apt install postgresql postgresql-17-pgvector

# 2. Create database
sudo -u postgres createuser supervisor -P
sudo -u postgres createdb supervisor_service -O supervisor

# 3. Setup project
cd /home/samuel/sv/supervisor-service
npm install
cp .env.example .env

# 4. Run migrations
npm run migrate:up

# 5. Seed data (optional)
npm run db:seed

# 6. Test
./test-migrations.sh
```

## Quick Commands

```bash
# Migrations
npm run migrate:up          # Apply all pending
npm run migrate:down        # Rollback last
npm run migrate:create foo  # Create new migration

# Data
npm run db:seed            # Insert test data

# Testing
./test-migrations.sh       # Full test suite
npx tsx test-db-connection.ts  # Connection test
```

## Quick Examples

### Create a Project

```typescript
import { createProject } from './src/db/queries.js';

const project = await createProject({
  name: 'my-project',
  path: '/path/to/project',
  description: 'Description'
});
```

### Create an Epic

```typescript
import { createEpic } from './src/db/queries.js';

const epic = await createEpic({
  project_id: project.id,
  epic_id: 'EPIC-001',
  title: 'My Epic',
  priority: 'high',
  complexity: 'moderate'
});
```

### Allocate a Port

```typescript
import { allocatePort } from './src/db/queries.js';

const port = await allocatePort({
  project_id: project.id,
  range_id: rangeId,
  service_name: 'my-service'
});

console.log(`Port: ${port}`);
```

### Search Knowledge

```typescript
import { pool } from './src/db/client.js';

const results = await pool.query(`
  SELECT * FROM search_knowledge_chunks($1, $2, $3)
`, [embedding, projectId, 10]);
```

## Database Schema Summary

### Core Tables
- `projects` - Supervised projects
- `epics` - High-level features
- `issues` - Issue tracking
- `tasks` - Task management
- `comments` - Comments

### Secrets
- `secrets` - Encrypted storage
- `encryption_keys` - Key management
- `secret_rotation_schedule` - Auto-rotation

### Ports
- `port_ranges` - Port ranges
- `port_allocations` - Allocated ports
- `port_health_checks` - Health monitoring

### Timing
- `task_executions` - Execution tracking
- `estimation_patterns` - ML patterns
- `time_tracking_sessions` - Time tracking

### Knowledge/RAG
- `knowledge_chunks` - Text + embeddings
- `learnings` - Extracted insights
- `search_queries` - Search logs

## Useful Queries

```sql
-- See all tables
\dt

-- See all views
\dv

-- See all functions
\df

-- Project stats
SELECT * FROM estimation_accuracy_by_project;

-- Port usage
SELECT * FROM port_range_utilization;

-- Expiring secrets
SELECT * FROM secrets_expiring_soon;

-- Learning effectiveness
SELECT * FROM learning_effectiveness;
```

## Environment Setup

`.env` file:

```env
DATABASE_URL=postgresql://supervisor:supervisor@localhost:5432/supervisor_service
PGHOST=localhost
PGPORT=5432
PGUSER=supervisor
PGPASSWORD=supervisor
PGDATABASE=supervisor_service
NODE_ENV=development
PORT=8080
```

## Troubleshooting

**Connection Refused?**
```bash
sudo systemctl start postgresql
```

**Permission Denied?**
```bash
sudo -u postgres psql -c "ALTER USER supervisor WITH SUPERUSER;"
```

**Extension Not Found?**
```bash
# Install pgvector from source
cd /tmp
git clone https://github.com/pgvector/pgvector.git
cd pgvector
make && sudo make install
psql -U supervisor -d supervisor_service -c "CREATE EXTENSION vector;"
```

**Migration Failed?**
```bash
npm run migrate:down  # Rollback
# Fix migration file
npm run migrate:up    # Re-apply
```

## Documentation

- 📖 [DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) - Complete schema reference
- 🚀 [SETUP_GUIDE.md](docs/SETUP_GUIDE.md) - Detailed setup guide
- ✅ [EPIC-001-IMPLEMENTATION.md](docs/EPIC-001-IMPLEMENTATION.md) - What was built

## Next Steps

After database setup:
1. EPIC-002: MCP Server tools
2. EPIC-003: Secrets encryption
3. EPIC-004: Port allocation service
4. EPIC-007: Estimation learning
5. EPIC-009: RAG knowledge system
