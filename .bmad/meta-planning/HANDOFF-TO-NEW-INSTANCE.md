# Complete Handoff to New Instance

**Date:** 2026-01-18
**From:** Initial setup instance
**To:** New instance continuing build-out
**Location:** `/home/samuel/sv/`

---

## 🎯 Mission

**Build the complete new supervisor system in isolation, then migrate when ready.**

**DO NOT:**
- Touch `/home/samuel/supervisor/` (old planning repo)
- Touch `/home/samuel/.archon/workspaces/` (old SCAR workspaces)
- Push anything to GitHub yet (except supervisor-service already pushed)
- Break currently working systems

**DO:**
- Build freely in `/home/samuel/sv/`
- Test everything here first
- Implement remaining epics
- Prepare for eventual migration

---

## 📜 Complete History (How We Got Here)

### Initial Planning Session

**User wanted:** Meta-supervisor service to manage multiple AI-developed projects

**We created three comprehensive planning documents:**
1. **PRD-supervisor-service.md** - Product requirements, user stories, success metrics
2. **TECHNICAL-SPEC-supervisor-service.md** - Database schema, API spec, architecture
3. **EPIC-BREAKDOWN-supervisor-service.md** - 12 epics with tasks and estimates

**Key requirements from planning:**
- Secrets management (AES-256-GCM encryption)
- Port allocation system (guaranteed conflict prevention)
- Task timing and estimation (data-driven)
- Cloudflare integration (DNS, tunnels)
- GCloud integration (VM management)
- Multi-project MCP for Claude.ai Projects
- Instruction propagation system
- Learning system integration

### Repository Structure Debates

**We went through several iterations:**

**First approach:** Two repositories per project
- Planning: `gpt153/supervisor/consilio/`
- Implementation: `gpt153/consilio`
- **Problem:** Too confusing, hard to maintain

**Second approach:** Keep implementation in `.archon/workspaces/`
- Planning: `/home/samuel/supervisor/`
- Implementation: `/home/samuel/.archon/workspaces/`
- **Problem:** Scattered, hard to find things

**Final approach (CURRENT):** Single unified repository per project
- Everything: `/home/samuel/sv/consilio/` (cloned from `gpt153/consilio`)
- Planning + implementation together
- Clean, simple, maintainable

### The "Fresh Start" Decision

**Why `/home/samuel/sv/`?**

User said: "I'm starting to think this is getting confusing. How about we start fresh in a new dir."

**Brilliant idea because:**
- ✅ Zero risk to current working systems
- ✅ Build complete new architecture in isolation
- ✅ Test everything before migration
- ✅ Easy to compare old vs new
- ✅ Can switch back if needed

**Current state:**
- Old system (`/home/samuel/supervisor/`, `.archon/workspaces/`) - **UNTOUCHED, STILL WORKING**
- New system (`/home/samuel/sv/`) - **BUILDING HERE**

---

## ✅ What's DONE (Foundation Complete)

### 1. Database (PostgreSQL)

**Location:** Local PostgreSQL on port 5434 (Unix socket)
**Database name:** `supervisor`
**User:** `supervisor_user`
**Password:** Empty (trust authentication via socket)

**Schema created (11 tables):**
1. **secrets** - Encrypted secret storage (AES-256-GCM)
2. **project_port_ranges** - Port ranges per project (100 ports each)
3. **port_allocations** - Individual port allocations
4. **task_executions** - Task timing and estimation data
5. **knowledge_chunks** - RAG embeddings for learning system
6. **instruction_updates** - Instruction propagation tracking
7. **cloudflare_dns_records** - DNS management
8. **cloudflare_tunnel_routes** - Tunnel routing
9. **gcloud_vms** - VM inventory
10. **gcloud_health_metrics** - VM health data
11. **secret_detection_patterns** - API key patterns

**Extensions installed:**
- `pgcrypto` (encryption functions)
- `vector` (pgvector for RAG)

