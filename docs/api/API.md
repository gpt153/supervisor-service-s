# Supervisor Service API Documentation

## Overview

The Supervisor Service provides an MCP (Model Context Protocol) server that exposes tools for managing AI supervisor workflows across multiple projects.

## Endpoints

### Health Check

**GET /health**

Returns the health status of the service.

**Response:**
```json
{
  "status": "healthy",
  "uptime": 123456,
  "timestamp": "2024-01-18T12:00:00.000Z",
  "version": "1.0.0",
  "requestCount": 42,
  "errorCount": 0
}
```

### Root Endpoint

**GET /**

Returns basic service information.

**Response:**
```json
{
  "name": "supervisor-service",
  "version": "1.0.0",
  "status": "running",
  "endpoints": ["/health", "/mcp/meta"]
}
```

### MCP Meta Endpoint

**POST /mcp/meta**

Main MCP protocol endpoint for tool execution.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "echo",
        "description": "Echoes back the input message",
        "inputSchema": { ... }
      }
    ]
  }
}
```

## MCP Methods

### initialize

Initialize the MCP connection.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "clientInfo": {
      "name": "client-name",
      "version": "1.0.0"
    }
  }
}
```

### tools/list

List all available tools.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list",
  "params": {}
}
```

### tools/call

Execute a tool.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "echo",
    "arguments": {
      "message": "Hello, World!"
    }
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"message\":\"Hello, World!\",\"timestamp\":\"2024-01-18T12:00:00.000Z\",\"requestId\":\"...\"}"
      }
    ]
  }
}
```

### ping

Simple ping/pong for testing connectivity.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "ping",
  "params": {}
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "result": {
    "pong": true
  }
}
```

## Available Tools

### echo

Echoes back the input message with metadata.

**Input Schema:**
```json
{
  "message": "string"
}
```

**Example:**
```json
{
  "name": "echo",
  "arguments": {
    "message": "Hello!"
  }
}
```

### get_server_info

Returns information about the supervisor service.

**Input Schema:**
```json
{}
```

**Example:**
```json
{
  "name": "get_server_info",
  "arguments": {}
}
```

## Error Codes

| Code | Name | Description |
|------|------|-------------|
| -32700 | Parse Error | Invalid JSON was received |
| -32600 | Invalid Request | The JSON sent is not a valid Request object |
| -32601 | Method Not Found | The method does not exist |
| -32602 | Invalid Params | Invalid method parameter(s) |
| -32603 | Internal Error | Internal JSON-RPC error |
| -32001 | Tool Not Found | The requested tool does not exist |
| -32002 | Tool Execution Error | The tool execution failed |

## Error Response Format

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32601,
    "message": "Method not found: invalid_method",
    "data": {}
  }
}
```

## CORS

CORS is enabled for all origins. Credentials are supported.

## Request Logging

All requests are logged with unique request IDs for tracing. The request ID can be provided via the `x-request-id` header.

## Rate Limiting

Currently not implemented. Will be added in future versions.
