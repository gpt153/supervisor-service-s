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

### Full BMAD Workflow (Recommended)
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

### Single Task
```
mcp_meta_spawn_subagent({
  task_type: "implementation",  // or: research, planning, testing, validation, fix, review, etc.
  description: "What to do",
  context: {
    project_path: "/home/samuel/sv/your-project-s",  // MANDATORY for PSes
    project_name: "your-project",                     // MANDATORY for PSes
    epic_id: "epic-001",                              // Optional
    files_to_review: ["path/to/file.py"]             // Optional
  }
})
```

**🚨 CRITICAL FOR PSes**: ALWAYS include `project_path` and `project_name` in context
- Without these, agents execute in WRONG directory (supervisor-service-s)
- PSes find their path in `.supervisor-specific/02-deployment-status.md`
- MS can omit these (defaults to supervisor-service-s)

**Use for**: Single isolated task, quick fixes, research, manual operations

**Common task_type values:**
- `planning` - Create BMAD epic from feature description
- `implementation` - Write code for single feature
- `research` - Analyze codebase or investigate issue
- `testing` - Write or run tests
- `validation` - Verify acceptance criteria
- `fix` - Bug fixes
- `review` - Code review

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
