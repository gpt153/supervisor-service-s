#!/bin/bash

# Test script to verify tmux prompt submission works correctly
# This script creates a test tmux session and sends a test prompt

set -e

PROJECT="test-prompt-fix"
SESSION="${PROJECT}-ps"

echo "🧪 Testing tmux prompt submission fix"
echo ""

# Step 1: Create test tmux session if it doesn't exist
echo "1. Creating test tmux session: ${SESSION}"
if tmux has-session -t "${SESSION}" 2>/dev/null; then
    echo "   Session already exists, killing it first..."
    tmux kill-session -t "${SESSION}"
fi
tmux new-session -d -s "${SESSION}" "bash"
echo "   ✅ Session created"
echo ""

# Step 2: Wait for session to be ready
echo "2. Waiting for session to be ready..."
sleep 1
echo "   ✅ Session ready"
echo ""

# Step 3: Send test prompt using the OLD method (with Enter)
echo "3. Testing OLD method (with Enter)..."
tmux send-keys -t "${SESSION}" "echo 'OLD METHOD TEST'" Enter
sleep 0.5
OLD_OUTPUT=$(tmux capture-pane -t "${SESSION}" -p | grep "OLD METHOD TEST" || echo "")
if [ -n "$OLD_OUTPUT" ]; then
    echo "   ✅ OLD method works: prompt submitted"
else
    echo "   ❌ OLD method failed: prompt not submitted"
fi
echo ""

# Step 4: Send test prompt using the NEW method (with C-m and delay)
echo "4. Testing NEW method (with C-m and delay)..."
tmux send-keys -t "${SESSION}" "echo 'NEW METHOD TEST'" && sleep 0.2 && tmux send-keys -t "${SESSION}" C-m
sleep 0.5
NEW_OUTPUT=$(tmux capture-pane -t "${SESSION}" -p | grep "NEW METHOD TEST" || echo "")
if [ -n "$NEW_OUTPUT" ]; then
    echo "   ✅ NEW method works: prompt submitted"
else
    echo "   ❌ NEW method failed: prompt not submitted"
fi
echo ""

# Step 5: Test with a more complex prompt (like health monitor would send)
echo "5. Testing complex health check prompt..."
PROMPT="Report your current context window usage from system warnings"
ESCAPED_PROMPT=$(echo "$PROMPT" | sed 's/"/\\"/g')
tmux send-keys -t "${SESSION}" "echo \"${ESCAPED_PROMPT}\"" && sleep 0.2 && tmux send-keys -t "${SESSION}" C-m
sleep 0.5
COMPLEX_OUTPUT=$(tmux capture-pane -t "${SESSION}" -p | grep "context window usage" || echo "")
if [ -n "$COMPLEX_OUTPUT" ]; then
    echo "   ✅ Complex prompt works: prompt submitted"
else
    echo "   ❌ Complex prompt failed: prompt not submitted"
fi
echo ""

# Step 6: Show session output
echo "6. Session output (last 10 lines):"
echo "---"
tmux capture-pane -t "${SESSION}" -p | tail -10
echo "---"
echo ""

# Step 7: Cleanup
echo "7. Cleaning up test session..."
tmux kill-session -t "${SESSION}"
echo "   ✅ Session killed"
echo ""

echo "🎉 Test complete!"
