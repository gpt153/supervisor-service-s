# Database Setup Guide

## Complete Setup for EPIC-001: Database Foundation

This guide walks through setting up the complete database foundation for supervisor-service.

## Prerequisites

### 1. PostgreSQL Installation

```bash
# Update package list
sudo apt update

# Install PostgreSQL 14+ and contrib modules
sudo apt install postgresql postgresql-contrib

# Verify installation
psql --version
```

### 2. Install pgvector Extension

pgvector is required for RAG/semantic search functionality:

```bash
# For Ubuntu/Debian
sudo apt install postgresql-17-pgvector

# Or build from source if not available
# git clone --branch v0.5.1 https://github.com/pgvector/pgvector.git
# cd pgvector
# make
# sudo make install
```

### 3. Install pgcrypto (usually included)

pgcrypto is typically included with PostgreSQL contrib, but verify:

```bash
sudo -u postgres psql -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
```

## Database Setup

### Step 1: Create Database User

```bash
sudo -u postgres psql
```

In the PostgreSQL prompt:

```sql
-- Create user
CREATE USER supervisor WITH PASSWORD 'supervisor';

-- Grant necessary permissions
ALTER USER supervisor CREATEDB;

-- Exit
\q
```

### Step 2: Create Database

```bash
sudo -u postgres psql
```

```sql
-- Create database
CREATE DATABASE supervisor_service OWNER supervisor;

-- Grant all privileges
GRANT ALL PRIVILEGES ON DATABASE supervisor_service TO supervisor;

-- Exit
\q
```

### Step 3: Enable Extensions

Connect to the new database:

```bash
psql -U supervisor -d supervisor_service
```

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable encryption extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enable vector extension for RAG
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify extensions
\dx

-- Exit
\q
```

## Project Setup

### Step 1: Install Dependencies

```bash
cd /home/samuel/sv/supervisor-service
npm install
```

### Step 2: Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Database Configuration
DATABASE_URL=postgresql://supervisor:supervisor@localhost:5432/supervisor_service
PGHOST=localhost
PGPORT=5432
PGUSER=supervisor
PGPASSWORD=supervisor
PGDATABASE=supervisor_service

# Service Configuration
NODE_ENV=development
PORT=8080
```

### Step 3: Run Migrations

```bash
# Apply all migrations
npm run migrate:up
```

Expected output:
```
> supervisor-service@1.0.0 migrate:up
> node-pg-migrate up

> Migrated (up) 1737212000000_initial_schema.sql
> Migrated (up) 1737212100000_secrets_management.sql
> Migrated (up) 1737212200000_port_allocation.sql
> Migrated (up) 1737212300000_task_timing.sql
> Migrated (up) 1737212400000_learnings_index.sql
```

### Step 4: Seed Development Data (Optional)

```bash
npm run db:seed
```

This will create:
- 4 sample projects (consilio, odin, openhorizon, health-agent)
- 3 port ranges
- Sample epics, issues, and tasks
- Estimation factors
- Secret templates

### Step 5: Verify Installation

```bash
./test-migrations.sh
```

Or manually verify:

```bash
psql -U supervisor -d supervisor_service
```

```sql
-- Check tables
\dt

-- Check extensions
\dx

-- Count records
SELECT 'projects' as table_name, COUNT(*) FROM projects
UNION ALL
SELECT 'epics', COUNT(*) FROM epics
UNION ALL
SELECT 'issues', COUNT(*) FROM issues
UNION ALL
SELECT 'tasks', COUNT(*) FROM tasks;

-- Check views
\dv

-- Check functions
\df

-- Exit
\q
```

## Migration Management

### View Migration Status

```bash
psql -U supervisor -d supervisor_service -c "SELECT * FROM pgmigrations ORDER BY run_on;"
```

### Rollback Last Migration

```bash
npm run migrate:down
```

### Rollback Multiple Migrations

```bash
# Rollback 3 migrations
npm run migrate:down 3
```

### Create New Migration

