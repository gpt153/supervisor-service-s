# ADR 004: Agent Model Selection for Quality Workflows

**Date:** 2026-01-19 (Stockholm time)
**Status:** Proposed
**Project:** supervisor-service
**Supersedes:** N/A
**Superseded by:** N/A

## Context

The automatic quality workflows system requires three distinct agent types with different capabilities:
1. **Verification Agent** - Runs deterministic checks (file existence, build, tests, mock detection)
2. **Fix Agent** - Analyzes failures and attempts repairs with code modifications
3. **System Review Agent** - Performs deep analysis comparing epic plans vs actual implementation

These agents will run automatically and frequently (potentially dozens of times per day across multiple projects), making model selection a critical decision affecting both system quality and operational costs.

### Current Situation

The supervisor system currently uses Claude Sonnet 4.5 for all agent interactions. While this provides high quality results, it's unnecessarily expensive for simple deterministic tasks. The verification agent in particular doesn't require advanced reasoning - it just needs to:
- Check if files exist
- Run shell commands (build, test)
- Parse command output for success/failure
- Scan code for simple patterns (TODO, FIXME, mock)

### Constraints

- **Budget:** Operating on personal budget, cost control is critical
- **Latency:** Verification should complete within seconds, not minutes
- **Quality:** Fix and review agents need high reasoning capability to be effective
- **Frequency:** Verification runs on every PIV completion (could be 10-20x per day)
- **Token Usage:** Verification agents process large codebases but only need simple analysis

### Stakeholders

- **User:** Wants fast, accurate verification without manual overhead
- **System:** Needs reliable quality checks without breaking the budget
- **Developer:** Needs predictable costs and performance characteristics

## Decision

**We will use a mixed model strategy:**

1. **Verification Agent:** Claude Haiku 3.5
2. **Fix Agent:** Claude Sonnet 4.5
3. **System Review Agent:** Claude Sonnet 4.5

### Implementation Summary

- Verification agent spawner configured to use `claude-3-5-haiku-20241022`
- Fix agent spawner configured to use `claude-sonnet-4-5-20250929`
- System review agent spawner configured to use `claude-sonnet-4-5-20250929`
- Model selection implemented via agent configuration, easily changeable if needed
- Token usage tracked per agent type for cost monitoring

## Rationale

### Pros

✅ **Cost Efficiency:** Haiku is 10x cheaper than Sonnet ($0.25/MTok input vs $2.50/MTok)
✅ **Speed:** Haiku is approximately 5x faster, reducing verification latency from minutes to seconds
✅ **Right-sizing:** Deterministic verification doesn't need advanced reasoning - Haiku is sufficient
✅ **Quality Where It Matters:** Sonnet used for complex tasks (fixing code, extracting learnings) where reasoning is critical
✅ **Budget Sustainability:** Estimated 80% cost reduction vs all-Sonnet approach (verification is 70% of volume)
✅ **Predictable Performance:** Clear separation of concerns makes cost/performance predictable

### Cons

❌ **Complexity:** Two different models to maintain and configure
❌ **Potential Quality Gap:** Haiku might miss edge cases in verification (though unlikely for deterministic tasks)
❌ **Model Updates:** Need to track two model lifecycles instead of one
❌ **Mitigation:** Use strict verification criteria and manual test suite to ensure Haiku accuracy. User override option if verification is unreliable.

### Why This Wins

The core insight is that **verification is fundamentally different from fixing and reviewing**:

- **Verification** = Execute commands, parse output, match patterns (deterministic)
- **Fixing** = Understand code context, reason about errors, modify implementations (creative)
- **Reviewing** = Compare plans to reality, identify patterns, extract learnings (analytical)

Haiku excels at deterministic tasks. Sonnet excels at reasoning. Using each for their strengths optimizes both quality and cost.

**Cost Analysis (estimated monthly):**
- All Sonnet: ~$150/month (20 verifications/day × 30 days × 1M tokens × $2.50)
- Mixed strategy: ~$30/month (verification at Haiku rates, fix/review at Sonnet rates)
- **Savings: $120/month (80% reduction)**

## Consequences

### Positive Consequences

- **Developer Experience:** Faster verification feedback (seconds vs minutes)
- **User Experience:** More responsive system, lower operational costs enable more features
- **Performance:** Haiku's speed enables real-time verification without blocking other operations
- **Cost:** Sustainable budget for personal project, allows scaling to more projects

### Negative Consequences

- **Technical Debt:** Configuration complexity with multiple model types
- **Learning Curve:** Need to understand capabilities/limits of two different models
- **Migration Effort:** If Haiku proves insufficient, switching all verification to Sonnet requires config changes

### Neutral Consequences

- **Architecture Change:** Agent spawning code needs model selection parameter
- **Team Process:** Need to monitor Haiku accuracy during initial deployment

## Alternatives Considered

### Alternative 1: All Haiku (Maximum Cost Savings)

**Description:** Use Claude Haiku 3.5 for all three agent types (verification, fix, review)

**Pros:**
- Absolute minimum cost (~$15/month)
- Simplest configuration (single model)
- Fastest performance across the board

**Cons:**
- Haiku lacks reasoning depth for complex fixes
- System review quality would suffer (pattern extraction requires analysis)
- Higher failure rate on fix attempts = more user escalations
- Poor long-term learning quality

**Why Rejected:** Fix and review agents are infrequent (1-3x per day) but critical for system intelligence. Saving $15/month by degrading their quality isn't worth it. The 80% savings from using Haiku for verification alone is sufficient.

### Alternative 2: All Sonnet (Maximum Quality)