**Seed data:**
- Meta port range: 3000-3099
- Shared services: 9000-9099
- API key detection patterns (Anthropic, OpenAI, Stripe, GitHub, etc.)

### 2. Core Managers (TypeScript)

**SecretsManager** (`src/secrets/SecretsManager.ts`)
- AES-256-GCM encryption
- Hierarchical key paths (`meta/`, `project/consilio/`, etc.)
- Methods: store, retrieve, list, delete, exists, bulkStore

**PortManager** (`src/ports/PortManager.ts`)
- Automatic port allocation (100 ports per project)
- Guaranteed conflict prevention via database constraints
- Methods: allocatePort, allocateSpecificPort, listAllocations, releasePort, getUtilization
- Automatic range calculation (3000 + projectId * 100)

**TaskTimer** (`src/timing/TaskTimer.ts`)
- Task execution tracking
- Data-driven estimation (with confidence intervals)
- Methods: startTask, completeTask, getStats, estimateTask
- Full-text search for similar tasks

**CloudflareManager** (`src/cloudflare/CloudflareManager.ts`)
- Database operations implemented
- API integration: **STUB** (Epic 5)

**GCloudManager** (`src/gcloud/GCloudManager.ts`)
- Database operations implemented
- API integration: **STUB** (Epic 6)

### 3. MCP Server

**Location:** `src/mcp/server.ts`
**Transport:** stdio (for Claude.ai Projects)
**Tools implemented:** 9 total

**Secrets tools:**
- `mcp__meta__store_secret`
- `mcp__meta__retrieve_secret`
- `mcp__meta__list_secrets`

**Ports tools:**
- `mcp__meta__allocate_port`
- `mcp__meta__list_ports`
- `mcp__meta__get_port_utilization`
- `mcp__meta__release_port`

**Task tools:**
- `mcp__meta__start_task`
- `mcp__meta__complete_task`
- `mcp__meta__get_task_stats`

**Project Scoping:**
- Environment variable: `PROJECT_NAME` (defaults to "meta")
- Meta project = full access (no filtering)
- Other projects = scoped access:
  - Secrets: Only `project/{name}/*` and `meta/*`
  - Ports: Only their allocated range
  - Tasks: Only their task history

**How it works:**
```bash
# Meta supervisor (full access)
PROJECT_NAME=meta node dist/mcp/server.js

# Consilio supervisor (scoped access)
PROJECT_NAME=consilio node dist/mcp/server.js
```

### 4. Documentation Created

**Planning docs:**
- `PRD-supervisor-service.md` - Product requirements
- `TECHNICAL-SPEC-supervisor-service.md` - Technical architecture
- `EPIC-BREAKDOWN-supervisor-service.md` - 12 epics

**Setup docs:**
- `docs/CLAUDE-AI-PROJECTS-SETUP.md` - Connect from Claude.ai browser
- `docs/BROWSER-CONNECTION.md` - Browser setup details
- `PROJECT-SCOPING-IMPLEMENTATION.md` - Technical details on scoping
- `PROJECT-SCOPING-QUICKREF.md` - Quick reference

**Other docs:**
- `README.md` - Overview of supervisor-service
- `MIGRATION-PLAN.md` - Old approach (now superseded by /sv/)

### 5. BMAD System Setup

**Just completed by setup script:**

