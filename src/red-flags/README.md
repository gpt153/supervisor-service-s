# Red Flag Detection System

**Epic 006-B: Catch agent lies by analyzing evidence for deception patterns**

## Overview

The Red Flag Detection System analyzes test execution evidence to detect when LLM agents lie about test results. Research shows agents have a >15% hallucination rate in test reporting, including:

- Reporting "tests passed" without running them
- Parsing terminal output selectively (ignoring failures)
- Misinterpreting error messages as successes
- Executing wrong tests and reporting correct ones

This system achieves >95% detection rate with <5% false positives by analyzing:

1. **Missing Evidence**: Tests must have artifacts (screenshots, logs, coverage)
2. **Inconsistent Evidence**: Evidence contradicts test results (error shown but test passed)
3. **Tool Execution**: Expected MCP tools must be called
4. **Timing Anomalies**: Tests completing impossibly fast
5. **Coverage Analysis**: Code coverage must change when tests run

## Architecture

```
RedFlagDetector (orchestrator)
├── MissingEvidenceDetector   (CRITICAL flags)
├── InconsistentEvidenceDetector (HIGH flags)
├── ToolExecutionDetector     (CRITICAL flags)
├── TimingAnomalyDetector     (MEDIUM flags)
└── CoverageAnalyzer          (HIGH flags)
```

## Usage

### Basic Detection

```typescript
import { RedFlagDetector } from './red-flags';
import { Pool } from 'pg';

const pool = new Pool(/* config */);
const detector = new RedFlagDetector(pool);

const result = await detector.detect(
  'epic-003',           // Epic ID
  test,                 // Test result
  evidence              // Evidence artifacts
);

console.log(result.verdict);      // 'pass' | 'fail' | 'review'
console.log(result.recommendation); // Action to take
console.log(result.flags);        // Detected red flags
```

### Batch Detection

```typescript
const results = await detector.detectBatch(
  'epic-003',
  tests,
  evidenceByTest
);

const summary = detector.aggregateBatchResults(results);
console.log(`Failed: ${summary.failedTests}/${summary.totalTests}`);
```

### Generate Report

```typescript
import { RedFlagReporter } from './red-flags';

const reporter = new RedFlagReporter();
const { markdown, json } = await reporter.generateReport(result, 'both');

// Save to file
await reporter.saveReport(
  result,
  '.bmad/features/my-feature/reports/',
  'both'
);
```

## Severity Levels

| Severity | Action | Example |
|----------|--------|---------|
| **CRITICAL** | Auto-fail verification | UI test without screenshots |
| **HIGH** | Alert user for manual review | HTTP 404 but test passed |
| **MEDIUM** | Log for analysis | Test completed in <100ms |
| **LOW** | Informational | Minor timing deviation |

## Detection Rules

### Missing Evidence (CRITICAL)

```typescript
// Rule 1: UI test passed without screenshots
if (test.type === 'ui' && test.passFail === 'pass') {
  if (!evidence.screenshotBefore || !evidence.screenshotAfter) {
    return CRITICAL_FLAG;
  }
}

// Rule 2: API test passed without HTTP logs
if (test.type === 'api' && test.passFail === 'pass') {
  if (!evidence.httpRequest || !evidence.httpResponse) {
    return CRITICAL_FLAG;
  }
}
```

### Inconsistent Evidence (HIGH)

```typescript
// Rule 3: Screenshot shows error but test passed
if (test.passFail === 'pass' && screenshotContainsError(evidence)) {
  return HIGH_FLAG;
}

// Rule 4: HTTP 4xx/5xx but test passed
if (test.passFail === 'pass' && httpStatus >= 400) {
  return HIGH_FLAG;
}
```

### Tool Execution (CRITICAL)

```typescript
// Rule 5: Expected MCP tool not called
const expectedTools = parseTestName(test.name); // Extract from "test mcp__figma__get_screenshot"
const actualTools = evidence.mcpToolCalls.map(c => c.tool);
if (!expectedTools.every(t => actualTools.includes(t))) {
  return CRITICAL_FLAG;
}
```

### Timing Anomalies (MEDIUM)

```typescript
// Rule 6: Test completed impossibly fast
if (evidence.durationMs < MIN_THRESHOLD[test.type]) {
  return MEDIUM_FLAG;
}

// Rule 7: Test 2x faster than historical average
if (evidence.durationMs < historicalAvg / 2) {
  return MEDIUM_FLAG;
}
```

### Coverage Analysis (HIGH)

```typescript
// Rule 8: Coverage unchanged after test
if (coverageAfter.linesCovered === coverageBefore.linesCovered) {
  return HIGH_FLAG;
}
```

## Database Schema

### red_flags table

```sql
CREATE TABLE red_flags (
  id SERIAL PRIMARY KEY,
  epic_id TEXT NOT NULL,
  test_id TEXT NOT NULL,
  evidence_id INTEGER REFERENCES evidence_artifacts(id),
  flag_type TEXT NOT NULL,     -- 'missing_evidence', 'inconsistent', etc.
  severity TEXT NOT NULL,       -- 'critical', 'high', 'medium', 'low'
  description TEXT NOT NULL,
  proof JSONB NOT NULL,
  detected_at TIMESTAMP DEFAULT NOW(),
  resolved BOOLEAN DEFAULT FALSE,
  resolution_notes TEXT
);
```

### test_timing_history table

```sql
CREATE TABLE test_timing_history (
  id SERIAL PRIMARY KEY,
  test_name TEXT NOT NULL,
  test_type TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  network_requests INTEGER DEFAULT 0,
  dom_changes INTEGER DEFAULT 0,
  executed_at TIMESTAMP DEFAULT NOW(),
  epic_id TEXT
);
```

## Configuration

```typescript
const config = {
  enableMissingEvidence: true,
  enableInconsistentEvidence: true,
  enableToolExecution: true,
  enableTimingAnomalies: true,
  enableCoverageAnalysis: true,
};

const result = await detector.detect(epicId, test, evidence, config);
```

## False Positive Prevention

1. **Conservative thresholds**: Require multiple signals for ambiguous flags
2. **Expected error handling**: Don't flag tests named "should fail with error"
3. **Severity levels**: MEDIUM/LOW flags don't block verification
4. **Manual review**: HIGH flags alert user instead of auto-failing
5. **Historical data**: Compare to past runs, not just absolute thresholds

## Testing

```bash
# Run unit tests
npm test tests/unit/red-flag-detector.test.ts

# Run integration tests
npm test tests/integration/red-flag-e2e.test.ts

# Run with coverage
npm test -- --coverage
```

## Migration

```bash
# Apply migration
npm run migrate:up

# Rollback
npm run migrate:down
```

## Performance

- **Detection latency**: <10 seconds per test
- **Batch processing**: Parallel analysis of all tests
- **Database queries**: Indexed for fast lookups
- **Memory**: ~10MB per 1000 flags

## Success Metrics

- ✅ **Detection rate**: 100% of missing evidence caught
- ✅ **False positive rate**: <5%
- ✅ **Detection latency**: <10s per test
- ✅ **User trust**: Agents can't lie about test results

## References

- **Epic**: `.bmad/features/automatic-quality-workflows/epics/epic-006-B-red-flag-detection.md`
- **Research**: LLM hallucination in test reporting (>15% rate)
- **Types**: `src/types/red-flags.ts`
- **Database**: `migrations/1769182000000_red_flags.sql`
