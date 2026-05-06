#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# Production Smoke Test — scripts/smoke-test-prod.sh
#
# Walks the full happy path against the live production cluster:
#
#   Phase 1 — Health      (/health, /api/health/status)
#   Phase 2 — Auth        (register, login, profile, logout)
#   Phase 3 — Products    (list, single)
#   Phase 4 — Cart        (add item, view, update qty)
#   Phase 5 — Orders      (place, list, single)
#   Phase 6 — Cleanup     (logout + confirm token revoked)
#
# Usage:
#   ./scripts/smoke-test-prod.sh
#   ./scripts/smoke-test-prod.sh dmandevv.shop
# ─────────────────────────────────────────────────────────

DOMAIN="${1:-dmandevv.shop}"
BASE_URL="https://${DOMAIN}"

COOKIE_JAR="/tmp/smoke-cookies-$$.txt"
RESPONSE_FILE="/tmp/smoke-response-$$.json"

CSRF="smoke-test"

# ─── ANSI colours ───────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ─── Counters ───────────────────────────────────────────
PASS=0
FAIL=0
SKIP=0

PRODUCT_ID=""

cleanup() { rm -f "$COOKIE_JAR" "$RESPONSE_FILE"; }
trap cleanup EXIT

{
  echo "# Netscape HTTP Cookie File"
  printf '%s\tFALSE\t/\tTRUE\t%d\tcsrfToken\t%s\n' \
    "$DOMAIN" "$(( $(date +%s) + 86400 ))" "$CSRF"
} > "$COOKIE_JAR"

