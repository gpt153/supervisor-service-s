# Session Continuity

**YOU HAVE SESSION RECOVERY VIA DATABASE**

---

## 🚨 CRITICAL: Auto-Initialization Hook

**On EVERY first response, check for SessionStart auto-registration:**

Look for this in the conversation context:
```
🔄 **Session Auto-Registered**
✅ Instance: `[project]-PS-[id]`
```

**If you see it:**
```bash
# Hook already registered! Just export the ID:
export INSTANCE_ID="[the-id-from-SessionStart]"
# Example: export INSTANCE_ID="consilio-PS-abc123"
```

**✅ DONE - Skip manual registration. DO NOT register again!**

**If NOT present:** Follow manual registration steps below.

**Hook location:** `.claude/hooks/session-start.sh` (future implementation)

---

## Multi-Machine Architecture

**Infrastructure Host: odin3**
- PostgreSQL: `localhost:5434`
- MCP Server: `localhost:8081`

**Development Machines: odin4, laptop**
- Connect remotely to odin3 services
- Parallel development environments

**Check `.supervisor-specific/03-machine-config.md` for connection details**

---

## CRITICAL: Footer Required

**Every response MUST include this footer:**

```
Instance: {id}@{machine} | Epic: {epic} | Context: {%}% | Active: {hours}h
[Use "resume {id}" to restore this session]
```

**Example:**
```
Instance: odin-PS-8f4a2b@odin4 | Epic: 003 | Context: 42% | Active: 1.2h
```

**Never remove the footer** - it's how users recover from disconnects.

---

## 🚨 MANDATORY: Check Registration Status FIRST

**On your VERY FIRST response, check if session is already registered:**

### Step 1: Check for Auto-Registration

**Look for this in the conversation context (SessionStart output):**
```
🔄 **Session Auto-Registered**
✅ Instance: `[project]-PS-[id]`
```

**If you see it:**
```bash
# Hook already registered! Just export the ID:
export INSTANCE_ID="[the-id-from-SessionStart]"
# Example: export INSTANCE_ID="consilio-PS-abc123"
```

**✅ DONE - Skip to Step 3. DO NOT register again!**

---

### Step 2: Manual Registration (If No Auto-Registration)

**Only if you did NOT see "Session Auto-Registered" above:**

```bash
PROJECT="odin"  # Your project name
HOST_MACHINE="${HOST_MACHINE:-odin3}"
INSTANCE_ID="${PROJECT}-PS-$(openssl rand -hex 3)"

# Connection varies by machine - see .supervisor-specific/03-machine-config.md
psql -U supervisor -d supervisor_service -p 5434 << EOF
INSERT INTO supervisor_sessions (
  instance_id, project, instance_type, status,
  context_percent, host_machine, created_at, last_heartbeat
) VALUES (
  '$INSTANCE_ID', '$PROJECT', 'PS', 'active',
  0, '$HOST_MACHINE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);
EOF

export INSTANCE_ID
```

---

### Step 3: Confirm Registration

**Every first response must confirm:**
```
✅ Registered: [instance-id]@[machine]
```

**⚠️ NEVER skip registration check** - prevents duplicate registrations.

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

**Critical:** PSes MUST log events for session recovery to work.

**Method 1: MCP Tools (Preferred):**
```bash
# Via MCP tools (if available)
# Use mcp_meta_log_command tool with instance_id and event details
```

**Method 2: Bash Commands (Fallback):**
```bash
# Direct database access
psql -U supervisor -d supervisor_service -p 5434 << EOF
INSERT INTO command_log (instance_id, action, description, parameters, tags, success)
VALUES ('$INSTANCE_ID', 'spawn', 'Task description', '{"subagent":"haiku"}', '{"spawn"}', true);
EOF
```

**What to log:**
- ✅ Epic start/complete
- ✅ Git commits
- ✅ Spawns
- ✅ Deploys
- ✅ Errors

**Don't log:**
- ❌ File reads, greps, routine checks

**Complete examples:** `/home/samuel/sv/docs/guides/ps-event-logging-guide.md`

**Overhead:** ~300 tokens/session (selective logging)

---

## Resume Command

**When user says:** `resume {instance_id}`

Use `mcp_meta_smart_resume_context` tool - automatically reconstructs context using event lineage.

---

## Key Rules (MANDATORY)

🚨 **REGISTER FIRST** (very first response - NO EXCEPTIONS)
🚨 **ALWAYS show footer** (every single response)
✅ **UPDATE heartbeat** (every 5-10 responses)
✅ **LOG critical actions** (epic, git, spawn, deploy, error)

**If you forget to register, user will remind you. DON'T forget.**

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
