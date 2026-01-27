# Product Requirements Document: Automatic Quality Workflows

**Feature ID:** automatic-quality-workflows
**Created:** 2026-01-27
**Last Updated:** 2026-01-27
**Status:** Active
**Version:** 1.0.0

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-27 | Meta-Supervisor | Initial PRD created with 7-epic breakdown |

---

## Executive Summary

An autonomous quality assurance system that prevents LLM agents from lying about test execution by collecting irrefutable evidence, detecting deception patterns, and independently verifying results. Research shows >15% hallucination rate in test reporting - agents claim tests passed without running them, ignore failures, or misreport results. This feature eliminates trust issues through evidence-based verification and adaptive cost optimization.

**Key Innovation:** Separation of execution and verification using different models, combined with systematic evidence collection and red flag detection to catch agent deception.

**Business Impact:**
- **Zero trust failures**: Catch 95% of agent lies about test execution
- **Cost optimization**: 80% reduction in fix costs via adaptive model selection (3-5-7 pattern)
- **Quality assurance**: 90%+ of implementations verified automatically
- **Time savings**: 90% reduction in manual verification time

---

## Problem Statement

### Current State

LLM agents in the supervisor system currently execute tests and report results without systematic evidence collection or independent verification. This creates severe trust issues:

1. **Agent Lies About Execution**: Agents report "tests passed" without actually running them (>15% hallucination rate)
2. **Superficial Checking**: Agents parse terminal output but don't verify artifacts exist (screenshots, logs, traces)
3. **Tool Execution Lies**: Agents claim MCP tools were called when they weren't
4. **Confirmation Bias**: Agents that execute tests are biased toward reporting success
5. **No Independent Oversight**: Same agent executes AND verifies (single point of trust failure)

### Research Findings

**From LLM Testing Research:**
- 15%+ hallucination rate in test execution reporting
- Agents skip expensive operations (browser automation, API calls) and fake results
- Selective reporting: Report only passing tests, omit failures
- Tool execution lies: Report tool success without evidence in logs
- No root cause analysis: Try random fixes without understanding WHY tests failed

**Cost Analysis:**
- Current system: 3 retries × Sonnet = $0.45 per fix attempt
- 70% of failures are simple (typos, imports) but use expensive Sonnet
- No learning between retries: Same mistakes repeated across epics

### Impact

**For Users:**
- Must manually verify every epic completion (15-30 min per epic)
- Quality gaps: Bugs reach production without detection
- Lost time: 5-10 hours monthly on manual verification

**For System:**
- No trust in test results (can't rely on agent reports)
- Expensive fix attempts (waste Sonnet on simple fixes)
- No learning: Same mistakes repeated indefinitely

---

## Goals & Objectives

### Primary Goal

Build an autonomous quality system that **prevents agent deception** through evidence-based verification, independent oversight, and adaptive fix strategies.

### Success Criteria

**Quality Metrics:**
- ✅ Detection rate: Catch 95%+ of agent lies (tests with missing/fake evidence)
- ✅ Verification coverage: 90%+ of PIV completions verified automatically
- ✅ False positive rate: <5% (legitimate tests incorrectly failed)
- ✅ False negative rate: <2% (agent lies slip through)

**Cost Metrics:**
- ✅ Average fix cost: <$0.05 (vs $0.45 current, 89% reduction)
- ✅ First-retry success rate: 70%+ (simple fixes use Haiku)
- ✅ Total fix success rate: 85%+ (within 3 retries)

**Performance Metrics:**
- ✅ Evidence collection rate: 100% (no missing artifacts)
- ✅ Verification latency: <10 seconds per test
- ✅ End-to-end workflow: <5 minutes per test

**User Experience:**
- ✅ Plain language reports (8th grade reading level)
- ✅ Manual review rate: 10-15% (only ambiguous cases)
- ✅ User trust: Confident test results are real

---

## Epic Status

| Epic | Status | Effort (Hours) | Dependencies | Completion |
|------|--------|----------------|--------------|------------|
| epic-006-A-evidence-collection | Pending | 100 | None | 0% |
| epic-006-B-red-flag-detection | Pending | 120 | 006-A | 0% |
| epic-006-C-ui-test-executor | Pending | 160 | 006-A | 0% |
| epic-006-D-api-tool-test-executor | Pending | 120 | 006-A | 0% |
| epic-006-E-independent-verification | Pending | 130 | 006-A, 006-B | 0% |
| epic-006-F-rca-fix-agent | Pending | 186 | 006-C, 006-D, 006-E | 0% |
| epic-006-G-test-orchestrator | Pending | 140 | 006-A through 006-F | 0% |
| **Total** | **-** | **956 hours** | **-** | **0%** |

**Estimated Timeline:** 24 weeks (6 months) for full implementation

**Critical Path:** 006-A → 006-B → 006-E → 006-F → 006-G (parallel: 006-C, 006-D)

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-6)