```bash
npm run migrate:create my_new_feature
```

This creates a new file: `migrations/[timestamp]_my_new_feature.sql`

## Troubleshooting

### Connection Refused

If you get "connection refused" errors:

```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Start if not running
sudo systemctl start postgresql

# Enable auto-start on boot
sudo systemctl enable postgresql
```

### Permission Denied

If you get permission errors:

```bash
# Grant superuser to supervisor (if needed)
sudo -u postgres psql -c "ALTER USER supervisor WITH SUPERUSER;"

# Or grant specific permissions
sudo -u postgres psql -d supervisor_service -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO supervisor;"
```

### Extension Not Found

If pgvector is not found:

```bash
# Check available extensions
psql -U supervisor -d supervisor_service -c "SELECT * FROM pg_available_extensions WHERE name = 'vector';"

# If not available, install from source
cd /tmp
git clone --branch v0.5.1 https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install

# Then create extension
psql -U supervisor -d supervisor_service -c "CREATE EXTENSION vector;"
```

### Migration Failed

If a migration fails partway through:

```bash
# Check migration status
psql -U supervisor -d supervisor_service -c "SELECT * FROM pgmigrations ORDER BY run_on DESC LIMIT 5;"

# Manually rollback if needed
npm run migrate:down

# Fix the migration file
# Then re-run
npm run migrate:up
```

## Database Schema Overview

### Core Tables (Migration 001)

- **projects** - Supervised projects
- **epics** - High-level features/initiatives
- **issues** - GitHub-style issues
- **tasks** - Granular work items
- **service_status** - Service health monitoring
- **comments** - Comments on issues/tasks

### Secrets Tables (Migration 002)

- **encryption_keys** - Master encryption keys
- **secrets** - Encrypted secrets storage
- **secret_access_log** - Audit trail
- **secret_rotation_schedule** - Automatic rotation
- **secret_templates** - Secret type templates

### Port Management Tables (Migration 003)

- **port_ranges** - Allocatable port ranges
- **port_allocations** - Allocated ports
- **port_health_checks** - Port health monitoring
- **port_reservations** - Pre-reserved ports

### Task Timing Tables (Migration 004)

- **task_executions** - Task execution history
- **estimation_patterns** - Learned patterns
- **time_tracking_sessions** - Detailed time tracking
- **estimation_factors** - Factors affecting estimates
- **task_execution_factors** - Factor application tracking

### Knowledge/RAG Tables (Migration 005)

- **knowledge_sources** - Knowledge source tracking
- **knowledge_chunks** - Chunked text with embeddings
- **learnings** - Extracted insights
- **learning_applications** - Application tracking
- **search_queries** - Search analytics

## Testing Database Client

Create a test file:

```typescript
// test-db.ts
import { testConnection, closePool } from './src/db/client.js';
import { createProject, getProjectByName } from './src/db/queries.js';

async function test() {
  try {
    await testConnection();

    const project = await createProject({
      name: 'test-project',
      path: '/tmp/test',
      description: 'Test project'
    });

    console.log('Created project:', project);

    const found = await getProjectByName('test-project');
    console.log('Found project:', found);

  } finally {
    await closePool();
  }
}

test();
```

Run:
```bash
npx tsx test-db.ts
```

## Next Steps

After database setup is complete:

1. **EPIC-002**: Implement MCP Server tools
2. **EPIC-003**: Implement secrets encryption/decryption
3. **EPIC-004**: Implement port allocation service
4. **EPIC-007**: Implement estimation learning
5. **EPIC-009**: Implement RAG knowledge system

## Documentation

- [Database Schema](./DATABASE_SCHEMA.md) - Complete schema reference
- [README](../README.md) - Project overview
- [API Documentation](../API.md) - API endpoints

## Support

For issues with database setup, check:

1. PostgreSQL logs: `sudo journalctl -u postgresql -n 100`
2. Migration logs: `migrations/migration.log`
3. Application logs: Console output from npm commands
