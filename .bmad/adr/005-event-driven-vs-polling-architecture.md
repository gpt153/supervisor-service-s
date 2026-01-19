# ADR 005: Event-Driven vs Polling Architecture for Verification Triggering

**Date:** 2026-01-19 (Stockholm time)
**Status:** Proposed
**Project:** supervisor-service
**Supersedes:** N/A
**Superseded by:** N/A

## Context

The automatic quality workflows system must trigger verification agents immediately after PIV (Plan-Implement-Verify) completion. "Immediately" means within 5 seconds of the PIV agent creating a pull request, to provide rapid feedback and minimize user wait time.

This requires detecting PIV completion reliably and spawning verification agents with minimal latency. The detection mechanism is a critical architectural decision affecting system responsiveness, reliability, and maintenance complexity.

### Current Situation

The existing PIV loop (`/home/samuel/sv/.claude/commands/supervision/piv-supervise.md`) is a polling-based supervisor that runs every 2 minutes. It:
1. Queries GitHub for open issues
2. Checks if issues need implementation
3. Spawns implementation agents
4. Creates PRs when implementation completes

There is currently no mechanism to detect PIV completion and trigger subsequent workflows. The user must manually check if implementation succeeded.

### Constraints

- **Latency Requirement:** Verification spawn within 5 seconds of PIV completion
- **Reliability:** Must not miss completions (99%+ detection rate)
- **GitHub Integration:** Must work with GitHub's API and event systems
- **Existing Infrastructure:** PIV loop already runs every 2 minutes as polling service
- **Simplicity:** Single developer maintenance, prefer simple over complex
- **Cost:** GitHub webhook infrastructure might require additional services

### Stakeholders

- **User:** Wants fast feedback without manual intervention
- **PIV Loop:** Existing polling infrastructure already running
- **Verification System:** Needs reliable triggers to spawn agents
- **Developer:** Needs maintainable, debuggable architecture

## Decision

**We will use a hybrid event-driven architecture with polling fallback:**

**Primary: Git-based event detection**
- PIV loop writes completion marker files to filesystem when PR created
- Verification spawner watches marker directory (filesystem events via inotify/chokidar)
- Verification spawns immediately when marker file detected
- Marker files contain issue ID, PR URL, plan reference

**Fallback: Polling for missed events**
- 2-minute polling job checks database for unverified PRs
- Spawns verification if PR created >5 minutes ago without verification
- Ensures no completions are missed even if filesystem events fail

### Implementation Summary

```typescript
// PIV completion marker
await fs.writeFile(
  `/tmp/supervisor-piv-completions/${issueId}.json`,
  JSON.stringify({ issueId, prUrl, planPath, timestamp })
);

// Verification spawner watches directory
const watcher = chokidar.watch('/tmp/supervisor-piv-completions/');
watcher.on('add', async (path) => {
  const completion = JSON.parse(await fs.readFile(path));
  await spawnVerificationAgent(completion);
  await fs.unlink(path); // Cleanup marker
});

// Fallback polling (every 2 minutes)
const unverified = await db.query(
  'SELECT * FROM prs WHERE created_at < NOW() - INTERVAL 5 minutes AND verification_id IS NULL'
);
for (const pr of unverified) {
  await spawnVerificationAgent(pr);
}
```

## Rationale

### Pros

✅ **Fast Primary Path:** Filesystem events trigger within milliseconds, meeting <5 second latency requirement
✅ **Reliable Fallback:** Polling ensures no missed events even if filesystem watcher crashes
✅ **Simple Implementation:** No external webhook infrastructure, uses filesystem primitives
✅ **Debuggable:** Marker files visible on filesystem, easy to inspect and test
✅ **Low Coupling:** PIV loop and verification spawner communicate via filesystem, not direct API calls
✅ **Graceful Degradation:** If watcher fails, polling catches up within 2 minutes
✅ **Reuses Existing Infrastructure:** Polling mechanism already exists for PIV loop

### Cons

❌ **Filesystem Dependency:** Relies on inotify/chokidar working correctly (Linux-specific edge cases)
❌ **Temporary Files:** Need cleanup logic to prevent marker directory growth
❌ **Two Mechanisms:** More complex than pure event-driven or pure polling
❌ **Mitigation:** Extensive testing of filesystem watcher. Automatic cleanup of processed markers. Monitoring for marker directory size.

### Why This Wins

The key insight is that **we need the reliability of polling with the speed of events**. Pure event-driven architectures are fragile (webhooks can fail, watchers can crash). Pure polling is slow (2-minute latency unacceptable).

**The hybrid approach gives us both:**
- 95%+ of triggers via fast filesystem events (<1 second latency)
- 100% reliability via polling fallback (catches anything events miss)
- Simple implementation (no webhook server, no complex event bus)

