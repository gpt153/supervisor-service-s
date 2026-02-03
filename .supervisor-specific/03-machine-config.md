# Machine Configuration (odin3)

**This machine: odin3 (Infrastructure Host)**

---

## Services Running Locally

- ✅ PostgreSQL: `localhost:5434`
- ✅ MCP Server: `localhost:8081`
- ✅ Tunnel Manager
- ✅ Secrets Manager
- ✅ Port Allocation

---

## Session Registration

**Uses local database connection:**

```bash
# Environment
HOST_MACHINE="odin3"
PGHOST="localhost"
PGPORT="5434"
PGUSER="supervisor"
PGDATABASE="supervisor_service"

# Registration
PROJECT="odin"
INSTANCE_ID="${PROJECT}-PS-$(openssl rand -hex 3)"

psql -U supervisor -d supervisor_service -p 5434 << EOF
INSERT INTO supervisor_sessions (
  instance_id, project, instance_type, status,
  context_percent, host_machine, created_at, last_heartbeat
) VALUES (
  '$INSTANCE_ID', '$PROJECT', 'PS', 'active',
  0, 'odin3', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);
EOF
```

---

## Heartbeat

```bash
psql -U supervisor -d supervisor_service -p 5434 << EOF
UPDATE supervisor_sessions
SET context_percent = 42, current_epic = 'epic-003',
    last_heartbeat = CURRENT_TIMESTAMP
WHERE instance_id = '$INSTANCE_ID';
EOF
```

---

## Footer Format

```
Instance: odin-PS-8f4a2b@odin3 | Epic: 003 | Context: 42% | Active: 1.2h
```

---

## Environment Variables

```bash
# Required
HOST_MACHINE=odin3
PGHOST=localhost
PGPORT=5434
PGUSER=supervisor
PGDATABASE=supervisor_service

# Optional
MCP_SERVER_URL=http://localhost:8081
```
