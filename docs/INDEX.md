# Documentation Index

## Quick Navigation

### Getting Started
1. [README](../README.md) - Project overview and quick start
2. [QUICKSTART-DATABASE](../QUICKSTART-DATABASE.md) - TL;DR database setup
3. [SETUP_GUIDE](./SETUP_GUIDE.md) - Detailed setup instructions

### Database
1. [DATABASE_SCHEMA](./DATABASE_SCHEMA.md) - Complete schema reference
2. [EPIC-001-IMPLEMENTATION](./EPIC-001-IMPLEMENTATION.md) - What was built
3. [EPIC-001-COMPLETE](../EPIC-001-COMPLETE.md) - Completion summary

### API & Architecture
1. [API](../API.md) - MCP API endpoints
2. [INSTRUCTION-SYSTEM](./INSTRUCTION-SYSTEM.md) - Instruction management

### Implementation Guides
1. [EPIC-002-IMPLEMENTATION](../EPIC-002-IMPLEMENTATION.md) - MCP Server
2. [EPIC-011-IMPLEMENTATION](../EPIC-011-IMPLEMENTATION.md) - PIV mode

---

## By Topic

### Database Setup
- [QUICKSTART-DATABASE](../QUICKSTART-DATABASE.md) - Quick commands
- [SETUP_GUIDE](./SETUP_GUIDE.md) - Full setup guide
- [DATABASE_SCHEMA](./DATABASE_SCHEMA.md) - Schema reference

### Database Schema
- [DATABASE_SCHEMA](./DATABASE_SCHEMA.md) - All tables, views, functions
- [EPIC-001-IMPLEMENTATION](./EPIC-001-IMPLEMENTATION.md) - Implementation details

### MCP Server
- [API](../API.md) - API documentation
- [EPIC-002-IMPLEMENTATION](../EPIC-002-IMPLEMENTATION.md) - Implementation

### Instructions
- [INSTRUCTION-SYSTEM](./INSTRUCTION-SYSTEM.md) - How it works
- PIV mode: [EPIC-011-IMPLEMENTATION](../EPIC-011-IMPLEMENTATION.md)

---

## By User Type

### First-Time User
1. [README](../README.md) - Start here
2. [QUICKSTART-DATABASE](../QUICKSTART-DATABASE.md) - Quick setup
3. [API](../API.md) - How to use

### Developer
1. [SETUP_GUIDE](./SETUP_GUIDE.md) - Detailed setup
2. [DATABASE_SCHEMA](./DATABASE_SCHEMA.md) - Schema reference
3. [EPIC-001-IMPLEMENTATION](./EPIC-001-IMPLEMENTATION.md) - Database code

### Operator
1. [SETUP_GUIDE](./SETUP_GUIDE.md) - Installation
2. [QUICK-START](../QUICK-START.md) - Operations
3. Systemd service: [README](../README.md#systemd-service)

---

## Implementation Docs

### Completed EPICs
- [EPIC-001-COMPLETE](../EPIC-001-COMPLETE.md) - Database Foundation
- [EPIC-002-IMPLEMENTATION](../EPIC-002-IMPLEMENTATION.md) - MCP Server
- [EPIC-011-IMPLEMENTATION](../EPIC-011-IMPLEMENTATION.md) - PIV Mode

### In Progress
- Check [../IMPLEMENTATION-SUMMARY.md](../IMPLEMENTATION-SUMMARY.md)

---

## File Locations

### Configuration
```
.env.example              - Environment template
package.json             - Dependencies and scripts
tsconfig.json           - TypeScript config
```

### Source Code
```
src/db/                  - Database client
src/mcp/                 - MCP protocol
src/types/database.ts    - Type definitions
src/scripts/seed.ts      - Seed script
```

### Migrations
```
migrations/              - All SQL migrations
migrations/config.json   - Migration config
```

### Tests
```
test-migrations.sh       - Automated tests
test-db-connection.ts    - Connection test
```

### Documentation
```
README.md                       - Main readme
QUICKSTART-DATABASE.md          - Quick start
EPIC-001-COMPLETE.md           - Epic summary
docs/DATABASE_SCHEMA.md         - Schema reference
docs/SETUP_GUIDE.md             - Setup guide
docs/EPIC-001-IMPLEMENTATION.md - Implementation
docs/API.md                     - API docs
```

---

## Quick Links

### Commands
```bash
# Setup
npm install
cp .env.example .env
npm run migrate:up
npm run db:seed

# Development
npm run dev
npm run build
npm start

# Database
npm run migrate:up
npm run migrate:down
npm run db:seed

# Testing
./test-migrations.sh
npx tsx test-db-connection.ts
```

### Endpoints
```
GET  /health            - Health check
GET  /                  - Service info
POST /mcp/meta         - MCP endpoint
```

---

## Search Guide

Looking for information about:

**Database Setup?**
→ [SETUP_GUIDE](./SETUP_GUIDE.md)

**Database Schema?**
→ [DATABASE_SCHEMA](./DATABASE_SCHEMA.md)

**Quick Reference?**
→ [QUICKSTART-DATABASE](../QUICKSTART-DATABASE.md)

**API Usage?**
→ [API](../API.md)

**What Was Built?**
→ [EPIC-001-COMPLETE](../EPIC-001-COMPLETE.md)

**How It Works?**
→ [EPIC-001-IMPLEMENTATION](./EPIC-001-IMPLEMENTATION.md)

**Troubleshooting?**
→ [SETUP_GUIDE](./SETUP_GUIDE.md#troubleshooting)

**TypeScript Types?**
→ [src/types/database.ts](../src/types/database.ts)

**Query Examples?**
→ [DATABASE_SCHEMA](./DATABASE_SCHEMA.md#usage-examples)

---

Last updated: 2026-01-18
