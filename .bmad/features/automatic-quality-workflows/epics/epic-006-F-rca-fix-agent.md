# Epic 006-F: RCA & Fix Agent with Adaptive Iteration

**Epic ID:** 006-F
**Feature:** automatic-quality-workflows
**Created:** 2026-01-27
**Status:** Pending
**Complexity:** High (80-100 hours)
**Model:** Opus for RCA, Sonnet for fixes, Haiku for verification

---

## Rationale

**Problem:** Current fix agents try random solutions without understanding root causes. Research shows agents waste retries on superficial fixes that don't address underlying issues. No systematic approach to diagnosing failures or choosing fix strategies.

**Research Findings:**
- **No root cause analysis**: Agents see "test failed" and try obvious fix without diagnosing WHY
- **Retry waste**: 3 retries spent on surface fixes (typos, imports) while root cause (architecture) ignored
- **No learning between retries**: Each retry starts fresh, doesn't learn from previous attempts
- **Fixed cost per retry**: Haiku can't fix complex issues, but Sonnet too expensive for simple ones
- **No escalation strategy**: Burn all retries before asking for help

**Solution:** Build an RCA & Fix agent that:
1. **Diagnoses root cause** before attempting fixes (Opus analysis)
2. **Classifies failure complexity** (simple, moderate, complex)
3. **Adapts model per retry** (3-5-7 pattern: Haiku → Sonnet → Opus)
4. **Learns from previous attempts** (don't repeat failed fixes)
5. **Escalates smartly** (stop if root cause requires human decision)

**Why adaptive iteration:** Simple fixes (typos, imports) are 70% of failures but only need Haiku. Complex fixes (architecture, logic) are 20% but need Opus. Current system wastes Sonnet on everything.

---

## Acceptance Criteria

### AC1: Root Cause Analysis (Opus)
- [ ] Analyze evidence artifacts (screenshots, logs, errors)
- [ ] Identify failure category (syntax, logic, integration, environment)
- [ ] Determine root cause (specific issue, not just symptom)
- [ ] Classify complexity (simple, moderate, complex)
- [ ] Estimate fix difficulty (1-3 retries, requires human)
- [ ] Generate RCA report (plain language, technical details)

### AC2: Adaptive Model Selection (3-5-7 Pattern)
- [ ] **Retry 1**: Haiku (fast, cheap) for simple fixes
- [ ] **Retry 2**: Sonnet (balanced) if Haiku failed or moderate complexity
- [ ] **Retry 3**: Opus (powerful) if Sonnet failed or complex issue
- [ ] **After 3**: Escalate to human (architecture, business logic, ambiguity)
- [ ] Cost tracking per retry (optimize spend)

### AC3: Fix Strategy Selection
- [ ] Match root cause to fix strategy (syntax → typo fix, logic → refactor)
- [ ] Avoid repeating failed strategies (track what was tried)
- [ ] Prioritize non-invasive fixes (imports before architecture changes)
- [ ] Consider side effects (will fix break other tests?)
- [ ] Generate fix plan before executing (explicit steps)

### AC4: Learning Between Retries
- [ ] Store previous fix attempts (strategy, changes made, outcome)
- [ ] Analyze why previous fix failed (wrong diagnosis, incomplete fix)
- [ ] Incorporate learnings into next retry (don't repeat mistakes)
- [ ] Build knowledge graph of failure patterns (this error → likely this fix)
- [ ] Share learnings across tests (if failure seen before, use known fix)

### AC5: Smart Escalation
- [ ] Stop if root cause is architectural (requires design decision)
- [ ] Stop if root cause is business logic (requires domain knowledge)
- [ ] Stop if ambiguous (can't determine root cause with confidence)
- [ ] Generate handoff document (what was tried, what's needed)
- [ ] Include evidence (all artifacts, RCA, attempted fixes)

### AC6: Fix Execution & Verification
- [ ] Apply fix with atomic commits (rollback if verification fails)
- [ ] Re-run test after fix (using test executors from Epic 006-C/D)
- [ ] Verify fix with independent verification (Epic 006-E)
- [ ] If still failing: Increment retry count, run RCA again
- [ ] If passed: Mark as fixed, store learning

---

## Files to Create/Modify

```
supervisor-service-s/src/
├── rca/
│   ├── RootCauseAnalyzer.ts        # NEW - Analyze failures for root cause
│   ├── FailureClassifier.ts        # NEW - Classify failure type & complexity
│   ├── ModelSelector.ts            # NEW - Select model based on complexity (3-5-7)
│   ├── FixStrategySelector.ts      # NEW - Choose fix strategy from RCA
│   └── RCAReporter.ts              # NEW - Generate RCA reports

├── fixing/
│   ├── AdaptiveFixAgent.ts         # NEW - Orchestrate adaptive iteration
│   ├── RetryManager.ts             # NEW - Track retries, costs, learnings
│   ├── FixExecutor.ts              # NEW - Apply fixes atomically
│   ├── VerificationLoop.ts         # NEW - Re-test after fix
│   └── EscalationHandler.ts        # NEW - Generate handoffs, alert user

├── learning/
│   ├── FixLearningStore.ts         # NEW - Store what fixes work for what failures
│   ├── FailurePatternMatcher.ts    # NEW - Match current failure to known patterns
│   └── KnowledgeGraphBuilder.ts    # NEW - Build failure → fix knowledge graph

├── db/
│   ├── migrations/
│   │   └── 013_rca_fixes.sql       # NEW - RCA & fix schema
│   └── queries/
│       ├── rca.ts                   # NEW - RCA CRUD
│       └── fix-learnings.ts         # NEW - Fix learning CRUD

└── types/
    ├── rca.ts                       # NEW - RCA type definitions
    └── fixing.ts                    # NEW - Fix type definitions

.claude/commands/subagents/fixing/
├── analyze-root-cause.md            # NEW - RCA agent (Opus)
├── fix-simple.md                    # NEW - Simple fix agent (Haiku)
├── fix-moderate.md                  # NEW - Moderate fix agent (Sonnet)
└── fix-complex.md                   # NEW - Complex fix agent (Opus)

tests/unit/
└── adaptive-fix-agent.test.ts       # NEW - Unit tests for RCA & fixing
```

---

## Implementation Notes

### RCA & Fix Schema

```sql
CREATE TABLE root_cause_analyses (
  id SERIAL PRIMARY KEY,
  test_id TEXT NOT NULL,
  epic_id TEXT NOT NULL,
  evidence_id INTEGER REFERENCES evidence_artifacts(id),

  -- RCA
  failure_category TEXT NOT NULL, -- 'syntax', 'logic', 'integration', 'environment'
  root_cause TEXT NOT NULL, -- Plain language root cause
  complexity TEXT NOT NULL, -- 'simple', 'moderate', 'complex', 'requires_human'
  estimated_fix_difficulty INTEGER, -- 1-3 retries

  -- Analysis
  symptoms TEXT[], -- List of observed symptoms
  diagnosis_reasoning TEXT, -- How we determined root cause
  recommended_strategy TEXT, -- Which fix strategy to try

  analyzed_at TIMESTAMP DEFAULT NOW(),
  analyzer_model TEXT -- 'opus', 'sonnet'
);

CREATE TABLE fix_attempts (
  id SERIAL PRIMARY KEY,
  test_id TEXT NOT NULL,
  rca_id INTEGER REFERENCES root_cause_analyses(id),

  -- Retry info
  retry_number INTEGER NOT NULL, -- 1, 2, 3
  model_used TEXT NOT NULL, -- 'haiku', 'sonnet', 'opus'

  -- Fix details
  fix_strategy TEXT NOT NULL, -- 'typo_correction', 'import_fix', 'refactor', etc.
  changes_made TEXT NOT NULL, -- Git diff or description
  commit_sha TEXT, -- If changes committed

  -- Outcome
  success BOOLEAN NOT NULL,
  verification_passed BOOLEAN,
  error_message TEXT,

  -- Cost tracking
  cost_usd DECIMAL(10, 6),
  tokens_used INTEGER,

  attempted_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE fix_learnings (
  id SERIAL PRIMARY KEY,
  failure_pattern TEXT NOT NULL, -- 'ModuleNotFoundError: boto3'
  fix_strategy TEXT NOT NULL, -- 'add_dependency'
  success_rate DECIMAL(5, 2), -- 0.95 = 95% success rate
  times_tried INTEGER DEFAULT 1,
  times_succeeded INTEGER DEFAULT 0,

  -- Pattern matching
  error_regex TEXT, -- Regex to match this error
  file_pattern TEXT, -- Which files this applies to
  complexity TEXT, -- 'simple', 'moderate', 'complex'

  created_at TIMESTAMP DEFAULT NOW(),
  last_used TIMESTAMP
);

CREATE INDEX idx_rca_test ON root_cause_analyses(test_id);
CREATE INDEX idx_fix_attempts_test ON fix_attempts(test_id);
CREATE INDEX idx_fix_learnings_pattern ON fix_learnings(failure_pattern);
```

### Adaptive Fix Flow (3-5-7 Pattern)

```typescript
class AdaptiveFixAgent {
  async fixTest(testId: string): Promise<FixResult> {
    const maxRetries = 3;
    const retryManager = new RetryManager(testId);

    // 1. Run RCA (Opus - most accurate diagnosis)
    const rca = await this.rootCauseAnalyzer.analyze(testId, 'opus');

    // 2. Check if human required
    if (rca.complexity === 'requires_human') {
      return await this.escalationHandler.escalate(testId, rca, 'Root cause requires human decision');
    }

    // 3. Adaptive iteration (3-5-7 pattern)
    for (let retry = 1; retry <= maxRetries; retry++) {
      // Select model based on retry number and complexity
      const model = this.modelSelector.select(retry, rca.complexity);
      // retry 1: haiku (for simple), sonnet (for moderate), opus (for complex)
      // retry 2: sonnet (if haiku failed), opus (if sonnet failed)
      // retry 3: opus (last resort)

      // Check previous attempts (don't repeat failed strategies)
      const previousAttempts = await retryManager.getPreviousAttempts();
      const failedStrategies = previousAttempts.map(a => a.fix_strategy);

      // Select fix strategy (avoid failed ones)
      const strategy = await this.fixStrategySelector.select(
        rca,
        failedStrategies,
        model
      );

      // Execute fix
      const fixResult = await this.fixExecutor.execute(testId, strategy, model);
      await retryManager.recordAttempt(retry, model, strategy, fixResult);

      // Verify fix
      const verificationPassed = await this.verificationLoop.verify(testId);

      if (verificationPassed) {
        // Success! Store learning
        await this.fixLearningStore.record(rca.failure_pattern, strategy, true);
        return { success: true, retriesUsed: retry, fixStrategy: strategy };
      }

      // Failed - analyze why
      if (retry < maxRetries) {
        // Re-run RCA to understand why fix didn't work
        const updatedRCA = await this.rootCauseAnalyzer.analyze(testId, 'sonnet', previousAttempts);
        // Use updated understanding for next retry
      } else {
        // All retries exhausted - escalate
        return await this.escalationHandler.escalate(testId, rca, `Failed after ${maxRetries} retries`);
      }
    }
  }
}
```

### Model Selection Strategy (3-5-7)

```typescript
class ModelSelector {
  select(retryNumber: number, complexity: string): 'haiku' | 'sonnet' | 'opus' {
    // Complexity determines starting point
    if (complexity === 'simple') {
      if (retryNumber === 1) return 'haiku'; // Fast, cheap
      if (retryNumber === 2) return 'sonnet'; // Haiku failed, escalate
      return 'opus'; // Last resort
    }

    if (complexity === 'moderate') {
      if (retryNumber === 1) return 'sonnet'; // Skip haiku
      return 'opus'; // Need power
    }

    if (complexity === 'complex') {
      return 'opus'; // Always use most powerful
    }

    throw new Error(`Unknown complexity: ${complexity}`);
  }
}
```

### Fix Strategy Selection

```typescript
class FixStrategySelector {
  async select(
    rca: RootCauseAnalysis,
    failedStrategies: string[],
    model: string
  ): Promise<FixStrategy> {
    // 1. Check if we've seen this failure before
    const knownFix = await this.failurePatternMatcher.match(rca.failure_pattern);
    if (knownFix && knownFix.success_rate > 0.7 && !failedStrategies.includes(knownFix.fix_strategy)) {
      // Use known successful fix
      return knownFix.fix_strategy;
    }

    // 2. Select based on failure category
    const strategies = this.getStrategiesForCategory(rca.failure_category);

    // 3. Filter out failed strategies
    const availableStrategies = strategies.filter(
      s => !failedStrategies.includes(s)
    );

    if (availableStrategies.length === 0) {
      throw new Error('No more strategies to try');
    }

    // 4. Prioritize by model capability
    return this.prioritizeByModel(availableStrategies, model);
  }

  private getStrategiesForCategory(category: string): string[] {
    const strategies = {
      syntax: ['typo_correction', 'syntax_fix', 'formatting'],
      logic: ['refactor', 'algorithm_fix', 'condition_fix'],
      integration: ['import_fix', 'dependency_add', 'api_update'],
      environment: ['env_var_add', 'config_fix', 'permission_fix']
    };

    return strategies[category] || [];
  }
}
```

### Learning Between Retries

```typescript
class FixLearningStore {
  async record(failurePattern: string, fixStrategy: string, success: boolean) {
    // Find or create learning record
    let learning = await this.db.query(
      'SELECT * FROM fix_learnings WHERE failure_pattern = $1 AND fix_strategy = $2',
      [failurePattern, fixStrategy]
    );

    if (!learning) {
      learning = await this.db.query(
        'INSERT INTO fix_learnings (failure_pattern, fix_strategy, times_tried, times_succeeded) VALUES ($1, $2, 0, 0) RETURNING *',
        [failurePattern, fixStrategy]
      );
    }

    // Update statistics
    await this.db.query(
      'UPDATE fix_learnings SET times_tried = times_tried + 1, times_succeeded = times_succeeded + $1, success_rate = times_succeeded::decimal / times_tried, last_used = NOW() WHERE id = $2',
      [success ? 1 : 0, learning.id]
    );
  }

  async getBestStrategy(failurePattern: string): Promise<FixStrategy | null> {
    const result = await this.db.query(
      'SELECT * FROM fix_learnings WHERE failure_pattern = $1 ORDER BY success_rate DESC, times_tried DESC LIMIT 1',
      [failurePattern]
    );

    return result.rows[0] || null;
  }
}
```

---

## Model Selection

**RCA:** Opus (REQUIRED)
- Root cause analysis requires deep reasoning
- Must understand complex interactions (code + environment + dependencies)
- Mistakes in RCA waste all retries
- Cost: ~$0.50 per RCA (worth it to avoid wasted retries)

**Fixes:** Adaptive (3-5-7 pattern)
- **Retry 1**: Haiku (70% of issues are simple: typos, imports, formatting)
- **Retry 2**: Sonnet (if Haiku failed or moderate complexity)
- **Retry 3**: Opus (if Sonnet failed or complex logic/architecture)

**Cost optimization:**
- Current system: 3 retries × Sonnet = 3 × $0.15 = $0.45
- Adaptive system: Haiku ($0.01) + Sonnet ($0.15) + Opus ($0.50) = $0.66 (IF all 3 needed)
- But 70% fix on retry 1 (Haiku) = $0.01 average
- Overall: ~80% cost reduction

---

## Estimated Effort

- **RootCauseAnalyzer (Opus integration)**: 16 hours
- **FailureClassifier**: 12 hours
- **ModelSelector (3-5-7 logic)**: 8 hours
- **FixStrategySelector**: 14 hours
- **AdaptiveFixAgent orchestrator**: 14 hours
- **RetryManager**: 10 hours
- **FixExecutor (atomic commits)**: 12 hours
- **VerificationLoop integration**: 8 hours
- **EscalationHandler**: 10 hours
- **FixLearningStore**: 12 hours
- **FailurePatternMatcher**: 12 hours
- **KnowledgeGraphBuilder**: 14 hours
- **Unit tests**: 24 hours
- **Integration tests**: 20 hours

**Total: 186 hours (4.5 weeks)**

---

## Dependencies

**Blocked By:**
- Epic 006-C (UI Test Executor - re-run tests after fix)
- Epic 006-D (API Test Executor - re-run tests after fix)
- Epic 006-E (Independent Verification - verify fixes)

**Blocks:**
- Epic 006-G (Test Orchestrator - uses adaptive fix agent)

---

## Testing Approach

### Unit Tests

**RootCauseAnalyzer:**
- [ ] Analyze syntax errors (typo, missing semicolon)
- [ ] Analyze logic errors (wrong condition, off-by-one)
- [ ] Analyze integration errors (import not found, API changed)
- [ ] Analyze environment errors (env var missing, permission denied)
- [ ] Classify complexity correctly

**ModelSelector:**
- [ ] Select haiku for simple + retry 1
- [ ] Select sonnet for moderate + retry 1
- [ ] Select opus for complex + retry 1
- [ ] Escalate from haiku → sonnet → opus

**FixStrategySelector:**
- [ ] Match known failure pattern (use known fix)
- [ ] Avoid failed strategies (don't repeat)
- [ ] Prioritize by category (syntax → typo fix)

**RetryManager:**
- [ ] Track retry count (1, 2, 3)
- [ ] Record attempts (strategy, outcome)
- [ ] Calculate total cost (sum all retries)

### Integration Tests

**End-to-End Adaptive Fix:**
1. Create failing test (syntax error)
2. Run AdaptiveFixAgent
3. Verify RCA runs (Opus)
4. Verify haiku attempts fix (retry 1)
5. Verify fix applied
6. Verify test re-run
7. Verify independent verification
8. Verify success recorded in learnings

**Escalation After 3 Retries:**
1. Create failing test (requires architecture change)
2. Run AdaptiveFixAgent
3. Verify RCA classifies as 'requires_human'
4. Verify immediate escalation (no retries)
5. Verify handoff document created

**Learning Reuse:**
1. Create failing test (known pattern)
2. Run AdaptiveFixAgent
3. Verify known fix strategy used
4. Verify success
5. Create identical failure in different test
6. Verify same fix strategy used immediately

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| **RCA mistakes** | Waste all retries on wrong fix | Use Opus (most accurate), validate diagnosis before fixing |
| **Cost overruns** | Expensive to run Opus 3x | Adaptive model selection, learn from past fixes, escalate early |
| **Fix breaks other tests** | Introduce regressions | Run full test suite after fix, atomic commits with rollback |
| **Infinite loop** (fix → fail → fix) | Never escalate | Hard limit 3 retries, detect repeated failures, escalate |

---

## Success Metrics

- **First-retry success rate**: 70% (most issues fixed by Haiku on retry 1)
- **Total fix success rate**: 85% (fixed within 3 retries)
- **Average cost per fix**: <$0.05 (vs $0.45 current)
- **Escalation rate**: 10-15% (only truly complex issues)
- **Learning reuse rate**: 40% (known patterns reuse successful fixes)

---

**Next Steps After Completion:**
1. Integrate with test orchestrator (Epic 006-G)
2. Build knowledge graph visualization dashboard
3. Tune complexity classification based on production data

---

**References:**
- Research on LLM retry strategies and cost optimization
- Test executors (Epic 006-C, 006-D) for re-running tests
- Independent verification (Epic 006-E) for validating fixes
