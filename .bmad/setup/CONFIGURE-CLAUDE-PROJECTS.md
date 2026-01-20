# Configure Claude.ai Projects - Quick Guide

**Public URL**: https://super.153.se
**Status**: ✅ Ready to configure

---

## Create 5 Claude.ai Projects

### 1. SV Meta
**MCP Server URL**: `https://super.153.se/mcp/meta`

**Purpose**: Meta-supervisor for infrastructure
- Database management
- Migrations
- Cross-project tools
- System monitoring

**Project Knowledge**: Upload `/home/samuel/sv/supervisor-service/CLAUDE.md`

---

### 2. Consilio
**MCP Server URL**: `https://super.153.se/mcp/consilio`

**Purpose**: Consilio project development
- GitHub: https://github.com/gpt153/consilio-s
- Local: /home/samuel/sv/consilio-s/

**Project Knowledge**: Upload `/home/samuel/sv/consilio-s/CLAUDE.md`

---

### 3. Odin
**MCP Server URL**: `https://super.153.se/mcp/odin`

**Purpose**: Odin project development
- GitHub: https://github.com/gpt153/odin-s
- Local: /home/samuel/sv/odin-s/

**Project Knowledge**: Upload `/home/samuel/sv/odin-s/CLAUDE.md`

---

### 4. OpenHorizon
**MCP Server URL**: `https://super.153.se/mcp/openhorizon`

**Purpose**: OpenHorizon project development
- GitHub: https://github.com/gpt153/openhorizon-s
- Local: /home/samuel/sv/openhorizon-s/

**Project Knowledge**: Upload `/home/samuel/sv/openhorizon-s/CLAUDE.md`

---

### 5. Health Agent
**MCP Server URL**: `https://super.153.se/mcp/health-agent`

**Purpose**: Health-Agent project development
- GitHub: https://github.com/gpt153/health-agent-s
- Local: /home/samuel/sv/health-agent-s/

**Project Knowledge**: Upload `/home/samuel/sv/health-agent-s/CLAUDE.md`

---

## Step-by-Step Instructions

### For Each Project:

1. **Open Claude.ai** in your browser
2. **Click "New Project"** in the sidebar
3. **Name the project** (use names above)
4. **Click "Project Settings"**
5. **Scroll to "Custom Instructions"** section
6. **Upload the CLAUDE.md file** for that project
7. **Scroll to "Integrations"** section
8. **Click "Add MCP Server"**
9. **Enter the MCP Server URL** (from above)
10. **Add Playwright MCP** (see ADD-PLAYWRIGHT-MCP.md for instructions)
11. **Save and test**

### Test Each Project:

Once configured, test by asking:
- "What MCP tools are available?"
- "List all projects" (for Meta project)
- "Check project health"

---

## What Each Project Can Do

### SV Meta Project
✅ Manage database and migrations
✅ Store and retrieve encrypted secrets
✅ Allocate ports across all projects
✅ Manage Cloudflare DNS records
✅ Control GCloud VMs
✅ Track task timing
✅ Search knowledge base
✅ Update supervisor instructions
✅ Browser automation (requires Playwright MCP - see ADD-PLAYWRIGHT-MCP.md)

### Project-Specific (Consilio, Odin, etc.)
✅ Access project-specific context
✅ Use scoped MCP tools
✅ Work within project directory
✅ Follow project-specific guidelines
✅ Maintain project isolation

---

## Verification

After configuring all 5 projects, verify:

```bash
# Check all endpoints are accessible
curl https://super.153.se/endpoints | jq

# Test each MCP endpoint
for project in meta consilio odin openhorizon health-agent; do
  echo "Testing $project..."
  curl -s https://super.153.se/mcp/$project | head -5
done
```

---

## Benefits

✅ **Multi-Device Access**: Configure once, use anywhere
✅ **5 Isolated Contexts**: Each project has its own scope
✅ **63 MCP Tools**: Full automation capabilities
✅ **Public Access**: HTTPS via Cloudflare tunnel
✅ **Team Ready**: Share URLs with collaborators
✅ **Mobile Friendly**: Works on Claude mobile app

---

## Next Steps

After configuration:
1. Start working in any project
2. Use MCP tools for automation
3. Let supervisors manage infrastructure
4. Focus on building, not configuration

**Ready to configure!** Open Claude.ai and create your first project. 🚀
