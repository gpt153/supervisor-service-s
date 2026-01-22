#!/bin/bash
#
# PS Health Monitor - Uninstallation Script
#
# Removes systemd service and timer for PS Health Monitor
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}PS Health Monitor - Uninstallation${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Check if running as root
if [[ $EUID -eq 0 ]]; then
    INSTALL_TYPE="system"
    SYSTEMD_DIR="/etc/systemd/system"
    SYSTEMCTL_CMD="systemctl"
    echo -e "${YELLOW}Uninstalling system service${NC}"
else
    INSTALL_TYPE="user"
    SYSTEMD_DIR="$HOME/.config/systemd/user"
    SYSTEMCTL_CMD="systemctl --user"
    echo -e "${YELLOW}Uninstalling user service${NC}"
fi

echo ""

# Check if service exists
if [[ ! -f "$SYSTEMD_DIR/ps-health-monitor.service" ]] && [[ ! -f "$SYSTEMD_DIR/ps-health-monitor.timer" ]]; then
    echo -e "${YELLOW}No installation found at $SYSTEMD_DIR${NC}"
    echo -e "${YELLOW}Nothing to uninstall${NC}"
    exit 0
fi

# Confirm uninstallation
read -p "Are you sure you want to uninstall PS Health Monitor? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Uninstallation aborted${NC}"
    exit 1
fi

echo ""

# Stop timer
if $SYSTEMCTL_CMD is-active --quiet ps-health-monitor.timer 2>/dev/null; then
    echo -e "${BLUE}Stopping timer...${NC}"
    $SYSTEMCTL_CMD stop ps-health-monitor.timer
    echo -e "${GREEN}✓ Timer stopped${NC}"
else
    echo -e "${YELLOW}Timer not running${NC}"
fi

# Stop service
if $SYSTEMCTL_CMD is-active --quiet ps-health-monitor.service 2>/dev/null; then
    echo -e "${BLUE}Stopping service...${NC}"
    $SYSTEMCTL_CMD stop ps-health-monitor.service
    echo -e "${GREEN}✓ Service stopped${NC}"
else
    echo -e "${YELLOW}Service not running${NC}"
fi

# Disable timer
if $SYSTEMCTL_CMD is-enabled --quiet ps-health-monitor.timer 2>/dev/null; then
    echo -e "${BLUE}Disabling timer...${NC}"
    $SYSTEMCTL_CMD disable ps-health-monitor.timer
    echo -e "${GREEN}✓ Timer disabled${NC}"
else
    echo -e "${YELLOW}Timer not enabled${NC}"
fi

# Remove service file
if [[ -f "$SYSTEMD_DIR/ps-health-monitor.service" ]]; then
    echo -e "${BLUE}Removing service file...${NC}"
    rm "$SYSTEMD_DIR/ps-health-monitor.service"
    echo -e "${GREEN}✓ Removed: $SYSTEMD_DIR/ps-health-monitor.service${NC}"
fi

# Remove timer file
if [[ -f "$SYSTEMD_DIR/ps-health-monitor.timer" ]]; then
    echo -e "${BLUE}Removing timer file...${NC}"
    rm "$SYSTEMD_DIR/ps-health-monitor.timer"
    echo -e "${GREEN}✓ Removed: $SYSTEMD_DIR/ps-health-monitor.timer${NC}"
fi

# Reload systemd
echo -e "${BLUE}Reloading systemd...${NC}"
$SYSTEMCTL_CMD daemon-reload
echo -e "${GREEN}✓ Systemd reloaded${NC}"

echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Uninstallation Complete!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo -e "${BLUE}Note:${NC} Database tables and health check data were NOT removed."
echo "To remove database tables, run:"
echo ""
echo -e "   ${YELLOW}psql -U supervisor -d supervisor_meta -c \"DROP TABLE IF EXISTS health_checks, active_spawns, ps_sessions CASCADE;\"${NC}"
echo ""
