# Handoff: Multi-Machine Session Tracking Documentation Updates

**Date:** 2026-01-31
**From:** Meta-Supervisor (MS)
**To:** Documentation Expert
**Context:** Implemented multi-machine session tracking for odin3/odin4/laptop

---

## Background

The supervisor system now supports sessions running on multiple machines:
- **odin3**: Production VM - hosts all infrastructure (PostgreSQL, MCP server, tunnel manager, secrets)
- **odin4**: Development VM - connects remotely to odin3 services for parallel feature development
- **laptop**: Local development - connects remotely to odin3 services

**System Changes Implemented:**
- Added `host_machine` column to `supervisor_sessions` table
- Updated instance registration to record machine location
- Updated PSBootstrap to read `HOST_MACHINE` env var
- Updated session footer to show machine: `Instance: odin-PS-abc123@odin4`

---

## Documentation Updates Needed

### 1. Core Instruction: Session Continuity (HIGH PRIORITY)

**File:** `.supervisor-core/13-session-continuity.md`

**Sections to Update:**

#### Section: "Registration (First Response Only)" (around line 50)

**Add before the psql INSERT:**
```markdown
**Determine host machine:**
```bash
# Host machine is set via environment variable
HOST_MACHINE="${HOST_MACHINE:-unknown}"
# Valid values: odin3, odin4, laptop
```

**Update the INSERT statement to include host_machine:**
```sql
INSERT INTO supervisor_sessions (
  instance_id, project, instance_type, status,
  context_percent, host_machine, created_at, last_heartbeat
) VALUES (
  '$INSTANCE_ID', '$PROJECT', 'PS', 'active',
  0, '$HOST_MACHINE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);
```

#### Section: "Footer Generation" (around line 85)

**Update the footer format to include machine:**

```markdown
**Footer format (updated):**
```
Instance: $INST_ID@$HOST_MACHINE | Epic: $EPIC | Context: ${CONTEXT}% | Active: ${AGE_ROUNDED}h
[Use "resume $INST_ID" to restore this session]
```

Example:
```
Instance: odin-PS-8f4a2b@odin4 | Epic: epic-003 | Context: 42% | Active: 1.2h
```

#### Add New Section: "Multi-Machine Architecture" (after line 23)

```markdown
## Multi-Machine Architecture

**Infrastructure Host: odin3**
- PostgreSQL database (port 5434)
- MCP server (port 8081)
- All infrastructure services (tunnel manager, secrets, port allocation)

**Development Machines: odin4, laptop**
- Connect remotely to odin3 services
- No local infrastructure required
- Used for parallel feature development

**Environment Setup:**

Remote machines must configure:
```bash
# Database connection (remote to odin3)
PGHOST=odin3.internal  # Or odin3 IP
PGPORT=5434
PGUSER=supervisor
PGPASSWORD=<from-vault>
PGDATABASE=supervisor_service

# Host machine identifier (CRITICAL)
HOST_MACHINE=odin4      # or 'laptop' or 'odin3'
```

**Network Requirements:**
- Remote machines must have network access to odin3:5434 (PostgreSQL)
- Remote machines must have network access to odin3:8081 (MCP server)
- For laptop: Use Cloudflare Tunnel or VPN for secure access
```

---

### 2. Environment Configuration (MEDIUM PRIORITY)

**File:** `.env.example`

**Add these new variables:**

```bash
# Multi-Machine Configuration
# Identifies which machine this session is running on
# Valid values: odin3, odin4, laptop
HOST_MACHINE=odin3

# Database Connection (can be remote)
# For odin3: use localhost
# For odin4/laptop: use odin3's address
PGHOST=localhost
PGPORT=5434
PGUSER=supervisor
PGPASSWORD=supervisor
PGDATABASE=supervisor_service

# MCP Server URL (for remote access)
# For odin3: http://localhost:8081
# For odin4/laptop: http://odin3.internal:8081
MCP_SERVER_URL=http://localhost:8081
```

---

### 3. New Guide: Multi-Machine Setup (HIGH PRIORITY)

**File:** `docs/guides/multi-machine-setup-guide.md` (NEW FILE)

**Contents:**

```markdown
# Multi-Machine Setup Guide

**Last Updated:** 2026-01-31

This guide explains how to set up development environments on odin4 and laptop that connect to odin3's infrastructure.

---

## Architecture Overview

```
┌─────────────────────────────────────────┐
│        odin3 (Production/Infrastructure) │
│                                          │
│  ┌──────────────┐  ┌──────────────────┐ │
│  │ PostgreSQL   │  │ MCP Server       │ │
│  │ Port: 5434   │  │ Port: 8081       │ │
│  └──────────────┘  └──────────────────┘ │
│         ▲                 ▲              │
└─────────│─────────────────│──────────────┘
          │                 │
   ┌──────┴─────┬───────────┴──────┐
   │            │                  │
   ▼            ▼                  ▼
┌──────┐   ┌──────┐         ┌──────────┐
│odin3 │   │odin4 │         │ laptop   │
│ PS   │   │ PS   │         │ PS       │
└──────┘   └──────┘         └──────────┘
```

---

## odin3 (Infrastructure Host)

**Role:** Hosts all infrastructure services

**Services Running:**
- PostgreSQL (supervisor_service database)
- MCP Server (meta-supervisor tools)
- Tunnel Manager
- Secrets Manager
- Port Allocation Service

**Setup:** No changes needed - already configured

---

## odin4 (Development VM)

**Role:** Parallel development environment

**What Runs Here:**
- PS/MS sessions for feature development
- Code building and testing
- Git operations

**What Connects Remotely:**
- PostgreSQL on odin3:5434
- MCP Server on odin3:8081

**Setup Steps:**

### 1. Clone Repository
```bash
cd /home/samuel_153_se/sv
git clone https://github.com/gpt153/supervisor-service-s.git
cd supervisor-service-s
npm install
```

### 2. Configure Environment
```bash
# Create .env file
cat > .env << 'EOF'
# Database (remote to odin3)
PGHOST=10.128.0.2  # odin3 internal IP
PGPORT=5434
PGUSER=supervisor
PGPASSWORD=<get-from-vault>
PGDATABASE=supervisor_service

# Host machine identifier
HOST_MACHINE=odin4

# MCP Server (remote to odin3)
MCP_SERVER_URL=http://10.128.0.2:8081

# Local settings
NODE_ENV=development
EOF
```

### 3. Test Connection
```bash
# Test database connection
psql -h 10.128.0.2 -p 5434 -U supervisor -d supervisor_service -c "SELECT NOW();"

# Should show current timestamp
```

### 4. Test Session Registration
```bash
# Start a PS session
npm run test-ps-session

# Check it registered with correct machine
psql -h 10.128.0.2 -p 5434 -U supervisor -d supervisor_service \
  -c "SELECT instance_id, host_machine FROM supervisor_sessions ORDER BY created_at DESC LIMIT 1;"

# Should show: host_machine = 'odin4'
```

---

## laptop (Local Development)

**Role:** Local development environment

**What Runs Here:**
- PS/MS sessions via Claude Code CLI
- Local code editing
- Git operations

**What Connects Remotely:**
- PostgreSQL on odin3:5434 (via tunnel)
- MCP Server on odin3:8081 (via tunnel)

**Setup Steps:**

### 1. Network Access Options

**Option A: Cloudflare Tunnel (Recommended)**

Create tunnel endpoints:
```bash
# On odin3, add to tunnel config
cat >> ~/.cloudflared/config.yml << 'EOF'
ingress:
  - hostname: db.153.se
    service: tcp://localhost:5434
  - hostname: mcp.153.se
    service: http://localhost:8081
EOF

# Restart tunnel
cloudflared tunnel --config ~/.cloudflared/config.yml run
```

**Option B: VPN**
- Set up Tailscale/WireGuard
- Use odin3's VPN IP directly

### 2. Configure Environment
```bash
# Create .env file in ~/sv/supervisor-service-s/
cat > .env << 'EOF'
# Database (via tunnel)
PGHOST=db.153.se  # Tunnel hostname
PGPORT=5434
PGUSER=supervisor
PGPASSWORD=<get-from-vault>
PGDATABASE=supervisor_service

# Host machine identifier
HOST_MACHINE=laptop

# MCP Server (via tunnel)
MCP_SERVER_URL=https://mcp.153.se

# Local settings
NODE_ENV=development
EOF
```

### 3. Test Connection
```bash
# Test database connection
psql -h db.153.se -p 5434 -U supervisor -d supervisor_service -c "SELECT NOW();"
```

---

## Troubleshooting

### Can't Connect to Database

**Check network:**
```bash
# From odin4/laptop
nc -zv odin3.internal 5434  # or db.153.se 5434
```

**Check PostgreSQL is listening:**
```bash
# On odin3
ss -tlnp | grep 5434
# Should show: 0.0.0.0:5434 (listening on all interfaces)
```

**Check pg_hba.conf:**
```bash
# On odin3
sudo grep -v "^#" /etc/postgresql/14/main/pg_hba.conf | grep -v "^$"
# Should include rule for odin4/laptop network
```

### Session Shows Wrong Machine

**Check HOST_MACHINE env var:**
```bash
echo $HOST_MACHINE
# Should be: odin3, odin4, or laptop
```

**Check database:**
```bash
psql -h $PGHOST -p $PGPORT -U supervisor -d supervisor_service \
  -c "SELECT instance_id, host_machine, created_at FROM supervisor_sessions ORDER BY created_at DESC LIMIT 5;"
```

### MCP Tools Not Working

**Check MCP server is running on odin3:**
```bash
# On odin3
ps aux | grep mcp-server
```

**Test MCP endpoint:**
```bash
curl http://odin3.internal:8081/health
# Should return: {"status":"ok"}
```

---

## Security Considerations

### Database Access
- Use strong passwords (retrieve from vault)
- Limit pg_hba.conf to known IP ranges
- Consider SSL for laptop connections

### MCP Server Access
- Currently no authentication (internal network only)
- For laptop: Use Cloudflare Access for authentication
- Never expose MCP port directly to internet

### Secrets
- Never commit .env files
- Always retrieve PGPASSWORD from vault
- Use `mcp_meta_get_secret` in scripts

---

## Reference

**Architecture Diagram:** See above
**Network Ports:** PostgreSQL 5434, MCP 8081
**Machine Names:** odin3, odin4, laptop
**Database Schema:** See `host_machine` column in supervisor_sessions table
```

---

### 4. Deployment Status Updates (MEDIUM PRIORITY)

**File:** `.supervisor-specific/02-deployment-status.md`

**Add new section after line 20:**

```markdown
## Multi-Machine Architecture

**Infrastructure Host: odin3**
- PostgreSQL: `localhost:5434`
- MCP Server: `localhost:8081`
- Tunnel Manager: Active
- Secrets Manager: Active

**Development Machines:**
- **odin4**: Connects to odin3 services remotely
- **laptop**: Connects to odin3 services via tunnel

**Session Distribution:**
```sql
-- View active sessions by machine
SELECT * FROM active_sessions_by_machine;
```

**Environment Variables by Machine:**

| Variable | odin3 | odin4 | laptop |
|----------|-------|-------|--------|
| HOST_MACHINE | odin3 | odin4 | laptop |
| PGHOST | localhost | 10.128.0.2 | db.153.se |
| MCP_SERVER_URL | localhost:8081 | odin3:8081 | mcp.153.se |
```

---

### 5. Session Continuity Guide (HIGH PRIORITY)

**File:** `docs/guides/session-continuity-guide.md`

**Add new section (after "How It Works"):**

```markdown
## Multi-Machine Sessions

Sessions can run on three machines:
- **odin3**: Production VM (infrastructure host)
- **odin4**: Development VM (remote to odin3)
- **laptop**: Local development (remote to odin3)

**Host machine is recorded in database:**
```sql
SELECT instance_id, host_machine, project, status
FROM supervisor_sessions
WHERE status = 'active';
```

**Environment setup varies by machine:**
- **odin3**: Uses localhost for all services
- **odin4**: Uses odin3 internal IP (10.128.0.x)
- **laptop**: Uses Cloudflare Tunnel hostnames

**Footer shows machine:**
```
Instance: odin-PS-abc123@odin4 | Epic: 003 | Context: 42%
```

**Resume works across machines:**
- Sessions registered on odin4 can be resumed on laptop (same database)
- Use instance_id from footer: `resume odin-PS-abc123`
```

---

## System Changes Summary (Already Implemented)

### Database Migration
- Added `host_machine VARCHAR(64)` column to `supervisor_sessions`
- Added indexes for efficient filtering by machine
- Created view `active_sessions_by_machine` for cross-machine visibility

### Code Updates
- Updated `InstanceRegistry.registerInstance()` to accept `hostMachine` parameter
- Updated `PSBootstrap` to read `HOST_MACHINE` from environment
- Updated `Instance` TypeScript interface with `host_machine` field
- Updated session footer to show machine: `instance@machine` format

### Environment Variables
- Added `HOST_MACHINE` to identify machine running session
- Updated `.env.example` with multi-machine configuration

---

## Validation Checklist for Docs-Expert

After updating documentation:

- [ ] `.supervisor-core/13-session-continuity.md` includes HOST_MACHINE env var
- [ ] `.supervisor-core/13-session-continuity.md` footer shows machine format
- [ ] `.supervisor-core/13-session-continuity.md` has multi-machine architecture section
- [ ] `.env.example` includes HOST_MACHINE variable
- [ ] `docs/guides/multi-machine-setup-guide.md` created with complete setup instructions
- [ ] `.supervisor-specific/02-deployment-status.md` shows multi-machine architecture
- [ ] `docs/guides/session-continuity-guide.md` explains cross-machine sessions
- [ ] CLAUDE.md regenerated after instruction updates

---

## Questions/Clarifications

**Database password distribution:**
- Should laptop get password from vault via MCP tool?
- Or manual setup in .env?

**MCP server authentication:**
- Currently no auth for internal network
- Add API key for laptop connections?

**Cloudflare Tunnel setup:**
- Who creates the tunnel endpoints (db.153.se, mcp.153.se)?
- Meta-supervisor or user?

---

## References

**Planning Agent:** a0a7c08
**Implementation PRs:** (will be added after code changes committed)
**Database Schema:** `migrations/1769950000000_add_host_machine.sql`

---

**Next Steps for Docs-Expert:**
1. Review this handoff
2. Update instruction files as specified
3. Create new multi-machine setup guide
4. Regenerate CLAUDE.md
5. Test on odin4 to verify instructions are clear
