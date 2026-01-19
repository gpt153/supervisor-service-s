# Project Brief: Supervisor-Service

**Created:** 2026-01-18
**Last Updated:** 2026-01-18
**Status:** Active Planning
**Repository (Implementation):** https://github.com/gpt153/supervisor-service
**Repository (Planning):** https://github.com/gpt153/supervisor (supervisor-service/ folder)
**Workspace:** `/home/samuel/sv/supervisor-service/`

---

## Vision

A comprehensive multi-project orchestration system that enables a non-coder to manage AI-driven software development across multiple projects using natural language in Claude.ai browser.

**Tagline:** "From 'I want to build X' to deployed production app without touching code, terminals, or cloud consoles."

---

## Goals

### Primary Goals

1. **Multi-Project Orchestration:** Manage 3-5 AI-developed projects simultaneously from Claude.ai
2. **Zero Manual Infrastructure:** Automate secrets, ports, DNS, VM management, deployments
3. **Non-Coder Friendly:** Plain language planning → production deployment with zero technical steps
4. **PIV Loop Integration:** Local Plan → Implement → Validate agents for autonomous feature development

### Success Criteria

- [ ] User can create new project with single MCP tool call
- [ ] Secrets, ports, DNS automatically configured without manual steps
- [ ] PIV loop builds features autonomously (Prime → Plan → Execute)
- [ ] Deployments happen automatically when tests pass
- [ ] Multi-tier agent system (Opus planning → Sonnet orchestration → Haiku execution)
- [ ] User accesses everything from Claude.ai browser (no terminals, no cloud consoles)

---

## Stakeholders

### Primary Stakeholders

- **Non-Coder User:** Wants to build production software without technical expertise
- **Multi-Project Manager:** Needs to context-switch between projects seamlessly
- **Mobile User:** Needs to check status and approve deployments from phone

### Decision Makers

- **Owner:** Samuel (gpt153)
- **Technical Implementation:** PIV Loop agents (autonomous)

---

## Scope

### In Scope

**Core Service:**
- MCP server for Claude.ai Projects (stdio transport)
- Multi-project supervisor management (project-scoped access)
- Session persistence across browser reloads
- PIV loop orchestration (local agents, not remote webhooks)

**Infrastructure Automation:**
- Secrets management (encrypted PostgreSQL storage, MCP tools)
- Port allocation (conflict prevention, automatic assignment)
- Cloudflare DNS (automatic subdomain creation, tunnel management)
- GCloud VM management (auto-scaling, cost optimization)

**Meta-Features:**
- Supervisor instruction propagation (update all supervisors at once)
- Learning system (shared knowledge across projects)
- Task timing & estimation (learn from actual execution times)
- Automatic API key generation (OpenAI, Anthropic, etc.)

**PIV Loop:**
- Prime phase: Deep codebase analysis
- Plan phase: Prescriptive implementation design
- Execute phase: Validation-driven implementation
- Local agents (Haiku for execution, Sonnet for planning)

### Out of Scope (Explicitly)

- **No SCAR integration:** Using PIV loop instead (local agents, not remote webhooks)
- **No GitHub webhooks for orchestration:** Direct MCP tool calls instead
- **No worktrees:** Feature branches instead (simpler for non-coder)
- **No Archon task management:** GitHub issues for audit only
- **No multi-user features:** Single-developer use case first
- **No voice interface:** Future consideration after stable release

---

## Technical Context

### Technology Stack

- **Language:** TypeScript
- **Runtime:** Node.js 20+
- **Database:** PostgreSQL 17.7 (with pgcrypto for encryption, pgvector for RAG)
- **Agent SDK:** Claude Agent SDK (@anthropic-ai/claude-agent-sdk)
- **MCP Protocol:** @modelcontextprotocol/sdk (stdio transport)
- **Infrastructure:** GCP Compute Engine, Cloudflare DNS, Cloudflare Tunnels
- **CI/CD:** GitHub Actions

### Architecture Patterns

- **PIV Loop:** Plan → Implement → Validate (adapted from Cole Medin)
- **BMAD Methodology:** Brainstorm → Measure → Analyze → Decide (planning artifacts)
- **MCP Tools:** Stdio transport, project-scoped access via PROJECT_NAME env var
- **Multi-Tier Agents:** Opus (planning) → Sonnet (orchestration) → Haiku (execution)
- **Local Agents:** PIV phases spawn as subprocesses (not remote services)

### Integrations

- **Claude.ai Projects:** MCP stdio transport (5 configs: meta + 4 projects)
- **GitHub API:** Issue management, PR creation (via @modelcontextprotocol/server-github)
- **Cloudflare API:** DNS management, tunnel configuration
- **GCloud API:** VM creation, scaling, snapshot management
- **PostgreSQL:** Secrets storage (encrypted), port allocations, task timing

---

## Constraints

### Technical Constraints

