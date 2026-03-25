#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# Health Check Script
# Used by CI to verify all services are running and healthy.
#
# Two-layer check:
#   1. Docker healthchecks — each container's built-in health test
#   2. Gateway smoke test — verify NGINX routes to a backend
# ─────────────────────────────────────────────────────────

set -euo pipefail

echo ""
echo "=== Docker Container Health Status ==="
echo ""

# Show health status of all containers
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

echo ""

# Check if any containers are unhealthy
UNHEALTHY=$(docker compose ps --format json | jq -r 'select(.Health == "unhealthy") | .Name' 2>/dev/null || true)

if [ -n "$UNHEALTHY" ]; then
  echo "=== UNHEALTHY CONTAINERS ==="
  echo "$UNHEALTHY"
  echo ""
  echo "Dumping unhealthy container logs:"
  for container in $UNHEALTHY; do
    echo "--- $container ---"
    docker logs "$container" --tail=20 2>&1
    echo ""
  done
  exit 1
fi

echo "=== Gateway Smoke Test ==="
echo ""

# Verify the gateway is responding
if response=$(curl -sf --max-time 5 "http://localhost:80/health" 2>/dev/null); then
  echo "  [PASS] Gateway — $response"
else
  echo "  [FAIL] Gateway not responding on port 80"
  exit 1
fi

# Verify the health dashboard aggregates all services
if response=$(curl -sf --max-time 10 "http://localhost:80/api/health/status" 2>/dev/null); then
  echo "  [PASS] Health Dashboard — $response"
else
  echo "  [FAIL] Health dashboard not responding"
  exit 1
fi

echo ""
echo "=== All checks passed ==="
echo ""