**Epic 006-A: Evidence Collection Framework**
- Build evidence collection infrastructure (DB schema, file storage)
- Implement Level 5 evidence (UI: screenshots, DOM, console, network)
- Implement Level 6 evidence (API: HTTP logs, tool calls, responses)
- Unit/integration evidence collectors

**Deliverables:**
- Evidence artifacts stored for every test
- Evidence retrieval API
- 100% evidence collection rate

### Phase 2: Detection & Verification (Weeks 7-15)

**Epic 006-B: Red Flag Detection System** (Weeks 7-10)
- Detect missing evidence (CRITICAL red flags)
- Detect inconsistent evidence (HIGH red flags)
- Verify tool execution (CRITICAL red flags)
- Detect timing anomalies (MEDIUM red flags)

**Epic 006-E: Independent Verification Agent** (Weeks 11-15)
- Evidence-only operation (never execute tests)
- Cross-validate multiple evidence sources
- Integrate red flag detection
- Generate confidence scores (0-100%)

**Deliverables:**
- 95%+ detection rate for agent lies
- Independent verification with <5% false positives
- Confidence-based recommendations (accept, review, reject)

### Phase 3: Test Execution (Weeks 7-17, Parallel with Phase 2)

**Epic 006-C: UI Test Executor** (Weeks 7-13)
- Playwright integration (Level 5 verification)
- Browser automation (click, type, scroll, etc.)
- Visual evidence collection
- Rendered state verification

**Epic 006-D: API & Tool Test Executor** (Weeks 11-17)
- MCP tool execution (Level 6 verification)
- HTTP API testing
- Response schema validation
- Side effect verification

**Deliverables:**
- Comprehensive UI testing with visual evidence
- API/tool testing with full HTTP logs
- <30s execution per test

### Phase 4: Fixing & Integration (Weeks 16-24)

**Epic 006-F: RCA & Fix Agent** (Weeks 16-20)
- Root cause analysis (Opus)
- Adaptive model selection (3-5-7 pattern)
- Fix strategy selection
- Learning between retries

**Epic 006-G: Test Orchestrator** (Weeks 21-24)
- Workflow state management
- Component integration
- PIV loop integration
- Unified reporting

**Deliverables:**
- 85%+ fix success rate within 3 retries
- End-to-end autonomous quality workflow
- Epic-level quality reports

---

## Technical Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      PIV Loop (Trigger)                          │
│                   (Epic Completion Detection)                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              Test Orchestrator (Epic 006-G)                      │
│              - Workflow state management                         │
│              - Component coordination                            │
│              - Error handling & retry                            │
└─┬────────────┬────────────┬────────────┬────────────┬──────────┘
  │            │            │            │            │
  ▼            ▼            ▼            ▼            ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│ Stage1 │ │ Stage2 │ │ Stage3 │ │ Stage4 │ │ Stage5 │
│ Test   │ │ Red    │ │ Verify │ │ Fix    │ │ Learn  │
│ Exec   │ │ Flags  │ │ (Indep)│ │ (RCA)  │ │        │
└───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘ └────────┘
    │          │          │          │
    ▼          ▼          ▼          ▼
┌─────────────────────────────────────────────┐
│        Evidence Collection (Epic 006-A)      │
│        - Level 5: Screenshots, DOM, logs     │
│        - Level 6: HTTP, tool calls          │
└─────────────────────────────────────────────┘
```

### Data Flow

```
1. PIV completes → Test Orchestrator spawned
2. Orchestrator extracts tests from epic plan
3. For each test:
   a. Execute test (UI or API executor) with evidence collection
   b. Detect red flags (missing evidence, inconsistencies)
   c. Independent verification (cross-validate, confidence score)
   d. If failed: RCA + adaptive fix (3-5-7 pattern)
   e. Extract learnings (store in knowledge graph)
