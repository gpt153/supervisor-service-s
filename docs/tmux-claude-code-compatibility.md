# tmux and Claude Code Compatibility

**Last Updated**: 2026-01-22

---

## Issue

When using `tmux send-keys` with `Enter` to submit prompts in Claude Code terminal sessions, text appears in the input field but is **not submitted**.

## Root Cause

Claude Code's terminal emulation handles the `Enter` key differently than standard terminals. The literal string "Enter" may not trigger submission in all cases.

## Solution

Use **`C-m`** (Control-m, ASCII carriage return) with a brief delay instead of `Enter`:

```bash
# ❌ OLD (doesn't work reliably in Claude Code)
tmux send-keys -t "session-name" "prompt text" Enter

# ✅ NEW (works in Claude Code and standard terminals)
tmux send-keys -t "session-name" "prompt text" && sleep 0.2 && tmux send-keys -t "session-name" C-m
```

## Why This Works

1. **`C-m` is the ASCII carriage return**: More reliable across terminal emulators
2. **200ms delay**: Allows text to render before submission
3. **`&&` chaining**: Ensures sequential execution
4. **Backward compatible**: Works in standard terminals as well

## Implementation Pattern

### For Simple Prompts

```bash
SESSION="project-ps"
PROMPT="Your prompt text here"

# Send prompt with submission
tmux send-keys -t "${SESSION}" "${PROMPT}" && sleep 0.2 && tmux send-keys -t "${SESSION}" C-m
```

### For Prompts with Special Characters

```bash
SESSION="project-ps"
PROMPT='Text with "quotes" and $special chars'

# Escape double quotes
ESCAPED=$(echo "$PROMPT" | sed 's/"/\\"/g')

# Send with proper quoting
tmux send-keys -t "${SESSION}" "${ESCAPED}" && sleep 0.2 && tmux send-keys -t "${SESSION}" C-m
```

### In TypeScript/JavaScript

```typescript
function getTmuxCommand(sessionName: string, prompt: string): string {
  // Escape double quotes and backslashes
  const escaped = prompt
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');

  // Return command with C-m and delay
  return `tmux send-keys -t "${sessionName}" "${escaped}" && sleep 0.2 && tmux send-keys -t "${sessionName}" C-m`;
}
```

## Testing

### Test Script

Created `scripts/test-tmux-prompt.sh` to verify the fix works:

```bash
# Run the test
./scripts/test-tmux-prompt.sh
```

This creates a test session, sends prompts using both OLD and NEW methods, and verifies submission.

### Manual Testing

To test with a real session (e.g., odin-ps):

```bash
# Send a test prompt
tmux send-keys -t "odin-ps" "echo 'Test prompt'" && sleep 0.2 && tmux send-keys -t "odin-ps" C-m

# Check if it was submitted (should see output in session)
tmux capture-pane -t "odin-ps" -p | tail -5
```

## Files Affected

When implementing tmux prompt submission, ensure all these patterns are updated:

- ✅ `src/monitoring/prompt-generator.ts` - `getTmuxCommand()`
- ✅ `src/monitoring/ps-health-monitor.ts` - `clearContext()`, `resumeFromHandoff()`
- ✅ Any other files that use `tmux send-keys` for prompt submission

## Alternative Solutions Considered

| Solution | Result |
|----------|--------|
| Multiple `Enter` commands | ❌ Didn't help - still not submitted |
| Longer delay before Enter | ❌ Didn't solve the issue |
| Using `KPEnter` (keypad Enter) | ❌ Same problem |
| Using `C-m` with delay | ✅ **Works reliably** |

## References

- **Issue**: Health monitor prompts not submitting in Claude Code
- **Fix Commit**: bd4c0bb - "fix: use C-m for tmux prompt submission in Claude Code"
- **Implementation Report**: `.bmad/reports/health-monitor-tmux-fix-implementation-report.md`
- **Test Script**: `scripts/test-tmux-prompt.sh`

---

**Recommendation**: Always use the C-m pattern for tmux prompt submission to ensure compatibility with both Claude Code and standard terminals.
