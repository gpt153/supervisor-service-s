# Port Allocation System

**Implementation of EPIC-004**

## Overview

The Port Allocation System provides guaranteed conflict-free port allocation for all services across all projects in the SV supervisor system.

### Key Features

- **Project-based ranges**: Each project gets 100 dedicated ports
- **Zero conflicts**: Port ranges don't overlap, making conflicts impossible
- **Automatic allocation**: Next-available-port algorithm
- **Cloudflare integration**: Link ports to Cloudflare tunnel hostnames
- **Health monitoring**: Verify which ports are actually in use
- **Audit capabilities**: Find services that should be running but aren't

## Port Ranges

### Project Allocations

| Project | Range | Ports | Example Services |
|---------|-------|-------|------------------|
| meta-supervisor | 3000-3099 | 100 | 3000=dashboard, 3001=api |
| consilio | 3100-3199 | 100 | 3100=web, 3101=api, 3102=websocket |
| openhorizon | 3200-3299 | 100 | 3200=web, 3201=api |
| odin | 3300-3399 | 100 | 3300=web, 3301=api |
| health-agent | 3400-3499 | 100 | 3400=web, 3401=api |
| quiculum-monitor | 3500-3599 | 100 | 3500=web, 3501=api |
| shared-services | 9000-9999 | 1000 | 9001=penpot, 9002=storybook |

### Shared Services

The shared services range (9000-9999) is for cross-project services:

- **Penpot**: UI design tool
- **Storybook**: Component playground
- **Prometheus**: Metrics monitoring
- **Grafana**: Metrics visualization
- **Redis**: Caching (future)

## Usage

### TypeScript API

```typescript
import { PortManager } from './ports/PortManager.js';
import { pool } from './db/client.js';

const portManager = new PortManager(pool);

// Get or allocate port for a service
const port = await portManager.getOrAllocate(
  'consilio',
  'api-server',
  {
    serviceType: 'api',
    description: 'Main API server',
    cloudflareHostname: 'api.consilio.153.se',
  }
);

// port = 3100 (first port in consilio's range)
```

### MCP Tools

The following MCP tools are exposed for supervisors:

#### get-port

Get allocated port for a service, or allocate if not exists.

```json
{
  "name": "get-port",
  "params": {
    "projectName": "consilio",
    "serviceName": "web",
    "serviceType": "web",
    "description": "Main web application",
    "cloudflareHostname": "consilio.153.se"
  }
}
```

#### allocate-port

Allocate a new port (always allocates new, even if service has one).

```json
{
  "name": "allocate-port",
  "params": {
    "projectName": "consilio",
    "serviceName": "api",
    "serviceType": "api"
  }
}
```

#### list-ports

List all port allocations, optionally filtered by project.

```json
{
  "name": "list-ports",
  "params": {
    "projectName": "consilio"  // Optional
  }
}
```

#### audit-ports

Verify all allocated ports match running services.

```json
{
  "name": "audit-ports",
  "params": {}
}
```

Response:
```json
{
  "success": true,
  "summary": {
    "allocated": 12,
    "inUse": 10,
    "notRunning": 2,
    "healthPercentage": 83
  },
  "conflicts": [
    {
      "port": 3102,
      "expected": "consilio/websocket",
      "actual": "not running"
    }
  ]
}
```

#### port-summary

Get port usage summary for a project.

```json
{
  "name": "port-summary",
  "params": {
    "projectName": "consilio"
  }
}
```

Response:
```json
{
  "success": true,
  "summary": {
    "rangeStart": 3100,
    "rangeEnd": 3199,
    "totalPorts": 100,
    "allocatedPorts": 5,
    "availablePorts": 95,
    "utilizationPercent": 5
  }
}
```

#### release-port

Release a port allocation.

```json
{
  "name": "release-port",
  "params": {
    "projectName": "consilio",
    "serviceName": "old-service"
  }
}
```

#### update-port

Update port metadata.

```json
{
  "name": "update-port",
  "params": {
    "projectName": "consilio",
    "serviceName": "api",
    "cloudflareHostname": "api.consilio.153.se",
    "description": "Updated API server"
  }
}
```

## Database Schema

### Tables

#### port_ranges

Defines port ranges available for allocation.

```sql
CREATE TABLE port_ranges (
  id UUID PRIMARY KEY,
  range_name VARCHAR(255) UNIQUE,
  start_port INTEGER,
  end_port INTEGER,
  description TEXT,
  is_active BOOLEAN DEFAULT true
);
```

#### port_allocations

Tracks which ports are allocated to which services.

```sql
CREATE TABLE port_allocations (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  port_range_id UUID REFERENCES port_ranges(id),
  port_number INTEGER NOT NULL,
  service_name VARCHAR(255) NOT NULL,
  service_type VARCHAR(100),
  status VARCHAR(50) DEFAULT 'allocated',
  hostname VARCHAR(255) DEFAULT 'localhost',
  protocol VARCHAR(10) DEFAULT 'tcp',
  metadata JSONB DEFAULT '{}',
  allocated_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP,
  released_at TIMESTAMP
);
```

