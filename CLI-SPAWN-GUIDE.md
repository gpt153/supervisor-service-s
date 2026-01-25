# CLI Spawn Guide for Project Supervisors

**Simple, direct way to spawn subagents - NO MCP complexity**

---

## Quick Start

**From any PS session:**

```bash
Bash: /home/samuel/sv/supervisor-service-s/scripts/spawn implementation "Your task description"
```

**That's it!** The script auto-detects your project from pwd and spawns the agent.

---

## Common Examples

### Implementation
```bash
Bash: /home/samuel/sv/supervisor-service-s/scripts/spawn implementation "Replace OpenAI text-embedding-3-small with local CLIP model in image_embedding.py"
```

### Research
```bash
Bash: /home/samuel/sv/supervisor-service-s/scripts/spawn research "Investigate how the memory validation system works"
```

### Testing
```bash
Bash: /home/samuel/sv/supervisor-service-s/scripts/spawn testing "Write E2E tests for visual search feature"
```

### Bug Fix
```bash
Bash: /home/samuel/sv/supervisor-service-s/scripts/spawn implementation "Fix IndexError in embedding generation when image is None"
```

### Code Review
```bash
Bash: /home/samuel/sv/supervisor-service-s/scripts/spawn research "Review the CLIP integration code and identify potential issues"
```

---

## How It Works

1. **Auto-detect project**: Script reads your current directory
2. **Query Odin**: Asks AI router for optimal service (Gemini/Claude/Codex)
3. **Select template**: Picks best subagent template for task type
4. **Execute**: Spawns agent in YOUR project directory (not supervisor-service-s)
5. **Track**: Records usage, cost, duration in database

---

## Task Types

| Type | Use For |
|------|---------|
| `implementation` | Write code, add features, modify files, **bug fixes** |
| `research` | Analyze codebase, investigate issues, understand systems, code review |
| `testing` | Write tests, run validations, verify behavior |
| `validation` | Check acceptance criteria, verify requirements |
| `planning` | Create epics, design implementation plans |
| `documentation` | Update docs, README, API documentation |
| `deployment` | Deploy services, infrastructure changes |

---

## What You Get

**Console output:**
```
🚀 Spawning implementation agent...
   Project: health-agent
   Path: /home/samuel/sv/health-agent-s
   Description: Replace OpenAI with CLIP model

✅ Spawn completed:
   Agent ID: agent-1769343847222-84kgvxrfl
   Service: claude
   Model: claude-sonnet-4-5-20250929
   Duration: 19148ms
   Cost: $0.0030

📄 Output: /tmp/agent-1769343847222-84kgvxrfl-output.log
```

**Read output:**
```bash
Bash: cat /tmp/agent-1769343847222-84kgvxrfl-output.log
```

---

## Benefits vs MCP Spawn

### CLI Spawn (SIMPLER)
```bash
Bash: /home/samuel/sv/supervisor-service-s/scripts/spawn implementation "Add feature"
```
- ✅ Auto-detects project (no manual paths)
- ✅ 2 arguments only
- ✅ Simple Bash command
- ✅ Still uses AI router
- ✅ Still tracks cost

### MCP Spawn (VERBOSE)
```javascript
mcp_meta_spawn_subagent({
  task_type: "implementation",
  description: "Add feature",
  context: {
    project_path: "/home/samuel/sv/health-agent-s",  // Manual!
    project_name: "health-agent"                      // Manual!
  }
})
```
- ❌ Must specify project_path manually
- ❌ More typing
- ❌ Easy to forget project_path

---

## When to Use MCP Spawn Instead

**Use MCP spawn only when you need epic context:**

```javascript
mcp_meta_spawn_subagent({
  task_type: "implementation",
  description: "Implement Task 3 from epic",
  context: {
    project_path: "/home/samuel/sv/health-agent-s",
    project_name: "health-agent",
    epic_id: "epic-010",                              // Epic tracking
    files_to_review: ["src/services/image_embedding.py"],  // File hints
    validation_commands: ["pytest tests/test_clip.py"]      // Test commands
  }
})
```

**Otherwise, use CLI spawn - it's simpler.**

---

## Parallel Spawning (Future)

**Current**: Spawn blocks until agent completes

**Future enhancement**: Spawn multiple agents in parallel for independent tasks
```bash
# Spawn 3 independent tasks concurrently
Bash: /home/samuel/sv/supervisor-service-s/scripts/spawn implementation "Task 1" &
Bash: /home/samuel/sv/supervisor-service-s/scripts/spawn implementation "Task 2" &
Bash: /home/samuel/sv/supervisor-service-s/scripts/spawn implementation "Task 3" &
wait
```

---

## Troubleshooting

### "Command not found"
**Issue**: Script path incorrect
**Fix**: Use full path `/home/samuel/sv/supervisor-service-s/scripts/spawn`

### "No such file or directory"
**Issue**: pwd detection failed
**Fix**: Make sure you're in a project directory (health-agent-s, consilio-s, etc.)

### "Agent executed in wrong directory"
**Issue**: Old version before fix
**Fix**: Pull latest changes: `git pull origin feature/ui-001`

### "Odin query failed"
**Expected**: Odin fallback to heuristics works fine
**Not an error**: AI router still selects optimal service

---

## Summary

**What changed:**
- ✅ CLI spawn is now PRIMARY method (shown first in CLAUDE.md)
- ✅ MCP spawn is ALTERNATIVE (only when you need epic context)
- ✅ All 9 project CLAUDE.md files updated
- ✅ Health-agent PS now sees CLI spawn examples at top

**Usage:**
```bash
Bash: /home/samuel/sv/supervisor-service-s/scripts/spawn <type> "<description>"
```

**Result:** Simpler, faster, less typing, same AI routing and cost tracking.

---

**Updated**: 2026-01-25 12:25 UTC
**Status**: LIVE - All PSes updated
**Tested**: ✅ Works from health-agent-s, consilio-s
