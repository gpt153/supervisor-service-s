# Focused Roadmap: Autonomous Supervision First

**Date:** 2026-01-18
**Priority:** Get autonomous supervision working BEFORE infrastructure
**Architecture:** LOCAL PIV agents (Prime → Plan → Execute), NOT remote SCAR

---

## Your Priority (Correct Understanding)

### Week 1: PIV Loop + Autonomous Supervision

**Goal:** Meta-supervisor and project supervisors can autonomously build features using local PIV subagents

**What You Need:**

1. **EPIC-010: PIV Loop Working End-to-End**
   - PrimePhase: Research codebase, find patterns
   - PlanPhase: Create prescriptive implementation plan
   - ExecutePhase: Implement following plan, validate, create PR
   - All running as **LOCAL subprocesses** (not remote webhooks!)
   - Model selection: Haiku for execution (cost-effective)

2. **Autonomous Supervisor Behavior**
   - Meta-supervisor spawns PIV agents for features
   - Project supervisors spawn PIV agents autonomously
   - **NO asking permission** - just do it
   - Report progress every 30 minutes
   - Only escalate when blocked (last resort)

3. **Subagent Spawning Working**
   - Supervisor spawns PIV orchestrator
   - PIV orchestrator spawns Prime/Plan/Execute phases
   - Each phase completes and returns results
   - Context conservation (<20K tokens for supervisor)

4. **Correct CLAUDE.md Instructions**
   - Core autonomous behaviors at TOP
   - Explicit: "SPAWN subagents, NEVER run loops yourself"
   - Clear PIV loop workflow
   - No SCAR references (wrong architecture!)

---

## Week 1 Implementation Plan

### Day 1-2: Complete PIV Loop (EPIC-010)

**Status Check:**
```bash
# What exists in supervisor-service/src/agents/piv/
ls -la /home/samuel/sv/supervisor-service/src/agents/piv/
```

**What needs to be done:**

1. **PrimePhase.ts** - Codebase research
   - Analyze project structure
   - Search local RAG for patterns
   - Generate context document
   - **Returns:** Context file path + tech stack + conventions

2. **PlanPhase.ts** - Implementation design
   - Read context from Prime
   - Design solution following project patterns
   - Create prescriptive task list
   - Generate validation commands
   - **Returns:** Plan file path + task count

3. **ExecutePhase.ts** - Build and validate
   - Read plan
   - Create feature branch
   - Implement each task
   - Run validation after each
   - Commit changes
   - Create PR
   - **Returns:** PR number + validation results

4. **PIVOrchestrator.ts** - Coordinate all phases
   - Spawn Prime → wait for result
   - Spawn Plan with Prime context → wait for result
   - Spawn Execute with Plan → wait for result
   - Track timing (via EPIC-007)
   - **Returns:** Complete status to supervisor

**Test criteria:**
```bash
# Supervisor says: "Build dark mode for Consilio"
# PIVOrchestrator should:
1. Spawn PrimePhase (Haiku) → researches Consilio codebase
2. Spawn PlanPhase (Sonnet) → creates detailed plan
3. Spawn ExecutePhase (Haiku) → implements + validates + creates PR
4. Returns: "✅ Dark mode complete, PR #123"

# Total supervisor context used: <20K tokens
# Total time: 15-25 minutes
```

### Day 3: Meta-Supervisor Instructions

**File:** `/home/samuel/sv/supervisor-service/.supervisor-meta/meta-specific.md`

**Add sections:**