**Description:** Use Claude Sonnet 4.5 for all agent types

**Pros:**
- Best possible quality across all agents
- Single model to maintain
- No risk of Haiku missing edge cases

**Cons:**
- 5x higher cost ($150/month vs $30/month)
- 5x slower verification (minutes vs seconds)
- Overkill for deterministic tasks
- Unsustainable budget for personal project

**Why Rejected:** Verification runs 70% of total agent operations but only needs 30% of Sonnet's capability. Paying premium pricing for overkill capability wastes budget that could fund other features.

### Alternative 3: Haiku for Verification, Opus for Fix/Review (Maximum Fix Quality)

**Description:** Haiku for verification, Claude Opus 4.5 for fix and review agents

**Pros:**
- Best possible reasoning for complex tasks
- Cost savings on verification
- Highest quality learnings and fixes

**Cons:**
- Opus is even more expensive than Sonnet ($7.50/MTok vs $2.50/MTok)
- Minimal quality improvement over Sonnet for this use case
- Total cost still ~$60/month (2x mixed Haiku/Sonnet strategy)
- Opus overkill for most fix scenarios

**Why Rejected:** Sonnet 4.5 is already highly capable for code fixes and analysis. The incremental quality gain from Opus doesn't justify tripling the cost. If Sonnet proves insufficient, we can upgrade specific agents later.

### Alternative 4: Do Nothing (Manual Verification)

**Description:** Keep current manual verification workflow, no automated agents

**Pros:**
- Zero agent costs for verification
- No implementation effort
- User has complete control

**Cons:**
- User must manually check every PIV completion (hours per week)
- Quality gaps persist (bugs reach user)
- No systematic learning accumulation
- Defeats the purpose of autonomous quality workflows

**Why Rejected:** Manual verification is the problem this epic solves. Rejecting automation means rejecting the core value proposition.

## Implementation Plan

### Phase 1: Preparation
1. [x] Define agent model requirements in epic
2. [ ] Add model configuration to agent spawner interface
3. [ ] Create cost tracking utilities (log token usage per model)

### Phase 2: Execution
1. [ ] Implement `VerificationSpawner` with Haiku configuration
2. [ ] Implement `FixAgentSpawner` with Sonnet configuration
3. [ ] Implement `SystemReviewSpawner` with Sonnet configuration
4. [ ] Add model selection to agent prompt templates

### Phase 3: Validation
1. [ ] Test Haiku accuracy on 20 real verification scenarios
2. [ ] Measure false positive/negative rates
3. [ ] Confirm latency improvements (target: <10 seconds per verification)
4. [ ] Monitor costs for first month (target: <$50/month)

### Rollback Plan

**If Haiku verification proves unreliable (>10% false positive rate):**
1. Update `VerificationSpawner` configuration to use Sonnet
2. Accept higher costs as necessary for quality
3. Document Haiku failure patterns for future reference

**Rollback Cost:** Configuration change only, no code refactoring needed

## Success Metrics

**Quantitative Metrics:**
- Verification latency: <10 seconds (90th percentile)
- Haiku false positive rate: <10%
- Haiku false negative rate: <5%
- Monthly cost: <$50 total for all agents
- Fix agent success rate: >50% on first attempt

**Qualitative Metrics:**
- User doesn't notice quality difference in verification vs fix/review agents
- Verification reports are accurate and actionable
- Cost savings enable adding more automated features

**Timeline:**
- Measure after: 4 weeks of production use
- Target: All metrics within acceptable ranges

## Review Date

**Next Review:** 2026-02-19 (4 weeks after implementation)

**Triggers for Earlier Review:**
- Haiku false positive rate exceeds 15% (quality issue)
- Monthly costs exceed $75 (budget issue)
- User reports verification unreliability (trust issue)
- Anthropic releases new Haiku/Sonnet versions (opportunity)

## References

- Epic: `/home/samuel/sv/.bmad/epics/006-automatic-quality-workflows-mvp.md`
- Claude Pricing: https://www.anthropic.com/pricing
- Haiku Capabilities: https://www.anthropic.com/claude/haiku
- Agent Spawning: `.claude/commands/automation/`

## Notes

### Model Selection Rationale Detail

**Verification Agent (Haiku):**
- Task: Run commands, parse output, pattern matching
- Example: "Does `npm run build` exit with code 0?"
- Reasoning Required: Minimal (parse exit code, read stdout/stderr)
- Token Volume: High (reads large codebases)
- Frequency: High (every PIV completion)
- **Conclusion:** Haiku's strength area

**Fix Agent (Sonnet):**
- Task: Understand error context, modify code, maintain contracts
- Example: "Test fails with 'undefined is not a function' - fix the implementation"
- Reasoning Required: High (understand codebase, infer missing imports, fix logic)
- Token Volume: Medium (focused on error context)
- Frequency: Medium (50% of verifications fail initially)
- **Conclusion:** Needs Sonnet reasoning

**System Review Agent (Sonnet):**
- Task: Compare plans to commits, identify patterns, extract learnings
- Example: "Epic planned 5 tasks but implemented 7 - why? What patterns emerge?"
- Reasoning Required: Very High (analytical, comparative, pattern recognition)
- Token Volume: High (reads entire epic history)
- Frequency: Low (once per epic, ~1-3x per week)
- **Conclusion:** Sonnet critical for quality learnings

### Lessons Learned (Post-Implementation)

[To be filled in after 4 weeks of production use]

- What worked well:
- What didn't work:
- What we'd do differently:

---

**Template Version:** 1.0
**Template Source:** BMAD-inspired ADR template for SCAR supervisor
