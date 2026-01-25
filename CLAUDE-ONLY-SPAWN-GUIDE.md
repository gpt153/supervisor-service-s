# Claude-Only Spawn System with Odin Routing

**Updated**: 2026-01-25
**Status**: ✅ Fully Operational

---

## Overview

The spawn system now **restricts all recommendations to Claude models** while keeping Odin AI routing for optimal cost/complexity selection.

### Key Benefits

- ✅ **Odin AI routing** - Automatically selects haiku/sonnet/opus based on task
- ✅ **Claude models only** - Guaranteed Task tool compatibility
- ✅ **Full tool access** - Write/Edit/Bash tools work correctly
- ✅ **Automatic tracking** - Cost and usage logged to database

---

## How It Works

### Architecture

```
1. PS calls spawn
   ↓
2. Spawn queries Odin
   ↓
3. Odin recommends Claude model (haiku/sonnet/opus)
   ↓
4. Spawn prepares instructions file
   ↓
5. Spawn returns task_tool_params
   ↓
6. PS reads instructions file
   ↓
7. PS calls Task tool with model
   ↓
8. Task tool spawns Claude Code agent
   ↓
9. Agent executes with full tool access
```

### Model Selection (by Odin)

**Simple tasks** → `claude-3-5-haiku-20241022`
- Testing, validation, simple queries
- Cost: ~$0.0010
- Fast execution

**Medium tasks** → `claude-sonnet-4-5-20250929`
- Implementation, refactoring, moderate complexity
- Cost: ~$0.0030
- Balanced reasoning

**Complex tasks** → `claude-opus-4-5-20251101`
- Architecture design, planning, deep analysis
- Cost: ~$0.0150
- Advanced reasoning

---

## Usage Guide

### Step 1: Call Spawn

```bash
Bash: /home/samuel/sv/supervisor-service-s/scripts/spawn <task_type> "<description>"
```

**Example:**
```bash
Bash: /home/samuel/sv/supervisor-service-s/scripts/spawn implementation "Replace OpenAI with CLIP model in image_embedding.py"
```

**Spawn output:**
```
✅ Spawn completed:
   Agent ID: agent-1769347574565-bxf5ebbai
   Service: claude
   Model: claude-sonnet-4-5-20250929

📋 Task Tool Parameters:
   Model: sonnet
   Max turns: 15
   Instructions: /tmp/agent-1769347574565-bxf5ebbai-instructions.md
   Project path: /home/samuel/sv/health-agent-s
```

### Step 2: Read Instructions

```
Read(/tmp/agent-1769347574565-bxf5ebbai-instructions.md)
```

This shows the complete task instructions prepared by spawn.

### Step 3: Call Task Tool

```
Task(
  prompt="<paste instructions from file>",
  description="Implement CLIP embeddings",
  subagent_type="general-purpose",
  model="sonnet"
)
```

**Model parameter values:**
- `"haiku"` - Simple tasks
- `"sonnet"` - Medium tasks (most common)
- `"opus"` - Complex tasks

---

## Full Example: Epic 010 CLIP Implementation

### Step 1: Spawn

```bash
Bash: /home/samuel/sv/supervisor-service-s/scripts/spawn implementation "Epic 010 Task 3: Replace text-embedding-3-small with CLIP model. Install sentence-transformers, update EmbeddingModel.generate() to use CLIP (clip-ViT-B-32), ensure 512-dimensional vectors."
```

**Output:**
```
✅ Spawn completed:
   Model: sonnet
   Instructions: /tmp/agent-1769347890123-abc123xyz-instructions.md
   Max turns: 15
```

### Step 2: Read Instructions

```
Read(/tmp/agent-1769347890123-abc123xyz-instructions.md)
```

### Step 3: Execute with Task Tool

```
Task(
  prompt="<instructions from file>",
  description="Implement CLIP for Epic 010",
  subagent_type="general-purpose",
  model="sonnet"
)
```

### Result

Agent executes with full tool access:
- ✅ Installs `sentence-transformers` via Bash
- ✅ Edits `requirements.txt` via Edit tool
- ✅ Edits `image_embedding.py` via Edit tool
- ✅ Runs tests via Bash
- ✅ Commits changes via Bash

---

## Task Types

| Task Type | Description | Typical Model |
|-----------|-------------|---------------|
| `implementation` | Write code, implement features | sonnet |
| `research` | Analyze codebase, understand architecture | opus |
| `testing` | Write tests, run validations | haiku |
| `validation` | Verify acceptance criteria | haiku |
| `planning` | Create implementation plans | opus |
| `documentation` | Write docs, README | haiku |
| `deployment` | Deploy services, configure infra | sonnet |

---

## Alternative: Skip Spawn (Manual Model Selection)

If you know which model you want, skip spawn entirely:

```
Task(
  prompt="Replace OpenAI with CLIP model...",
  description="Implement CLIP embeddings",
  subagent_type="general-purpose",
  model="sonnet"
)
```

**When to skip spawn:**
- You know the right model for the task
- You want one-step execution
- You don't need Odin's cost optimization

**When to use spawn:**
- You want automatic model selection
- You want cost tracking in database
- You're unsure which model is optimal

---

## Troubleshooting

### Issue: "Odin Query Failed"

**Symptom:**
```
[Odin Query] Failed, using Claude-only fallback heuristics
```

**Cause:** Odin database psycopg2 async error (known issue)

**Solution:** Not a problem! Fallback heuristics automatically select Claude model based on task type and complexity.

### Issue: Agent Generates Plans Instead of Code

**Symptom:** Agent outputs "here's what to do" instead of executing

**Cause:** Using spawn without calling Task tool

**Solution:** Always complete Step 3 (call Task tool) after spawn

### Issue: Files Not Modified

**Symptom:** Agent completes but `git status` shows no changes

**Cause:** Skipped Task tool, agent ran in text-only API

**Solution:** Use Task tool (not external API) for execution

---

## Commits

- `85c1c72` - feat: restrict spawn to Claude models only with Odin routing
- `a2e32f8` - fix: identify spawn system root cause - external APIs lack tools

---

## Next Steps

**For PSes:**
1. Use spawn + Task tool workflow for all implementation tasks
2. Odin handles model selection automatically
3. Task tool guarantees full tool access
4. Verify changes with `git status` after execution

**For Users:**
- Epic 010 can now continue with working spawn system
- All PSes updated with new instructions
- Spawn system tracks cost and usage automatically
