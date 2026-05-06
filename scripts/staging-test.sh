#!/bin/bash
# ─── Staging Frontend Test ───────────────────────────────
#
# Starts the Next.js frontend locally, pointed at the staging
# cluster for all backend API calls. No Docker, no local services.
#
# Usage:
#   ./scripts/staging-test.sh <STAGING_IP>
#   STAGING_IP=1.2.3.4 ./scripts/staging-test.sh

set -e

# ─── Resolve staging IP ──────────────────────────────────
STAGING_IP="${1:-${STAGING_IP:-146.190.165.21}}"

STAGING_API_URL="http://$STAGING_IP:8081"

# ─── Cleanup ─────────────────────────────────────────────
PIDS=()

cleanup() {
  echo ""
  echo "Shutting down..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null
  done
  echo "Done."
  exit 0
}

trap cleanup SIGINT SIGTERM

# ─── Start frontend pointed at staging ───────────────────
echo "Starting frontend → staging backend at $STAGING_API_URL"
echo ""

(
  cd frontend
  API_UPSTREAM_URL="$STAGING_API_URL" \
  NEXT_PUBLIC_API_URL="" \
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="$(grep NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY .env | cut -d= -f2-)" \
  npm run dev
) &
PIDS+=($!)

echo "Frontend running. Press Ctrl+C to stop."
echo "  Frontend: http://localhost:3000"
echo "  Backend:  $STAGING_API_URL"
echo ""

wait
