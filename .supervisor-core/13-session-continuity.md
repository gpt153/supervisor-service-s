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

## MANDATORY: Log Critical Actions

**You MUST log these operations for crash recovery:**

### 1. Epic Start/Complete
```bash
# When starting epic
psql -U supervisor -d supervisor_service -p 5434 << EOF
INSERT INTO command_log (
  instance_id, command_type, action, parameters, success
) VALUES (
  '$INSTANCE_ID', 'epic', 'start',
  '{"epic_id": "epic-009", "title": "Pattern Detection"}', true
);
EOF

# When completing epic
psql -U supervisor -d supervisor_service -p 5434 << EOF
INSERT INTO command_log (
  instance_id, command_type, action, parameters, success
) VALUES (
  '$INSTANCE_ID', 'epic', 'complete',
  '{"epic_id": "epic-009", "confidence": 92}', true
);
EOF
```

### 2. Git Commits (CRITICAL)
```bash
# After every commit
COMMIT_HASH=$(git rev-parse HEAD)
COMMIT_MSG=$(git log -1 --pretty=%B)
psql -U supervisor -d supervisor_service -p 5434 << EOF
INSERT INTO command_log (
  instance_id, command_type, action, parameters, success
) VALUES (
  '$INSTANCE_ID', 'git', 'commit',
  '{"hash": "$COMMIT_HASH", "message": "$COMMIT_MSG"}', true
);
EOF
```

### 3. Spawn Operations
```bash
# After spawning subagent
psql -U supervisor -d supervisor_service -p 5434 << EOF
INSERT INTO command_log (
  instance_id, command_type, action, tool_name, parameters, success
) VALUES (
  '$INSTANCE_ID', 'spawn', 'spawn_subagent', 'Task',
  '{"subagent_type": "general-purpose", "model": "haiku", "purpose": "implement epic-009"}', true
);
EOF
```

### 4. Deploy Operations
```bash
# After deployment
psql -U supervisor -d supervisor_service -p 5434 << EOF
INSERT INTO command_log (
  instance_id, command_type, action, parameters, success
) VALUES (
  '$INSTANCE_ID', 'deploy', 'service_deployed',
  '{"service": "api", "port": 5100, "status": "healthy"}', true
);
EOF
```

### 5. Critical Errors
```bash
# On critical failure
psql -U supervisor -d supervisor_service -p 5434 << EOF
INSERT INTO command_log (
  instance_id, command_type, action, success, error_message
) VALUES (
  '$INSTANCE_ID', 'epic', 'validation_failed', false,
  'Epic 009: Tests failed after 3 attempts, confidence 45%'
);
EOF
```

**Do NOT log:** File reads, greps, routine checks, bash commands

---

## Key Rules

✅ **ALWAYS show footer** (every response)
✅ **REGISTER once** (first response only)
✅ **UPDATE heartbeat** (every 5-10 responses)
✅ **LOG critical actions** (epic start/complete, git commits, spawns, deploys, errors)
✅ **DETECT resume** (check for "resume {id}")

❌ **Don't skip registration**
❌ **Don't skip heartbeat updates**
❌ **Don't skip critical logging**
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

**After critical operations:**
- [ ] Log epic start/complete
- [ ] Log git commit (with hash)
- [ ] Log subagent spawn
- [ ] Log deploy operations
- [ ] Log critical errors

**When user says "resume":**
- [ ] Query session data
- [ ] Display resume summary
- [ ] Continue working

---

**Status**: ✅ LIVE - Database ready with selective critical logging
**Last Updated**: 2026-01-29
**Logging Strategy**: Selective (epic/git/spawn/deploy/error only, ~300 tokens/session overhead)
