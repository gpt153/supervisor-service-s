# Session Continuity

**YOU HAVE SESSION RECOVERY VIA DATABASE**

---

## Multi-Machine Architecture

**Infrastructure Host: odin3** - PostgreSQL + MCP Server
**Development Machines: odin4, laptop** - Remote connections

**Check `.supervisor-specific/03-machine-config.md` for connection details**

---

## 🚨 MANDATORY: Register on First Response

**On your VERY FIRST response:**

### 1. Check for Auto-Registration

Look for this in conversation context:
```
🔄 **Session Auto-Registered**
✅ Instance: `[project]-PS-[id]`
```

**If present:** Export the ID and skip to step 3
```bash
export INSTANCE_ID="[the-id-from-SessionStart]"
```

### 2. Manual Registration (If Not Auto-Registered)

```bash
PROJECT="odin"  # Your project name

# Auto-detect machine
HOST_MACHINE=$(hostname)

# Set database connection based on machine
if [[ "$HOST_MACHINE" == "odin3"* ]] || [[ "$HOST_MACHINE" == *"odin3"* ]]; then
  PGHOST="localhost"
  PGPORT="5434"
elif [[ "$HOST_MACHINE" == "odin4"* ]] || [[ "$HOST_MACHINE" == *"odin4"* ]]; then
  PGHOST="odin3"
  PGPORT="5434"
else
  PGHOST="localhost"
  PGPORT="5434"
fi

INSTANCE_ID="${PROJECT}-PS-$(openssl rand -hex 3)"

psql -U supervisor -d supervisor_service -h $PGHOST -p $PGPORT << EOF
INSERT INTO supervisor_sessions (
  instance_id, project, instance_type, status,
  context_percent, host_machine, created_at, last_heartbeat
) VALUES (
  '$INSTANCE_ID', '$PROJECT', 'PS', 'active',
  0, '$HOST_MACHINE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);
EOF

export INSTANCE_ID
export HOST_MACHINE
export PGHOST
export PGPORT
```

### 3. Log Registration Event (MANDATORY)

**Immediately after registration, log the event:**
```typescript
ToolSearch({ query: "select:mcp_meta_emit_event" })
mcp_meta_emit_event({
  instance_id: INSTANCE_ID,
  event_type: "instance_registered",
  event_data: {
    instance_type: "PS",  // or "MS"
    project: PROJECT,
    created_at: new Date().toISOString()
  }
})
```

### 4. Confirm Registration

**Every first response must show:**
```
✅ Registered: [instance-id]@[machine]
✅ Logged: instance_registered event
```

---

## CRITICAL: Footer Required

**Every response MUST include:**

```
Instance: {id}@{machine} | Epic: {epic} | Context: {%}% | Active: {hours}h
[Use "resume {id}" to restore this session]
```

**Never remove** - users need this to recover from disconnects.

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

**Optional: Log heartbeat event for better debugging:**
```typescript
mcp_meta_emit_event({
  instance_id: INSTANCE_ID,
  event_type: "instance_heartbeat",
  event_data: {
    context_percent: 42,
    current_epic: "epic-003",
    age_seconds: 1800
  }
})
```

---

## Event Logging (MANDATORY)

**🚨 CRITICAL: You MUST log events or resume will be EMPTY**

**Use MCP tool `mcp_meta_emit_event` for ALL critical actions:**

```typescript
// After spawning subagent
ToolSearch({ query: "select:mcp_meta_emit_event" })
mcp_meta_emit_event({
  instance_id: INSTANCE_ID,
  event_type: "task_spawned",
  event_data: {
    task_type: "epic_implementation",
    subagent_type: "haiku",
    epic_id: "epic-003",
    description: "Implement authentication system"
  }
})

// After git commit
mcp_meta_emit_event({
  instance_id: INSTANCE_ID,
  event_type: "commit_created",
  event_data: {
    commit_hash: "a1b2c3d",
    message: "feat: implement auth system",
    files_changed: 7,
    epic_id: "epic-003"
  }
})

// After deployment
mcp_meta_emit_event({
  instance_id: INSTANCE_ID,
  event_type: "deployment_completed",
  event_data: {
    service: "api",
    environment: "development",
    health_status: "healthy",
    duration_seconds: 45,
    port: 5100
  }
})

// After epic completion
mcp_meta_emit_event({
  instance_id: INSTANCE_ID,
  event_type: "epic_completed",
  event_data: {
    epic_id: "epic-003",
    duration_hours: 2.5,
    files_changed: 12,
    tests_passed: true,
    validation_confidence: 95
  }
})
```

**MANDATORY - Log these IMMEDIATELY after they happen:**
- ✅ **task_spawned** - After EVERY Task tool call
- ✅ **commit_created** - After EVERY git commit
- ✅ **deployment_completed** - After EVERY deployment
- ✅ **epic_completed** - After marking epic done
- ✅ **epic_started** - When starting new epic
- ✅ **pr_created** - After creating PR

**Skip routine checks** (file reads, greps, status checks)

---

## Resume Command

**When user says:** `resume {instance_id}`

Use `mcp_meta_smart_resume_context` tool.

---

## Key Rules

🚨 **REGISTER FIRST** (very first response - NO EXCEPTIONS)
🚨 **ALWAYS show footer** (every response)
✅ **UPDATE heartbeat** (every 5-10 responses)
✅ **LOG critical actions** (epic, git, spawn, deploy, error)

---

## References

**Complete Guide:** `/home/samuel/sv/docs/guides/session-continuity-guide.md`

**Includes:**
- Detailed registration examples
- Footer generation code
- Manual database logging (fallback)
- Troubleshooting
