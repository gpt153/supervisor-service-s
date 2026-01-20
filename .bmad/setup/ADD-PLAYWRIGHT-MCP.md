# Add Playwright MCP to Browser Projects

**CRITICAL:** PSes running in browser sessions (SSB) need Playwright MCP for browser automation tasks (Epic 014 - API key creation).

---

## Current Status

**✅ Available in:**
- Claude Code CLI (SSC) - via local MCP config

**❌ Missing in:**
- All Claude.ai browser projects (BP)
  - SV Meta
  - Consilio
  - Odin
  - OpenHorizon
  - Health Agent

---

## How to Add Playwright MCP (Per Project)

### Option 1: Local Playwright MCP Server (Recommended)

If you have Playwright MCP running locally:

1. **Open Claude.ai browser project**
2. **Go to Project Settings**
3. **Scroll to "Integrations" section**
4. **Click "Add MCP Server"**
5. **Configure:**
   - **Name:** `Playwright`
   - **Type:** `HTTP/SSE`
   - **URL:** `http://localhost:3000/sse` (or your local Playwright MCP port)
6. **Save**

### Option 2: Public Playwright MCP Server

If you expose Playwright MCP via tunnel:

1. **First expose Playwright locally:**
   ```bash
   # Allocate port from infrastructure range
   # supervisor-service uses 8000-8099
   ```

2. **Create tunnel:**
   ```bash
   # From meta-supervisor
   tunnel_request_cname({
     subdomain: "playwright",
     targetPort: 8010  # Example - use allocated port
   })
   ```

3. **Add to browser project:**
   - **URL:** `https://playwright.153.se/sse`

---

## Which Projects Need Playwright?

**MUST HAVE (Epic 014 automation):**
- ✅ **SV Meta** - Creates API keys autonomously

**OPTIONAL (future automation):**
- ⚠️ Consilio - May need UI testing
- ⚠️ Odin - May need UI testing
- ⚠️ OpenHorizon - May need UI testing
- ⚠️ Health Agent - Telegram bot, no browser UI

**Recommendation:** Add to SV Meta immediately, add to others as needed.

---

## Verification

After adding, test in browser session:

```
User: "What MCP tools are available?"

Expected response should include:
- mcp__playwright__browser_navigate
- mcp__playwright__browser_click
- mcp__playwright__browser_snapshot
- ... (other Playwright tools)
```

---

## Why This Is Needed

**Epic 014** requires browser automation to:
1. Navigate to Google AI Studio
2. Log in with credentials
3. Create API keys
4. Extract keys from UI
5. Store in secrets manager

**Without Playwright MCP, PSes cannot execute this automation.**

---

## Alternative (If Can't Add MCP)

If Playwright MCP can't be added to browser projects:

**Fallback:** Run automation from CLI session (SSC) instead:
```bash
cd /home/samuel/sv/supervisor-service-s
# Use CLI session which HAS Playwright access
```

**Downside:** Can't run autonomously from browser sessions.

---

**Next Step:** User must add Playwright MCP to browser project(s) before Epic 014 automation can work in SSB.
