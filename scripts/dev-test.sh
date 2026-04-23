#!/bin/bash
# ─── Local Development Startup ──────────────────────────

# Start infrastructure + all services (no seed)
# npm run dev-test

# Start everything + seed databases
# npm run dev-test:seed

# Start everything + drop existing data + re-seed
# npm run dev-test:fresh

set -e

SEED=false
FRESH=false
for arg in "$@"; do
  case "$arg" in
    --seed) SEED=true ;;
    --fresh) SEED=true; FRESH=true ;;
  esac
done

PIDS=()

cleanup() {
  echo ""
  echo "Shutting down..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null
  done
  echo "Stopping containers..."
  docker compose --env-file .env down
  echo "Done."
  exit 0
}

trap cleanup SIGINT SIGTERM

# ─── 1. Build & start everything (infrastructure + services + gateway) ───
echo "Building and starting all containers..."
docker compose --env-file .env up -d --build --wait

echo "All containers ready."
echo ""

# ─── 2. Seed databases (optional) ────────────────────────
if [ "$SEED" = true ]; then
  if [ "$FRESH" = true ]; then
    echo "Seeding databases (fresh — dropping existing data)..."
    MONGODB_URI="mongodb://admin:admin@localhost:27017" npm run seed:fresh
  else
    echo "Seeding databases..."
    MONGODB_URI="mongodb://admin:admin@localhost:27017" npm run seed
  fi
  echo "Seed complete."
  echo ""
else
  echo "Skipping seed (use --seed or --fresh to populate databases)."
  echo ""
fi

# ─── 3. Start frontend ──────────────────────────────────
echo "Starting frontend..."
(cd frontend && npm run dev) &
PIDS+=($!)

echo ""
echo "All services running. Press Ctrl+C to stop everything."
echo "  Gateway:  http://localhost"
echo "  Frontend: http://localhost:3000"
echo ""

# Wait for any process to exit
wait
