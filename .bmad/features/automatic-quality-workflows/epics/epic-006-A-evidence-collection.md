# Epic 006-A: Evidence Collection Framework

**Epic ID:** 006-A
**Feature:** automatic-quality-workflows
**Created:** 2026-01-27
**Status:** Pending
**Complexity:** Medium (60-80 hours)
**Model:** Haiku for implementation, Sonnet for testing

---

## Rationale

**Problem:** Current validation agents execute tests but don't systematically collect evidence artifacts. Research shows >15% hallucination rate in LLM test execution reports - agents claim tests passed without actually running them or misreport results.

**Research Findings:**
- **Superficial checking**: Agents parse terminal output but don't verify test artifacts exist
- **Tool execution lies**: Agents report "npm test passed" when tests weren't actually run
- **Missing evidence**: No systematic collection of screenshots, logs, HTTP responses for verification

**Solution:** Build an evidence collection framework that REQUIRES artifacts for every test type:
- **UI tests (Level 5)**: Screenshots before/after, DOM snapshots, console logs, network traces
- **API tests (Level 6)**: Request/response logs, status codes, payload validation
- **Unit/Integration tests**: Coverage reports, test output files, assertion logs

**Why this is foundational:** All other epics depend on having trustworthy evidence. Without this, verification agents can lie and we can't catch them.

---

## Acceptance Criteria

### AC1: Evidence Schema & Storage
- [ ] PostgreSQL schema for evidence artifacts with metadata (test_id, type, path, timestamp)
- [ ] File system structure for evidence storage (`/evidence/{epic-id}/{test-type}/{timestamp}/`)
- [ ] Evidence metadata includes: test name, verification level, expected vs actual, pass/fail status
- [ ] Support for multiple artifact types: screenshots (PNG), logs (JSON), DOM snapshots (HTML), HTTP traces (HAR)
- [ ] Database indexes for fast retrieval by epic, test type, pass/fail status

### AC2: UI Test Evidence Collection (Level 5)
- [ ] Screenshot capture before test action
- [ ] Screenshot capture after test action
- [ ] DOM snapshot before/after state changes
- [ ] Console logs (errors, warnings, info) during test execution
- [ ] Network activity traces (all XHR/fetch requests during test)
- [ ] Evidence stored with test metadata (URL, action, expected outcome)

### AC3: API Test Evidence Collection (Level 6)
- [ ] HTTP request capture (method, URL, headers, body)
- [ ] HTTP response capture (status, headers, body, timing)
- [ ] Request/response pairing (correlation ID)
- [ ] Tool execution logs (which MCP tool was called, with what params)
- [ ] Tool response validation (actual response vs expected schema)
- [ ] Evidence stored with test metadata (tool name, operation, expected outcome)

### AC4: Unit/Integration Test Evidence Collection
- [ ] Test framework output capture (Jest/Mocha/etc JSON reports)
- [ ] Coverage reports (lcov format)
- [ ] Assertion logs (what was asserted, expected vs actual)
- [ ] Test timing data (duration per test)
- [ ] Stack traces for failures

### AC5: Evidence Retrieval API
- [ ] Query evidence by epic ID
- [ ] Query evidence by test type (UI, API, unit, integration)
- [ ] Query evidence by pass/fail status
- [ ] Query evidence by date range
- [ ] Return full artifact paths + metadata

---

## Files to Create/Modify

```
supervisor-service-s/src/
├── evidence/
│   ├── EvidenceCollector.ts         # NEW - Core collector interface
│   ├── UIEvidenceCollector.ts       # NEW - Level 5 evidence (screenshots, DOM, network)
│   ├── APIEvidenceCollector.ts      # NEW - Level 6 evidence (HTTP, tool calls)
│   ├── UnitTestEvidenceCollector.ts # NEW - Unit/integration test evidence
│   ├── EvidenceStorage.ts           # NEW - File system + DB persistence
│   └── EvidenceRetriever.ts         # NEW - Query API for evidence

├── db/
│   ├── migrations/
│   │   └── 010_evidence.sql         # NEW - Evidence schema
│   └── queries/
│       └── evidence.ts               # NEW - Evidence CRUD operations

└── types/
    └── evidence.ts                   # NEW - Evidence type definitions

.claude/commands/subagents/testing/
├── ui-test-with-evidence.md          # NEW - UI test executor with evidence collection
└── api-test-with-evidence.md         # NEW - API test executor with evidence collection

evidence/
└── (artifact files stored here, organized by epic/test-type/timestamp)

tests/unit/
└── evidence-collector.test.ts        # NEW - Unit tests for evidence collection
```

---

## Implementation Notes

### Evidence Schema (PostgreSQL)

```sql
CREATE TABLE evidence_artifacts (
  id SERIAL PRIMARY KEY,
  epic_id TEXT NOT NULL,
  test_id TEXT NOT NULL,
  test_type TEXT NOT NULL, -- 'ui', 'api', 'unit', 'integration'
  verification_level INTEGER, -- 5 or 6 for UI/API
  test_name TEXT NOT NULL,
  expected_outcome TEXT,
  actual_outcome TEXT,
  pass_fail TEXT NOT NULL, -- 'pass', 'fail', 'pending'

  -- Artifact paths
  screenshot_before TEXT,
  screenshot_after TEXT,
  dom_snapshot TEXT,
  console_logs TEXT,
  network_trace TEXT,
  http_request TEXT,
  http_response TEXT,
  coverage_report TEXT,

  -- Metadata
  timestamp TIMESTAMP DEFAULT NOW(),
  duration_ms INTEGER,
  error_message TEXT,
  stack_trace TEXT
);

CREATE INDEX idx_evidence_epic ON evidence_artifacts(epic_id);
CREATE INDEX idx_evidence_test_type ON evidence_artifacts(test_type);
CREATE INDEX idx_evidence_pass_fail ON evidence_artifacts(pass_fail);
```

