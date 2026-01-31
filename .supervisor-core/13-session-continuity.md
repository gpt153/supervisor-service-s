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

## Event Lineage Tracking (Epic 008-C)

**EventLogger is auto-initialized by PSBootstrap**

You have automatic event lineage tracking without manual logging. PSBootstrap initializes EventLogger on startup, which automatically tracks parent UUIDs via AsyncLocalStorage.

**Benefits:**
- ✅ No manual parent UUID tracking needed
- ✅ Transparent parent context propagation through async operations
- ✅ 7 MCP tools for debugging and analysis
- ✅ Smart resume using parent chains
- ✅ Performance: 3.8ms for 100-depth chains

**Convenience Methods (Recommended):**

Instead of manual psql logging, use PSBootstrap convenience methods:

```javascript
const bootstrap = new PSBootstrap('odin-s');
await bootstrap.logUserMessage('Deploy app');
await bootstrap.logSpawnDecision('general-purpose', 'Complex task', 'haiku');
await bootstrap.logToolUse('Task', { param: 'value' });
await bootstrap.logToolResult(toolUuid, true, 250);
await bootstrap.logError('test_failure', 'Tests failed');
await bootstrap.logSpawn('general-purpose', 'Implement feature');
await bootstrap.logCommit('feat: add feature', 5);
await bootstrap.logDeploy('api', 5100, 'success');
await bootstrap.logPRCreated(url, 'epic-003', 'title');
await bootstrap.logEpicComplete('epic-003', 'All tests passed', url);
```

**Manual Logging (DEPRECATED):**

For backwards compatibility, manual psql logging still works, but PSBootstrap methods are preferred.

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

**Smart Resume uses event lineage (Epic 008-F):**

The `mcp_meta_smart_resume_context` tool intelligently reconstructs your session state using event lineage - no need to manually query. It:
- Finds the instance by ID (full or partial match)
- Traces parent chains (bounded to 50 recent events for efficiency)
- Reconstructs context: current epic, last action, recent spawns
- Returns next steps and ready-to-execute commands

**Using the tool:**
```javascript
// Smart resume automatically analyzes event lineage
const context = await tools.mcp_meta_smart_resume_context({
  instance_id: 'odin-PS-8f4a2b',  // Full or partial ID
  include_recent_events: true,
  max_chain_depth: 50,
});

// Response includes:
// - Instance state (epic, context%)
// - Event chain (last 10 events)
// - Reconstructed context from lineage
// - Next steps
// - Resume commands (copy-paste ready)
```

**Manual Resume (Fallback):**

If smart resume unavailable, query directly:
```bash
psql -U supervisor -d supervisor_service -p 5434 -t -c "
SELECT instance_id, project, current_epic, context_percent
FROM supervisor_sessions
WHERE instance_id = '$RESUME_ID' OR instance_id LIKE '$RESUME_ID%';
"
```

Then show footer as normal.

---

## MANDATORY: Log Critical Actions

**Use PSBootstrap methods (RECOMMENDED) instead of manual psql:**

```javascript
// Epic start
await bootstrap.logSpawnDecision('implementation', 'Starting epic-009');

// Epic completion
await bootstrap.logEpicComplete('epic-009', 'All tests passed', 'https://...');

// Git commit
await bootstrap.logCommit('feat: implement auth', 7, 'a1b2c3d');

// Spawn operation
await bootstrap.logSpawn('general-purpose', 'Implement feature', 'haiku');

// Deploy operation
await bootstrap.logDeploy('api', 5100, 'success', { health: 'ok' });

// Error
await bootstrap.logError('test_failure', 'Tests failed after 3 attempts');
```

**Manual psql Logging (DEPRECATED - Backwards Compatibility Only):**

For systems not yet using PSBootstrap, manual logging still works:

```bash
# Example: Epic start
psql -U supervisor -d supervisor_service -p 5434 << EOF
INSERT INTO command_log (instance_id, action, parameters, success)
VALUES ('$INSTANCE_ID', 'epic_start', '{"epic_id":"epic-009"}', true);
EOF
```

**Do NOT log:** File reads, greps, routine checks, debug output

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