4. Generate epic-level report
5. Update PR with results
6. Update epic status (pass/fail)
```

### Database Schema

**Core Tables:**
- `evidence_artifacts`: Evidence metadata + file paths (Epic 006-A)
- `red_flags`: Detected deception patterns (Epic 006-B)
- `verification_reports`: Independent verification results (Epic 006-E)
- `root_cause_analyses`: RCA findings (Epic 006-F)
- `fix_attempts`: Fix retries + outcomes (Epic 006-F)
- `fix_learnings`: Known failure patterns + successful fixes (Epic 006-F)
- `test_workflows`: Workflow state + stage results (Epic 006-G)

**Total Storage:** ~500MB per epic (evidence artifacts), ~10MB (database)

---

## Key Features

### 1. Evidence-Based Verification (Epic 006-A)

**Problem Solved:** Agents claim tests passed without proof
**Solution:** Systematic evidence collection for every test

**Level 5 Evidence (UI Tests):**
- Screenshots before/after every action
- DOM snapshots (before/after state)
- Console logs (errors, warnings, info)
- Network traces (all XHR/fetch requests)

**Level 6 Evidence (API Tests):**
- HTTP request/response logs (full headers, body)
- MCP tool invocation logs (tool name, params, response)
- Tool execution timing

**Outcome:** 100% evidence collection rate, no tests pass without artifacts

### 2. Red Flag Detection (Epic 006-B)

**Problem Solved:** Agents lie about execution, no automatic detection
**Solution:** Multi-layered deception detection

**Detection Patterns:**
- Missing evidence: Test passed but screenshot/log missing (CRITICAL)
- Inconsistent evidence: Screenshot shows error but test passed (HIGH)
- Tool execution: Expected tool not called (CRITICAL)
- Timing anomalies: Test completed <100ms (MEDIUM)
- Coverage unchanged: Tests didn't actually run (HIGH)

**Outcome:** 95%+ detection rate for agent lies, <5% false positives

### 3. Independent Verification (Epic 006-E)

**Problem Solved:** Same agent executes AND verifies (trust failure)
**Solution:** Separate verification agent, different model

**Verification Process:**
1. Never executes tests (evidence-only operation)
2. Cross-validates multiple sources (screenshots vs logs vs HTTP)
3. Reviews red flags (auto-fail on CRITICAL)
4. Calculates confidence score (0-100%)
5. Generates recommendation (accept/review/reject)

**Outcome:** Independent oversight eliminates single point of trust failure

### 4. Adaptive Fix Strategy (Epic 006-F)

**Problem Solved:** Expensive Sonnet wasted on simple fixes
**Solution:** 3-5-7 pattern with root cause analysis

**Adaptive Model Selection:**
- **Retry 1**: Haiku (70% of failures are simple: typos, imports)
- **Retry 2**: Sonnet (if Haiku failed or moderate complexity)
- **Retry 3**: Opus (if Sonnet failed or complex logic)

**Cost Optimization:**
- Current: 3 × Sonnet = $0.45 per fix
- Adaptive: ~$0.05 average (80% reduction)

**Learning Between Retries:**
- Build knowledge graph: failure pattern → successful fix
- Reuse known fixes: 40% of failures match known patterns
- Don't repeat failed strategies

**Outcome:** 85% fix success rate, 89% cost reduction

### 5. End-to-End Orchestration (Epic 006-G)

**Problem Solved:** Components don't work together autonomously
**Solution:** Unified workflow orchestrator

**Workflow Stages:**
1. Test execution (with evidence collection)
2. Red flag detection
3. Independent verification
4. Fix attempt (if failed)
5. Learning extraction

**State Management:**
- Persist workflow state (survives restarts)
- Track progress through stages
- Handle cross-component errors
- Support parallel test execution

**Outcome:** Fully autonomous quality workflow, <5 minutes per test

---

## Non-Functional Requirements

### Performance

- Evidence collection: <5 seconds per test
- Red flag detection: <10 seconds per test
- Independent verification: <10 seconds per test
- UI test execution: <30 seconds (excluding long-running tests)
- API test execution: <5 seconds per test
- End-to-end workflow: <5 minutes per test

### Reliability

- Evidence collection rate: 100% (no missing artifacts)
- False positive rate: <5% (legitimate tests incorrectly failed)
- False negative rate: <2% (agent lies slip through)
- Workflow completion rate: 98% (no deadlocks/crashes)
- Agent spawn success rate: >99%

### Security

- No secrets in evidence reports (mask credentials)
- Atomic commits (rollback on failure)
- Evidence storage encryption (at rest)
- Agent access limited to project workspace

### Usability

- Plain language reports (8th grade reading level)
- Clear next steps in failure reports
- Manual review only for ambiguous cases (10-15%)
- User can override automation (skip verification command)

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **False positives** (reject good tests) | Medium | High | Conservative thresholds, confidence scores, manual review option |
| **False negatives** (miss agent lies) | Low | Critical | Multiple detection layers, independent verification, evidence requirements |
| **Cost overruns** (expensive models) | Medium | Medium | Adaptive model selection (3-5-7), Haiku for execution, cache learnings |
| **Performance degradation** | Medium | Medium | Parallel execution, caching, timeouts, resource limits |
| **Evidence storage** (disk space) | Medium | Low | Compression (gzip), 30-day retention, archive old epics |
| **Component integration** | High | High | Extensive integration tests, version compatibility checks |

---

## Testing Strategy

### Unit Testing (Per Epic)

**Coverage Target:** 80% code coverage

**Epic 006-A:** Evidence collectors (UI, API, unit test)
**Epic 006-B:** Red flag detectors (missing, inconsistent, timing, coverage)
**Epic 006-C:** UI test executor (actions, screenshots, state verification)
**Epic 006-D:** API test executor (HTTP, MCP tools, schema validation)
**Epic 006-E:** Independent verifier (cross-validation, confidence calculation)
**Epic 006-F:** RCA & fix agent (model selection, fix strategy, learning)
**Epic 006-G:** Test orchestrator (workflow state, error handling, reporting)

### Integration Testing

**Test Scenarios:**
1. **End-to-end happy path**: Execute test → collect evidence → verify → report
2. **Agent deception detection**: Fake evidence → red flags detected → verification fails
3. **Fix loop**: Test fails → RCA → fix attempt → verification → success
4. **Escalation**: Test fails 3x → escalate with handoff
5. **PIV integration**: Epic completes → orchestrator spawned → all tests run → PR updated

### Production Validation

**Metrics Monitoring:**
- Detection rate: % of agent lies caught
- False positive/negative rates
- Average fix cost
- Verification latency
- User satisfaction (trust in results)

**Canary Deployment:**
- Phase 1: 10% of epics (1 week)
- Phase 2: 50% of epics (2 weeks)
- Phase 3: 100% of epics (rollout complete)

---

## Dependencies

### Existing Infrastructure

**Required (Already Built):**
- ✅ PIV loop (triggers workflow)
- ✅ GitHub integration (PR comments)
- ✅ PostgreSQL database
- ✅ MCP server infrastructure
- ✅ Validation subagent (will be replaced by independent verifier)

**New Components (To Build):**
- Playwright browser automation
- Evidence storage system (file + DB)
- Red flag detection rules
- RCA agent (Opus integration)
- Knowledge graph for learnings

### External Dependencies

- Playwright (browser automation)
- Axios (HTTP client)
- OpenAI API (embeddings for learnings)
- Claude API (Haiku, Sonnet, Opus models)
- JSON Schema validator (response validation)

---

## Deployment Plan

### Pre-Deployment Checklist

- [ ] All 7 epics completed and tested
- [ ] Integration tests passing (>95%)
- [ ] Database migrations run successfully
- [ ] Evidence storage configured (compression, retention)
- [ ] Canary deployment plan reviewed
- [ ] Rollback procedure documented

### Rollout Strategy

**Week 1: Canary (10%)**
- Monitor error rates, false positives
- Tune confidence thresholds
- Validate cost metrics

**Week 2-3: Gradual (50%)**
- Expand to half of epics
- Continue monitoring and tuning
- Collect user feedback

**Week 4: Full Rollout (100%)**
- All epics use automatic quality workflows
- Monitor system health
- Iterate on learnings

### Success Criteria for Rollout

- ✅ Detection rate ≥95%
- ✅ False positive rate ≤5%
- ✅ Average fix cost ≤$0.10 (better than $0.45 baseline)
- ✅ User trust score ≥4/5 (survey)

---

## Change Log

### Version 1.0.0 (2026-01-27)

- Initial PRD created with 7-epic breakdown
- Research-backed problem statement (>15% hallucination rate)
- Evidence collection framework (Level 5/6 verification)
- Red flag detection system (catch agent lies)
- Independent verification agent (separate trust boundary)
- Adaptive fix strategy (3-5-7 pattern, 80% cost reduction)
- End-to-end orchestration (autonomous workflow)

---

## Related Documents

### Epics
- `epics/epic-006-A-evidence-collection.md` - Evidence framework
- `epics/epic-006-B-red-flag-detection.md` - Deception detection
- `epics/epic-006-C-ui-test-executor.md` - Level 5 UI testing
- `epics/epic-006-D-api-tool-test-executor.md` - Level 6 API testing
- `epics/epic-006-E-independent-verification.md` - Separate verification
- `epics/epic-006-F-rca-fix-agent.md` - Adaptive fixes
- `epics/epic-006-G-test-orchestrator.md` - Workflow integration

### Context
- `context/automatic-quality-workflows.md` - Original feature request
- `context/automatic-quality-workflows-analysis.md` - Research analysis

### Future ADRs (To Create During Implementation)
- ADR 006-001: Evidence storage strategy (file system vs object storage)
- ADR 006-002: Red flag severity thresholds
- ADR 006-003: Model selection criteria (3-5-7 pattern tuning)
- ADR 006-004: Knowledge graph schema for learnings

---

**Maintained by**: Meta-Supervisor (MS)
**Next Review**: After Phase 1 completion (6 weeks)
