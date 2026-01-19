# Port Allocation System

**EPIC-004 Implementation**

## Quick Start

```typescript
import { PortManager } from './PortManager.js';
import { pool } from '../db/client.js';

const portManager = new PortManager(pool);

// Get or allocate port
const port = await portManager.getOrAllocate('consilio', 'api');
// Returns: 3100 (first port in consilio's range)
```

## Architecture

```
ports/
├── PortManager.ts      # Core allocation logic
├── port-tools.ts       # MCP tool definitions
├── index.ts           # Module exports
└── README.md          # This file
```

## PortManager API

### Methods

#### `getOrAllocate(projectName, serviceName, options?)`

Get existing port or allocate new one.

**Parameters**:
- `projectName: string` - Project name (e.g., 'consilio')
- `serviceName: string` - Service name (e.g., 'api')
- `options?: AllocatePortOptions` - Optional metadata

**Returns**: `Promise<number>` - Port number

**Example**:
```typescript
const port = await portManager.getOrAllocate(
  'consilio',
  'web',
  {
    serviceType: 'web',
    description: 'Main web app',
    cloudflareHostname: 'consilio.153.se'
  }
);
```

#### `allocate(projectName, serviceName, options?)`

Always allocate new port (even if service has one).

**Parameters**: Same as `getOrAllocate`

**Returns**: `Promise<number>` - Port number

#### `release(projectName, serviceName, hostname?)`

Release port allocation.

**Parameters**:
- `projectName: string`
- `serviceName: string`
- `hostname?: string` - Default: 'localhost'

**Returns**: `Promise<boolean>` - True if port was released

#### `listByProject(projectName)`

List all allocations for a project.

**Returns**: `Promise<PortAllocation[]>`

#### `listAll()`

List all allocations across all projects.

**Returns**: `Promise<PortAllocation[]>`

#### `getProjectSummary(projectName)`

Get port usage summary for a project.

**Returns**: `Promise<PortSummary>`

```typescript
{
  rangeStart: 3100,
  rangeEnd: 3199,
  totalPorts: 100,
  allocatedPorts: 5,
  availablePorts: 95,
  utilization: 5
}
```

#### `verifyPort(port, hostname?)`

Check if port is currently in use.

**Parameters**:
- `port: number`
- `hostname?: string` - Default: 'localhost'

**Returns**: `Promise<boolean>` - True if port is in use

#### `auditPorts()`

Verify all allocated ports match running services.

**Returns**: `Promise<AuditResult>`

```typescript
{
  allocated: 12,
  inUse: 10,
  notRunning: 2,
  conflicts: [
    { port: 3102, expected: 'consilio/websocket', actual: 'not running' }
  ]
}
```

#### `updatePort(projectName, serviceName, updates)`

Update port metadata.

**Parameters**:
- `projectName: string`
- `serviceName: string`
- `updates: UpdatePortOptions`

**Returns**: `Promise<boolean>` - True if updated

## MCP Tools

Seven MCP tools are exposed:

1. **get-port** - Get or allocate port
2. **allocate-port** - Allocate new port
3. **list-ports** - List allocations
4. **audit-ports** - Health check
5. **port-summary** - Project summary
6. **release-port** - Release allocation
7. **update-port** - Update metadata

See `/home/samuel/sv/supervisor-service/docs/PORT-ALLOCATION.md` for detailed usage.

## Types

```typescript
interface PortAllocation {
  id: string;
  portNumber: number;
  projectName: string;
  serviceName: string;
  serviceType?: string;
  status: 'allocated' | 'in_use' | 'released';
  hostname: string;
  protocol: 'tcp' | 'udp';
  cloudflareHostname?: string;
  allocatedAt: Date;
  lastUsedAt?: Date;
}

interface PortSummary {
  rangeStart: number;
  rangeEnd: number;
  totalPorts: number;
  allocatedPorts: number;
  availablePorts: number;
  utilization: number;
}

interface AuditResult {
  allocated: number;
  inUse: number;
  notRunning: number;
  conflicts: PortConflict[];
}
```

## Port Ranges

| Project | Range | Ports |
|---------|-------|-------|
| meta-supervisor | 3000-3099 | 100 |
| consilio | 3100-3199 | 100 |
| openhorizon | 3200-3299 | 100 |
| odin | 3300-3399 | 100 |
| health-agent | 3400-3499 | 100 |
| quiculum-monitor | 3500-3599 | 100 |
| shared-services | 9000-9999 | 1000 |

## Database

The system uses three main tables:

- `port_ranges` - Range definitions
- `port_allocations` - Active allocations
- `port_health_checks` - Health check history

And database functions:

- `find_available_port()` - Find next available port
- `allocate_port()` - Allocate port atomically
- `release_port()` - Release port

## Testing

Integration tests: `/home/samuel/sv/supervisor-service/src/tests/integration/PortManager.test.ts`

Run tests:
```bash
npm test -- PortManager.test.ts
```

## Error Handling

All methods throw errors for:
- Non-existent projects
- Exhausted port ranges
- Database connection issues

Errors are TypeScript Error objects with descriptive messages.

## Performance

- Port allocation: O(n) where n = allocated ports in range
- Port lookup: O(1) with database index
- Verification: Network I/O dependent (typically <100ms)

## Security

- No SQL injection (parameterized queries)
- No direct port manipulation (ranges enforced by DB)
- Health checks are read-only

## Future Work

- [ ] Port reservation system
- [ ] Batch allocation
- [ ] Rate limiting
- [ ] Service discovery integration

## Documentation

Full documentation: `/home/samuel/sv/supervisor-service/docs/PORT-ALLOCATION.md`