**Latency Analysis:**
- Event-driven primary: 0.1-1 second typical
- Polling fallback: 5-7 minutes worst case (but only for failures)
- **Overall P95: <5 seconds (meets requirement)**

## Consequences

### Positive Consequences

- **Developer Experience:** Fast feedback loop, verification reports appear almost instantly
- **User Experience:** System feels responsive and intelligent
- **Performance:** Minimal resource usage (filesystem events are very cheap)
- **Cost:** Zero additional infrastructure costs (no webhook servers)
- **Reliability:** Extremely high detection rate (dual mechanisms redundant)

### Negative Consequences

- **Technical Debt:** Marker file cleanup logic adds complexity
- **Learning Curve:** Team needs to understand both event-driven and polling patterns
- **Migration Effort:** If moving to pure event-driven later, need to remove polling logic

### Neutral Consequences

- **Architecture Change:** PIV loop gains responsibility for writing marker files
- **Team Process:** Need monitoring for marker directory health (size, stale files)

## Alternatives Considered

### Alternative 1: Pure GitHub Webhooks (Event-Driven)

**Description:** Set up webhook endpoint to receive GitHub PR creation events, trigger verification immediately

**Pros:**
- Truly event-driven, lowest latency possible (<100ms)
- Official GitHub mechanism, well-documented
- Scalable to many projects

**Cons:**
- Requires publicly accessible webhook endpoint (Cloud Run, ngrok, or similar)
- Additional infrastructure to maintain (webhook server, authentication, retry logic)
- Webhook delivery not guaranteed (GitHub SLA ~95%, can miss events)
- Complex error handling (what if webhook server down during PR creation?)
- Security concerns (webhook authentication, DoS protection)

**Why Rejected:** Over-engineered for single-developer use case. The added complexity (webhook server, public endpoint, auth) doesn't justify marginal latency improvement (5 seconds is acceptable). Filesystem events achieve similar latency without infrastructure overhead.

### Alternative 2: Pure Polling (Simple)

**Description:** Extend existing 2-minute PIV polling loop to check for completed PRs and spawn verification

**Pros:**
- Simplest implementation (add logic to existing loop)
- No new infrastructure or dependencies
- Already proven reliable in PIV loop
- Easy to debug and monitor

**Cons:**
- 2-minute average latency (up to 4 minutes worst case)
- Fails latency requirement (<5 seconds)
- Wastes resources polling when no work available
- Poor user experience (long wait for verification)

**Why Rejected:** Doesn't meet latency requirement. User expects verification to start immediately after PIV completes. 2-minute wait degrades the "intelligent autonomous system" experience to "slow batch job" experience.

### Alternative 3: Database Triggers (Event-Driven)

**Description:** PIV loop writes completion record to database, PostgreSQL trigger fires and spawns verification agent via NOTIFY/LISTEN

**Pros:**
- Event-driven, fast response (<1 second)
- No filesystem dependency
- Database already central to system
- PostgreSQL NOTIFY/LISTEN is reliable

**Cons:**
- Requires long-lived database connection for LISTEN
- Connection management complexity (reconnection on drop)
- Harder to debug than filesystem events
- Tight coupling between PIV loop and database schema
- Not easily testable without full database setup

**Why Rejected:** Database triggers add hidden complexity. Filesystem events are more visible and debuggable (can literally `ls /tmp/supervisor-piv-completions/`). Long-lived LISTEN connections are fragile. The filesystem approach is simpler and more transparent.

### Alternative 4: Message Queue (Event-Driven)

**Description:** PIV loop publishes PR completion message to queue (RabbitMQ, Redis Streams), verification spawner consumes queue

**Pros:**
- Proper event-driven architecture, industry standard
- Reliable message delivery with acknowledgments
- Scalable to high volume
- Decouples producers and consumers

**Cons:**
- Requires running message queue service (Redis, RabbitMQ)
- Additional infrastructure to maintain and monitor
- Overkill for single-developer, low-volume use case
- Complexity in error handling, dead letter queues, etc.

