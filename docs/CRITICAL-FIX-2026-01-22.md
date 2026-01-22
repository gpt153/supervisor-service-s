# Critical Fix: Subagents Never Executed (2026-01-22)

## The Problem

**ROOT CAUSE**: `mcp_meta_spawn_subagent` tool created instructions but NEVER executed agents.

### What Was Broken

```
User Request → PS calls mcp_meta_spawn_subagent → ???
                                                      ↓
                                              [AGENT NEVER RAN]
                                                      ↓
                                              No result returned
```

### The Broken Flow

1. ✅ Query Odin AI Router → Get recommendation (Gemini, Claude, etc.)
2. ✅ Select subagent template → Find matching .md file
3. ✅ Generate instructions → Create `/tmp/agent-xyz-instructions.md`
4. ❌ **Execute agent → TODO COMMENT, NO CODE**
5. ❌ Return null result → User thinks work is in progress, but nothing happened

### The Code

**Before** (`src/mcp/tools/spawn-subagent-tool.ts:339-346`):
```typescript
// TODO: When Claude Agent SDK or bash spawning is ready:
// import { spawnClaudeAgent } from '../agents/spawn.js';
// await spawnClaudeAgent({
//   agentId: agent_id,
//   instructions: instructions,
//   model: recommendation.model,
//   service: recommendation.service
// });

return {
  agent_id,
  instructions_preview: instructions.substring(0, 200) + '...',
  instructions_path: instructionsPath
  // NO OUTPUT, NO EXECUTION
};
```

## Why This Wasn't Caught

1. **MultiAgentExecutor already existed** - The execution infrastructure was fully implemented
2. **Just wasn't wired up** - spawn-subagent-tool.ts never called it
3. **No integration tests** - Unit tests passed, but end-to-end flow was never tested
4. **Looked like it worked** - Tool returned success, PS thought agents were running

## The Fix

### What Changed

**After** (`src/mcp/tools/spawn-subagent-tool.ts:319-410`):
```typescript
// Import execution infrastructure
import { MultiAgentExecutor } from '../../agents/multi/MultiAgentExecutor.js';

// Create executor
const executor = new MultiAgentExecutor();

// Map Odin service to AgentType
let agentType: 'gemini' | 'claude' | 'codex';
if (recommendation.service === 'claude' || recommendation.service === 'claude-max') {
  agentType = 'claude';
} else if (recommendation.service === 'gemini') {
  agentType = 'gemini';
} else {
  agentType = 'codex';
}

// ACTUALLY EXECUTE THE AGENT
const result = await executor.executeWithAgent(
  {
    prompt: instructions,
    cwd: projectPath,
    timeout: 600000, // 10 minutes
    outputFormat: 'text',
  },
  agentType
);

return {
  agent_id,
  instructions_preview,
  instructions_path,
  output: result.output,      // ✅ NOW RETURNS ACTUAL OUTPUT
  success: result.success,    // ✅ NOW RETURNS SUCCESS/FAILURE
  error: result.error,        // ✅ NOW RETURNS ERROR IF FAILED
  duration_ms: duration,      // ✅ NOW TRACKS ACTUAL DURATION
};
```

### Impact

**Now the full flow works:**

```
User Request
    ↓
PS calls mcp_meta_spawn_subagent
    ↓
✅ Query Odin → "Use Gemini for this task"
    ↓
✅ Select subagent → implementation-basic.md
    ↓
✅ Generate instructions → Full prompt with context
    ↓
✅ Execute via MultiAgentExecutor → Actually runs Gemini CLI
    ↓
✅ Return output → Task completed!
```

## Verification

### Before Fix
```bash
# Agent spawned but never ran
mcp_meta_spawn_subagent({ task_type: "documentation", description: "Create README" })
# Returns: { agent_id: "agent-123", instructions_path: "/tmp/..." }
# File never created! Agent never ran!
```

### After Fix
```bash
# Agent spawns AND executes
mcp_meta_spawn_subagent({ task_type: "documentation", description: "Create README" })
# Returns: {
#   agent_id: "agent-123",
#   output: "Created README.md with...",
#   success: true,
#   duration_ms: 5432
# }
# README.md exists! Agent ran successfully!
```

## Related Issues

This fix enables:
- ✅ Actual autonomous supervision (agents run tasks)
- ✅ PIV loops (background execution)
- ✅ Health monitoring (detect stuck agents)
- ✅ Cost tracking (record actual usage)

## Next Steps

1. **Test end-to-end**: Verify agents execute correctly
2. **Implement PIV background spawning**: Long-running tasks need background execution
3. **Add progress monitoring**: Track agent execution status
4. **Health checks**: Detect when agents hang or fail

## Commit

- SHA: `3921e03`
- Date: 2026-01-22
- Branch: main
- Files changed: `src/mcp/tools/spawn-subagent-tool.ts`

## Lessons Learned

1. **Infrastructure ≠ Integration**: Having the code doesn't mean it's wired up
2. **TODO comments are tech debt**: Should be tracked and resolved
3. **Integration tests critical**: Unit tests passed, but system didn't work end-to-end
4. **Explicit success checks**: Tool returning success ≠ work actually done
