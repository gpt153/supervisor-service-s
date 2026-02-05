# Session Continuity

**YOU HAVE SESSION RECOVERY VIA DATABASE**

---

## Multi-Machine Architecture

**Infrastructure Host: odin3** - PostgreSQL + MCP Server
**Development Machines: odin4, laptop** - Remote connections

**See `.supervisor-specific/03-machine-config.md` for connection details**

---

## 🚨 MANDATORY: Register on First Response

**On your VERY FIRST response:**

### 1. Check for Auto-Registration

Look for this message in conversation context:
```
🔄 **Session Auto-Registered**
✅ Instance: `[project]-PS-[id]`
```

**If present:** Export the ID and skip to step 3
```bash
export INSTANCE_ID="[the-id-from-SessionStart]"
```

### 2. Manual Registration (If Not Auto-Registered)

**Use registration script from complete guide** (see References below)

Key steps:
- Auto-detect machine (hostname)
- Set PGHOST/PGPORT from `.supervisor-specific/03-machine-config.md`
- Generate instance ID: `${PROJECT}-PS-$(openssl rand -hex 3)`
- Insert into supervisor_sessions table
- Export INSTANCE_ID, HOST_MACHINE

### 3. Log Registration Event (MANDATORY)

```typescript
ToolSearch({ query: "select:mcp_meta_emit_event" })
mcp_meta_emit_event({
  instance_id: INSTANCE_ID,
  event_type: "instance_registered",
  event_data: { instance_type: "PS", project: PROJECT }
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

**Update session in database:**
- Set context_percent (current context usage estimate)
- Set current_epic (which epic you're working on)
- Update last_heartbeat timestamp

**See complete guide for SQL command**

---

## Event Logging (MANDATORY)

**🚨 CRITICAL: You MUST log events or resume will be EMPTY**

**MANDATORY - Log these IMMEDIATELY after they happen:**
- ✅ **task_spawned** - After EVERY Task tool call
- ✅ **commit_created** - After EVERY git commit
- ✅ **deployment_completed** - After EVERY deployment
- ✅ **epic_completed** - After marking epic done
- ✅ **epic_started** - When starting new epic
- ✅ **pr_created** - After creating PR

**Skip routine operations** (file reads, greps, status checks)

**Tool to use:**
```typescript
ToolSearch({ query: "select:mcp_meta_emit_event" })
mcp_meta_emit_event({
  instance_id: INSTANCE_ID,
  event_type: "task_spawned",
  event_data: { /* event-specific data */ }
})
```

**See complete guide for all event examples**

---

## Resume Command

**When user says:** `resume {instance_id}`

```typescript
ToolSearch({ query: "select:mcp_meta_smart_resume_context" })
mcp_meta_smart_resume_context({ instance_id: "{instance_id}" })
```

---

## Key Rules

🚨 **REGISTER FIRST** (very first response - NO EXCEPTIONS)
🚨 **ALWAYS show footer** (every response)
✅ **UPDATE heartbeat** (every 5-10 responses)
✅ **LOG critical actions** (spawn, commit, deploy, epic events)

---

## References

**Complete Guide:** `/home/samuel/sv/docs/guides/session-continuity-complete-guide.md`

**Includes:**
- Complete registration bash scripts
- All event logging TypeScript examples
- Heartbeat SQL commands
- Footer generation code
- Multi-machine setup details
- Troubleshooting
