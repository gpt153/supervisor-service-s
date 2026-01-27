# Feature Request: Automatic Quality Workflows

**Created**: 2026-01-27
**Status**: Draft
**Complexity**: Level 3 (Large Feature)
**Priority**: High
**Planning Track**: Enterprise

---

## One-Sentence Summary

An autonomous quality assurance system that automatically verifies implementations after each epic completion, attempts auto-fixes for common failures, and extracts learnings to continuously improve supervisor capabilities without manual intervention.

---

## Problem Statement

The supervisor system currently relies on manual verification after implementation, creating three critical problems:

1. **Quality gaps** - Bugs and incomplete implementations reach the user before being caught
2. **Wasted time** - User must manually verify each completion, adding hours of overhead
3. **Lost knowledge** - Learnings from implementations are not systematically captured, causing repeated mistakes

### Current State Analysis

**What We Have:**

✅ **Validation Subagent** (`validate-acceptance-criteria.md`)
- Parses epic acceptance criteria
- Executes tests (unit, integration, manual, automated)
- Generates validation reports in `.bmad/features/{feature}/reports/`
- Updates epic status to "completed" if all criteria pass
- Triggers PRD update automatically (version bump, changelog, epic status)
- **Status**: Working, must be manually spawned

✅ **Epic Completion Handler** (`epic-completion-handler.md`)
- Orchestrates post-epic workflow
- Spawns validation agent
- Handles validation results (pass/fail/partial)
- Implements fix-retry loop (max 3 attempts)
- Creates handoffs for persistent failures
- **Status**: Working, coordinates validation + fixes

✅ **PIV Completion Detection**
- PIV loop completes and creates PR
- **Gap**: No automatic trigger for validation agent

✅ **Learning System** (`/docs/supervisor-learnings/`)
- Markdown-based learnings
- Categorization and tagging
- Problem-solution documentation
- **Gap**: No automatic extraction after epic completion

✅ **RAG System** (`/src/rag/LearningsIndex.ts`)
- Semantic search for learnings
- Vector similarity
- Already indexes learnings
- **Status**: Working, ready for auto-indexing

**What's Missing:**

❌ **Auto-Spawn After PIV Completion**
- Validation agent must be manually spawned
- No event hook detecting PR creation
- 5-10 minute delay while waiting for manual spawn

❌ **Auto-Fix Retry Loop**
- Epic completion handler has the logic
- But it's not triggered automatically
- Fix attempts require manual restart

❌ **Learning Extraction After Epic**
- No system review agent
- No plan vs actual comparison
- No automatic learning generation
- Learnings created manually (rarely happens)

❌ **Plain Language Reporting**
- Validation reports are technical
- No user-friendly summaries
- User must parse test output

❌ **Quality Metrics Tracking**
- No database for verification results
- No history of success/failure rates
- No coverage tracking
- Can't measure improvement over time

❌ **Action Logging System**
- No centralized log of all PS actions
- Can't track what worked vs what failed
- Can't detect patterns in PS behavior
- Referenced in Epic 006 but not implemented

### Where PSes Get Stuck

**Common Quality Loops:**

1. **Epic completes** → User verifies → Finds bugs → PS fixes → User re-verifies (repeat)
2. **Tests fail** → PS analyzes → Fixes → Tests pass but new failure (repeat)
3. **Implementation incomplete** → Missing acceptance criteria → PS adds → Re-validate (repeat)
4. **Learning not captured** → Same mistake next epic → Manual reminder to PS → Repeat

**Time Wasted:**
- 15-30 min manual verification per epic
- 20+ epics/month = 5-10 hours wasted monthly
- Could be automated to <5 min total

---

## User Impact

**Primary Users:** Project Supervisors (PSes) + Samuel (non-technical user)

**Current Pain Points:**
- User must manually verify every epic completion
- User must manually spawn validation agents
- User must track which epics passed vs failed
- User doesn't get plain language reports
- Learnings are lost without manual extraction

**Expected Value:**
- **Zero manual verification** - System catches bugs automatically before user sees results
- **Plain language reports** - "All tests passed" instead of parsing build output
- **Continuous improvement** - System learns from each implementation and gets better over time
- **Peace of mind** - Confidence that completed work is actually complete and correct
- **Time savings** - 90% reduction in manual verification time (5-10 hours → 30 min monthly)

