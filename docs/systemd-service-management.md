# Supervisor MCP Server - Systemd Service Management

## Service Overview

**Service Name**: `supervisor-mcp.service`
**Location**: `/etc/systemd/system/supervisor-mcp.service`
**User**: `samuel`
**Working Directory**: `/home/samuel/sv/supervisor-service-s`
**Port**: 8081
**Status**: Enabled (auto-start on boot)

---

## Quick Management Commands

### Check Service Status
```bash
# Full status
sudo systemctl status supervisor-mcp.service

# Brief status check
sudo systemctl is-active supervisor-mcp.service

# Check if enabled on boot
sudo systemctl is-enabled supervisor-mcp.service
```

### Start/Stop/Restart Service
```bash
# Start service
sudo systemctl start supervisor-mcp.service

# Stop service
sudo systemctl stop supervisor-mcp.service

# Restart service
sudo systemctl restart supervisor-mcp.service

# Reload service (if config changed)
sudo systemctl reload supervisor-mcp.service
```

### View Logs
```bash
# Follow logs in real-time (last 50 lines)
sudo journalctl -xeu supervisor-mcp.service -n 50 -f

# View all service logs
sudo journalctl -u supervisor-mcp.service

# View logs since boot
sudo journalctl -u supervisor-mcp.service -b

# View last hour of logs
sudo journalctl -u supervisor-mcp.service --since "1 hour ago"

# Filter by severity (WARNING, ERROR, etc)
sudo journalctl -u supervisor-mcp.service -p err
```

### Enable/Disable Auto-start
```bash
# Enable service to start on boot
sudo systemctl enable supervisor-mcp.service

# Disable service from starting on boot
sudo systemctl disable supervisor-mcp.service

# Check if enabled
sudo systemctl is-enabled supervisor-mcp.service
```

---

## Test Service Health

### Direct Port Test
```bash
# Test port 8081
curl -s http://localhost:8081/health | jq .

# Should see: {"status":"healthy","uptime":...}
```

### Verify Service is Running
```bash
# Check process
ps aux | grep "node.*dist/index.js" | grep -v grep

# Check port is listening
ss -tlnp | grep 8081
lsof -i :8081

# Check if started as correct user
ps -o user= -p $(pgrep -f "node.*dist/index.js")
```

---

## Service Configuration Details

### Environment Variables

Service loads from `/home/samuel/sv/supervisor-service-s/.env`:
- `PGHOST` - PostgreSQL host
- `PGPORT` - PostgreSQL port
- `PGUSER` - PostgreSQL user
- `PGPASSWORD` - PostgreSQL password
- `PGDATABASE` - PostgreSQL database
- `NODE_ENV` - Set to "production"
- Others from .env file

### Dependencies

- **PostgreSQL**: Service waits for `postgresql.service` to be active
- **Network**: Requires network.target

### Restart Behavior

- **Restart Policy**: Always restart on failure
- **Restart Delay**: 5 seconds between restarts
- **Max Restart Attempts**: 3 in 60-second window
- **After 3 failures**: Service enters failed state (manual restart required)

### Resource Limits

- **Max Open Files**: 65,536
- **Max Processes**: 32,768

---

## Troubleshooting

### Service Won't Start

1. **Check logs**:
   ```bash
   sudo journalctl -xeu supervisor-mcp.service
   ```

2. **Verify dependencies**:
   ```bash
   sudo systemctl status postgresql.service
   ```

3. **Check .env file**:
   ```bash
   cat /home/samuel/sv/supervisor-service-s/.env
   ```

4. **Test manual start**:
   ```bash
   cd /home/samuel/sv/supervisor-service-s
   /usr/bin/node dist/index.js
   ```

### Service Crashes on Restart

1. **Check for permission issues**:
   ```bash
   ls -ld /home/samuel/sv/supervisor-service-s
   ls -la /home/samuel/sv/supervisor-service-s/.env
   ```

2. **Verify database is running**:
   ```bash
   sudo systemctl status postgresql.service
   psql -U supervisor -d supervisor_meta -c "SELECT NOW();"
   ```

3. **Check system resources**:
   ```bash
   free -h
   df -h /home
   ```

### Service Running but Port Not Responding

1. **Verify port is listening**:
   ```bash
   ss -tlnp | grep 8081
   ```

2. **Test connectivity**:
   ```bash
   curl -v http://localhost:8081/health
   ```

3. **Check application logs**:
   ```bash
   sudo journalctl -u supervisor-mcp.service -n 100
   ```

---

## Boot-Time Testing

### After Reboot Verification

After the system reboots, verify service started:

```bash
# Check service is active
sudo systemctl status supervisor-mcp.service

# Verify it's running as samuel
ps aux | grep "node.*dist/index.js"

# Test health endpoint
curl -s http://localhost:8081/health | jq .

# Check service was started automatically (look for start time)
sudo systemctl show supervisor-mcp.service -p ActiveEnterTimestamp
```

### Manual Boot Simulation

```bash
# Stop service
sudo systemctl stop supervisor-mcp.service

# Verify stopped
sudo systemctl is-active supervisor-mcp.service  # Should show "inactive"

# Manually start (simulates boot)
sudo systemctl start supervisor-mcp.service

# Check it started
sudo systemctl status supervisor-mcp.service
curl http://localhost:8081/health
```

---

## File Locations

```
Service File:           /etc/systemd/system/supervisor-mcp.service
Working Directory:      /home/samuel/sv/supervisor-service-s
Application Binary:     /home/samuel/sv/supervisor-service-s/dist/index.js
Environment File:       /home/samuel/sv/supervisor-service-s/.env
Logs Directory:         /home/samuel/sv/supervisor-service-s/logs
Data Directory:         /home/samuel/sv/supervisor-service-s/data
Database:               localhost:5432 (PostgreSQL)
Service Health:         http://localhost:8081/health
```

---

## Useful One-Liners

```bash
# Get service PID
pgrep -f "node.*dist/index.js"

# Kill service gracefully
sudo systemctl stop supervisor-mcp.service

# Hard restart
sudo systemctl restart supervisor-mcp.service --no-block

# Watch status in real-time
watch -n 1 'sudo systemctl status supervisor-mcp.service --no-pager'

# Tail logs continuously
sudo journalctl -u supervisor-mcp.service -f

# Count service restarts
sudo journalctl -u supervisor-mcp.service | grep "restart" | wc -l

# Show service memory usage
sudo systemctl status supervisor-mcp.service | grep Memory

# Export detailed service info
sudo systemctl show supervisor-mcp.service > /tmp/service-info.txt
```

---

## Integration with Other Services

### PostgreSQL Dependency
Service automatically waits for PostgreSQL:
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql.service

# Manually start PostgreSQL first if needed
sudo systemctl start postgresql.service
sudo systemctl start supervisor-mcp.service
```

### Interaction with CI/CD
If using deployment automation:
```bash
# Before deployment: Stop service
sudo systemctl stop supervisor-mcp.service

# Deploy code
# Update dist/ folder

# After deployment: Start service
sudo systemctl start supervisor-mcp.service

# Verify
curl http://localhost:8081/health
```

---

## Additional Resources

- **Systemd Documentation**: `man systemd.service`
- **Journalctl Documentation**: `man journalctl`
- **Service File Location**: `/etc/systemd/system/supervisor-mcp.service`
- **Project Directory**: `/home/samuel/sv/supervisor-service-s`
- **Full Service Details**: `systemctl show supervisor-mcp.service`

---

**Created**: 2026-01-28
**Service Status**: ✅ Active and enabled on boot
**Last Verified**: Service running and responding on port 8081
