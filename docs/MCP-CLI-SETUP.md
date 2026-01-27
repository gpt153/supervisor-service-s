# MCP Setup for Claude Code CLI Sessions

**Last Updated**: 2026-01-23

---

## Problem

Claude Code CLI sessions (tmux/terminal) could not use supervisor MCP tools like `mcp_meta_spawn_subagent` because:
- Supervisor MCP server runs as HTTP server on localhost:8081
- Claude Code expects MCP servers to communicate via stdio (stdin/stdout)
- No bridge existed between stdio and HTTP protocols

**Result**: PSes in tmux sessions froze when trying to spawn subagents. Database showed only "meta" spawns, no spawns from other projects.

---

## Solution

Created stdio wrapper scripts that bridge Claude Code's stdio protocol to the HTTP MCP server:

### Architecture

```
Claude Code CLI Session (stdio)
         ↓
  mcp-stdio-wrapper.mjs
         ↓
  HTTP POST to localhost:8081/mcp/{project}
         ↓
  Supervisor MCP Server (Fastify HTTP)
         ↓
  MCP Tools (spawn_subagent, etc.)
```

---

## Files Created

### 1. STDIO Wrapper (`scripts/mcp-stdio-wrapper.mjs`)

Translates stdio JSON-RPC to HTTP calls:
- Reads JSON-RPC from stdin
- POSTs to `http://localhost:8081/mcp/{project}`
- Writes response to stdout

**Usage**:
```bash
node scripts/mcp-stdio-wrapper.mjs <project>
```

**Example**:
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize",...}' | \
  node scripts/mcp-stdio-wrapper.mjs odin
```

### 2. Auto-Detecting Wrapper (`scripts/mcp-auto-wrapper.mjs`)

Automatically detects project from current working directory:
- Maps directory names to project endpoints
- Supports subdirectories (e.g., `/home/samuel/sv/odin-s/src/` → `odin`)
- Falls back to `meta` if unknown

**Project mapping**:
- `supervisor-service-s` → `meta`
- `consilio-s` → `consilio`
- `odin-s` → `odin`
- `openhorizon-s` → `openhorizon`
- `health-agent-s` → `health-agent`

### 3. MCP Configuration Files

#### Global Config (`~/.config/claude/mcp_servers.json`)

```json
{
  "mcpServers": {
    "supervisor": {
      "command": "node",
      "args": [
        "/home/samuel/sv/supervisor-service-s/scripts/mcp-auto-wrapper.mjs"
      ]
    }
  }
}
```

Uses auto-detecting wrapper for convenience.

#### Project-Specific Configs (`.claude/mcp_servers.json`)

Each project directory has its own config:

```json
{
  "mcpServers": {
    "supervisor": {
      "command": "node",
      "args": [
        "/home/samuel/sv/supervisor-service-s/scripts/mcp-stdio-wrapper.mjs",
        "odin"
      ]
    }
  }
}
```

Explicitly specifies project endpoint.

---

## How It Works

### When Claude Code starts:

1. Reads `~/.config/claude/mcp_servers.json` (global) OR `.claude/mcp_servers.json` (project-specific)
2. Spawns `node scripts/mcp-stdio-wrapper.mjs <project>`
3. Wrapper keeps stdin/stdout open for JSON-RPC communication

### When PS uses `mcp_meta_spawn_subagent`:

1. Claude Code sends JSON-RPC to wrapper via stdin
2. Wrapper POSTs to `http://localhost:8081/mcp/{project}`
3. MCP server processes request and returns JSON-RPC response
4. Wrapper writes response to stdout
5. Claude Code receives response and proceeds

---

## Testing

### Manual Test

```bash
# Test wrapper directly
cd /home/samuel/sv/odin-s
export MCP_DEBUG=1
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"1.0","clientInfo":{"name":"test","version":"1.0"}}}' | \
  node /home/samuel/sv/supervisor-service-s/scripts/mcp-auto-wrapper.mjs

# Expected output:
# [MCP-AUTO] Auto-detected project: odin
# [MCP-AUTO] Connecting to: http://localhost:8081/mcp/odin
# {"jsonrpc":"2.0","id":1,"result":{...}}
```

### Claude Code Test

```bash
# Start Claude in Odin directory
cd /home/samuel/sv/odin-s
claude

# In Claude session, test tools availability
> What MCP tools do you have available?

# Should list all supervisor tools including mcp_meta_spawn_subagent
```

### Database Verification

```bash
# Check for spawns from odin project
PGPASSWORD=supervisor psql -U supervisor -h localhost -p 5434 \
  -d supervisor_service \
  -c "SELECT project, COUNT(*) FROM active_spawns GROUP BY project;"

# Expected: spawns from multiple projects, not just "meta"
```

---

## Troubleshooting

### Claude hangs when starting

**Symptoms**: Claude CLI freezes on startup, no response

**Debug**:
```bash
export MCP_DEBUG=1
claude --debug 2>&1 | grep -i mcp
```

**Possible causes**:
- MCP server not running on port 8081
- Wrapper script not executable
- Network issue (firewall blocking localhost:8081)

**Fix**:
```bash
# Check MCP server status
curl http://localhost:8081/health

# Check wrapper is executable
ls -la /home/samuel/sv/supervisor-service-s/scripts/*.mjs

# Test wrapper directly
cd /home/samuel/sv/odin-s && echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | \
  node /home/samuel/sv/supervisor-service-s/scripts/mcp-auto-wrapper.mjs
```

### Tools not available

**Symptoms**: Claude doesn't see MCP tools

**Check**:
```bash
# Verify config exists
cat ~/.config/claude/mcp_servers.json

# Test MCP endpoint
curl -X POST http://localhost:8081/mcp/odin \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | jq '.result.tools[].name' | head -10
```

### Spawns not working

**Symptoms**: `mcp_meta_spawn_subagent` called but no database entry

**Debug**:
```bash
# Check spawn tool is available
curl -X POST http://localhost:8081/mcp/odin \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/list","params":{}}' | \
  jq '.result.tools[] | select(.name=="mcp_meta_spawn_subagent")'

# Check database for recent spawns
PGPASSWORD=supervisor psql -U supervisor -h localhost -p 5434 \
  -d supervisor_service \
  -c "SELECT * FROM active_spawns ORDER BY spawn_time DESC LIMIT 5;"
```

---

## Known Limitations

1. **No live reload**: Changes to wrapper scripts require restarting Claude session
2. **Global config only**: Claude Code doesn't support per-project MCP configs yet (fixed with project-specific `.claude/` directory)
3. **HTTP dependency**: Requires MCP server running on localhost:8081

---

## Future Improvements

1. **Native stdio MCP server**: Convert supervisor MCP to dual HTTP/stdio server
2. **Health monitoring**: Wrapper should check if MCP server is available before connecting
3. **Reconnection**: Auto-reconnect if MCP server restarts
4. **Better error messages**: More descriptive errors when MCP calls fail

---

## References

- MCP Server Implementation: `/home/samuel/sv/supervisor-service-s/src/mcp/`
- MCP Daemon: `/home/samuel/sv/supervisor-service-s/src/mcp/mcp-daemon.ts`
- Spawn Tool: `/home/samuel/sv/supervisor-service-s/src/mcp/tools/spawn-subagent-tool.ts`
- Port Allocation: `/home/samuel/sv/supervisor-service-s/.supervisor-specific/02-deployment-status.md`

---

**Status**: ✅ Deployed and Tested (2026-01-23)
**Maintained by**: Meta-supervisor
