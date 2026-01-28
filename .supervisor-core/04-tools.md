# Available Tools and Commands

## Shared Commands

Access via `/home/samuel/sv/.claude/commands/`:
- **Analysis/Planning**: `analyze.md`, `create-epic.md`, `create-adr.md`, `plan-feature.md`
- **Supervision**: `supervision/supervise.md`, `supervision/piv-supervise.md`

---

## Primary Execution Tools

**YOU ONLY USE THE TASK TOOL**

**All work via spawning subagents:**

```javascript
Task({
  description: "Brief description",
  prompt: `Detailed instructions`,
  subagent_type: "general-purpose" | "Explore" | "Plan" | "Bash",
  model: "haiku" | "sonnet" | "opus"
})
```

**Decision tree:**
- Feature request → Task tool (BMAD subagent)
- Single task → Task tool (appropriate subagent)
- Epic implementation → Task tool (implementation subagent)
- Research/analysis → Task tool (Explore subagent)
- Planning → Task tool (Plan subagent)

---

## Model Selection

**CRITICAL: Use Haiku for implementation (conserve tokens)**

| Task | Model | Subagent | Requirements |
|------|-------|----------|--------------|
| Implementation (with plan) | `haiku` | `general-purpose` | Detailed epic, file paths, steps |
| Research/Exploration | `sonnet` | `Explore` | Open-ended |
| Planning/Architecture | `opus` | `Plan` | Complex decisions |
| Testing/Validation | `haiku` | `general-purpose` | Clear instructions |

**Planning quality for Haiku success:**
- ✅ Exact file paths and line numbers
- ✅ Numbered implementation steps
- ✅ Code snippets showing changes
- ✅ Test commands to verify
- ❌ No architectural decisions left

---

## Infrastructure MCP Tools

**PSes have autonomous access via meta-supervisor:**

| Category | Tools |
|----------|-------|
| **GCloud VM** (11) | Create/list/start/stop/delete VMs, health, auto-scaling |
| **GCloud OAuth** (6) | Create brands/clients, credentials |
| **Tunnels** (3) | `tunnel_request_cname`, `tunnel_delete_cname`, `tunnel_list_cnames` |
| **Secrets** (3) | `mcp_meta_set_secret`, `mcp_meta_get_secret`, `mcp_meta_list_secrets` |
| **Ports** (3) | `mcp_meta_allocate_port`, `mcp_meta_get_port`, `mcp_meta_list_ports` |

**GCloud**: VM management across 3 projects (odin, odin3, openhorizon), OAuth 2.0, auto-scaling, health monitoring

---

## References

**Tool guide:** `/home/samuel/sv/docs/guides/tool-usage-guide.md`
**Subagent catalog:** `/home/samuel/sv/docs/subagent-catalog.md`
**GCloud docs:** `/home/samuel/sv/supervisor-service-s/docs/` (quickstart, oauth, examples, status)