```markdown
## Autonomous PIV Loop Execution

When user says "build X" or "implement Y":

YOU MUST:
1. Create epic (if feature is medium/complex)
2. SPAWN PIV orchestrator with epic content
3. RETURN TO IDLE (conserve context!)
4. Wait for PIV orchestrator to report completion

PIV orchestrator handles EVERYTHING:
  - Researches codebase (Prime)
  - Designs solution (Plan)
  - Implements + validates + creates PR (Execute)
  - Reports: "✅ Complete, PR #X"

DO NOT:
  ❌ Implement code yourself
  ❌ Monitor PIV agents (they're autonomous)
  ❌ Ask "should I proceed with plan?" (just approve reasonable plans)
  ❌ Run polling loops

## 30-Minute Status Updates

While PIV agents work, post SHORT updates every 30 minutes:

Format:
```
HH:MM - PIV agents actively building feature X:
  - Prime phase complete (analyzed 47 files)
  - Plan phase complete (8 tasks identified)
  - Execute phase: 60% done (5/8 tasks complete)

All progressing as expected.
```

Keep it to 1-2 paragraphs maximum.

## Error Recovery (Self-Healing)

If PIV agent fails:
1. Retry once automatically
2. If fails again: Analyze error, adjust approach
3. If fails third time: Try simpler approach
4. Only escalate to user after exhausting solutions

AUTO-FIX these:
  - Missing directories (create them)
  - Missing dependencies (install them)
  - Linting errors (fix them)
  - Build config issues (adjust them)

ESCALATE these:
  - Breaking API changes (need user decision)
  - Merge conflicts (need user input)
  - Security vulnerabilities (need user review)
```

### Day 4: Project Supervisor Setup

**For each project (Consilio, Odin, OpenHorizon, Health-Agent):**

1. **Create `.bmad/` structure**
   ```bash
   mkdir -p {project}/.bmad/{epics,adr}
   cp /home/samuel/sv/.bmad/project-brief.md {project}/.bmad/
   # Customize for project
   ```

2. **Generate project CLAUDE.md**
   ```bash
   # Use InstructionAssembler (EPIC-008)
   # Combine: .supervisor-core/ + project-specific instructions
   ```

3. **Test PIV loop in project**
   ```bash
   # In project context: "Add a simple utility function"
   # Should autonomously create PR
   ```

### Day 5: Integration Testing

**Test scenarios:**

1. **Simple feature** (1-2 files)
   - "Add console logging to error handler"
   - Should complete in 5-10 minutes
   - PR created automatically

2. **Medium feature** (3-5 files)
   - "Add dark mode toggle"
   - Should complete in 15-25 minutes
   - All tests passing

3. **Complex feature** (6+ files)
   - "Add authentication system"
   - Should complete in 30-45 minutes
   - Proper validation

**Success criteria:**
- ✅ Zero permission requests
- ✅ Autonomous completion
- ✅ Clean PRs with passing tests
- ✅ Supervisor context < 20K tokens

---

## Week 2: Claude SDK + MCP Connection

**AFTER Week 1 works perfectly:**

### Prerequisites
- [ ] PIV loop working end-to-end
- [ ] Supervisors autonomous (no asking permission)
- [ ] Tested with real features in multiple projects
- [ ] Context conservation verified

### Goals

1. **Claude Agent SDK Integration**
   - Persistent agent sessions
   - Conversation continuity
   - Session storage in PostgreSQL
   - Graceful reconnection

2. **MCP Server Multi-Project**
   - `/mcp/meta` → Meta-supervisor
   - `/mcp/consilio` → Consilio supervisor
   - `/mcp/odin` → Odin supervisor
   - `/mcp/openhorizon` → OpenHorizon supervisor
   - `/mcp/health-agent` → Health-Agent supervisor

3. **Claude.ai Projects Setup**
   - 5 browser tabs (one per project)
   - Each connected to correct MCP endpoint
   - Context isolation working
   - Multi-tab workflow tested

**Estimated:** 10-12 hours with agents

---

## Infrastructure Automation (Later)

**Can wait until after Week 2:**

- ❌ EPIC-005: Cloudflare (manual DNS for now)
- ❌ EPIC-006: GCloud (manual VM management for now)
- ❌ EPIC-009: Learning system (nice to have)
- ❌ EPIC-012: Auto-secret detection (manual for now)

