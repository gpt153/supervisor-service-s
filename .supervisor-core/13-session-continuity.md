# Session Continuity System (Epic 007-F)

**YOU HAVE AUTOMATIC SESSION RECOVERY**

---

## Your Instance Footer

**CRITICAL: Every PS response MUST include this footer:**

```
Instance: {id} | Epic: {epic} | Context: {%}% | Active: {hours}h
[Use "resume {id}" to restore this session]
```

**Example:**
```
Instance: odin-PS-8f4a2b | Epic: 003 | Context: 42% | Active: 1.2h
```

**Never remove the footer** - it's how users recover from disconnects.

---

## Automatic Startup

On your first response as a PS:
1. ✅ System auto-registers your instance
2. ✅ You get a unique instance ID
3. ✅ Session automatically tracked
4. ✅ Heartbeat keeps you alive (120s timeout)

**You don't need to do anything.**

---

## Resume Command

**When user says:** `resume {instance_id}`

**You respond with:**
```
✅ Resumed: {instance_id}

EPIC {num}: {name}
- Status: IN_PROGRESS
- Progress: {%}%
- Last Action: {what you did}
- Time: {hours}

NEXT STEPS:
1. {step 1}
2. {step 2}

Ready to continue.
```

Then show footer as normal.

---

## Automatic Logging

**System auto-logs these actions (you don't call anything):**
- ✅ Spawn subagent (Task, Explore, Plan)
- ✅ Git commit
- ✅ Create PR
- ✅ Deploy service
- ✅ Complete epic

---

## Automatic Checkpoints

**System auto-creates checkpoints when:**
- ✅ Context ≥ 80% (warn user)
- ✅ Epic completion
- ✅ Major actions (spawn, PR, deploy)

**When context ≥ 80%, warn user:**
```
⚠️ Context window at 80%. Consider:
1. Committing current progress
2. Starting new session with "resume {id}"
3. Or continue (system auto-checkpoints)
```

---

## Heartbeat

**Every response includes automatic heartbeat (non-blocking).**

- ✅ Keeps session active
- ✅ Updates context/epic automatically
- ✅ Timeout: 120 seconds

**You don't call heartbeat manually** - it's automatic.

---

## Key Rules

✅ **ALWAYS show footer** (every response)
✅ **AUTO-REGISTER** (first response)
✅ **DETECT resume** (check for "resume {id}")
✅ **WARN at 80%** (context threshold)

❌ **Don't remove footer**
❌ **Don't skip heartbeat**
❌ **Don't hide context warnings**

---

## References

**Complete guide:** `/home/samuel/sv/docs/guides/ps-session-continuity-guide.md`

**Includes:**
- Full lifecycle examples
- Detailed resume workflow
- Troubleshooting
- Integration patterns

---

**Maintained by**: Meta-Supervisor (MS)
**Status**: ✅ LIVE - All PSes enabled
**Last Updated**: 2026-01-28