---

## Business Context

**What Happens If We Don't Build This:**
- Quality gaps continue causing user frustration
- Manual verification time increases as more projects added
- Learnings lost causing repeated mistakes
- No measurable improvement in PS capabilities
- User burnout from constant manual QA

**Timeline:** High priority - enables autonomous supervision goal

**Dependencies:**
- ✅ Validation subagent (exists)
- ✅ Epic completion handler (exists)
- ✅ RAG system (exists)
- ✅ Learning system (exists)
- ❌ Action logging (not implemented - separate feature)

---

## Requirements (MoSCoW)

### MUST HAVE (MVP)

**Auto-Spawn Verification After PIV Completion:**
- [ ] Detect PIV completion (PR created) automatically
- [ ] Spawn validation agent within 5 seconds
- [ ] No manual intervention required
- [ ] Handle spawn failures (retry, log errors)

**File Existence Verification:**
- [ ] Check all files from plan were created
- [ ] Detect missing files
- [ ] Report missing files in plain language

**Build/Test Success Verification:**
- [ ] Execute `npm run build` and parse output
- [ ] Execute `npm test` and parse output
- [ ] Distinguish build vs test failures
- [ ] Extract error messages clearly

**Mock/Placeholder Detection:**
- [ ] Scan code for TODO, FIXME, PLACEHOLDER
- [ ] Detect mock function patterns (`return { mock: true }`)
- [ ] Detect incomplete implementations (`throw new Error('Not implemented')`)
- [ ] Report findings in validation report

**Auto-Fix Retry Loop:**
- [ ] Spawn fix agent on verification failure
- [ ] Max 3 retry attempts
- [ ] Re-run verification after each fix
- [ ] Escalate to user after 3 failures

**Plain Language Reporting:**
- [ ] Non-technical summary of verification results
- [ ] "All tests passed" vs "2 tests failed: [list]"
- [ ] Clear next steps in failure reports
- [ ] GitHub issue/PR comments with status

**System Review After Epic Completion:**
- [ ] Spawn system review agent after all issues verified
- [ ] Compare epic plan vs actual implementation
- [ ] Identify deviations (features added/removed/changed)
- [ ] Extract successful patterns

**Learning Extraction:**
- [ ] Analyze deviations for patterns
- [ ] Extract anti-patterns (what failed)
- [ ] Extract successful strategies (what worked)
- [ ] Generate markdown learning documents
- [ ] Store in `/docs/supervisor-learnings/`

**RAG Indexing of Learnings:**
- [ ] Generate embeddings for learning documents
- [ ] Store embeddings in PostgreSQL
- [ ] Make learnings searchable
- [ ] Query for similar learnings (future: confidence scoring)

**CRITICAL: Validation Triggers PRD Updates**
- [ ] Validation agent already updates PRD automatically
- [ ] This MUST remain mandatory - never skip
- [ ] PRD version bump on epic completion
- [ ] Changelog generation
- [ ] Epic status tracking

### SHOULD HAVE (v1.1)

**CLAUDE.md Auto-Updates:**
- [ ] Append discovered patterns to project documentation
- [ ] Atomic file operations (backup before update)
- [ ] Rollback on corruption
- [ ] Git commits with pattern updates

**Verification Timeout Enforcement:**
- [ ] Max 2 hours from PIV completion to report
- [ ] Timeout warning at 90 minutes
- [ ] Automatic escalation if timeout exceeded

**Fix Agent Escalation:**
- [ ] After 3 failed retries, alert user
- [ ] Clear problem description
- [ ] Suggested next steps
- [ ] Handoff document creation

**Learning Categorization:**
- [ ] Tag learnings by type (pattern, anti-pattern, tool usage)
- [ ] Tag by project (project-specific vs general)
- [ ] Tag by complexity level
- [ ] Searchable by tags

**Incremental Verification:**
- [ ] Verify each issue in epic as it completes
- [ ] Don't wait for full epic
- [ ] Faster feedback loops

**Verification History Tracking:**
- [ ] Store verification results in database
- [ ] Track success/failure rates over time
- [ ] Measure improvement metrics
- [ ] Generate quality analytics