```
/home/samuel/sv/
├── .claude/commands/          ← Shared subagent commands
│   ├── analyze.md
│   ├── create-epic.md
│   ├── create-adr.md
│   ├── plan-feature.md
│   └── supervision/
│       ├── supervise-issue.md
│       ├── scar-monitor.md
│       ├── approve-scar-plan.md
│       ├── verify-scar-phase.md
│       └── verify-scar-start.md
│
├── templates/                 ← Shared templates
│   ├── epic-template.md
│   ├── adr-template.md
│   ├── prd-template.md
│   └── ...
│
├── docs/                      ← Shared documentation
│   ├── role-and-responsibilities.md
│   ├── scar-integration.md
│   ├── bmad-workflow.md
│   └── ...
│
├── supervisor-service/
│   ├── .bmad/
│   │   ├── project-brief.md
│   │   ├── workflow-status.yaml
│   │   ├── epics/
│   │   ├── adr/
│   │   └── prd/
│   └── CLAUDE.md
│
├── consilio/
│   ├── .bmad/ (same structure)
│   └── CLAUDE.md
│
├── odin/
│   ├── .bmad/ (same structure)
│   └── CLAUDE.md
│
├── openhorizon/
│   ├── .bmad/ (same structure)
│   └── CLAUDE.md
│
├── health-agent/
│   ├── .bmad/ (same structure)
│   └── CLAUDE.md
│
└── CLAUDE.md (root)
```

### 6. Git Status

**supervisor-service:**
- Initialized as git repo
- Remote: `gpt153/supervisor-service`
- Old code backed up to `legacy-implementation` branch
- New code pushed to `main` branch
- **PUSHED TO GITHUB** ✅

**Other projects (consilio, odin, etc.):**
- Cloned from GitHub
- **NOT MODIFIED YET**
- **DO NOT PUSH** until new system is complete

---

## ❌ What's NOT Done (Remaining Work)

### Epic 12: Automatic Secret Detection (3-4 hours) **HIGH PRIORITY**

**Status:** Database table + patterns seeded, logic NOT implemented

**What needs implementation:**
1. **AutoSecretDetector class** (`src/secrets/AutoSecretDetector.ts`)
   - Pattern matching against user messages
   - Auto-detect API keys (Anthropic, OpenAI, Stripe, GitHub, etc.)
   - Auto-store when detected

2. **API Key Creation** (where possible)
   - Google/Gemini: Via Service Account creation
   - Stripe: Via restricted key creation
   - GitHub: Via installation token creation
   - Anthropic/OpenAI: Not possible (no API)

3. **Integration with supervisors**
   - Hook into user message flow
   - Detect patterns automatically
   - Store without asking twice

**Why this is priority:** Immediate UX improvement, quick win

### Epic 8: Instruction Management (6-8 hours) **HIGH PRIORITY**

**Status:** Database table created, system NOT implemented

**What needs implementation:**
1. **Instruction Propagation System**
   - Core instructions (shared by all)
   - Meta-specific instructions
   - Project-specific instructions
   - One command to update all supervisors

2. **Instruction Assembly**
   - Read layered instructions
   - Generate CLAUDE.md for each project
   - Preserve project-specific sections

3. **Adapt-Local-Claude**
   - Analyze project codebase
   - Extract patterns, conventions, tech stack
   - Update project-specific instructions
   - Auto-trigger on major changes (epic complete, PR merge, etc.)

**Files to create:**
- `src/instructions/InstructionAssembler.ts`
- `src/instructions/AdaptLocalClaude.ts`
- `.supervisor-core/` directory (core instructions)
- MCP tools: `propagate_instructions`, `adapt_project_instructions`

**Why this is priority:** Critical for supervisors to know how to work

### Epic 10: PIV Loop Implementation (12-16 hours) **HIGH PRIORITY**

**Status:** NOT implemented

**What needs implementation:**
1. **Adapt Cole Medin's PIV Loop**
   - Read: `/home/samuel/sv/docs/piv-loop-adaptation-guide.md`
   - Transform remote webhooks → local subprocesses
   - GitHub comments → Direct returns
   - Slash commands → TypeScript methods

2. **Three Agents:**
   - PrimePhase: Analyze, plan, decompose
   - PlanPhase: Detailed plan with dependencies
   - ExecutePhase: Coordinate SCAR, verify, iterate

3. **Integration:**
   - Supervisor spawns PIV agents
   - PIV agents coordinate with SCAR
   - Verification and validation built-in

**Files to create:**
- `src/agents/piv/PrimePhase.ts`
- `src/agents/piv/PlanPhase.ts`
- `src/agents/piv/ExecutePhase.ts`
- `src/agents/piv/PIVOrchestrator.ts`

