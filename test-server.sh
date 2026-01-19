#!/bin/bash
# Test script for supervisor-service

BASE_URL="http://localhost:8081"

echo "=== Testing Supervisor Service ==="
echo

# Test 1: Health check
echo "Test 1: Health check"
curl -s "$BASE_URL/health" | jq
echo
echo

# Test 2: Root endpoint
echo "Test 2: Root endpoint"
curl -s "$BASE_URL/" | jq
echo
echo

# Test 3: Initialize MCP
echo "Test 3: MCP Initialize"
curl -s -X POST "$BASE_URL/mcp/meta" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
      }
    }
  }' | jq
echo
echo

# Test 4: List tools
echo "Test 4: List tools"
curl -s -X POST "$BASE_URL/mcp/meta" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list"
  }' | jq
echo
echo

# Test 5: Call echo tool
echo "Test 5: Call echo tool"
curl -s -X POST "$BASE_URL/mcp/meta" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "echo",
      "arguments": {
        "message": "Hello from test!"
      }
    }
  }' | jq
echo
echo

# Test 6: Ping
echo "Test 6: Ping"
curl -s -X POST "$BASE_URL/mcp/meta" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 4,
    "method": "ping"
  }' | jq
echo
echo

echo "=== Tests complete ==="
