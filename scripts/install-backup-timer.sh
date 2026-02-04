#!/bin/bash
# Install Claude Code backup systemd timer
# Usage: ./install-backup-timer.sh
#
# Installs user-level systemd units for daily backup at 03:00 UTC

set -euo pipefail

SYSTEMD_USER_DIR="$HOME/.config/systemd/user"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE_NAME="claude-backup"

echo "Installing Claude Code backup systemd timer..."
echo ""

# Create systemd user directory if it doesn't exist
mkdir -p "$SYSTEMD_USER_DIR"
echo "✓ Created systemd directory: $SYSTEMD_USER_DIR"

# Copy service and timer units
if [ ! -f "$SCRIPT_DIR/systemd/claude-backup.service" ]; then
  echo "ERROR: $SCRIPT_DIR/systemd/claude-backup.service not found"
  exit 1
fi

if [ ! -f "$SCRIPT_DIR/systemd/claude-backup.timer" ]; then
  echo "ERROR: $SCRIPT_DIR/systemd/claude-backup.timer not found"
  exit 1
fi

cp "$SCRIPT_DIR/systemd/claude-backup.service" "$SYSTEMD_USER_DIR/"
cp "$SCRIPT_DIR/systemd/claude-backup.timer" "$SYSTEMD_USER_DIR/"
echo "✓ Copied service and timer units"

# Reload systemd configuration
systemctl --user daemon-reload
echo "✓ Reloaded systemd configuration"

# Enable the timer (auto-start at boot)
systemctl --user enable "${SERVICE_NAME}.timer"
echo "✓ Enabled timer (will start at boot)"

# Start the timer
systemctl --user start "${SERVICE_NAME}.timer"
echo "✓ Started timer"

echo ""
echo "=== Installation Complete ==="
echo ""
echo "Status:"
systemctl --user status "${SERVICE_NAME}.timer" --no-pager || true

echo ""
echo "Schedule: Daily at 03:00 UTC"
echo ""
echo "Useful commands:"
echo "  Check status:    systemctl --user status ${SERVICE_NAME}.timer"
echo "  View logs:       journalctl --user -u ${SERVICE_NAME}.service -f"
echo "  Next run time:   systemctl --user list-timers ${SERVICE_NAME}.timer"
echo "  Stop timer:      systemctl --user stop ${SERVICE_NAME}.timer"
echo "  Disable timer:   systemctl --user disable ${SERVICE_NAME}.timer"
echo ""
echo "To uninstall:"
echo "  systemctl --user disable ${SERVICE_NAME}.timer"
echo "  rm $SYSTEMD_USER_DIR/${SERVICE_NAME}.{service,timer}"
echo "  systemctl --user daemon-reload"
