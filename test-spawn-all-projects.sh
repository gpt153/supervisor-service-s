#!/bin/bash
# Comprehensive spawn test for ALL projects
# Tests that spawn works from every PS and MS

set -e

SPAWN_CMD="/home/samuel/sv/supervisor-service-s/scripts/spawn"
TEST_FILE="SPAWN_TEST_$(date +%s).txt"
RESULTS_FILE="/tmp/spawn-test-results-$(date +%s).log"

echo "======================================================================"
echo "COMPREHENSIVE SPAWN SYSTEM TEST"
echo "======================================================================"
echo ""
echo "Testing spawn from ALL projects to verify:"
echo "1. Spawn command works from each project directory"
echo "2. Files are created in CORRECT project directory"
echo "3. Files are NOT created in supervisor-service-s"
echo "4. Git status shows files in correct repo"
echo ""
echo "Results will be logged to: $RESULTS_FILE"
echo ""

# Track results
declare -A RESULTS
TOTAL=0
PASSED=0
FAILED=0

# Test function
test_spawn_from_project() {
  local PROJECT_NAME=$1
  local PROJECT_PATH=$2

  echo "======================================================================" | tee -a "$RESULTS_FILE"
  echo "TEST: Spawn from $PROJECT_NAME" | tee -a "$RESULTS_FILE"
  echo "======================================================================" | tee -a "$RESULTS_FILE"
  echo "Project path: $PROJECT_PATH" | tee -a "$RESULTS_FILE"
  echo "" | tee -a "$RESULTS_FILE"

  TOTAL=$((TOTAL + 1))

  # Change to project directory
  cd "$PROJECT_PATH" || {
    echo "❌ FAIL: Cannot cd to $PROJECT_PATH" | tee -a "$RESULTS_FILE"
    RESULTS[$PROJECT_NAME]="FAIL: Cannot cd"
    FAILED=$((FAILED + 1))
    return 1
  }

  # Clean up any existing test files
  rm -f "$TEST_FILE" 2>/dev/null || true

  # Run spawn
  echo "→ Running spawn implementation..." | tee -a "$RESULTS_FILE"
  "$SPAWN_CMD" implementation "Create a file named '$TEST_FILE' in the current directory with content 'Test from $PROJECT_NAME at $(date)'. Use the Write tool to create this file." 2>&1 | tee -a "$RESULTS_FILE"

  local SPAWN_EXIT=$?

  if [ $SPAWN_EXIT -ne 0 ]; then
    echo "❌ FAIL: Spawn command failed with exit code $SPAWN_EXIT" | tee -a "$RESULTS_FILE"
    RESULTS[$PROJECT_NAME]="FAIL: Spawn exit $SPAWN_EXIT"
    FAILED=$((FAILED + 1))
    return 1
  fi

  # Wait a moment for file system
  sleep 2

  # Check if file was created in correct location
  if [ -f "$PROJECT_PATH/$TEST_FILE" ]; then
    echo "✅ File created in CORRECT location: $PROJECT_PATH/$TEST_FILE" | tee -a "$RESULTS_FILE"
  else
    echo "❌ FAIL: File NOT found in $PROJECT_PATH/$TEST_FILE" | tee -a "$RESULTS_FILE"
    RESULTS[$PROJECT_NAME]="FAIL: File not created"
    FAILED=$((FAILED + 1))
    return 1
  fi

  # Check that file was NOT created in supervisor-service-s
  if [ -f "/home/samuel/sv/supervisor-service-s/$TEST_FILE" ]; then
    echo "❌ FAIL: File INCORRECTLY created in supervisor-service-s" | tee -a "$RESULTS_FILE"
    RESULTS[$PROJECT_NAME]="FAIL: File in wrong directory"
    FAILED=$((FAILED + 1))
    return 1
  else
    echo "✅ File correctly NOT in supervisor-service-s" | tee -a "$RESULTS_FILE"
  fi

  # Check git status
  if git rev-parse --git-dir > /dev/null 2>&1; then
    local GIT_STATUS=$(git status --short 2>/dev/null | grep "$TEST_FILE" || echo "")
    if [ -n "$GIT_STATUS" ]; then
      echo "✅ Git status shows file in $PROJECT_NAME: $GIT_STATUS" | tee -a "$RESULTS_FILE"
    else
      echo "⚠️  Git status doesn't show file (may be in .gitignore)" | tee -a "$RESULTS_FILE"
    fi
  fi

  # Clean up test file
  rm -f "$TEST_FILE"

  echo "" | tee -a "$RESULTS_FILE"
  echo "✅ PASS: $PROJECT_NAME" | tee -a "$RESULTS_FILE"
  RESULTS[$PROJECT_NAME]="PASS"
  PASSED=$((PASSED + 1))
  return 0
}

# Test all projects
echo "Starting tests..." | tee "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

test_spawn_from_project "health-agent-s" "/home/samuel/sv/health-agent-s"
test_spawn_from_project "consilio-s" "/home/samuel/sv/consilio-s"
test_spawn_from_project "odin-s" "/home/samuel/sv/odin-s"
test_spawn_from_project "openhorizon-s" "/home/samuel/sv/openhorizon-s"
test_spawn_from_project "supervisor-service-s (MS)" "/home/samuel/sv/supervisor-service-s"

# Print summary
echo "" | tee -a "$RESULTS_FILE"
echo "======================================================================" | tee -a "$RESULTS_FILE"
echo "TEST SUMMARY" | tee -a "$RESULTS_FILE"
echo "======================================================================" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

for PROJECT in "${!RESULTS[@]}"; do
  echo "$PROJECT: ${RESULTS[$PROJECT]}" | tee -a "$RESULTS_FILE"
done

echo "" | tee -a "$RESULTS_FILE"
echo "Total: $TOTAL" | tee -a "$RESULTS_FILE"
echo "Passed: $PASSED" | tee -a "$RESULTS_FILE"
echo "Failed: $FAILED" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

if [ $FAILED -eq 0 ]; then
  echo "✅ ALL TESTS PASSED" | tee -a "$RESULTS_FILE"
  echo "" | tee -a "$RESULTS_FILE"
  echo "Results saved to: $RESULTS_FILE" | tee -a "$RESULTS_FILE"
  exit 0
else
  echo "❌ SOME TESTS FAILED" | tee -a "$RESULTS_FILE"
  echo "" | tee -a "$RESULTS_FILE"
  echo "Results saved to: $RESULTS_FILE" | tee -a "$RESULTS_FILE"
  exit 1
fi
