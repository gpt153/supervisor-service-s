# Epic 006-G: Test Orchestrator & Workflow Integration

**Epic ID:** 006-G
**Feature:** automatic-quality-workflows
**Created:** 2026-01-27
**Status:** Pending
**Complexity:** Medium (60-80 hours)
**Model:** Haiku for orchestration, Sonnet for decisions

---

## Rationale

**Problem:** All previous epics (006-A through 006-F) are independent components that don't work together. No unified workflow that: runs tests → collects evidence → detects red flags → verifies independently → fixes failures → learns from outcomes.

**Research Findings:**
- **Component integration is non-trivial**: Each component has different inputs/outputs
- **Workflow state management**: Must track progress through all stages
- **Error handling across boundaries**: Failure in one stage must propagate correctly
- **Coordination complexity**: Which agent runs when? What triggers what?
- **No holistic reporting**: User sees results from each component separately

**Solution:** Build a test orchestrator that:
1. **Coordinates all components** (evidence → detection → verification → fixing)
2. **Manages workflow state** (where are we? what's next?)
3. **Handles cross-component errors** (retry, escalate, report)
4. **Provides unified reporting** (single test result with all evidence)
5. **Integrates with PIV loop** (auto-trigger after epic completion)

**Why orchestration is critical:** Without orchestration, components are just code libraries. Orchestrator makes them an autonomous quality system.

---

## Acceptance Criteria

### AC1: Test Workflow Orchestration
- [ ] Stage 1: Test execution (UI or API executor based on test type)
- [ ] Stage 2: Evidence collection (integrated during execution)
- [ ] Stage 3: Red flag detection (analyze collected evidence)
- [ ] Stage 4: Independent verification (cross-validate with red flags)
- [ ] Stage 5: Fix attempt (if verification failed, use adaptive fix agent)
- [ ] Stage 6: Learning extraction (after success or final failure)
- [ ] Each stage tracks status (pending, in_progress, completed, failed)

### AC2: State Management
- [ ] Persist workflow state in database (survives restarts)
- [ ] Track current stage per test
- [ ] Store results from each stage
- [ ] Support parallel test execution (multiple workflows)
- [ ] Handle workflow pause/resume (for debugging)

### AC3: Error Handling & Retry Logic
- [ ] Retry evidence collection on failure (max 2 attempts)
- [ ] Retry verification on ambiguous results (confidence 60-79%)
- [ ] Delegate fix attempts to adaptive fix agent (max 3 retries)
- [ ] Escalate to user after all retries exhausted
- [ ] Generate handoff on unrecoverable failure

### AC4: PIV Loop Integration
- [ ] Detect PIV completion (PR created)
- [ ] Extract tests from epic plan
- [ ] Spawn test orchestrator for each test
- [ ] Report progress to PIV agent
- [ ] Update epic status after all tests complete

### AC5: Unified Test Reporting
- [ ] Aggregate results from all stages (execution, detection, verification, fixing)
- [ ] Generate plain language summary (what happened, what was found, what was fixed)
- [ ] Include evidence paths (screenshots, logs, diffs)
- [ ] Calculate test confidence score (0-100%)
- [ ] Provide actionable next steps (accept, review, fix manually)

### AC6: Performance Optimization
- [ ] Parallel test execution (independent tests run concurrently)
- [ ] Evidence caching (reuse artifacts across stages)
- [ ] Smart scheduling (prioritize critical tests)
- [ ] Timeout enforcement (no stage runs >10 minutes)
- [ ] Resource limits (max N concurrent tests)

---

## Files to Create/Modify

```
supervisor-service-s/src/
├── orchestration/
│   ├── TestOrchestrator.ts         # NEW - Main orchestrator
│   ├── WorkflowStateMachine.ts     # NEW - Manage workflow state transitions
│   ├── StageExecutor.ts            # NEW - Execute individual stages
│   ├── ErrorHandler.ts             # NEW - Handle cross-stage errors
│   ├── PIVIntegration.ts           # NEW - Integrate with PIV loop
│   └── UnifiedReporter.ts          # NEW - Generate consolidated reports

├── scheduling/
│   ├── TestScheduler.ts            # NEW - Schedule tests (parallel, priority)
│   ├── ResourceManager.ts          # NEW - Manage concurrency limits
│   └── TimeoutEnforcer.ts          # NEW - Enforce stage timeouts

├── db/
│   ├── migrations/
│   │   └── 014_workflow_state.sql  # NEW - Workflow state schema
│   └── queries/
│       └── workflow.ts              # NEW - Workflow CRUD

└── types/
    └── orchestration.ts             # NEW - Orchestration type definitions

.claude/commands/orchestration/
├── orchestrate-tests.md             # NEW - Test orchestration agent
└── report-test-results.md           # NEW - Result reporting agent

tests/integration/
└── test-orchestrator.test.ts        # NEW - Integration tests for orchestration
```

---

## Implementation Notes

### Workflow State Schema

```sql
CREATE TABLE test_workflows (
  id SERIAL PRIMARY KEY,
  test_id TEXT NOT NULL UNIQUE,
  epic_id TEXT NOT NULL,
  test_type TEXT NOT NULL, -- 'ui', 'api', 'unit', 'integration'

  -- Workflow state
  current_stage TEXT NOT NULL, -- 'execution', 'detection', 'verification', 'fixing', 'learning', 'completed', 'failed'
  status TEXT NOT NULL, -- 'pending', 'in_progress', 'completed', 'failed'

  -- Stage results (JSON)
  execution_result JSONB,
  detection_result JSONB,
  verification_result JSONB,
  fixing_result JSONB,
  learning_result JSONB,

  -- Timing
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_ms INTEGER,

  -- Metadata
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  escalated BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_workflow_test ON test_workflows(test_id);
CREATE INDEX idx_workflow_epic ON test_workflows(epic_id);
CREATE INDEX idx_workflow_status ON test_workflows(status);
```

### Orchestration Flow

```typescript
class TestOrchestrator {
  async orchestrate(testDefinition: TestDefinition): Promise<TestWorkflowResult> {
    // 1. Create workflow state
    const workflow = await this.workflowStateMachine.create(testDefinition.id, testDefinition.epic_id);

    try {
      // Stage 1: Test Execution
      workflow.transitionTo('execution');
      const executionResult = await this.stageExecutor.execute('execution', {
        testDefinition,
        executor: testDefinition.type === 'ui' ? this.uiTestExecutor : this.apiTestExecutor
      });
      workflow.storeResult('execution', executionResult);

      // Stage 2: Evidence Collection (happens during execution, verify completeness)
      workflow.transitionTo('detection');
      const evidence = await this.evidenceRetriever.get(testDefinition.id);
      if (!evidence) {
        throw new Error('Evidence collection failed');
      }

      // Stage 3: Red Flag Detection
      const detectionResult = await this.stageExecutor.execute('detection', {
        testId: testDefinition.id,
        evidence
      });
      workflow.storeResult('detection', detectionResult);

      // Stage 4: Independent Verification
      workflow.transitionTo('verification');
      const verificationResult = await this.stageExecutor.execute('verification', {
        testId: testDefinition.id,
        evidence,
        redFlags: detectionResult.redFlags
      });
      workflow.storeResult('verification', verificationResult);

      // Stage 5: Fix Attempt (if verification failed)
      if (!verificationResult.verified) {
        workflow.transitionTo('fixing');
        const fixingResult = await this.stageExecutor.execute('fixing', {
          testId: testDefinition.id,
          rca: verificationResult.concerns
        });
        workflow.storeResult('fixing', fixingResult);

        // Re-run verification after fix
        if (fixingResult.success) {
          const reVerification = await this.stageExecutor.execute('verification', {
            testId: testDefinition.id,
            evidence: await this.evidenceRetriever.get(testDefinition.id),
            redFlags: []
          });

          if (!reVerification.verified) {
            // Fix didn't work - escalate
            return await this.errorHandler.escalate(workflow, 'Fix applied but verification still failing');
          }
        } else {
          // Fix failed - escalate
          return await this.errorHandler.escalate(workflow, `Fix failed after ${fixingResult.retriesUsed} retries`);
        }
      }

      // Stage 6: Learning Extraction
      workflow.transitionTo('learning');
      const learningResult = await this.stageExecutor.execute('learning', {
        testId: testDefinition.id,
        executionResult,
        verificationResult,
        fixingResult: workflow.getStageResult('fixing')
      });
      workflow.storeResult('learning', learningResult);

      // Mark complete
      workflow.transitionTo('completed');
      workflow.complete();

      return {
        success: true,
        workflow,
        report: await this.unifiedReporter.generate(workflow)
      };
    } catch (error) {
      workflow.fail(error.message);
      return await this.errorHandler.handle(workflow, error);
    }
  }
}
```

### Workflow State Machine

```typescript
class WorkflowStateMachine {
  private validTransitions = {
    pending: ['execution'],
    execution: ['detection', 'failed'],
    detection: ['verification', 'failed'],
    verification: ['fixing', 'learning', 'failed'],
    fixing: ['verification', 'learning', 'failed'],
    learning: ['completed', 'failed'],
    completed: [],
    failed: []
  };

  async transitionTo(workflow: TestWorkflow, nextStage: string): Promise<void> {
    const currentStage = workflow.current_stage;

    // Validate transition
    if (!this.validTransitions[currentStage].includes(nextStage)) {
      throw new Error(`Invalid transition: ${currentStage} → ${nextStage}`);
    }

    // Update database
    await this.db.query(
      'UPDATE test_workflows SET current_stage = $1, status = $2 WHERE id = $3',
      [nextStage, 'in_progress', workflow.id]
    );

    workflow.current_stage = nextStage;
  }

  async storeResult(workflow: TestWorkflow, stage: string, result: any): Promise<void> {
    const columnName = `${stage}_result`;

    await this.db.query(
      `UPDATE test_workflows SET ${columnName} = $1 WHERE id = $2`,
      [JSON.stringify(result), workflow.id]
    );

    workflow[columnName] = result;
  }

  async complete(workflow: TestWorkflow): Promise<void> {
    const duration = Date.now() - workflow.started_at.getTime();

    await this.db.query(
      'UPDATE test_workflows SET status = $1, completed_at = NOW(), duration_ms = $2 WHERE id = $3',
      ['completed', duration, workflow.id]
    );
  }

  async fail(workflow: TestWorkflow, errorMessage: string): Promise<void> {
    await this.db.query(
      'UPDATE test_workflows SET status = $1, error_message = $2, completed_at = NOW() WHERE id = $3',
      ['failed', errorMessage, workflow.id]
    );
  }
}
```

### PIV Integration

```typescript
class PIVIntegration {
  async onPIVComplete(epicId: string, prUrl: string): Promise<void> {
    // 1. Load epic plan
    const epic = await this.epicLoader.load(epicId);

    // 2. Extract test definitions
    const tests = this.testExtractor.extract(epic);

    // 3. Schedule tests
    const workflows = [];
    for (const test of tests) {
      const workflow = await this.testOrchestrator.orchestrate(test);
      workflows.push(workflow);
    }

    // 4. Wait for all workflows to complete
    await Promise.all(workflows);

    // 5. Generate epic-level report
    const epicReport = await this.generateEpicReport(epicId, workflows);

    // 6. Update PR with results
    await this.githubAPI.commentOnPR(prUrl, epicReport);

    // 7. Update epic status
    const allPassed = workflows.every(w => w.success);
    if (allPassed) {
      await this.epicStatusUpdater.markComplete(epicId);
    } else {
      await this.epicStatusUpdater.markFailed(epicId, epicReport);
    }
  }
}
```

### Unified Reporting

```typescript
class UnifiedReporter {
  async generate(workflow: TestWorkflow): Promise<TestReport> {
    // Aggregate all stage results
    const executionResult = workflow.execution_result;
    const detectionResult = workflow.detection_result;
    const verificationResult = workflow.verification_result;
    const fixingResult = workflow.fixing_result;
    const learningResult = workflow.learning_result;

    // Generate plain language summary
    const summary = this.generateSummary(workflow);

    // Collect evidence paths
    const evidencePaths = {
      screenshots: executionResult.evidence.screenshots,
      logs: executionResult.evidence.logs,
      traces: executionResult.evidence.traces
    };

    // Calculate confidence
    const confidence = verificationResult.confidenceScore;

    // Determine recommendation
    const recommendation = this.determineRecommendation(
      verificationResult.verified,
      detectionResult.redFlags,
      confidence
    );

    return {
      testId: workflow.test_id,
      epicId: workflow.epic_id,
      passed: verificationResult.verified,
      confidence,
      summary,
      evidencePaths,
      redFlags: detectionResult.redFlags,
      fixesApplied: fixingResult?.retriesUsed || 0,
      learningsExtracted: learningResult?.learnings.length || 0,
      recommendation,
      duration: workflow.duration_ms
    };
  }

  private generateSummary(workflow: TestWorkflow): string {
    const verified = workflow.verification_result.verified;
    const redFlagCount = workflow.detection_result.redFlags.length;
    const fixAttempts = workflow.fixing_result?.retriesUsed || 0;

    if (verified && redFlagCount === 0) {
      return `✅ Test passed with high confidence. All evidence verified, no red flags detected.`;
    }

    if (verified && redFlagCount > 0) {
      return `⚠️ Test passed but ${redFlagCount} red flag(s) detected. Manual review recommended.`;
    }

    if (!verified && fixAttempts > 0) {
      return `❌ Test failed. Fix attempted ${fixAttempts} time(s) but verification still failing. Requires manual intervention.`;
    }

    return `❌ Test failed. ${redFlagCount} red flag(s) detected. See evidence for details.`;
  }

  private determineRecommendation(
    verified: boolean,
    redFlags: RedFlag[],
    confidence: number
  ): string {
    if (verified && redFlags.length === 0 && confidence >= 90) {
      return 'accept';
    }

    if (verified && (redFlags.length > 0 || confidence < 90)) {
      return 'manual_review';
    }

    return 'reject';
  }
}
```

---

## Model Selection

**Orchestration:** Haiku
- Workflow coordination is deterministic (state transitions, stage execution)
- No reasoning required, just follow workflow definition
- Fast execution critical for responsiveness

**Decision Making:** Sonnet
- Deciding when to escalate (complex judgment)
- Error handling strategies (retry, skip, escalate)
- Test prioritization (which tests are critical)

---

## Estimated Effort

- **TestOrchestrator**: 14 hours
- **WorkflowStateMachine**: 12 hours
- **StageExecutor**: 10 hours
- **ErrorHandler**: 12 hours
- **PIVIntegration**: 14 hours
- **UnifiedReporter**: 12 hours
- **TestScheduler (parallel execution)**: 10 hours
- **ResourceManager**: 8 hours
- **TimeoutEnforcer**: 8 hours
- **Unit tests**: 20 hours
- **Integration tests**: 20 hours

**Total: 140 hours (3.5 weeks)**

---

## Dependencies

**Blocked By:**
- Epic 006-A (Evidence Collection)
- Epic 006-B (Red Flag Detection)
- Epic 006-C (UI Test Executor)
- Epic 006-D (API Test Executor)
- Epic 006-E (Independent Verification)
- Epic 006-F (RCA & Fix Agent)

**Blocks:**
- Nothing (final integration epic)

---

## Testing Approach

### Unit Tests

**WorkflowStateMachine:**
- [ ] Valid state transitions (execution → detection → verification)
- [ ] Invalid transitions rejected (verification → execution)
- [ ] Store stage results (persist to database)
- [ ] Complete workflow (update status, duration)

**ErrorHandler:**
- [ ] Retry on transient failures (network errors)
- [ ] Escalate on persistent failures (3+ retries)
- [ ] Generate handoff documents
- [ ] Alert user on escalation

**UnifiedReporter:**
- [ ] Generate summary (passed with confidence)
- [ ] Aggregate evidence paths
- [ ] Calculate confidence score
- [ ] Determine recommendation (accept, review, reject)

### Integration Tests

**End-to-End Workflow:**
1. Create test definition (UI test)
2. Orchestrate full workflow
3. Verify execution stage runs
4. Verify evidence collected
5. Verify red flags detected
6. Verify independent verification runs
7. Verify unified report generated
8. Verify database state persisted

**PIV Integration:**
1. Simulate PIV completion
2. Extract tests from epic
3. Orchestrate all tests in parallel
4. Verify epic-level report generated
5. Verify PR updated with results
6. Verify epic status updated

**Error Handling:**
1. Inject failure in verification stage
2. Verify fix agent spawned
3. Verify retry logic works
4. Verify escalation after 3 retries
5. Verify handoff created

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Workflow deadlock** | Tests stuck | Timeout enforcement, deadlock detection, manual override |
| **Database corruption** | Lost workflow state | Atomic transactions, backup before state changes |
| **Component version mismatch** | Integration breaks | Version compatibility checks, integration tests |
| **Performance degradation** | Slow test cycles | Parallel execution, caching, resource limits |

---

## Success Metrics

- **Workflow completion rate**: 98% (complete without deadlock/crash)
- **End-to-end latency**: <5 minutes per test (excluding long-running tests)
- **Parallel execution**: 5x speedup for 10+ independent tests
- **Error handling**: 100% of failures escalated or fixed
- **Reporting accuracy**: 95% of reports match user's manual assessment

---

**Next Steps After Completion:**
1. Deploy to production
2. Monitor workflow performance and error rates
3. Tune timeout values and retry limits based on production data
4. Build workflow visualization dashboard

---

**References:**
- All previous epics (006-A through 006-F)
- PIV loop integration guide
- Workflow orchestration patterns
