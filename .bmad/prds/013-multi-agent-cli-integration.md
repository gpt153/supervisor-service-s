# Product Requirements Document: Multi-Agent CLI Integration

**Document ID:** PRD-013
**Version:** 1.0
**Date:** 2026-01-19
**Status:** Draft
**Author:** Supervisor System

---

## Executive Summary

This PRD defines requirements for integrating multiple AI CLI tools (Gemini CLI, Codex CLI, Claude Code) into the supervisor-service's PIV loop. The goal is to reduce operational costs by 60-80% by routing tasks to subscription-included quotas rather than pay-per-token APIs.

### Key Value Proposition

| Before | After |
|--------|-------|
| All tasks use Claude API tokens | Tasks routed to optimal CLI based on complexity |
| ~$2-5 per PIV cycle | ~$0.50-1 per PIV cycle |
| Single point of failure | Redundant fallback routing |
| Unused subscription quotas | 80%+ quota utilization |

---

## Problem Statement

### Current State

The supervisor-service currently uses Claude exclusively for all PIV loop phases:
- **Prime Phase:** Claude Sonnet analyzes codebase → $0.50-1.00/analysis
- **Plan Phase:** Claude Sonnet creates implementation plan → $0.30-0.50/plan
- **Execute Phase:** Claude Haiku implements code → $0.25-1.00/task

Monthly cost for moderate usage (50 PIV cycles): **$150-300**

### Underutilized Resources

The user maintains three AI subscriptions totaling $60/month:

| Subscription | Monthly Cost | Included Quota | Current Utilization |
|--------------|--------------|----------------|---------------------|
| Claude Pro | $20 | Pro-level tokens | ~40% (browser use) |
| Gemini Pro | $20 | 1,000 req/day CLI | ~5% |
| ChatGPT Plus | $20 | 30-150 msg/5hr CLI | ~10% |

**Opportunity:** Route PIV tasks to subscription-included CLI quotas

### Pain Points

1. **Cost inefficiency:** Paying API tokens when subscription quotas available
2. **Single dependency:** If Claude rate-limited, entire system blocks
3. **Suboptimal routing:** Simple tasks use expensive models
4. **No specialization:** Different models excel at different tasks

---

## Goals & Objectives

### Primary Goals

1. **G1:** Reduce per-PIV-cycle cost by 60%+
2. **G2:** Utilize 80%+ of available subscription quotas
3. **G3:** Maintain or improve task completion quality
4. **G4:** Add redundancy through multi-agent fallback

### Non-Goals

- Replace Claude entirely (still needed for complex tasks)
- Add new subscriptions (optimize existing)
- Build custom models or fine-tuning
- API fallback (pay-per-token) in v1

---

## User Stories

### US-1: Automatic Cost-Optimized Routing
**As a** supervisor system operator
**I want** tasks automatically routed to the cheapest capable agent
**So that** I minimize costs without manual intervention

**Acceptance Criteria:**
- Simple tasks (docs, tests, boilerplate) → Gemini CLI
- Medium tasks (bugs, refactoring) → Codex CLI
- Complex tasks (architecture, security) → Claude CLI
- Routing decision logged for audit

### US-2: Quota-Aware Scheduling
**As a** supervisor system
**I want** to track quota usage across all CLIs
**So that** I can route to available capacity

**Acceptance Criteria:**
- Track daily/hourly quotas per service
- Automatically detect rate limits
- Route to alternate service when primary exhausted
- Dashboard shows current quota status

### US-3: Fallback Resilience
**As a** supervisor system operator
**I want** automatic fallback when a CLI is unavailable
**So that** work continues without manual intervention

**Acceptance Criteria:**
- Detect CLI failure within 10 seconds
- Automatically retry with fallback agent
- Log fallback events for monitoring
- Maintain task context across fallback

### US-4: Quality Assurance
**As a** supervisor system operator
**I want** output quality tracked per agent
**So that** I can optimize routing over time

**Acceptance Criteria:**
- Track success/failure rate per agent per task type
- Flag agents that produce lower quality for certain tasks
- Allow manual override of routing decisions
- Provide quality comparison reports

