# Setup Claude.ai Projects - Complete Guide

**Status**: ✅ Ready to configure
**All 63 MCP tools are now available on all endpoints!**

---

## FIXED: Tool Availability ✅

**Problem**: Only 5 tools were accessible per endpoint
**Solution**: Updated configuration to expose all 63 tools to every project
**Status**: ✅ Verified - all endpoints now have 63 tools

```bash
# Verified:
curl https://super.153.se/mcp/meta -> 63 tools ✅
curl https://super.153.se/mcp/consilio -> 63 tools ✅
curl https://super.153.se/mcp/odin -> 63 tools ✅
curl https://super.153.se/mcp/openhorizon -> 63 tools ✅
curl https://super.153.se/mcp/health-agent -> 63 tools ✅
```

---

## Configure 5 Claude.ai Projects

### Project 1: SV Meta

**Name**: SV Meta
**MCP URL**: `https://super.153.se/mcp/meta`

**Custom Instructions**: Upload `/home/samuel/sv/supervisor-service/CLAUDE.md`

**Purpose**: Meta-infrastructure management
- Database operations
- System-wide tools
- Cross-project coordination
- Secrets, ports, DNS, GCloud VMs

**Example Questions to Test**:
- "What MCP tools are available?"
- "List all secrets"
- "Show port allocations"
- "Check database health"

---

### Project 2: Consilio

**Name**: Consilio
**MCP URL**: `https://super.153.se/mcp/consilio`

**Custom Instructions**: Upload `/home/samuel/sv/consilio-s/CLAUDE.md`

**Purpose**: Consilio project development
- GitHub: https://github.com/gpt153/consilio-s
- Local: /home/samuel/sv/consilio-s/

**What's in CLAUDE.md**:
- Project identity (Consilio supervisor)
- Tech stack and dependencies
- Development workflow
- Project-specific guidelines
- Available MCP tools

**Example Questions to Test**:
- "What is this project about?"
- "Show me the project structure"
- "Check task status"
- "What's in the .bmad directory?"

---

### Project 3: Odin

**Name**: Odin
**MCP URL**: `https://super.153.se/mcp/odin`

**Custom Instructions**: Upload `/home/samuel/sv/odin-s/CLAUDE.md`

**Purpose**: Odin project development
- GitHub: https://github.com/gpt153/odin-s
- Local: /home/samuel/sv/odin-s/

---

### Project 4: OpenHorizon

**Name**: OpenHorizon
**MCP URL**: `https://super.153.se/mcp/openhorizon`

**Custom Instructions**: Upload `/home/samuel/sv/openhorizon-s/CLAUDE.md`

**Purpose**: OpenHorizon project development
- GitHub: https://github.com/gpt153/openhorizon-s
- Local: /home/samuel/sv/openhorizon-s/

---

### Project 5: Health Agent

**Name**: Health Agent
**MCP URL**: `https://super.153.se/mcp/health-agent`

**Custom Instructions**: Upload `/home/samuel/sv/health-agent-s/CLAUDE.md`

**Purpose**: Health-Agent project development
- GitHub: https://github.com/gpt153/health-agent-s
- Local: /home/samuel/sv/health-agent-s/

---

## What the CLAUDE.md Files Contain

Each `CLAUDE.md` file is **auto-generated** and contains:

### 1. Core Supervisor Identity
```markdown
# Supervisor Identity

You are a **Project Supervisor** in the SV supervisor system.

## Your Role
- Planning & Execution: Coordinate epics, tasks, implementations
- Code Quality: Maintain code quality, tests, documentation
- Issue Management: Track and resolve issues
- Development Workflow: Guide development process
```

### 2. Standard Operating Procedures
```markdown
# Supervisor Workflow

## When Starting Work
1. Check Context: Understand what service/component is being modified
2. Review State: Check database, running services, recent changes
3. Plan Changes: Outline steps before implementing
4. Document: Update relevant documentation
```

### 3. Project Structure
```markdown
# Project Structure

/home/samuel/sv/consilio-s/
├── .bmad/                    # Planning artifacts
│   ├── epics/                # Epic specifications
│   ├── prd/                  # Product requirements
│   ├── adr/                  # Architecture decisions
│   └── architecture/         # Architecture docs
├── backend/                  # Implementation code
├── frontend/                 # Frontend code
├── CLAUDE.md                 # Auto-generated (this file)
└── ...
```

