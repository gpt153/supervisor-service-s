#!/bin/bash
# Test MCP setup for Claude Code CLI sessions
# This script verifies that the stdio wrapper and MCP server are working correctly

set -e

echo "🧪 Testing MCP Setup for Claude Code CLI Sessions"
echo "=================================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Check MCP server is running
echo "Test 1: Check MCP server is running..."
if curl -s http://localhost:8081/health > /dev/null; then
    echo -e "${GREEN}✓ MCP server is running on port 8081${NC}"
else
    echo -e "${RED}✗ MCP server is NOT running on port 8081${NC}"
    echo "  Start it with: systemctl --user start supervisor-mcp.service"
    exit 1
fi
echo ""

# Test 2: Check MCP endpoints
echo "Test 2: Check MCP endpoints..."
ENDPOINTS=$(curl -s http://localhost:8081/endpoints | jq -r '.endpoints[]')
echo "  Available endpoints:"
echo "$ENDPOINTS" | sed 's/^/    /'
if echo "$ENDPOINTS" | grep -q "/mcp/meta"; then
    echo -e "${GREEN}✓ MCP endpoints are configured${NC}"
else
    echo -e "${RED}✗ MCP endpoints not found${NC}"
    exit 1
fi
echo ""

# Test 3: Test stdio wrapper (meta)
echo "Test 3: Test stdio wrapper (meta endpoint)..."
cd /home/samuel/sv/supervisor-service-s
TEST_RESPONSE=$((echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"1.0","clientInfo":{"name":"test","version":"1.0"}}}'; sleep 1) | timeout 3 node scripts/mcp-stdio-wrapper.mjs meta 2>/dev/null || echo "timeout")
if echo "$TEST_RESPONSE" | grep -q "supervisor-meta"; then
    echo -e "${GREEN}✓ STDIO wrapper works (meta endpoint)${NC}"
else
    echo -e "${RED}✗ STDIO wrapper failed (meta endpoint)${NC}"
    echo "  Response: $TEST_RESPONSE"
    exit 1
fi
echo ""

# Test 4: Test stdio wrapper (odin)
echo "Test 4: Test stdio wrapper (odin endpoint)..."
cd /home/samuel/sv/odin-s
TEST_RESPONSE=$((echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"1.0","clientInfo":{"name":"test","version":"1.0"}}}'; sleep 1) | timeout 3 node /home/samuel/sv/supervisor-service-s/scripts/mcp-stdio-wrapper.mjs odin 2>/dev/null || echo "timeout")
if echo "$TEST_RESPONSE" | grep -q "supervisor-odin"; then
    echo -e "${GREEN}✓ STDIO wrapper works (odin endpoint)${NC}"
else
    echo -e "${RED}✗ STDIO wrapper failed (odin endpoint)${NC}"
    echo "  Response: $TEST_RESPONSE"
    exit 1
fi
echo ""

# Test 5: Test auto-detecting wrapper
echo "Test 5: Test auto-detecting wrapper..."
cd /home/samuel/sv/consilio-s
TEST_RESPONSE=$((echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"1.0","clientInfo":{"name":"test","version":"1.0"}}}'; sleep 1) | timeout 3 node /home/samuel/sv/supervisor-service-s/scripts/mcp-auto-wrapper.mjs 2>/dev/null || echo "timeout")
if echo "$TEST_RESPONSE" | grep -q "supervisor-consilio"; then
    echo -e "${GREEN}✓ Auto-detecting wrapper works (detected consilio)${NC}"
else
    echo -e "${RED}✗ Auto-detecting wrapper failed${NC}"
    echo "  Response: $TEST_RESPONSE"
    exit 1
fi
echo ""

# Test 6: Check MCP config files
echo "Test 6: Check MCP configuration files..."
if [ -f ~/.config/claude/mcp_servers.json ]; then
    echo -e "${GREEN}✓ Global MCP config exists (~/.config/claude/mcp_servers.json)${NC}"
else
    echo -e "${YELLOW}⚠ Global MCP config not found${NC}"
fi

PROJECT_CONFIGS=(
    "/home/samuel/sv/supervisor-service-s/.claude/mcp_servers.json"
    "/home/samuel/sv/consilio-s/.claude/mcp_servers.json"
    "/home/samuel/sv/odin-s/.claude/mcp_servers.json"
    "/home/samuel/sv/openhorizon-s/.claude/mcp_servers.json"
    "/home/samuel/sv/health-agent-s/.claude/mcp_servers.json"
)

MISSING_CONFIGS=0
for config in "${PROJECT_CONFIGS[@]}"; do
    if [ -f "$config" ]; then
        echo -e "${GREEN}✓ ${config}${NC}"
    else
        echo -e "${RED}✗ ${config} (missing)${NC}"
        MISSING_CONFIGS=$((MISSING_CONFIGS + 1))
    fi
done

if [ $MISSING_CONFIGS -eq 0 ]; then
    echo -e "${GREEN}✓ All project MCP configs exist${NC}"
else
    echo -e "${YELLOW}⚠ Some project configs are missing${NC}"
fi
echo ""

# Test 7: Test tools are available
echo "Test 7: Check spawn tool is available..."
SPAWN_TOOL=$(curl -s -X POST http://localhost:8081/mcp/odin \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | \
  jq -r '.result.tools[] | select(.name=="mcp_meta_spawn_subagent") | .name')

if [ "$SPAWN_TOOL" = "mcp_meta_spawn_subagent" ]; then
    echo -e "${GREEN}✓ mcp_meta_spawn_subagent tool is available${NC}"
else
    echo -e "${RED}✗ mcp_meta_spawn_subagent tool NOT found${NC}"
    exit 1
fi
echo ""

# Summary
echo "=================================================="
echo -e "${GREEN}✅ All tests passed! MCP setup is working correctly.${NC}"
echo ""
echo "Next steps:"
echo "  1. Start a Claude Code CLI session in a project directory"
echo "  2. Try: 'Use mcp_meta_spawn_subagent to spawn a research agent'"
echo "  3. Verify database shows spawn from the project (not just meta)"
echo ""
echo "Debug command:"
echo "  PGPASSWORD=supervisor psql -U supervisor -h localhost -p 5434 -d supervisor_service \\"
echo "    -c \"SELECT project, COUNT(*) FROM active_spawns GROUP BY project;\""
echo ""
