# Epic: Multi-Agent CLI Integration

**Epic ID:** 013
**Created:** 2026-01-19
**Status:** Planning
**Complexity Level:** 3 (Complex)
**Priority:** High

---

## Project Context

- **Project:** supervisor-service (meta)
- **Repository:** gpt153/supervisor-service
- **Tech Stack:** TypeScript, Node.js, PostgreSQL
- **Related Epics:** EPIC-010 (PIV Loop), EPIC-007 (Task Timing)
- **Workspace:** `/home/samuel/sv/supervisor-service-s/`
- **Purpose:** Leverage multiple AI CLI tools to reduce costs and optimize task execution

---

## Business Context

### Problem Statement

Current PIV loop implementation uses Claude exclusively for all phases:
- **Prime** (research): Claude Sonnet → expensive for codebase scanning
- **Plan** (design): Claude Sonnet → appropriate for architecture
- **Execute** (implementation): Claude Haiku → still ~$0.25-1.00/task

With existing subscriptions (Claude Pro $20, Gemini Pro $20, ChatGPT Plus $20), we have **underutilized quota**:
- Gemini CLI: 1,000+ requests/day included
- Codex CLI: 30-150 messages/5hr included
- Claude Code: Subscription-included tokens

**Current monthly cost estimate:** $150-300 in API tokens for moderate PIV usage
**Potential savings:** 60-80% by routing appropriate tasks to subscription-included tools

### User Value

By integrating multi-agent CLI orchestration:
- **Cost Reduction:** Route routine tasks to Gemini/Codex (subscription-included)
- **Specialized Routing:** Match task complexity to appropriate model
- **Parallel Execution:** Run multiple CLI agents simultaneously
- **Quota Optimization:** Automatically balance across available quotas
- **Fallback Resilience:** If one service is rate-limited, use another

### Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Cost per PIV cycle | ~$2-5 | ~$0.50-1 | API billing dashboard |
| Tasks using free quota | 0% | 70%+ | Agent routing logs |
| Average task completion time | Baseline | -20% | Task timing system |
| Quota utilization | ~10% | 80%+ | CLI usage tracking |
| Fallback success rate | N/A | 95%+ | Error recovery logs |

---

## Requirements

### Functional Requirements (MoSCoW)

**MUST HAVE:**
- [ ] AgentRouter class to select optimal CLI for each task
- [ ] GeminiCLIAdapter for spawning Gemini CLI tasks
- [ ] CodexCLIAdapter for spawning Codex CLI tasks
- [ ] ClaudeCLIAdapter for spawning Claude Code tasks
- [ ] Task complexity classification (simple/medium/complex)
- [ ] JSON output parsing from all CLIs
- [ ] Quota tracking per service
- [ ] Fallback routing when primary is unavailable
- [ ] Integration with existing PIV loop phases

**SHOULD HAVE:**
- [ ] Deep Research delegation (Gemini/ChatGPT for research phases)
- [ ] Cost tracking per task/agent
- [ ] Automatic quota refresh detection
- [ ] MCP tool exposure for manual agent selection
- [ ] Performance comparison logging
- [ ] Rate limit detection and backoff

**COULD HAVE:**
- [ ] ML-based routing optimization (learn which agent performs best)
- [ ] Batch task submission (queue multiple for each CLI)
- [ ] Real-time quota dashboard
- [ ] Agent "specialization" profiles (e.g., "Gemini is 15% faster on docs")

**WON'T HAVE (this iteration):**
- API fallback (pay-per-token) - focus on subscription-included only
- Voice mode integration
- Custom fine-tuned models

---

