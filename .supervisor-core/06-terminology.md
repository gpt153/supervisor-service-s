# Terminology Guide

## CRITICAL: How to Use These Terms

**When communicating with user:**
- ALWAYS use the full term with abbreviation in brackets
- Example: "Do you want to start a new supervisor session in browser (SSB)?"
- Example: "The Consilio project directory (PD) contains 5 epics"
- Example: "Should I update the meta-supervisor (MS) configuration?"

**User will use abbreviations only:**
- User: "Start SSB in Consilio"
- You understand this means: Start a supervisor session in browser in the Consilio browser project

**YOU must expand abbreviations when responding:**
- User: "Check the PD"
- You: "Checking the project directory (PD) at /home/samuel/sv/consilio-s/..."

---

## Official Terminology

### Browser Project (BP)
**Definition**: A configured project in Claude.ai with MCP server, GitHub repo, and custom instructions

**Examples:**
- "The Consilio browser project (BP) is configured with access to the Consilio GitHub repo"
- "Open the meta-supervisor browser project (BP) in Claude.ai"

**Key characteristics:**
- Lives in Claude.ai web interface
- Has MCP server URL configured
- Has GitHub integration (for product BPs)
- Has custom instructions (CLAUDE.md content)
- Can have multiple chats/sessions

---

### Supervisor Session Browser (SSB)
**Definition**: One chat session within a browser project (BP)

**Examples:**
- "Start a new supervisor session in browser (SSB) to work on authentication"
- "This supervisor session in browser (SSB) has been running for 2 hours"

**Key characteristics:**
- One chat thread in Claude.ai
- Has conversation history
- Has access to BP's MCP tools and GitHub
- Can spawn headless agents
- Has context limit (200K tokens)

---

### Supervisor Session CLI (SSC)
**Definition**: One Claude Code CLI session running in a terminal

**Examples:**
- "Open a supervisor session in CLI (SSC) in the consilio-s directory"
- "This supervisor session in CLI (SSC) has direct filesystem access"

**Key characteristics:**
- Runs in terminal via `claude` command
- Reads CLAUDE.md from filesystem
- Has direct file access
- Can spawn subagents
- Can import TypeScript modules directly

---

### Project Directory (PD)
**Definition**: The local folder on the VM containing code, .bmad/, and all project files

**Examples:**
- "The Consilio project directory (PD) is located at /home/samuel/sv/consilio-s/"
- "Navigate to the project directory (PD) to run npm install"

**Key characteristics:**
- Physical folder on VM filesystem
- Contains source code
- Contains .bmad/ planning directory
- Contains CLAUDE.md
- Contains package.json, node_modules, etc.

**Standard structure:**
```
/home/samuel/sv/[project]-s/     ← Project Directory (PD)
├── .bmad/                       ← Planning artifacts
├── src/ or backend/             ← Source code
├── CLAUDE.md                    ← Supervisor instructions
├── README.md                    ← Documentation
└── package.json                 ← Dependencies
```

---

### Project-Supervisor (PS)
**Definition**: The Claude instance (AI agent) supervising a specific product/service project

**Examples:**
- "The Consilio project-supervisor (PS) spawned PIV agents to implement authentication"
- "The project-supervisor (PS) for OpenHorizon is working on the travel booking feature"

**Key characteristics:**
- Oversees one product/service
- Has product-specific context
- Spawns PIV agents for implementation
- Manages epics, tasks, PRs
- Works in one project directory (PD)

**There are multiple PSes:**
- Consilio PS (manages Consilio service)
- Odin PS (manages Odin service)
- OpenHorizon PS (manages OpenHorizon service)
- Health-Agent PS (manages Health-Agent service)

---

### Meta-Supervisor (MS)
**Definition**: The Claude instance (AI agent) managing the supervisor infrastructure itself

**Examples:**
- "The meta-supervisor (MS) provides MCP tools to all project-supervisors (PSes)"
- "The meta-supervisor (MS) updated core instructions for all projects"

**Key characteristics:**
- Manages supervisor-service infrastructure
- Provides MCP server with 67+ tools
- Updates instruction templates
- Manages database migrations
- Does NOT work on products (that's PS's job)

**What MS manages:**
- /home/samuel/sv/supervisor-service/ (infrastructure code)
- MCP tools (PIV loop, secrets, ports, etc.)
- Core instruction templates
- Database schema
- Shared resources

---

### Service
**Definition**: The actual product/platform being developed by a project-supervisor (PS)

**Examples:**
- "Consilio is a consultation management service"
- "OpenHorizon is a travel planning service"
- "We're launching a new service called TravelBot"

**Key characteristics:**
- The end product users will use
- What gets deployed to production
- What appears on GitHub as gpt153/[service-name]
- Has its own customers/users

---

## Hierarchy and Relationships

```
Meta-Supervisor (MS)
├── Provides infrastructure
├── Serves MCP tools
└── Updates all PSes

Project-Supervisor (PS) - Consilio
├── Manages Consilio Service (the product)
├── Works in Consilio Project Directory (PD)
├── Accessible via Consilio Browser Project (BP)
├── Can spawn Supervisor Sessions (SSBs, SSCs)
└── Calls MS's MCP tools

Project-Supervisor (PS) - Odin
├── Manages Odin Service (the product)
├── Works in Odin Project Directory (PD)
└── ... (same pattern)
```

---

## Usage Examples

### Example 1: Starting Work
**User:** "Work on Consilio auth"

**Correct response:**
"I'll help you work on Consilio authentication. Would you like to:
1. Start a new supervisor session in browser (SSB) in the Consilio browser project (BP)
2. Open a supervisor session in CLI (SSC) in the Consilio project directory (PD)

The Consilio project-supervisor (PS) can spawn PIV agents to implement the feature."

**Wrong response:**
"Starting SSB in BP..." ← Don't use abbreviations alone

---

### Example 2: System-Wide Changes
**User:** "Add new MCP tool"

**Correct response:**
"To add a new MCP tool for all project-supervisors (PSes), we need to:
1. Plan in the meta-supervisor's (MS) planning area
2. Implement in the supervisor-service project directory (PD)
3. Deploy via the meta-supervisor (MS)
4. All project-supervisors (PSes) will have access

Should we start a supervisor session in browser (SSB) for the meta-supervisor (MS)?"

---

### Example 3: Multiple Sessions
**User:** "I have 3 SSBs open"

**You understand:** User has 3 supervisor sessions in browser (SSBs) open

**Correct response:**
"You have 3 supervisor sessions in browser (SSBs) open. Which supervisor session in browser (SSB) should we continue working in?"

**Wrong response:**
"You have 3 SSBs open. Which SSB?" ← Expand abbreviations

---

## Quick Reference Table

| User Says | You Understand | You Respond With |
|-----------|----------------|------------------|
| "SSB" | Supervisor session in browser | "supervisor session in browser (SSB)" |
| "BP" | Browser project | "browser project (BP)" |
| "PD" | Project directory | "project directory (PD)" |
| "PS" | Project-supervisor | "project-supervisor (PS)" |
| "MS" | Meta-supervisor | "meta-supervisor (MS)" |
| "SSC" | Supervisor session in CLI | "supervisor session in CLI (SSC)" |

---

## Remember

✅ **Always use full term + (abbreviation)**
✅ **User can use abbreviations alone**
✅ **You expand abbreviations when responding**
✅ **Be consistent across all communications**

This ensures clarity and helps user learn the system while maintaining speed in their interactions.
