# Revised Action Plan: Build Autonomous Supervision System

**Date**: 2026-01-23
**Goal**: Implement working autonomous supervision with cost-optimized subagent spawning

---

## User's Actual Requirements (Correct Vision)

1. ✅ User creates plan/epic
2. ✅ PS takes over autonomously
3. ❌ **MISSING**: PS spawns subagents using AI router for cost optimization
4. ❌ **MISSING**: PS supervises subagents (verify, test, fix, iterate)
5. ❌ **MISSING**: PS keeps going until scope complete

**The vision is correct. The implementation is incomplete.**

---

## What Actually Needs to Be Built

### Critical Missing Piece #1: Subagent Spawning Tool

**Status**: Tool signature exists, implementation MISSING

**What exists**:
- Documentation describes `mcp_meta_spawn_subagent`
- TypeScript type definitions
- Subagent templates (prime-research.md, implement-feature.md, etc.)

**What's missing**:
- **Actual implementation** of the spawn tool
- Integration with Odin router
- Subprocess management
- Output capture and parsing

**Implementation needed**:

```typescript
// src/mcp/tools/subagent-spawning.ts (CREATE THIS FILE)

export const spawnSubagentTool: ToolDefinition = {
  name: 'mcp__meta__spawn_subagent',
  description: 'Spawn a subagent to perform execution work with cost optimization',
  inputSchema: {
    type: 'object',
    properties: {
      task_type: {
        type: 'string',
        enum: ['research', 'planning', 'implementation', 'testing', 'validation', 'fix', 'documentation']
      },
      description: {
        type: 'string',
        description: 'Plain English description of task'
      },
      context: {
        type: 'object',
        description: 'Optional context (epic_id, plan_file, etc.)'
      }
    },
    required: ['task_type', 'description']
  },
  handler: async (params, projectContext) => {
    const { task_type, description, context } = params;

    // Step 1: Select subagent template based on task_type
    const template = selectSubagentTemplate(task_type, description);

    // Step 2: Query Odin for optimal AI service
    const recommendation = await queryOdinRouter({
      task_type,
      estimated_tokens: estimateTokens(template, description),
      complexity: inferComplexity(description)
    });

    // Step 3: Load template and substitute variables
    const prompt = await loadTemplate(template, {
      task: description,
      context,
      ...projectContext
    });

    // Step 4: Spawn subprocess with recommended service
    const process = await spawnProcess({
      command: recommendation.cli_command,
      args: [prompt],
      cwd: projectContext.workingDirectory
    });

    // Step 5: Capture output and parse results
    const result = await captureOutput(process);

    // Step 6: Track usage in Odin
    await trackUsage({
      service: recommendation.service,
      tokens: result.tokens_used,
      cost: result.cost,
      task_type,
      success: result.success
    });

    return {
      success: result.success,
      service: recommendation.service,
      cost: result.cost,
      output: result.output,
      files_changed: result.files_changed,
      validation_results: result.validation_results
    };
  }
};
```

**Time to implement**: 1-2 days
**Priority**: **CRITICAL** - Nothing works without this

---

### Critical Missing Piece #2: Odin Router Integration

**Status**: Odin works standalone, NOT integrated into spawning

**What exists**:
- `/home/samuel/sv/odin-s/scripts/ai/query_ai_router.py` - WORKS
- CLI wrappers (gemini_agent.sh, claude_agent.sh) - WORK
- Quota tracking - WORKS

**What's missing**:
- Integration into supervisor-service
- TypeScript wrapper to call Python script
- Automatic service selection in spawn tool

**Implementation needed**:

```typescript
// src/utils/odin-client.ts (CREATE THIS FILE)

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface OdinRecommendation {
  service: 'gemini' | 'claude' | 'codex';
  model: string;
  cli_command: string;
  estimated_cost: number;
  reasoning: string;
}

export async function queryOdinRouter(params: {
  task_type: string;
  estimated_tokens: number;
  complexity: 'simple' | 'medium' | 'complex';
}): Promise<OdinRecommendation> {
  const { task_type, estimated_tokens, complexity } = params;

  try {
    // Call Odin's Python script
    const { stdout } = await execAsync(
      `python3 /home/samuel/sv/odin-s/scripts/ai/query_ai_router.py "${task_type}" ${estimated_tokens} "${complexity}"`
    );

    const recommendation = JSON.parse(stdout);

    return {
      service: recommendation.service,
      model: recommendation.model,
      cli_command: `/home/samuel/sv/odin-s/scripts/ai/${recommendation.service}_agent.sh`,
      estimated_cost: recommendation.estimated_cost,
      reasoning: recommendation.reasoning
    };
  } catch (error) {
    // Fallback to Gemini (cheapest) if Odin fails
    console.warn('[Odin] Router query failed, using Gemini fallback:', error);
    return {
      service: 'gemini',
      model: 'gemini-2.0-flash',
      cli_command: '/home/samuel/sv/odin-s/scripts/ai/gemini_agent.sh',
      estimated_cost: 0.0001,
      reasoning: 'Fallback due to Odin error'
    };
  }
}
```

