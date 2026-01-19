# Automatic Quality Workflows - Requirements Analysis

**Date:** 2026-01-19
**Analyst:** Claude Sonnet 4.5
**Status:** Complete
**Complexity Level:** 3 (Complex multi-system integration)

---

## Executive Summary

This analysis evaluates the requirements for implementing automatic quality workflows in the supervisor system at `/home/samuel/sv/`. The system needs to autonomously verify, learn, and improve without requiring manual user commands, enabling a non-technical user to interact via plain language in Claude.ai browser.

**Key Finding:** The proposed workflows are **feasible** but require careful phasing. Most infrastructure already exists (PIV loop, RAG, timing system, learnings), reducing implementation risk.

**Recommended Approach:** MVP focusing on auto-verification and auto-system review first (highest ROI), then expanding to confidence scoring and pattern detection.

---

## 1. Complexity Assessment

### Overall Complexity: Level 3 (Complex)

**Breakdown by workflow:**

| Workflow | Complexity | Reasoning |
|----------|-----------|-----------|
| Auto-Verification After PIV | **Level 2** (Medium) | Integration with existing PIV, new verification protocol |
| Auto-System Review After Epic | **Level 3** (Complex) | Plan comparison, learning extraction, CLAUDE.md updates, RAG indexing |
| Auto-Confidence Scoring | **Level 2** (Medium) | RAG search integration, scoring algorithm |
| Auto-Pattern Detection | **Level 2** (Medium) | Message analysis, suggestion engine |
| Auto-Realistic Estimates | **Level 1** (Simple) | **Already implemented** in TaskTimer system |

**Justification for Level 3:**
- Requires coordination across 4+ subsystems (PIV, RAG, learning system, GitHub, database)
- Needs new agent spawning patterns (verification agents, review agents)
- Involves autonomous decision-making (when to retry, what to learn, how to update docs)
- Must preserve existing functionality while adding automation
- No single critical blocking dependency, but high integration complexity

**Not Level 4 because:**
- Core infrastructure exists (PIV loop, RAG, timing DB, learnings)
- Clear architectural patterns established
- Well-defined boundaries between components
- No fundamental research needed

---

## 2. Dependency Analysis

### Existing Infrastructure (Already Built)

✅ **PIV Loop** (`/home/samuel/sv/.claude/commands/supervision/piv-supervise.md`)
- Prime → Plan → Execute workflow
- Subagent spawning
- Validation commands
- PR creation

✅ **Task Timing System** (`/home/samuel/sv/supervisor-service/src/timing/TaskTimer.ts`)
- Historical data collection
- Estimate calculation
- Confidence intervals
- Parallel execution tracking

✅ **Learning System** (`/home/samuel/sv/docs/supervisor-learnings/`)
- Markdown-based learnings
- Categorization and tagging
- Problem-solution documentation

✅ **RAG System** (`/home/samuel/sv/supervisor-service/src/rag/`)
- LearningsIndex.ts for semantic search
- Vector similarity
- Already indexes learnings

✅ **Supervisor Architecture** (`/home/samuel/sv/docs/SCAR-ARCHITECTURE-AND-SUPERVISOR-INTEGRATION.md`)
- Claude Agent SDK integration
- Session persistence
- MCP tools
- Multi-project support

### New Dependencies Required

🔨 **Verification Protocol**
- Test execution framework
- Build validation logic
- File existence checking
- Mock detection patterns

🔨 **Plan Comparison Engine**
- Epic plan parsing
- Actual implementation analysis
- Diff generation
- Pattern extraction

🔨 **CLAUDE.md Update System**
- Template-based updates
- Version control integration
- Atomic file operations
- Rollback capability

🔨 **Confidence Scoring Algorithm**
- RAG similarity scoring
- Historical success rate analysis
- Complexity estimation
- Question generation

🔨 **Pattern Detection Engine**
- Message parsing
- Feature extraction
- Pattern matching
- Suggestion templates

### External Dependencies

- **GitHub API**: Issue creation, PR management, commenting
- **PostgreSQL**: Timing data, learning index, session storage
- **Claude Agent SDK**: Subagent spawning, session management
- **OpenAI API**: Embeddings for RAG (already in use)
- **Git**: Version control, file operations

---

## 3. Detailed Requirements Breakdown

### 3.1 Auto-Verification After PIV Completion

**Trigger:** PIV loop completes (PR created)

**Requirements:**

