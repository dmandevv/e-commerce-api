# ─── Stage 1: Build ──────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copy workspace root files needed for npm install
COPY package.json package-lock.json tsconfig.json ./
COPY shared/package.json shared/tsconfig.json ./shared/
COPY services/notification-service/package.json services/notification-service/tsconfig.json ./services/notification-service/

# Install ALL dependencies (including devDependencies for tsc)
RUN npm ci --workspace=shared --workspace=@ecommerce/notification-service --include-workspace-root

# Copy source code
COPY shared/src ./shared/src
COPY services/notification-service/src ./services/notification-service/src

# Build shared first, then the service
RUN npx tsc --build shared services/notification-service

# ─── Stage 2: Production ────────────────────────────────
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY services/notification-service/package.json ./services/notification-service/

# Install only production dependencies
RUN npm ci --omit=dev --workspace=shared --workspace=@ecommerce/notification-service --include-workspace-root

# Copy compiled output from builder
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/services/notification-service/dist ./services/notification-service/dist

WORKDIR /app/services/notification-service

EXPOSE 3006

CMD ["node", "dist/server.js"]
