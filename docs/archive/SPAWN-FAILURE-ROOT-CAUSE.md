# Spawn System Failure - Root Cause Analysis

**Date**: 2026-01-25
**Analyzer**: Meta-Supervisor (MS)

---

## The Problem

Spawned agents **generated correct tool call syntax** but **did not execute** them. Instead, they output tool calls as text:

```
Edit(file_path="requirements.txt", old_string="...", new_string="...")
Edit(file_path="src/services/image_embedding.py", old_string="...", new_string="...")
Bash(command="pip install -r requirements.txt", description="Install deps")
```

But **no files were created, no code was written, no commands were run.**

---

## Root Cause

### The Architectural Flaw

```
spawn-subagent-tool.ts
  → MultiAgentExecutor.executeWithAgent()
    → GeminiCLIAdapter / ClaudeCLIAdapter
      → External API calls (Gemini API, Claude API)
        → ❌ NO TOOLS AVAILABLE
        → Agents receive instructions as prompts
        → Agents generate tool call syntax
        → BUT tools (Write/Edit/Bash) don't exist in external API environment
        → Result: Tool calls output as text instead of executed
```

### Why This Happened

**External APIs (Gemini, Claude) are text-only environments:**
- ✅ They receive prompts
- ✅ They generate responses
- ❌ They have NO access to:
  - File system
  - Write/Edit/Bash tools
  - Project working directory

**Claude Code agents are different:**
- ✅ Full file system access
- ✅ Write/Edit/Bash tools available
- ✅ Execute in project working directory
- ✅ Tool calls actually execute

---

## Evidence

### Agent Output (`/tmp/agent-1769346648779-hxzi7jdjq-output.log`)

```
Edit(file_path="requirements.txt", old_string="", new_string="""transformers
torch
Pillow
openai
tiktoken""")
```

**This is TEXT OUTPUT, not an executed tool call.**

### Verification

```bash
$ git status
nothing to commit, working tree clean

$ tail -5 requirements.txt
memory-profiler>=0.61.0
psutil>=5.9.0
locust>=2.15.0
# No new dependencies added
```

**Proof: No files were modified, despite agent "calling" Edit tool.**

---

## Why Test Suite Passed

The test suite (`test-spawn-all-projects.sh`) worked because:
- Simple task: "Create test file with timestamp"
- Gemini agent understood this as file creation
- Generated output that looked like success
- Actually created files via stdout redirect (not Write tool)

**But Epic 010 failed because:**
- Complex task: Multi-file CLIP implementation
- Requires Edit tool for existing files
- Edit tool doesn't exist in Gemini API
- Result: Planning output instead of execution

---

## The Fix

### Option 1: Direct Task Tool (RECOMMENDED)

**PSes call Task tool directly** instead of spawn:

```typescript
Task({
  prompt: "Replace OpenAI with CLIP model in image_embedding.py...",
  description: "Implement CLIP embeddings",
  subagent_type: "general-purpose",
  model: "sonnet"
})
```

**Benefits:**
- ✅ Full tool access (Write/Edit/Bash)
- ✅ Simpler (no spawn wrapper needed)
- ✅ Guaranteed execution
- ❌ No Odin routing (manual model selection)

### Option 2: Spawn + Task Tool (CURRENT IMPLEMENTATION)

**Spawn prepares instructions, PS calls Task tool:**

1. PS calls spawn (queries Odin for model)
2. Spawn returns `task_tool_params`
3. PS calls Task tool with those parameters

**Benefits:**
- ✅ Odin routing for optimal service selection
- ✅ Full tool access via Task tool
- ❌ Two-step process (more complex)

---

## What Changed

### Modified Files

1. **`src/mcp/tools/spawn-subagent-tool.ts`**
   - Removed `MultiAgentExecutor.executeWithAgent()` call
   - Now returns `task_tool_params` for Task tool execution
   - No longer calls external APIs directly

2. **`scripts/spawn-cli.mjs`**
   - Displays `task_tool_params` in output
   - Instructs user to call Task tool next

3. **`.supervisor-core/04-tools.md`**
   - Updated instructions to recommend Task tool directly
   - Marked CLI spawn as deprecated/legacy
   - Explains two-step process if spawn is used

---

## Lessons Learned

1. **External APIs ≠ Claude Code agents**
   - External APIs are text-only
   - Claude Code agents have full tool access

2. **Test simple cases first, but also test complex cases**
   - Simple file creation worked
   - Complex multi-file edits failed

3. **Verify actual execution, not just output**
   - Agent output looked correct
   - But git status showed no changes

4. **Direct tool usage is simpler than wrappers**
   - Task tool directly = simpler + more reliable
   - Spawn system = complex + requires two steps

---

## Recommendation

**For PSes: Use Task tool directly** instead of spawn system.

```typescript
// Simple tasks
Task(prompt="...", model="haiku")

// Medium tasks
Task(prompt="...", model="sonnet")

// Complex tasks
Task(prompt="...", model="opus")
```

**Only use spawn if:**
- You need Odin's AI routing logic
- You want automatic cost tracking
- You're willing to do two-step process

---

## Status

✅ **Root cause identified**
✅ **Fix implemented**
✅ **Documentation updated**
✅ **PS instructions updated**

**Next step:** User tests Epic 010 with Task tool directly.