## Technical Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    PIV Loop Orchestrator                     │
│                  (existing: src/agents/PIVAgent.ts)          │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      AgentRouter                             │
│  - Classifies task complexity                                │
│  - Checks quota availability                                 │
│  - Selects optimal CLI agent                                 │
│  - Handles fallback routing                                  │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│ GeminiCLI   │   │ CodexCLI    │   │ ClaudeCLI   │
│ Adapter     │   │ Adapter     │   │ Adapter     │
├─────────────┤   ├─────────────┤   ├─────────────┤
│ Best for:   │   │ Best for:   │   │ Best for:   │
│ - Docs      │   │ - Refactor  │   │ - Complex   │
│ - Simple    │   │ - Debugging │   │ - Architect │
│ - Research  │   │ - Testing   │   │ - Critical  │
│             │   │             │   │             │
│ Quota:      │   │ Quota:      │   │ Quota:      │
│ 1000/day    │   │ 30-150/5hr  │   │ Pro tokens  │
│ (AI Pro)    │   │ (Plus)      │   │ (Pro)       │
└─────────────┘   └─────────────┘   └─────────────┘
```

### Task Classification Matrix

| Task Type | Complexity | Preferred Agent | Fallback |
|-----------|------------|-----------------|----------|
| Documentation generation | Simple | Gemini CLI | Codex CLI |
| Test generation | Simple | Gemini CLI | Codex CLI |
| Boilerplate code | Simple | Gemini CLI | Codex CLI |
| Bug fixes (<50 lines) | Medium | Codex CLI | Gemini CLI |
| API implementation | Medium | Codex CLI | Claude CLI |
| Refactoring (3+ files) | Medium | Codex CLI | Claude CLI |
| Architecture design | Complex | Claude CLI | (no fallback) |
| Security-critical code | Complex | Claude CLI | (no fallback) |
| Novel algorithm impl | Complex | Claude CLI | Codex CLI |

### CLI Invocation Patterns

```typescript
// Gemini CLI (headless mode)
const geminiResult = await exec(
  `gemini -p "${escapedPrompt}" --output-format json`,
  { cwd: projectPath, timeout: 300000 }
);

// Codex CLI (headless mode)
const codexResult = await exec(
  `codex exec "${escapedPrompt}" --json`,
  { cwd: projectPath, timeout: 300000 }
);

// Claude Code (headless mode)
const claudeResult = await exec(
  `claude -p "${escapedPrompt}" --output-format json`,
  { cwd: projectPath, timeout: 300000 }
);
```

### Deep Research Integration

```typescript
// For research-heavy Prime phases
interface ResearchTask {
  query: string;
  sources: 'web' | 'internal' | 'both';
  depth: 'quick' | 'standard' | 'deep';
}

