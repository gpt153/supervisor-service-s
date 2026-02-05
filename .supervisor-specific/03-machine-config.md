# Machine Configuration

**This machine: Auto-detected**
**Project**: supervisor-service (Meta-Supervisor)

---

## Connection Variables

```bash
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
  echo "⚠️  Unknown machine: $HOST_MACHINE, using localhost"
fi

PGUSER="supervisor"
PGDATABASE="supervisor_service"

export PGHOST PGPORT PGUSER PGDATABASE HOST_MACHINE
```

---

## Supported Machines

| Machine | Type | Connection |
|---------|------|------------|
| odin3 / gcp-odin3-vm | Infrastructure host | localhost:5434 |
| odin4 | Development VM | odin3:5434 (remote) |
| laptop | Development machine | odin3:5434 (remote) |

---

## Services on odin3

- PostgreSQL: `localhost:5434`
- MCP Server: `localhost:8081`
- Tunnel Manager, Secrets Manager, Port Allocation

---

## Usage

**For session registration, heartbeat, event logging examples:**
See `.supervisor-core/13-session-continuity.md` and complete guide

**This file provides only connection variables.**

---

## Verification

```bash
psql -U supervisor -d supervisor_service -h $PGHOST -p $PGPORT -c "SELECT NOW();"
```