### US-5: Deep Research Delegation
**As a** PIV loop Prime phase
**I want** to delegate research to Gemini/ChatGPT Deep Research
**So that** I get comprehensive analysis at no additional cost

**Acceptance Criteria:**
- Route research queries to Gemini Deep Research when available
- Fall back to ChatGPT Deep Research (25/month limit)
- Parse and integrate research reports into Prime context
- Track research quota separately

---

## Functional Requirements

### FR-1: Agent Adapters

| Requirement | Priority | Description |
|-------------|----------|-------------|
| FR-1.1 | Must | `GeminiCLIAdapter` spawns Gemini CLI in headless mode |
| FR-1.2 | Must | `CodexCLIAdapter` spawns Codex CLI in headless mode |
| FR-1.3 | Must | `ClaudeCLIAdapter` spawns Claude Code in headless mode |
| FR-1.4 | Must | All adapters parse JSON output format |
| FR-1.5 | Must | All adapters handle timeout (configurable, default 5min) |
| FR-1.6 | Should | Adapters report execution time for timing system |
| FR-1.7 | Should | Adapters stream progress for long-running tasks |

### FR-2: Task Classification

| Requirement | Priority | Description |
|-------------|----------|-------------|
| FR-2.1 | Must | Classify tasks as simple/medium/complex |
| FR-2.2 | Must | Use task type, file count, line count as inputs |
| FR-2.3 | Should | Learn from historical performance |
| FR-2.4 | Should | Allow manual complexity override |
| FR-2.5 | Could | Use embedding similarity to similar past tasks |

### FR-3: Routing Logic

| Requirement | Priority | Description |
|-------------|----------|-------------|
| FR-3.1 | Must | Route based on task complexity + quota availability |
| FR-3.2 | Must | Implement fallback chain (Gemini → Codex → Claude) |
| FR-3.3 | Must | Never fall back FROM Claude (no cheaper option) |
| FR-3.4 | Should | Weight routing by historical success rate |
| FR-3.5 | Should | Prefer agent that completed similar task successfully |
| FR-3.6 | Could | A/B test routing decisions for optimization |

### FR-4: Quota Management

| Requirement | Priority | Description |
|-------------|----------|-------------|
| FR-4.1 | Must | Track daily quota usage for Gemini (1000/day) |
| FR-4.2 | Must | Track rolling 5-hour quota for Codex (30-150) |
| FR-4.3 | Must | Track approximate Claude Pro token usage |
| FR-4.4 | Should | Persist quota state across restarts |
| FR-4.5 | Should | Reset quotas at appropriate intervals |
| FR-4.6 | Could | Predict quota exhaustion and pre-route |

### FR-5: PIV Integration

| Requirement | Priority | Description |
|-------------|----------|-------------|
| FR-5.1 | Must | Integrate AgentRouter into ExecutePhase |
| FR-5.2 | Must | Maintain existing PIV loop interface |
| FR-5.3 | Should | Route Prime phase research to Deep Research |
| FR-5.4 | Should | Track agent used per task in timing system |
| FR-5.5 | Should | Calculate cost savings per PIV cycle |

### FR-6: MCP Tools

| Requirement | Priority | Description |
|-------------|----------|-------------|
| FR-6.1 | Should | `mcp__meta__get_agent_quotas` - show current quotas |
| FR-6.2 | Should | `mcp__meta__get_routing_stats` - show routing decisions |
| FR-6.3 | Could | `mcp__meta__force_agent` - override routing |
| FR-6.4 | Could | `mcp__meta__compare_agents` - quality comparison |

---

## Non-Functional Requirements

### NFR-1: Performance

- CLI spawn time < 2 seconds
- Routing decision < 100ms
- No degradation to existing PIV loop timing

### NFR-2: Reliability

- Fallback activation within 10 seconds of failure
- 99% task completion rate (including fallbacks)
- Graceful degradation if all CLIs unavailable

### NFR-3: Security

- CLI credentials not logged
- Prompts with sensitive data not persisted
- Workdir isolation between concurrent tasks

### NFR-4: Observability

- All routing decisions logged at INFO level
- Quota status queryable via MCP tool
- Cost tracking per task/agent/day

### NFR-5: Maintainability

- Adapter pattern for easy CLI addition
- Configuration-driven routing rules
- Clear separation of concerns