| ID | Requirement | Priority | Complexity |
|----|-------------|----------|------------|
| V1 | Spawn independent verification agent | High | Medium |
| V2 | Check all files from plan exist | High | Low |
| V3 | Detect mocks/placeholders in code | High | Medium |
| V4 | Execute build process (npm run build) | High | Low |
| V5 | Run test suite (npm test) | High | Low |
| V6 | Parse build/test output for errors | High | Medium |
| V7 | If verification fails, spawn fix agent | High | Medium |
| V8 | Retry verification after fix (max 3 retries) | High | Medium |
| V9 | Report results in plain language | High | Low |
| V10 | Update GitHub issue with verification status | Medium | Low |

**Success Criteria:**
- 100% of PIV completions trigger verification
- No false negatives (real issues must be detected)
- Max 2 hours from PIV completion to verification report
- Clear, non-technical language in reports

**Edge Cases:**
- PIV creates multiple PRs (verify all)
- Tests require external services (handle timeouts)
- Build fails due to environment issues (distinguish from code issues)
- Circular fix loops (enforce max retries)

---

### 3.2 Auto-System Review After Epic Completion

**Trigger:** All issues in epic complete and verified

**Requirements:**

| ID | Requirement | Priority | Complexity |
|----|-------------|----------|------------|
| R1 | Spawn system review agent | High | Medium |
| R2 | Load original epic plan | High | Low |
| R3 | Analyze actual implementation (files changed, commits) | High | Medium |
| R4 | Compare plan vs actual (what matched, what differed) | High | High |
| R5 | Extract successful patterns | Medium | High |
| R6 | Extract problematic patterns | High | High |
| R7 | Generate learning documents (markdown format) | High | Medium |
| R8 | Update project CLAUDE.md with new patterns | Medium | High |
| R9 | Index learnings to RAG | High | Low |
| R10 | Create git commit with review artifacts | Medium | Low |

**Success Criteria:**
- Learnings capture 80%+ of significant deviations from plan
- CLAUDE.md updates are coherent and useful
- RAG indexing makes learnings discoverable
- Review completes within 30 minutes of epic completion

**Edge Cases:**
- Epic evolved significantly during implementation (plan became outdated)
- Multiple contributors (attribute patterns correctly)
- Failed implementations (learn from failures too)
- Large epics (review must scale)

---

### 3.3 Auto-Confidence Scoring Before PIV Starts

**Trigger:** User requests feature implementation

**Requirements:**

| ID | Requirement | Priority | Complexity |
|----|-------------|----------|------------|
| C1 | Detect feature request in user message | High | Low |
| C2 | Extract task description and context | High | Medium |
| C3 | Search RAG for similar past tasks | High | Low |
| C4 | Calculate similarity scores (0-1) | High | Medium |
| C5 | Retrieve historical success/failure rates | High | Low |
| C6 | Analyze task complexity | Medium | Medium |
| C7 | Compute confidence score (0-10 scale) | High | Medium |
| C8 | If score < 6, generate clarifying questions | High | Medium |
| C9 | If score >= 6, auto-proceed with implementation | High | Low |
| C10 | Report confidence score and reasoning to user | High | Low |

**Success Criteria:**
- Confidence score correlates with actual success rate (>0.7 correlation)
- Low-confidence tasks (<6) that proceed after clarification succeed >80%
- High-confidence tasks (>=6) succeed >90%
- Questions are relevant and helpful

**Edge Cases:**
- No historical data for novel task types (default to low confidence)
- Conflicting historical data (some similar tasks succeeded, others failed)
- User provides insufficient context (iterate on questions)
- Task spans multiple projects (aggregate confidence across projects)

---

### 3.4 Auto-Pattern Detection in User Messages

**Trigger:** User sends message to supervisor

**Requirements:**

| ID | Requirement | Priority | Complexity |
|----|-------------|----------|------------|
| P1 | Parse user message for feature requests | High | Medium |
| P2 | Detect multiple features in single message | High | Medium |
| P3 | Classify request clarity (clear/vague/ambiguous) | Medium | Medium |
| P4 | Detect project switch requests | Medium | Low |
| P5 | Suggest parallel vs sequential for multiple features | High | Medium |
| P6 | Suggest implementation start for clear requests | High | Low |
| P7 | Suggest pattern reuse across projects | Medium | High |
| P8 | Present suggestions in natural language | High | Low |

**Success Criteria:**
- Pattern detection accuracy >85%
- Suggestions accepted by user >60% of the time
- No annoying/irrelevant suggestions
- Suggestions improve efficiency (measured by timing data)