### 4. Available Tools (63 total)
```markdown
# Available Tools

## Infrastructure Automation
- Secrets management (11 tools)
- Port allocation (7 tools)
- Cloudflare DNS (5 tools)
- GCloud VMs (11 tools)

## Intelligent Features
- Task timing (7 tools)
- Learning system (7 tools)
- Instruction management (5 tools)
```

### 5. Project-Specific Context
```markdown
# Project Context: Consilio

**Tech Stack**:
- Backend: Node.js, TypeScript
- Frontend: React, TypeScript
- Database: PostgreSQL
- Deployment: Docker, GCloud

**Current Status**: Active development
**GitHub**: https://github.com/gpt153/consilio-s
**Local Path**: /home/samuel/sv/consilio-s/
```

---

## How to Upload CLAUDE.md to Claude.ai Projects

### Method 1: Copy-Paste (Recommended)
1. Open the CLAUDE.md file locally
2. Copy the entire contents
3. In Claude.ai Project Settings
4. Go to "Custom Instructions"
5. Paste the contents
6. Save

### Method 2: File Upload
1. In Claude.ai Project Settings
2. Go to "Custom Instructions"
3. Click "Upload File"
4. Select the CLAUDE.md file
5. Save

---

## Available MCP Tools (63 Total)

### Project Tools (5 tools)
- `task-status` - Get status of tasks
- `issue-list` - List GitHub issues
- `epic-progress` - Get epic progress
- `scar-monitor` - Monitor SCAR workspace
- `code-analysis` - Analyze code structure

### Meta Tools (5 tools)
- `service-status` - Get supervisor service status
- `service-restart` - Restart services
- `service-logs` - Get service logs
- `health-check` - Health check all services
- `system-metrics` - Get system metrics

### Port Allocation (7 tools)
- `get-port` - Get port details
- `allocate-port` - Allocate a new port
- `list-ports` - List all ports
- `audit-ports` - Audit port usage
- `port-summary` - Get port summary
- `release-port` - Release a port
- `update-port` - Update port details

### Secrets Management (11 tools)
- `mcp__meta__get_secret` - Get a secret
- `mcp__meta__set_secret` - Store a secret
- `mcp__meta__list_secrets` - List all secrets
- `mcp__meta__delete_secret` - Delete a secret
- `mcp__meta__get_expiring_secrets` - Get expiring secrets
- `mcp__meta__get_rotation_secrets` - Get secrets needing rotation
- `mcp__meta__mark_secret_rotation` - Mark secret as rotated
- `mcp__meta__detect_secrets` - Detect secrets in text
- `mcp__meta__create_api_key` - Generate API key
- `mcp__meta__check_for_secrets` - Check text for secrets
- `mcp__meta__redact_secrets` - Redact secrets from text

### Task Timing (7 tools)
- `mcp__meta__estimate_task` - Get task estimate
- `mcp__meta__start_task_timer` - Start timing a task
- `mcp__meta__complete_task_timer` - Complete task timing
- `mcp__meta__get_task_stats` - Get task statistics
- `mcp__meta__get_project_stats` - Get project statistics
- `mcp__meta__track_parallel_execution` - Track parallel work
- `mcp__meta__complete_parallel_execution` - Complete parallel work

### Learning System (7 tools)
- `search-learnings` - Search past learnings (RAG)
- `index-learning` - Index a new learning
- `index-all-learnings` - Index all learnings
- `get-learning-stats` - Get learning statistics
- `track-learning-application` - Track when learning is applied
- `verify-learning` - Verify a learning
- `get-learning-by-id` - Get specific learning

### Instruction Management (5 tools)
- `mcp__meta__list_projects` - List all projects
- `mcp__meta__regenerate_supervisor` - Regenerate CLAUDE.md
- `mcp__meta__update_core_instruction` - Update core instruction
- `mcp__meta__read_core_instruction` - Read core instruction
- `mcp__meta__list_core_instructions` - List all core instructions

