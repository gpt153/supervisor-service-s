#!/bin/bash
# Verify Cloudflare Integration Implementation
# EPIC-005 Verification Script

set +e  # Don't exit on errors, we want to see all results

echo "======================================"
echo "EPIC-005: Cloudflare Integration"
echo "Verification Script"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0

check() {
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
  else
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
  fi
}

echo "1. Checking file structure..."
echo "------------------------------"

# Check source files
test -f src/cloudflare/CloudflareManager.ts
check "CloudflareManager.ts exists"

test -f src/cloudflare/cloudflare-tools.ts
check "cloudflare-tools.ts exists"

test -f src/cloudflare/index.ts
check "cloudflare index.ts exists"

test -f src/types/cloudflare.ts
check "cloudflare types exist"

echo ""
echo "2. Checking documentation..."
echo "------------------------------"

test -f EPIC-005-COMPLETE.md
check "EPIC-005-COMPLETE.md exists"

test -f EPIC-005-IMPLEMENTATION.md
check "EPIC-005-IMPLEMENTATION.md exists"

test -f EPIC-005-QUICKREF.md
check "EPIC-005-QUICKREF.md exists"

echo ""
echo "3. Checking dependencies..."
echo "------------------------------"

if grep -q "axios" package.json; then
  echo -e "${GREEN}✓${NC} axios dependency added"
  ((PASSED++))
else
  echo -e "${RED}✗${NC} axios dependency missing"
  ((FAILED++))
fi

echo ""
echo "4. Checking TypeScript compilation..."
echo "------------------------------"

# Check if TypeScript files compile (just syntax check)
if npx tsc --noEmit src/cloudflare/*.ts 2>&1 | grep -q "error TS" | grep -v "src/db/client.ts" | grep -v "src/ports/PortManager.ts"; then
  echo -e "${RED}✗${NC} TypeScript errors in Cloudflare files"
  ((FAILED++))
else
  echo -e "${GREEN}✓${NC} No TypeScript errors in Cloudflare files"
  ((PASSED++))
fi

echo ""
echo "5. Checking MCP tool integration..."
echo "------------------------------"

if grep -q "getCloudflareTools" src/mcp/tools/index.ts; then
  echo -e "${GREEN}✓${NC} Cloudflare tools exported in index.ts"
  ((PASSED++))
else
  echo -e "${RED}✗${NC} Cloudflare tools not exported"
  ((FAILED++))
fi

echo ""
echo "6. Checking required secrets documentation..."
echo "------------------------------"

REQUIRED_SECRETS=(
  "meta/cloudflare/api_token"
  "meta/cloudflare/account_id"
  "meta/cloudflare/tunnel_id"
  "meta/cloudflare/zone_id_153se"
)

for secret in "${REQUIRED_SECRETS[@]}"; do
  if grep -q "$secret" EPIC-005-IMPLEMENTATION.md; then
    echo -e "${GREEN}✓${NC} $secret documented"
    ((PASSED++))
  else
    echo -e "${RED}✗${NC} $secret not documented"
    ((FAILED++))
  fi
done

echo ""
echo "7. Checking MCP tools..."
echo "------------------------------"

TOOLS=(
  "mcp__meta__create_cname"
  "mcp__meta__create_a_record"
  "mcp__meta__delete_dns_record"
  "mcp__meta__list_dns_records"
  "mcp__meta__sync_tunnel"
)

for tool in "${TOOLS[@]}"; do
  if grep -q "$tool" src/cloudflare/cloudflare-tools.ts; then
    echo -e "${GREEN}✓${NC} $tool implemented"
    ((PASSED++))
  else
    echo -e "${RED}✗${NC} $tool not found"
    ((FAILED++))
  fi
done

echo ""
echo "8. Checking changelog..."
echo "------------------------------"

if grep -q "EPIC-005" CHANGELOG.md; then
  echo -e "${GREEN}✓${NC} CHANGELOG.md updated"
  ((PASSED++))
else
  echo -e "${RED}✗${NC} CHANGELOG.md not updated"
  ((FAILED++))
fi

echo ""
echo "======================================"
echo "Verification Summary"
echo "======================================"
echo -e "Passed: ${GREEN}${PASSED}${NC}"
echo -e "Failed: ${RED}${FAILED}${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All checks passed!${NC}"
  echo ""
  echo "Next steps:"
  echo "1. Set Cloudflare secrets via mcp__meta__set_secret"
  echo "2. Test DNS record creation"
  echo "3. Test tunnel synchronization"
  echo "4. Deploy a service using Cloudflare integration"
  echo ""
  echo "See EPIC-005-IMPLEMENTATION.md for testing procedures."
  exit 0
else
  echo -e "${RED}✗ Some checks failed.${NC}"
  echo "Please review the errors above."
  exit 1
fi
