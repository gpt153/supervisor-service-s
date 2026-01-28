#!/bin/bash
# Simple spawn wrapper for CLI-only usage
# Auto-detects project from pwd, calls Odin router, spawns agent
#
# Usage:
#   spawn.sh implementation "Add feature X to Y"
#   spawn.sh research "Investigate how Z works"
#   spawn.sh testing "Write tests for component W"

set -e

TASK_TYPE="${1:-implementation}"
DESCRIPTION="${2:-}"

if [ -z "$DESCRIPTION" ]; then
  echo "Error: Description required"
  echo "Usage: spawn.sh <task_type> <description>"
  exit 1
fi

# Auto-detect project from pwd
PROJECT_PATH="$(pwd)"
PROJECT_NAME="$(basename "$PROJECT_PATH")"

# Remove -s suffix if present
PROJECT_NAME="${PROJECT_NAME%-s}"

echo "🚀 Spawning subagent..."
echo "   Project: $PROJECT_NAME"
echo "   Path: $PROJECT_PATH"
echo "   Task: $TASK_TYPE"
echo "   Description: $DESCRIPTION"
echo ""

# Call spawn directly via node
cd /home/samuel/sv/supervisor-service-s

node --loader tsx --no-warnings <<EOF
import { spawnSubagentTool } from './src/mcp/tools/spawn-subagent-tool.js';

const result = await spawnSubagentTool.handler(
  {
    task_type: '$TASK_TYPE',
    description: \`$DESCRIPTION\`,
    context: {
      project_path: '$PROJECT_PATH',
      project_name: '$PROJECT_NAME'
    }
  },
  {
    project: {
      name: '$PROJECT_NAME',
      path: '$PROJECT_PATH'
    },
    workingDirectory: '$PROJECT_PATH'
  }
);

console.log(JSON.stringify(result, null, 2));
EOF
