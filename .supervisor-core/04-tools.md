# Available Tools and Commands

## Shared Commands

Access via `/home/samuel/sv/.claude/commands/`:
- **Analysis/Planning**: `analyze.md`, `create-epic.md`, `create-adr.md`, `plan-feature.md`
- **Supervision**: `supervision/supervise.md`, `supervision/piv-supervise.md`

---

## Primary Execution Tools

**Quick reference - see full guide for details:**

| Tool | When to Use | Syntax |
|------|-------------|--------|
| `mcp_meta_bmad_full_workflow` | User gives feature description | `{ projectName, projectPath, featureDescription }` |
| `mcp_meta_spawn_subagent` | Single task (research, implementation, testing) | `{ task_type, description, context }` |
| `mcp_meta_run_piv_per_step` | Epic exists, no Implementation Notes | `{ projectName, projectPath, epicFile }` |
| `mcp_meta_execute_epic_tasks` | Epic has Implementation Notes | `{ projectName, projectPath, epicFile }` |

**Decision tree:**
```
Feature request?           → bmad_full_workflow
Single task?               → spawn_subagent
Epic without notes?        → run_piv_per_step
Epic with notes?           → execute_epic_tasks
```

**Tools auto-handle**: Odin AI routing, subagent selection, cost tracking

---

## Model Selection Strategy

**CRITICAL: Use Haiku for implementation to conserve tokens**

| Task Type | Model | Subagent Type | Requirements |
|-----------|-------|---------------|--------------|
| **Implementation** (with plan) | `haiku` | `general-purpose` | Detailed epic with file paths, numbered steps |
| **Research/Exploration** | `sonnet` | `Explore` | Open-ended investigation |
| **Planning/Architecture** | `opus` | `Plan` | Complex decisions, system design |
| **Testing/Validation** | `haiku` | `general-purpose` | Clear test instructions |

**Spawn pattern:**
```javascript
// Implementation with clear plan
Task({
  description: "Implement feature X",
  prompt: `[Detailed context from epic/handoff]`,
  subagent_type: "general-purpose",
  model: "haiku"  // Fast, cheap execution
})

// Research/exploration
Task({
  description: "Analyze codebase for X",
  prompt: `[Question to investigate]`,
  subagent_type: "Explore",
  model: "sonnet"  // Needs reasoning
})
```

**Planning quality for Haiku success:**
- ✅ Exact file paths and line numbers
- ✅ Numbered implementation steps
- ✅ Code snippets showing what to change
- ✅ Test commands to verify
- ❌ No architectural decisions left

---

## Infrastructure MCP Tools

| Category | Tools |
|----------|-------|
| **Tunnels** | `tunnel_request_cname`, `tunnel_delete_cname`, `tunnel_list_cnames` |
| **Secrets** | `mcp_meta_set_secret`, `mcp_meta_get_secret`, `mcp_meta_list_secrets` |
| **Ports** | `mcp_meta_allocate_port` |
| **GCloud** | `mcp_gcloud_create_vm`, `mcp_gcloud_delete_vm`, `mcp_gcloud_create_bucket` |

---

## References

- **Complete tool guide**: `/home/samuel/sv/docs/guides/tool-usage-guide.md`
- **Subagent catalog**: `/home/samuel/sv/docs/subagent-catalog.md`
- **MCP tools reference**: `/home/samuel/sv/docs/mcp-tools-reference.md`
