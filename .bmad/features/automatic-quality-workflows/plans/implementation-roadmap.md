# Implementation Roadmap: Automatic Quality Workflows

**Feature:** automatic-quality-workflows
**Created:** 2026-01-27
**Status:** Draft
**Total Effort:** 956 hours (24 weeks / 6 months)

---

## Executive Summary

This roadmap breaks down the automatic quality workflows feature into 4 phases across 24 weeks. The feature addresses critical trust issues with LLM agent test execution by implementing evidence-based verification, red flag detection, and independent oversight.

**Key Milestones:**
- **Week 6**: Evidence collection framework complete (Level 5/6 verification)
- **Week 15**: Detection + verification system operational (catch agent lies)
- **Week 17**: Test execution infrastructure complete (UI + API)
- **Week 24**: Full autonomous quality workflow deployed

---

## Phase Breakdown

### Phase 1: Foundation (Weeks 1-6) - 100 hours

**Epic 006-A: Evidence Collection Framework**

**Goal:** Build systematic evidence collection for every test type (UI, API, unit/integration).

**Deliverables:**
- PostgreSQL schema for evidence artifacts
- File system storage for artifacts (screenshots, logs, traces)
- Level 5 evidence collector (UI: screenshots, DOM, console, network)
- Level 6 evidence collector (API: HTTP logs, tool calls, responses)
- Unit test evidence collector (test output, coverage)
- Evidence retrieval API

**Success Criteria:**
- ✅ 100% evidence collection rate (no tests pass without artifacts)
- ✅ Evidence completeness: All required fields populated
- ✅ Storage efficiency: <10MB average per test (with compression)
- ✅ Retrieval latency: <100ms to query evidence

**Risks:**
- Large evidence files (screenshots, traces) → Mitigation: Compression, 30-day retention
- Evidence collection failures → Mitigation: Retry collection, fail test if evidence missing

---

### Phase 2: Detection & Verification (Weeks 7-15) - 250 hours

#### Epic 006-B: Red Flag Detection System (Weeks 7-10) - 120 hours

**Goal:** Detect agent deception patterns automatically (missing evidence, inconsistencies, lies).

**Deliverables:**
- Missing evidence detector (CRITICAL red flags)
- Inconsistent evidence detector (HIGH red flags)
- Tool execution verifier (CRITICAL red flags)
- Timing anomaly detector (MEDIUM red flags)
- Coverage analyzer (HIGH red flags)
- Red flag reporter (severity-based escalation)

**Success Criteria:**
- ✅ Detection rate: 100% of tests with missing evidence flagged
- ✅ False positive rate: <5% (legitimate tests incorrectly flagged)
- ✅ Detection latency: <10 seconds per test

**Risks:**
- False positives (reject good tests) → Mitigation: Conservative rules, severity levels
- Image analysis errors (screenshots misinterpreted) → Mitigation: OCR + pattern matching

#### Epic 006-E: Independent Verification Agent (Weeks 11-15) - 130 hours

**Goal:** Create separate verification agent that never executes tests, only reviews evidence.

**Deliverables:**
- Evidence-only verifier (never calls tools)
- Cross-validator (compare screenshots vs logs vs HTTP)
- Red flag reviewer (integrate detection system)
- Skeptical analyzer (challenge suspicious patterns)
- Integrity checker (verify evidence files exist, not corrupted)
- Verification reporter (plain language, confidence score)

**Success Criteria:**
- ✅ Detection rate: Catch 95% of agent lies
- ✅ False negative rate: <2% (agent lies slip through)
- ✅ Confidence accuracy: 90% of 90+ confidence tests are correct
- ✅ Manual review rate: 10-15% of tests

**Risks:**
- False negatives (miss agent lies) → Mitigation: Multiple detection layers, evidence requirements
- Sonnet hallucination → Mitigation: Evidence-only operation, no tool calls allowed

---

### Phase 3: Test Execution (Weeks 7-17, Parallel) - 280 hours

#### Epic 006-C: UI Test Executor (Weeks 7-13) - 160 hours

**Goal:** Build comprehensive UI test executor with Level 5 verification (visual/interactive layer).

**Deliverables:**
- Playwright integration (Chrome, Firefox, Safari)
- Browser automation (click, type, scroll, hover, drag)
- Visual evidence collector (screenshots before/after, diffs)
- Rendered state verifier (visibility, interactivity, CSS)
- Console monitor (errors, warnings, logs)
- Network monitor (XHR, fetch, WebSocket)
- Accessibility checker (ARIA, keyboard navigation)

