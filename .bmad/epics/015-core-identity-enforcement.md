# Epic 015: Core Identity & Enforcement

**Status**: In Progress
**Priority**: P0 - Critical
**Complexity**: Medium
**Estimated Effort**: 4 hours
**Dependencies**: None
**Related PRD**: PRD-PS-Delegation-Enforcement.md
**Parent Feature**: PS Delegation Enforcement System

---

## Overview

Transform PS identity from ambiguous coordinator/executor role into strict coordinator-only role with explicit FORBIDDEN/MANDATORY rules that are impossible to miss.

---

## Problem Statement

Current PS identity (01-identity.md):
- Ambiguous language ("coordinate epics, tasks, and implementations")
- No FORBIDDEN rules section
- Suggestive tone ("should spawn") instead of mandatory
- Too long (1,398 total lines across all core files) with too much explanation
- PS frequently executes tasks directly instead of delegating

---

## Goals

1. Create crystal-clear FORBIDDEN/MANDATORY sections at top of 01-identity.md
2. Use directive tone throughout ("DO THIS" not "you should")
3. Remove all "why" explanations → move to /docs/guides/
4. Remove all examples → move to /docs/examples/
5. Add workflow checklists for common operations
6. Reduce core instructions to <800 lines total
7. Make rules impossible to miss or misinterpret

---

## Acceptance Criteria

- [ ] 01-identity.md restructured with:
  - [ ] Section 1: 🚨 FORBIDDEN - Execution Tasks (~30 lines)
  - [ ] Section 2: 🚨 FORBIDDEN - Infrastructure Operations (~40 lines)
  - [ ] Section 3: MANDATORY - Delegation (~20 lines)
  - [ ] Section 4: MANDATORY - Infrastructure Tools (~30 lines)
  - [ ] Section 5: Workflow Checklists (~40 lines)
  - [ ] Section 6: Your ONLY Responsibilities (~20 lines)
- [ ] Total length ~180 lines (focused, directive)
- [ ] All "why" content moved to /docs/guides/ps-role-guide.md
- [ ] All examples moved to /docs/examples/
- [ ] Directive tone throughout
- [ ] File starts with 🚨 FORBIDDEN rules (not buried)

---

## Tasks

### Task 1: Backup Current Identity
- [ ] Copy current .supervisor-core/01-identity.md to .supervisor-core/01-identity.md.bak

### Task 2: Create /docs/guides/ps-role-guide.md
- [ ] Extract all "why" explanations from current identity
- [ ] Add detailed explanations of PS role
- [ ] Add extended examples
- [ ] Add troubleshooting section
- [ ] Format as comprehensive guide (can be longer, not in core instructions)

### Task 3: Rewrite Section 1 - FORBIDDEN Execution Tasks
- [ ] Start with "🚨 CRITICAL: READ THIS FIRST 🚨"
- [ ] Add "YOU ARE A COORDINATOR, NOT AN EXECUTOR"
- [ ] List forbidden execution activities:
  - Writing ANY code (source, tests, configs, scripts)
  - Researching codebase patterns yourself
  - Creating epics/ADRs/plans yourself
  - Writing tests yourself
  - Running validations yourself
  - Debugging code yourself
  - Refactoring code yourself
- [ ] End with "IF YOU PERFORM ANY OF THE ABOVE YOURSELF, YOU HAVE FAILED AS SUPERVISOR"
- [ ] Keep to ~30 lines, pure rules

### Task 4: Rewrite Section 2 - FORBIDDEN Infrastructure
- [ ] Manual cloudflared commands → Must use tunnel MCP tools
- [ ] Manual gcloud commands → Must use mcp_gcloud_* tools
- [ ] Writing secrets to .env without vault first → Must use mcp_meta_set_secret FIRST
- [ ] Manual port selection → Must use mcp_meta_allocate_port
- [ ] Manual database operations → Must use migration tools
- [ ] Keep to ~40 lines, pure rules

### Task 5: Rewrite Section 3 - MANDATORY Delegation
- [ ] Task types table (research, planning, implementation, testing, validation, documentation, fix, deployment, review)
- [ ] Single command: mcp_meta_spawn_subagent
- [ ] "NEVER ask user 'Should I spawn a subagent?' - Spawning is MANDATORY"
- [ ] Reference to full catalog: /home/samuel/sv/docs/subagent-catalog.md
- [ ] Keep to ~20 lines