// Route research to best available
async function executeResearch(task: ResearchTask): Promise<ResearchResult> {
  if (task.depth === 'deep' && geminiQuota.available) {
    // Gemini Deep Research: 300+ sources, fast
    return await geminiDeepResearch(task);
  } else if (task.depth === 'deep' && chatgptQuota.available) {
    // ChatGPT Deep Research: 25/month, thorough
    return await chatgptDeepResearch(task);
  } else {
    // Claude Research: subscription-included
    return await claudeResearch(task);
  }
}
```

---

## Acceptance Criteria

### Feature-Level Acceptance

- [ ] AgentRouter correctly classifies 90%+ of tasks by complexity
- [ ] All three CLI adapters spawn headless processes successfully
- [ ] JSON output parsed correctly from all CLIs
- [ ] Quota tracking reflects actual CLI usage
- [ ] Fallback routing activates within 5s of rate limit detection
- [ ] PIV loop completes successfully using mixed agents
- [ ] Cost per PIV cycle reduced by 50%+ on test project

### Code Quality

- [ ] TypeScript strict mode, no `any` types
- [ ] All adapters follow common interface
- [ ] Error handling for CLI failures, timeouts, parse errors
- [ ] Logging at INFO level for routing decisions
- [ ] Unit tests for router logic (90%+ coverage)
- [ ] Integration tests for each CLI adapter

### Documentation

- [ ] Architecture diagram in docs/
- [ ] CLI setup guide (prerequisites, auth)
- [ ] Routing rules documented
- [ ] Cost comparison analysis
- [ ] Troubleshooting guide

---

## Dependencies

### Blocked By
- EPIC-010 (PIV Loop) - ✅ Complete
- EPIC-007 (Task Timing) - ✅ Complete

### Blocks
- Future: Cost optimization dashboard
- Future: ML-based routing optimization

### External Dependencies
- [ ] Gemini CLI installed and authenticated (`gemini --version`)
- [ ] Codex CLI installed and authenticated (`codex --version`)
- [ ] Claude Code installed and authenticated (`claude --version`)
- [ ] All three subscriptions active (Claude Pro, Gemini Pro, ChatGPT Plus)

---

## Risks & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| CLI output format changes | Medium | High | Version pinning, adapter abstraction, integration tests |
| Rate limits stricter than documented | Medium | Medium | Conservative quota tracking, aggressive fallback |
| Headless mode unavailable | Low | High | Verify before epic start, have API fallback design ready |
| Quality variance between agents | High | Medium | Task-specific routing, quality validation step |
| CLI authentication expires | Medium | Low | Health check on startup, re-auth instructions |
| Parallel execution conflicts | Low | Medium | Mutex locks on shared resources, separate workdirs |

---

## Tasks Breakdown

### Phase 1: Foundation (2-3 hours)

| # | Task | Est. | Agent |
|---|------|------|-------|
| 1.1 | Verify CLI installations on VM | 15m | Manual |
| 1.2 | Test headless mode for each CLI | 30m | Manual |
| 1.3 | Create `src/agents/multi/` directory structure | 10m | Haiku |
| 1.4 | Define TypeScript interfaces (`AgentAdapter`, `TaskClassification`, `QuotaStatus`) | 30m | Haiku |
| 1.5 | Implement base `CLIAdapter` abstract class | 45m | Haiku |
| 1.6 | Add quota tracking table to database schema | 20m | Haiku |

### Phase 2: CLI Adapters (3-4 hours)

| # | Task | Est. | Agent |
|---|------|------|-------|
| 2.1 | Implement `GeminiCLIAdapter` | 60m | Sonnet |
| 2.2 | Implement `CodexCLIAdapter` | 60m | Sonnet |
| 2.3 | Implement `ClaudeCLIAdapter` | 45m | Sonnet |
| 2.4 | Create JSON output parsers for each CLI | 30m | Haiku |
| 2.5 | Add timeout and error handling | 30m | Haiku |
| 2.6 | Unit tests for all adapters | 45m | Haiku |

### Phase 3: Router Implementation (2-3 hours)

| # | Task | Est. | Agent |
|---|------|------|-------|
| 3.1 | Implement `TaskClassifier` (complexity scoring) | 60m | Sonnet |
| 3.2 | Implement `QuotaManager` (track usage per service) | 45m | Haiku |
| 3.3 | Implement `AgentRouter` (selection logic) | 60m | Sonnet |
| 3.4 | Add fallback routing logic | 30m | Haiku |
| 3.5 | Unit tests for router (edge cases) | 30m | Haiku |

### Phase 4: PIV Integration (2-3 hours)

| # | Task | Est. | Agent |
|---|------|------|-------|
| 4.1 | Modify `ExecutePhase` to use AgentRouter | 45m | Sonnet |
| 4.2 | Add agent selection to task execution | 30m | Haiku |
| 4.3 | Integrate with task timing system | 30m | Haiku |
| 4.4 | Add cost tracking per execution | 30m | Haiku |
| 4.5 | Integration tests (full PIV with routing) | 60m | Sonnet |

### Phase 5: MCP Tools & Polish (1-2 hours)

| # | Task | Est. | Agent |
|---|------|------|-------|
| 5.1 | Expose `mcp__meta__get_agent_quotas` tool | 20m | Haiku |
| 5.2 | Expose `mcp__meta__force_agent_selection` tool | 20m | Haiku |
| 5.3 | Expose `mcp__meta__get_routing_stats` tool | 20m | Haiku |
| 5.4 | Documentation and README updates | 30m | Haiku |
| 5.5 | End-to-end validation test | 30m | Manual |

---

## Estimated Totals

| Phase | Sequential | With Parallel Agents |
|-------|------------|---------------------|
| Phase 1: Foundation | 2.5 hrs | 1.5 hrs |
| Phase 2: CLI Adapters | 4.5 hrs | 2 hrs |
| Phase 3: Router | 3.5 hrs | 1.5 hrs |
| Phase 4: PIV Integration | 3 hrs | 1.5 hrs |
| Phase 5: MCP & Polish | 2 hrs | 1 hr |
| **TOTAL** | **15.5 hrs** | **7.5 hrs** |

---

## Testing Strategy

### Unit Tests
```typescript
describe('TaskClassifier', () => {
  it('classifies documentation as simple', () => {
    const task = { type: 'documentation', files: 1, lines: 50 };
    expect(classifier.classify(task)).toBe('simple');
  });

  it('classifies multi-file refactor as medium', () => {
    const task = { type: 'refactor', files: 5, lines: 200 };
    expect(classifier.classify(task)).toBe('medium');
  });

  it('classifies architecture design as complex', () => {
    const task = { type: 'architecture', files: 10, lines: 500 };
    expect(classifier.classify(task)).toBe('complex');
  });
});

