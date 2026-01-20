# Terminology Guide

## CRITICAL: How to Use These Terms

**When communicating with user:**
- ALWAYS use full term with abbreviation in brackets
- Example: "Start a supervisor session in browser (SSB)"
- Example: "Check the project directory (PD)"

**User will use abbreviations only:**
- User: "Start SSB" → You understand: "Start supervisor session in browser"
- User: "Check PD" → You: "Checking project directory (PD) at /path/..."

**YOU must expand abbreviations when responding.**

---

## Official Terms

### Browser Project (BP)
**What**: Configured project in Claude.ai with MCP server, GitHub repo, custom instructions
**Example**: "The Consilio browser project (BP) has GitHub integration"

### Supervisor Session Browser (SSB)
**What**: One chat session within a browser project (BP)
**Example**: "Start a new supervisor session in browser (SSB) for authentication work"

### Supervisor Session CLI (SSC)
**What**: Claude Code CLI session running in terminal
**Example**: "Open a supervisor session in CLI (SSC) in the consilio-s directory"

### Project Directory (PD)
**What**: Local folder containing code, .bmad/, all project files
**Example**: "Navigate to the project directory (PD) at /home/samuel/sv/consilio-s/"

### Project-Supervisor (PS)
**What**: Claude instance supervising a specific product/service
**Example**: "The Consilio project-supervisor (PS) spawned PIV agents"

**There are multiple PSes:**
- Consilio PS (manages Consilio service)
- Odin PS (manages Odin service)
- OpenHorizon PS (manages OpenHorizon service)
- Health-Agent PS (manages Health-Agent service)

### Meta-Supervisor (MS)
**What**: Claude instance managing supervisor infrastructure
**Example**: "The meta-supervisor (MS) provides MCP tools to all project-supervisors"

### Service
**What**: The actual product/platform being developed
**Example**: "Consilio is a consultation management service"

---

## Quick Reference

| User Says | You Understand | You Respond With |
|-----------|----------------|------------------|
| SSB | Supervisor session in browser | "supervisor session in browser (SSB)" |
| SSC | Supervisor session in CLI | "supervisor session in CLI (SSC)" |
| BP | Browser project | "browser project (BP)" |
| PD | Project directory | "project directory (PD)" |
| PS | Project-supervisor | "project-supervisor (PS)" |
| MS | Meta-supervisor | "meta-supervisor (MS)" |

---

## Hierarchy

```
Meta-Supervisor (MS)
├── Provides infrastructure
├── Serves MCP tools
└── Updates all PSes

Project-Supervisor (PS) - Consilio
├── Manages Consilio Service
├── Works in Consilio Project Directory (PD)
├── Accessible via Consilio Browser Project (BP)
└── Calls MS's MCP tools
```

---

## Usage Examples

**For complete usage examples and scenarios:**
- See: `/home/samuel/sv/docs/guides/terminology-usage-examples.md`

**Remember:**
✅ Always expand abbreviations when responding
✅ User can use abbreviations alone
✅ Be consistent across all communications
