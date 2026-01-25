# Project-Supervisor (PS) Spawn Usage Guide

**CRITICAL: How to spawn subagents correctly from PS sessions**

---

## 🚨 The Issue You Just Hit

When health-agent PS called:
```javascript
mcp_meta_spawn_subagent({
  task_type: "implementation",
  description: "Replace OpenAI with CLIP...",
  context: {
    epic_id: "epic-010",
    files_to_review: [...]
  }
})
```

**Result**: Agent executed in `/home/samuel/sv/supervisor-service-s` (WRONG)

**Why**: Missing `project_path` and `project_name` in context.

---

## ✅ CORRECT Way to Spawn (CLI PSes)

**Health-Agent PS:**
```javascript
mcp_meta_spawn_subagent({
  task_type: "implementation",
  description: "Replace OpenAI with CLIP...",
  context: {
    project_path: "/home/samuel/sv/health-agent-s",  // MANDATORY
    project_name: "health-agent",                     // MANDATORY
    epic_id: "epic-010",
    files_to_review: [...]
  }
})
```

**Consilio PS:**
```javascript
context: {
  project_path: "/home/samuel/sv/consilio-s",
  project_name: "consilio",
  // ... other fields
}
```

**Odin PS:**
```javascript
context: {
  project_path: "/home/samuel/sv/odin-s",
  project_name: "odin",
  // ... other fields
}
```

---

## 📋 Quick Reference: Your Project Path

Each PS's CLAUDE.md now shows this at the top:

```
🚨 CRITICAL: Project Paths for Spawning Subagents

WHEN CALLING mcp_meta_spawn_subagent, ALWAYS include:

context: {
  project_path: "/home/samuel/sv/YOUR-PROJECT-s",
  project_name: "YOUR-PROJECT"
}
```

**Find your path in**: `.supervisor-specific/01-project.md` (first section)

---

## ❓ Why Is This Required?

### The MCP Architecture

1. **Wrapper routes to endpoint**: CLI config passes "health-agent" → wrapper routes to `/mcp/health-agent`
2. **Endpoint has ProjectContext**: `/mcp/health-agent` endpoint has context with `path: /home/samuel/sv/health-agent-s`
3. **BUT**: Spawn tool uses **explicit context first**, then falls back to ProjectContext
4. **Fallback behavior**:
   - ✅ Explicit `project_path` in params → USE IT
   - ✅ ProjectContext from endpoint → USE IT
   - ❌ Neither available → FAIL (no more process.cwd() fallback)

### Why Not Rely on ProjectContext Alone?

- **Reliability**: Explicit context works regardless of endpoint configuration
- **Clarity**: Code explicitly states where it's working
- **Debugging**: Logs show exactly which path was used
- **Future-proof**: Works even if MCP routing changes

---

## 🔧 What Changed

### Before (Your Failed Call)
```javascript
mcp_meta_spawn_subagent({
  task_type: "implementation",
  description: "...",
  context: {
    epic_id: "epic-010"  // Missing project_path!
  }
})
```
**Result**: Agent worked in supervisor-service-s ❌

### After (Required Format)
```javascript
mcp_meta_spawn_subagent({
  task_type: "implementation",
  description: "...",
  context: {
    project_path: "/home/samuel/sv/health-agent-s",  // EXPLICIT
    project_name: "health-agent",                     // EXPLICIT
    epic_id: "epic-010"
  }
})
```
**Result**: Agent works in health-agent-s ✅

---

## 🎯 All Spawn Tools Require This

**EVERY tool that spawns subagents needs explicit project_path:**

### mcp_meta_spawn_subagent ✅
```javascript
context: {
  project_path: "/home/samuel/sv/health-agent-s",
  project_name: "health-agent"
}
```

### mcp_meta_bmad_full_workflow ✅
```javascript
{
  projectName: "health-agent",
  projectPath: "/home/samuel/sv/health-agent-s",  // REQUIRED
  featureDescription: "..."
}
```

### mcp_meta_run_piv_per_step ✅
```javascript
{
  projectName: "health-agent",
  projectPath: "/home/samuel/sv/health-agent-s",  // REQUIRED
  epicFile: ".bmad/epics/epic-010.md"
}
```

### mcp_meta_execute_epic_tasks ✅
```javascript
{
  projectName: "health-agent",
  projectPath: "/home/samuel/sv/health-agent-s",  // REQUIRED
  epicFile: ".bmad/epics/epic-010.md"
}
```

---

## 🧪 Verification

**Test that your spawn is working:**

1. Run spawn with explicit project_path
2. Check agent output log: `/tmp/agent-XXXXXXXXX-output.log`
3. Verify files created in YOUR project directory
4. Check `git status` in your project shows changes

**Example test:**
```javascript
mcp_meta_spawn_subagent({
  task_type: "implementation",
  description: "Create a test file named TEST.txt with content 'Hello from health-agent'",
  context: {
    project_path: "/home/samuel/sv/health-agent-s",
    project_name: "health-agent"
  }
})
```

Then verify:
```bash
cd /home/samuel/sv/health-agent-s
ls -la TEST.txt  # Should exist
git status       # Should show TEST.txt
```

---

## 📝 Summary

**DO:**
- ✅ ALWAYS include `project_path` and `project_name` in context
- ✅ Use full absolute path: `/home/samuel/sv/project-s`
- ✅ Copy from your CLAUDE.md (shown at top now)
- ✅ Verify files appear in your project after spawn

**DON'T:**
- ❌ Omit project_path (agents execute in wrong directory)
- ❌ Use relative paths (won't work)
- ❌ Assume ProjectContext routing is enough (need explicit fallback)

---

**Updated**: 2026-01-25 12:15 UTC
**Applies to**: All CLI Project-Supervisors (PSes)
**Status**: MANDATORY - All CLAUDE.md files updated
