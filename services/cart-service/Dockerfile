# ─── Stage 1: Build ──────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copy workspace root files needed for npm install
COPY package.json package-lock.json tsconfig.json ./
COPY shared/package.json shared/tsconfig.json ./shared/
COPY services/cart-service/package.json services/cart-service/tsconfig.json ./services/cart-service/

# Install ALL dependencies (including devDependencies for tsc)
RUN npm ci --workspace=shared --workspace=@ecommerce/cart-service --include-workspace-root

# Copy source code
COPY shared/src ./shared/src
COPY services/cart-service/src ./services/cart-service/src

# Build shared first, then the service
RUN npx tsc --build shared services/cart-service

# ─── Stage 2: Production ────────────────────────────────
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY services/cart-service/package.json ./services/cart-service/

# Install only production dependencies
RUN npm ci --omit=dev --workspace=shared --workspace=@ecommerce/cart-service --include-workspace-root

# Copy compiled output from builder
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/services/cart-service/dist ./services/cart-service/dist

WORKDIR /app/services/cart-service

EXPOSE 3003

CMD ["node", "dist/server.js"]