- Must use stdio MCP transport (not HTTP endpoints)
- Must scope each Project to one project via PROJECT_NAME env var
- Must preserve autonomous supervision (no manual approval gates)
- Must support non-coder (no terminal commands, no code visibility)

### Business Constraints

- Launch MVP by Q2 2026
- Minimal infrastructure costs (optimize VM usage, Haiku for cheap execution)
- Solo developer + AI agents (no human team)

### Resource Constraints

- **Team Size:** Solo developer + autonomous PIV agents
- **Time:** Part-time development
- **Budget:** Free tiers + minimal VM costs

---

## Current Status

### Phase

**Planning Complete → Implementation Starting**

### Recent Progress

- [2026-01-18 09:48] PRD completed (PIV-based architecture)
- [2026-01-18 09:51] Epic breakdown created (12 epics, 3 phases)
- [2026-01-18 09:00] PIV loop adaptation guide written
- [2026-01-18 09:32] Infrastructure systems designed (secrets, ports, DNS, VMs)
- [2026-01-18 09:34] Meta-features designed (propagation, learning, timing)

### Next Milestones

- [ ] **Epic 1:** MCP Server Implementation - Target: Week 1-2
- [ ] **Epic 2:** Secrets Management - Target: Week 1-2
- [ ] **Epic 3:** Port Allocation - Target: Week 2
- [ ] **Epic 4:** PIV Loop Implementation - Target: Week 2-3
- [ ] **Epic 5:** Cloudflare Integration - Target: Week 3-4
- [ ] **Epic 6:** GCloud Integration - Target: Week 4-5
- [ ] **Epic 12:** Instruction Propagation - Target: Week 5-6

---

## Risks

### High-Priority Risks

1. **PIV Loop Complexity:** First time implementing Cole Medin's pattern
   - **Impact:** Potential delays in autonomous feature development
   - **Mitigation:** Epic 4 focuses on PIV loop early, thorough testing, start with simple features

2. **Infrastructure API Complexity:** Integrating Cloudflare + GCloud + secrets
   - **Impact:** Delays in Epic 5-6, potential cost overruns
   - **Mitigation:** Use MCP tools for abstraction, extensive testing in dev environment first

3. **Non-Coder UX:** Ensuring truly code-free experience
   - **Impact:** User frustration if technical steps creep in
   - **Mitigation:** Test with actual non-coder, validate every MCP tool hides complexity

4. **Multi-Project Context Isolation:** Preventing secret/port leakage between projects
   - **Impact:** Security breach, broken deployments
   - **Mitigation:** PROJECT_NAME scoping in database queries, extensive access control tests

---

## Related Documents

### Core Planning
- **PRD:** `.bmad/prd/PRD.md`
- **Epic Breakdown:** `.bmad/epics/EPIC-BREAKDOWN.md`
- **Technical Spec:** `.bmad/architecture/TECHNICAL-SPEC.md`

### Critical Architecture
- **PIV Loop Adaptation:** `.bmad/system-design/piv-loop-adaptation-guide.md` ⭐
- **Final Architecture Decisions:** `.bmad/discussions/FINAL-ARCHITECTURE-DECISIONS.md`

### Infrastructure
- **Secrets Management:** `.bmad/infrastructure/secrets-management-system.md`
- **Port Allocation:** `.bmad/infrastructure/port-allocation-system.md`
- **Cloudflare Integration:** `.bmad/infrastructure/cloudflare-integration.md`
- **GCloud Integration:** `.bmad/infrastructure/gcloud-integration.md`

### Meta-Features
- **Instruction Propagation:** `.bmad/system-design/supervisor-instruction-propagation-system.md`
- **Learning System:** `.bmad/system-design/learning-system-and-opus-planning.md`
- **Task Timing:** `.bmad/system-design/task-timing-and-estimation-system.md`

---

## Notes

### Architecture Philosophy

**Best of Both Worlds:**
1. **BMAD Methodology** - Structured planning artifacts (epics, ADRs, PRDs)
2. **PIV Loop** - Autonomous feature development (Prime → Plan → Execute)
3. **MCP Integration** - Claude.ai Projects access (no terminals, no webhooks)

**NOT using:**
- ❌ SCAR remote agent (switched to local PIV agents)
- ❌ GitHub webhooks for orchestration (using direct MCP calls)
- ❌ Worktrees (using feature branches)
- ❌ Comment-based communication (using direct returns)

### Why This Approach?

**For non-coders:**
- PIV loop = fully autonomous feature development
- MCP tools = everything in Claude.ai browser (no terminals)
- Infrastructure automation = no manual DNS, VM, secret management
- Multi-tier agents = optimal cost (Opus plans, Haiku executes)

**For multi-project management:**
- PROJECT_NAME scoping = zero context mixing
- Session persistence = pick up where you left off
- Shared knowledge = learn once, apply everywhere

---

**Template Version:** 1.0 (BMAD-inspired, PIV-based)
**Template Source:** Supervisor-service planning (2026-01-18)

