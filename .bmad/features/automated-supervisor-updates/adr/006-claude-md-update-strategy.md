# ADR 006: CLAUDE.md Update Strategy for Automatic Learning Integration

**Date:** 2026-01-19 (Stockholm time)
**Status:** Proposed
**Project:** supervisor-service
**Supersedes:** N/A
**Superseded by:** N/A

## Context

The system review agent generates learnings after each epic completes, extracting patterns and strategies from the implementation. These learnings should be integrated into project-level CLAUDE.md files so future agents can reference them during planning and implementation.

CLAUDE.md files are critical documentation that guides all agent behavior for a project. Corruption or inconsistency in these files can degrade agent effectiveness across the entire project. The update mechanism must be both automated (to ensure learnings are captured) and safe (to prevent documentation corruption).

### Current Situation

CLAUDE.md files are manually maintained by the user. When patterns are discovered during implementation, the user must:
1. Recognize the pattern is worth documenting
2. Decide where in CLAUDE.md to add it
3. Write clear documentation
4. Ensure it doesn't conflict with existing content
5. Commit the change

This manual process means learnings are often lost or documented inconsistently. There is no systematic capture of implementation patterns.

### Constraints

- **Safety First:** Corruption of CLAUDE.md is catastrophic (breaks all future agents)
- **Rollback Required:** Must be able to revert bad updates easily
- **Auditability:** User needs to review what was added and approve/reject
- **Simplicity:** Single developer maintenance, prefer simple over sophisticated
- **Non-Blocking:** User shouldn't need to review every update immediately
- **Preservation:** Cannot lose existing content or formatting
- **Conflict Detection:** Must handle concurrent updates (user + agent both modifying)

### Stakeholders

- **User:** Wants improved documentation without risk of corruption
- **Future Agents:** Benefit from accumulated learnings in CLAUDE.md
- **System Review Agent:** Needs reliable way to persist learnings
- **Developer:** Needs maintainable, debuggable update mechanism

## Decision

**We will use an append-only strategy with git-based rollback:**

**Approach:**
1. System review agent generates learning markdown (patterns, anti-patterns, strategies)
2. Agent appends new section to end of CLAUDE.md with clear delimiter
3. Git commits changes atomically with descriptive message
4. User reviews via pull request or direct commit inspection
5. Quarterly manual consolidation to organize accumulated learnings

**Technical Implementation:**
- Backup CLAUDE.md before update (git commit current state)
- Append new section with header: `## Learnings from Epic #XXX (YYYY-MM-DD)`
- Atomic file write (write to temp file, then rename)
- Git commit with message: `chore: Add learnings from Epic #XXX - [brief summary]`
- Log update location for user notification
- If write fails, rollback via `git reset --hard HEAD`

### Implementation Summary

