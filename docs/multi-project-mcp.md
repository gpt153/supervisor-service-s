# Multi-Project MCP Endpoints

## Overview

The Multi-Project MCP Server provides isolated MCP endpoints for each project in the SV supervisor system. Each project gets its own endpoint with scoped tools and isolated context.

## Architecture

### Core Components

1. **MultiProjectMCPServer**: Main server managing all project endpoints
2. **ProjectContextManager**: Manages project configurations and contexts
3. **ToolRegistry**: Handles tool registration and scoping
4. **ProjectEndpoint**: Individual endpoint handler for each project

### Context Isolation

Each project endpoint maintains:
- Separate working directory
- Isolated state storage
- Project-specific tool access
- Independent request logging

## Available Endpoints

### Meta Endpoint
- **Path**: `/mcp/meta`
- **Purpose**: Meta-infrastructure management
- **Tools**:
  - `service-status` - Check service health
  - `service-restart` - Restart services
  - `service-logs` - View service logs
  - `health-check` - System health check
  - `system-metrics` - Resource usage

### Project Endpoints

Each project gets its own endpoint:

- `/mcp/consilio` - Consilio project
- `/mcp/odin` - Odin project
- `/mcp/openhorizon` - OpenHorizon project
- `/mcp/health-agent` - Health Agent project

**Project Tools**:
- `task-status` - Get task status from SCAR workspace
- `issue-list` - List GitHub issues
- `epic-progress` - Track epic progress
- `scar-monitor` - Monitor SCAR workspace
- `code-analysis` - Analyze code structure

## Configuration

Projects are configured in `config/projects.json`:

```json
{
  "project-name": {
    "name": "project-name",
    "displayName": "Project Display Name",
    "path": "/absolute/path/to/project",
    "description": "Project description",
    "endpoints": ["/mcp/project-name"],
    "tools": ["tool1", "tool2"],
    "enabled": true
  }
}
```

### Configuration Fields

- `name`: Internal project identifier
- `displayName`: Human-readable name
- `path`: Absolute path to project directory
- `description`: Project description
- `endpoints`: Array of endpoint paths (usually one)
- `tools`: Array of tool names available to this project
- `enabled`: Whether the project is active

## Usage

### Client Connection

Connect to a project-specific endpoint:

```typescript
const client = new MCPClient();
await client.connect('http://localhost:8080/mcp/consilio');
```

### Making Requests

All standard MCP methods are supported:

#### Initialize
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {}
}
```

Response includes project information:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "serverInfo": {
      "name": "supervisor-consilio",
      "version": "1.0.0"
    },
    "capabilities": {
      "tools": {
        "listChanged": false
      }
    },
    "project": {
      "name": "consilio",
      "displayName": "Consilio",
      "description": "Consilio project supervision"
    }
  }
}
```

#### List Tools
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list"
}
```

Returns only tools scoped to this project.

#### Call Tool
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "task-status",
    "arguments": {
      "filter": "active"
    }
  }
}
```

#### Ping
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "ping"
}
```

Response includes project name:
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "result": {
    "status": "ok",
    "project": "consilio"
  }
}
```

### System Endpoints

#### Health Check
```bash
curl http://localhost:8080/health
```

Returns overall system health including multi-project status.

#### Statistics
```bash
curl http://localhost:8080/stats
```

Returns detailed statistics:
```json
{
  "server": {
    "endpoints": 5,
    "tools": 10,
    "projects": {
      "total": 5,
      "enabled": 5,
      "disabled": 0,
      "contexts": 5
    }
  },
  "endpoints": {
    "/mcp/meta": {
      "projectName": "meta",
      "totalRequests": 42,
      "successfulRequests": 40,
      "failedRequests": 2,
      "recentRequests": [...]
    },
    ...
  }
}
```

#### List Endpoints
```bash
curl http://localhost:8080/endpoints
```

Returns all available MCP endpoints.

## Tool Development

### Creating a New Tool

1. Define the tool in `src/mcp/tools/index.ts`:

```typescript
export const myCustomTool: ToolDefinition = {
  name: 'my-custom-tool',
  description: 'Description of what the tool does',
  inputSchema: {
    type: 'object',
    properties: {
      param1: {
        type: 'string',
        description: 'Description of param1',
      },
    },
    required: ['param1'],
  },
  handler: async (params, context: ProjectContext) => {
    // Tool implementation
    // Access project context:
    // - context.project.name
    // - context.workingDirectory
    // - context.isolatedState

    return {
      result: 'success',
      data: 'tool result',
    };
  },
};
```

