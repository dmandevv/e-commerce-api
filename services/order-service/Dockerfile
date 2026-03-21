# ─── Stage 1: Build ──────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
COPY shared/package.json shared/tsconfig.json ./shared/
COPY services/order-service/package.json services/order-service/tsconfig.json ./services/order-service/
COPY services/order-service/prisma ./services/order-service/prisma

# Install dependencies + generate Prisma client
RUN npm ci --workspace=shared --workspace=@ecommerce/order-service --include-workspace-root
RUN cd services/order-service && npx prisma generate \
    && echo '{"name":"@prisma/order-client","main":"./index.js","types":"./index.d.ts"}' \
    > node_modules/@prisma/order-client/package.json

# Copy source and build
COPY shared/src ./shared/src
COPY services/order-service/src ./services/order-service/src

RUN npx tsc --build shared services/order-service

# ─── Stage 2: Production ────────────────────────────────
FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY services/order-service/package.json ./services/order-service/
COPY services/order-service/prisma ./services/order-service/prisma

RUN npm ci --omit=dev --workspace=shared --workspace=@ecommerce/order-service --include-workspace-root
RUN cd services/order-service && npx prisma generate \
    && echo '{"name":"@prisma/order-client","main":"./index.js","types":"./index.d.ts"}' \
    > node_modules/@prisma/order-client/package.json

COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/services/order-service/dist ./services/order-service/dist

WORKDIR /app/services/order-service

EXPOSE 3004

# Run pending migrations then start the app
CMD ["sh", "-c", "npx prisma migrate deploy --schema=prisma/schema.prisma && node dist/app.js"]
