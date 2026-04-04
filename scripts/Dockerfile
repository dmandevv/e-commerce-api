# ─────────────────────────────────────────────────────────
# Seed Script — One-off admin container
#
# Compiles and runs scripts/seed.ts to upsert the admin
# user and populate products. Never starts automatically —
# only runs via:
#   docker compose -f docker-compose.prod.yml run --rm seed
#
# Two-stage build keeps the final image small:
#   Stage 1: compile TypeScript → JavaScript
#   Stage 2: node + mongoose + bcryptjs + seed.js (~50MB)
# ─────────────────────────────────────────────────────────

# ─── Stage 1: Compile ────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY scripts/seed.ts ./

# Install TypeScript + types needed to compile the seed
RUN npm init -y \
    && npm install typescript @types/node @types/bcryptjs mongoose bcryptjs \
    && npx tsc seed.ts \
       --esModuleInterop \
       --module commonjs \
       --target es2020 \
       --types node \
       --outDir dist \
       --skipLibCheck

# ─── Stage 2: Production ─────────────────────────────────
FROM node:22-alpine
WORKDIR /app

# Only the two runtime dependencies the seed needs
RUN npm init -y && npm install mongoose bcryptjs

COPY --from=builder /app/dist/seed.js ./seed.js

CMD ["node", "seed.js"]
