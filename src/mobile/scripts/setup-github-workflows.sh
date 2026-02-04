#!/bin/bash
# Setup GitHub Actions workflows for a mobile project
# Usage: ./setup-github-workflows.sh <project-path>

set -euo pipefail

PROJECT_PATH="${1:?Usage: $0 <project-path>}"
TEMPLATE_DIR="/home/samuel/sv/supervisor-service-s/src/mobile/templates/github-workflows"

echo "=== Setting up GitHub Actions workflows ==="
echo "Project: $PROJECT_PATH"

# Create .github/workflows directory
mkdir -p "$PROJECT_PATH/.github/workflows"

# Copy Android CI workflow
cp "$TEMPLATE_DIR/android-ci.yml" "$PROJECT_PATH/.github/workflows/android-ci.yml"
echo "Copied: android-ci.yml"

# Copy iOS CI workflow (if template exists)
if [ -f "$TEMPLATE_DIR/ios-ci.yml" ]; then
  cp "$TEMPLATE_DIR/ios-ci.yml" "$PROJECT_PATH/.github/workflows/ios-ci.yml"
  echo "Copied: ios-ci.yml"
fi

# Verify
if [ -f "$PROJECT_PATH/.github/workflows/android-ci.yml" ]; then
  echo "=== GitHub Actions setup complete ==="
  echo "Workflows installed:"
  ls -la "$PROJECT_PATH/.github/workflows/"
else
  echo "ERROR: Workflow file not created"
  exit 1
fi
