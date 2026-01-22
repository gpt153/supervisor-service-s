# PS Health Monitor - Systemd Configuration

This directory contains systemd service and timer files for running the PS Health Monitor daemon.

## Files

- **ps-health-monitor.service** - Systemd service unit that runs the health monitor
- **ps-health-monitor.timer** - Systemd timer unit that triggers health checks every 10 minutes

## Installation

### Option 1: System-Wide Installation (Recommended for Production)

Install to `/etc/systemd/system/`:

```bash
# Copy files to systemd directory
sudo cp systemd/ps-health-monitor.service /etc/systemd/system/
sudo cp systemd/ps-health-monitor.timer /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable timer to start on boot
sudo systemctl enable ps-health-monitor.timer

# Start timer now
sudo systemctl start ps-health-monitor.timer

# Check status
sudo systemctl status ps-health-monitor.timer
sudo systemctl status ps-health-monitor.service
```

### Option 2: User-Level Installation (For Development/Testing)

Install to `~/.config/systemd/user/`:

```bash
# Create user systemd directory if it doesn't exist
mkdir -p ~/.config/systemd/user/

# Copy files to user systemd directory
cp systemd/ps-health-monitor.service ~/.config/systemd/user/
cp systemd/ps-health-monitor.timer ~/.config/systemd/user/

# Remove the 'User' and 'Group' directives (not needed for user services)
sed -i '/^User=/d; /^Group=/d' ~/.config/systemd/user/ps-health-monitor.service

# Reload user systemd
systemctl --user daemon-reload

# Enable timer to start on login
systemctl --user enable ps-health-monitor.timer

# Start timer now
systemctl --user start ps-health-monitor.timer

# Check status
systemctl --user status ps-health-monitor.timer
systemctl --user status ps-health-monitor.service

# Enable lingering (keeps user services running even when logged out)
sudo loginctl enable-linger $USER
```

## Manual Testing

Before installing as a systemd service, test the daemon manually:

```bash
cd /home/samuel/sv/supervisor-service-s

# Run directly (foreground)
node --loader tsx src/monitoring/ps-health-monitor-daemon.ts

# Run in background with nohup
nohup node --loader tsx src/monitoring/ps-health-monitor-daemon.ts > ps-health-monitor.log 2>&1 &

# Check if running
ps aux | grep ps-health-monitor

# Kill background process
pkill -f ps-health-monitor-daemon
```

## Monitoring

### Check Service Status

```bash
# System service
sudo systemctl status ps-health-monitor.service
sudo systemctl status ps-health-monitor.timer

# User service
systemctl --user status ps-health-monitor.service
systemctl --user status ps-health-monitor.timer
```

### View Logs

```bash
# System service - all logs
sudo journalctl -u ps-health-monitor.service

# System service - follow logs (tail -f)
sudo journalctl -u ps-health-monitor.service -f

# System service - last 50 lines
sudo journalctl -u ps-health-monitor.service -n 50

# User service - all logs
journalctl --user -u ps-health-monitor.service

# User service - follow logs
journalctl --user -u ps-health-monitor.service -f
```

### Check Timer Status

```bash
# System timer - list all timers
sudo systemctl list-timers

# System timer - specific timer
sudo systemctl list-timers ps-health-monitor.timer

# User timer - list all timers
systemctl --user list-timers

# User timer - specific timer
systemctl --user list-timers ps-health-monitor.timer
```

## Management

### Start/Stop/Restart

```bash
# System service
sudo systemctl start ps-health-monitor.timer
sudo systemctl stop ps-health-monitor.timer
sudo systemctl restart ps-health-monitor.timer

# User service
systemctl --user start ps-health-monitor.timer
systemctl --user stop ps-health-monitor.timer
systemctl --user restart ps-health-monitor.timer
```

### Enable/Disable Auto-Start

```bash
# System service
sudo systemctl enable ps-health-monitor.timer   # Start on boot
sudo systemctl disable ps-health-monitor.timer  # Don't start on boot

# User service
systemctl --user enable ps-health-monitor.timer   # Start on login
systemctl --user disable ps-health-monitor.timer  # Don't start on login
```

