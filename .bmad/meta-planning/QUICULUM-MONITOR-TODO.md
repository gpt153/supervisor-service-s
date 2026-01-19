# Quiculum Monitor - Pending Setup

**Date:** 2026-01-18
**Status:** Not yet cloned to /sv/

---

## What's Missing

The `quiculum-monitor` project was **not** copied to `/home/samuel/sv/` during the migration.

### Current State

**Planning exists:**
- Location: `/home/samuel/supervisor/quiculum-monitor/`
- Contains: `.bmad/` planning artifacts, `CLAUDE.md`

**Implementation repo:**
- Unknown if GitHub repo exists
- Needs verification: `https://github.com/gpt153/quiculum-monitor`

---

## To Complete Setup

### Step 1: Verify GitHub Repo

Check if repo exists:
```bash
gh repo view gpt153/quiculum-monitor
```

If doesn't exist, create it:
```bash
gh repo create gpt153/quiculum-monitor --public --description "Quiculum monitoring system"
```

### Step 2: Clone to /sv/

```bash
cd /home/samuel/sv
git clone https://github.com/gpt153/quiculum-monitor.git
```

### Step 3: Copy Planning Artifacts

```bash
# Copy .bmad planning
cp -r /home/samuel/supervisor/quiculum-monitor/.bmad/* /home/samuel/sv/quiculum-monitor/.bmad/

# Copy supervision logs (if any)
cp -r /home/samuel/supervisor/quiculum-monitor/.agents/* /home/samuel/sv/quiculum-monitor/.agents/ 2>/dev/null || true
```

### Step 4: Create MCP Config

Create `/home/samuel/sv/mcp-configs/quiculum-monitor.json`:
```json
{
  "mcpServers": {
    "supervisor-service": {
      "command": "node",
      "args": [
        "/home/samuel/sv/supervisor-service/dist/mcp/server.js"
      ],
      "env": {
        "PROJECT_NAME": "quiculum-monitor",
        "DB_HOST": "/var/run/postgresql",
        "DB_PORT": "5434",
        "DB_NAME": "supervisor",
        "DB_USER": "supervisor_user",
        "ENCRYPTION_KEY": "ead0721a1b7c254b762ceb0a139c0104281c836a75d16d750788751dbf411f4f"
      }
    },
    "github": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-github"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "YOUR_GITHUB_TOKEN_HERE",
        "GITHUB_OWNER": "gpt153",
        "GITHUB_REPO": "quiculum-monitor"
      }
    }
  }
}
```

### Step 5: Allocate Port Range (in database)

Quiculum Monitor needs its own port range. Run in meta supervisor:

```sql
-- Check next available project ID
SELECT MAX(id) + 1 FROM project_port_ranges;

-- Allocate ports (assuming next ID is 5)
INSERT INTO project_port_ranges (project_name, port_range_start, port_range_end)
VALUES ('quiculum-monitor', 3500, 3599);
```

Or use MCP tool:
```
User (in Meta supervisor): "Allocate port range for quiculum-monitor"
```

---

## Why Skipped

During the initial migration, quiculum-monitor was skipped because:
1. Planning exists but implementation status unclear
2. Wanted to complete core 4 projects first (consilio, odin, openhorizon, health-agent)
3. Can be added later without affecting other projects

---

## When to Add

Add quiculum-monitor when:
- [ ] Confirmed GitHub repo exists or created
- [ ] Ready to start active development
- [ ] Other 4 projects are stable and working

---

**Current Priority:** Low (complete other 4 projects first)
