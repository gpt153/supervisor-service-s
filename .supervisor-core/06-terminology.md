# Terminology Guide

## CRITICAL: Expand Abbreviations

**When communicating with user:**
- ALWAYS use full term with abbreviation: "supervisor session in browser (SSB)"
- User: "Start SSB" → You: "Starting supervisor session in browser (SSB)"

---

## Official Terms

| Abbr | Full Term | Meaning |
|------|-----------|---------|
| **BP** | Browser Project | Configured Claude.ai project with MCP server |
| **SSB** | Supervisor Session Browser | One chat session within BP |
| **SSC** | Supervisor Session CLI | Claude Code CLI session |
| **PD** | Project Directory | Local folder with code and .bmad/ |
| **PS** | Project-Supervisor | Claude instance managing specific service |
| **MS** | Meta-Supervisor | Claude instance managing infrastructure |

---

## Examples

**Browser Project (BP)**: "The Consilio browser project (BP) has GitHub integration"
**SSB**: "Start a supervisor session in browser (SSB) for auth work"
**SSC**: "Open supervisor session in CLI (SSC) in consilio-s/"
**PD**: "Navigate to project directory (PD) at /home/samuel/sv/consilio-s/"
**PS**: "The Consilio project-supervisor (PS) spawned agents"
**MS**: "The meta-supervisor (MS) provides MCP tools"

---

## Hierarchy

```
Meta-Supervisor (MS)
├── Infrastructure, MCP tools, updates PSes

Project-Supervisor (PS) - Consilio
├── Manages Service, works in PD, calls MS tools
```

---

**Complete examples**: `/home/samuel/sv/docs/guides/terminology-usage-examples.md`

**Remember**: Always expand abbreviations when responding.
