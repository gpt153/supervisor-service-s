#!/bin/bash
# PIV Loop Installation Verification Script
# Checks that all PIV components are properly installed

set -e

echo "=== PIV Loop Installation Verification ==="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_file() {
  if [ -f "$1" ]; then
    echo -e "${GREEN}✓${NC} $1"
    return 0
  else
    echo -e "${RED}✗${NC} $1 (MISSING)"
    return 1
  fi
}

check_dir() {
  if [ -d "$1" ]; then
    echo -e "${GREEN}✓${NC} $1/"
    return 0
  else
    echo -e "${RED}✗${NC} $1/ (MISSING)"
    return 1
  fi
}

ERRORS=0

echo "Checking directory structure..."
check_dir "src/agents" || ((ERRORS++))
check_dir "src/agents/phases" || ((ERRORS++))
check_dir "src/types" || ((ERRORS++))
check_dir "src/utils" || ((ERRORS++))
check_dir "src/examples" || ((ERRORS++))
echo ""

echo "Checking core files..."
check_file "src/agents/PIVAgent.ts" || ((ERRORS++))
check_file "src/agents/index.ts" || ((ERRORS++))
check_file "src/agents/phases/PrimePhase.ts" || ((ERRORS++))
check_file "src/agents/phases/PlanPhase.ts" || ((ERRORS++))
check_file "src/agents/phases/ExecutePhase.ts" || ((ERRORS++))
echo ""

echo "Checking type definitions..."
check_file "src/types/piv.ts" || ((ERRORS++))
echo ""

echo "Checking utilities..."
check_file "src/utils/codebase-analyzer.ts" || ((ERRORS++))
check_file "src/utils/storage.ts" || ((ERRORS++))
echo ""

echo "Checking examples..."
check_file "src/examples/piv-example.ts" || ((ERRORS++))
echo ""

echo "Checking documentation..."
check_file "PIV-README.md" || ((ERRORS++))
check_file "QUICKSTART-PIV.md" || ((ERRORS++))
check_file "IMPLEMENTATION-SUMMARY.md" || ((ERRORS++))
echo ""

echo "Checking build..."
if npm run build > /dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} TypeScript compilation succeeds"
else
  echo -e "${RED}✗${NC} TypeScript compilation failed"
  ((ERRORS++))
fi
echo ""

echo "Checking compiled output..."
if [ -d "dist" ]; then
  echo -e "${GREEN}✓${NC} dist/ directory exists"

  # Check key compiled files
  if [ -f "dist/agents/PIVAgent.js" ]; then
    echo -e "${GREEN}✓${NC} dist/agents/PIVAgent.js"
  else
    echo -e "${RED}✗${NC} dist/agents/PIVAgent.js (MISSING)"
    ((ERRORS++))
  fi
else
  echo -e "${RED}✗${NC} dist/ directory missing (run npm run build)"
  ((ERRORS++))
fi
echo ""

# Summary
echo "=== Summary ==="
if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}All checks passed! ✓${NC}"
  echo ""
  echo "PIV Loop is properly installed and ready to use."
  echo ""
  echo "Next steps:"
  echo "  1. Read QUICKSTART-PIV.md for usage examples"
  echo "  2. Run: tsx src/examples/piv-example.ts dark-mode"
  echo "  3. Check PIV-README.md for full documentation"
  exit 0
else
  echo -e "${RED}$ERRORS error(s) found ✗${NC}"
  echo ""
  echo "Please fix the errors above before using PIV Loop."
  exit 1
fi
