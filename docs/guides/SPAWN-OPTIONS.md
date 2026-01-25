# Spawn Options: MCP vs CLI Tool

**Two ways to spawn subagents in CLI sessions**

---

## Option 1: Direct CLI Tool (SIMPLER for CLI-only)

**Usage:**
```bash
/home/samuel/sv/supervisor-service-s/scripts/spawn <task_type> "<description>"
```

**Example (from health-agent PS):**
```bash
Bash: cd /home/samuel/sv/health-agent-s && /home/samuel/sv/supervisor-service-s/scripts/spawn implementation "Replace OpenAI with CLIP model in image_embedding.py"
```

**Benefits:**
- ✅ Auto-detects project from pwd (no manual paths)
- ✅ Simple syntax - just 2 arguments
- ✅ Still uses Odin AI router
- ✅ Still tracks usage and cost
- ✅ No MCP layer overhead

**Drawbacks:**
- ❌ Requires Bash tool call (PS can't call scripts directly)
- ❌ No context fields (epic_id, files_to_review)

---

## Option 2: MCP Tool (Current method)

**Usage:**
```javascript
mcp_meta_spawn_subagent({
  task_type: "implementation",
  description: "Replace OpenAI with CLIP...",
  context: {
    project_path: "/home/samuel/sv/health-agent-s",  // REQUIRED
    project_name: "health-agent",                     // REQUIRED
    epic_id: "epic-010",                              // Optional
    files_to_review: [...]                            // Optional
  }
})
```

**Benefits:**
- ✅ Rich context (epic_id, files_to_review, validation_commands)
- ✅ Direct tool call (no Bash wrapper)
- ✅ Consistent with other MCP tools

**Drawbacks:**
- ❌ Must manually specify project_path and project_name
- ❌ More verbose syntax
- ❌ MCP layer adds overhead

---

## Recommendation

**For simple one-off tasks**: Use CLI tool
```bash
Bash: cd /home/samuel/sv/health-agent-s && /home/samuel/sv/supervisor-service-s/scripts/spawn implementation "Quick feature"
```

**For epic implementation with context**: Use MCP tool
```javascript
mcp_meta_spawn_subagent({
  task_type: "implementation",
  description: "Complex feature from epic",
  context: {
    project_path: "/home/samuel/sv/health-agent-s",
    project_name: "health-agent",
    epic_id: "epic-010",
    files_to_review: ["src/services/image_embedding.py"]
  }
})
```

---

## Future: Can We Remove MCP for CLI?

**Question**: If we're CLI-only, do we need MCP at all?

**Analysis:**

### What MCP Provides
1. Tool discovery (list available tools)
2. Tool schema validation
3. Endpoint routing (/mcp/health-agent vs /mcp/consilio)
4. ProjectContext injection

### What We Actually Need for CLI
1. ✅ AI routing → Direct function call
2. ✅ Subagent selection → Direct function call
3. ✅ Execution → Direct function call
4. ✅ Usage tracking → Direct function call

**Conclusion**: MCP is NOT essential for CLI-only usage. We could:
- Remove MCP layer entirely
- PSes call functions directly via Bash scripts
- Simpler architecture, less overhead

**Trade-off**: Lose tool discovery and schema validation (but PSes know which tools exist from CLAUDE.md)

---

## Answer to "Do we need spawn MCP at all?"

**Short answer**: NO, not for CLI-only.

**Longer answer**:
- MCP was designed for multi-client scenarios (browser + CLI + API)
- For CLI-only, direct bash scripts are simpler
- We keep the LOGIC (AI routing, execution, tracking) but skip the MCP protocol layer

**Proposed simplification**:
1. Keep: Odin router, MultiAgentExecutor, usage tracking
2. Remove: MCP protocol, stdio wrapper, endpoint routing
3. Result: Simple bash commands PSes call directly

Would you like me to implement a fully MCP-free spawn system for CLI?