**Reason:** You need autonomous building working FIRST. Infrastructure automation is valuable but not blocking.

---

## Critical Differences from Old System

### ❌ NOT Using (SCAR-based)
- Remote agent via GitHub webhooks
- SCAR commands (@scar /command-invoke)
- GitHub comments for communication
- `supervise-issue.md` monitoring SCAR
- `approve-scar-plan.md` approving SCAR plans
- 2-minute polling loops

### ✅ Using (PIV-based)
- LOCAL PIV agents (subprocesses)
- Direct TypeScript method calls
- Direct returns (no GitHub parsing)
- PIVOrchestrator spawning phases
- Auto-approve reasonable plans (in PlanPhase)
- Event-driven (no polling)

---

## File Locations (Correct)

### Planning
- `/home/samuel/sv/.bmad/` - ALL planning docs
- `/home/samuel/sv/.bmad/system-design/piv-loop-adaptation-guide.md` - Architecture

### Implementation
- `/home/samuel/sv/supervisor-service/src/agents/piv/` - PIV loop code
- `/home/samuel/sv/supervisor-service/.supervisor-core/` - Core instructions
- `/home/samuel/sv/supervisor-service/.supervisor-meta/` - Meta-specific instructions

### Projects
- `/home/samuel/sv/{project}/.bmad/` - Project planning
- `/home/samuel/sv/{project}/CLAUDE.md` - Auto-generated instructions

---

## Success Metrics

**Week 1 complete when:**
- [ ] PIV loop runs end-to-end (Prime → Plan → Execute)
- [ ] Feature branch created automatically
- [ ] Code implemented following project patterns
- [ ] Tests run and passing
- [ ] PR created with proper description
- [ ] Supervisor used <20K tokens total
- [ ] Zero permission requests from supervisor
- [ ] Works in at least 2 projects (Consilio + Odin)

**Week 2 complete when:**
- [ ] 5 Claude.ai Projects configured
- [ ] Can switch tabs to switch projects
- [ ] MCP tools work in each tab
- [ ] No context mixing between projects
- [ ] Can build features from browser naturally

---

## Immediate Next Steps

1. **Check PIV agent implementation status**
   ```bash
   ls -la /home/samuel/sv/supervisor-service/src/agents/piv/
   cat /home/samuel/sv/supervisor-service/src/agents/piv/PIVOrchestrator.ts
   ```

2. **Identify what's missing in PIV loop**
   - Is Prime/Plan/Execute complete?
   - Is orchestration working?
   - Is Git integration done?
   - Is PR creation working?

3. **Complete missing pieces**
   - Use agents to finish implementation
   - Test each phase independently
   - Then test full cycle

4. **Update supervisor instructions**
   - Meta-supervisor: autonomous PIV spawning
   - Project supervisors: autonomous execution
   - Remove any SCAR references

5. **Test with real feature**
   - "Add dark mode to Consilio"
   - Measure autonomy and success

---

## FAQ

**Q: Why PIV loop instead of direct implementation?**
A: PIV ensures high quality through:
- Prime: Deep codebase understanding
- Plan: Prescriptive task breakdown
- Execute: Validation-driven implementation

**Q: Why local agents instead of remote SCAR?**
A:
- Simpler architecture (no webhooks)
- Faster communication (direct returns)
- Better for non-coder (no GitHub complexity)
- Works from Claude.ai browser

**Q: Why wait on infrastructure automation?**
A: Autonomous building is the foundation. Infrastructure automation adds value but isn't blocking you from continuing development.

**Q: When should I use Haiku vs Sonnet?**
A:
- Haiku: Execution (Prime, Execute phases) - follows prescriptive instructions
- Sonnet: Planning (Plan phase) - needs reasoning and design thinking
- 60-85% cost savings

---

**Status:** Week 1 ready to start - focus on PIV loop autonomous execution
**Next:** Check current PIV implementation, complete missing pieces, test end-to-end

