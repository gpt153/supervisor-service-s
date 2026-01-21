# Product Requirements Document: PS Delegation Enforcement System

**Version**: 1.0
**Created**: 2026-01-21
**Status**: Approved
**Product Manager**: Meta-Supervisor
**Stakeholders**: All Project-Supervisors, User (samuel)

---

## Executive Summary

Transform Project-Supervisors (PS) from mixed executors into pure coordinators by enforcing strict delegation, automating service selection, providing comprehensive subagent library, and implementing self-improving automation discovery.

**Current Problem**: PS frequently executes tasks directly instead of delegating to subagents (60% delegation rate), bypasses MCP tools with manual commands, requires user reminders, and lacks standardized subagent library.

**Proposed Solution**: Enforce delegation through FORBIDDEN rules, centralize subagent spawning with automatic load balancing, create 43-subagent library, enforce MCP tool usage, and build auto-discovery system for continuous improvement.

**Expected Impact**: 95%+ delegation rate, 40% cost savings, zero user reminders, consistent behavior across all PSes, self-improving automation.

---

## Problem Statement

### Current State

**PS Role Confusion:**
- PS instructions say "coordinate epics, tasks, and implementations" (ambiguous)
- No explicit FORBIDDEN rules preventing execution
- Suggestive tone ("should spawn") instead of mandatory
- PS frequently implements code, researches, tests, documents directly
- User must repeatedly remind PS to delegate

**Manual Load Balancer Workflow:**
- PS must manually query Odin for service recommendation
- Multi-step process (query → select → spawn → track)
- High friction leads to "just do it myself" behavior
- Cost optimization inconsistent

**Incomplete Subagent Library:**
- Only 6 shared commands exist
- Missing critical subagents: research, testing, validation, documentation
- PS improvises subagent creation
- No standardized templates or workflows

**MCP Tool Bypass:**
- PS runs manual cloudflared, gcloud, port commands
- Writes secrets to .env without vault storage
- Inconsistent infrastructure management
- Documentation not auto-updated after changes

**Root Cause**: Insufficient role enforcement + high delegation friction + missing automation library

### User Impact

**For User (samuel):**
- Must manually remind PS to delegate (5+ times per 10 tasks)
- System not truly autonomous
- Inconsistent behavior across PSes
- Higher AI costs due to suboptimal service selection

**For Project-Supervisors:**
- Role confusion leads to inefficient work patterns
- High cognitive load from execution tasks
- Inconsistent workflows
- Lack of standardized tools

---

## Goals & Success Criteria

### Primary Goals

1. **Enforce Pure Coordination Role**
   - PS NEVER executes tasks directly
   - 95%+ delegation rate
   - Zero user reminders needed

2. **Automate Service Selection**
   - Single MCP tool for all subagent spawning
   - Automatic Odin integration
   - 60%+ tasks using free/cheap services

3. **Comprehensive Automation Library**
   - 43 standardized subagents covering all recurring tasks
   - Consistent templates and workflows
   - Easy to discover and use

4. **Enforce Infrastructure Tool Usage**
   - 100% MCP tool usage for tunnels, secrets, ports, GCloud
   - Automatic documentation updates
   - Zero manual bypass

5. **Continuous Self-Improvement**
   - Auto-detect repeated manual patterns
   - Suggest new automations
   - System gets smarter over time

### Success Metrics

**Quantitative:**
- Delegation rate: >95% (baseline: 60%)
- User reminders: <1 per 10 tasks (baseline: 5)
- PS compliance violations: 0 per 10 tasks (baseline: 3-4)
- Cost optimization: 60%+ tasks using free/cheap services
- Automation suggestions: 5+ detected in first month

**Qualitative:**
- User never says "spawn a subagent"
- System runs autonomously for hours
- Consistent behavior across all PSes
- Self-improving automation library
- Documentation always current

---

## Proposed Solution

### Overview

Five-component system:

1. **Strict Identity Enforcement** - FORBIDDEN/MANDATORY rules at top of PS instructions
2. **Centralized Subagent Spawning** - Single MCP tool with automatic load balancing
3. **Comprehensive Subagent Library** - 43 pre-written subagents for all tasks
4. **Infrastructure Tool Enforcement** - Mandatory MCP tool usage with validation
5. **Auto-Discovery System** - Activity logging + pattern analysis + automation suggestions

### Component 1: Strict Identity Enforcement

**New PS Identity Structure (.supervisor-core/01-identity.md):**

**Section 1: 🚨 FORBIDDEN - Execution Tasks** (30 lines)
- "YOU ARE A COORDINATOR, NOT AN EXECUTOR"
- Explicit list: Writing code, researching, planning, testing, validating
- "IF YOU DO ANY OF THESE YOURSELF, YOU HAVE FAILED"

**Section 2: 🚨 FORBIDDEN - Infrastructure Operations** (40 lines)
- Manual cloudflared, gcloud, port selection, database ops
- Must use MCP tools exclusively

**Section 3: MANDATORY - Delegation** (20 lines)
- Task types table with mandatory delegation
- Single command: mcp_meta_spawn_subagent
- "NEVER ask permission to spawn"

**Section 4: MANDATORY - Infrastructure Tools** (30 lines)
- MCP tools quick reference
- Automatic documentation workflow

**Section 5: Workflow Checklists** (40 lines)
- Deploying services (8 steps)
- Adding secrets (5 steps)

**Section 6: Your ONLY Responsibilities** (20 lines)
- Coordinate, commit, report, update state

**Total**: ~180 lines (focused, directive, impossible to miss)

**Tone Changes:**
- Remove all "why" explanations → move to /docs/guides/
- Remove all examples → move to /docs/examples/
- Keep only RULES and CHECKLISTS
- Directive tone: "DO THIS" not "you should"

### Component 2: Centralized Subagent Spawning

**New MCP Tool: mcp_meta_spawn_subagent**

**Inputs:**
- task_type (required): research | planning | implementation | testing | validation | documentation | fix | deployment | review | security | integration
- description (required): Plain English task description
- context (optional): epic_id, plan_file, files_to_review, validation_commands

**Workflow:**
1. Query Odin load balancer with task_type, estimated_tokens (from description length), complexity (inferred from keywords)
2. Select subagent template from library using task_type + keyword scoring
3. Load template, substitute variables (TASK_DESCRIPTION, PROJECT_PATH, CONTEXT)
4. Spawn agent using Claude Agent SDK with recommended model
5. Track usage in Odin database (service, tokens, cost, model)
6. Return agent_id for monitoring

**Smart Selection Logic:**
- Filter to candidate subagents by task_type
- Score each candidate based on keywords in description
- Select highest scoring subagent
- Examples:
  - "testing" + "click buttons, forms" → test-ui-complete.md
  - "testing" + "unit tests" → write-unit-tests.md
  - "documentation" + "deployment tunnel" → update-deployment-docs.md

**Benefits:**
- Single tool call (not manual Odin query + bash)
- Automatic service selection
- Automatic cost tracking
- Lower friction = higher compliance

### Component 3: Comprehensive Subagent Library

**Location**: /home/samuel/sv/.claude/commands/subagents/

**Template Structure** (all 43 subagents follow this):
- Header with task_type metadata
- FORBIDDEN section (what NOT to do)
- MANDATORY section (what MUST do)
- Step-by-step workflow
- Output requirements
- Validation checklist
- Success criteria
- Common pitfalls

**Phase 1: Core PIV-Loop (5 subagents - MUST HAVE)**

1. **prime-research.md** (research)
   - 🚨 READ-ONLY, FORBIDDEN FROM IMPLEMENTING
   - Analyze codebase, patterns, architecture
   - Output: Research report

2. **plan-implementation.md** (planning)
   - Create step-by-step plan
   - Research existing patterns
   - Output: .bmad/plans/feature-plan.md

3. **implement-feature.md** (implementation)
   - Execute based on plan
   - Run validations before completing
   - Output: Implemented code + validation report

