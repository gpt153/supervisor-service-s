# ADR 002: Centralized Subagent Spawning with Automatic Load Balancing

**Status**: Accepted
**Date**: 2026-01-21
**Deciders**: Meta-Supervisor, User (samuel)
**Context**: PS Delegation Enforcement System (PRD-PS-Delegation-Enforcement.md)

---

## Context and Problem Statement

Project-Supervisors (PS) need to delegate execution tasks to subagents but currently face high friction:
- Manual multi-step workflow: Query Odin → Select service → Spawn agent → Track usage (4 steps)
- High friction leads to PS doing work directly instead of delegating ("just do it myself")
- Inconsistent cost optimization (PS forgets to query Odin)
- No standardized subagent selection (PS improvises)

**Question**: How do we make delegation so frictionless that PS always delegates?

---

## Decision Drivers

1. **Minimize Friction**: Single tool call to spawn any subagent
2. **Automatic Optimization**: No manual service selection required
3. **Standardization**: Consistent subagent templates for all tasks
4. **Cost Tracking**: Automatic usage tracking for billing/optimization
5. **Extensibility**: Easy to add new subagents without PS changes

---

## Considered Options

### Option 1: Keep Current Manual Workflow (Status Quo)

**Approach**: PS manually queries Odin, selects service, spawns via bash command

**Pros**:
- No new code needed
- User has explicit control

**Cons**:
- High friction (4 steps)
- PS skips and does work directly
- No cost optimization
- No standardization

**Verdict**: ❌ Rejected - Root cause of delegation problem

---

### Option 2: Multiple Specialized MCP Tools

**Approach**: Create separate MCP tools per task category:
- mcp_meta_spawn_research_agent
- mcp_meta_spawn_implementation_agent
- mcp_meta_spawn_testing_agent
- etc.

**Pros**:
- Type-safe, clear purpose per tool
- Easy to add validations per type

**Cons**:
- 43+ tools to maintain (one per subagent)
- PS has to remember which tool for which task
- No smart selection logic
- Harder to extend

**Verdict**: ❌ Rejected - Too many tools, cognitive overload

---

### Option 3: Single Generic Agent Spawner (No Odin Integration)

**Approach**: Create mcp_meta_spawn_subagent that spawns agents but doesn't integrate with Odin

**Pros**:
- Simple implementation
- Single tool call
- PS doesn't need to know Odin API

**Cons**:
- No automatic cost optimization
- PS still has to specify service/model manually
- Misses key benefit of Odin

**Verdict**: ❌ Rejected - Doesn't solve cost optimization problem

---

### Option 4: Centralized Spawner with Automatic Load Balancing (SELECTED)

**Approach**: Single mcp_meta_spawn_subagent tool that:
1. Takes high-level inputs (task_type, description)
2. Automatically queries Odin for optimal service/model
3. Automatically selects appropriate subagent template from library
4. Spawns agent with Claude Agent SDK
5. Tracks usage automatically

**Pros**:
- ✅ Single tool call (minimal friction)
- ✅ Automatic service/model selection (cost optimization)
- ✅ Smart subagent selection (standardization)
- ✅ Automatic usage tracking (billing)
- ✅ Easy to extend (just add .md files to library)
- ✅ PS doesn't need to know Odin API, service names, or subagent names

**Cons**:
- More complex implementation
- Requires Odin integration
- Smart selection logic needed

**Verdict**: ✅ SELECTED - Best balance of benefits vs complexity

---

## Decision Outcome

**Chosen Option**: Option 4 - Centralized Spawner with Automatic Load Balancing

**Justification**:
- Reduces delegation friction from 4 steps to 1 step (75% reduction)
- Automatic cost optimization (Odin always queried)
- Standardization via template library
- Extensible (add subagents without code changes)
- PS doesn't need deep knowledge of system internals

---

## Technical Design

### MCP Tool Interface

