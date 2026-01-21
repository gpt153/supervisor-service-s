# Epic 017: Centralized Subagent Spawning

**Status**: Pending
**Priority**: P0 - Critical
**Complexity**: High
**Estimated Effort**: 6 hours
**Dependencies**: Epic 016 (needs subagent library)
**Related PRD**: PRD-PS-Delegation-Enforcement.md

---

## Overview

Create single MCP tool (mcp_meta_spawn_subagent) that automatically queries Odin, selects appropriate subagent template, spawns agent with optimal service/model, and tracks usage.

---

## Goals

1. Single tool call replaces multi-step manual workflow (query Odin → select service → spawn → track)
2. Automatic service/model selection based on task_type and complexity
3. Smart subagent template selection based on task_type + keyword matching
4. Automatic usage tracking in Odin database
5. Zero friction = higher delegation compliance

---

## Acceptance Criteria

- [ ] MCP tool created: mcp_meta_spawn_subagent
- [ ] Tool inputs: task_type (required), description (required), context (optional)
- [ ] Tool workflow:
  - [ ] Query Odin for service recommendation
  - [ ] Select subagent template from library
  - [ ] Load template and substitute variables
  - [ ] Spawn agent using Claude Agent SDK
  - [ ] Track usage in Odin database
  - [ ] Return agent_id
- [ ] Smart selection logic working (task_type + keywords score candidates)
- [ ] Integration with Odin load balancer functional
- [ ] Usage tracking captures: service, model, tokens, cost, subagent_name, spawned_by

---

## Tasks

### Task 1: Create MCP Tool Scaffolding
- [ ] Create src/mcp/tools/spawn-subagent-tool.ts
- [ ] Add tool to MCP server index
- [ ] Define input schema (task_type, description, context)
- [ ] Define output schema (agent_id, service_used, estimated_cost, subagent_selected)

### Task 2: Integrate with Odin Load Balancer
- [ ] Import Odin MCP client
- [ ] Query mcp__odin__recommend_ai_service with:
  - task_type (from input)
  - estimated_tokens (calculate from description length)
  - complexity (infer from keywords: "simple" if <50 words, "complex" if architectural terms)
- [ ] Extract recommended service, model, cli_command

### Task 3: Implement Subagent Template Selection
- [ ] Read all subagent .md files from /home/samuel/sv/.claude/commands/subagents/
- [ ] Filter candidates by task_type (from file metadata)
- [ ] Score each candidate:
  - Base score from task_type match
  - Bonus points for keywords in description matching subagent name/description
  - Examples:
    - "unit tests" → write-unit-tests.md (+10 points)
    - "click buttons" → test-ui-complete.md (+10 points)
    - "research codebase" → prime-research.md (+10 points)
- [ ] Select highest scoring subagent

### Task 4: Implement Template Loading & Variable Substitution
- [ ] Read selected subagent .md file
- [ ] Substitute variables:
  - {{TASK_DESCRIPTION}} → description from input
  - {{PROJECT_PATH}} → infer from cwd or context
  - {{CONTEXT}} → JSON from context input
  - {{EPIC_ID}} → from context.epic_id if provided
  - {{PLAN_FILE}} → from context.plan_file if provided
- [ ] Generate final agent instructions

### Task 5: Implement Agent Spawning
- [ ] Use Claude Agent SDK to spawn agent
- [ ] Use recommended service/model from Odin
- [ ] Pass substituted instructions to agent
- [ ] Capture agent_id

### Task 6: Implement Usage Tracking
- [ ] Call mcp__odin__track_ai_usage with:
  - service (from Odin recommendation)
  - tokens_used (initially estimated, update later)
  - task_type (from input)
  - subagent_name (selected template name)
  - spawned_by (PS session ID or project name)
- [ ] Store in Odin database

### Task 7: Add Error Handling
- [ ] Handle Odin query failures (fallback to Claude Sonnet)
- [ ] Handle no subagent found (generic fallback subagent)
- [ ] Handle agent spawn failures (return error to PS)
- [ ] Log all errors for debugging

### Task 8: Add Monitoring
- [ ] Log every spawn: timestamp, task_type, subagent_selected, service_used
- [ ] Track spawn success rate
- [ ] Track average cost per spawn
- [ ] Weekly report to user

---

## Testing

**Test 1: Simple Implementation Task**
```typescript
mcp_meta_spawn_subagent({
  task_type: "implementation",
  description: "Add user authentication to API"
})
// Expected: Queries Odin → Selects implement-feature.md → Spawns with Gemini → Returns agent_id
```

**Test 2: UI Testing Task**
```typescript
mcp_meta_spawn_subagent({
  task_type: "testing",
  description: "Test all buttons and forms in dashboard"
})
// Expected: Selects test-ui-complete.md (keyword match: "buttons", "forms")
```

**Test 3: Research Task**
```typescript
mcp_meta_spawn_subagent({
  task_type: "research",
  description: "Research authentication patterns in codebase"
})
// Expected: Selects prime-research.md → Spawns READ-ONLY agent
```

**Test 4: Cost Optimization**
- Spawn 10 different tasks
- Verify 60%+ use Gemini or Codex (cheap/free)
- Verify only complex tasks use Claude MAX
- Verify all usage tracked in Odin database

---

## Success Metrics

- Single tool call replaces 3-4 step manual workflow
- Odin integration automatic (no manual queries)
- Subagent selection accurate (>90% select correct template)
- Cost optimization achieved (60%+ cheap services)
- All usage tracked in database

---

## Timeline

**Day 2 - Phase 2: Automation**
- Duration: 6 hours

---

## Notes

This is the KEY FRICTION REDUCTION mechanism. Making delegation a single tool call dramatically increases compliance compared to manual multi-step workflow.