**Time to implement**: 4 hours
**Priority**: **HIGH** - Needed for cost optimization

---

### Critical Missing Piece #3: PIV Phase Implementation

**Status**: Skeleton exists, actual implementation MISSING

**What exists**:
- `PIVAgent.ts` - Orchestrator (works)
- `PrimePhase.ts` - Calls non-existent CodebaseAnalyzer
- `PlanPhase.ts` - Calls non-existent methods
- `ExecutePhase.ts` - Calls non-existent methods

**What's missing**:
- Actual implementation of each phase
- Integration with subagent spawning
- Results parsing and validation

**Implementation needed**:

```typescript
// src/agents/phases/PrimePhase.ts (REWRITE)

export class PrimePhase {
  async execute(project: ProjectContext, epic: Epic): Promise<PrimeResult> {
    // Phase 1: Spawn research subagent
    const researchResult = await spawnSubagent({
      task_type: 'research',
      description: `Analyze ${project.name} codebase for ${epic.title}. Identify tech stack, patterns, and integration points.`,
      context: {
        epic_id: epic.id,
        project_path: project.path
      }
    });

    if (!researchResult.success) {
      throw new Error('Research phase failed');
    }

    // Parse research output
    const context = parseResearchOutput(researchResult.output);

    // Save to .agents/context/
    const contextPath = await this.storage.saveContext(epic.id, context);

    return {
      success: true,
      contextPath,
      techStack: context.techStack,
      patterns: context.patterns,
      readyForPlan: true
    };
  }
}
```

**Similar rewrites for PlanPhase and ExecutePhase**

**Time to implement**: 2-3 days
**Priority**: **HIGH** - Core PIV functionality

---

### Critical Missing Piece #4: Supervision Loop

**Status**: Documented but not implemented

**What's needed**:
- PS monitors subagent progress
- PS validates subagent output
- PS detects failures and retries
- PS iterates until validation passes

**Implementation needed**:

```typescript
// src/agents/supervisor/SupervisionLoop.ts (CREATE THIS FILE)

export class SupervisionLoop {
  async supervise(epic: Epic): Promise<SupervisionResult> {
    const maxAttempts = 3;
    let attempt = 0;

    while (attempt < maxAttempts) {
      attempt++;

      // Run PIV loop
      const result = await this.pivAgent.run();

      // Validate output
      const validation = await this.validate(result);

      if (validation.passed) {
        return {
          success: true,
          attempts: attempt,
          result
        };
      }

      // If validation failed, analyze and retry
      console.log(`[Supervision] Attempt ${attempt} failed:`, validation.errors);

      if (attempt < maxAttempts) {
        // Spawn fix subagent
        await this.fixIssues(validation.errors);
      }
    }

    return {
      success: false,
      attempts: attempt,
      error: 'Max attempts reached'
    };
  }

  private async validate(result: PIVResult): Promise<ValidationResult> {
    // Spawn validation subagent
    const validationResult = await spawnSubagent({
      task_type: 'validation',
      description: 'Run all validation checks (lint, type-check, tests, build)',
      context: {
        epic_id: result.epic.id
      }
    });

    return {
      passed: validationResult.success,
      errors: validationResult.errors || []
    };
  }

  private async fixIssues(errors: ValidationError[]): Promise<void> {
    // Spawn fix subagent
    await spawnSubagent({
      task_type: 'fix',
      description: `Fix validation errors: ${errors.map(e => e.message).join(', ')}`,
      context: {
        errors
      }
    });
  }
}
```

**Time to implement**: 1-2 days
**Priority**: **HIGH** - Core supervision functionality

---

## Revised Implementation Plan

### Phase 1: Foundation (Week 1)

**Day 1-2: Build Subagent Spawning**
- [ ] Create `src/mcp/tools/subagent-spawning.ts`
- [ ] Implement template selection logic
- [ ] Implement subprocess management
- [ ] Test with simple task: "Write a Python function to parse JSON"

**Day 3: Integrate Odin Router**
- [ ] Create `src/utils/odin-client.ts`
- [ ] Test Odin query from supervisor-service
- [ ] Validate cost tracking works

