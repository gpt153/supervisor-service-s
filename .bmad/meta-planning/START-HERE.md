# 🚀 Supervisor System: START HERE

**Date:** 2026-01-18
**Status:** ✅ Documentation Consolidated - Ready to Build
**Architecture:** PIV Loop + BMAD + MCP

---

## ⭐ SINGLE SOURCE OF TRUTH

**ALL PLANNING:** `/home/samuel/sv/.bmad/`

This is the ONLY location for documentation. Everything else is either a symlink or implementation code.

---

## 📖 Quick Start (3 Minutes)

### 1. Understand the Architecture

Read these 3 docs in order:

1. **What We're Building** → `/home/samuel/sv/.bmad/project-brief.md` (2 min)
2. **How It Works** → `/home/samuel/sv/.bmad/system-design/piv-loop-adaptation-guide.md` (5 min) ⭐ CRITICAL
3. **What to Build** → `/home/samuel/sv/.bmad/epics/EPIC-BREAKDOWN.md` (3 min)

### 2. Understand What's Different

**We're building PIV-based local agents, NOT SCAR remote agent**

Key differences:
- ✅ LOCAL agents (subprocesses) - NOT remote webhooks
- ✅ MCP tools for communication - NOT GitHub comments
- ✅ Multi-tab Claude.ai browser - NOT Telegram/Slack
- ✅ Direct returns - NOT GitHub issue parsing

### 3. Start Building

Go to: `/home/samuel/sv/.bmad/epics/EPIC-BREAKDOWN.md`

Week 1 Priority:
- EPIC-010: PIV Loop with **multiple parallel agents**
- Autonomous supervision (no asking permission)
- 30-minute status updates while working

---

## 📂 Directory Structure

```
/home/samuel/sv/
├── START-HERE.md ⭐ YOU ARE HERE
├── DOCUMENTATION-STRUCTURE.md    # How docs are organized
│
├── .bmad/ ⭐ ALL PLANNING HERE   # SINGLE SOURCE OF TRUTH
│   ├── README.md                 # Planning navigation
│   ├── project-brief.md          # Vision & goals
│   ├── prd/PRD.md                # Requirements
│   ├── epics/EPIC-BREAKDOWN.md   # 12 epics
│   ├── architecture/             # Technical specs
│   ├── system-design/            # Core architecture (PIV loop, etc.)
│   ├── infrastructure/           # Secrets, ports, DNS, VMs
│   ├── discussions/              # Decisions & analysis
│   └── HISTORICAL/               # Old SCAR-based docs (ignore)
│
├── supervisor-service/           # Meta-supervisor implementation
│   ├── .bmad → /home/samuel/sv/.bmad/  # SYMLINK (not duplicate!)
│   ├── .supervisor-core/         # Core instruction layers
│   ├── .supervisor-meta/         # Meta-specific instructions
│   ├── CLAUDE.md                 # Auto-generated from layers
│   └── src/                      # BUILD FRESH (old code = ignore)
│
├── consilio/                     # Project 1
│   ├── .bmad/                    # Project-specific planning
│   └── CLAUDE.md                 # Auto-generated
│
├── odin/                         # Project 2
├── openhorizon/                  # Project 3
└── health-agent/                 # Project 4
```

---

## 📋 What's Current vs Historical

### ✅ Current (PIV-Based)

**Location:** `/home/samuel/sv/.bmad/`

**26 planning documents from 2026-01-18:**
- System design (PIV loop, learning, timing, instructions)
- Infrastructure (secrets, ports, Cloudflare, GCloud)
- Requirements & epics (12 epics in 3 phases)
- Decisions & analysis (architecture, multi-tab setup)

**These are what we're building!**

### ❌ Historical (SCAR-Based)

**Location:** `/home/samuel/sv/.bmad/HISTORICAL/`

**6 old documents about SCAR remote agent:**
- RCA-SUPERVISOR-AUTONOMY-FAILURE.md
- SUPERVISOR-SUBAGENT-ARCHITECTURE.md
- COMPLETE-WORKFLOW-MAP.md
- IMPLEMENTATION-COMPLETE-SUMMARY.md
- DEPLOYMENT-COMPLETE.md
- 003-scar-integration-improvements.md

**These describe the OLD system - ignore when building!**

