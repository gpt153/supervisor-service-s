# Epic 006-E: Independent Verification Agent

**Epic ID:** 006-E
**Feature:** automatic-quality-workflows
**Created:** 2026-01-27
**Status:** Pending
**Complexity:** High (70-90 hours)
**Model:** Sonnet (requires reasoning about evidence)

---

## Rationale

**Problem:** Current validation system uses the SAME agent that executed tests to verify results. This creates a trust problem: an agent can lie about execution AND lie about verification. Research shows agents have strong confirmation bias - they see what they expect to see.

**Research Findings:**
- **Executor bias**: Agents that execute tests are biased toward reporting success
- **Confirmation bias**: Agents ignore contradictory evidence (error logs, failed screenshots)
- **Self-deception**: Agents convince themselves tests passed when evidence shows failure
- **No independent oversight**: No separate agent reviewing evidence with fresh perspective

**Solution:** Build an independent verification agent that:
1. **Never executes tests** - Only reviews evidence from other agents
2. **Uses different model** - Sonnet for verification (better at catching inconsistencies)
3. **Applies red flag detection** - Analyzes evidence for deception patterns
4. **Questions outcomes** - Skeptical by default, requires strong evidence
5. **Cross-checks multiple sources** - Screenshots + logs + HTTP traces must agree

**Why independence matters:** Separation of execution and verification prevents single point of trust failure. Verification agent acts as adversary to execution agent.

---

## Acceptance Criteria

### AC1: Evidence-Only Operation
- [ ] Verification agent NEVER executes tests
- [ ] Verification agent NEVER calls tools directly
- [ ] Verification agent ONLY analyzes evidence artifacts
- [ ] Evidence must be complete before verification starts
- [ ] No verification if evidence missing (auto-fail)

### AC2: Multi-Source Cross-Validation
- [ ] Compare screenshot evidence vs console logs (agree on outcome?)
- [ ] Compare HTTP response vs expected schema (match?)
- [ ] Compare test duration vs historical average (reasonable?)
- [ ] Compare coverage change vs test scope (proportional?)
- [ ] Flag mismatches as HIGH severity red flags

### AC3: Red Flag Integration
- [ ] Query red flag detection system for this test
- [ ] Review all CRITICAL red flags (auto-fail test)
- [ ] Review all HIGH red flags (manual review required)
- [ ] Investigate MEDIUM red flags (provide analysis)
- [ ] Generate verification report with red flag summary

