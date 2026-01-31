# Session Continuity

**YOU HAVE SESSION RECOVERY VIA DATABASE**

---

## CRITICAL: Footer Required

**Every response MUST include this footer:**

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

## Setup (First Response Only)

**Register your instance once:**

```bash
PROJECT="odin"  # Your project name
INSTANCE_ID="${PROJECT}-PS-$(openssl rand -hex 3)"

psql -U supervisor -d supervisor_service -p 5434 << EOF
INSERT INTO supervisor_sessions (
  instance_id, project, instance_type, status,
  context_percent, created_at, last_heartbeat
) VALUES (
  '$INSTANCE_ID', '$PROJECT', 'PS', 'active',
  0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);
EOF
```

---

## Heartbeat (Every 5-10 Responses)

```bash
psql -U supervisor -d supervisor_service -p 5434 << EOF
UPDATE supervisor_sessions
SET context_percent = 42, current_epic = 'epic-003',
    last_heartbeat = CURRENT_TIMESTAMP
WHERE instance_id = '$INSTANCE_ID';
EOF
```

---

## Event Logging

**Use PSBootstrap convenience methods:**

```javascript
const bootstrap = new PSBootstrap('odin-s');

// Critical actions only
await bootstrap.logSpawnDecision('implementation', 'Starting epic');
await bootstrap.logCommit('feat: implement auth', 7, 'a1b2c3d');
await bootstrap.logDeploy('api', 5100, 'success');
await bootstrap.logEpicComplete('epic-009', 'Done', 'https://...');
await bootstrap.logError('test_failure', 'Tests failed');
```

**Log ONLY:** Epic start/complete, git commits, spawns, deploys, errors
**Don't log:** File reads, greps, routine checks (~300 tokens/session overhead)

---

## Resume Command

**When user says:** `resume {instance_id}`

Use `mcp_meta_smart_resume_context` tool - automatically reconstructs context using event lineage.

---

## Key Rules

✅ **ALWAYS show footer** (every response)
✅ **REGISTER once** (first response)
✅ **UPDATE heartbeat** (every 5-10 responses)
✅ **LOG critical actions** (epic, git, spawn, deploy, error)

---

## Database

- Database: `supervisor_service`
- Port: `5434`
- User: `supervisor`

---

## References

**Complete Guide:** `/home/samuel/sv/docs/guides/session-continuity-guide.md`

**Includes:**
- Detailed registration workflow
- Footer generation code
- Smart resume usage
- Manual logging examples
- Troubleshooting

---

**Status**: ✅ LIVE
**Overhead**: ~300 tokens/session (selective logging)
