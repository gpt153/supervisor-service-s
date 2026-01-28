# Supervisor MCP Server - Systemd Service Documentation

This directory contains complete documentation for the Supervisor MCP Server systemd service.

## Quick Navigation

### Getting Started (Pick One)

**New to this service?**
→ Start with [SYSTEMD_SETUP_SUMMARY.md](SYSTEMD_SETUP_SUMMARY.md)

**Need commands fast?**
→ See [SYSTEMD_QUICK_REFERENCE.md](SYSTEMD_QUICK_REFERENCE.md)

**Want full details?**
→ Read [systemd-service-management.md](systemd-service-management.md)

**Need the bottom line?**
→ Check [SETUP_COMPLETE.txt](SETUP_COMPLETE.txt)

---

## Document Overview

### SYSTEMD_SETUP_SUMMARY.md
**Purpose**: Complete overview and reference

**Contains**:
- Installation summary
- Verification tests (all results)
- Boot-time behavior details
- Troubleshooting quick reference
- File locations
- Security notes

**Best for**: Understanding what was set up and how to verify it

**Reading time**: 10-15 minutes

---

### SYSTEMD_QUICK_REFERENCE.md
**Purpose**: Quick command reference

**Contains**:
- Essential service control commands
- Status checking commands
- Log viewing commands
- Health check procedures
- Common workflows (deploy, troubleshoot, reboot)
- Information locations table
- 5 quick checks
- One-liners for common tasks

**Best for**: Copy-paste commands when you need them

**Reading time**: 5 minutes (or look up as needed)

---

### systemd-service-management.md
**Purpose**: Full management guide

**Contains**:
- Service overview and status
- Quick management commands
- Health testing procedures
- Service configuration details
- Detailed troubleshooting (3 scenarios)
- Boot-time testing instructions
- File locations reference
- Useful one-liners
- Integration with other services

**Best for**: Comprehensive understanding of service management

**Reading time**: 20-30 minutes

---

### SETUP_COMPLETE.txt
**Purpose**: Setup completion report

**Contains**:
- What was created
- Current status summary
- Key features implemented
- Essential commands
- Testing results
- Post-reboot verification steps
- Next steps recommendations

**Best for**: Quick overview of completed setup

**Reading time**: 5 minutes

---

## Service Information

| Item | Value |
|------|-------|
| Service Name | supervisor-mcp.service |
| Status | ACTIVE (running) |
| Auto-Start | ENABLED |
| Port | 8081 |
| User | samuel |
| Working Directory | /home/samuel/sv/supervisor-service-s |
| Database | PostgreSQL (5432) |
| Health Endpoint | http://localhost:8081/health |

---

## Most Common Commands

```bash
# Check if running
sudo systemctl is-active supervisor-mcp.service

# View logs
sudo journalctl -u supervisor-mcp.service -f

# Start/Stop/Restart
sudo systemctl start supervisor-mcp.service
sudo systemctl stop supervisor-mcp.service
sudo systemctl restart supervisor-mcp.service

# Test health
curl http://localhost:8081/health | jq .
```

---

## Quick Problem Solver

**Service won't start?**
```bash
sudo journalctl -xeu supervisor-mcp.service
```

**Port not responding?**
```bash
ss -tlnp | grep 8081
```

**Want to disable auto-start?**
```bash
sudo systemctl disable supervisor-mcp.service
```

**Want to enable auto-start again?**
```bash
sudo systemctl enable supervisor-mcp.service
```

---

## Service File Location

The actual systemd service file is at:

```
/etc/systemd/system/supervisor-mcp.service
```

View it with:
```bash
sudo cat /etc/systemd/system/supervisor-mcp.service
```

---

## System Logs

View the systemd journal logs:

```bash
# Follow logs (live)
sudo journalctl -u supervisor-mcp.service -f

# Last 100 lines
sudo journalctl -u supervisor-mcp.service -n 100

# Since system boot
sudo journalctl -u supervisor-mcp.service -b

# Last hour
sudo journalctl -u supervisor-mcp.service --since "1 hour ago"

# Errors only
sudo journalctl -u supervisor-mcp.service -p err
```

---

## Testing After Reboot

When the system reboots, verify the service:

```bash
# Check it's running
sudo systemctl is-active supervisor-mcp.service
# Should output: active

# Check it's enabled
sudo systemctl is-enabled supervisor-mcp.service
# Should output: enabled

# Test the health endpoint
curl http://localhost:8081/health | jq .
# Should show: {"status":"healthy",...}

# View startup logs
sudo journalctl -u supervisor-mcp.service --since "10 minutes ago"
```

---

## Directory Structure

```
/home/samuel/sv/supervisor-service-s/
├── docs/
│   ├── README-SYSTEMD.md                    ← You are here
│   ├── SYSTEMD_SETUP_SUMMARY.md             ← Complete overview
│   ├── SYSTEMD_QUICK_REFERENCE.md           ← Quick commands
│   ├── systemd-service-management.md        ← Full guide
│   └── SETUP_COMPLETE.txt                   ← Setup report
├── src/                                      ← Source code
├── dist/                                     ← Compiled JavaScript
├── .env                                      ← Environment variables
├── package.json
└── ... (other project files)

System file:
/etc/systemd/system/supervisor-mcp.service   ← Service definition
```

---

## Support & Help

**Systemd manual**: `man systemd.service`
**Journalctl manual**: `man journalctl`

**For detailed troubleshooting**:
→ See [systemd-service-management.md](systemd-service-management.md#troubleshooting)

**For quick commands**:
→ See [SYSTEMD_QUICK_REFERENCE.md](SYSTEMD_QUICK_REFERENCE.md)

---

## Created: 2026-01-28

Status: ✅ Complete and Verified
Last Verified: 2026-01-28 13:30:26 UTC

The Supervisor MCP Server is now a production-ready systemd service.