**Why this is priority:** THIS IS HOW SUPERVISORS ACTUALLY BUILD

### Epic 5: Cloudflare Integration (8-10 hours) **LOW PRIORITY**

**Status:** Database tables created, manager stubs exist, API integration NOT done

**Skip for now** - Not needed to start building projects

### Epic 6: GCloud Integration (10-14 hours) **LOW PRIORITY**

**Status:** Database tables created, manager stubs exist, API integration NOT done

**Skip for now** - Not needed to start building projects

### Epic 9: Learning System Integration (4-6 hours) **LOW PRIORITY**

**Status:** Database table created (knowledge_chunks), RAG NOT implemented

**Skip for now** - Nice-to-have, not critical

### Epic 11: Multi-Project MCP Endpoints (4-6 hours) **MAYBE SKIP**

**Status:** NOT implemented

**Current solution:** Single MCP server with `PROJECT_NAME` env var for scoping
**Proposed:** Separate MCP endpoints on different ports

**Discussion needed:** Current solution might be good enough

---

## 🎯 Implementation Priority

**Build Order:**
1. **Epic 12** (3-4 hours) - Automatic secret detection
   - Quick win
   - Immediate UX improvement
   - User never asked for same API key twice

2. **Epic 8** (6-8 hours) - Instruction management
   - Get supervisors properly configured
   - Core + Meta + Project-specific layering
   - Adapt-local-claude for project optimization

3. **Epic 10** (12-16 hours) - PIV loop
   - The actual "how supervisors build" workflow
   - Critical for project work
   - Adapt Cole Medin's approach

**After these 3 (22-28 hours total), you can start building projects!**

**Later (when needed):**
4. Epic 5 - Cloudflare (infrastructure)
5. Epic 6 - GCloud (infrastructure)
6. Epic 9 - Learning RAG (enhancement)

---

## 🗂️ Key Files Reference

### Database

**Connection:**
- Host: `/var/run/postgresql` (Unix socket)
- Port: 5434
- Database: `supervisor`
- User: `supervisor_user`
- Password: (empty - trust auth)

**Schema:** `src/db/schema.sql` (run via `src/db/setup.ts`)

**Environment variables:**
```bash
DB_HOST=/var/run/postgresql
DB_PORT=5434
DB_NAME=supervisor
DB_USER=supervisor_user
DB_PASSWORD=
ENCRYPTION_KEY=ead0721a1b7c254b762ceb0a139c0104281c836a75d16d750788751dbf411f4f
```

### MCP Server

**Run:**
```bash
cd /home/samuel/sv/supervisor-service
npm run build
npm run mcp  # Starts stdio MCP server
```

**Test:**
```bash
# As meta (full access)
PROJECT_NAME=meta npm run mcp

# As consilio (scoped access)
PROJECT_NAME=consilio npm run mcp
```

**Configure in Claude.ai Projects:**
See: `docs/CLAUDE-AI-PROJECTS-SETUP.md`

### Source Code Structure

```
supervisor-service/src/
├── db/
│   ├── pool.ts           ← Database connection pooling
│   ├── schema.sql        ← Complete schema
│   └── setup.ts          ← Database setup script
│
├── secrets/
│   └── SecretsManager.ts ← AES-256-GCM encryption
│
├── ports/
│   └── PortManager.ts    ← Port allocation
│
├── timing/
│   └── TaskTimer.ts      ← Task tracking
│
├── cloudflare/
│   └── CloudflareManager.ts ← STUB (Epic 5)
│
├── gcloud/
│   └── GCloudManager.ts  ← STUB (Epic 6)
│
└── mcp/
    └── server.ts         ← MCP server with project scoping
```

---

## 📋 Next Steps for New Instance

### Immediate (First Session)

