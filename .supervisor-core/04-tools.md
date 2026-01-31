# Available Tools and Commands

## Primary Tool: TASK

**YOU ONLY USE THE TASK TOOL**

```javascript
Task({
  description: "Brief description",
  prompt: `Detailed instructions`,
  subagent_type: "general-purpose" | "Explore" | "Plan" | "Bash",
  model: "haiku" | "sonnet" | "opus"
})
```

**Decision tree:**
- Feature request → BMAD subagent
- Epic → Implementation subagent
- Research → Explore subagent
- Planning → Plan subagent

---

## Model Selection

**CRITICAL: Use Haiku for implementation**

| Task | Model | Requirements |
|------|-------|--------------|
| Implementation | `haiku` | Detailed epic, file paths, steps |
| Research | `sonnet` | Open-ended exploration |
| Planning | `opus` | Complex decisions |

**Haiku needs:** Exact paths, numbered steps, code snippets, test commands

---

## MCP Tools (Autonomous Access)

**Infrastructure:**
- **GCloud VM** (11): Create/manage VMs across odin/odin3/openhorizon
- **GCloud OAuth** (6): Create brands/clients
- **Tunnels** (3): Request/delete/list CNAMEs
- **Secrets** (3): Set/get/list vault secrets
- **Ports** (3): Allocate/get/list ports
- **Event Lineage** (7): Parent chains, smart resume, session export

**Event Lineage**: Debug via automatic parent tracking. Use `smart_resume_context` to restore sessions.

---

## References

**Tool guide:** `/home/samuel/sv/docs/guides/tool-usage-guide.md`
**Subagent catalog:** `/home/samuel/sv/docs/subagent-catalog.md`