### COULD HAVE (v2.0)

**Parallel Verification:**
- [ ] Verify multiple issues concurrently (if independent)
- [ ] Faster epic completion

**Custom Verification Rules:**
- [ ] Project-specific quality checks
- [ ] Custom test patterns
- [ ] Domain-specific validations

**Learning Conflict Resolution:**
- [ ] Detect when new learning contradicts old learning
- [ ] Version learnings
- [ ] Mark superseded learnings

**Cross-Project Learning Sharing:**
- [ ] Apply general learnings across all projects
- [ ] Detect project-agnostic patterns

**Verification Dashboard:**
- [ ] Web UI showing verification status across projects
- [ ] Quality metrics visualization

**Agent Cost Tracking:**
- [ ] Monitor OpenAI API usage for verification/review agents
- [ ] Optimize model selection based on cost

### WON'T HAVE (This Iteration)

**Explicitly Not Building:**
- ❌ Confidence scoring before PIV starts (Phase 2 - requires learning corpus)
- ❌ Pattern detection in user messages (Phase 2)
- ❌ Proactive issue detection (Future enhancement)
- ❌ Multiple fix strategies in parallel (Future A/B testing)
- ❌ Isolated verification environments (Start in same environment)
- ❌ Advanced CLAUDE.md merging (Start with append-only)

**Deferred to Separate Feature:**
- ❌ Action logging system (separate feature request needed)
- ❌ Quality metrics dashboard (v2.0)

---

## Technical Context

### Current Infrastructure

**PIV Loop Integration:**
- Hook into PIV completion event (after PR creation)
- Read PIV plan from issue body or epic plan
- Extract file list, build commands, test commands from plan

**RAG System Integration:**
- Use existing `LearningsIndex.ts` for embedding generation
- Store embeddings in PostgreSQL vector column
- Query for similar learnings (future: confidence scoring)

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

### Integration Points

**Existing Components:**
1. **Validation Agent** - Already working, needs auto-spawn
2. **Epic Completion Handler** - Already working, needs auto-trigger
3. **RAG System** - Ready for learning indexing
4. **Learning System** - Ready for auto-generation

**New Components Needed:**
1. **PIV Event Hook** - Detect PIV completion
2. **Verification Spawner** - Auto-spawn validation agent
3. **System Review Agent** - Extract learnings
4. **Learning Indexer** - RAG integration
5. **CLAUDE.md Updater** - Safe pattern appending

### Data Flow

```
PIV Completion (PR created)
    ↓
PIV Event Hook detects completion
    ↓
Spawn Validation Agent (Haiku)
    ↓
Validation runs checks:
  - Files exist?
  - Build succeeds?
  - Tests pass?
  - Mocks/placeholders?
  - Updates PRD automatically (version, changelog, status)
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
  Retry validation (retry_count++)
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
- **See**: ADR 006-claude-md-update-strategy.md

**Decision 3: Max 3 auto-fix retries**
- **Rationale**: Prevent infinite loops. Most fixes succeed in 1-2 attempts. After 3, user intervention needed.
- **Trade-off**: Some issues might be fixable with 4+ attempts, but risk of wasted agent costs.

**Decision 4: Same environment for verification**
- **Rationale**: Simpler to implement, matches user's actual runtime environment.
- **Trade-off**: Verification can't catch environment-specific issues. Defer isolated containers to v2.

**Decision 5: Mandatory PRD Updates**
- **Rationale**: Validation success must trigger PRD updates (version, changelog, epic status). This keeps documentation current.
- **Trade-off**: None - this is already implemented and working.

### Files to Create/Modify

```
supervisor-service/src/
├── automation/
│   ├── PIVEventHook.ts          # NEW - Detects PIV completion
│   ├── VerificationSpawner.ts   # NEW - Spawns validation agent
│   ├── EpicCompletionDetector.ts # NEW - Watches for epic completion
│   ├── SystemReviewSpawner.ts   # NEW - Spawns review agent
│   └── LearningIndexer.ts       # NEW - Indexes learnings to RAG
├── verification/
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

---

## Success Criteria