1. **Read all planning docs:**
   ```bash
   cd /home/samuel/sv/supervisor-service
   cat PRD-supervisor-service.md
   cat TECHNICAL-SPEC-supervisor-service.md
   cat EPIC-BREAKDOWN-supervisor-service.md
   ```

2. **Verify database:**
   ```bash
   sudo -u postgres psql -d supervisor -p 5434 -c "\dt"
   # Should show 11 tables
   ```

3. **Test current implementation:**
   ```bash
   cd /home/samuel/sv/supervisor-service
   npm run build
   npm start  # Should show "Service initialized successfully"
   ```

### Implement Epic 12: Automatic Secret Detection

**Create these files:**
1. `src/secrets/AutoSecretDetector.ts` - Pattern matching and detection
2. `src/secrets/ApiKeyCreator.ts` - Auto-create Google/Stripe/GitHub keys
3. Update `src/mcp/server.ts` - Add tool: `mcp__meta__detect_secrets`

**Test:**
```bash
# User provides API key in message
# System auto-detects and stores
# Never asks again
```

### Implement Epic 8: Instruction Management

**Create these files:**
1. `.supervisor-core/core-behaviors.md` - Shared by all supervisors
2. `.supervisor-core/tool-usage.md` - Tool usage patterns
3. `.supervisor-core/bmad-methodology.md` - BMAD workflow
4. `src/instructions/InstructionAssembler.ts` - Assemble CLAUDE.md
5. `src/instructions/AdaptLocalClaude.ts` - Project-specific optimization

**MCP tools to add:**
- `mcp__meta__propagate_instructions` - Update all supervisors
- `mcp__meta__adapt_project` - Optimize project instructions

### Implement Epic 10: PIV Loop

**Create these files:**
1. `src/agents/piv/PrimePhase.ts`
2. `src/agents/piv/PlanPhase.ts`
3. `src/agents/piv/ExecutePhase.ts`
4. `src/agents/piv/PIVOrchestrator.ts`

**MCP tools to add:**
- `mcp__meta__start_piv_loop` - Kick off PIV workflow
- `mcp__meta__piv_status` - Check PIV progress

**Reference:**
- `/home/samuel/sv/docs/piv-loop-adaptation-guide.md`

---

## 🔧 Technical Details

### Encryption

**Algorithm:** AES-256-GCM
**Key:** 32 bytes (64 hex characters)
**Current key:** `ead0721a1b7c254b762ceb0a139c0104281c836a75d16d750788751dbf411f4f`
**Storage format:** `[IV (16 bytes)][Auth Tag (16 bytes)][Encrypted Data]`

### Port Allocation

**Algorithm:**
```typescript
portRangeStart = 3000 + (projectId * 100)
portRangeEnd = portRangeStart + 99

// Project 0 (meta): 3000-3099
// Project 1 (consilio): 3100-3199
// Project 2 (odin): 3200-3299
// etc.

// Shared services: 9000-9099
```

**Maximum projects:** 619 (before hitting port 65535)

### Task Estimation

**Algorithm:**
1. Full-text search for similar tasks
2. Calculate mean and standard deviation of durations
3. Return 95% confidence interval
4. Format: `estimated ± margin` (e.g., "45 ± 12 minutes")

**Improves over time** as more task data accumulates

### Project Scoping

**Filtering logic:**
```typescript
const projectName = process.env.PROJECT_NAME || 'meta';

if (projectName === 'meta') {
  // Full access - no filtering
  return allData;
}

// Scoped access
secrets = secrets.filter(s =>
  s.keyPath.startsWith(`project/${projectName}/`) ||
  s.keyPath.startsWith('meta/')
);

ports = ports.filter(p => p.projectName === projectName);
tasks = tasks.filter(t => t.projectName === projectName);
```

---

## 📚 Important Documentation to Read

**Before starting implementation:**

1. **Planning docs** (understand requirements):
   - `PRD-supervisor-service.md`
   - `TECHNICAL-SPEC-supervisor-service.md`
   - `EPIC-BREAKDOWN-supervisor-service.md`