4. **validate-changes.md** (validation)
   - Run ALL checks (lint, type-check, tests, build)
   - Output: Comprehensive validation report

5. **test-ui-complete.md** (testing)
   - Playwright - click EVERY button, fill EVERY form
   - Auto-discover all interactive elements
   - Output: Complete test suite + screenshots

**Phase 2: Essential Support (8 subagents)**
- write-unit-tests.md
- write-integration-tests.md
- fix-failing-tests.md
- fix-build-errors.md
- update-deployment-docs.md
- update-readme.md
- review-pr.md

**Phase 3: Planning & Architecture (7 subagents - BMAD)**
- analyze-requirements.md
- create-prd.md
- create-epic.md
- create-adr.md
- design-architecture.md
- design-api.md
- design-database-schema.md

**Phase 4: Quality & Deployment (23 subagents)**
- Code quality: refactor, optimize, add-error-handling, add-logging
- Security: security-audit, dependency-audit
- Deployment: create-migration, deploy-dev, deploy-production, rollback, setup-ci-cd, setup-monitoring
- UI/UX: design-ui-mockup, implement-ui-component, test-ui-accessibility
- Integration: integrate-third-party-api, setup-authentication, setup-payment
- Maintenance: debug-production-issue, analyze-logs, update-dependencies

**Total**: 43 subagents covering ALL recurring tasks

### Component 4: Infrastructure Tool Enforcement

**Updated PS Instructions with Infrastructure FORBIDDEN Rules:**

**Cloudflare Tunnels:**
- NEVER: Manual cloudflared, edit configs, create DNS via bash/curl
- ONLY: tunnel_request_cname, tunnel_delete_cname, tunnel_list_cnames

**Secrets Management:**
- NEVER: Write to .env without vault storage first
- ALWAYS: Vault FIRST (mcp_meta_set_secret), .env SECOND

**Google Cloud:**
- NEVER: Manual gcloud commands
- ONLY: mcp_gcloud_create_vm, mcp_gcloud_delete_vm, mcp_gcloud_create_bucket, etc.

**Port Management:**
- NEVER: Pick ports without allocation, use defaults without verification
- ALWAYS: Check assigned range, use mcp_meta_allocate_port

**Database:**
- NEVER: Create manually, run raw SQL for schema
- ONLY: Migration tools (Alembic, Prisma) or mcp_meta_run_migration

**Automatic Documentation Update Workflow:**

After tunnel creation:
1. Create tunnel → tunnel_request_cname
2. AUTOMATICALLY spawn update-deployment-docs.md subagent
3. AUTOMATICALLY regenerate CLAUDE.md
4. AUTOMATICALLY commit and push
5. NO PERMISSION NEEDED

**Tool Validation:**

Each MCP tool validates prerequisites:
- tunnel_request_cname: Port allocated, in range, service running
- mcp_meta_set_secret: Key path format, description provided
- mcp_meta_allocate_port: Port in assigned range, not already allocated

### Component 5: Auto-Discovery System

**Purpose**: Detect repeated manual patterns → suggest new automations

**Architecture:**

**Activity Tracker:**
- Log every PS action: tool used, purpose, frequency, duration, project
- Store in database: ps_activity_logs

**Pattern Analyzer (Scheduled Daily/Weekly):**
- Detect repeated sequences
- Detect common tasks across projects
- Detect manual workflows that could be automated
- Detect missing abstractions
- Generate suggestions → .automation-suggestions/NNN-pattern-name.md

**Suggestion Review:**
- User or Meta-Supervisor reviews
- Approve → Create new subagent/MCP tool
- Modify → Adjust and re-review
- Reject → Mark as intentional
- Defer → Revisit when pattern strengthens

**Suggestion Format:**
- Pattern detected (what repeated action)
- Frequency (how often)
- Current workflow (how PS does manually)
- Suggested automation (what tool/subagent)
- Benefit estimate (time saved, cost saved)
- Status (pending, approved, implemented, rejected)