---

## 🎯 Week 1 Priority

### Goal: Autonomous PIV Loop with Parallel Agents

Based on `/home/samuel/sv/.bmad/epics/EPIC-BREAKDOWN.md` EPIC-010:

**What to build:**

1. **PIV Orchestrator** - Spawns multiple agents in parallel
2. **Prime Phase** - 2-3 agents research different parts of codebase
3. **Plan Phase** - Sonnet designs solution
4. **Execute Phase** - 3-5 Haiku agents implement in parallel
5. **Autonomous Behavior** - No permission requests, 30-min updates

**Test scenario:**
```
You: "Build dark mode for Consilio"

Meta-supervisor:
  → Creates epic
  → Spawns PIV orchestrator
  → Returns to idle

PIV orchestrator:
  → Spawns 3 Prime agents (research UI, theme, state)
  → Spawns 1 Plan agent (design solution)
  → Spawns 5 Execute agents (implement different components)
  → All agents work in parallel
  → Reports: "✅ Complete, PR #123" (25 minutes later)

Total supervisor context: <20K tokens
ZERO permission requests
```

---

## 📚 Key Documents

### Must-Read (In Order)

1. `/home/samuel/sv/START-HERE.md` ← YOU ARE HERE
2. `/home/samuel/sv/DOCUMENTATION-STRUCTURE.md` - How docs organized
3. `/home/samuel/sv/.bmad/README.md` - Planning navigation
4. `/home/samuel/sv/.bmad/project-brief.md` - Vision
5. `/home/samuel/sv/.bmad/system-design/piv-loop-adaptation-guide.md` ⭐ CRITICAL
6. `/home/samuel/sv/.bmad/prd/PRD.md` - Requirements
7. `/home/samuel/sv/.bmad/epics/EPIC-BREAKDOWN.md` - Implementation plan

### Reference Docs

**Infrastructure:**
- Secrets: `.bmad/infrastructure/secrets-management-system.md`
- Ports: `.bmad/infrastructure/port-allocation-system.md`
- Cloudflare: `.bmad/infrastructure/cloudflare-integration.md`
- GCloud: `.bmad/infrastructure/gcloud-integration.md`

**System Design:**
- Instructions: `.bmad/system-design/supervisor-instruction-propagation-system.md`
- Learning: `.bmad/system-design/learning-system-and-opus-planning.md`
- Timing: `.bmad/system-design/task-timing-and-estimation-system.md`

**Decisions:**
- Final architecture: `.bmad/discussions/FINAL-ARCHITECTURE-DECISIONS.md`
- Multi-tab setup: `.bmad/discussions/multiple-claude-projects-setup.md`

---

## ⚠️ What NOT to Use

### Don't Read These (Old Code)

- `/home/samuel/sv/supervisor-service/src/` - OLD implementation (ignore!)
- `/home/samuel/sv/supervisor-service/dist/` - Compiled old code
- `/home/samuel/.archon/workspaces/supervisor-service/` - Even older

### Don't Read These (Historical)

- `/home/samuel/sv/.bmad/HISTORICAL/` - SCAR-based old system

---

## 🔨 Ready to Build?

**Next steps:**

1. ✅ Read the 3 quick-start docs above (10 minutes)
2. ✅ Understand PIV loop architecture (not SCAR!)
3. ✅ Review EPIC-010 (PIV Loop Implementation)
4. 🔨 Start building PIV orchestrator with parallel agents
5. 🔨 Test with real feature
6. 🔨 Deploy and iterate

---

## 💡 Quick Reference

**Where to find:**
- All planning: `/home/samuel/sv/.bmad/`
- Architecture: `.bmad/system-design/piv-loop-adaptation-guide.md`
- Implementation plan: `.bmad/epics/EPIC-BREAKDOWN.md`
- Requirements: `.bmad/prd/PRD.md`

**What we're building:**
- LOCAL PIV agents (Prime → Plan → Execute)
- Multiple agents in PARALLEL
- MCP tools for Claude.ai browser
- Autonomous supervision (no asking permission)

**What we're NOT building:**
- Remote SCAR agent
- GitHub webhook orchestration
- Archon task management

---

**🎉 Documentation is consolidated. All planning in one place. Ready to build!**
