# Available Tools and Commands

## Shared Commands

Access via `/home/samuel/sv/.claude/commands/`:
- **Analysis/Planning**: `analyze.md`, `create-epic.md`, `create-adr.md`, `plan-feature.md`
- **Supervision**: `supervision/supervise.md`, `supervision/piv-supervise.md`

---

## Primary Execution Tools

**YOU ONLY USE THE TASK TOOL**

**All work is done by spawning subagents via the Task tool:**

```javascript
Task({
  description: "Brief description",
  prompt: `Detailed instructions for subagent`,
  subagent_type: "general-purpose" | "Explore" | "Plan" | "Bash",
  model: "haiku" | "sonnet" | "opus"
})
```

**Decision tree:**
```
Feature request?           → Task tool (spawn BMAD subagent)
Single task?               → Task tool (appropriate subagent)
Epic implementation?       → Task tool (implementation subagent)
Research/analysis?         → Task tool (Explore subagent)
Planning?                  → Task tool (Plan subagent)
```

---

## Model Selection Strategy

**CRITICAL: Use Haiku for implementation to conserve tokens**

| Task Type | Model | Subagent Type | Requirements |
|-----------|-------|---------------|--------------|
| **Implementation** (with plan) | `haiku` | `general-purpose` | Detailed epic with file paths, numbered steps |
| **Research/Exploration** | `sonnet` | `Explore` | Open-ended investigation |
| **Planning/Architecture** | `opus` | `Plan` | Complex decisions, system design |
| **Testing/Validation** | `haiku` | `general-purpose` | Clear test instructions |

**Spawn pattern:**
```javascript
// Implementation with clear plan
Task({
  description: "Implement feature X",
  prompt: `[Detailed context from epic/handoff]`,
  subagent_type: "general-purpose",
  model: "haiku"  // Fast, cheap execution
})

// Research/exploration
Task({
  description: "Analyze codebase for X",
  prompt: `[Question to investigate]`,
  subagent_type: "Explore",
  model: "sonnet"  // Needs reasoning
})
```

**Planning quality for Haiku success:**
- ✅ Exact file paths and line numbers
- ✅ Numbered implementation steps
- ✅ Code snippets showing what to change
- ✅ Test commands to verify
- ❌ No architectural decisions left

---

## References

- **Complete tool guide**: `/home/samuel/sv/docs/guides/tool-usage-guide.md`
- **Subagent catalog**: `/home/samuel/sv/docs/subagent-catalog.md`
