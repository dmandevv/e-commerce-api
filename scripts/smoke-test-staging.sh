#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# Staging Smoke Test — scripts/smoke-test-staging.sh
#
# Walks the full happy path against a live staging cluster:
#
#   Phase 1 — Health      (/health, /api/health/status)
#   Phase 2 — Auth        (register, login, profile, logout)
#   Phase 3 — Products    (list, single)
#   Phase 4 — Cart        (add item, view, update qty)
#   Phase 5 — Orders      (place, list, single)
#   Phase 6 — Cleanup     (logout + confirm token revoked)
#
# How auth works in this script:
#   - CSRF: we set our own fixed value ("smoke-test") as both
#     the cookie and the X-CSRF-Token header on every mutating
#     request. The server just checks they match — it doesn't
#     care what the value is.
#   - Auth tokens: the cookie jar stores the httpOnly
#     accessToken cookie the server sets on login/register.
#     curl sends it back automatically, exactly like a browser.
#
# Phases 4 & 5 are skipped when the product catalogue is
# empty — seed first:
#   doppler run -- npx ts-node scripts/seed.ts
#
# Usage:
#   ./scripts/smoke-test-staging.sh
#   ./scripts/smoke-test-staging.sh 146.190.165.21
#   ./scripts/smoke-test-staging.sh 146.190.165.21 8081
# ─────────────────────────────────────────────────────────

SERVER_IP="${1:-146.190.165.21}"
PORT="${2:-8081}"
BASE_URL="http://${SERVER_IP}:${PORT}"

# Cookie jar — stores the httpOnly accessToken cookie between requests,
# replicating how a browser's cookie store works.
COOKIE_JAR="/tmp/smoke-cookies-$$.txt"
RESPONSE_FILE="/tmp/smoke-response-$$.json"

# Fixed CSRF value — sent as both cookie and header on every mutating
# request. The double-submit pattern only checks they match, so any
# consistent value works.
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

# Pre-seed the cookie jar with the fixed CSRF token so every request
# that reads from the jar automatically includes it alongside the
# httpOnly accessToken cookie set by login/register.
# Netscape format: domain TAB subdomains TAB path TAB secure TAB expiry TAB name TAB value
{
  echo "# Netscape HTTP Cookie File"
  printf '%s\tFALSE\t/\tFALSE\t%d\tcsrfToken\t%s\n' \
    "$SERVER_IP" "$(( $(date +%s) + 86400 ))" "$CSRF"
} > "$COOKIE_JAR"

# ─────────────────────────────────────────────────────────
# phase <n> <title>
# ─────────────────────────────────────────────────────────
phase() {
  echo ""
  echo -e "${BLUE}━━━ Phase $1: $2 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# ─────────────────────────────────────────────────────────
# run_curl <curl args…>
#   Sets $STATUS and $BODY.
# ─────────────────────────────────────────────────────────
run_curl() {
  STATUS=$(curl -s -w "%{http_code}" -o "$RESPONSE_FILE" "$@")
  BODY=$(cat "$RESPONSE_FILE" 2>/dev/null || echo "")
}

# ─────────────────────────────────────────────────────────
# check <label> <expected_status>
# ─────────────────────────────────────────────────────────
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

# ─────────────────────────────────────────────────────────
# refresh_csrf
#   Re-reads csrfToken from the cookie jar after any response
#   that calls setAuthCookies (register, login) — the server
#   generates a new random token and overwrites our pre-seeded
#   value, so we sync the CSRF variable to match.
# ─────────────────────────────────────────────────────────
refresh_csrf() {
  local token
  token=$(grep 'csrfToken' "$COOKIE_JAR" 2>/dev/null | awk '{print $NF}' || true)
  [[ -n "$token" ]] && CSRF="$token"
}

# ─────────────────────────────────────────────────────────
# mut_curl <curl args…>
#   Wrapper for mutating requests (POST/PATCH/DELETE).
#   Reads CSRF from the current value of $CSRF, which is kept
#   in sync with the cookie jar via refresh_csrf.
# ─────────────────────────────────────────────────────────
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

run_curl "$BASE_URL/health"
check "GET /health  (gateway)" "200"

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

# Register — mut_curl sends the fixed CSRF cookie + header.
# The server responds with Set-Cookie: accessToken (httpOnly),
# which curl saves to the cookie jar for all subsequent requests.
mut_curl -X POST "$BASE_URL/api/users/register" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
  -d "{\"name\":\"$TEST_NAME\",\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASS\"}"
check "POST /api/users/register" "201"
refresh_csrf

# Profile — no CSRF needed (GET). Cookie jar sends accessToken automatically.
run_curl -b "$COOKIE_JAR" "$BASE_URL/api/users/profile"
check "GET /api/users/profile  (after register)" "200"
info "$(echo "$BODY" | grep -o '"email":"[^"]*"')"

# Logout — clears accessToken cookie + blacklists the JWT in Redis
mut_curl -X POST "$BASE_URL/api/users/logout" \
  -b "$COOKIE_JAR" -c "$COOKIE_JAR"
check "POST /api/users/logout" "200"

# Profile must now fail — token was blacklisted
run_curl -b "$COOKIE_JAR" "$BASE_URL/api/users/profile"
check "GET /api/users/profile  (after logout → 401)" "401"

# Logout clears the csrfToken cookie — bootstrap a new one before login
run_curl -b "$COOKIE_JAR" -c "$COOKIE_JAR" "$BASE_URL/api/users/csrf"
refresh_csrf

# Login — get a fresh accessToken into the cookie jar
mut_curl -X POST "$BASE_URL/api/users/login" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASS\"}"
check "POST /api/users/login" "200"
refresh_csrf

# Confirm new token works
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
  echo -e "     Run: doppler run -- npx ts-node scripts/seed.ts"
  SKIP=$((SKIP + 5))
else
  info "First product ID: $PRODUCT_ID"
  run_curl "$BASE_URL/api/products/$PRODUCT_ID"
  check "GET /api/products/:id  (single)" "200"
  info "$(echo "$BODY" | grep -o '"name":"[^"]*"' | head -1)"
  VARIANT_ID=$(echo "$BODY" | grep -o '"_id":"[^"]*"' | sed -n '2p' | cut -d'"' -f4 || true)
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
  ADDRESS_ID=$(echo "$BODY" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4 || true)
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
  echo -e "${GREEN}✓  All checks passed — staging is healthy${NC}"
  echo ""
  exit 0
else
  echo -e "${RED}✗  $FAIL check(s) failed${NC}"
  echo ""
  exit 1
fi