```typescript
async function updateClaudeMd(projectPath: string, epicId: number, learnings: string) {
  const claudeMdPath = path.join(projectPath, 'CLAUDE.md');

  // 1. Git commit current state (backup)
  await git.commit('chore: Pre-learning update checkpoint');

  // 2. Read current content
  const currentContent = await fs.readFile(claudeMdPath, 'utf-8');

  // 3. Append new learning section
  const newSection = `\n\n---\n\n## Learnings from Epic #${epicId} (${new Date().toISOString().split('T')[0]})\n\n${learnings}\n`;
  const updatedContent = currentContent + newSection;

  // 4. Atomic write (temp file + rename)
  const tempPath = claudeMdPath + '.tmp';
  await fs.writeFile(tempPath, updatedContent, 'utf-8');
  await fs.rename(tempPath, claudeMdPath);

  // 5. Git commit with learning summary
  await git.commit(`chore: Add learnings from Epic #${epicId} - Auto quality workflows`);

  console.log(`✅ Updated ${claudeMdPath} with learnings from Epic #${epicId}`);
}
```

## Rationale

### Pros

✅ **Maximum Safety:** Append-only never modifies existing content, impossible to corrupt what's already there
✅ **Git Rollback:** Every update is a git commit, trivial to revert (`git revert <commit>`)
✅ **Auditable:** User can `git diff` to see exactly what was added
✅ **Simple Implementation:** Just read, append, write - no complex parsing or merging
✅ **Atomic Operations:** Temp file + rename ensures no partial writes
✅ **Clear Provenance:** Each learning tagged with epic ID and date
✅ **Non-Blocking:** User can review asynchronously (via git log)
✅ **Conflict Safe:** Append-only minimizes merge conflicts (only conflict if both append simultaneously)

### Cons

❌ **CLAUDE.md Growth:** File grows indefinitely without manual consolidation
❌ **Organization Degrades:** Learnings not integrated into relevant sections, just appended to end
❌ **Duplicate Patterns:** Same pattern might be documented multiple times from different epics
❌ **Mitigation:** Quarterly manual review to consolidate and organize. User can trigger consolidation anytime. Growth is slow (~500 words per epic = ~10KB per month). Agent can detect duplicates and skip obvious repeats.

### Why This Wins

The key insight is that **CLAUDE.md corruption is an existential risk** to the supervisor system. If CLAUDE.md becomes inconsistent or contradictory, all future agents will be confused and make poor decisions. No amount of sophisticated merging is worth this risk.

**Append-only is provably safe:**
- Can't corrupt existing content (doesn't modify it)
- Can't create contradictions (new content clearly marked as new)
- Can't lose information (everything appended is preserved)
- Can always rollback (every append is a git commit)

**The trade-off (file growth) is manageable:**
- CLAUDE.md files are typically 5-20KB
- Adding 500 words per epic = ~2KB
- Would take 50+ epics to double file size
- Quarterly consolidation keeps growth under control

**Comparison to intelligent merging:**
- Intelligent merging risks misinterpreting existing sections
- Merging can create subtle contradictions (LLMs aren't perfect at semantic consistency)
- Merging is hard to review (did the merge change meaning?)
- **Append is simple to review** (just look at what was added)

## Consequences

### Positive Consequences

- **Developer Experience:** Learnings automatically documented, no manual overhead
- **User Experience:** Can review updates at leisure, no immediate action required
- **Performance:** Append operations are very fast (<100ms)
- **Cost:** Minimal (just file I/O and git commit)
- **Reliability:** Atomic operations ensure consistency, git provides rollback

### Negative Consequences

- **Technical Debt:** CLAUDE.md organization degrades over time without manual curation
- **Learning Curve:** User needs to understand quarterly consolidation workflow
- **Migration Effort:** If switching to intelligent merging later, need complex refactoring

### Neutral Consequences

- **Architecture Change:** Git becomes critical dependency for CLAUDE.md updates
- **Team Process:** Need quarterly calendar reminder to consolidate learnings

## Alternatives Considered

### Alternative 1: Intelligent Merging (Sophisticated)

**Description:** Use LLM to read CLAUDE.md, understand structure, intelligently merge learnings into appropriate sections

**Pros:**
- CLAUDE.md stays well-organized
- No manual consolidation needed
- Learnings integrated into existing context
- No file growth problem

**Cons:**
- **High corruption risk:** LLM might misinterpret existing content
- **Difficult to review:** User must diff entire file to understand changes
- **Semantic consistency risk:** LLM might create subtle contradictions
- **Complex implementation:** Needs section parsing, semantic understanding, conflict detection
- **Expensive:** Requires Sonnet 4.5 reading entire CLAUDE.md (can be 20KB+)
- **Hard to rollback:** Merging changes are interleaved with existing content

**Why Rejected:** The risk/reward ratio is terrible. Intelligent merging saves manual consolidation effort (~1 hour per quarter) but risks corrupting critical documentation. Even a 1% corruption risk is unacceptable when the alternative (append-only) is provably safe.

### Alternative 2: Separate Learning Files (Decoupled)

**Description:** Store learnings in separate files (`docs/learnings/epic-XXX.md`), never modify CLAUDE.md

**Pros:**
- Zero risk to CLAUDE.md
- Clear separation of concerns
- Easy to browse learning history
- No file growth in CLAUDE.md

**Cons:**
- **Learnings not visible to agents:** Agents read CLAUDE.md, not separate files (unless explicitly told)
- **Two sources of truth:** CLAUDE.md and learning files might contradict
- **Manual integration required:** User must copy learnings to CLAUDE.md anyway
- **Breaks automatic improvement loop:** Learnings don't automatically improve future agents

**Why Rejected:** Defeats the purpose of automatic learning integration. If learnings aren't in CLAUDE.md, agents won't benefit from them. We'd still need manual work to integrate learnings, which is the problem we're solving.

### Alternative 3: Template Replacement (Structured)

**Description:** CLAUDE.md uses structured template with placeholders, agent replaces specific sections

**Pros:**
- Predictable structure
- No file growth
- Clear sections for learnings
- Agent knows exactly where to write

**Cons:**
- **Rigid:** Forces all CLAUDE.md files to use same template
- **Migration effort:** All existing CLAUDE.md files need restructuring
- **Limited flexibility:** Template might not fit all project types
- **Replacement risk:** Agent might replace wrong section
- **Harder to review:** Replacements modify existing content

**Why Rejected:** Template approach trades flexibility for structure, but our CLAUDE.md files are diverse (each project has unique needs). Forcing all projects into a rigid template reduces documentation quality. Also, replacement operations still risk corruption.

### Alternative 4: Manual Review Required (Cautious)

**Description:** Agent generates learnings and proposes CLAUDE.md updates, but user must manually approve before application

**Pros:**
- User maintains full control
- Zero risk of bad automatic updates
- User learns from reviewing proposals
- No corruption possible

**Cons:**
- **Defeats automation purpose:** User must manually review every epic (2-5 per week)
- **Bottleneck:** System can't improve autonomously
- **Lost learnings:** If user busy/forgets, learnings never integrated
- **Notification fatigue:** User must respond to proposals constantly

**Why Rejected:** We want automatic improvement with user oversight, not manual approval for every change. The append-only approach achieves this - updates happen automatically, but user can review and rollback if needed. Manual approval is too high friction.

### Alternative 5: Versioned CLAUDE.md (Complex)

**Description:** Maintain multiple versions of CLAUDE.md (v1, v2, v3), agent creates new versions, user promotes to active

**Pros:**
- Safe experimentation
- Can compare versions
- Rollback is version switch
- No corruption of active version

**Cons:**
- **Complex implementation:** Version management, promotion workflow, storage
- **Confusing:** Which version do agents use? Latest or promoted?
- **Doesn't solve core problem:** Still need merge strategy within each version
- **Overkill:** Git already provides versioning

**Why Rejected:** Git already solves versioning. Creating a parallel version system adds complexity without benefit. The append-only approach uses git commits as versions, achieving the same safety with simpler implementation.

### Alternative 6: Do Nothing (Manual Only)

**Description:** User manually updates CLAUDE.md after reviewing learnings, no automatic updates

**Pros:**
- Zero automation complexity
- User maintains complete control
- No corruption risk from automation

**Cons:**
- Learnings often lost (user forgets or doesn't have time)
- Inconsistent documentation quality
- Manual overhead defeats purpose of automation
- No automatic improvement loop

**Why Rejected:** Manual documentation is the problem we're solving. The whole point of automatic quality workflows is to capture learnings systematically so the system improves over time.

## Implementation Plan

### Phase 1: Preparation
1. [ ] Define learning section format (markdown template)
2. [ ] Create CLAUDE.md backup utility (git commit helper)
3. [ ] Implement atomic file write utility (temp + rename)

### Phase 2: Execution
1. [ ] Implement `ClaudeMdUpdater.ts` with append logic
2. [ ] Add git integration (commit before/after)
3. [ ] Add rollback utility (git reset helper)
4. [ ] Add duplicate detection (skip if similar learning already exists)

### Phase 3: Validation
1. [ ] Test append operations on real CLAUDE.md files
2. [ ] Test atomic write prevents partial updates
3. [ ] Test git rollback recovers from failures
4. [ ] Test concurrent updates (user + agent modifying simultaneously)

### Phase 4: User Documentation
1. [ ] Document how to review appended learnings (`git log`)
2. [ ] Document how to rollback bad updates (`git revert`)
3. [ ] Document quarterly consolidation workflow
4. [ ] Create consolidation helper script (extract all learning sections)

### Rollback Plan

**If append-only proves untenable (file growth too fast):**
1. Pause automatic updates
2. Manually consolidate all accumulated learnings
3. Research intelligent merging with better safety (e.g., LLM generates diff, user approves)
4. Implement v2 update strategy

**Rollback Cost:** Low (just disable updater, no data loss)

## Success Metrics

**Quantitative Metrics:**
- CLAUDE.md corruption rate: 0% (absolute requirement)
- Learning capture rate: >80% of epics generate CLAUDE.md updates
- File growth rate: <5KB per month per project
- Rollback usage: <10% of updates (most should be good)

**Qualitative Metrics:**
- User finds appended learnings useful in CLAUDE.md reviews
- Future agents reference learnings during planning
- No user complaints about CLAUDE.md organization degradation

**Timeline:**
- Measure after: 3 months (need multiple epics to assess)
- Target: All metrics within acceptable ranges

## Review Date

**Next Review:** 2026-04-19 (3 months after implementation, after quarterly consolidation)

**Triggers for Earlier Review:**
- Any CLAUDE.md corruption detected (critical issue)
- File growth exceeds 10KB in single month (scalability issue)
- User requests intelligent merging (UX issue)
- Git conflicts become frequent (>20% of updates)

## References

- Epic: `/home/samuel/sv/.bmad/epics/006-automatic-quality-workflows-mvp.md`
- CLAUDE.md Examples: `/home/samuel/sv/*/CLAUDE.md`
- Git Atomic Operations: https://git-scm.com/book/en/v2/Git-Internals-Git-Objects
- Node.js Atomic Writes: https://nodejs.org/api/fs.html#fsrenameoldpath-newpath-callback

## Notes

### CLAUDE.md Structure After Updates

**Before (original):**
```markdown
# Project Name

## Overview
[Existing content]

## Architecture
[Existing content]

## Guidelines
[Existing content]
```

**After (with learnings):**
```markdown
# Project Name

## Overview
[Existing content]

## Architecture
[Existing content]

## Guidelines
[Existing content]

---

## Learnings from Epic #006 (2026-01-19)

### Pattern: Haiku for Deterministic Tasks
When verification only requires running commands and parsing output,
Claude Haiku is sufficient and 10x cheaper than Sonnet...

### Anti-Pattern: Intelligent CLAUDE.md Merging
Attempted to use LLM to merge learnings into existing sections,
resulted in semantic contradictions. Append-only is safer...

---

## Learnings from Epic #007 (2026-01-25)

### Pattern: Filesystem Events + Polling Fallback
Hybrid architecture provides both speed and reliability...
```

### Quarterly Consolidation Workflow

**Step 1: Extract learnings**
```bash
git log --grep="learnings from Epic" --format="%H %s" |
  while read commit msg; do
    git show $commit:CLAUDE.md | sed -n '/^## Learnings/,/^---/p'
  done > all-learnings.md
```

**Step 2: Manual organization**
- User reads all-learnings.md
- Identifies common themes
- Integrates into relevant CLAUDE.md sections
- Removes duplicate patterns
- Deletes appended learning sections

**Step 3: Git commit**
```bash
git commit -m "chore: Consolidate Q1 2026 learnings into CLAUDE.md structure"
```

**Frequency:** Once per quarter (4x per year)
**Time Required:** ~1 hour per project

### Duplicate Detection Strategy

Before appending, check if similar learning already exists:
1. Extract all learning sections from CLAUDE.md
2. Generate embedding for new learning (OpenAI)
3. Compare with existing learning embeddings (cosine similarity)
4. If similarity > 0.85, skip appending (likely duplicate)
5. Log skipped learnings for user review

This prevents obvious duplicates while allowing nuanced variations.

### Lessons Learned (Post-Implementation)

[To be filled in after 3 months of production use and first quarterly consolidation]

- What worked well:
- What didn't work:
- What we'd do differently:

---

**Template Version:** 1.0
**Template Source:** BMAD-inspired ADR template for SCAR supervisor