### Task 6: Rewrite Section 4 - MANDATORY Infrastructure Tools
- [ ] Quick reference table:
  - Tunnels: tunnel_request_cname, tunnel_delete_cname, tunnel_list_cnames
  - Secrets: mcp_meta_set_secret (FIRST), then .env
  - Ports: mcp_meta_allocate_port
  - GCloud: mcp_gcloud_* tools
  - Database: migration tools
- [ ] When to use each category
- [ ] Automatic documentation update workflow after infrastructure changes
- [ ] Keep to ~30 lines

### Task 7: Write Section 5 - Workflow Checklists
- [ ] Deploying a New Service checklist (8 mandatory steps):
  1. Check port range in .supervisor-specific/02-deployment-status.md
  2. Allocate port using mcp_meta_allocate_port
  3. Configure service with allocated port
  4. Start service locally using docker compose
  5. Create tunnel using tunnel_request_cname
  6. Update deployment docs (spawned automatically)
  7. Regenerate CLAUDE.md
  8. Commit and push to git
- [ ] Adding a New Secret checklist (5 mandatory steps):
  1. FIRST: Store using mcp_meta_set_secret
  2. THEN: Add to .env file
  3. Verify storage by retrieving secret
  4. Update deployment docs if needed
  5. NEVER commit .env to git
- [ ] Keep to ~40 lines

### Task 8: Write Section 6 - Your ONLY Responsibilities
- [ ] Coordinate work (spawn subagents, track progress)
- [ ] Git operations (commit, push, PR creation)
- [ ] Report progress to user
- [ ] Update state (workflow status, regenerate CLAUDE.md)
- [ ] Keep to ~20 lines

### Task 9: Verify Line Count
- [ ] Count lines in new 01-identity.md
- [ ] Should be ~180 lines total
- [ ] If over, identify sections to trim further

### Task 10: Update Other Core Files for Brevity
- [ ] Review 02-workflow.md, 03-structure.md, etc.
- [ ] Move any "why" content to /docs/guides/
- [ ] Move any examples to /docs/examples/
- [ ] Target: Total core instructions <800 lines

---

## Testing

**Test 1: Clarity Test**
- Read FORBIDDEN sections first
- Should be impossible to misinterpret
- No ambiguity about what PS cannot do

**Test 2: Completeness Test**
- All critical rules covered
- All workflow checklists present
- All mandatory tools listed

**Test 3: Brevity Test**
- Count total lines across all .supervisor-core/*.md files
- Should be <800 lines total
- Each file focused, no fluff

**Test 4: Tone Test**
- Directive tone throughout ("DO THIS" not "you should")
- Commands, not suggestions
- Impossible to ignore

---

## Implementation Notes

**File Changes:**
- `/home/samuel/sv/supervisor-service-s/.supervisor-core/01-identity.md` - Complete rewrite
- `/home/samuel/sv/docs/guides/ps-role-guide.md` - New file (extracted content)
- `/home/samuel/sv/docs/examples/ps-delegation-examples.md` - New file (extracted examples)

**Structure Pattern:**
```markdown
# Section Title

## 🚨 FORBIDDEN

- ❌ Never do X
- ❌ Never do Y

## MANDATORY

- ✅ Always do A
- ✅ Always do B

## Checklist

1. Step 1
2. Step 2
```

**Tone Examples:**
- ❌ "You should consider spawning a subagent"
- ✅ "MANDATORY: Spawn subagent using mcp_meta_spawn_subagent"
- ❌ "It's generally better to delegate"
- ✅ "FORBIDDEN: Never implement code yourself"

---

## Success Metrics

- PS identity reduced to ~180 lines (from current larger size)
- FORBIDDEN rules appear at top (not buried)
- Zero ambiguity in role definition
- All "why" content moved to guides
- Directive tone throughout

---

## Related Epics

- Epic 016: Core Subagent Library (needs PS to delegate to subagents)
- Epic 017: Centralized Subagent Spawning (identity references mcp_meta_spawn_subagent)
- Epic 019: Infrastructure Tool Enforcement (identity lists FORBIDDEN infrastructure ops)

---

## Timeline

**Day 1 - Phase 1: Foundation**
- Start: Immediately
- Duration: 4 hours
- Completion: End of Day 1

---

## Notes

This is the FOUNDATION of the entire delegation enforcement system. Without clear FORBIDDEN/MANDATORY rules at the top of PS identity, all other enforcement mechanisms are weaker.

The key insight from SCAR system: FORBIDDEN rules FIRST, impossible to miss. Not buried in middle of long document.
