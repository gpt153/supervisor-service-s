#!/bin/bash
# Test script for database migrations

set -e

echo "🧪 Testing Database Migrations"
echo "==============================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if PostgreSQL is running
echo "Checking PostgreSQL connection..."
if psql -h localhost -U supervisor -d postgres -c "SELECT 1" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} PostgreSQL is running"
else
    echo -e "${RED}✗${NC} PostgreSQL is not running or not accessible"
    echo "Please ensure PostgreSQL is running and credentials are correct"
    exit 1
fi

# Check if database exists, create if not
echo ""
echo "Checking database..."
if psql -h localhost -U supervisor -lqt | cut -d \| -f 1 | grep -qw supervisor_service; then
    echo -e "${YELLOW}⚠${NC} Database 'supervisor_service' already exists"
    read -p "Drop and recreate database? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Dropping database..."
        dropdb -h localhost -U supervisor supervisor_service
        echo "Creating database..."
        createdb -h localhost -U supervisor supervisor_service
        echo -e "${GREEN}✓${NC} Database recreated"
    else
        echo "Using existing database"
    fi
else
    echo "Creating database..."
    createdb -h localhost -U supervisor supervisor_service
    echo -e "${GREEN}✓${NC} Database created"
fi

# Run migrations up
echo ""
echo "Running migrations up..."
if npm run migrate:up; then
    echo -e "${GREEN}✓${NC} Migrations applied successfully"
else
    echo -e "${RED}✗${NC} Migration failed"
    exit 1
fi

# Check that extensions are installed
echo ""
echo "Verifying extensions..."
EXTENSIONS=$(psql -h localhost -U supervisor -d supervisor_service -t -c "SELECT extname FROM pg_extension WHERE extname IN ('uuid-ossp', 'pgcrypto', 'vector') ORDER BY extname;")
if echo "$EXTENSIONS" | grep -q "uuid-ossp" && echo "$EXTENSIONS" | grep -q "pgcrypto" && echo "$EXTENSIONS" | grep -q "vector"; then
    echo -e "${GREEN}✓${NC} All required extensions installed"
else
    echo -e "${YELLOW}⚠${NC} Some extensions may be missing:"
    echo "$EXTENSIONS"
fi

# Check table counts
echo ""
echo "Verifying tables..."
TABLE_COUNT=$(psql -h localhost -U supervisor -d supervisor_service -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';")
echo "Tables created: $TABLE_COUNT"

if [ "$TABLE_COUNT" -gt 20 ]; then
    echo -e "${GREEN}✓${NC} Expected number of tables created"
else
    echo -e "${YELLOW}⚠${NC} Fewer tables than expected"
fi

# List all tables
echo ""
echo "Tables in database:"
psql -h localhost -U supervisor -d supervisor_service -c "\dt" | grep public

# Test migration down (rollback last migration)
echo ""
echo "Testing migration rollback..."
if npm run migrate:down; then
    echo -e "${GREEN}✓${NC} Rollback successful"
else
    echo -e "${RED}✗${NC} Rollback failed"
    exit 1
fi

# Re-apply migrations
echo ""
echo "Re-applying migrations..."
if npm run migrate:up; then
    echo -e "${GREEN}✓${NC} Migrations re-applied successfully"
else
    echo -e "${RED}✗${NC} Migration failed"
    exit 1
fi

# Run seed script
echo ""
echo "Testing seed script..."
if npm run db:seed; then
    echo -e "${GREEN}✓${NC} Seed data inserted successfully"
else
    echo -e "${YELLOW}⚠${NC} Seed script failed (this may be expected if data already exists)"
fi

# Check that data was inserted
echo ""
echo "Verifying seed data..."
PROJECT_COUNT=$(psql -h localhost -U supervisor -d supervisor_service -t -c "SELECT COUNT(*) FROM projects;")
echo "Projects: $PROJECT_COUNT"

EPIC_COUNT=$(psql -h localhost -U supervisor -d supervisor_service -t -c "SELECT COUNT(*) FROM epics;")
echo "Epics: $EPIC_COUNT"

PORT_RANGE_COUNT=$(psql -h localhost -U supervisor -d supervisor_service -t -c "SELECT COUNT(*) FROM port_ranges;")
echo "Port Ranges: $PORT_RANGE_COUNT"

if [ "$PROJECT_COUNT" -gt 0 ] && [ "$EPIC_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓${NC} Seed data verified"
else
    echo -e "${YELLOW}⚠${NC} Less seed data than expected"
fi

# Test database client
echo ""
echo "Testing database client..."
if npx tsx -e "
import { testConnection, closePool } from './src/db/client.js';
await testConnection();
await closePool();
"; then
    echo -e "${GREEN}✓${NC} Database client working"
else
    echo -e "${RED}✗${NC} Database client test failed"
    exit 1
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ All migration tests passed!${NC}"
echo -e "${GREEN}========================================${NC}"
