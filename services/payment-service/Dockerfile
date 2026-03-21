# ─── Stage 1: Build ──────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
COPY shared/package.json shared/tsconfig.json ./shared/
COPY services/payment-service/package.json services/payment-service/tsconfig.json ./services/payment-service/
COPY services/payment-service/prisma ./services/payment-service/prisma

# Install dependencies + generate Prisma client
RUN npm ci --workspace=shared --workspace=@ecommerce/payment-service --include-workspace-root
RUN cd services/payment-service && npx prisma generate \
    && echo '{"name":"@prisma/payment-client","main":"./index.js","types":"./index.d.ts"}' \
    > node_modules/@prisma/payment-client/package.json

# Copy source and build
COPY shared/src ./shared/src
COPY services/payment-service/src ./services/payment-service/src

RUN npx tsc --build shared services/payment-service

# ─── Stage 2: Production ────────────────────────────────
FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY services/payment-service/package.json ./services/payment-service/
COPY services/payment-service/prisma ./services/payment-service/prisma

RUN npm ci --omit=dev --workspace=shared --workspace=@ecommerce/payment-service --include-workspace-root
RUN cd services/payment-service && npx prisma generate \
    && echo '{"name":"@prisma/payment-client","main":"./index.js","types":"./index.d.ts"}' \
    > node_modules/@prisma/payment-client/package.json

COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/services/payment-service/dist ./services/payment-service/dist

WORKDIR /app/services/payment-service

EXPOSE 3005

# Run pending migrations then start the app
CMD ["sh", "-c", "npx prisma migrate deploy --schema=prisma/schema.prisma && node dist/app.js"]