---

## Technical Constraints

### Prerequisites

1. **Gemini CLI installed and authenticated**
   ```bash
   gemini --version  # Must return version
   gemini -p "test" --output-format json  # Must return JSON
   ```

2. **Codex CLI installed and authenticated**
   ```bash
   codex --version  # Must return version
   codex exec "test" --json  # Must return JSON
   ```

3. **Claude Code installed and authenticated**
   ```bash
   claude --version  # Must return version
   claude -p "test" --output-format json  # Must return JSON
   ```

### Integration Points

- Existing: `PIVAgent.ts`, `ExecutePhase.ts`
- Existing: Task timing system (`TaskTimer.ts`)
- Existing: Database (PostgreSQL) for quota persistence
- New: CLI subprocess management

### Limitations

- CLI quotas are estimates (not real-time API)
- Headless mode may have feature limitations vs interactive
- Output format may vary between CLI versions

---

## Success Metrics

### Quantitative

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Cost per PIV cycle | < $1.00 | API billing + timing logs |
| Gemini quota utilization | > 500/day avg | Quota tracking |
| Codex quota utilization | > 50% of available | Quota tracking |
| Task success rate | > 95% | Execution logs |
| Fallback frequency | < 10% of tasks | Routing logs |

### Qualitative

- Operator does not need to manually select agents
- System remains operational when one CLI is down
- Cost savings visible in monthly billing

---

## Rollout Plan

### Phase 1: Validation (Day 1)
- Verify all CLIs installed and working
- Run manual tests of headless execution
- Confirm JSON parsing works

### Phase 2: Core Implementation (Days 2-3)
- Implement adapters and router
- Unit tests passing
- Manual integration tests

### Phase 3: PIV Integration (Day 4)
- Modify ExecutePhase
- Integration tests passing
- Run test PIV cycle with routing

### Phase 4: Production (Day 5+)
- Enable on one project (Consilio)
- Monitor for 1 week
- Roll out to all projects

---

## Appendix

### A: CLI Command Reference

**Gemini CLI:**
```bash
# Basic execution
gemini -p "prompt here" --output-format json

# With project context
gemini -p "prompt" --output-format json --cwd /path/to/project

# Check quota (approximate)
gemini quota status
```

**Codex CLI:**
```bash
# Basic execution
codex exec "prompt here" --json

# With project context
codex exec "prompt" --json --path /path/to/project

# Approval mode (for safety)
codex exec "prompt" --json --approval-mode suggest
```

**Claude Code:**
```bash
# Basic execution
claude -p "prompt here" --output-format json

# With project context
claude -p "prompt" --output-format json -C /path/to/project

# Print mode (no streaming)
claude -p "prompt" --output-format json --print
```

### B: Sample Routing Decisions

| Task | Classification | Primary | Fallback | Rationale |
|------|---------------|---------|----------|-----------|
| "Add JSDoc to util functions" | Simple | Gemini | Codex | Documentation is Gemini strength |
| "Fix null pointer in auth.ts" | Medium | Codex | Claude | Debugging is Codex strength |
| "Design OAuth2 flow" | Complex | Claude | - | Architecture requires Claude |
| "Generate unit tests for API" | Simple | Gemini | Codex | Test gen is well-suited to Gemini |
| "Refactor 5 files to new pattern" | Medium | Codex | Claude | Multi-file refactor is Codex strength |

### C: Cost Comparison Model

**Current (Claude-only):**
- Simple task: $0.15 (Haiku)
- Medium task: $0.35 (Haiku)
- Complex task: $0.75 (Sonnet)
- Average PIV (10 tasks): $3.50

**Projected (Multi-agent):**
- Simple task: $0.00 (Gemini free quota)
- Medium task: $0.00 (Codex free quota)
- Complex task: $0.75 (Claude, unchanged)
- Average PIV (10 tasks): $0.75 (if 2/10 complex)

**Monthly savings (50 PIV cycles):**
- Current: 50 × $3.50 = $175
- Projected: 50 × $0.75 = $37.50
- **Savings: $137.50/month (79%)**

---

**Document Approval:**
- [ ] Technical Lead Review
- [ ] Cost Analysis Verified
- [ ] Prerequisites Confirmed