**Success Criteria:**
- ✅ Test execution reliability: 95% success rate (no flaky failures)
- ✅ Evidence completeness: 100% of UI tests have screenshots + logs
- ✅ Visual regression detection: Catch 100% of layout/styling changes
- ✅ Execution speed: <30 seconds per test

**Risks:**
- Flaky tests (timing issues) → Mitigation: Smart waits (networkidle), retry logic
- Browser crashes → Mitigation: Auto-restart, isolate tests
- Screenshot storage (large files) → Mitigation: Compression, retention policy

#### Epic 006-D: API & Tool Test Executor (Weeks 11-17) - 120 hours

**Goal:** Build comprehensive API/tool test executor with Level 6 verification (tool/service layer).

**Deliverables:**
- MCP tool executor (connect, invoke, capture response)
- HTTP API client (REST, authentication, retries)
- Response validator (JSON Schema, status codes, headers)
- Error scenario tester (4xx, 5xx, timeouts)
- Side effect verifier (resource creation, data modification)
- Evidence collector (HTTP logs, tool invocations)

**Success Criteria:**
- ✅ Test execution reliability: 98% success rate
- ✅ Evidence completeness: 100% of API tests have request/response logs
- ✅ Schema validation accuracy: 100% (no false positives/negatives)
- ✅ Execution speed: <5 seconds per test

**Risks:**
- MCP server unavailable → Mitigation: Retry logic, fallback to mock server
- Network instability → Mitigation: Retry on timeout, distinguish errors
- Schema drift → Mitigation: Version schemas, detect changes

---

### Phase 4: Fixing & Integration (Weeks 16-24) - 326 hours

#### Epic 006-F: RCA & Fix Agent (Weeks 16-20) - 186 hours

**Goal:** Implement adaptive fix strategy with root cause analysis and cost optimization.

**Deliverables:**
- Root cause analyzer (Opus - most accurate)
- Failure classifier (syntax, logic, integration, environment)
- Model selector (3-5-7 pattern: Haiku → Sonnet → Opus)
- Fix strategy selector (match root cause to fix)
- Retry manager (track attempts, costs, learnings)
- Fix executor (apply fixes atomically)
- Fix learning store (knowledge graph of failure → fix)
- Escalation handler (generate handoffs)

**Success Criteria:**
- ✅ First-retry success rate: 70% (Haiku fixes simple issues)
- ✅ Total fix success rate: 85% (within 3 retries)
- ✅ Average cost per fix: <$0.05 (vs $0.45 current, 89% reduction)
- ✅ Learning reuse rate: 40% (known patterns reuse fixes)

**Risks:**
- RCA mistakes (waste retries) → Mitigation: Use Opus (most accurate), validate diagnosis
- Cost overruns → Mitigation: Adaptive model selection, learn from past fixes
- Fix breaks other tests → Mitigation: Run full test suite, atomic commits

#### Epic 006-G: Test Orchestrator (Weeks 21-24) - 140 hours

**Goal:** Integrate all components into unified autonomous workflow.

**Deliverables:**
- Test orchestrator (workflow state machine)
- Stage executor (run individual stages)
- Error handler (cross-stage errors, retries)
- PIV integration (auto-trigger after epic completion)
- Unified reporter (aggregate all stages, plain language)
- Test scheduler (parallel execution, priority)
- Resource manager (concurrency limits)
- Timeout enforcer (no stage runs >10 minutes)

**Success Criteria:**
- ✅ Workflow completion rate: 98% (no deadlocks/crashes)
- ✅ End-to-end latency: <5 minutes per test
- ✅ Parallel execution: 5x speedup for 10+ tests
- ✅ Error handling: 100% of failures escalated or fixed

**Risks:**
- Workflow deadlock → Mitigation: Timeout enforcement, deadlock detection
- Database corruption → Mitigation: Atomic transactions, backups
- Component version mismatch → Mitigation: Version checks, integration tests

---

## Epic Dependencies Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                    Phase 1: Foundation                          │
│                  (Weeks 1-6, 100 hours)                         │
│                                                                  │
│              ┌──────────────────────────┐                       │
│              │  Epic 006-A: Evidence    │                       │
│              │  Collection Framework    │                       │
│              │  (Week 1-6, 100h)        │                       │
│              └────────────┬─────────────┘                       │
└───────────────────────────┼──────────────────────────────────┘
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
         ▼                  ▼                  ▼
┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│ Phase 2: Detection & Verification  │  │ Phase 3: Test Execution (PARALLEL)│
│ (Weeks 7-15, 250 hours)            │  │ (Weeks 7-17, 280 hours)           │
│                                    │  │                                    │
│  ┌──────────────┐                 │  │  ┌──────────────┐                 │
│  │ Epic 006-B   │                 │  │  │ Epic 006-C   │                 │
│  │ Red Flags    │                 │  │  │ UI Tests     │                 │
│  │ (7-10, 120h) │                 │  │  │ (7-13, 160h) │                 │
│  └──────┬───────┘                 │  │  └──────────────┘                 │
│         │                         │  │                                    │
│         ▼                         │  │  ┌──────────────┐                 │
│  ┌──────────────┐                 │  │  │ Epic 006-D   │                 │
│  │ Epic 006-E   │                 │  │  │ API Tests    │                 │
│  │ Independent  │                 │  │  │ (11-17, 120h)│                 │
│  │ Verification │                 │  │  └──────────────┘                 │
│  │ (11-15, 130h)│                 │  │                                    │
│  └──────┬───────┘                 │  │                                    │
└─────────┼─────────────────────────┘  └──────────────┬────────────────────┘
          │                                            │
          └──────────────┬─────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────────────┐
        │      Phase 4: Fixing & Integration          │
        │      (Weeks 16-24, 326 hours)               │
        │                                             │
        │  ┌──────────────┐                           │
        │  │ Epic 006-F   │                           │
        │  │ RCA & Fix    │                           │
        │  │ (16-20, 186h)│                           │
        │  └──────┬───────┘                           │
        │         │                                   │
        │         ▼                                   │
        │  ┌──────────────┐                           │
        │  │ Epic 006-G   │                           │
        │  │ Orchestrator │                           │
        │  │ (21-24, 140h)│                           │
        │  └──────────────┘                           │
        └────────────────────────────────────────────┘
