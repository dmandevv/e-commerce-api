# ─── Stage 1: Build ──────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
COPY shared/package.json shared/tsconfig.json ./shared/
COPY services/payment-service/package.json services/payment-service/tsconfig.json ./services/payment-service/
COPY services/payment-service/prisma ./services/payment-service/prisma
COPY services/payment-service/prisma.config.ts ./services/payment-service/

# Install dependencies + generate Prisma client
RUN npm ci --workspace=shared --workspace=@ecommerce/payment-service --include-workspace-root
RUN cd services/payment-service && npx prisma generate

# Copy source and build
COPY shared/src ./shared/src
COPY services/payment-service/src ./services/payment-service/src

RUN npx tsc --build shared services/payment-service

# ─── Stage 2: Production ────────────────────────────────
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY services/payment-service/package.json ./services/payment-service/
COPY services/payment-service/prisma ./services/payment-service/prisma
COPY services/payment-service/prisma.config.ts ./services/payment-service/

RUN npm ci --omit=dev --workspace=shared --workspace=@ecommerce/payment-service --include-workspace-root
RUN cd services/payment-service && npx prisma generate

COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/services/payment-service/dist/src ./services/payment-service/dist/src
COPY --from=builder /app/services/payment-service/dist/generated ./services/payment-service/dist/generated

WORKDIR /app/services/payment-service

EXPOSE 3005

# Run pending migrations then start the app
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/app.js"]
