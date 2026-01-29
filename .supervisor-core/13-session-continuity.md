# Session Continuity System (Epic 007-F)

**YOU HAVE SESSION RECOVERY VIA DATABASE**

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

## Registration (First Response Only)

**On your very first response, register your instance:**

```bash
# Generate instance ID
PROJECT="odin"  # Use your project name
INSTANCE_ID="${PROJECT}-PS-$(openssl rand -hex 3)"

# Register in database
psql -U supervisor -d supervisor_service -p 5434 << EOF
INSERT INTO supervisor_sessions (
  instance_id, project, instance_type, status,
  context_percent, created_at, last_heartbeat
) VALUES (
  '$INSTANCE_ID', '$PROJECT', 'PS', 'active',
  0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);
EOF

# Store instance_id for future use
echo $INSTANCE_ID
```

**Store the instance_id** - you'll need it for every response.

---

## Heartbeat (Every 5-10 Responses)

**Update your heartbeat periodically:**

```bash
psql -U supervisor -d supervisor_service -p 5434 << EOF
UPDATE supervisor_sessions
SET
  context_percent = 42,           -- Calculate from current usage
  current_epic = 'epic-003',      -- Current epic or NULL
  last_heartbeat = CURRENT_TIMESTAMP
WHERE instance_id = '$INSTANCE_ID';
EOF
```

**Frequency:** Every 5-10 responses, or when epic changes

---

## Footer Generation

**Query your session data and format footer:**

```bash
# Get session data
SESSION_DATA=$(psql -U supervisor -d supervisor_service -p 5434 -t -c "
SELECT
  instance_id,
  COALESCE(current_epic, '—'),
  context_percent,
  EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at))/3600
FROM supervisor_sessions
WHERE instance_id = '$INSTANCE_ID';
")

# Parse and format
IFS='|' read -r INST_ID EPIC CONTEXT AGE <<< "$SESSION_DATA"
AGE_ROUNDED=$(printf "%.1f" $AGE)

# Append to response
cat << EOF
────────────────────────────────────────
Instance: $INST_ID | Epic: $EPIC | Context: ${CONTEXT}% | Active: ${AGE_ROUNDED}h
[Use "resume $INST_ID" to restore this session]
EOF
```

---

## Resume Command

**When user says:** `resume {instance_id}`

**You respond with:**

```bash
# Get resume data
RESUME_DATA=$(psql -U supervisor -d supervisor_service -p 5434 -t -c "
SELECT
  s.instance_id,
  s.project,
  COALESCE(s.current_epic, 'none'),
  s.context_percent,
  (SELECT COUNT(*) FROM command_log WHERE instance_id = s.instance_id),
  (SELECT COUNT(*) FROM checkpoints WHERE instance_id = s.instance_id)
FROM supervisor_sessions s
WHERE s.instance_id = '$RESUME_ID'
  OR s.instance_id LIKE '$RESUME_ID%';
")

# Format response
cat << EOF
✅ Resumed: $RESUME_ID

PROJECT: $PROJECT
- Epic: $EPIC
- Context: $CONTEXT%
- Commands logged: $CMD_COUNT
- Checkpoints: $CP_COUNT

NEXT STEPS:
1. Check current epic status
2. Review recent commits
3. Continue implementation

Ready to continue.
EOF
```

Then show footer as normal.

---

## Optional: Log Important Actions

**After spawning subagent:**
```bash
psql -U supervisor -d supervisor_service -p 5434 << EOF
INSERT INTO command_log (
  instance_id, command_type, action, tool_name, success
) VALUES (
  '$INSTANCE_ID', 'spawn', 'spawn_subagent', 'Task', true
);
EOF
```

**After git commit:**
```bash
psql -U supervisor -d supervisor_service -p 5434 << EOF
INSERT INTO command_log (
  instance_id, command_type, action, parameters, success
) VALUES (
  '$INSTANCE_ID', 'git', 'commit',
  '{"message": "feat: add feature"}', true
);
EOF
```

---

## Key Rules

✅ **ALWAYS show footer** (every response)
✅ **REGISTER once** (first response only)
✅ **UPDATE heartbeat** (every 5-10 responses)
✅ **DETECT resume** (check for "resume {id}")

❌ **Don't skip registration**
❌ **Don't skip heartbeat updates**
❌ **Don't remove footer**

---

## Database Connection

**All queries use:**
- Database: `supervisor_service`
- Port: `5434`
- User: `supervisor`
- Password: From environment (already configured)

---

## Quick Checklist

**First response:**
- [ ] Generate instance_id
- [ ] INSERT into supervisor_sessions
- [ ] Store instance_id

**Every response:**
- [ ] Append footer with current data

**Every 5-10 responses:**
- [ ] UPDATE heartbeat with context%

**When user says "resume":**
- [ ] Query session data
- [ ] Display resume summary
- [ ] Continue working

---

**Status**: ✅ LIVE - Database ready
**Last Updated**: 2026-01-29
