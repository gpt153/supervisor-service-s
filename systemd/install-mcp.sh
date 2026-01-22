#!/bin/bash
#
# Supervisor MCP Server - Installation Script
#
# Installs systemd service for Supervisor MCP Server
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
echo -e "${BLUE}Supervisor MCP Server - Installation${NC}"
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

# Verify service file exists
if [[ ! -f "$SCRIPT_DIR/supervisor-mcp.service" ]]; then
    echo -e "${RED}ERROR: supervisor-mcp.service not found${NC}"
    exit 1
fi

# Verify daemon file exists
if [[ ! -f "$PROJECT_ROOT/src/mcp/mcp-daemon.ts" ]]; then
    echo -e "${RED}ERROR: src/mcp/mcp-daemon.ts not found${NC}"
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

# Verify Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}ERROR: Node.js not found. Please install Node.js v20+${NC}"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [[ $NODE_VERSION -lt 20 ]]; then
    echo -e "${RED}ERROR: Node.js v20+ required (found v$NODE_VERSION)${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js $(node --version) found${NC}"

# Check if port 8081 is available
if command -v lsof &> /dev/null; then
    if lsof -i :8081 &> /dev/null; then
        echo -e "${YELLOW}WARNING: Port 8081 is already in use${NC}"
        lsof -i :8081
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${RED}Installation aborted${NC}"
            exit 1
        fi
    else
        echo -e "${GREEN}✓ Port 8081 is available${NC}"
    fi
fi

# Create systemd directory if it doesn't exist
if [[ ! -d "$SYSTEMD_DIR" ]]; then
    echo -e "${BLUE}Creating systemd directory: $SYSTEMD_DIR${NC}"
    mkdir -p "$SYSTEMD_DIR"
fi

# Stop service if already running
echo -e "${BLUE}Stopping existing service (if running)...${NC}"
if [[ "$INSTALL_TYPE" == "system" ]]; then
    sudo systemctl stop supervisor-mcp.service 2>/dev/null || true
else
    systemctl --user stop supervisor-mcp.service 2>/dev/null || true
fi

# Copy service file
echo -e "${BLUE}Installing service file...${NC}"
if [[ "$INSTALL_TYPE" == "system" ]]; then
    sudo cp "$SCRIPT_DIR/supervisor-mcp.service" "$SYSTEMD_DIR/"
else
    # For user services, remove User/Group directives
    sed '/^User=/d; /^Group=/d' "$SCRIPT_DIR/supervisor-mcp.service" > "$SYSTEMD_DIR/supervisor-mcp.service"
fi
echo -e "${GREEN}✓ Installed: $SYSTEMD_DIR/supervisor-mcp.service${NC}"

# Reload systemd
echo -e "${BLUE}Reloading systemd...${NC}"
if [[ "$INSTALL_TYPE" == "system" ]]; then
    sudo systemctl daemon-reload
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
    echo "1. Enable service (start on boot):"
    echo -e "   ${YELLOW}sudo systemctl enable supervisor-mcp.service${NC}"
    echo ""
    echo "2. Start service now:"
    echo -e "   ${YELLOW}sudo systemctl start supervisor-mcp.service${NC}"
    echo ""
    echo "3. Check status:"
    echo -e "   ${YELLOW}sudo systemctl status supervisor-mcp.service${NC}"
    echo ""
    echo "4. View logs:"
    echo -e "   ${YELLOW}sudo journalctl -u supervisor-mcp.service -f${NC}"
    echo ""
    echo "5. Test the endpoint:"
    echo -e "   ${YELLOW}curl http://localhost:8081/health${NC}"
else
    echo "1. Enable service (start on login):"
    echo -e "   ${YELLOW}systemctl --user enable supervisor-mcp.service${NC}"
    echo ""
    echo "2. Start service now:"
    echo -e "   ${YELLOW}systemctl --user start supervisor-mcp.service${NC}"
    echo ""
    echo "3. Check status:"
    echo -e "   ${YELLOW}systemctl --user status supervisor-mcp.service${NC}"
    echo ""
    echo "4. View logs:"
    echo -e "   ${YELLOW}journalctl --user -u supervisor-mcp.service -f${NC}"
    echo ""
    echo "5. Enable lingering (keep running when logged out):"
    echo -e "   ${YELLOW}sudo loginctl enable-linger $USER${NC}"
    echo ""
    echo "6. Test the endpoint:"
    echo -e "   ${YELLOW}curl http://localhost:8081/health${NC}"
fi

echo ""
echo -e "${BLUE}Manual Testing:${NC}"
echo ""
echo "Test the daemon manually before enabling systemd:"
echo -e "   ${YELLOW}cd $PROJECT_ROOT${NC}"
echo -e "   ${YELLOW}node --import tsx/esm src/mcp/mcp-daemon.ts${NC}"
echo ""
echo -e "${BLUE}Documentation:${NC}"
echo ""
echo "See systemd/README.md for full documentation"
echo ""