### AC4: Skeptical Analysis
- [ ] Default to "unverified" until proven otherwise
- [ ] Require explicit evidence for every claim (test passed, resource created, etc.)
- [ ] Challenge suspicious patterns (too fast, no errors, perfect results)
- [ ] Question partial evidence (why is screenshot missing?)
- [ ] Escalate ambiguous cases to user (can't determine pass/fail)

### AC5: Evidence Integrity Verification
- [ ] Verify evidence artifacts exist on disk (not just DB records)
- [ ] Verify artifact timestamps are sequential (no time travel)
- [ ] Verify artifact sizes are reasonable (not empty, not corrupted)
- [ ] Verify artifact formats are correct (PNG for screenshots, JSON for logs)
- [ ] Verify evidence chain is complete (before → action → after)

### AC6: Verification Report Generation
- [ ] Plain language summary (pass/fail with confidence level)
- [ ] Evidence review (which artifacts reviewed, what found)
- [ ] Red flag summary (count by severity, descriptions)
- [ ] Confidence score (0-100%, based on evidence quality)
- [ ] Recommendation (accept, reject, manual review)

---

## Files to Create/Modify

```
supervisor-service-s/src/
├── verification/
│   ├── IndependentVerifier.ts       # NEW - Main verification orchestrator
│   ├── EvidenceAnalyzer.ts          # NEW - Analyze individual evidence artifacts
│   ├── CrossValidator.ts            # NEW - Compare multiple evidence sources
│   ├── RedFlagReviewer.ts           # NEW - Integrate red flag detection
│   ├── SkepticalAnalyzer.ts         # NEW - Challenge suspicious patterns
│   ├── IntegrityChecker.ts          # NEW - Verify evidence integrity
│   └── VerificationReporter.ts      # NEW - Generate verification reports

├── db/
│   ├── migrations/
│   │   └── 012_verification_reports.sql # NEW - Verification report schema
│   └── queries/
│       └── verification-reports.ts   # NEW - Verification report CRUD

└── types/
    └── verification.ts               # NEW - Verification type definitions

.claude/commands/subagents/verification/
├── independent-verify.md             # NEW - Independent verification agent
└── analyze-evidence.md               # NEW - Evidence analysis agent

tests/unit/
└── independent-verifier.test.ts      # NEW - Unit tests for verification
```

---

## Implementation Notes

### Verification Report Schema

```sql
CREATE TABLE verification_reports (
  id SERIAL PRIMARY KEY,
  test_id TEXT NOT NULL,
  epic_id TEXT NOT NULL,
  evidence_id INTEGER REFERENCES evidence_artifacts(id),

  -- Verification outcome
  verified BOOLEAN NOT NULL,
  confidence_score INTEGER NOT NULL, -- 0-100
  recommendation TEXT NOT NULL, -- 'accept', 'reject', 'manual_review'

  -- Analysis
  evidence_reviewed JSONB NOT NULL, -- {screenshots: 2, logs: 1, traces: 1, etc.}
  cross_validation_results JSONB, -- {screenshot_vs_log: 'match', http_vs_schema: 'match', etc.}
  red_flags_found JSONB, -- {critical: 0, high: 1, medium: 2, low: 0}

  -- Reasoning
  summary TEXT NOT NULL, -- Plain language summary
  reasoning TEXT NOT NULL, -- Why did verification pass/fail
  concerns TEXT[], -- Array of concerns raised

  verified_at TIMESTAMP DEFAULT NOW(),
  verifier_model TEXT -- 'sonnet', 'opus', etc.
);

CREATE INDEX idx_verification_test ON verification_reports(test_id);
CREATE INDEX idx_verification_epic ON verification_reports(epic_id);
CREATE INDEX idx_verification_outcome ON verification_reports(verified);
```

### Independent Verification Flow

```typescript
class IndependentVerifier {
  async verify(testId: string): Promise<VerificationReport> {
    // 1. Load evidence (NEVER execute anything)
    const evidence = await this.evidenceRetriever.getByTestId(testId);
    if (!evidence) {
      return this.createFailReport(testId, 'No evidence found');
    }

    // 2. Verify evidence integrity
    const integrityChecks = await this.integrityChecker.check(evidence);
    if (!integrityChecks.passed) {
      return this.createFailReport(testId, `Evidence integrity failed: ${integrityChecks.errors.join(', ')}`);
    }

    // 3. Review red flags
    const redFlags = await this.redFlagReviewer.getRedFlags(testId);
    const criticalFlags = redFlags.filter(f => f.severity === 'critical');
    if (criticalFlags.length > 0) {
      return this.createFailReport(testId, `Critical red flags: ${criticalFlags.map(f => f.description).join(', ')}`);
    }

    // 4. Cross-validate evidence sources
    const crossValidation = await this.crossValidator.validate(evidence);
    const mismatches = crossValidation.filter(cv => !cv.matched);
    if (mismatches.length > 0) {
      // High severity - evidence contradicts itself
      return this.createManualReviewReport(testId, `Evidence contradictions: ${mismatches.map(m => m.description).join(', ')}`);
    }

    // 5. Skeptical analysis
    const skepticalAnalysis = await this.skepticalAnalyzer.analyze(evidence, redFlags);
    if (skepticalAnalysis.suspicious) {
      return this.createManualReviewReport(testId, `Suspicious patterns: ${skepticalAnalysis.concerns.join(', ')}`);
    }

    // 6. Calculate confidence score
    const confidence = this.calculateConfidence(evidence, redFlags, crossValidation);

    // 7. Generate report
    return this.verificationReporter.generate({
      testId,
      verified: confidence >= 80, // 80% confidence required
      confidenceScore: confidence,
      evidenceReviewed: this.summarizeEvidence(evidence),
      redFlagsFound: this.summarizeRedFlags(redFlags),
      reasoning: this.generateReasoning(evidence, crossValidation, skepticalAnalysis),
      recommendation: confidence >= 80 ? 'accept' : confidence >= 60 ? 'manual_review' : 'reject'
    });
  }
}
```

### Cross-Validation Pattern

```typescript
class CrossValidator {
  async validate(evidence: EvidenceArtifacts): Promise<CrossValidationResult[]> {
    const results: CrossValidationResult[] = [];

    // 1. Screenshot vs Console Logs
    const screenshotAnalysis = await this.analyzeScreenshot(evidence.screenshotAfter);
    const consoleHasErrors = evidence.consoleLogs.some(log => log.level === 'error');

    if (screenshotAnalysis.hasErrorUI && !consoleHasErrors) {
      results.push({
        type: 'screenshot_vs_console',
        matched: false,
        description: 'Screenshot shows error UI but console has no errors',
        evidence: {
          screenshot: evidence.screenshotAfter,
          consoleLogs: evidence.consoleLogs
        }
      });
    }

    // 2. HTTP Response vs Schema
    if (evidence.httpResponse) {
      const schemaValid = await this.validateSchema(
        evidence.httpResponse.body,
        evidence.expectedSchema
      );

      results.push({
        type: 'http_vs_schema',
        matched: schemaValid,
        description: schemaValid ? 'Response matches schema' : 'Response does not match expected schema',
        evidence: {
          response: evidence.httpResponse.body,
          schema: evidence.expectedSchema
        }
      });
    }

    // 3. Test Duration vs Historical Average
    const historicalAvg = await this.getHistoricalDuration(evidence.testName);
    const deviation = Math.abs(evidence.duration_ms - historicalAvg) / historicalAvg;

    if (deviation > 0.5) { // More than 50% deviation
      results.push({
        type: 'duration_vs_historical',
        matched: false,
        description: `Test duration ${evidence.duration_ms}ms vs historical avg ${historicalAvg}ms (${Math.round(deviation * 100)}% deviation)`,
        evidence: {
          actual: evidence.duration_ms,
          historical: historicalAvg,
          deviation
        }
      });
    }

    // 4. Coverage Change vs Test Scope
    if (evidence.coverageReport) {
      const coverageChange = evidence.coverageReport.after - evidence.coverageReport.before;
      const expectedChange = this.estimateExpectedCoverage(evidence.testScope);

      if (Math.abs(coverageChange - expectedChange) > 10) { // More than 10% off
        results.push({
          type: 'coverage_vs_scope',
          matched: false,
          description: `Coverage changed ${coverageChange}% but expected ~${expectedChange}% based on test scope`,
          evidence: {
            actual: coverageChange,
            expected: expectedChange,
            testScope: evidence.testScope
          }
        });
      }
    }

    return results;
  }
}
```

### Skeptical Analysis Pattern

```typescript
class SkepticalAnalyzer {
  async analyze(evidence: EvidenceArtifacts, redFlags: RedFlag[]): Promise<SkepticalAnalysisResult> {
    const concerns: string[] = [];

    // 1. Too perfect results (no errors, no warnings, perfect coverage)
    if (
      evidence.consoleLogs.every(log => log.level !== 'error' && log.level !== 'warn') &&
      evidence.coverageReport?.after === 100
    ) {
      concerns.push('Results are suspiciously perfect (no errors, no warnings, 100% coverage)');
    }

    // 2. Impossibly fast execution
    if (evidence.duration_ms < 100) {
      concerns.push(`Test completed in ${evidence.duration_ms}ms (likely not actually run)`);
    }

    // 3. Missing expected artifacts
    const expectedArtifacts = this.getExpectedArtifacts(evidence.testType);
    const missingArtifacts = expectedArtifacts.filter(
      artifact => !evidence[artifact]
    );
    if (missingArtifacts.length > 0) {
      concerns.push(`Missing expected artifacts: ${missingArtifacts.join(', ')}`);
    }

    // 4. Red flags present but test passed
    const highSeverityFlags = redFlags.filter(
      f => f.severity === 'high' || f.severity === 'critical'
    );
    if (highSeverityFlags.length > 0 && evidence.passFail === 'pass') {
      concerns.push(`Test passed but ${highSeverityFlags.length} high/critical red flags detected`);
    }

    // 5. Network activity for UI test is zero
    if (evidence.testType === 'ui' && evidence.networkActivity.length === 0) {
      concerns.push('UI test has no network activity (likely not actually run)');
    }

    return {
      suspicious: concerns.length > 0,
      concerns,
      recommendManualReview: concerns.length >= 2 // 2+ concerns = manual review
    };
  }
}
```

### Confidence Score Calculation

```typescript
class IndependentVerifier {
  private calculateConfidence(
    evidence: EvidenceArtifacts,
    redFlags: RedFlag[],
    crossValidation: CrossValidationResult[]
  ): number {
    let confidence = 100; // Start at 100%, deduct for issues

    // Deduct for red flags
    const criticalFlags = redFlags.filter(f => f.severity === 'critical');
    const highFlags = redFlags.filter(f => f.severity === 'high');
    const mediumFlags = redFlags.filter(f => f.severity === 'medium');

    confidence -= criticalFlags.length * 50; // -50 per critical
    confidence -= highFlags.length * 20; // -20 per high
    confidence -= mediumFlags.length * 10; // -10 per medium

    // Deduct for cross-validation mismatches
    const mismatches = crossValidation.filter(cv => !cv.matched);
    confidence -= mismatches.length * 15; // -15 per mismatch

    // Deduct for missing evidence
    const expectedArtifacts = this.getExpectedArtifacts(evidence.testType);
    const missingArtifacts = expectedArtifacts.filter(
      artifact => !evidence[artifact]
    );
    confidence -= missingArtifacts.length * 25; // -25 per missing artifact

    // Bonus for comprehensive evidence
    if (evidence.screenshotBefore && evidence.screenshotAfter && evidence.consoleLogs.length > 0) {
      confidence += 10; // +10 for complete evidence
    }

    return Math.max(0, Math.min(100, confidence)); // Clamp 0-100
  }
}
```

---

## Model Selection

**Verification:** Sonnet (REQUIRED)
- Needs to reason about contradictions in evidence
- Detect subtle inconsistencies across artifacts
- Understand context (is this error expected?)
- Generate nuanced confidence assessments
- Haiku would miss too many deception patterns

**Never use Haiku for verification** - this is a critical trust boundary

---

## Estimated Effort

- **IndependentVerifier orchestrator**: 12 hours
- **EvidenceAnalyzer**: 16 hours (screenshot analysis, log parsing)
- **CrossValidator**: 18 hours (multi-source comparison, schema validation)
- **RedFlagReviewer integration**: 8 hours
- **SkepticalAnalyzer**: 14 hours (pattern detection, concern identification)
- **IntegrityChecker**: 12 hours (file existence, format validation, timestamp verification)
- **VerificationReporter**: 10 hours (plain language generation)
- **Unit tests**: 22 hours
- **Integration tests**: 18 hours

**Total: 130 hours (3.25 weeks)**

---

## Dependencies

**Blocked By:**
- Epic 006-A (Evidence Collection - needs artifacts to verify)
- Epic 006-B (Red Flag Detection - integrates red flags into verification)

**Blocks:**
- Epic 006-G (Test Orchestrator - uses verification results)

---

## Testing Approach

### Unit Tests

**CrossValidator:**
- [ ] Screenshot vs console (match, mismatch)
- [ ] HTTP vs schema (valid, invalid)
- [ ] Duration vs historical (within range, outlier)
- [ ] Coverage vs scope (proportional, off)

**SkepticalAnalyzer:**
- [ ] Detect perfect results (suspicious)
- [ ] Detect impossibly fast tests (red flag)
- [ ] Detect missing artifacts (concern)
- [ ] Detect red flags ignored (concern)

**IntegrityChecker:**
- [ ] Verify artifact files exist (pass, fail)
- [ ] Verify timestamps sequential (valid, time travel)
- [ ] Verify file sizes reasonable (valid, empty, corrupted)
- [ ] Verify formats correct (PNG, JSON, etc.)

**Confidence Calculation:**
- [ ] Calculate with no issues (100%)
- [ ] Calculate with critical red flags (<50%)
- [ ] Calculate with mismatches (deduct 15)
- [ ] Calculate with missing evidence (deduct 25)

### Integration Tests

**End-to-End Verification:**
1. Load evidence from Epic 006-C (UI test)
2. Run independent verification
3. Verify no execution occurs (only analysis)
4. Verify all evidence sources cross-validated
5. Verify red flags reviewed
6. Verify confidence score calculated
7. Verify verification report generated

**Catch Agent Lie:**
1. Create fake evidence (screenshot shows error, test passed)
2. Run independent verification
3. Verify cross-validation detects mismatch
4. Verify verification fails
5. Verify user alerted to contradiction

**Manual Review Required:**
1. Create ambiguous evidence (some concerns but not critical)
2. Run independent verification
3. Verify confidence score 60-79%
4. Verify recommendation is 'manual_review'
5. Verify concerns listed in report

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| **False negatives** (miss agent lies) | Bad tests pass | Multiple detection layers, conservative thresholds, require strong evidence |
| **False positives** (reject good tests) | Slow development | Confidence scores, manual review threshold, tune over time |
| **Performance** (verification too slow) | Long test cycles | Parallel analysis, cache historical data, optimize image processing |
| **Model hallucination** (Sonnet lies too) | Trust breakdown | Evidence-only operation, no tool calls, multiple verification signals |

---

## Success Metrics

- **Detection rate**: Catch 95% of agent lies (from tests with fake evidence)
- **False positive rate**: <5% (legitimate tests incorrectly failed)
- **Confidence accuracy**: 90% of 90+ confidence tests are actually correct
- **Manual review rate**: 10-15% of tests require manual review
- **User trust**: Users confident verification is independent and accurate

---

**Next Steps After Completion:**
1. Integrate with test orchestrator (Epic 006-G)
2. Tune confidence thresholds based on production data
3. Build verification report dashboard

---

**References:**
- Evidence collection framework (Epic 006-A)
- Red flag detection system (Epic 006-B)
- Research on LLM confirmation bias and self-deception
