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
  for pid in "${PIDS[@]}"; do
    wait "$pid" 2>/dev/null
  done
  stty sane 2>/dev/null
  echo "Done."
  exit 0
}

trap cleanup SIGINT SIGTERM

# ─── Kill any lingering Next.js dev servers on port 3000 ─
STALE=$(ss -tlnp 'sport = :3000' 2>/dev/null | awk 'NR>1 {match($0, /pid=([0-9]+)/, a); if (a[1]) print a[1]}')
if [ -n "$STALE" ]; then
  echo "Killing stale process on port 3000 (pid $STALE)..."
  kill $STALE 2>/dev/null || true
  sleep 0.5
fi

# ─── Start frontend pointed at staging ───────────────────
echo "Starting frontend → staging backend at $STAGING_API_URL"
echo ""

setsid bash -c '
  cd frontend
  exec env \
    API_UPSTREAM_URL="'"$STAGING_API_URL"'" \
    NEXT_PUBLIC_API_URL="" \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="'"$(grep NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY frontend/.env | cut -d= -f2-)"'" \
    npm run dev
' &
PIDS+=($!)

echo "Frontend running. Press Ctrl+C to stop."
echo "  Frontend: http://localhost:3000"
echo "  Backend:  $STAGING_API_URL"
echo ""

wait