phase() {
  echo ""
  echo -e "${BLUE}━━━ Phase $1: $2 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

run_curl() {
  STATUS=$(curl -s -w "%{http_code}" -o "$RESPONSE_FILE" "$@")
  BODY=$(cat "$RESPONSE_FILE" 2>/dev/null || echo "")
}

check() {
  local label="$1" expected="$2"
  if [[ "$STATUS" == "$expected" ]]; then
    echo -e "  ${GREEN}✓${NC} $label  (HTTP $STATUS)"
    ((PASS++))
  else
    echo -e "  ${RED}✗${NC} $label  — expected HTTP $expected, got HTTP $STATUS"
    echo -e "    ${YELLOW}↳${NC} $(echo "$BODY" | head -c 300)"
    ((FAIL++))
  fi
}

info() { echo -e "    ${YELLOW}↳${NC} $1"; }

refresh_csrf() {
  local token
  token=$(grep 'csrfToken' "$COOKIE_JAR" 2>/dev/null | awk '{print $NF}' || true)
  [[ -n "$token" ]] && CSRF="$token"
}

mut_curl() {
  run_curl \
    -H "X-CSRF-Token: $CSRF" \
    "$@"
}

# ═════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}▶  Smoke-testing ${BASE_URL}${NC}"
echo -e "${CYAN}   $(date '+%Y-%m-%d %H:%M:%S')${NC}"

# ═════════════════════════════════════════════════════════
# Phase 1 — Health
# ═════════════════════════════════════════════════════════
phase 1 "Health"

run_curl "$BASE_URL/api/health/status"
check "GET /api/health/status  (all services)" "200"
info "$(echo "$BODY" | grep -o '"[a-zA-Z-]*":"[a-zA-Z]*"' | tr '\n' '  ')"

# ═════════════════════════════════════════════════════════
# Phase 2 — Auth
# ═════════════════════════════════════════════════════════
phase 2 "Auth"

TS=$(date +%s)
TEST_EMAIL="smoke.${TS}@example.com"
TEST_PASS="SmokeTest123!"
TEST_NAME="Smoke Tester"

mut_curl -X POST "$BASE_URL/api/users/register" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
  -d "{\"name\":\"$TEST_NAME\",\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASS\"}"
check "POST /api/users/register" "201"
refresh_csrf

run_curl -b "$COOKIE_JAR" "$BASE_URL/api/users/profile"
check "GET /api/users/profile  (after register)" "200"
info "$(echo "$BODY" | grep -o '"email":"[^"]*"')"

mut_curl -X POST "$BASE_URL/api/users/logout" \
  -b "$COOKIE_JAR" -c "$COOKIE_JAR"
check "POST /api/users/logout" "200"

run_curl -b "$COOKIE_JAR" "$BASE_URL/api/users/profile"
check "GET /api/users/profile  (after logout → 401)" "401"

run_curl -b "$COOKIE_JAR" -c "$COOKIE_JAR" "$BASE_URL/api/users/csrf"
refresh_csrf

mut_curl -X POST "$BASE_URL/api/users/login" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASS\"}"
check "POST /api/users/login" "200"
refresh_csrf

run_curl -b "$COOKIE_JAR" "$BASE_URL/api/users/profile"
check "GET /api/users/profile  (after login)" "200"

# ═════════════════════════════════════════════════════════
# Phase 3 — Products
# ═════════════════════════════════════════════════════════
phase 3 "Products"

run_curl "$BASE_URL/api/products"
check "GET /api/products  (list)" "200"

PRODUCT_ID=$(echo "$BODY" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4 || true)
VARIANT_ID=""

if [[ -z "$PRODUCT_ID" ]]; then
  echo -e "  ${YELLOW}⚠${NC}  Product catalogue empty — Phases 4 & 5 skipped"
  SKIP=$((SKIP + 5))
else
  info "First product ID: $PRODUCT_ID"
  run_curl "$BASE_URL/api/products/$PRODUCT_ID"
  check "GET /api/products/:id  (single)" "200"
  info "$(echo "$BODY" | grep -o '"name":"[^"]*"' | head -1)"
  VARIANT_ID=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin).get('data',{}); v=d.get('variants',[]); print(v[0]['_id'] if v else '')" 2>/dev/null || true)
  info "First variant ID: ${VARIANT_ID:-<none>}"
fi

# ═════════════════════════════════════════════════════════
# Phase 4 — Cart
# ═════════════════════════════════════════════════════════
phase 4 "Cart"

if [[ -z "$PRODUCT_ID" ]] || [[ -z "$VARIANT_ID" ]]; then
  echo -e "  ${YELLOW}⚠${NC}  Skipped (no products or variants)"
else
  run_curl -b "$COOKIE_JAR" "$BASE_URL/api/cart"
  check "GET /api/cart  (empty)" "200"

  mut_curl -X POST "$BASE_URL/api/cart/items" \
    -H "Content-Type: application/json" \
    -b "$COOKIE_JAR" \
    -d "{\"productId\":\"$PRODUCT_ID\",\"variantId\":\"$VARIANT_ID\",\"quantity\":2}"
  check "POST /api/cart/items  (add, qty=2)" "200"

  run_curl -b "$COOKIE_JAR" "$BASE_URL/api/cart"
  check "GET /api/cart  (1 item)" "200"
  info "$(echo "$BODY" | grep -o '"items":\[[^]]*\]' | head -c 120)"

  mut_curl -X PATCH "$BASE_URL/api/cart/items/$VARIANT_ID" \
    -H "Content-Type: application/json" \
    -b "$COOKIE_JAR" \
    -d '{"quantity":1}'
  check "PATCH /api/cart/items/:variantId  (update qty=1)" "200"
fi

# ═════════════════════════════════════════════════════════
# Phase 5 — Orders
# ═════════════════════════════════════════════════════════
phase 5 "Orders"

if [[ -z "$PRODUCT_ID" ]]; then
  echo -e "  ${YELLOW}⚠${NC}  Skipped (no products)"
else
  mut_curl -X POST "$BASE_URL/api/users/addresses" \
    -H "Content-Type: application/json" \
    -b "$COOKIE_JAR" \
    -d '{"label":"Home","street":"123 Test St","city":"Toronto","province":"Ontario","postalCode":"M5V 3A8","country":"Canada"}'
  check "POST /api/users/addresses  (create)" "201"
  ADDRESS_ID=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('address',{}).get('id',''))" 2>/dev/null || true)
  info "Address ID: ${ADDRESS_ID:-<not found>}"

  mut_curl -X POST "$BASE_URL/api/orders" \
    -H "Content-Type: application/json" \
    -b "$COOKIE_JAR" \
    -d "{\"addressId\":\"$ADDRESS_ID\"}"
  check "POST /api/orders  (place)" "201"

  ORDER_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4 || true)
  info "Order ID: ${ORDER_ID:-<not found>}"

  run_curl -b "$COOKIE_JAR" "$BASE_URL/api/orders/mine"
  check "GET /api/orders/mine  (list)" "200"
  info "Order count: $(echo "$BODY" | grep -o '"id"' | wc -l | tr -d ' ')"

  if [[ -n "$ORDER_ID" ]]; then
    run_curl -b "$COOKIE_JAR" "$BASE_URL/api/orders/$ORDER_ID"
    check "GET /api/orders/:id  (single)" "200"
    info "$(echo "$BODY" | grep -o '"status":"[^"]*"' | head -1)"
  fi
fi

# ═════════════════════════════════════════════════════════
# Phase 6 — Cleanup
# ═════════════════════════════════════════════════════════
phase 6 "Cleanup"

mut_curl -X POST "$BASE_URL/api/users/logout" \
  -b "$COOKIE_JAR" -c "$COOKIE_JAR"
check "POST /api/users/logout  (final)" "200"

run_curl -b "$COOKIE_JAR" "$BASE_URL/api/users/profile"
check "GET /api/users/profile  (post-logout → 401)" "401"

# ═════════════════════════════════════════════════════════
# Summary
# ═════════════════════════════════════════════════════════
echo ""
echo -e "${BLUE}━━━ Results ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  ${GREEN}Passed : $PASS${NC}"
[[ $FAIL -gt 0 ]] && echo -e "  ${RED}Failed : $FAIL${NC}"
[[ $SKIP -gt 0 ]] && echo -e "  ${YELLOW}Skipped: $SKIP  (no seed data)${NC}"
echo ""

if [[ $FAIL -eq 0 ]]; then
  echo -e "${GREEN}✓  All checks passed — production is healthy${NC}"
  echo ""
  exit 0
else
  echo -e "${RED}✗  $FAIL check(s) failed${NC}"
  echo ""
  exit 1
fi
