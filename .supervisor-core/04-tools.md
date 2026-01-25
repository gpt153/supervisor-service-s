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

### Single Task (RECOMMENDED: Task Tool Directly)

**Direct Task tool execution** (simplest and most reliable):
```
Task(
  prompt="[Read instructions file and execute task]",
  description="[5-10 word summary]",
  subagent_type="general-purpose",
  model="sonnet"  // or "haiku" for simple tasks, "opus" for complex
)
```

**When to use**:
- ✅ All implementation, research, testing tasks
- ✅ Guaranteed tool access (Write/Edit/Bash)
- ✅ No external API limitations

### Single Task (Legacy: CLI Spawn)

**⚠️ DEPRECATED: This prepares instructions but requires manual Task tool call.**

```bash
Bash: /home/samuel/sv/supervisor-service-s/scripts/spawn <task_type> "<description>"
```

**Process:**
1. Spawn queries Odin for service recommendation
2. Returns `task_tool_params` with model + instructions file
3. **You must then call Task tool** with those parameters

**Use Task tool directly instead** - simpler and more reliable.

**Common task types:** implementation, research, testing, validation, planning, documentation, deployment

### Single Task (MCP Alternative)

**Use MCP when you need epic context:**
```javascript
mcp_meta_spawn_subagent({
  task_type: "implementation",
  description: "What to do",
  context: {
    project_path: "/home/samuel/sv/your-project-s",  // REQUIRED
    project_name: "your-project",                     // REQUIRED
    epic_id: "epic-001",                              // Optional
    files_to_review: ["path/to/file.py"]             // Optional
  }
})
```

**When to use MCP spawn:**
- Need epic_id context for task tracking
- Need files_to_review list for complex tasks
- Need validation_commands for testing

**Otherwise, prefer CLI spawn (simpler).**

### Full BMAD Workflow
```
mcp_meta_bmad_full_workflow({
  projectName: "project",
  projectPath: "/path",
  featureDescription: "User's feature request"
})
```

**Use when**: User provides feature description (start-to-finish workflow)
**Does**: Complete 4-phase BMAD (Analysis → Planning → Architecture → Implementation)
- Auto-detects complexity (0-4) and greenfield vs brownfield
- Creates all artifacts (feature request, PRD, epic, ADRs) as needed
- Implements and validates

**Complexity reference**: `/home/samuel/sv/docs/guides/bmad-user-guide.md`

### Epic Implementation - Option 1: PIV Per-Step
```
mcp_meta_run_piv_per_step({
  projectName: "project",
  projectPath: "/path",
  epicFile: ".bmad/epics/epic-001.md"
})
```

**Use when**: Epic exists but NO Implementation Notes yet
**Does**: Prime (research) → Plan (design) → Execute (code) → Validate (test)

### Epic Implementation - Option 2: Execute Tasks
```
mcp_meta_execute_epic_tasks({
  projectName: "project",
  projectPath: "/path",
  epicFile: ".bmad/epics/epic-001.md"
})
```

**Use when**: Epic has detailed numbered Implementation Notes
**Does**: Execute tasks → Validate criteria (faster, skips research/planning)

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
