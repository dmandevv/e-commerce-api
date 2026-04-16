# ─── Stage 1: Build ──────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
COPY shared/package.json shared/tsconfig.json ./shared/
COPY services/order-service/package.json services/order-service/tsconfig.json ./services/order-service/
COPY services/order-service/prisma ./services/order-service/prisma
COPY services/order-service/prisma.config.ts ./services/order-service/

# Install dependencies
RUN npm ci --workspace=shared --workspace=@ecommerce/order-service --include-workspace-root
RUN cd services/order-service && DATABASE_URL="postgresql://fake:fake@fake:5432/fake" npx prisma generate

# Copy source and build
COPY shared/src ./shared/src
COPY services/order-service/src ./services/order-service/src

RUN npx tsc --build shared services/order-service

# ─── Stage 2: Production ────────────────────────────────
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY services/order-service/package.json ./services/order-service/
COPY services/order-service/prisma ./services/order-service/prisma
COPY services/order-service/prisma.config.ts ./services/order-service/

RUN npm ci --omit=dev --workspace=shared --workspace=@ecommerce/order-service --include-workspace-root
RUN cd services/order-service && DATABASE_URL="postgresql://fake:fake@fake:5432/fake" npx prisma generate

COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/services/order-service/dist/src ./services/order-service/dist/src
COPY --from=builder /app/services/order-service/dist/generated ./services/order-service/dist/generated

WORKDIR /app/services/order-service

EXPOSE 3004

# Run pending migrations then start the app
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/server.js"]
