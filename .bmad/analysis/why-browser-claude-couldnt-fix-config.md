# Why Browser Claude Couldn't Fix the Config Issue

**Date**: 2026-01-20
**Issue**: Browser Claude could plan but not implement due to wrong path in config/projects.json

---

## The Problem

**config/projects.json:5** had wrong path:
```json
{
  "meta": {
    "path": "/home/samuel/sv/supervisor-service"  // ❌ Missing -s suffix
  }
}
```

**Actual directory**: `/home/samuel/sv/supervisor-service-s`

---

## Why Browser Claude Couldn't Detect This

### 1. MCP Protocol Limitation

When browser Claude connects to the MCP server, it calls `initialize`:

**Request:**
```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}
```

**Response** (from ProjectEndpoint.ts:103-121):
```json
{
  "result": {
    "protocolVersion": "2024-11-05",
    "serverInfo": {
      "name": "supervisor-meta",
      "version": "1.0.0"
    },
    "project": {
      "name": "meta",
      "displayName": "Meta Infrastructure",
      "description": "Meta supervisor infrastructure and service management"
      // ❌ NO "path" field
      // ❌ NO "workingDirectory" field
    }
  }
}
```

### 2. No Tool Exposes Working Directory

Browser Claude has access to 20+ MCP tools:
- `task-status`, `issue-list`, `epic-progress`
- `service-status`, `service-logs`
- `get-port`, `allocate-port`
- `mcp__meta__get_secret`, `set_secret`
- etc.

**NONE of these tools expose `context.workingDirectory`**

### 3. Context Is Internal to Server

The ProjectContext is used internally:

```typescript
// src/mcp/ProjectContextManager.ts:52
const context: ProjectContext = {
  project: config,
  workingDirectory: config.path,  // ← Used internally by server
  isolatedState: new Map(),
};
```

Tools receive this context when executed, but browser Claude **never sees it directly**.

### 4. CLAUDE.md Loaded Separately

Browser Claude's CLAUDE.md comes from **claude.ai project custom instructions**, NOT from the MCP server. So:

- ✅ CLAUDE.md has correct paths (`/home/samuel/sv/supervisor-service-s/`)
- ✅ Instructions reference correct directory
- ❌ MCP server uses different path (from config.json)
- ❌ Browser Claude can't see the mismatch

---

## The Mismatch Flow

```
┌─────────────────────────────────────────────────────┐
│ Browser Claude (BP)                                 │
├─────────────────────────────────────────────────────┤
│ CLAUDE.md: /home/samuel/sv/supervisor-service-s/   │ ✅ Correct
│ (from claude.ai custom instructions)                │
└─────────────────────────────────────────────────────┘
                    │
                    │ Uses MCP tools
                    ▼
┌─────────────────────────────────────────────────────┐
│ MCP Server (HTTP on localhost:8081)                │
├─────────────────────────────────────────────────────┤
│ config/projects.json:                               │
│   "path": "/home/samuel/sv/supervisor-service"      │ ❌ Wrong
│                                                     │
│ ProjectContext:                                     │
│   workingDirectory: "/home/samuel/sv/supervisor-... │ ❌ Wrong
│   (not exposed to client)                          │
└─────────────────────────────────────────────────────┘
                    │
                    │ File operations
                    ▼
┌─────────────────────────────────────────────────────┐
│ File System                                         │
├─────────────────────────────────────────────────────┤
│ /home/samuel/sv/supervisor-service/                 │ ❌ Doesn't exist!
│ /home/samuel/sv/supervisor-service-s/               │ ✅ Actual directory
└─────────────────────────────────────────────────────┘
```

---

## Why Planning Worked But Implementation Failed

| Phase | Used | Result |
|-------|------|--------|
| **Planning** | CLAUDE.md context (loaded from custom instructions) | ✅ Success - correct paths |
| **Implementation** | MCP tools → workingDirectory from config.json | ❌ Failure - wrong path |

Browser Claude planned using its loaded context, but when it called MCP tools to implement, those tools used the wrong working directory.

---

## What Browser Claude Could See

1. **Available tools** (via `tools/list`)
2. **Tool schemas** (input parameters)
3. **Tool results** (output from execution)
4. **Error messages** (when tools fail)

## What Browser Claude COULDN'T See

1. ❌ Working directory path
2. ❌ Project configuration
3. ❌ MCP server's internal state
4. ❌ The mismatch between its CLAUDE.md and the server's config

---

## How CLI Claude Detected It

CLI Claude (this session) has access to:

1. **Read tool** - Can read config/projects.json directly
2. **Grep tool** - Can search codebase for paths
3. **Bash tool** - Can check actual directories exist
4. **Full filesystem access** - Not limited to MCP tools

CLI Claude was able to:
1. Read config/projects.json → Found wrong path
2. Check actual directory → `/home/samuel/sv/supervisor-service-s` exists
3. Grep for references → Found all other paths use `-s` suffix
4. **Directly edit config/projects.json** to fix the issue

---

## The Fix Applied

### 1. Updated config/projects.json
```json
{
  "meta": {
    "path": "/home/samuel/sv/supervisor-service-s"  // ✅ Added -s
  }
}
```

### 2. Restarted MCP server
```bash
pkill -f "tsx watch src/index.ts"
npm run dev
```

Now `ProjectContextManager` loads the correct path, and all MCP tools use the right working directory.

---

## Lessons Learned

### For MCP Server Design

**Consider exposing project context in initialize response:**
```typescript
// ProjectEndpoint.ts:103-121
private async handleInitialize(params: any): Promise<any> {
  return {
    project: {
      name: this.context.project.name,
      displayName: this.context.project.displayName,
      description: this.context.project.description,
      path: this.context.project.path,  // 🔧 Add this!
      workingDirectory: this.context.workingDirectory,  // 🔧 And this!
    },
  };
}
```

This would allow browser Claude to:
- Detect path mismatches
- Verify working directory is correct
- Debug issues autonomously

### For Debugging

When browser Claude can't fix something, it's often because:
1. Information is hidden behind abstractions
2. No tool exposes the necessary data
3. Context is split across multiple systems (custom instructions vs MCP)

**Solution**: CLI Claude with direct filesystem access can read/modify any file.

---

## Status

✅ **Fixed**: config/projects.json now uses correct path
✅ **Applied**: MCP server restarted with updated config
✅ **Verified**: Server healthy with 5 endpoints

Browser Claude can now implement changes successfully in supervisor-service-s.
