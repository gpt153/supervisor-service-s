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

## Execution Tools (Primary)

**CRITICAL: Use these for ALL execution tasks.**

### Single Task
```
mcp_meta_spawn_subagent({
  task_type: "implementation",  // or: research, planning, testing, validation, fix, review, etc.
  description: "What to do",
  context: { /* optional */ }
})
```

**Use for**: Single isolated task, quick fixes, research, creating epics

**Common task_type values:**
- `planning` - Create BMAD epic from feature description
- `implementation` - Write code for single feature
- `research` - Analyze codebase or investigate issue
- `testing` - Write or run tests
- `validation` - Verify acceptance criteria
- `fix` - Bug fixes
- `review` - Code review

### Epic Implementation (BMAD Only)
```
mcp_meta_bmad_implement_epic({
  projectName: "project",
  projectPath: "/path",
  epicFile: ".bmad/epics/epic-001.md"
})
```

**Use when**: Epic file EXISTS with Implementation Notes

**If epic doesn't exist**: First spawn PM agent with `task_type: "planning"` to create epic

**All tools auto-handle**:
- Query Odin for optimal AI service
- Select appropriate subagent template
- Track usage and cost

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