**Quantitative Metrics (MVP):**
- ✅ Verification Coverage: 90% of PIV completions verified automatically
- ✅ Verification Pass Rate: 70% pass on first attempt
- ✅ Auto-Fix Success: 50% of failures fixed automatically
- ✅ Learning Generation: 80% of epics generate useful learnings
- ✅ False Positive Rate: <10% (incorrect failure detection)
- ✅ Response Latency: <5s for verification spawn, <30min for system review
- ✅ PRD Update Success: 100% of validation passes trigger PRD update

**Qualitative Metrics:**
- ✅ User can operate system via plain language without technical knowledge
- ✅ Verification reports are clear and actionable
- ✅ Generated learnings are specific and reusable
- ✅ System runs autonomously for days without requiring user intervention

**Non-Functional:**
- ✅ Agent spawn success rate: >99% (retry spawn on failure)
- ✅ Database consistency: All verification results persisted
- ✅ Graceful degradation: If verification fails to spawn, log error but don't block user
- ✅ No secrets in verification reports (mask credentials, API keys)

---

## Scope Boundaries

**Definitely IN Scope:**
- Auto-spawn verification after PIV completion
- Auto-fix retry loop (max 3 attempts)
- Learning extraction after epic completion
- RAG indexing of learnings
- Plain language reporting
- CLAUDE.md updates (append-only)
- Mandatory PRD updates on validation pass

**Explicitly OUT of Scope:**
- Confidence scoring before PIV starts (Phase 2)
- Pattern detection in user messages (Phase 2)
- Action logging system (separate feature)
- Quality metrics dashboard (v2.0)
- Isolated verification environments (start same environment)
- Advanced CLAUDE.md merging (append-only for MVP)

---

## Open Questions

### Technical Questions

1. **How to detect when epic is "complete" to trigger validation?**
   - **Recommendation**: Monitor for PR creation event in PIV loop
   - **Alternative**: Watch `.agents/active-piv.json` for status change

2. **Should auto-fix spawn haiku or sonnet agents?**
   - **Recommendation**: Sonnet for fixes (needs reasoning about errors)
   - **From ADR 004**: Haiku for verification, Sonnet for fixing/review

3. **Where to store quality metrics (database schema)?**
   - **Recommendation**: `verification_results` table with JSONB for flexible metrics
   - **Also track**: `learnings` table with vector embeddings

4. **Integration with action log system?**
   - **Decision**: Action logging is separate feature request
   - **For MVP**: Focus on verification/learning extraction only
   - **Future**: Integrate when action logging implemented

5. **CLAUDE.md update strategy?**
   - **Resolved in ADR 006**: Append-only, manual quarterly review
   - **Backup before update**, rollback on corruption

6. **Learning conflict detection?**
   - **Defer to v2.0**: Manual curation for MVP
   - **Future**: Version learnings, mark superseded

### Process Questions

1. **How aggressive should auto-fix be?**
   - **Recommendation**: Conservative - only fix what validation explicitly failed
   - **Max 3 retries** prevents infinite loops

2. **When to escalate vs retry autonomously?**
   - **After 3 retries** or **2 hours elapsed**, escalate
   - **Partial validation** (manual tests pending) → handoff

3. **Should PRD update be mandatory or optional?**
   - **CRITICAL: MANDATORY** - Already implemented and working
   - **Never skip** - Keeps documentation current automatically

4. **Cross-project learning application?**
   - **Tag learnings** as "project-specific" or "general"
   - **Filter accordingly** during retrieval

---

## Constraints

**Technical:**
- Must work with existing validation agent (no breaking changes)
- Must maintain backward compatibility with existing PRD update workflow
- Must not disrupt running PIV loops
- Must handle concurrent epic completions safely

**Operational:**
- Zero-downtime deployment required
- Must survive PS restarts (persist state)
- Database must be backed up automatically
- PRD updates must always happen when validation passes

**Resource:**
- Minimal CPU/memory overhead (<100MB RAM, <1% CPU)
- Database storage <100MB expected
- Agent cost optimization (Haiku for verification, Sonnet for fixes/review)

---

## Dependencies

**Blockers (Must Exist Before Implementation):**
- ✅ Validation subagent (exists)
- ✅ Epic completion handler (exists)
- ✅ RAG system (exists)
- ✅ Learning system (exists)
- ✅ PIV loop (exists)
- ✅ PRD update workflow (exists and working)

