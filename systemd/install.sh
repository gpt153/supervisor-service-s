#!/bin/bash
#
# PS Health Monitor - Installation Script
#
# Installs systemd service and timer for PS Health Monitor
# Supports both system-wide and user-level installation
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}PS Health Monitor - Installation${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Check if running as root
if [[ $EUID -eq 0 ]]; then
    INSTALL_TYPE="system"
    SYSTEMD_DIR="/etc/systemd/system"
    echo -e "${GREEN}Installing as system service (running as root)${NC}"
else
    INSTALL_TYPE="user"
    SYSTEMD_DIR="$HOME/.config/systemd/user"
    echo -e "${GREEN}Installing as user service${NC}"
fi

echo -e "Installation type: ${YELLOW}$INSTALL_TYPE${NC}"
echo -e "Systemd directory: ${YELLOW}$SYSTEMD_DIR${NC}"
echo ""

# Verify systemd is available
if ! command -v systemctl &> /dev/null; then
    echo -e "${RED}ERROR: systemctl not found. Is systemd installed?${NC}"
    exit 1
fi

# Verify files exist
if [[ ! -f "$SCRIPT_DIR/ps-health-monitor.service" ]]; then
    echo -e "${RED}ERROR: ps-health-monitor.service not found${NC}"
    exit 1
fi

if [[ ! -f "$SCRIPT_DIR/ps-health-monitor.timer" ]]; then
    echo -e "${RED}ERROR: ps-health-monitor.timer not found${NC}"
    exit 1
fi

# Verify .env file exists
if [[ ! -f "$PROJECT_ROOT/.env" ]]; then
    echo -e "${YELLOW}WARNING: .env file not found at $PROJECT_ROOT/.env${NC}"
    echo -e "${YELLOW}Service may fail to start without database credentials${NC}"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}Installation aborted${NC}"
        exit 1
    fi
fi

# Create systemd directory if it doesn't exist
if [[ ! -d "$SYSTEMD_DIR" ]]; then
    echo -e "${BLUE}Creating systemd directory: $SYSTEMD_DIR${NC}"
    mkdir -p "$SYSTEMD_DIR"
fi

# Copy service file
echo -e "${BLUE}Installing service file...${NC}"
if [[ "$INSTALL_TYPE" == "system" ]]; then
    cp "$SCRIPT_DIR/ps-health-monitor.service" "$SYSTEMD_DIR/"
else
    # For user services, remove User/Group directives
    sed '/^User=/d; /^Group=/d' "$SCRIPT_DIR/ps-health-monitor.service" > "$SYSTEMD_DIR/ps-health-monitor.service"
fi
echo -e "${GREEN}✓ Installed: $SYSTEMD_DIR/ps-health-monitor.service${NC}"

# Copy timer file
echo -e "${BLUE}Installing timer file...${NC}"
cp "$SCRIPT_DIR/ps-health-monitor.timer" "$SYSTEMD_DIR/"
echo -e "${GREEN}✓ Installed: $SYSTEMD_DIR/ps-health-monitor.timer${NC}"

# Reload systemd
echo -e "${BLUE}Reloading systemd...${NC}"
if [[ "$INSTALL_TYPE" == "system" ]]; then
    systemctl daemon-reload
else
    systemctl --user daemon-reload
fi
echo -e "${GREEN}✓ Systemd reloaded${NC}"

echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Installation Complete!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""

# Provide next steps
echo -e "${BLUE}Next Steps:${NC}"
echo ""

if [[ "$INSTALL_TYPE" == "system" ]]; then
    echo "1. Enable timer (start on boot):"
    echo -e "   ${YELLOW}sudo systemctl enable ps-health-monitor.timer${NC}"
    echo ""
    echo "2. Start timer now:"
    echo -e "   ${YELLOW}sudo systemctl start ps-health-monitor.timer${NC}"
    echo ""
    echo "3. Check status:"
    echo -e "   ${YELLOW}sudo systemctl status ps-health-monitor.timer${NC}"
    echo -e "   ${YELLOW}sudo systemctl status ps-health-monitor.service${NC}"
    echo ""
    echo "4. View logs:"
    echo -e "   ${YELLOW}sudo journalctl -u ps-health-monitor.service -f${NC}"
else
    echo "1. Enable timer (start on login):"
    echo -e "   ${YELLOW}systemctl --user enable ps-health-monitor.timer${NC}"
    echo ""
    echo "2. Start timer now:"
    echo -e "   ${YELLOW}systemctl --user start ps-health-monitor.timer${NC}"
    echo ""
    echo "3. Check status:"
    echo -e "   ${YELLOW}systemctl --user status ps-health-monitor.timer${NC}"
    echo -e "   ${YELLOW}systemctl --user status ps-health-monitor.service${NC}"
    echo ""
    echo "4. View logs:"
    echo -e "   ${YELLOW}journalctl --user -u ps-health-monitor.service -f${NC}"
    echo ""
    echo "5. Enable lingering (keep running when logged out):"
    echo -e "   ${YELLOW}sudo loginctl enable-linger $USER${NC}"
fi

echo ""
echo -e "${BLUE}Manual Testing:${NC}"
echo ""
echo "Test the daemon manually before enabling systemd:"
echo -e "   ${YELLOW}cd $PROJECT_ROOT${NC}"
echo -e "   ${YELLOW}node --loader tsx src/monitoring/ps-health-monitor-daemon.ts${NC}"
echo ""
echo -e "${BLUE}Documentation:${NC}"
echo ""
echo "See systemd/README.md for full documentation"
echo ""
