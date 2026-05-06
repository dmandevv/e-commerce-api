# ─── Stage 1: Build ──────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copy workspace root files needed for npm install
COPY package.json package-lock.json tsconfig.json ./
COPY shared/package.json shared/tsconfig.json ./shared/
COPY services/user-service/package.json services/user-service/tsconfig.json ./services/user-service/

# Install ALL dependencies (including devDependencies for tsc)
RUN npm ci --workspace=shared --workspace=@ecommerce/user-service --include-workspace-root

# Copy source code
COPY shared/src ./shared/src
COPY services/user-service/src ./services/user-service/src

# Build shared first, then the service
RUN npx tsc --build shared services/user-service

# ─── Stage 2: Production ────────────────────────────────
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY services/user-service/package.json ./services/user-service/

# Install only production dependencies
RUN npm ci --omit=dev --workspace=shared --workspace=@ecommerce/user-service --include-workspace-root

# Copy compiled output from builder
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/services/user-service/dist ./services/user-service/dist

WORKDIR /app/services/user-service

EXPOSE 3001

CMD ["node", "dist/server.js"]