**Why Rejected:** Message queues are designed for high-scale, high-reliability distributed systems. Our system has 1 developer, 2-5 projects, 10-20 verifications per day. Filesystem events achieve the same goal with zero infrastructure. YAGNI (You Aren't Gonna Need It).

### Alternative 5: Hybrid with Webhook Primary (Complex)

**Description:** Webhooks as primary trigger, polling as fallback (reverse of chosen approach)

**Pros:**
- Absolute lowest latency (<100ms)
- Polling safety net for missed webhooks

**Cons:**
- Still requires webhook server infrastructure
- More complex than filesystem events
- Webhook server becomes single point of failure
- Higher operational burden (monitor webhook endpoint health)

**Why Rejected:** Doesn't solve the infrastructure complexity problem. If we're keeping polling fallback anyway (we must for reliability), then the primary mechanism should be as simple as possible. Filesystem events are simpler than webhooks.

### Alternative 6: Do Nothing (Manual Triggering)

**Description:** User manually triggers verification after PIV completes

**Pros:**
- Zero implementation effort
- No architectural complexity
- User has full control

**Cons:**
- Defeats purpose of "automatic" quality workflows
- User must remember to verify (error-prone)
- Wasted user time on manual overhead
- No value over current manual verification workflow

**Why Rejected:** Automation is the core value proposition. Manual triggering is the problem we're solving, not the solution.

## Implementation Plan

### Phase 1: Preparation
1. [ ] Create marker directory structure (`/tmp/supervisor-piv-completions/`)
2. [ ] Define marker file schema (JSON with issueId, prUrl, planPath, timestamp)
3. [ ] Set up filesystem cleanup cron (delete markers older than 1 hour)

### Phase 2: Execution (Event Path)
1. [ ] Modify PIV loop to write marker files on PR creation
2. [ ] Implement verification spawner with chokidar filesystem watcher
3. [ ] Handle marker file parsing and validation
4. [ ] Implement marker cleanup after successful spawn

### Phase 3: Execution (Fallback Path)
1. [ ] Create database table linking PRs to verification results
2. [ ] Implement 2-minute polling job for unverified PRs
3. [ ] Add deduplication logic (don't spawn if verification already running)

### Phase 4: Validation
1. [ ] Test event path latency (target: <1 second P95)
2. [ ] Test fallback polling catches missed events
3. [ ] Test watcher restart/crash recovery
4. [ ] Load test with 10 concurrent PIV completions

### Rollback Plan

**If filesystem watcher proves unreliable:**
1. Disable event-driven path (stop chokidar watcher)
2. Rely solely on polling fallback (2-minute latency acceptable as temporary measure)
3. Investigate alternative event mechanisms (database triggers, webhooks)
4. Re-enable events once root cause fixed

**Rollback Cost:** Configuration change only, fallback polling already implemented

## Success Metrics

**Quantitative Metrics:**
- Verification spawn latency: <5 seconds (P95), <1 second (P50)
- Detection reliability: >99% (no missed PIV completions)
- Fallback trigger rate: <5% (most should go through event path)
- Marker directory size: <100 files (cleanup working)

**Qualitative Metrics:**
- User perceives verification as "immediate" after PIV completes
- No manual intervention required to trigger verification
- System feels responsive and intelligent

**Timeline:**
- Measure after: 4 weeks of production use
- Target: All metrics within acceptable ranges

## Review Date

**Next Review:** 2026-02-19 (4 weeks after implementation)

**Triggers for Earlier Review:**
- Detection reliability drops below 95% (reliability issue)
- P95 latency exceeds 10 seconds (performance issue)
- Marker directory exceeds 500 files (cleanup issue)
- Filesystem watcher crashes more than once per week (stability issue)

## References

- Epic: `/home/samuel/sv/.bmad/epics/006-automatic-quality-workflows-mvp.md`
- PIV Loop: `/home/samuel/sv/.claude/commands/supervision/piv-supervise.md`
- chokidar: https://github.com/paulmillr/chokidar
- Node.js fs.watch: https://nodejs.org/api/fs.html#fswatchfilename-options-listener

## Notes

### Filesystem Watcher Implementation Details

**Directory Structure:**
```
/tmp/supervisor-piv-completions/
├── 123.json  # Issue #123 completed
├── 456.json  # Issue #456 completed
└── .processed/  # Moved here after verification spawns
```

**Marker File Format:**
```json
{
  "issueId": 123,
  "issueUrl": "https://github.com/user/repo/issues/123",
  "prUrl": "https://github.com/user/repo/pull/456",
  "planPath": "/home/samuel/sv/.bmad/epics/006-automatic-quality-workflows-mvp.md",
  "timestamp": "2026-01-19T14:30:00Z",
  "project": "supervisor-service"
}
```

**Cleanup Strategy:**
- Processed markers moved to `.processed/` subdirectory
- Cron job deletes `.processed/` files older than 24 hours
- Orphaned markers (>1 hour old, not processed) logged as warnings

### Why Not Pure Event-Driven?

Event-driven architectures are elegant but brittle in production:
- Webhooks can fail silently (GitHub returns 200 but doesn't retry)
- Filesystem watchers can crash (inotify limits, OS bugs)
- Database connections can drop (network issues, timeouts)
- Message queues can lose messages (though rare)

**The engineering reality:** Events are 95% reliable, polling is 100% reliable. Combining both gets 100% reliability with 95% of benefits from events.

### Lessons Learned (Post-Implementation)

[To be filled in after 4 weeks of production use]

- What worked well:
- What didn't work:
- What we'd do differently:

---

**Template Version:** 1.0
**Template Source:** BMAD-inspired ADR template for SCAR supervisor