2. Add to tool exports:

```typescript
export function getAllTools(): ToolDefinition[] {
  return [
    // ... existing tools
    myCustomTool,
  ];
}
```

3. Add tool to project configuration in `config/projects.json`:

```json
{
  "my-project": {
    "tools": [
      "existing-tool",
      "my-custom-tool"
    ]
  }
}
```

### Tool Context

Each tool receives a `ProjectContext`:

```typescript
interface ProjectContext {
  project: ProjectConfig;        // Project configuration
  workingDirectory: string;      // Project path
  isolatedState: Map<string, any>; // Project-specific state
}
```

Use the context to:
- Access project configuration
- Read/write files in project directory
- Store state between tool calls

## Error Handling

### Standard MCP Errors

- `-32700`: Parse error
- `-32600`: Invalid request
- `-32601`: Method not found
- `-32602`: Invalid params
- `-32603`: Internal error

### Custom Errors

- `-32000`: Project not found
- `-32001`: Tool not found
- `-32002`: Context isolation error
- `-32003`: Configuration error

### Error Response Format

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32000,
    "message": "Endpoint not found: /mcp/invalid",
    "data": {
      "availableEndpoints": ["/mcp/meta", "/mcp/consilio", ...]
    }
  }
}
```

## Testing

### Unit Tests

Run unit tests for individual components:

```bash
npm test -- src/tests/unit/ProjectContextManager.test.ts
npm test -- src/tests/unit/ToolRegistry.test.ts
```

### Integration Tests

Run integration tests for the full system:

```bash
npm test -- src/tests/integration/MultiProjectMCPServer.test.ts
```

### Manual Testing

Start the server:
```bash
npm run dev
```

Test with curl:
```bash
# Initialize
curl -X POST http://localhost:8080/mcp/consilio \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}'

# List tools
curl -X POST http://localhost:8080/mcp/consilio \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

# Call tool
curl -X POST http://localhost:8080/mcp/consilio \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"task-status","arguments":{}}}'
```

## Adding a New Project

1. Create project directory in `/home/samuel/sv/`

2. Add project configuration to `config/projects.json`:

```json
{
  "new-project": {
    "name": "new-project",
    "displayName": "New Project",
    "path": "/home/samuel/sv/new-project",
    "description": "Description of new project",
    "endpoints": ["/mcp/new-project"],
    "tools": [
      "task-status",
      "issue-list",
      "epic-progress",
      "scar-monitor",
      "code-analysis"
    ],
    "enabled": true
  }
}
```

3. Restart the server:

```bash
npm run dev
```

The new endpoint will be automatically created at `/mcp/new-project`.

## Performance Considerations

### Caching

Project configurations are loaded once at startup. To reload:

```typescript
await mcpServer.reload();
```

### Concurrent Requests

The server handles concurrent requests across all endpoints. Each request is processed independently with proper context isolation.

### Resource Management

- Request logs are limited to 100 entries per endpoint
- State storage is in-memory (consider persistence for production)
- File operations should use streaming for large files

## Security

### Input Validation

All tool parameters are validated against input schemas before execution.

### Path Validation

Working directories are validated to prevent path traversal attacks.

### Tool Scoping

Tools cannot access resources outside their assigned project scope.

## Troubleshooting

### Endpoint Not Found

Check that:
1. Project is enabled in `config/projects.json`
2. Endpoint path matches project name
3. Server has been restarted after config changes

### Tool Not Available

Check that:
1. Tool is registered in tool registry
2. Tool is listed in project's `tools` array
3. Tool name matches exactly (case-sensitive)

### Context Isolation Issues

Each project should have separate state. If state is mixing:
1. Verify project name in tool context
2. Check that tool is using `context.project.name` correctly
3. Review state management in `ProjectContextManager`

## Future Enhancements

Planned improvements:

- [ ] Database-backed state persistence
- [ ] Dynamic tool registration (hot reload)
- [ ] Tool permission system
- [ ] Rate limiting per project
- [ ] WebSocket support for real-time updates
- [ ] Tool execution timeout configuration
- [ ] Audit logging for tool calls
- [ ] Project-specific authentication