**Edge Cases:**
- Ambiguous messages (multiple interpretations)
- Conversational context needed (previous messages)
- User explicitly rejects suggestion (learn preference)
- Pattern reuse not applicable (gracefully skip)

---

### 3.5 Auto-Realistic Estimates

**Status:** ✅ **Already Implemented**

**Existing Implementation:** `/home/samuel/sv/supervisor-service/src/timing/TaskTimer.ts`

**Capabilities:**
- Historical data collection
- Semantic search for similar tasks
- Confidence interval calculation
- Parallel execution accounting
- Learning from actual times

**Integration Required:**
- Connect to PIV loop start (already designed)
- Expose via MCP tools (partial implementation exists)
- Display estimates in user-facing messages

---

## 4. Scope Recommendations

### MVP (Phase 1) - Highest ROI

**Focus:** Auto-Verification + Auto-System Review

**Rationale:**
- Directly addresses quality concerns
- Provides immediate value (catch bugs before user sees them)
- Builds learning corpus for future automation
- Manageable scope (4-6 weeks)

**Deliverables:**
1. Verification agent that auto-spawns after PIV completion
2. Basic verification checks (files exist, build passes, tests pass)
3. Auto-fix retry loop (max 3 attempts)
4. System review agent that extracts learnings after epic completion
5. Basic CLAUDE.md updates (append new patterns)
6. RAG indexing of learnings

**Success Metrics:**
- 90% of PIV completions verified automatically
- 70% of verifications pass on first attempt
- 50% of failed verifications fixed automatically
- 80% of epics generate useful learnings

---

### Phase 2 - Enhanced Intelligence

**Focus:** Auto-Confidence Scoring + Auto-Pattern Detection

**Rationale:**
- Prevents problems before they occur
- Improves user experience (fewer clarifications needed)
- Leverages learnings from Phase 1
- Moderate scope (3-4 weeks)

**Deliverables:**
1. Confidence scoring algorithm
2. RAG-based similarity search for past tasks
3. Question generation for low-confidence tasks
4. Pattern detection in user messages
5. Suggestion engine (parallel/sequential, pattern reuse)
6. Natural language presentation

**Success Metrics:**
- Confidence score accuracy >75%
- Pattern detection accuracy >80%
- Suggestion acceptance rate >50%
- Reduction in failed implementations by 30%

---

### Phase 3 - Integration & Polish

**Focus:** Auto-Realistic Estimates Integration + System Optimization

**Rationale:**
- Completes the automation suite
- Optimizes existing workflows
- Addresses performance bottlenecks
- Small scope (2-3 weeks)

**Deliverables:**
1. Timing estimates in all user-facing messages
2. MCP tool exposure for estimates
3. Performance optimization (reduce latency)
4. Documentation and examples
5. Dashboard for monitoring automation health

**Success Metrics:**
- Estimate accuracy >85% (within 20% of actual)
- All workflows respond <5 seconds
- User satisfaction score >8/10
- 90% reduction in manual verification time

---

### Nice-to-Have (Future Enhancements)

**Lower Priority Features:**

1. **Proactive Issue Detection**
   - Scan codebase for potential issues before they manifest
   - Suggest refactoring opportunities
   - Detect security vulnerabilities

2. **Cross-Project Learning**
   - Share learnings across all projects
   - Detect project-agnostic patterns
   - Suggest reusable components

3. **Predictive Planning**
   - Suggest next epics based on project goals
   - Identify technical debt
   - Optimize feature sequencing

4. **Advanced Fix Strategies**
   - Multiple fix approaches in parallel
   - A/B testing of fixes
   - Learning from fix success/failure

---

## 5. Risk Analysis

### High-Risk Areas

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **False positives in verification** | High | Medium | Strict verification criteria, manual override option |
| **CLAUDE.md corruption during auto-update** | Medium | High | Atomic updates, git backups, rollback capability |
| **Infinite fix-retry loops** | Medium | High | Hard retry limit (3), timeout enforcement, escalation to user |
| **RAG returns irrelevant learnings** | Medium | Medium | Similarity threshold tuning, manual learning curation |
| **Confidence scoring is inaccurate** | High | Medium | Conservative defaults, user feedback loop, periodic recalibration |
| **Pattern detection generates spam** | Medium | Low | Suggestion filtering, user preference learning |
| **Performance degradation** | Low | Medium | Caching, background processing, resource limits |

### Medium-Risk Areas

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **GitHub API rate limits** | Medium | Medium | Request batching, caching, fallback to polling |
| **OpenAI API costs for RAG** | Low | Medium | Caching embeddings, batch processing, monitoring |
| **Database growth from timing data** | Low | Low | Data retention policy, archiving old data |
| **Agent spawning overhead** | Medium | Low | Agent pooling, lazy spawning, resource management |