### Cloudflare Integration (5 tools)
- `mcp__meta__create_cname` - Create CNAME record
- `mcp__meta__create_a_record` - Create A record
- `mcp__meta__delete_dns_record` - Delete DNS record
- `mcp__meta__list_dns_records` - List DNS records
- `mcp__meta__sync_tunnel` - Sync Cloudflare tunnel

### GCloud Integration (11 tools)
- `gcloud-get-vm` - Get VM details
- `gcloud-start-vm` - Start a VM
- `gcloud-stop-vm` - Stop a VM
- `gcloud-resize-vm` - Resize a VM
- `gcloud-vm-health` - Check VM health
- `gcloud-list-vms` - List all VMs
- `gcloud-create-vm` - Create a new VM
- `gcloud-delete-vm` - Delete a VM
- `gcloud-evaluate-scaling` - Evaluate auto-scaling needs
- `gcloud-auto-scale` - Auto-scale VMs
- `gcloud-list-projects` - List GCloud projects

---

## What You Can Now Do

### In Each Project (Consilio, Odin, OpenHorizon, Health Agent):

1. **Continue Development**
   - "Let's implement the user authentication feature"
   - "Add a new API endpoint for user profiles"
   - "Fix the bug in the payment processing"

2. **Use Automation**
   - "Allocate a port for the new service"
   - "Store the API key in secrets"
   - "Create a DNS record for the new service"

3. **Get Smart Estimates**
   - "How long will it take to implement feature X?"
   - "Show me historical timing for similar tasks"

4. **Learn from Past Work**
   - "What did we learn about database optimization?"
   - "Search for patterns related to authentication"

5. **Manage Infrastructure**
   - "Start the staging VM"
   - "Check health of all services"
   - "What ports are allocated to this project?"

### In Meta Project:

1. **System-Wide Operations**
   - "Show all secrets across all projects"
   - "List all port allocations"
   - "Update core supervisor instructions"

2. **Cross-Project Queries**
   - "Which projects are using PostgreSQL?"
   - "Show all GCloud VMs"
   - "List all Cloudflare DNS records"

3. **Database Management**
   - "Run migrations"
   - "Check database health"
   - "Query project statistics"

---

## Testing Your Setup

After configuring each project:

### Test Meta Project:
```
You: "List all MCP tools available"
Claude: [Shows 63 tools]

You: "List all secrets"
Claude: [Uses mcp__meta__list_secrets tool]

You: "Show port allocations"
Claude: [Uses list-ports tool]
```

### Test Consilio Project:
```
You: "What is this project?"
Claude: [Explains Consilio from CLAUDE.md]

You: "Show project structure"
Claude: [Lists directories from .bmad/]

You: "Allocate port 5175"
Claude: [Uses allocate-port tool]
```

---

## Quick Reference

| Need to... | Use Project | Ask Claude |
|------------|-------------|------------|
| Implement a feature | Consilio/Odin/etc | "Let's implement X feature" |
| Allocate a port | Any project | "Allocate port for service Y" |
| Store a secret | Meta or project | "Store API key for service Z" |
| Check estimates | Any project | "Estimate time for task X" |
| Search learnings | Any project | "Search learnings about X" |
| Manage VMs | Meta | "Start/stop VM named X" |
| Update DNS | Meta | "Create DNS record for X" |
| Database ops | Meta | "Run migrations" |

---

## Benefits of This Setup

✅ **5 Isolated Contexts**: Each project has its own supervisor
✅ **63 MCP Tools**: Full automation at your fingertips
✅ **Smart Estimates**: Data-driven with confidence intervals
✅ **RAG Learning**: Search past knowledge semantically
✅ **Auto Infrastructure**: Ports, secrets, DNS, VMs all automated
✅ **Multi-Device**: Access from desktop, laptop, mobile
✅ **Public Access**: HTTPS via Cloudflare tunnel
✅ **Team Ready**: Share endpoints with collaborators

---

## You're Ready!

1. ✅ All 63 tools are accessible
2. ✅ Public endpoints working (https://super.153.se/mcp/*)
3. ✅ CLAUDE.md files ready for each project
4. ✅ Supervisor service running
5. ✅ Database configured
6. ✅ Cloudflare tunnel routing

**Next Step**: Open Claude.ai and create your first project! 🚀

Start with the "SV Meta" project to test the system, then add your development projects one by one.
