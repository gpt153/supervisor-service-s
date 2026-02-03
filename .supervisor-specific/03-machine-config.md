# Machine Configuration

**Auto-detect machine and configure database connection**

---

## Services Running on odin3 (Infrastructure Host)

- ✅ PostgreSQL: `localhost:5434`
- ✅ MCP Server: `localhost:8081`
- ✅ Tunnel Manager
- ✅ Secrets Manager
- ✅ Port Allocation

---

## Connection Setup

```bash
# Auto-detect machine
HOST_MACHINE=$(hostname)

# Set database connection based on machine
if [[ "$HOST_MACHINE" == "odin3"* ]] || [[ "$HOST_MACHINE" == "gcp-odin3"* ]]; then
  # Infrastructure host - local connection
  PGHOST="localhost"
  PGPORT="5434"
elif [[ "$HOST_MACHINE" == "odin4"* ]]; then
  # Development machine - remote connection to odin3
  PGHOST="odin3"
  PGPORT="5434"
else
  # Unknown machine - try localhost
  PGHOST="localhost"
  PGPORT="5434"
  echo "⚠️  Unknown machine: $HOST_MACHINE, using localhost"
fi

# Common settings
PGUSER="supervisor"
PGDATABASE="supervisor_service"

export PGHOST PGPORT PGUSER PGDATABASE
```

---

## Session Registration

```bash
PROJECT="supervisor-service"
INSTANCE_ID="${PROJECT}-MS-$(openssl rand -hex 3)"

psql -U supervisor -d supervisor_service -h $PGHOST -p $PGPORT << EOF
INSERT INTO supervisor_sessions (
  instance_id, project, instance_type, status,
  context_percent, host_machine, created_at, last_heartbeat
) VALUES (
  '$INSTANCE_ID', '$PROJECT', 'MS', 'active',
  0, '$HOST_MACHINE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);
EOF

export INSTANCE_ID
echo "✅ Registered: $INSTANCE_ID@$HOST_MACHINE"
```

---

## Heartbeat

```bash
psql -U supervisor -d supervisor_service -h $PGHOST -p $PGPORT << EOF
UPDATE supervisor_sessions
SET context_percent = 42, current_epic = 'epic-003',
    last_heartbeat = CURRENT_TIMESTAMP
WHERE instance_id = '$INSTANCE_ID';
EOF
```

---

## Event Logging

```bash
# Log events (use auto-detected connection)
psql -U supervisor -d supervisor_service -h $PGHOST -p $PGPORT << EOF
INSERT INTO command_log (instance_id, action, description, parameters, tags, success)
VALUES ('$INSTANCE_ID', 'spawn', 'Description', '{"subagent":"haiku"}', '{"spawn"}', true);
EOF
```

---

## Supported Machines

| Machine | Type | Connection |
|---------|------|------------|
| odin3 / gcp-odin3-vm | Infrastructure host | localhost:5434 |
| odin4 | Development machine | odin3:5434 (remote) |
| laptop | Development machine | odin3:5434 (remote) |

---

## Verification

```bash
# Test connection
psql -U supervisor -d supervisor_service -h $PGHOST -p $PGPORT -c "SELECT NOW();"

# Should output current timestamp if connection works
```

---

**Note:** All bash commands in CLAUDE.md should use `$PGHOST` and `$PGPORT` variables instead of hardcoded values.
