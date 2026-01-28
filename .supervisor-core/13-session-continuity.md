# Session Continuity System (Epic 007-F)

**YOU NOW HAVE AUTOMATIC SESSION RECOVERY**

---

## Your Instance ID

**Every PS has a unique instance ID that appears in the footer of every response.**

```
Instance: odin-PS-8f4a2b | Epic: 003 | Context: 42% | Active: 1.2h
```

**What it means:**
- `Instance: odin-PS-8f4a2b` - Your unique session identifier
- `Epic: 003` - What you're currently working on (or "—" if none)
- `Context: 42%` - How much of your context window is used
- `Active: 1.2h` - How long this session has been running

---

## Automatic Startup

**You don't need to do anything.**

On your first response as a PS:
1. ✅ System auto-registers your instance
2. ✅ You get a unique instance ID (stored in footer)
3. ✅ Your session is automatically tracked
4. ✅ Heartbeat keeps you alive (120s timeout)

**The system tracks:**
- When you started working
- What epic you're on
- How much context you've used
- Every important action (spawn, commit, deploy)

---

## Resume After Disconnect

**If your session gets interrupted, you can resume it.**

**Command:**
```
resume {instance_id}
```

**Example:**
```
User: "resume odin-PS-8f4a2b"

PS Response:
────────────────────────────────────────
✅ Resumed: odin-PS-8f4a2b

EPIC 003: Authentication (OAuth)
- Status: IN_PROGRESS
- Progress: 60% (3/5 commits)
- Tests: 38/42 passing
- Time: 2h 15min

LAST ACTION: Spawned haiku implementation subagent
CHECKPOINT: 15 minutes ago

NEXT STEPS:
1. Monitor haiku subagent progress
2. Run tests when implementation completes
3. Commit verified code
4. Create PR

Ready to continue. Say "continue" or describe what's next.
────────────────────────────────────────
Instance: odin-PS-8f4a2b | Epic: 003 | Context: 85% | Active: 2.3h
[Use "resume odin-PS-8f4a2b" to restore this session]
```

---

## Automatic Logging

**Your important actions are automatically logged.**

**When we log:**
- ✅ You spawn a subagent (Task, Explore, Plan)
- ✅ You commit code (git commit)
- ✅ You create a PR (GitHub)
- ✅ You deploy a service
- ✅ You complete an epic

**What gets logged:**
- Timestamp
- Action type (spawn, commit, deploy, etc.)
- Details (what you did)
- Result (success/failure)

**You don't need to do anything** - it's automatic.

---

## Automatic Checkpoints

**The system creates automatic checkpoints at key moments.**

**Checkpoint triggers:**
- ✅ Context window reaches 80% (warning: recovery time is now critical)
- ✅ Epic completion (recover exactly where you were)
- ✅ Major actions (spawn, PR creation, deployment)

**Checkpoints store:**
- Exact state (what were you working on)
- Last N commands (full history)
- File modifications (what changed)
- Epic progress (what's complete)
- Time invested

---

## Heartbeat (Keep Alive)

**Your session sends a heartbeat every response.**

**Why it matters:**
- ✅ System knows you're active (no false disconnects)
- ✅ Tracks context and epic automatically
- ✅ Timeout = 120 seconds (2 minutes)

**If you go silent for >2 minutes:**
- System marks you as "stale"
- Resume command still works
- No data loss (all logged)

---

## Footer Always Shows

**The footer appears in EVERY PS response.**

**Format:**
```
Instance: {id} | Epic: {epic} | Context: {%}% | Active: {hours}h
[Use "resume {id}" to restore this session]
```

**Don't remove the footer.** It's how users recover from disconnects.

---

## Example: Full Lifecycle

**Start of session:**
```
I'll start implementing epic-003.
────────────────────────────────────────
Instance: odin-PS-8f4a2b | Epic: 003 | Context: 5% | Active: 0.1h
```

**Mid-work (after spawning subagent):**
```
Subagent (haiku) spawned to implement auth logic.
Tests should complete in 15 minutes.
────────────────────────────────────────
Instance: odin-PS-8f4a2b | Epic: 003 | Context: 45% | Active: 1.1h
[Use "resume odin-PS-8f4a2b" to restore this session]
```

**Context warning (80% used):**
```
⚠️ Context window at 80%. Consider:
1. Committing current progress
2. Starting new session with "resume odin-PS-8f4a2b"
3. Or continue (system auto-checkpoints)
────────────────────────────────────────
Instance: odin-PS-8f4a2b | Epic: 003 | Context: 80% | Active: 2.5h
[Use "resume odin-PS-8f4a2b" to restore this session]
```

**End of session (epic complete):**
```
Epic 003 complete. All tests passing.
PR #45 created and ready for merge.
────────────────────────────────────────
Instance: odin-PS-8f4a2b | Epic: 003 | Context: 92% | Active: 4.3h
Ready to resume with "resume odin-PS-8f4a2b" if needed.
```

---

## Resume Workflow Steps

**1. User sends resume command:**
```
resume odin-PS-8f4a2b
```

**2. System returns recovery summary:**
- What epic was being worked on
- Current status
- Last action taken
- Next steps
- Checkpoint info

**3. You display summary and ask confirmation:**
```
Ready to continue? Say "continue" or describe what to do next.
```

**4. User confirms, you resume:**
- Load checkpoint state
- Continue from where you left off
- No progress lost

---

## Key Rules

✅ **ALWAYS show footer** (every response)
✅ **AUTO-REGISTER** (first response)
✅ **HEARTBEAT async** (no blocking)
✅ **LOG actions** (spawn, commit, deploy)
✅ **DETECT resume** (check for "resume {id}")
✅ **NO secrets in logs** (automatic sanitization)

❌ **Don't remove footer**
❌ **Don't skip heartbeat**
❌ **Don't hide context warnings**
❌ **Don't manual heartbeat** (automatic)

---

## Troubleshooting

**"Instance not found"**
- Session may have closed (>2min without heartbeat)
- Start new session normally
- Old data still available in logs

**"Can't resume, found multiple matches"**
- Use full instance ID: `resume odin-PS-8f4a2b`
- Or start new session

**"Context at 80%"**
- Normal warning
- You can continue, system auto-checkpoints
- Or start new session with resume

**Footer shows wrong epic**
- Update context with `updateContext(contextPercent, epicId)`
- Footer updates next response

---

## References

**Complete guide:** `/home/samuel/sv/docs/guides/ps-session-continuity-guide.md`
**Integration examples:** `/home/samuel/sv/docs/examples/ps-session-continuity-example.md`

---

**Maintained by**: Meta-Supervisor (MS)
**Status**: ✅ LIVE - All PSes have this enabled
**Last Updated**: 2026-01-28