```typescript
interface SpawnSubagentInput {
  task_type: 'research' | 'planning' | 'implementation' | 'testing' |
             'validation' | 'documentation' | 'fix' | 'deployment' |
             'review' | 'security' | 'integration';
  description: string;  // Plain English description of task
  context?: {
    epic_id?: string;
    plan_file?: string;
    files_to_review?: string[];
    validation_commands?: string[];
    [key: string]: any;
  };
}

interface SpawnSubagentOutput {
  agent_id: string;
  service_used: string;        // "gemini" | "codex" | "claude" | "claude-max"
  model_used: string;           // "gemini-2.5-flash-lite" | "claude-opus-4-5" etc.
  estimated_cost: string;       // "$0.0000" or "$0.0150"
  subagent_selected: string;    // "prime-research.md"
  instructions_preview: string; // First 200 chars of agent instructions
}
```

### Internal Workflow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. PS calls mcp_meta_spawn_subagent                          │
│    - task_type: "implementation"                             │
│    - description: "Add user authentication"                  │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Query Odin for service recommendation                     │
│    mcp__odin__recommend_ai_service({                         │
│      task_type: "implementation",                            │
│      estimated_tokens: calculateFromLength(description),     │
│      complexity: inferFromKeywords(description)              │
│    })                                                        │
│    → Returns: {service: "gemini", model: "2.5-flash-lite"}  │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Select subagent template from library                     │
│    - Read all .md files in .claude/commands/subagents/       │
│    - Filter by task_type (metadata in file header)          │
│    - Score candidates based on keywords in description       │
│    - Select highest scoring                                  │
│    → Selected: "implement-feature.md"                        │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Load template and substitute variables                    │
│    - Read implement-feature.md                               │
│    - Replace {{TASK_DESCRIPTION}} with description           │
│    - Replace {{PROJECT_PATH}} with cwd                       │
│    - Replace {{CONTEXT}} with JSON.stringify(context)        │
│    → Generated agent instructions                            │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Spawn agent using Claude Agent SDK                        │
│    spawnAgent({                                              │
│      service: "gemini",                                      │
│      model: "gemini-2.5-flash-lite",                         │
│      instructions: generatedInstructions                     │
│    })                                                        │
│    → Returns: agent_id                                       │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Track usage in Odin database                              │
│    mcp__odin__track_ai_usage({                               │
│      service: "gemini",                                      │
│      tokens_used: estimated,                                 │
│      task_type: "implementation",                            │
│      subagent_name: "implement-feature.md",                  │
│      spawned_by: projectName                                 │
│    })                                                        │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. Return result to PS                                       │
│    {                                                         │
│      agent_id: "abc123",                                     │
│      service_used: "gemini",                                 │
│      model_used: "gemini-2.5-flash-lite",                    │
│      estimated_cost: "$0.0000",                              │
│      subagent_selected: "implement-feature.md"               │
│    }                                                         │
└─────────────────────────────────────────────────────────────┘
```

### Smart Selection Logic

**Keyword Scoring Algorithm**:

```typescript
function selectSubagent(task_type: string, description: string): string {
  // 1. Filter candidates by task_type
  const candidates = subagents.filter(s => s.task_type === task_type);

  // 2. Score each candidate
  const scored = candidates.map(subagent => {
    let score = 0;

    // Base score from task_type match
    score += 10;

    // Bonus for exact keyword matches in description
    const keywords = extractKeywords(subagent.name + ' ' + subagent.description);
    for (const keyword of keywords) {
      if (description.toLowerCase().includes(keyword.toLowerCase())) {
        score += 5;
      }
    }

    // Bonus for multi-word phrase matches
    const phrases = extractPhrases(subagent.name);
    for (const phrase of phrases) {
      if (description.toLowerCase().includes(phrase.toLowerCase())) {
        score += 10;
      }
    }

    return { subagent, score };
  });

  // 3. Select highest scoring
  const best = scored.sort((a, b) => b.score - a.score)[0];
  return best.subagent;
}

// Examples:
// task_type="testing", description="click all buttons and test forms"
//   → "test-ui-complete.md" scores high (keywords: "click", "buttons", "test", "forms")
//
// task_type="testing", description="write unit tests for authentication functions"
//   → "write-unit-tests.md" scores high (keywords: "unit tests", "functions")
//
// task_type="research", description="research authentication patterns in codebase"
//   → "prime-research.md" scores high (keywords: "research", "patterns", "codebase")
```

### Subagent Template Format

All subagent .md files follow this format:

```markdown
---
task_type: implementation
estimated_tokens: medium
complexity: medium
keywords: [implement, feature, code, build]
---