describe('AgentRouter', () => {
  it('routes simple tasks to Gemini when quota available', () => {
    quotaManager.setQuota('gemini', 100);
    const agent = router.selectAgent({ complexity: 'simple' });
    expect(agent).toBe('gemini');
  });

  it('falls back to Codex when Gemini exhausted', () => {
    quotaManager.setQuota('gemini', 0);
    quotaManager.setQuota('codex', 50);
    const agent = router.selectAgent({ complexity: 'simple' });
    expect(agent).toBe('codex');
  });
});
```

### Integration Tests
```typescript
describe('CLI Adapters Integration', () => {
  it('GeminiCLIAdapter executes and parses response', async () => {
    const result = await geminiAdapter.execute({
      prompt: 'Return JSON: {"status": "ok"}',
      timeout: 30000
    });
    expect(result.success).toBe(true);
    expect(result.output).toHaveProperty('status', 'ok');
  });

  // Similar for Codex and Claude adapters
});

describe('Full PIV with Multi-Agent', () => {
  it('completes PIV cycle using mixed agents', async () => {
    const result = await pivAgent.run({
      epic: testEpic,
      enableMultiAgent: true
    });
    expect(result.success).toBe(true);
    expect(result.agentsUsed).toContain('gemini');
  });
});
```

### Manual Validation Checklist
- [ ] Run `gemini -p "hello" --output-format json` successfully
- [ ] Run `codex exec "hello" --json` successfully
- [ ] Run `claude -p "hello" --output-format json` successfully
- [ ] Complete a simple PIV task routed to Gemini
- [ ] Complete a medium PIV task routed to Codex
- [ ] Complete a complex PIV task routed to Claude
- [ ] Observe fallback when one CLI is unavailable
- [ ] Verify cost tracking accuracy

---

## Notes

### Design Decisions

**Why CLI-based instead of API?**
- Subscription tokens are "free" (already paid monthly)
- CLI handles authentication, rate limiting
- Simpler integration (spawn process vs. SDK setup)
- Matches our existing Claude Code usage pattern

**Why not use Claude for everything?**
- Claude Pro quota is limited
- Gemini Pro has generous 1000/day limit
- Diversification reduces single-point-of-failure
- Different models excel at different tasks

**Why task classification?**
- Prevents wasting Claude tokens on simple tasks
- Gemini is faster for documentation/boilerplate
- Codex excels at debugging/refactoring
- Quality-appropriate routing

### Future Enhancements

1. **ML-Based Routing:** Train classifier on historical performance
2. **API Fallback:** Add pay-per-token when all quotas exhausted
3. **Quality Scoring:** Rate output quality, feed back to router
4. **Batch Execution:** Queue tasks for each CLI, execute in parallel
5. **Cost Dashboard:** Real-time visualization of savings

### References

- Gemini CLI docs: https://github.com/google-gemini/gemini-cli
- Codex CLI docs: https://github.com/openai/codex
- Claude Code docs: https://docs.anthropic.com/claude-code
- PIV Loop Implementation: `/home/samuel/sv/.bmad/system-design/piv-loop-adaptation-guide.md`
- Task Timing System: `/home/samuel/sv/.bmad/system-design/task-timing-and-estimation-system.md`

---

## Approval

- [ ] Technical Review: Architecture approved
- [ ] Resource Review: CLI access verified
- [ ] Priority Review: Aligned with cost optimization goals

**Ready to Start PIV Loop:** ☐