### Manual Trigger (Run Now)

```bash
# System service
sudo systemctl start ps-health-monitor.service

# User service
systemctl --user start ps-health-monitor.service
```

## Configuration

### Environment Variables

The service loads environment variables from `/home/samuel/sv/supervisor-service-s/.env`.

Required variables:
- `PGUSER` - PostgreSQL user
- `PGHOST` - PostgreSQL host
- `PGDATABASE` - PostgreSQL database name
- `PGPASSWORD` - PostgreSQL password
- `PGPORT` - PostgreSQL port

### Timer Configuration

To change the check interval, edit `ps-health-monitor.timer`:

```ini
[Timer]
# Run every 10 minutes
OnCalendar=*:0/10

# Run every 5 minutes
# OnCalendar=*:0/5

# Run every 15 minutes
# OnCalendar=*:0/15

# Run every hour
# OnCalendar=hourly
```

After editing, reload systemd:

```bash
sudo systemctl daemon-reload
sudo systemctl restart ps-health-monitor.timer
```

## Troubleshooting

### Service Won't Start

1. Check logs: `sudo journalctl -u ps-health-monitor.service -n 50`
2. Verify `.env` file exists and has correct permissions
3. Test database connection: `psql -U supervisor -d supervisor_meta -c "SELECT NOW()"`
4. Run daemon manually to see errors: `node --loader tsx src/monitoring/ps-health-monitor-daemon.ts`

### Timer Not Firing

1. Check timer status: `sudo systemctl status ps-health-monitor.timer`
2. List all timers: `sudo systemctl list-timers`
3. Check timer logs: `sudo journalctl -u ps-health-monitor.timer`

### Permissions Issues

If using system service and encountering permission errors:

1. Verify user/group in service file matches file owner
2. Check file permissions: `ls -la /home/samuel/sv/supervisor-service-s/`
3. Consider using user service instead (Option 2 above)

### tmux Commands Failing

If health checks can't send prompts to PS:

1. Verify tmux sessions exist: `tmux ls`
2. Check session names match pattern: `{project}-ps`
3. Test tmux send-keys manually: `tmux send-keys -t "consilio-ps" "test" Enter`

## Uninstallation

### System Service

```bash
sudo systemctl stop ps-health-monitor.timer
sudo systemctl disable ps-health-monitor.timer
sudo rm /etc/systemd/system/ps-health-monitor.service
sudo rm /etc/systemd/system/ps-health-monitor.timer
sudo systemctl daemon-reload
```

### User Service

```bash
systemctl --user stop ps-health-monitor.timer
systemctl --user disable ps-health-monitor.timer
rm ~/.config/systemd/user/ps-health-monitor.service
rm ~/.config/systemd/user/ps-health-monitor.timer
systemctl --user daemon-reload
```

## Database Health Check Audit

The service records all health checks in the `health_checks` table:

```sql
-- View recent health checks
SELECT
  project,
  check_type,
  status,
  action_taken,
  check_time
FROM health_checks
ORDER BY check_time DESC
LIMIT 20;

-- View health check summary
SELECT * FROM health_check_summary;

-- View stalled spawns for a project
SELECT * FROM get_stalled_spawns('consilio');
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  systemd timer (every 10 minutes)                   │
│  - Triggers ps-health-monitor.service               │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  ps-health-monitor.service                          │
│  - Runs ps-health-monitor-daemon.ts                 │
│  - Loads environment from .env                      │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  PSHealthMonitor (TypeScript class)                 │
│  1. Query active spawns from database               │
│  2. Check spawn output files for stalls/errors      │
│  3. Prompt PS sessions via tmux send-keys           │
│  4. Record health checks in database                │
│  5. Trigger automated handoff if context > 85%      │
└─────────────────────────────────────────────────────┘
```

## Phase 2: SDK/Browser Support (Future)

Currently only CLI (tmux) sessions are supported. Phase 2 will add support for browser-based PS sessions.

See: `/home/samuel/sv/supervisor-service-s/.bmad/feature-requests/ps-health-monitoring.md`