**Categories:**
1. New Subagents Needed (repeated execution)
2. New MCP Tools Needed (repeated infrastructure ops)
3. Missing Workflow Automation (sequences of tools)
4. Existing Tools Not Used (PS doesn't know)
5. Performance Optimization (slow ops that could be cached)

**Benefits:**
- Continuous improvement
- Data-driven prioritization
- Cross-project learning
- Historical record of evolution

---

## User Experience

### Before (Current State)

**User**: "Implement authentication"

**PS**: "I'll research the codebase for existing patterns first"
[PS reads files, analyzes architecture, writes research report]
**PS**: "Based on my research, here's the plan..."
[PS writes implementation plan]
**PS**: "Should I proceed with implementation?"

**User**: "Yes, but spawn a subagent"

**PS**: "Okay, let me query Odin for service recommendation"
[Manual query to Odin MCP]
**PS**: "Odin recommends Gemini. Let me spawn implementation agent"
[Spawns agent with bash command]

**Time**: 15 minutes before implementation starts
**User actions**: 2 reminders

### After (Proposed State)

**User**: "Implement authentication"

**PS**: "Starting delegation workflow for authentication feature"
[Automatically calls mcp_meta_spawn_subagent with task_type="implementation"]
[Odin queried automatically, Gemini selected, agent spawned]
**PS**: "Spawned implementation agent (ID: abc123) using Gemini Flash (free). Monitoring progress."

[Agent completes work]

**PS**: "Authentication implemented. Spawning validation agent."
[Automatically spawns validation agent]
**PS**: "All validations passed. Creating PR #42."

**Time**: Implementation starts immediately
**User actions**: 0 reminders

### Key Improvements

1. **Zero Friction**: Single MCP call, automatic everything
2. **No Permission Requests**: PS never asks "should I spawn?"
3. **Automatic Optimization**: Best service selected automatically
4. **Consistent Workflow**: Same pattern every time
5. **Full Autonomy**: PS works until complete

---

## Technical Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Project-Supervisor (PS)                   │
│  - Receives user task                                        │
│  - Calls mcp_meta_spawn_subagent                             │
│  - Monitors agent progress                                   │
│  - Reports to user                                           │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│            mcp_meta_spawn_subagent (Meta MCP Tool)           │
│  1. Query Odin for service recommendation                    │
│  2. Select subagent template from library                    │
│  3. Load template, substitute variables                      │
│  4. Spawn agent with Claude Agent SDK                        │
│  5. Track usage in Odin database                             │
│  6. Return agent_id                                          │
└──────────┬─────────────────────┬────────────────────────────┘
           │                     │
           ▼                     ▼
┌──────────────────────┐ ┌──────────────────────────────┐
│   Odin Load Balancer │ │   Subagent Library (43)      │
│  - Service selection │ │  - prime-research.md         │
│  - Model selection   │ │  - plan-implementation.md    │
│  - Quota tracking    │ │  - implement-feature.md      │
│  - Cost tracking     │ │  - validate-changes.md       │
└──────────────────────┘ │  - test-ui-complete.md       │
                         │  - (38 more...)              │
                         └──────────────────────────────┘
```

### Data Flow

1. **User Task** → PS receives task
2. **PS** → Calls mcp_meta_spawn_subagent(task_type, description)
3. **MCP Tool** → Queries Odin for recommendation
4. **Odin** → Returns {service, model, cli_command, estimated_cost}
5. **MCP Tool** → Selects subagent template based on task_type + keywords
6. **MCP Tool** → Loads template, substitutes variables
7. **MCP Tool** → Spawns agent with recommended service + model
8. **MCP Tool** → Tracks usage in Odin database
9. **MCP Tool** → Returns agent_id to PS
10. **PS** → Monitors agent progress
11. **PS** → Reports completion to user

### Database Schema

**New Tables:**

```sql
-- Activity logging for auto-discovery
CREATE TABLE ps_activity_logs (
  id SERIAL PRIMARY KEY,
  project_name TEXT NOT NULL,
  ps_session_id TEXT NOT NULL,
  tool_used TEXT NOT NULL,  -- Read, Grep, Edit, Write, Bash, MCP
  purpose TEXT,             -- What was the action for
  context JSONB,            -- Additional details
  duration_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Automation suggestions from pattern analyzer
CREATE TABLE automation_suggestions (
  id SERIAL PRIMARY KEY,
  pattern_name TEXT NOT NULL,
  pattern_detected TEXT NOT NULL,
  frequency INTEGER NOT NULL,
  current_workflow TEXT NOT NULL,
  suggested_automation TEXT NOT NULL,
  benefit_estimate TEXT,
  category TEXT NOT NULL,  -- new_subagent, new_mcp_tool, workflow, unused_tool, optimization
  status TEXT DEFAULT 'pending',  -- pending, approved, in_progress, implemented, rejected, deferred
  created_at TIMESTAMP DEFAULT NOW(),
  reviewed_at TIMESTAMP,
  implemented_at TIMESTAMP
);

-- Extend existing usage tracking (in Odin)
ALTER TABLE ai_service_usage ADD COLUMN subagent_name TEXT;
ALTER TABLE ai_service_usage ADD COLUMN spawned_by TEXT;  -- Which PS spawned
```

### File Structure

```
/home/samuel/sv/
├── .claude/commands/subagents/          # New subagent library
│   ├── research/
│   │   └── prime-research.md
│   ├── planning/
│   │   ├── plan-implementation.md
│   │   └── create-epic.md
│   ├── implementation/
│   │   └── implement-feature.md
│   ├── testing/
│   │   ├── test-ui-complete.md
│   │   ├── write-unit-tests.md
│   │   └── write-integration-tests.md
│   ├── validation/
│   │   └── validate-changes.md
│   ├── documentation/
│   │   ├── update-deployment-docs.md
│   │   └── update-readme.md
│   └── (categories for remaining 35 subagents)
├── docs/
│   ├── subagent-catalog.md              # Complete reference
│   ├── mcp-tools-reference.md           # MCP tools guide
│   └── guides/
│       └── ps-role-guide.md             # Detailed PS guide
├── supervisor-service-s/
│   ├── .supervisor-core/
│   │   └── 01-identity.md               # Updated with FORBIDDEN/MANDATORY
│   ├── .automation-suggestions/         # New: Auto-discovered patterns
│   │   └── NNN-pattern-name.md
│   ├── src/
│   │   ├── mcp/tools/
│   │   │   └── spawn-subagent-tool.ts   # New: Centralized spawning
│   │   ├── automation/
│   │   │   ├── activity-tracker.ts      # New: Log PS actions
│   │   │   ├── pattern-analyzer.ts      # New: Detect patterns
│   │   │   └── suggestion-generator.ts  # New: Generate suggestions
│   │   └── scripts/
│   │       └── analyze-patterns.ts      # New: Daily/weekly analysis
│   └── migrations/
│       └── NNNN_activity_logging.cjs    # New tables
```

---

## Implementation Plan

### Phase 1: Foundation (Day 1)

**Epic 1: Core Identity & Enforcement**
- Update .supervisor-core/01-identity.md with FORBIDDEN/MANDATORY sections
- Move "why" content to /docs/guides/ps-role-guide.md
- Create workflow checklists
- Reduce core instructions to <800 lines

**Epic 2: Core Subagent Library (Phase 1)**
- Create directory structure: .claude/commands/subagents/
- Create 5 core PIV-loop subagents:
  - prime-research.md (ported from SCAR)
  - plan-implementation.md
  - implement-feature.md (ported from SCAR)
  - validate-changes.md
  - test-ui-complete.md (Playwright)

### Phase 2: Automation (Day 2)

**Epic 3: Centralized Subagent Spawning**
- Create mcp_meta_spawn_subagent MCP tool
- Integrate with Odin load balancer
- Implement smart selection logic (task_type + keywords)
- Add usage tracking

**Epic 4: Auto-Discovery System**
- Create database migrations (ps_activity_logs, automation_suggestions)
- Implement activity tracker
- Implement pattern analyzer (daily/weekly scheduled)
- Create suggestion generator

### Phase 3: Enforcement & Documentation (Day 3)

**Epic 5: Infrastructure Tool Enforcement**
- Add validation to tunnel_request_cname (port allocated, in range)
- Add validation to mcp_meta_set_secret (key path format, description)
- Add validation to mcp_meta_allocate_port (range check)
- Update PS instructions with infrastructure FORBIDDEN rules
- Implement automatic documentation update workflow

**Epic 6: Reference Documentation**
- Create /docs/subagent-catalog.md
- Create /docs/mcp-tools-reference.md
- Update /docs/guides/ps-role-guide.md

**Epic 7: Testing & Validation**
- Regenerate all CLAUDE.md files
- Test with one PS (Odin or Consilio)
- Validate delegation rate >90%
- Validate automatic load balancer integration
- Validate cost tracking

---

## Risks & Mitigations

### Risk 1: PS Finds Workarounds

**Risk**: PS might find creative ways to bypass enforcement

**Mitigation**:
- Multi-layer enforcement (FORBIDDEN rules + tool validation + activity logging)
- Pattern analyzer detects bypasses
- Clear failure messaging when rules violated

### Risk 2: Subagent Library Incomplete

**Risk**: 43 subagents might not cover all edge cases

**Mitigation**:
- Auto-discovery system suggests missing automations
- Start with Phase 1 (5 core subagents), expand iteratively
- Generic fallback subagents for unusual tasks

### Risk 3: Performance Overhead

**Risk**: Activity logging and pattern analysis might slow system

**Mitigation**:
- Async logging with batch writes
- Indexed database queries
- Pattern analyzer runs off-peak (daily/weekly, not real-time)

### Risk 4: False Positives in Pattern Detection

**Risk**: Pattern analyzer might suggest automations for intentional one-offs

**Mitigation**:
- Require minimum frequency threshold (5+ occurrences)
- User review before implementation
- Reject option with explanation

### Risk 5: Breaking Existing PSes

**Risk**: Major changes might disrupt working projects

**Mitigation**:
- Test with one PS before rolling out to all
- Gradual rollout (Phase 1 first, then Phase 2, etc.)
- Keep old instructions backed up
- Easy rollback via git

---

## Dependencies

**Required (Already Exist):**
- ✅ Odin load balancer (operational)
- ✅ Meta-Supervisor MCP service
- ✅ Claude Agent SDK
- ✅ Tunnel manager MCP tools
- ✅ Secrets manager MCP tools
- ✅ Port manager MCP tools

**New (To Be Created):**
- mcp_meta_spawn_subagent MCP tool
- Subagent library (43 .md files)
- Activity logging system
- Pattern analyzer
- Database migrations

**External:**
- PostgreSQL (for activity logging)
- Cron or systemd timer (for scheduled pattern analysis)

---

## Success Validation

### Acceptance Tests

**Test 1: Delegation Enforcement**
- User: "Implement user authentication"
- Expected: PS immediately calls mcp_meta_spawn_subagent, never implements directly
- PS never asks "should I spawn?"
- Pass: PS delegates 100%

**Test 2: Automatic Load Balancing**
- User: "Write unit tests for API"
- Expected: mcp_meta_spawn_subagent queries Odin automatically
- Gemini selected (cheap/free for testing)
- Usage tracked in database
- Pass: Odin integrated, cost tracked

**Test 3: Infrastructure Enforcement**
- PS attempts: bash("cloudflared tunnel create test")
- Expected: Tool validation rejects with error message
- Directs PS to use tunnel_request_cname
- Pass: Manual command blocked

**Test 4: Auto-Discovery**
- Run system for 1 week
- Expected: 3+ patterns detected
- Suggestions saved to .automation-suggestions/
- Pass: Patterns detected, suggestions generated

**Test 5: Documentation Auto-Update**
- User: "Deploy frontend service"
- PS creates tunnel using tunnel_request_cname
- Expected: PS automatically spawns update-deployment-docs.md subagent
- CLAUDE.md regenerated automatically
- Changes committed automatically
- Pass: Documentation updated without user reminder

### Metrics Dashboard

**Track Weekly:**
- Delegation rate per PS
- MCP tool usage vs manual commands
- Cost savings from automation (% using cheap services)
- Compliance violations (PS doing work directly)
- Automation suggestions generated vs implemented

**Report Format:**
```
Week of 2026-01-21:
- Delegation rate: 97% (target: 95%)
- Cost optimization: 65% cheap services (target: 60%)
- User reminders: 0 (target: <1 per 10 tasks)
- Automation suggestions: 7 detected, 2 implemented
- Status: ✅ All targets met
```

---

## Timeline

**Phase 1: Foundation** (Day 1)
- Epic 1: Core Identity & Enforcement (4 hours)
- Epic 2: Core Subagent Library (4 hours)

**Phase 2: Automation** (Day 2)
- Epic 3: Centralized Subagent Spawning (6 hours)
- Epic 4: Auto-Discovery System (4 hours)

**Phase 3: Enforcement & Documentation** (Day 3)
- Epic 5: Infrastructure Tool Enforcement (4 hours)
- Epic 6: Reference Documentation (3 hours)
- Epic 7: Testing & Validation (3 hours)

**Total**: 28 hours (~3.5 days)

**First Results**: Delegation enforcement working by end of Day 1
**Full System**: All 7 epics complete by end of Day 3
**First Auto-Suggestions**: Week 2 (after 7 days of activity logging)

---

## Alternatives Considered

### Alternative 1: Bash Command Filtering

**Approach**: Hook into PS bash execution, block forbidden commands

**Pros**:
- Strong enforcement
- Catches all bypasses

**Cons**:
- Complex implementation
- False positives (might block legitimate commands)
- Harder to debug

**Decision**: Use tool-specific validation instead, softer enforcement

### Alternative 2: Smaller Subagent Library

**Approach**: Create only 10-15 most common subagents

**Pros**:
- Faster to implement
- Lower maintenance

**Cons**:
- PS still improvises for uncovered cases
- Inconsistent patterns
- Doesn't solve standardization problem

**Decision**: Build comprehensive library (43), use auto-discovery to expand

### Alternative 3: Manual Service Selection

**Approach**: Keep current Odin query workflow, improve documentation

**Pros**:
- No new MCP tool needed
- User has explicit control

**Cons**:
- High friction remains
- PS likely to skip and do directly
- No automatic cost optimization

**Decision**: Automate fully with mcp_meta_spawn_subagent

---

## Open Questions

1. **Bash Filtering**: Should we add bash command filtering as optional enforcement layer?
   - **Recommendation**: No, use tool-specific validation only (simpler, fewer false positives)

2. **Pattern Analyzer Frequency**: Daily vs weekly?
   - **Recommendation**: Daily for first month (catch patterns early), then weekly

3. **Auto-Implementation**: Should simple suggestions auto-implement without review?
   - **Recommendation**: No, always require user review (safety, control)

4. **Suggestion Threshold**: 3 occurrences? 5 occurrences?
   - **Recommendation**: 5 occurrences (reduce false positives)

5. **Dashboard UI**: Build web UI for reviewing suggestions?
   - **Recommendation**: Not in MVP, use .md files, add UI in Phase 2 if needed

---

## Appendix

### Related Documents

- Feature Request: .bmad/feature-requests/ps-delegation-enforcement-subagent-library.md
- Current Identity: .supervisor-core/01-identity.md
- Current Tools: .supervisor-core/04-tools.md
- Odin Load Balancer: ../odin-s/README.md

### References

- SCAR System: /home/samuel/.archon/workspaces/localrag/.agents/commands/
- Tunnel Manager: docs/TUNNEL_MANAGER.md
- Secrets Manager: docs/SECRETS_MANAGEMENT.md
- Port Manager: .supervisor-core/08-port-ranges.md

---

**Approval**: Approved for implementation
**Next Step**: Create epics for each phase
**Assigned**: Meta-Supervisor
