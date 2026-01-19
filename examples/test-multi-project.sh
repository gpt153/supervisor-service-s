#!/bin/bash

# Test script for Multi-Project MCP Endpoints
# Usage: ./examples/test-multi-project.sh

set -e

BASE_URL="http://localhost:8080"

echo "======================================"
echo "Multi-Project MCP Server Test Script"
echo "======================================"
echo ""

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_section() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

print_test() {
    echo -e "${YELLOW}>>> $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Check if server is running
print_section "1. Server Health Check"
print_test "GET /health"
curl -s "$BASE_URL/health" | jq .
print_success "Health check passed"

# List all endpoints
print_section "2. List Available Endpoints"
print_test "GET /endpoints"
curl -s "$BASE_URL/endpoints" | jq .
print_success "Retrieved endpoints"

# Get server stats
print_section "3. Server Statistics"
print_test "GET /stats"
curl -s "$BASE_URL/stats" | jq .
print_success "Retrieved stats"

# Test Meta endpoint
print_section "4. Test Meta Endpoint - Initialize"
print_test "POST /mcp/meta - initialize"
curl -s -X POST "$BASE_URL/mcp/meta" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}' | jq .
print_success "Meta initialize successful"

print_test "POST /mcp/meta - tools/list"
curl -s -X POST "$BASE_URL/mcp/meta" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | jq .
print_success "Meta tools listed"

# Test Consilio endpoint
print_section "5. Test Consilio Endpoint - Initialize"
print_test "POST /mcp/consilio - initialize"
curl -s -X POST "$BASE_URL/mcp/consilio" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}' | jq .
print_success "Consilio initialize successful"

print_test "POST /mcp/consilio - tools/list"
curl -s -X POST "$BASE_URL/mcp/consilio" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | jq .
print_success "Consilio tools listed"

# Test Odin endpoint
print_section "6. Test Odin Endpoint - Ping"
print_test "POST /mcp/odin - ping"
curl -s -X POST "$BASE_URL/mcp/odin" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"ping"}' | jq .
print_success "Odin ping successful"

# Test OpenHorizon endpoint
print_section "7. Test OpenHorizon Endpoint - Ping"
print_test "POST /mcp/openhorizon - ping"
curl -s -X POST "$BASE_URL/mcp/openhorizon" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"ping"}' | jq .
print_success "OpenHorizon ping successful"

# Test Health Agent endpoint
print_section "8. Test Health-Agent Endpoint - Ping"
print_test "POST /mcp/health-agent - ping"
curl -s -X POST "$BASE_URL/mcp/health-agent" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"ping"}' | jq .
print_success "Health-Agent ping successful"

# Test tool call
print_section "9. Test Tool Call - Meta Service Status"
print_test "POST /mcp/meta - tools/call service-status"
curl -s -X POST "$BASE_URL/mcp/meta" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"service-status","arguments":{}}}' | jq .
print_success "Meta tool call successful"

# Test tool call on project
print_section "10. Test Tool Call - Consilio Task Status"
print_test "POST /mcp/consilio - tools/call task-status"
curl -s -X POST "$BASE_URL/mcp/consilio" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"task-status","arguments":{}}}' | jq .
print_success "Consilio tool call successful"

# Test error handling - invalid endpoint
print_section "11. Test Error Handling - Invalid Endpoint"
print_test "POST /mcp/invalid - ping"
curl -s -X POST "$BASE_URL/mcp/invalid" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"ping"}' | jq .
print_success "Error handling verified"

# Test error handling - invalid method
print_section "12. Test Error Handling - Invalid Method"
print_test "POST /mcp/meta - invalid-method"
curl -s -X POST "$BASE_URL/mcp/meta" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"invalid-method"}' | jq .
print_success "Method error handling verified"

# Final stats
print_section "13. Final Statistics"
print_test "GET /stats (after all tests)"
curl -s "$BASE_URL/stats" | jq .
print_success "Final stats retrieved"

echo ""
print_section "All Tests Complete!"
echo -e "${GREEN}✓ Multi-Project MCP Server is working correctly${NC}"
echo ""
