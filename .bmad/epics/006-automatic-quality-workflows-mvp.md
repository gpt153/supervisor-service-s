# Epic: Automatic Quality Workflows MVP (Verification + System Review)

**Epic ID:** 006
**Created:** 2026-01-19
**Status:** Draft
**Complexity Level:** 3

## Project Context

- **Project:** supervisor-service (meta infrastructure)
- **Repository:** /home/samuel/sv/supervisor-service/
- **Tech Stack:** Node.js, TypeScript, PostgreSQL, Claude Agent SDK, OpenAI API
- **Related Epics:** Epic #002 (Learning System Enhancement)
- **Workspace:** `/home/samuel/sv/supervisor-service/`
- **Analysis:** `/home/samuel/sv/.bmad/analysis/automatic-quality-workflows-analysis.md`

## Business Context

### Problem Statement

The supervisor system currently relies on manual verification after implementation. A non-technical user must check if files exist, tests pass, builds succeed, and implementations match plans. This creates three critical problems:

1. **Quality gaps**: Bugs and incomplete implementations reach the user before being caught
2. **Wasted time**: User must manually verify each completion, adding hours of overhead
3. **Lost knowledge**: Learnings from implementations are not systematically captured, causing repeated mistakes

The system needs to autonomously verify implementations, catch issues before user sees them, and extract learnings to improve over time.

### User Value

**For the non-technical user:**
- **Zero manual verification**: System catches bugs automatically before user sees results
- **Plain language reports**: "All tests passed" instead of parsing build output
- **Continuous improvement**: System learns from each implementation and gets better over time
- **Peace of mind**: Confidence that completed work is actually complete and correct

**For the supervisor system:**
- **Self-healing**: Auto-fix attempts repair common issues without user intervention
- **Knowledge accumulation**: Every epic generates learnings indexed for future reference
- **Quality assurance**: 90%+ of implementations verified automatically within 2 hours
- **Documentation maintenance**: Project CLAUDE.md stays current with discovered patterns

### Success Metrics

**Quantitative:**
- **Verification Coverage**: 90% of PIV completions verified automatically
- **First-time Pass Rate**: 70% of implementations pass verification on first attempt
- **Auto-fix Success**: 50% of verification failures fixed automatically
- **Learning Generation**: 80% of completed epics generate actionable learnings
- **Time Savings**: 90% reduction in manual verification time (user only reviews reports)

**Qualitative:**
- User can operate system via plain language without technical knowledge
- Verification reports are clear and actionable
- Generated learnings are specific and reusable
- System runs autonomously for days without requiring user intervention

## Requirements

### Functional Requirements (MoSCoW)

**MUST HAVE:**

- [ ] **Auto-spawn verification agent after PIV completion** - Triggers automatically when PR is created
- [ ] **File existence verification** - Check all files from plan were created
- [ ] **Build success verification** - Execute `npm run build` and parse output
- [ ] **Test success verification** - Execute `npm test` and parse output
- [ ] **Mock/placeholder detection** - Scan code for TODO, FIXME, mock implementations
- [ ] **Auto-fix retry loop** - Spawn fix agent on failure, retry verification (max 3 attempts)
- [ ] **Plain language reporting** - Non-technical summary of verification results
- [ ] **Auto-spawn system review agent after epic completion** - Triggers when all issues verified
- [ ] **Plan vs actual comparison** - Analyze epic plan against git commits and changed files
- [ ] **Learning extraction** - Identify patterns, deviations, successful strategies
- [ ] **RAG indexing of learnings** - Make learnings searchable for future confidence scoring
- [ ] **GitHub status updates** - Comment on issues/PRs with verification results

**SHOULD HAVE:**

