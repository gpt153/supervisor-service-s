# Quick Start Guide - Supervisor Service

## 🚀 Get Started in 5 Minutes

### 1. Install Dependencies
```bash
cd /home/samuel/sv/supervisor-service
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env if needed (default PORT=8080)
```

### 3. Start Development Server
```bash
npm run dev
```

Server will start on http://localhost:8080 (or PORT from .env)

---

## 🧪 Test the Server

### Health Check
```bash
curl http://localhost:8080/health
```

### List Available Tools
```bash
curl -X POST http://localhost:8080/mcp/meta \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'
```

### Run Full Test Suite
```bash
./test-server.sh
```

---

## 📖 Common MCP Requests

### Initialize Connection
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "clientInfo": {
      "name": "my-client",
      "version": "1.0.0"
    }
  }
}
```

### List Tools
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list"
}
```

### Execute Tool
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "echo",
    "arguments": {
      "message": "Hello!"
    }
  }
}
```

### Ping (Test Connectivity)
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "ping"
}
```

---

## 🏗️ Production Deployment

### Build for Production
```bash
npm run build
```

### Run Production Build
```bash
npm start
```

### Install as Systemd Service
```bash
sudo cp supervisor-service.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable supervisor-service
sudo systemctl start supervisor-service
sudo systemctl status supervisor-service
```

### View Logs
```bash
# Development
npm run dev

# Production (systemd)
sudo journalctl -u supervisor-service -f
```

---

## 🔧 Configuration

### Environment Variables
```env
# Server
NODE_ENV=development
PORT=8080
HOST=0.0.0.0

# Logging
LOG_LEVEL=debug
```

### Available Endpoints
- `GET /` - Service information
- `GET /health` - Health check with metrics
- `POST /mcp/meta` - MCP protocol endpoint

---

## 🛠️ Development

### Watch Mode (Auto-reload)
```bash
npm run dev
```

### Build TypeScript
```bash
npm run build
```

### Run Production Build
```bash
npm start
```

---

## 📚 Documentation

- **README.md** - Full documentation
- **API.md** - Complete API reference
- **EPIC-002-IMPLEMENTATION.md** - Implementation details
- **IMPLEMENTATION-COMPLETE.md** - Completion summary

---

## 🆘 Troubleshooting

### Port Already in Use
```bash
# Change port in .env
PORT=8081

# Or set inline
PORT=8081 npm run dev
```

### Check Server Status
```bash
curl http://localhost:8080/health
```

### View Logs
Development mode shows pretty logs in console.

Production uses systemd journal:
```bash
sudo journalctl -u supervisor-service -f
```

---

## ✅ Verify Installation

Run the test script:
```bash
chmod +x test-server.sh
./test-server.sh
```

Should see:
- ✅ Health check passes
- ✅ Root endpoint responds
- ✅ MCP initialize works
- ✅ Tools can be listed
- ✅ Tools can be executed
- ✅ Ping responds

---

## 🎯 Next Steps

1. ✅ Server is running
2. ✅ Basic tests pass
3. ➡️ Explore API.md for full API documentation
4. ➡️ Add your own tools in `src/tools/`
5. ➡️ Integrate with database (EPIC-003)
6. ➡️ Add project-specific endpoints (EPIC-004)

---

**Need Help?** See README.md for detailed documentation.