### UI Evidence Collection Pattern

```typescript
interface UITestEvidence {
  testId: string;
  testName: string;
  url: string;
  action: string;

  // Before state
  screenshotBefore: string; // file path
  domBefore: string;

  // After state
  screenshotAfter: string;
  domAfter: string;

  // Activity during test
  consoleLogs: ConsoleLog[];
  networkActivity: NetworkTrace[];

  // Result
  expectedOutcome: string;
  actualOutcome: string;
  passFail: 'pass' | 'fail';
}
```

### API Evidence Collection Pattern

```typescript
interface APITestEvidence {
  testId: string;
  testName: string;
  toolName: string;
  operation: string;

  // Request
  httpRequest: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: any;
  };

  // Response
  httpResponse: {
    status: number;
    headers: Record<string, string>;
    body: any;
    timing: number;
  };

  // Tool execution
  mcpToolCall: {
    tool: string;
    params: any;
    response: any;
  };

  // Result
  expectedOutcome: string;
  actualOutcome: string;
  passFail: 'pass' | 'fail';
}
```

---

## Model Selection

**Implementation:** Haiku
- File operations, database queries, artifact storage are deterministic
- Clear implementation plan with schemas and patterns
- No architectural decisions needed

**Testing:** Sonnet
- Needs to reason about evidence completeness
- Validate artifact integrity and metadata correctness
- Design test scenarios covering edge cases

---

## Estimated Effort

- **Schema design & migration**: 8 hours
- **EvidenceCollector base class**: 8 hours
- **UIEvidenceCollector (Level 5)**: 16 hours (screenshot, DOM, console, network)
- **APIEvidenceCollector (Level 6)**: 12 hours (HTTP, tool calls)
- **UnitTestEvidenceCollector**: 8 hours (test output, coverage)
- **EvidenceStorage (file + DB)**: 12 hours
- **EvidenceRetriever (query API)**: 8 hours
- **Unit tests**: 16 hours
- **Integration tests**: 12 hours

**Total: 100 hours (2.5 weeks)**

---

## Dependencies

**Blocked By:**
- None (foundational epic)

**Blocks:**
- Epic 006-B (Red Flag Detection - needs evidence to analyze)
- Epic 006-C (UI Test Executor - needs evidence collection)
- Epic 006-D (API Test Executor - needs evidence collection)
- Epic 006-E (Independent Verification - needs evidence to verify)

---

## Testing Approach

### Unit Tests

**EvidenceCollector:**
- [ ] Screenshot capture (mock Playwright)
- [ ] DOM snapshot capture (mock browser API)
- [ ] Console log capture (mock console)
- [ ] Network trace capture (mock network events)
- [ ] File system storage (temp directory)
- [ ] Database persistence (mock queries)

**EvidenceRetriever:**
- [ ] Query by epic ID (returns correct artifacts)
- [ ] Query by test type (filters correctly)
- [ ] Query by pass/fail status (filters correctly)
- [ ] Query by date range (returns correct range)

### Integration Tests

**End-to-End Evidence Collection:**
1. Simulate UI test execution
2. Verify screenshots captured before/after
3. Verify DOM snapshots saved
4. Verify console logs collected
5. Verify network traces saved
6. Verify database records created
7. Verify files exist on disk
8. Verify retrieval API returns correct artifacts

**API Test Evidence:**
1. Simulate MCP tool call
2. Verify HTTP request/response captured
3. Verify tool execution logged
4. Verify database records created
5. Verify retrieval API returns correct artifacts

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Large evidence files** (screenshots, traces) | High disk usage | Compression (gzip), retention policy (30 days), archive old epics |
| **Evidence collection failures** | False negatives (tests pass, no proof) | Retry collection, fail test if evidence missing, alert on collection errors |
| **Database bloat** | Performance degradation | Partition by month, index optimization, archive old evidence |
| **Screenshot timing issues** | Incorrect evidence (captured too early/late) | Wait for DOM ready, wait for network idle, configurable delays |

---

## Success Metrics

- **Evidence collection rate**: 100% of tests have artifacts (no missing evidence)
- **Artifact completeness**: All required fields populated (screenshots, logs, traces)
- **Storage efficiency**: <10MB average per test (with compression)
- **Retrieval latency**: <100ms to query evidence by epic ID
- **False negative rate**: 0% (never allow tests to pass without evidence)

---

**Next Steps After Completion:**
1. Implement Epic 006-B (Red Flag Detection using this evidence)
2. Update UI/API test executors to use evidence collectors
3. Create evidence viewer dashboard for debugging

---

**References:**
- Research on LLM hallucination in test execution
- BMAD validation guide: `/home/samuel/sv/docs/guides/bmad-complete-guide.md`
- Existing validation agent: `/home/samuel/sv/.claude/commands/subagents/validation/validate-acceptance-criteria.md`
