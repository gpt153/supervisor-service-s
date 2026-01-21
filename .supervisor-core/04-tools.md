# Available Tools and Commands

## Shared Commands

Access via `/home/samuel/sv/.claude/commands/`:

### Analysis and Planning
- `analyze.md` - Analyst agent for codebase analysis
- `create-epic.md` - PM agent for epic creation
- `create-adr.md` - Architect agent for ADR creation
- `plan-feature.md` - Meta-orchestrator for feature planning

### Supervision
- `supervision/supervise.md` - Full project supervision
- `supervision/piv-supervise.md` - PIV-specific supervision
- `supervision/prime-supervisor.md` - Context priming

## Subagent Spawning (Primary Tool)

**CRITICAL: Use this for ALL execution tasks.**

```
mcp_meta_spawn_subagent({
  task_type: "implementation",  // research, planning, testing, validation, documentation, fix, deployment, review
  description: "What to do",
  context: { /* optional */ }
})
```

**Automatically handles**:
- Queries Odin for optimal AI service
- Selects appropriate subagent template
- Spawns agent with best model
- Tracks usage and cost

**Common task types**: research, planning, implementation, testing, validation, documentation, fix, deployment, review

**Full catalog**: `/home/samuel/sv/docs/subagent-catalog.md`

---

## Infrastructure MCP Tools

**Use for infrastructure operations (NEVER manual bash commands):**

| Category | Tools |
|----------|-------|
| **Tunnels** | `tunnel_request_cname`, `tunnel_delete_cname`, `tunnel_list_cnames` |
| **Secrets** | `mcp_meta_set_secret`, `mcp_meta_get_secret`, `mcp_meta_list_secrets` |
| **Ports** | `mcp_meta_allocate_port` |
| **GCloud** | `mcp_gcloud_create_vm`, `mcp_gcloud_delete_vm`, `mcp_gcloud_create_bucket` |

**Full reference**: `/home/samuel/sv/docs/mcp-tools-reference.md`

---

## External Integrations

- **PostgreSQL**: Issue tracking and metrics
- **GitHub**: Issue synchronization (future)
- **Prometheus**: Metrics export (future)