# Subagent: Implement Feature

You are an implementation agent...

## Task Description

{{TASK_DESCRIPTION}}

## Project Path

{{PROJECT_PATH}}

## Context

{{CONTEXT}}

## Workflow

1. Read plan from {{PLAN_FILE}}
2. Implement each task
3. Run validations
4. Report completion
```

Variables are substituted at spawn time.

---

## Consequences

### Positive

1. **Dramatic Friction Reduction**: 1 tool call vs 4 steps (75% reduction)
2. **Automatic Cost Optimization**: Odin always consulted, optimal service always selected
3. **Standardization**: All subagents follow same template structure
4. **Extensibility**: Add new subagents by creating .md files (no code changes)
5. **Transparency**: PS can see which service/model used for debugging
6. **Auditability**: All spawns tracked in database for metrics

### Negative

1. **Single Point of Failure**: If Odin down, spawning breaks (mitigated with fallback to Claude Sonnet)
2. **Complexity**: More complex than simple bash command (but worth it for benefits)
3. **Maintenance**: Keyword scoring algorithm may need tuning over time

### Neutral

1. **Learning Curve**: PS needs to learn task_type values, but only 11 categories vs 43+ subagent names
2. **Testing**: Requires integration testing with Odin (not just unit tests)

---

## Risks and Mitigations

### Risk 1: Odin Unavailable

**Risk**: Odin MCP server down, spawning fails

**Mitigation**:
```typescript
try {
  const recommendation = await queryOdin(...);
} catch (error) {
  // Fallback to Claude Sonnet (safe default)
  const recommendation = {
    service: "claude",
    model: "claude-sonnet-4-5-20250929",
    estimated_cost: "$0.0030"
  };
}
```

### Risk 2: No Subagent Matches

**Risk**: PS requests task_type not in library

**Mitigation**:
- Create generic fallback subagents for each task_type
- Log warning: "No specific subagent found, using generic {task_type} subagent"
- Auto-discovery system suggests creating specific subagent

### Risk 3: Incorrect Subagent Selection

**Risk**: Keyword scoring picks wrong subagent

**Mitigation**:
- Log all selections with scores for debugging
- User can report incorrect selections
- Tune scoring algorithm based on feedback
- Add override parameter: `subagent_override: "specific-subagent.md"`

### Risk 4: Variable Substitution Failures

**Risk**: Template has {{VARIABLE}} that's not provided

**Mitigation**:
- Validate all required variables before spawning
- Provide defaults for optional variables
- Clear error message if required variable missing

---

## Implementation Checklist

- [ ] Create src/mcp/tools/spawn-subagent-tool.ts
- [ ] Implement Odin integration with fallback
- [ ] Implement subagent selection logic (keyword scoring)
- [ ] Implement template loading and variable substitution
- [ ] Implement agent spawning via Claude Agent SDK
- [ ] Implement usage tracking via Odin
- [ ] Add comprehensive error handling
- [ ] Write integration tests
- [ ] Add logging and monitoring
- [ ] Document tool in /docs/mcp-tools-reference.md

---

## Metrics

**Track These Metrics**:
1. Spawns per day (should increase as PS delegates more)
2. Service distribution (should be 60%+ Gemini/Codex)
3. Subagent selection accuracy (manual spot-checks)
4. Average cost per spawn (should decrease over time)
5. Fallback rate (Odin failures, should be <1%)

**Target Metrics (Week 1)**:
- 20+ spawns per day across all PSes
- 60%+ using Gemini or Codex (free/cheap)
- <5% subagent selection errors
- Average cost <$0.001 per spawn
- <1% fallback to Claude default

---

## Related Decisions

- ADR 001: (previous ADR if exists)
- Epic 017: Centralized Subagent Spawning (implementation)
- Epic 016: Core Subagent Library (provides templates)
- PRD: PS Delegation Enforcement (overall system)

---

## References

- Odin AI Router: /home/samuel/sv/odin-s/
- Claude Agent SDK: (documentation link)
- Current Manual Workflow: .supervisor-core/04-tools.md (AI Service Selection section)

---

**Status**: Accepted
**Implemented**: Pending (Epic 017)
**Last Updated**: 2026-01-21