**Parallel Dependencies (Can Build Alongside):**
- Action logging system (separate feature, not required for MVP)

**Blocks (Enables Future Work):**
- Phase 2: Confidence scoring (requires learning corpus from this epic)
- Phase 2: Pattern detection (requires learnings)
- Future: Quality metrics dashboard (requires verification history)

---

## Related Features & Context

**Related Epics:**
- Epic 006: Automatic Quality Workflows MVP (this feature request)
- Epic 002: Learning System Enhancement (foundation)
- ADR 004: Agent Model Selection for Quality Workflows
- ADR 006: CLAUDE.md Update Strategy

**Related Documentation:**
- `/home/samuel/sv/.claude/commands/subagents/validation/validate-acceptance-criteria.md`
- `/home/samuel/sv/.claude/commands/subagents/orchestration/epic-completion-handler.md`
- `/home/samuel/sv/supervisor-service/src/rag/LearningsIndex.ts`
- `/home/samuel/sv/docs/guides/bmad-complete-guide.md`
- `/home/samuel/sv/docs/guides/prd-auto-update-fix.md`

**Existing Analysis:**
- `/home/samuel/sv/supervisor-service/.bmad/analysis/automatic-quality-workflows-analysis.md`
- `/home/samuel/sv/supervisor-service/.bmad/epics/006-automatic-quality-workflows-mvp.md`

---

## Complexity Rationale

**Why Level 3 (Large Feature):**

1. **Multiple Integration Points:** PIV loop, validation agent, RAG system, learning system, GitHub API
2. **State Management:** Complex database schema (verification results, learnings, embeddings)
3. **Event-Driven Architecture:** PIV event hooks, epic completion detection, auto-spawn logic
4. **Agent Orchestration:** Spawn multiple agents (validation, fix, review), track state
5. **Learning Extraction:** Plan comparison, pattern recognition, markdown generation
6. **RAG Integration:** Embedding generation, vector storage, semantic search
7. **Error Handling:** Many failure modes require specific handling (spawn failures, timeout, retries)
8. **Testing Requirements:** Unit tests, integration tests, end-to-end verification flows

**NOT Level 4 because:**
- Core infrastructure exists (validation, RAG, learning system)
- Clear architectural patterns established
- Well-defined boundaries between components
- No fundamental research needed

**Estimated Implementation Time:** 4-6 weeks (180 hours)

**Recommended Epic Breakdown:**
1. Epic 1: PIV event hook and verification auto-spawn (1 week)
2. Epic 2: Mock detector and result reporting (1 week)
3. Epic 3: Auto-fix retry loop integration (1 week)
4. Epic 4: System review agent and plan comparison (1.5 weeks)
5. Epic 5: Learning extraction and RAG indexing (1 week)
6. Epic 6: CLAUDE.md updater and integration tests (1 week)

---

## Next Steps

1. **Review this feature request** with user (samuel)
2. **Create comprehensive epic breakdown** with `/create-epic automatic-quality-workflows`
3. **Architecture phase:** Review existing ADRs (004, 006)
4. **Implementation prep:** Break epics into GitHub issues
5. **Testing strategy:** Define test scenarios for all workflows

---

## Notes from Analysis

**Key Insights:**
- Validation agent already exists and works well
- Epic completion handler already has fix-retry logic
- Main gap is auto-trigger after PIV completion
- PRD updates already working - must maintain mandatory status
- Learning extraction is biggest new component

**Risk Areas:**
- False positives in verification (mitigation: strict criteria, manual override)
- CLAUDE.md corruption (mitigation: atomic writes, git backup, rollback)
- Infinite fix loops (mitigation: max 3 retries, timeout enforcement)
- RAG returns irrelevant learnings (mitigation: similarity threshold tuning)

**Existing Implementation:**
- Epic 006 draft already created but not implemented
- Validation subagent fully working
- Epic completion handler fully working
- Just needs auto-spawn triggers and learning extraction

---

**Analyst:** Claude Sonnet 4.5 (Meta-Supervisor)
**Review:** Ready for PM Agent - Epic Creation Phase
**Date:** 2026-01-27