```

**Critical Path (Longest):**
- 006-A (6 weeks) → 006-B (4 weeks) → 006-E (5 weeks) → 006-F (5 weeks) → 006-G (4 weeks)
- Total: 24 weeks

**Parallel Opportunities:**
- 006-C (UI Tests) and 006-D (API Tests) run parallel with 006-B and 006-E
- Saves ~7 weeks vs sequential implementation

---

## Resource Allocation

### Team Requirements

**Developers:**
- **2 Backend Engineers**: Evidence collection, detection, verification, fixing
- **1 Frontend/UI Engineer**: Playwright integration, browser automation
- **1 DevOps Engineer**: Database migrations, deployment, monitoring

**Model Usage:**
- **Haiku**: Test execution, orchestration, simple fixes (~70% of work)
- **Sonnet**: Complex UI reasoning, verification, moderate fixes (~25% of work)
- **Opus**: Root cause analysis, complex fixes (~5% of work)

**Estimated Costs:**
- Development: 956 hours × $100/hour = $95,600
- Model costs (production): ~$500/month (optimized via 3-5-7 pattern)

---

## Risk Assessment

### Critical Path Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Evidence collection delays** | Blocks all dependent epics | Prioritize 006-A, allocate 2 engineers |
| **Red flag false positives** | Slows development | Extensive testing, tune thresholds during 006-B |
| **Playwright integration issues** | Delays UI testing | Prototype early, fallback to simpler automation |
| **Component integration failures** | Delays final orchestration | Integration tests throughout, not just at end |

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Evidence storage (disk space)** | Medium | Low | Compression, 30-day retention, archive |
| **Database performance** | Medium | Medium | Partition tables, index optimization |
| **False positives (reject good tests)** | High | High | Conservative thresholds, manual review option |
| **Cost overruns (expensive models)** | Low | Medium | 3-5-7 pattern, cache learnings, monitor spend |

---

## Success Metrics by Phase

### Phase 1 (Week 6)
- ✅ Evidence collection rate: 100%
- ✅ Artifact completeness: 100%
- ✅ Storage efficiency: <10MB per test

### Phase 2 (Week 15)
- ✅ Detection rate: 95%+ (agent lies caught)
- ✅ False positive rate: <5%
- ✅ Verification confidence accuracy: 90%

### Phase 3 (Week 17)
- ✅ UI test reliability: 95%
- ✅ API test reliability: 98%
- ✅ Test execution speed: <30s (UI), <5s (API)

### Phase 4 (Week 24)
- ✅ Fix success rate: 85%
- ✅ Average fix cost: <$0.05
- ✅ Workflow completion rate: 98%
- ✅ End-to-end latency: <5 minutes

---

## Deployment Strategy

### Canary Rollout (Weeks 25-28, Post-Implementation)

**Week 25: Canary (10% of epics)**
- Enable automatic quality workflows for 2-3 epics
- Monitor error rates, false positives, costs
- Tune confidence thresholds, red flag rules
- Collect user feedback

**Success Criteria:**
- Detection rate ≥90%
- False positive rate ≤10%
- No critical failures

**Week 26-27: Gradual (50% of epics)**
- Expand to half of all epics
- Continue monitoring and tuning
- Validate cost savings (target: <$0.10 per fix)
- Address any issues found

**Success Criteria:**
- Detection rate ≥93%
- False positive rate ≤7%
- User trust score ≥3.5/5

**Week 28: Full Rollout (100% of epics)**
- All epics use automatic quality workflows
- Monitor system health
- Iterate on learnings
- Measure time savings (target: 90% reduction in manual verification)

**Success Criteria (Production):**
- ✅ Detection rate ≥95%
- ✅ False positive rate ≤5%
- ✅ Average fix cost ≤$0.05
- ✅ User trust score ≥4/5
- ✅ Time savings: 90% reduction

### Rollback Plan

**If critical issues detected:**
1. Disable automatic orchestration (PIV integration)
2. Fall back to manual validation agent spawn
3. Keep evidence collection (passive monitoring)
4. Analyze failures, fix issues
5. Re-deploy with fixes after testing

---

## Monitoring & Observability

### Key Metrics to Track

**Quality Metrics:**
- Detection rate (% of agent lies caught)
- False positive rate (legitimate tests failed)
- False negative rate (agent lies slip through)
- Verification confidence distribution

**Performance Metrics:**
- Evidence collection latency
- Red flag detection latency
- Verification latency
- End-to-end workflow duration
- Test execution reliability (% success)

**Cost Metrics:**
- Average fix cost (by model)
- Model usage distribution (Haiku vs Sonnet vs Opus)
- Learning reuse rate (% using known fixes)
- Total monthly costs

**User Experience:**
- Manual review rate (% requiring human review)
- User trust score (survey)
- Time savings (manual verification hours saved)

### Alerting Thresholds

**Critical Alerts:**
- False negative rate >5% (agent lies slipping through)
- Workflow completion rate <90% (deadlocks/crashes)
- Evidence collection rate <95% (missing artifacts)

**Warning Alerts:**
- False positive rate >7% (rejecting good tests)
- Average fix cost >$0.10 (cost optimization failing)
- Verification latency >30 seconds (performance degradation)

---

## Post-Launch Iteration

### Weeks 29-32 (Month 1 Post-Launch)

**Focus:** Tune thresholds, optimize performance

**Tasks:**
- Analyze false positives, adjust red flag rules
- Optimize evidence storage (compression, retention)
- Tune confidence score calculation
- Improve learning reuse (knowledge graph)

### Weeks 33-40 (Months 2-3 Post-Launch)

**Focus:** Enhance capabilities, add features

**Potential Enhancements:**
- Custom verification rules per project
- Advanced visual regression detection
- Parallel verification of independent tests
- Cross-project learning sharing

### Ongoing (Months 4+)

**Focus:** Maintain, scale, innovate

**Tasks:**
- Quarterly review of learnings (prune outdated)
- Scale evidence storage (archive old epics)
- Monitor for new failure patterns
- Research advanced detection techniques

---

## Conclusion

This implementation roadmap provides a structured 24-week plan to build an autonomous quality system that eliminates trust issues with LLM agents. The phased approach allows for early value delivery (evidence collection by week 6, detection by week 15) while managing risks through parallel development and extensive testing.

**Key Differentiators:**
1. **Evidence-based verification**: No tests pass without proof
2. **Independent oversight**: Separate execution and verification
3. **Cost optimization**: 89% reduction via adaptive model selection
4. **Continuous learning**: Build knowledge graph of failure patterns

**Expected ROI:**
- **Time savings**: 90% reduction in manual verification (5-10 hours → 30 min monthly)
- **Quality improvement**: 95% agent lie detection rate
- **Cost savings**: $0.45 → $0.05 per fix (89% reduction)
- **User trust**: Confident test results are real, not hallucinated

---

**Maintained by**: Meta-Supervisor (MS)
**Next Review**: After Phase 1 completion (Week 6)