2. **Architecture docs** (understand system design):
   - `docs/piv-loop-adaptation-guide.md`
   - `docs/supervisor-instruction-propagation-system.md`
   - `docs/automatic-secrets-and-api-key-creation.md`

3. **Integration docs** (understand how pieces fit):
   - `docs/CLAUDE-AI-PROJECTS-SETUP.md`
   - `docs/scar-integration.md`
   - `docs/bmad-workflow.md`

---

## 🚨 Critical Reminders

### DO NOT
- ❌ Touch `/home/samuel/supervisor/` (old system)
- ❌ Touch `/home/samuel/.archon/workspaces/` (old SCAR workspaces)
- ❌ Push changes to projects (consilio, odin, etc.) yet
- ❌ Run any commands that might break currently working systems

### DO
- ✅ Work exclusively in `/home/samuel/sv/`
- ✅ Test everything in isolation
- ✅ Push supervisor-service changes (already configured)
- ✅ Ask if unsure about something
- ✅ Document decisions as you go

### Safe Commands
```bash
# Always work in /sv/
cd /home/samuel/sv/supervisor-service

# Safe to build/test
npm run build
npm run mcp
npm start

# Safe to commit (supervisor-service only)
git add .
git commit -m "..."
git push origin main

# DO NOT push from other projects yet!
```

---

## 🎓 Context Notes

### Why This Matters

**User is non-technical** - Focus on outcomes, not implementation details.

**User has multiple projects:**
- Consilio (Next.js app)
- Odin (monitoring system)
- OpenHorizon (large codebase)
- Health-Agent (health monitoring)

**User wants:**
- Use Claude.ai browser with Opus for planning (not just CLI)
- Manage all projects from one system
- SCAR does implementation
- Supervisor verifies and guides
- No port conflicts
- No lost secrets
- Accurate time estimates

### Why /sv/ Exists

Started in `/home/samuel/supervisor/supervisor-service/` but:
- Got confusing with old system
- User wisely said "start fresh"
- Built complete foundation in /sv/
- Test here, migrate when ready

### Why Project Scoping Matters

Each Claude.ai Project should see ONLY its data:
- Consilio can't see OpenHorizon secrets
- Odin can't see Health-Agent ports
- Meta can see everything (for cross-project management)

**Implementation:** `PROJECT_NAME` env var + filtering in MCP tools

### Why Three Epics First

**Epic 12** - Users hate repeating themselves (API keys)
**Epic 8** - Supervisors need to know how to work
**Epic 10** - The actual workflow for building

Everything else can wait.

---

## 🎯 Success Criteria

**You'll know you're done when:**

1. ✅ User provides API key once → Never asked again
2. ✅ All supervisors have proper instructions
3. ✅ PIV loop works end-to-end
4. ✅ User can say "Plan feature X" and it works
5. ✅ SCAR builds, supervisor verifies, merge happens
6. ✅ No manual intervention needed

**Then we can start building actual projects!**

---

## 📞 Questions to Ask User

**If you need clarification:**

1. "Should Epic 11 (separate MCP endpoints) be implemented, or is PROJECT_NAME scoping good enough?"
2. "For Epic 10 (PIV loop), should I closely follow Cole Medin's structure or adapt more loosely?"
3. "Any specific project (consilio, odin, etc.) you want to test the PIV loop with first?"

---

## 🏁 Final Checklist Before Starting

- [ ] Read this entire document
- [ ] Read PRD, Technical Spec, Epic Breakdown
- [ ] Verify database is running (`psql -d supervisor -p 5434`)
- [ ] Test current code (`npm start` in supervisor-service)
- [ ] Review Epic 12 requirements
- [ ] Review Epic 8 requirements
- [ ] Review Epic 10 requirements
- [ ] Understand isolation rules (don't break old system!)

---

**You have all the context. You have the foundation. Build the remaining epics and let's start creating projects!**

**Good luck! 🚀**