- [ ] **CLAUDE.md auto-updates** - Append discovered patterns to project documentation
- [ ] **Verification timeout enforcement** - Max 2 hours from PIV completion to report
- [ ] **Fix agent escalation** - After 3 failed retries, alert user with clear problem description
- [ ] **Learning categorization** - Tag learnings by type (pattern, anti-pattern, tool usage, etc.)
- [ ] **Incremental verification** - Verify each issue in epic as it completes (don't wait for full epic)
- [ ] **Build/test caching** - Don't re-run successful builds unnecessarily
- [ ] **Verification history tracking** - Store verification results in database for analytics

**COULD HAVE:**

- [ ] **Parallel verification** - Verify multiple issues concurrently (if independent)
- [ ] **Custom verification rules per project** - Project-specific quality checks
- [ ] **Verification report formatting** - Markdown tables, color coding in terminal
- [ ] **Learning conflict resolution** - Detect when new learning contradicts old learning
- [ ] **Cross-project learning sharing** - Apply general learnings across all projects
- [ ] **Verification dashboard** - Web UI showing verification status across projects
- [ ] **Agent cost tracking** - Monitor OpenAI API usage for verification/review agents

**WON'T HAVE (this iteration):**

- **Confidence scoring before PIV starts** - Deferred to Phase 2 (Enhanced Intelligence)
- **Pattern detection in user messages** - Deferred to Phase 2
- **Proactive issue detection** - Future enhancement (scanning codebase for potential issues)
- **Multiple fix strategies in parallel** - Future enhancement (A/B testing fixes)
- **Isolated verification environments** - Start in same environment as PIV (simpler)
- **Advanced CLAUDE.md merging** - Start with append-only (manual review quarterly)

### Non-Functional Requirements

**Performance:**
- Verification spawn latency: < 5 seconds after PIV completion
- System review completion: < 30 minutes after epic marked complete
- RAG learning indexing: < 5 seconds per learning document
- No blocking user interactions (all automation runs asynchronously)

**Reliability:**
- False positive rate: < 10% (must not incorrectly report failures)
- Agent spawn success rate: > 99% (retry spawn on failure)
- Database consistency: All verification results persisted (survive restarts)
- Graceful degradation: If verification fails to spawn, log error but don't block user

**Security:**
- No secrets in verification reports (mask credentials, API keys)
- Git operations use atomic commits (no partial state)
- CLAUDE.md backups before updates (rollback on corruption)
- Agent access limited to project workspace (no system-wide modifications)

**Usability:**
- Verification reports written at 8th grade reading level
- No technical jargon unless necessary (explain when used)
- Clear next steps in failure reports ("fix by doing X, then run Y")
- User can override automation with simple commands ("skip verification")

## Architecture

### Technical Approach

**Pattern:** Event-driven automation with agent spawning

**Core Components:**
1. **PIV Event Hook** - Detects PIV completion, triggers verification spawn
2. **Verification Agent** - Independent agent that runs checks and reports results
3. **Fix Agent** - Spawned on verification failure, attempts repairs
4. **Epic Completion Detector** - Watches for all issues in epic verified
5. **System Review Agent** - Analyzes epic plan vs actual, extracts learnings
6. **Learning Indexer** - Embeds and indexes learnings to RAG system
7. **CLAUDE.md Updater** - Appends patterns to project documentation

**Agent Models:**
- Verification Agent: Claude Haiku (fast, cost-effective for checks)
- Fix Agent: Claude Sonnet 4.5 (needs reasoning for repairs)
- System Review Agent: Claude Sonnet 4.5 (needs deep analysis)

**State Management:**
- PostgreSQL tables for verification results, retry counts, timing data
- File system for learning documents (markdown in `/docs/supervisor-learnings/`)
- Git for CLAUDE.md versioning (atomic commits with rollback)

### Integration Points

**PIV Loop Integration:**
- Hook into PIV completion event (after PR creation)
- Read PIV plan from issue body or epic plan
- Extract file list, build commands, test commands from plan

**RAG System Integration:**
- Use existing `LearningsIndex.ts` for embedding generation
- Store embeddings in PostgreSQL vector column
- Query for similar learnings during confidence scoring (Phase 2)

**GitHub Integration:**
- Post verification results as issue comments
- Update PR description with verification status
- Use GitHub API for commit history during system review

**Database Schema:**
```sql
-- Verification results
CREATE TABLE verification_results (
  id SERIAL PRIMARY KEY,
  issue_id INTEGER NOT NULL,
  pr_url TEXT,
  timestamp TIMESTAMP DEFAULT NOW(),
  status TEXT, -- 'passed', 'failed', 'retrying', 'fixed'
  checks JSONB, -- {files: true, build: false, tests: true, mocks: false}
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  fix_agent_session_id TEXT
);

-- Learning documents
CREATE TABLE learnings (
  id SERIAL PRIMARY KEY,
  epic_id INTEGER,
  file_path TEXT, -- path to markdown file
  category TEXT, -- 'pattern', 'anti-pattern', 'tool-usage', etc.
  tags TEXT[], -- for filtering
  embedding VECTOR(1536), -- OpenAI embedding
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Data Flow

```
PIV Completion (PR created)
    ↓
PIV Event Hook detects completion
    ↓
Spawn Verification Agent (Haiku)
    ↓
Verification Agent runs checks:
  - Files exist?
  - Build succeeds?
  - Tests pass?
  - Mocks/placeholders present?
    ↓
  [PASS] → Report to user + Update GitHub
    ↓
  Epic complete?
    ↓
  [YES] → Spawn System Review Agent
          ↓
          Extract learnings → Index to RAG → Update CLAUDE.md
    ↓
  [FAIL] → Spawn Fix Agent (Sonnet)
    ↓
  Fix Agent attempts repair
    ↓
  Retry verification (retry_count++)
    ↓
  [Still failing after 3 retries?]
    ↓
  [YES] → Escalate to user with clear error report
```

### Key Technical Decisions

**Decision 1: Use Claude Haiku for verification**
- **Rationale**: Verification is deterministic (run commands, parse output). Haiku is 10x cheaper and 5x faster than Sonnet.
- **Trade-off**: Less capable for complex reasoning, but verification doesn't need reasoning.

**Decision 2: Append-only CLAUDE.md updates**
- **Rationale**: Intelligent merging is complex and error-prone. Append new patterns to end, manual quarterly review.
- **Trade-off**: CLAUDE.md can grow long, but safer than corrupting existing content.
- **See**: Open question in analysis (section 10)

**Decision 3: Max 3 auto-fix retries**
- **Rationale**: Prevent infinite loops. Most fixes succeed in 1-2 attempts. After 3, user intervention needed.
- **Trade-off**: Some issues might be fixable with 4+ attempts, but risk of wasted agent costs.

**Decision 4: Same environment for verification**
- **Rationale**: Simpler to implement, matches user's actual runtime environment.
- **Trade-off**: Verification can't catch environment-specific issues. Defer isolated containers to v2.
- **See**: Open question in analysis (section 10)

### Files to Create/Modify

```
supervisor-service/src/
├── automation/
│   ├── PIVEventHook.ts          # NEW - Detects PIV completion
│   ├── VerificationSpawner.ts   # NEW - Spawns verification agent
│   ├── EpicCompletionDetector.ts # NEW - Watches for epic completion
│   ├── SystemReviewSpawner.ts   # NEW - Spawns review agent
│   └── LearningIndexer.ts       # NEW - Indexes learnings to RAG
├── verification/
│   ├── VerificationRunner.ts    # NEW - Runs checks (build, test, files)
│   ├── MockDetector.ts          # NEW - Scans for TODO, FIXME, mocks
│   ├── FixAgentSpawner.ts       # NEW - Spawns fix agent on failure
│   └── ResultReporter.ts        # NEW - Formats plain language reports
├── review/
│   ├── PlanComparator.ts        # NEW - Compares epic plan vs actual
│   ├── LearningExtractor.ts     # NEW - Extracts patterns from commits
│   └── ClaudeMdUpdater.ts       # NEW - Appends to CLAUDE.md safely
├── db/
│   ├── migrations/
│   │   └── 009_verification.sql # NEW - Verification tables
│   └── queries/
│       ├── verification.ts      # NEW - Verification CRUD
│       └── learnings.ts         # MODIFY - Add embedding storage
└── types/
    ├── verification.ts          # NEW - Verification types
    └── learning.ts              # NEW - Learning types

.claude/commands/automation/
├── verify-implementation.md     # NEW - Verification agent prompt
├── fix-implementation.md        # NEW - Fix agent prompt
└── review-epic.md               # NEW - System review agent prompt

docs/supervisor-learnings/
└── (learning markdown files generated here)

tests/
├── automation.test.ts           # NEW - Automation tests
├── verification.test.ts         # NEW - Verification tests
└── review.test.ts               # NEW - Review tests
```

## Implementation Tasks

### Breakdown into GitHub Issues

**Issue #XX: Database schema for verification results**
- Create `verification_results` table
- Create `learnings` table with vector column
- Add indexes for querying by issue_id, epic_id
- Migration rollback script
- **Acceptance**: Migration runs successfully, tables queryable

**Issue #XX: PIV event hook and verification spawner**
- Detect PIV completion (monitor for PR creation events)
- Extract plan from epic/issue
- Spawn verification agent with plan context
- Handle spawn failures (retry, log errors)
- **Acceptance**: Verification agent spawns within 5 seconds of PIV completion

**Issue #XX: Verification runner (build, test, files)**
- Execute `npm run build` and capture output
- Execute `npm test` and capture output
- Parse output for success/failure
- Check file existence from plan
- Store results in database
- **Acceptance**: All checks run and results stored correctly

**Issue #XX: Mock/placeholder detector**
- Scan changed files for `TODO`, `FIXME`, `PLACEHOLDER`
- Detect mock function patterns (e.g., `return { mock: true }`)
- Detect incomplete implementations (throw not implemented)
- Report findings to verification runner
- **Acceptance**: Common mock patterns detected with <5% false positives

**Issue #XX: Fix agent spawner and retry loop**
- On verification failure, spawn fix agent (Sonnet)
- Pass verification errors to fix agent
- Track retry count (max 3)
- Re-run verification after fix
- Escalate to user after 3 failures
- **Acceptance**: Fix loop retries correctly, escalates after 3 attempts

**Issue #XX: Verification result reporter**
- Format verification results in plain language
- Generate clear error messages (no stack traces to user)
- Post results as GitHub issue comment
- Update database with final status
- **Acceptance**: Reports readable by non-technical user

**Issue #XX: Epic completion detector**
- Monitor all issues in epic
- Detect when all issues verified (passed or escalated)
- Trigger system review spawn
- **Acceptance**: System review triggers within 1 minute of last issue verified

**Issue #XX: Plan comparator (epic plan vs actual)**
- Load original epic plan from file
- Extract git commit history for epic
- List all files changed during epic
- Compare planned tasks vs actual commits
- Identify deviations (features added/removed/changed)
- **Acceptance**: Comparison generates accurate deviation list

**Issue #XX: Learning extractor**
- Analyze deviations for patterns
- Extract successful strategies (what worked well)
- Extract anti-patterns (what should be avoided)
- Extract tool/technique learnings
- Generate markdown learning documents
- **Acceptance**: Learnings are specific, actionable, and categorized

**Issue #XX: RAG learning indexer**
- Generate embeddings for learning documents
- Store embeddings in PostgreSQL vector column
- Index for semantic search
- Test retrieval (query similar learnings)
- **Acceptance**: Learnings retrievable via semantic search with >80% relevance

**Issue #XX: CLAUDE.md updater (safe append)**
- Read current CLAUDE.md
- Create backup (git commit before update)
- Append new patterns section
- Atomic file write (no partial updates)
- Rollback on error
- **Acceptance**: CLAUDE.md updated without corruption, rollback works

**Issue #XX: Verification agent prompts**
- Create `.claude/commands/automation/verify-implementation.md`
- Instructions for running checks
- Result formatting guidelines
- Error handling patterns
- **Acceptance**: Prompt generates correct verification reports

**Issue #XX: Fix agent prompts**
- Create `.claude/commands/automation/fix-implementation.md`
- Instructions for analyzing verification errors
- Common fix patterns (missing imports, typos, etc.)
- Constraints (don't change API contracts)
- **Acceptance**: Prompt fixes common issues successfully

**Issue #XX: System review agent prompts**
- Create `.claude/commands/automation/review-epic.md`
- Instructions for comparing plan vs actual
- Pattern extraction guidelines
- Learning document templates
- **Acceptance**: Prompt generates actionable learnings

**Issue #XX: Integration tests (end-to-end)**
- Test: PIV completion → verification spawn → report
- Test: Verification failure → fix attempt → retry → pass
- Test: Epic completion → system review → learning indexed
- Test: CLAUDE.md update with rollback
- **Acceptance**: All integration tests pass

**Issue #XX: User documentation**
- Document how auto-verification works
- Document how to skip verification (override command)
- Document learning format and categorization
- Document verification report interpretation
- **Acceptance**: Non-technical user understands system behavior

### Estimated Effort

**Backend (automation, verification, review):**
- PIV event hook: 8 hours
- Verification runner: 12 hours
- Mock detector: 8 hours
- Fix agent loop: 12 hours
- Plan comparator: 16 hours
- Learning extractor: 16 hours
- RAG indexer: 8 hours
- CLAUDE.md updater: 12 hours
- **Subtotal: 92 hours**

**Database:**
- Schema design: 4 hours
- Migration: 4 hours
- Queries: 8 hours
- **Subtotal: 16 hours**

**Agent Prompts:**
- Verification prompt: 4 hours
- Fix prompt: 4 hours
- Review prompt: 8 hours
- **Subtotal: 16 hours**

**Testing:**
- Unit tests: 16 hours
- Integration tests: 16 hours
- Manual testing: 8 hours
- **Subtotal: 40 hours**

**Documentation:**
- User documentation: 8 hours
- Technical documentation: 8 hours
- **Subtotal: 16 hours**

**Total: 180 hours (4.5 weeks at 40 hours/week, or 6 weeks with buffer)**

## Acceptance Criteria

### Feature-Level Acceptance

**Auto-Verification:**
- [ ] 90%+ of PIV completions trigger verification automatically
- [ ] Verification spawn latency < 5 seconds
- [ ] File existence checks detect missing files accurately
- [ ] Build verification parses output correctly (success/failure)
- [ ] Test verification parses output correctly (pass/fail counts)
- [ ] Mock detection identifies TODO, FIXME, placeholder patterns
- [ ] Fix agent spawns on verification failure
- [ ] Retry loop enforces max 3 attempts
- [ ] Escalation to user after 3 failures includes clear error description
- [ ] Verification reports are non-technical and actionable
- [ ] GitHub issues/PRs updated with verification status

**Auto-System Review:**
- [ ] Epic completion detected within 1 minute of last issue verified
- [ ] System review agent spawns automatically
- [ ] Plan vs actual comparison identifies major deviations
- [ ] Learning extraction generates 3-5 learnings per epic
- [ ] Learnings are categorized (pattern, anti-pattern, tool-usage)
- [ ] RAG indexing makes learnings searchable
- [ ] CLAUDE.md updates append cleanly without corruption
- [ ] Git commits include review artifacts
- [ ] System review completes within 30 minutes

**Quality:**
- [ ] False positive rate < 10% (verified manually on 20 test cases)
- [ ] False negative rate < 5% (no missed real issues)
- [ ] 70%+ of implementations pass verification on first attempt
- [ ] 50%+ of failures fixed automatically by fix agent
- [ ] 80%+ of epics generate useful learnings

**Code Quality:**
- [ ] Type-safe (no `any` types except necessary external APIs)
- [ ] No security vulnerabilities (npm audit clean)
- [ ] No hardcoded secrets (use environment variables)
- [ ] Error handling on all agent spawns
- [ ] Database transactions for consistency
- [ ] Atomic file operations for CLAUDE.md

**Documentation:**
- [ ] User guide explains auto-verification workflow
- [ ] User guide explains how to override automation
- [ ] Technical docs describe agent prompts and integration points
- [ ] README updated with new automation features

## Dependencies

**Blocked By:**
- None (all infrastructure exists: PIV loop, RAG, timing DB, learnings)

**Blocks:**
- Epic #XXX: Auto-Confidence Scoring (Phase 2) - Requires learning corpus from this epic

**External Dependencies:**
- **GitHub API**: For posting verification results, creating commits
- **Claude Agent SDK**: For spawning verification/fix/review agents
- **OpenAI API**: For generating embeddings (RAG indexing)
- **PostgreSQL**: For storing verification results and learning embeddings
- **Git**: For atomic CLAUDE.md updates and rollback

## Risks & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **False positives in verification** | High | Medium | Strict verification criteria, manual test suite, user override option |
| **CLAUDE.md corruption during update** | Medium | High | Atomic writes, git backup before update, rollback on error, append-only strategy |
| **Infinite fix-retry loops** | Medium | High | Hard limit of 3 retries, timeout enforcement, escalation to user |
| **Verification agent spawn failures** | Low | Medium | Retry spawn logic, fallback to user notification if spawn fails 3x |
| **RAG returns irrelevant learnings** | Medium | Medium | Similarity threshold tuning (>0.7), manual curation of learning corpus |
| **Build/test failures due to environment** | Medium | Medium | Distinguish environment issues from code issues (heuristics), user can skip verification |
| **GitHub API rate limits** | Low | Medium | Batch requests, cache PR/issue data, exponential backoff on 429 errors |
| **Fix agent makes implementation worse** | Medium | Medium | Git diff before/after fix, rollback if verification still fails, max 3 attempts |
| **System review takes too long** | Low | Low | Background processing (don't block user), timeout after 30 minutes |
| **User confusion from automation** | Medium | Low | Clear plain language reports, opt-out commands, documentation |

## Testing Strategy

### Unit Tests

**Verification Runner:**
- Mock build command success/failure
- Mock test command success/failure
- File existence checks
- Output parsing (exit codes, stdout/stderr)

**Mock Detector:**
- Detect `TODO`, `FIXME`, `PLACEHOLDER` in code
- Detect mock function patterns
- Detect `throw new Error('Not implemented')`
- False positive rate < 5%

**Learning Extractor:**
- Parse epic plan markdown
- Extract git commit history
- Identify deviations
- Generate learning documents

**CLAUDE.md Updater:**
- Append to file
- Atomic write behavior
- Rollback on error
- Backup creation

### Integration Tests

**End-to-End Verification Flow:**
1. Simulate PIV completion (create PR)
2. Verify verification agent spawns
3. Verify checks run (build, test, files, mocks)
4. Verify results stored in database
5. Verify GitHub comment posted

**Auto-Fix Flow:**
1. Simulate verification failure (inject failing test)
2. Verify fix agent spawns
3. Verify fix applied (git diff)
4. Verify verification retried
5. Verify escalation after 3 failures

**System Review Flow:**
1. Simulate epic completion (all issues verified)
2. Verify review agent spawns
3. Verify plan comparison runs
4. Verify learnings generated
5. Verify RAG indexing completes
6. Verify CLAUDE.md updated
7. Verify git commit created

### Manual Testing Checklist

**Verification:**
- [ ] PIV completes → Verification spawns within 5 seconds
- [ ] All files from plan exist → Verification passes
- [ ] Missing file → Verification fails with clear message
- [ ] Build fails → Verification fails with build error
- [ ] Tests fail → Verification fails with test error
- [ ] TODO in code → Verification fails with mock warning
- [ ] Verification passes → GitHub comment "All checks passed"

**Auto-Fix:**
- [ ] Verification fails → Fix agent spawns
- [ ] Fix agent corrects issue → Verification retries and passes
- [ ] Fix agent can't fix → Escalates after 3 retries
- [ ] Escalation message is clear and non-technical

**System Review:**
- [ ] Epic completes → Review agent spawns within 1 minute
- [ ] Review compares plan vs actual commits
- [ ] Learnings generated (3-5 per epic)
- [ ] Learnings indexed to RAG (searchable)
- [ ] CLAUDE.md updated with new patterns
- [ ] Git commit includes learnings and updated CLAUDE.md

**Error Handling:**
- [ ] Agent spawn fails → Retry, then notify user
- [ ] Build command times out → Report timeout error
- [ ] GitHub API error → Retry with exponential backoff
- [ ] CLAUDE.md update fails → Rollback to backup

## Notes

### Design Decisions

**Why automatic instead of user-triggered?**
- Non-technical user shouldn't need to remember verification commands
- Automation ensures consistent quality (no skipped verifications)
- User only sees results, not process (better UX)

**Why max 3 retries for fix agent?**
- Most fixable issues resolved in 1-2 attempts (based on informal observation)
- 3 retries prevent infinite loops while giving reasonable chance of success
- After 3 failures, issue likely requires user understanding/decision

**Why Haiku for verification, Sonnet for fixing?**
- Verification is deterministic (run commands, parse output), doesn't need deep reasoning
- Haiku is 10x cheaper and 5x faster, reducing costs and latency
- Fixing requires understanding code context, reasoning about errors (Sonnet's strength)

**Why append-only CLAUDE.md updates?**
- Intelligent merging risks corrupting existing documentation
- Append is safe, simple, and auditable (git diff shows exactly what was added)
- Quarterly manual review can consolidate/organize appended patterns

**Why same environment for verification instead of isolated?**
- Simpler to implement (no Docker/container setup)
- Matches user's actual runtime environment (catches real issues)
- Isolated environments deferred to v2 (when we need reproducible environments)

### Known Limitations

**What this epic does NOT include:**
- Confidence scoring before implementation starts (Phase 2)
- Pattern detection in user messages (Phase 2)
- Cross-project learning sharing (future enhancement)
- Advanced CLAUDE.md merging (append-only for now)
- Isolated verification environments (same environment as PIV)
- Parallel verification of multiple issues (sequential for MVP)
- Custom verification rules per project (standard checks only)

**Why these limitations?**
- MVP focuses on highest ROI features (verification + review)
- Confidence scoring and pattern detection require learning corpus (built by this epic)
- Advanced features add complexity without proportional value in MVP

### Future Enhancements

**Phase 2 (Enhanced Intelligence):**
- Auto-confidence scoring before PIV starts
- Pattern detection in user messages
- Suggestion engine (parallel/sequential, pattern reuse)

**Phase 3 (Integration & Polish):**
- Timing estimate integration (display estimates to user)
- Performance optimization (caching, background processing)
- Monitoring dashboard (verification health across projects)

**Future v2+:**
- Isolated verification environments (Docker containers)
- Parallel verification of independent issues
- Custom verification rules per project
- Cross-project learning sharing
- Proactive issue detection (scan codebase before implementation)
- Multiple fix strategies in parallel (A/B testing fixes)
- Advanced CLAUDE.md merging (intelligent pattern consolidation)

### References

- **Analysis**: `/home/samuel/sv/.bmad/analysis/automatic-quality-workflows-analysis.md`
- **PIV Loop**: `/home/samuel/sv/.claude/commands/supervision/piv-supervise.md`
- **RAG System**: `/home/samuel/sv/supervisor-service/src/rag/LearningsIndex.ts`
- **Task Timer**: `/home/samuel/sv/supervisor-service/src/timing/TaskTimer.ts`
- **Learning System**: `/home/samuel/sv/docs/supervisor-learnings/`
- **SCAR Architecture**: `/home/samuel/sv/docs/SCAR-ARCHITECTURE-AND-SUPERVISOR-INTEGRATION.md`

---

**Epic Status:** Ready for review and breakdown into GitHub issues
**Next Steps:** Review with stakeholder, adjust scope if needed, create GitHub issues