### Low-Risk Areas

- File system operations (well-tested patterns)
- Git operations (atomic commits, easy rollback)
- MCP tool invocation (established infrastructure)
- Session management (proven with Claude Agent SDK)

---

## 6. Technical Considerations

### Architecture Patterns

**Event-Driven Architecture:**
```
PIV Complete → Event Bus → Verification Agent Spawn
Epic Complete → Event Bus → Review Agent Spawn
User Message → Event Bus → Pattern Detection
```

**Agent Lifecycle:**
```
Spawn → Initialize → Execute → Report → Cleanup
         ↓
      (Resume if needed)
```

**Data Flow:**
```
User Input → Supervisor → RAG Search → Historical Data
                ↓              ↓             ↓
             Confidence    Learnings    Timing Estimates
                ↓              ↓             ↓
             Decision → PIV Loop → Implementation
                                      ↓
                                 Verification
                                      ↓
                                 System Review
                                      ↓
                                 New Learnings → RAG Index
```

### Scaling Considerations

**Current System:**
- 4 projects (consilio, odin, openhorizon, health-agent)
- ~10-20 epics per project per month
- ~5-10 issues per epic
- Manageable scale for single-node deployment

**Future Growth:**
- Could scale to 10+ projects
- Claude Agent SDK supports multiple concurrent sessions
- PostgreSQL can handle 100K+ timing records
- RAG search remains fast (<100ms) with proper indexing

**Bottlenecks to Monitor:**
- Concurrent agent spawns (limit to 5-10)
- GitHub API rate limits (5000/hour)
- OpenAI embedding API (parallel batching helps)
- Database connection pool (increase if needed)

### Performance Targets

| Operation | Target Latency | Current Baseline | Gap |
|-----------|---------------|------------------|-----|
| Verification spawn | <5s | N/A (new) | Implement with caching |
| RAG confidence search | <2s | ~1s | Maintain |
| Pattern detection | <1s | N/A (new) | Fast NLP models |
| System review | <30min | N/A (new) | Background processing |
| Learning indexing | <5s | ~3s | Acceptable |

---

## 7. Implementation Estimates

### Phase 1: MVP (Auto-Verification + Auto-System Review)

**Duration:** 4-6 weeks

| Component | Effort | Complexity | Dependencies |
|-----------|--------|------------|--------------|
| Verification agent framework | 1 week | Medium | PIV integration |
| Verification checks (build/test/files) | 1 week | Low | Test frameworks |
| Auto-fix retry loop | 1 week | Medium | Agent spawning |
| System review agent | 1.5 weeks | High | Plan parsing, git analysis |
| Learning extraction logic | 1 week | High | Pattern recognition |
| CLAUDE.md update system | 1 week | Medium | File operations, templates |
| RAG learning indexing | 0.5 weeks | Low | Existing RAG system |
| Testing & integration | 1 week | Medium | All above |

**Total:** 8 weeks (with buffer)

**Team:** 1 developer (could parallelize some tasks)

---

### Phase 2: Enhanced Intelligence

**Duration:** 3-4 weeks

| Component | Effort | Complexity | Dependencies |
|-----------|--------|------------|--------------|
| Confidence scoring algorithm | 1 week | Medium | RAG, timing DB |
| Question generation | 0.5 weeks | Medium | NLP templates |
| Pattern detection engine | 1 week | Medium | Message parsing |
| Suggestion engine | 1 week | Medium | Pattern matching |
| User feedback integration | 0.5 weeks | Low | Database updates |
| Testing & tuning | 1 week | Medium | Phase 1 complete |

**Total:** 5 weeks (with buffer)

---

### Phase 3: Integration & Polish

**Duration:** 2-3 weeks

| Component | Effort | Complexity | Dependencies |
|-----------|--------|------------|--------------|
| Timing estimate integration | 0.5 weeks | Low | TaskTimer already exists |
| MCP tool exposure | 0.5 weeks | Low | Existing MCP patterns |
| Performance optimization | 1 week | Medium | Profiling |
| Documentation | 0.5 weeks | Low | - |
| Monitoring dashboard | 1 week | Medium | UI framework |
| User testing & refinement | 0.5 weeks | Low | User feedback |

**Total:** 4 weeks (with buffer)

---

## 8. Success Criteria & Metrics

### Quantitative Metrics