#### port_health_checks

Records health check results for allocated ports.

```sql
CREATE TABLE port_health_checks (
  id UUID PRIMARY KEY,
  port_allocation_id UUID REFERENCES port_allocations(id),
  check_type VARCHAR(50),
  status VARCHAR(50),
  response_time_ms INTEGER,
  checked_at TIMESTAMP DEFAULT NOW()
);
```

### Database Functions

#### find_available_port

Finds next available port in a range.

```sql
SELECT find_available_port(
  'range_id'::UUID,
  'localhost',
  'tcp'
);
```

#### allocate_port

Allocates a port for a service.

```sql
SELECT allocate_port(
  'project_id'::UUID,
  'range_id'::UUID,
  'service_name',
  'service_type',
  'localhost',
  'tcp'
);
```

#### release_port

Releases a port allocation.

```sql
SELECT release_port(3100, 'localhost');
```

## Common Patterns

### Service Deployment

```typescript
// When deploying a new service
const port = await portManager.getOrAllocate(
  'consilio',
  'new-api',
  {
    serviceType: 'api',
    cloudflareHostname: 'new-api.consilio.153.se'
  }
);

// Deploy service with allocated port
await deployService({
  name: 'consilio-new-api',
  port: port,
  env: { PORT: port }
});

// Configure Cloudflare tunnel
await configureTunnel({
  hostname: 'new-api.consilio.153.se',
  service: `http://localhost:${port}`
});
```

### Daily Health Check

```typescript
// Run as cron job
const audit = await portManager.auditPorts();

if (audit.conflicts.length > 0) {
  console.log('Services not running:');
  for (const conflict of audit.conflicts) {
    console.log(`  - ${conflict.expected} on port ${conflict.port}`);
    // Optional: Auto-restart
    await restartService(conflict.expected);
  }
}
```

### Project Port Summary

```typescript
const summary = await portManager.getProjectSummary('consilio');

console.log(`Consilio port usage:
  Range: ${summary.rangeStart}-${summary.rangeEnd}
  Used: ${summary.allocatedPorts}/${summary.totalPorts}
  Available: ${summary.availablePorts}
  Utilization: ${summary.utilization}%
`);
```

## Migration from Existing Setup

### Step 1: Audit Current Ports

```bash
# Find all services listening on ports
sudo lsof -i -P -n | grep LISTEN
```

### Step 2: Import to Database

```typescript
const existingServices = [
  { project: 'consilio', service: 'web', port: 3000 },
  { project: 'consilio', service: 'api', port: 3001 },
  // ... etc
];

for (const svc of existingServices) {
  await portManager.getOrAllocate(
    svc.project,
    svc.service,
    { description: 'Migrated from existing setup' }
  );
}
```

### Step 3: Update Service Configs

Update each service to use its allocated port from the database.

### Step 4: Verify

```typescript
const audit = await portManager.auditPorts();
console.log(`Migration complete:
  - ${audit.allocated} ports allocated
  - ${audit.inUse} services running
  - ${audit.conflicts.length} conflicts to resolve
`);
```

## Error Prevention

### Before (Causes Conflicts)

```typescript
// Service checks if port is available
const portInUse = await checkPort(3000);
if (!portInUse) {
  startService(3000); // PROBLEM: Another service might use this later
}
```

### After (Conflict Impossible)

```typescript
// Service gets port from allocated range
const port = await portManager.getOrAllocate('consilio', 'api');
startService(port); // Guaranteed no conflicts
```

## Monitoring

### Health Check Endpoint

```bash
curl http://localhost:3000/api/ports/audit
```

### Metrics

The system tracks:
- Port utilization per project
- Health check results
- Allocation history
- Service uptime

## Future Enhancements

- [ ] Automatic service restart on port conflicts
- [ ] Grafana dashboard for port usage
- [ ] Alert when project uses >80% of range
- [ ] Port reservation system
- [ ] Integration with service discovery

## Implementation Details

**Location**: `/home/samuel/sv/supervisor-service/src/ports/`

**Files**:
- `PortManager.ts` - Core allocation logic
- `port-tools.ts` - MCP tool definitions
- `index.ts` - Module exports

**Database**: PostgreSQL with pg driver

**Dependencies**:
- `pg` - PostgreSQL client
- `net` - Node.js network module (for port verification)

**Tests**: `/home/samuel/sv/supervisor-service/src/tests/integration/PortManager.test.ts`

## References

- EPIC-004: Port Allocation System
- Infrastructure Design: `/home/samuel/sv/.bmad/infrastructure/port-allocation-system.md`
- Migration: `/home/samuel/sv/supervisor-service/migrations/1737212200000_port_allocation.sql`