**Day 4-5: Test End-to-End Spawning**
- [ ] Spawn research subagent → verify output
- [ ] Spawn implementation subagent → verify code written
- [ ] Spawn validation subagent → verify tests run
- [ ] Track costs in Odin

**Deliverable**: Working `mcp_meta_spawn_subagent` tool with Odin integration

---

### Phase 2: PIV Loop (Week 2)

**Day 1-2: Implement Prime Phase**
- [ ] Rewrite `PrimePhase.ts` to use spawn
- [ ] Test: Spawn research → Parse output → Save context
- [ ] Validate context document structure

**Day 3-4: Implement Plan Phase**
- [ ] Rewrite `PlanPhase.ts` to use spawn
- [ ] Test: Load context → Spawn planning → Parse plan
- [ ] Validate plan document structure

**Day 5: Implement Execute Phase**
- [ ] Rewrite `ExecutePhase.ts` to use spawn
- [ ] Test: Load plan → Spawn implementation → Verify code
- [ ] Test: Spawn validation → Parse results

**Deliverable**: Complete PIV loop that spawns subagents for each phase

---

### Phase 3: Supervision (Week 3)

**Day 1-2: Build Supervision Loop**
- [ ] Create `SupervisionLoop.ts`
- [ ] Implement validation checking
- [ ] Implement retry logic
- [ ] Implement fix spawning

**Day 3-4: Test Full Autonomous Flow**
- [ ] User: Create simple epic
- [ ] PS: Start PIV autonomously
- [ ] PS: Supervise → Validate → Fix → Retry
- [ ] PS: Complete epic without intervention

**Day 5: Test Complex Epic**
- [ ] User: Create complex epic (authentication feature)
- [ ] PS: Execute autonomously
- [ ] Measure: Attempts, cost, time to completion

**Deliverable**: Fully autonomous supervision system

---

### Phase 4: Polish (Week 4)

**Day 1-2: Status Updates**
- [ ] Implement periodic status updates (every 10 min)
- [ ] Implement health check responses
- [ ] Test monitoring in long-running PIV

**Day 3-4: Error Handling**
- [ ] Handle subagent failures gracefully
- [ ] Implement escalation to user (after 3 failures)
- [ ] Test failure scenarios

**Day 5: Documentation**
- [ ] Update CLAUDE.md with working system
- [ ] Create usage guide
- [ ] Document cost optimization results

**Deliverable**: Production-ready autonomous supervision

---

## Success Criteria

**After 4 weeks, the system should**:

1. ✅ User creates epic → PS executes autonomously
2. ✅ PS spawns subagents using Odin for cost optimization
3. ✅ PS supervises: validates output, runs tests, fixes errors
4. ✅ PS retries up to 3 times before escalating
5. ✅ PS reports completion when epic done
6. ✅ Cost optimized: 80% of tasks use cheap models (Gemini)
7. ✅ Time efficient: User spends 90% on planning, 10% monitoring

**Metrics to track**:
- Epic completion rate (target: 80%)
- Cost per epic (target: <$1 for simple, <$5 for complex)
- User intervention rate (target: <20%)
- Average attempts to completion (target: <2)

---

## What to Keep from Original Review

**Infrastructure Tools**: ✅ Keep as-is (working well)
- Port management
- Tunnel management
- Secrets vault

**Odin Router**: ✅ Keep and integrate (foundation of cost optimization)

**CLAUDE.md Size**: ⚠️ Still optimize (1495→800 lines)
- Keep autonomous supervision instructions
- Keep PIV workflow docs
- Move examples to separate files

**What to Delete**: Only truly broken/unused features
- Old placeholder code
- Duplicate documentation
- Unimplemented utilities

---

## Key Differences from Original Plan

**Original (Wrong)**:
❌ Delete PIV loop
❌ Delete subagent system
❌ Build simple execution only

**Revised (Correct)**:
✅ **Implement** PIV loop properly
✅ **Build** subagent spawning tool
✅ **Integrate** Odin router
✅ **Create** supervision loop

**The vision was right. We just need to build it.**

---

## Next Steps

**Immediate**:
1. Confirm this approach aligns with your vision
2. Prioritize: Start with subagent spawning (most critical)
3. Set up test epic for validation

**Questions for you**:
1. Does this revised plan match your vision?
2. Should I start with subagent spawning implementation?
3. Any specific epic you want to use for testing?

---

**End of Revised Plan**

**Status**: Ready to implement
**Timeline**: 4 weeks to full autonomous supervision
**First Task**: Build `mcp_meta_spawn_subagent` tool