**Phase 1 (MVP):**
- **Verification Coverage:** 90% of PIV completions verified
- **Verification Pass Rate:** 70% pass on first attempt
- **Auto-Fix Success:** 50% of failures fixed automatically
- **Learning Generation:** 80% of epics generate useful learnings
- **False Positive Rate:** <10% (incorrect failure detection)

**Phase 2 (Enhanced):**
- **Confidence Accuracy:** Correlation >0.7 with actual success
- **Pattern Detection Accuracy:** >80% correct classifications
- **Suggestion Acceptance:** >50% user acceptance rate
- **Implementation Success:** 30% reduction in failed implementations

**Phase 3 (Integration):**
- **Estimate Accuracy:** 85% within 20% of actual time
- **Response Latency:** <5s for all user-facing operations
- **User Satisfaction:** >8/10 rating
- **Manual Effort Reduction:** 90% reduction in verification time

### Qualitative Metrics

- **User Experience:** Non-technical user can operate system without coding knowledge
- **Reliability:** System runs autonomously for days without intervention
- **Learning Quality:** Generated learnings are actionable and specific
- **Communication:** Reports are clear, non-technical, and helpful

---

## 9. Recommendations

### Priority 1: Start with MVP

**Rationale:**
- Highest immediate value (quality assurance)
- Builds learning corpus for future phases
- Addresses current pain points
- Manageable risk

**Action Items:**
1. Design verification agent architecture
2. Implement basic verification checks
3. Build auto-fix retry mechanism
4. Create system review framework
5. Test with real PIV completions

**Timeline:** Start immediately, deliver in 6-8 weeks

---

### Priority 2: Invest in RAG Quality

**Rationale:**
- RAG quality determines confidence scoring accuracy
- Learning indexing affects all future automation
- Current RAG system exists but needs tuning

**Action Items:**
1. Audit current learning corpus
2. Improve embedding quality (chunking, metadata)
3. Tune similarity thresholds
4. Add manual curation tools
5. Monitor RAG performance metrics

**Timeline:** Parallel with Phase 1 development

---

### Priority 3: User Feedback Loop

**Rationale:**
- Non-technical user is the primary stakeholder
- Automation must adapt to user preferences
- Early feedback prevents costly rework

**Action Items:**
1. Create simple feedback mechanism (thumbs up/down)
2. Track which suggestions are accepted/rejected
3. Monthly review sessions with user
4. Adjust automation based on feedback
5. Document user preferences

**Timeline:** Throughout all phases

---

## 10. Open Questions

### Technical Questions

1. **Verification Environment:** Should verification run in isolated container or same environment as PIV?
   - **Recommendation:** Same environment initially (simpler), isolated later (safer)

2. **CLAUDE.md Update Strategy:** Append-only or intelligent merging?
   - **Recommendation:** Append with sections, manual review quarterly

3. **Agent Model Selection:** Which model for verification/review agents (Sonnet/Haiku)?
   - **Recommendation:** Haiku for verification (fast), Sonnet for review (quality)

4. **Learning Retention:** How long to keep timing data and learnings?
   - **Recommendation:** 12 months active, archive older (query on demand)

### Process Questions

1. **User Override:** How should user override automation decisions?
   - **Recommendation:** Simple commands like "skip verification" or "force proceed"

2. **Failure Escalation:** When should system ask user for help vs. retry autonomously?
   - **Recommendation:** After 3 retries or 2 hours elapsed, escalate

3. **Learning Conflicts:** What if new learning contradicts old learning?
   - **Recommendation:** Version learnings, mark superseded ones, manual resolution

4. **Cross-Project Patterns:** Should learnings apply across all projects?
   - **Recommendation:** Tag learnings as "project-specific" or "general", filter accordingly

---

## Conclusion

The automatic quality workflows are **feasible and valuable**, with moderate complexity (Level 3) and manageable risk. The key success factor is **phased implementation**, starting with auto-verification and auto-system review (MVP), then expanding to confidence scoring and pattern detection.

**Critical Success Factors:**
1. Leverage existing infrastructure (PIV, RAG, timing, learnings)
2. Start small, iterate based on real usage
3. Maintain user feedback loop throughout
4. Prioritize reliability over features
5. Keep user interface simple and non-technical

**Expected Outcome:**
A supervisor system that autonomously handles 90% of quality assurance tasks, learns from every implementation, and provides intelligent assistance to a non-technical user via plain language interaction.

**Next Step:**
Review this analysis with stakeholder, then proceed with MVP design and implementation planning.

---

**Analysis Complete** | Generated: 2026-01-19
