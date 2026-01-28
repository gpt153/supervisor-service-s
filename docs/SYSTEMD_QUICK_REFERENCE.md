# Supervisor MCP Server - Systemd Quick Reference

**Status Command**: `sudo systemctl status supervisor-mcp.service`

---

## Essential Commands

### Service Control
```bash
sudo systemctl start supervisor-mcp.service      # Start
sudo systemctl stop supervisor-mcp.service       # Stop  
sudo systemctl restart supervisor-mcp.service    # Restart
sudo systemctl reload supervisor-mcp.service     # Reload config
sudo systemctl enable supervisor-mcp.service     # Auto-start on boot
sudo systemctl disable supervisor-mcp.service    # Don't auto-start
```

### Status & Monitoring
```bash
sudo systemctl status supervisor-mcp.service          # Full status
sudo systemctl is-active supervisor-mcp.service       # Is running? (active/inactive)
sudo systemctl is-enabled supervisor-mcp.service      # Auto-start enabled? (enabled/disabled)
systemctl list-units | grep supervisor-mcp            # List service info
```

### Logs
```bash
sudo journalctl -u supervisor-mcp.service             # View all logs
sudo journalctl -u supervisor-mcp.service -f          # Follow logs (live)
sudo journalctl -u supervisor-mcp.service -n 100      # Last 100 lines
sudo journalctl -u supervisor-mcp.service -p err      # Errors only
sudo journalctl -u supervisor-mcp.service --since "1 hour ago"
```

### Health & Connectivity
```bash
curl http://localhost:8081/health                # Test health endpoint
curl -I http://localhost:8081/health              # Test with headers
curl -s http://localhost:8081/health | jq .      # Pretty print health
ss -tlnp | grep 8081                             # Check port listening
lsof -i :8081                                     # List process on port 8081
ps aux | grep "node.*dist/index.js"               # Check process
```

### Diagnostics
```bash
sudo systemctl show supervisor-mcp.service              # Show full config
sudo systemctl reset-failed supervisor-mcp.service     # Clear failure count
sudo journalctl -xeu supervisor-mcp.service            # Detailed error info
systemctl cat supervisor-mcp.service                   # View service file content
```

---

## Common Workflows

### After System Reboot
```bash
# Verify service started automatically
sudo systemctl is-active supervisor-mcp.service

# Test connectivity
curl http://localhost:8081/health | jq .status

# View startup logs
sudo journalctl -u supervisor-mcp.service --since "10 minutes ago"
```

### Deploying Code Updates
```bash
# Stop service
sudo systemctl stop supervisor-mcp.service

# Deploy new dist/ folder
# (your deployment commands here)

# Restart service
sudo systemctl restart supervisor-mcp.service

# Verify
curl http://localhost:8081/health
```

### Troubleshooting
```bash
# 1. Check if running
sudo systemctl is-active supervisor-mcp.service

# 2. View errors
sudo journalctl -xeu supervisor-mcp.service

# 3. Check port
ss -tlnp | grep 8081

# 4. Restart
sudo systemctl restart supervisor-mcp.service

# 5. Check again
curl http://localhost:8081/health
```

### Emergency: Kill and Restart
```bash
# Force stop
sudo systemctl stop supervisor-mcp.service

# Wait for it to stop
sleep 2

# Verify stopped
sudo systemctl is-active supervisor-mcp.service

# Restart
sudo systemctl start supervisor-mcp.service

# Verify running
curl http://localhost:8081/health
```

---

## Information Locations

| Item | Location |
|------|----------|
| Service File | `/etc/systemd/system/supervisor-mcp.service` |
| Project Dir | `/home/samuel/sv/supervisor-service-s` |
| Working Dir | `/home/samuel/sv/supervisor-service-s` |
| App Binary | `/home/samuel/sv/supervisor-service-s/dist/index.js` |
| Env Vars | `/home/samuel/sv/supervisor-service-s/.env` |
| Logs Dir | `/home/samuel/sv/supervisor-service-s/logs` |
| Data Dir | `/home/samuel/sv/supervisor-service-s/data` |
| Systemd Journal | `journalctl` command |

---

## Quick Checks

### Is service running?
```bash
sudo systemctl is-active supervisor-mcp.service
# Output: active or inactive
```

### Will it start on boot?
```bash
sudo systemctl is-enabled supervisor-mcp.service
# Output: enabled or disabled
```

### Is port listening?
```bash
ss -tlnp | grep 8081
# Should show: LISTEN ... ("node",pid=...,fd=25)
```

### Health status?
```bash
curl -s http://localhost:8081/health | jq '.status'
# Should show: "healthy"
```

### Memory usage?
```bash
sudo systemctl status supervisor-mcp.service | grep Memory
# Shows: Memory: XXM (current), XXM (peak)
```

---

## Restart Behavior

**On Failure:**
- Waits 5 seconds: `RestartSec=5`
- Tries 3 times: `StartLimitBurst=3`
- In 60 seconds: `StartLimitInterval=60`
- After 3 failures → manual restart needed

**On Success:**
- Stays running indefinitely
- Auto-restarts if process dies
- No restart limit on success

---

## Emergency Commands

```bash
# Force stop (kills process)
sudo kill -9 $(pgrep -f "node.*dist/index.js")

# Check PostgreSQL (dependency)
sudo systemctl status postgresql.service

# View system load
systemctl status supervisor-mcp.service | grep CPU

# See all supervisor services
systemctl list-units | grep supervisor
```

---

## One-Liners

```bash
# Full health check
curl -s http://localhost:8081/health | jq . && sudo systemctl status supervisor-mcp.service | head -5

# Watch status
watch -n 1 'sudo systemctl status supervisor-mcp.service | head -10'

# Tail logs
sudo journalctl -u supervisor-mcp.service -f -n 0

# Restart and verify
sudo systemctl restart supervisor-mcp.service && sleep 2 && curl -s http://localhost:8081/health | jq .status
```

---

**Service File**: `/etc/systemd/system/supervisor-mcp.service`
**Full Guide**: `systemd-service-management.md`
**Last Updated**: 2026-01-28

