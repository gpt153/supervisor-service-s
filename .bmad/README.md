# Meta-Supervisor Planning Documentation

**Date Created:** 2026-01-18
**Status:** Active Planning
**Architecture:** PIV Loop + BMAD + MCP
**Location:** `/home/samuel/sv/.bmad/`

⭐ **THIS IS THE SINGLE SOURCE OF TRUTH FOR ALL PLANNING** ⭐

---

## 📂 Directory Structure

```
/home/samuel/sv/.bmad/
├── README.md ⭐ START HERE
├── project-brief.md ✅ (Meta-supervisor vision & goals)
├── prd/
│   └── PRD.md ✅ (Product Requirements - PIV-based)
├── epics/
│   ├── EPIC-BREAKDOWN.md ✅ (12 epics for supervisor-service)
│   ├── 001-bmad-integration.md (Meta-level epic)
│   ├── 002-learning-system-enhancement.md
│   ├── 003-scar-integration-improvements.md (historical)
│   └── 004-automated-supervisor-updates.md
├── architecture/
│   └── TECHNICAL-SPEC.md ✅ (Technical specifications)
├── adr/ (Architecture Decision Records)
├── system-design/ ⭐ CRITICAL
│   ├── piv-loop-adaptation-guide.md ⭐ MOST IMPORTANT
│   ├── supervisor-instruction-propagation-system.md
│   ├── learning-system-and-opus-planning.md
│   ├── task-timing-and-estimation-system.md
│   └── adapt-local-claude.md
├── infrastructure/ (Infrastructure automation)
│   ├── secrets-management-system.md
│   ├── port-allocation-system.md
│   ├── cloudflare-integration.md
│   ├── gcloud-integration.md
│   ├── automatic-secrets-and-api-key-creation.md
│   └── infrastructure-systems-summary.md
├── discussions/ (Planning discussions)
│   ├── FINAL-ARCHITECTURE-DECISIONS.md
│   ├── multiple-claude-projects-setup.md
│   ├── ui-workflow-improvements.md
│   ├── archon-and-cowork-analysis.md
│   ├── claude-sdk-compatibility.md
│   └── frame0-troubleshooting-and-local-rag.md
└── workflow-status.yaml (Current status)
```

---

## ⭐ CRITICAL: Read First

**Start here:** `system-design/piv-loop-adaptation-guide.md`

This document defines the ENTIRE architecture:
- What we're taking from Cole Medin's PIV loop
- What we're NOT using (SCAR, webhooks, worktrees)
- What we're using instead (local PIV agents, MCP, feature branches)

---

## 🏗️ Our Architecture (Best of Both Worlds)

### What We're Using ✅

1. **BMAD Methodology**
   - Epics, ADRs, PRDs for planning
   - Scale-adaptive intelligence
   - MoSCoW prioritization

2. **PIV Loop Workflow**
   - Prime: Deep codebase analysis
   - Plan: Prescriptive implementation design
   - Execute: Validation-driven implementation

3. **MCP Integration**
   - Local agents (not remote webhooks)
   - Claude.ai Projects via stdio transport
   - Direct result returns

4. **Infrastructure Automation**
   - Secrets management (MCP tool)
   - Port allocation (MCP tool)
   - Cloudflare DNS (MCP tool)
   - GCloud VM management (MCP tool)

### What We're NOT Using ❌

- ❌ SCAR remote agent with webhooks
- ❌ GitHub issues for orchestration
- ❌ Git worktrees
- ❌ Archon task management
- ❌ Comment-based communication

### How It Works

```
User → Claude.ai Project (browser)
  ↓
MCP Tool Call
  ↓
Supervisor Service (Node.js)
  ↓
Project Supervisor (Claude Agent SDK)
  ↓
PIV Agent (local subprocess, Haiku)
  ↓
Prime → Plan → Execute phases
  ↓
Creates PR with all changes
  ↓
Returns result to supervisor → user
```

---

## 📋 Planning Documents Status

### ✅ Correct & Current (PIV-based)
- `prd/PRD.md` - Zero SCAR architecture, pure PIV
- `epics/EPIC-BREAKDOWN.md` - 12 epics, 3 phases
- `architecture/TECHNICAL-SPEC.md` - Technical details
- `project-brief.md` - Vision, goals, scope
- ALL `system-design/` docs
- ALL `infrastructure/` docs
- ALL `discussions/` docs

### ⚠️ Historical (Contains SCAR context)
- `epics/003-scar-integration-improvements.md` - OLD, ignore
- Some docs mention SCAR contextually (comparisons, history)

**Note:** SCAR mentions are CONTEXTUAL (explaining Cole's system) not architectural.

---

## 🎯 Implementation Phases

### Phase 1: Core Service (Epic 1-4)
- Epic 1: MCP Server Implementation
- Epic 2: Secrets Management
- Epic 3: Port Allocation
- Epic 4: PIV Loop Implementation

### Phase 2: Infrastructure (Epic 5-9)
- Epic 5: Cloudflare Integration
- Epic 6: GCloud Integration
- Epic 7-9: Advanced infrastructure features

### Phase 3: Meta Features (Epic 10-12)
- Epic 10: Learning System
- Epic 11: Task Timing & Estimation
- Epic 12: Instruction Propagation

---

## 📚 Key Documents (Read in Order)

### Must-Read
1. **This README** - Overview and navigation
2. **PIV Loop Adaptation** - `system-design/piv-loop-adaptation-guide.md` ⭐
3. **Project Brief** - `project-brief.md`
4. **Main PRD** - `prd/PRD.md`
5. **Epic Breakdown** - `epics/EPIC-BREAKDOWN.md`
6. **Final Architecture** - `discussions/FINAL-ARCHITECTURE-DECISIONS.md`

### Infrastructure
7. **Secrets Management** - `infrastructure/secrets-management-system.md`
8. **Port Allocation** - `infrastructure/port-allocation-system.md`
9. **Cloudflare** - `infrastructure/cloudflare-integration.md`
10. **GCloud** - `infrastructure/gcloud-integration.md`

### Meta-System
11. **Instruction Propagation** - `system-design/supervisor-instruction-propagation-system.md`
12. **Learning System** - `system-design/learning-system-and-opus-planning.md`
13. **Task Timing** - `system-design/task-timing-and-estimation-system.md`

---

## 🗂️ Relationship to Implementation

```
/home/samuel/sv/
├── .bmad/ ⭐ YOU ARE HERE (meta-supervisor planning)
│   ├── All planning docs
│   └── Architecture decisions
├── supervisor-service/ (implementation code)
│   ├── src/
│   ├── .supervisor-core/ (core instruction layers)
│   └── CLAUDE.md (auto-generated)
├── consilio/ (project 1)
│   └── CLAUDE.md (auto-generated)
├── odin/ (project 2)
│   └── CLAUDE.md (auto-generated)
└── [other projects]/
```

**Planning → `.bmad/`**
**Implementation → `supervisor-service/src/`**
**Instructions → `.supervisor-core/` + auto-generated CLAUDE.md files**

---

## 🔄 Recovery Complete

All planning from today (2026-01-18, 07:00-09:51) has been recovered and organized at meta-supervisor level.

Total: 20+ planning documents, ~400KB of detailed architecture and design.

---

## 🚀 Ready to Build

- [x] All planning complete
- [x] Architecture decided (PIV Loop + BMAD + MCP)
- [x] 12 epics defined (3 phases)
- [x] Infrastructure systems designed
- [x] Meta-features specified

**Next:** Start Epic 1 - MCP Server Implementation

