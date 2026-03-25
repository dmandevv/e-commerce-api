# ─── Stage 1: Build ──────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app

# Copy workspace root files needed for npm install
COPY package.json package-lock.json tsconfig.json ./
COPY shared/package.json shared/tsconfig.json ./shared/
COPY services/health-service/package.json services/health-service/tsconfig.json ./services/health-service/

# Install ALL dependencies (including devDependencies for tsc)
RUN npm ci --workspace=shared --workspace=@ecommerce/health-service --include-workspace-root

# Copy source code
COPY shared/src ./shared/src
COPY services/health-service/src ./services/health-service/src

# Build shared first, then the service
RUN npx tsc --build shared services/health-service

# ─── Stage 2: Production ────────────────────────────────
FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY services/health-service/package.json ./services/health-service/

# Install only production dependencies
RUN npm ci --omit=dev --workspace=shared --workspace=@ecommerce/health-service --include-workspace-root

# Copy compiled output from builder
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/services/health-service/dist ./services/health-service/dist

WORKDIR /app/services/health-service

EXPOSE 3007

CMD ["node", "dist/app.js"]
