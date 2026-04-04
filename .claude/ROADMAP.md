# E-Commerce Platform Roadmap

> **Last updated:** 2026-04-01
> **Goal:** Transform the current project into a production-grade e-commerce platform comparable to Amazon.ca, following industry-standard practices for security, reliability, and user experience.

---

## Part 1 - What's Been Built So Far

### Architecture
- **Microservices monorepo** (npm workspaces) with 7 independent services
- **Event-driven communication** via RabbitMQ (topic exchange, durable queues)
- **Shared TypeScript library** (`@ecommerce/shared`) for types, errors, events, middleware, metrics, and circuit breaker
- **NGINX API Gateway** with rate limiting, CORS, and path-based routing

### Services

| Service | Database | Key Features |
|---------|----------|-------------|
| **User Service** (3001) | MongoDB | Registration, login, JWT auth, roles (customer/admin) |
| **Product Service** (3002) | MongoDB + Redis cache | CRUD, image upload (Cloudinary), reviews/ratings, keyword search, pagination |
| **Cart Service** (3003) | Redis (3-day TTL) | Stateless cart management, add/remove/update items |
| **Order Service** (3004) | PostgreSQL (Prisma) | Order creation, status tracking, history, consumes payment events |
| **Payment Service** (3005) | PostgreSQL (Prisma) | Stripe integration, webhook handling, publishes payment events |
| **Notification Service** (3006) | None | Email (Nodemailer), real-time WebSocket (Socket.IO), RabbitMQ consumer |
| **Health Service** (3007) | None | Aggregated health checks across all services |

### Infrastructure & DevOps
- **Docker Compose** for local dev (MongoDB, PostgreSQL, Redis, RabbitMQ, all services, monitoring)
- **CI pipeline** (GitHub Actions): TypeScript check, Docker build matrix, integration smoke test
- **CD pipeline** (GitHub Actions): Build/push to GHCR, deploy to k3s via SSH, rolling updates
- **Kubernetes (k3s + Traefik)**: Deployments, HPA, IngressRoute, TLS via Let's Encrypt, rate limiting
- **Monitoring**: Prometheus metrics + Grafana dashboards
- **Logging**: EFK stack (Fluentd + Elasticsearch + Kibana) with optional profile
- **Production databases**: MongoDB Atlas, Neon PostgreSQL, Upstash Redis, CloudAMQP RabbitMQ

### Frontend (Next.js 14)
- Home page with hero banner, category cards, featured products
- Product listing with search and pagination
- Product detail page with reviews/ratings
- Authentication (login/register)
- Shopping cart
- Checkout with Stripe payment form
- Order history

### Cross-cutting Concerns
- JWT authentication with role-based access (customer/admin)
- Zod validation on request bodies
- Standardized error classes (AppError, NotFoundError, ValidationError, etc.)
- Request ID propagation (X-Request-Id) for distributed tracing
- Prometheus metrics with path normalization (prevent cardinality explosion)
- Circuit breaker on inter-service calls (Order -> Product/Cart)

---

## Part 2 - Gap Analysis vs Production-Grade E-Commerce

### Critical Gaps (Blocking for Production)

| Gap | Impact | Current State |
|-----|--------|---------------|
| **Zero test coverage** | Cannot ship safely, no regression protection | No test files exist anywhere |
| **No shipping/address management** | Cannot deliver products | Order model has no shipping fields |
| **No inventory reservation** | Overselling risk under concurrency | Basic `stock` field, no hold/reserve |
| **Hardcoded secrets in .env.local** | Security risk if leaked | Weak JWT secret, dev credentials in repo |
| **No password reset flow** | Users locked out permanently | Only login/register exist |
| **No email verification** | Fake accounts, spam | Registration has no verification step |
| **No CSRF protection** | Vulnerable to cross-site request forgery | JWT in localStorage, no CSRF tokens |
| **No input sanitization** | XSS risk on user-generated content (reviews) | Zod validates shape but doesn't sanitize HTML |
| **No admin dashboard** | Admin operations require API tools | Backend admin routes exist but no UI |

### Major Gaps (Required for Amazon-Level Quality)

| Gap | Impact |
|-----|--------|
| **No product search engine** | Keyword regex search doesn't scale; no faceted search, filters, autocomplete |
| **No wishlist** | Missing standard e-commerce feature |
| **No user address book** | Users re-enter address every order |
| **No order tracking / shipping integration** | No real shipping status, no carrier APIs |
| **No refund/return flow** | Payment service has REFUNDED status but no workflow |
| **No product variants** (size, color) | Single SKU per product |
| **No coupon/discount system** | No promotional pricing |
| **No recommendation engine** | No "customers also bought" or personalization |
| **No SEO optimization** | Missing meta tags, structured data, sitemap |
| **No accessibility (a11y)** | No ARIA labels, keyboard navigation audit |
| **No i18n/l10n** | English only, no multi-currency |
| **No pagination on orders** | Will break with large order history |
| **Session management** | No refresh tokens, no token revocation, no device management |

### Operational Gaps (Required for 99.9% Uptime)

| Gap | Impact |
|-----|--------|
| **HPA set to max 1 replica** | No horizontal scaling, single point of failure |
| **No database backups** | Data loss risk |
| **No disaster recovery plan** | No runbook for outages |
| **No structured logging** | Console.log only, no log levels, no correlation |
| **No distributed tracing** (OpenTelemetry) | Request ID exists but no trace visualization |
| **No alerting rules** | Prometheus collects but no alerts configured |
| **No load testing** | Unknown capacity limits |
| **No canary/blue-green deployments** | All-or-nothing rolling updates |
| **No secret rotation** | Static secrets, no vault integration |
| **No CDN** | Static assets served from origin |

---

## Part 3 - Step-by-Step Roadmap

### Phase 1: Foundation & Security Hardening
> **Goal:** Make the platform safe to put real users on.

#### 1.1 - Testing Infrastructure
- [x] Set up Vitest for unit testing across all services (`vitest.config.ts` with V8 coverage, 80% thresholds)
- [ ] Write unit tests for all business logic (services, utils, validation)
  - [x] Shared library: errors, middleware (requestId, validate), circuit breaker, constants (7 test files)
  - [x] User service: auth, asyncHandler, errorHandler middleware (3 test files)
  - [x] Product service: schemas, cache, APIFeatures, cloudinary, upload middleware, controller (6 test files)
  - [x] Cart service: schemas, repository, controller with circuit breaker (3 test files)
  - [x] Order service: schemas, orderService, controller, event publisher (4 test files)
  - [x] Payment service: paymentService, controller, publisher, consumer (4 test files)
  - [x] Notification service: email service, templates, consumer (3 test files)
- [ ] Write integration tests for each service's API endpoints (supertest)
- [ ] Write integration tests for inter-service communication (RabbitMQ events)
- [x] Set up test coverage reporting (>80% target) — V8 provider, 80% statements/functions/lines, 70% branches
- [ ] Add E2E tests for critical user flows (Playwright): register -> browse -> add to cart -> checkout -> order confirmation
- [ ] Add tests to CI pipeline (fail PR if coverage drops)

#### 1.2 - Authentication & Security
- [ ] Implement refresh token rotation (short-lived access token + long-lived refresh token in httpOnly cookie)
- [ ] Add token revocation (Redis blacklist or versioned tokens)
- [ ] Implement email verification on registration (send verification link, activate account)
- [ ] Implement password reset flow (forgot password -> email link -> reset form)
- [ ] Move JWT from localStorage to httpOnly secure cookies (prevent XSS token theft)
- [ ] Add CSRF protection middleware
- [ ] Sanitize all user-generated content (reviews, names) with DOMPurify or similar
- [ ] Implement account lockout after N failed login attempts
- [ ] Add security headers (Helmet.js): Content-Security-Policy, X-Frame-Options, etc.
- [ ] Audit and rotate all secrets; use strong randomly generated JWT secrets
- [ ] Set up proper CORS allowlists per environment (no wildcard `*` in production)

#### 1.3 - Environment Separation
- [ ] Create distinct environment configs: `development`, `staging`, `production`
- [ ] Set up a staging environment (separate k8s namespace or cluster) mirroring production
- [ ] Use a secrets manager (HashiCorp Vault, AWS Secrets Manager, or Doppler) instead of raw env vars
- [ ] Ensure `.env.local` is never committed (verify .gitignore)
- [ ] Create a `docker-compose.dev.yml` that uses local-only credentials with no external service dependencies
- [ ] Add environment validation on service startup (fail fast if required vars missing)

---

### Phase 2: Core E-Commerce Features
> **Goal:** Feature parity with a real e-commerce platform.

#### 2.1 - Shipping & Address Management
- [ ] Add `Address` model to User Service (street, city, province, postal code, country, isDefault)
- [ ] CRUD endpoints for user addresses (`/api/users/addresses`)
- [ ] Add shipping address to Order model (snapshot at order time, not a reference)
- [ ] Integrate a shipping rate API (Canada Post, UPS, or EasyPost) for real-time shipping costs
- [ ] Add shipping cost calculation to checkout flow
- [ ] Add order tracking number field and tracking status

#### 2.2 - Inventory Management
- [ ] Implement stock reservation on checkout (hold stock for 15 min during payment)
- [ ] Release reserved stock on payment failure or timeout
- [ ] Deduct stock on payment success (via RabbitMQ event)
- [ ] Add low-stock alerts (publish event when stock < threshold)
- [ ] Add SKU field to products
- [ ] Implement inventory audit log (who changed stock, when, why)

#### 2.3 - Product Variants & Catalog
- [ ] Add product variants model (size, color, material) with per-variant stock and pricing
- [ ] Implement product categories as a hierarchical tree (parent/child)
- [ ] Add product tags for better discoverability
- [ ] Add "related products" field (manual or algorithmic)
- [ ] Implement product comparison feature

#### 2.4 - Search & Discovery
- [ ] Integrate Elasticsearch (or Meilisearch/Typesense for simpler setup)
- [ ] Index products with full-text search, fuzzy matching, and autocomplete
- [ ] Implement faceted search (filter by category, price range, rating, brand)
- [ ] Add search suggestions / typeahead
- [ ] Sync product data to search index via RabbitMQ events (product.created, product.updated)

#### 2.5 - Wishlist
- [ ] Add Wishlist model (userId + productIds) to User Service or as a new lightweight service
- [ ] CRUD endpoints: add/remove/list wishlist items
- [ ] Frontend: wishlist button on product cards and detail page
- [ ] "Move to cart" from wishlist

#### 2.6 - Coupons & Promotions
- [ ] Create a Promotion Service or add to Order Service
- [ ] Coupon model: code, discount type (percentage/fixed), min order, expiry, usage limit
- [ ] Apply coupon at checkout (validate, calculate discount)
- [ ] Admin endpoints: create/deactivate coupons
- [ ] Frontend: coupon input field in cart/checkout

#### 2.7 - Returns & Refunds
- [ ] Define return policy rules (time window, eligible statuses)
- [ ] Add return request flow: customer initiates -> admin approves -> refund processed
- [ ] Integrate Stripe refund API
- [ ] Restock inventory on return completion
- [ ] Email notifications at each return stage

---

### Phase 3: Frontend Polish & UX
> **Goal:** Professional, accessible, performant storefront.

#### 3.1 - Admin Dashboard
- [ ] Create `/admin` route group with admin-only layout
- [ ] Dashboard home: sales summary, recent orders, low-stock alerts
- [ ] Product management: CRUD with image upload, variant editor
- [ ] Order management: view all orders, update status (ship, deliver, cancel)
- [ ] User management: view users, roles, ban accounts
- [ ] Coupon management: create/edit/deactivate promotions
- [ ] Analytics: revenue charts, top products, conversion funnel

#### 3.2 - Customer UX Improvements
- [ ] User profile page (edit name, email, password)
- [ ] Address book management UI
- [ ] Order detail page with status timeline
- [ ] Order tracking integration (carrier tracking widget)
- [ ] Wishlist page
- [ ] Real-time notifications UI (bell icon with dropdown, Socket.IO)
- [ ] Recently viewed products
- [ ] Product image gallery (multiple images, zoom)
- [ ] Responsive design audit (mobile-first)
- [ ] Loading skeletons and optimistic UI updates
- [ ] Toast notifications for actions (added to cart, order placed, etc.)
- [ ] Empty state designs (empty cart, no orders, no results)

#### 3.3 - SEO & Performance
- [ ] Add Next.js metadata API for all pages (title, description, Open Graph)
- [ ] Generate `sitemap.xml` and `robots.txt`
- [ ] Add structured data (JSON-LD) for products (Google Rich Results)
- [ ] Implement Next.js Image component for optimized product images
- [ ] Add lazy loading for product grids
- [ ] Implement ISR (Incremental Static Regeneration) for product pages
- [ ] Target Core Web Vitals: LCP < 2.5s, FID < 100ms, CLS < 0.1

#### 3.4 - Accessibility (WCAG 2.1 AA)
- [ ] Audit with axe-core or Lighthouse
- [ ] Add ARIA labels to all interactive elements
- [ ] Ensure keyboard navigation works across all flows
- [ ] Color contrast compliance
- [ ] Screen reader testing (NVDA/VoiceOver)
- [ ] Focus management on modals and route changes

---

### Phase 4: Observability & Reliability
> **Goal:** Achieve 99.9% uptime with full visibility into system health.

#### 4.1 - Structured Logging
- [ ] Replace `console.log` with a structured logger (Pino or Winston)
- [ ] Standard log format: `{ timestamp, level, service, requestId, message, ...context }`
- [ ] Log levels: error, warn, info, debug (configurable per environment)
- [ ] Correlate logs across services using X-Request-Id
- [ ] Ensure no sensitive data in logs (mask PII, tokens, card numbers)

#### 4.2 - Distributed Tracing
- [ ] Integrate OpenTelemetry SDK into all services
- [ ] Export traces to Jaeger or Grafana Tempo
- [ ] Instrument HTTP calls, database queries, and RabbitMQ operations
- [ ] Add trace context propagation through NGINX gateway
- [ ] Create Grafana dashboards linking traces to metrics and logs

#### 4.3 - Alerting
- [ ] Define SLIs/SLOs: availability (99.9%), latency (p95 < 500ms), error rate (< 0.1%)
- [ ] Configure Prometheus alerting rules:
  - Service down (health check failing for > 1 min)
  - Error rate spike (> 5% 5xx in 5 min window)
  - Latency degradation (p95 > 1s)
  - RabbitMQ queue backlog (> 1000 unacked messages)
  - Database connection pool exhaustion
  - Disk/memory usage > 85%
- [ ] Set up Alertmanager with PagerDuty/Slack/email routing
- [ ] Create on-call runbooks for each alert

#### 4.4 - Resilience & Fault Tolerance
- [ ] Enable HPA with realistic min/max replicas (min 2 per service for HA)
- [ ] Add Pod Disruption Budgets (PDB) to prevent all replicas going down during upgrades
- [ ] Implement retry with exponential backoff on inter-service calls
- [ ] Add dead letter queues (DLQ) for failed RabbitMQ messages
- [ ] Implement idempotency keys on payment and order creation (prevent double-charge)
- [ ] Add graceful shutdown handling (drain connections, finish in-flight requests)
- [ ] Implement database connection pooling (PgBouncer or Prisma connection pool)
- [ ] Run chaos engineering experiments (kill pods, simulate network partitions)

#### 4.5 - Backup & Disaster Recovery
- [ ] Automate daily database backups (MongoDB Atlas scheduled snapshots, Neon branching)
- [ ] Test backup restoration quarterly
- [ ] Document Recovery Point Objective (RPO < 1 hour) and Recovery Time Objective (RTO < 30 min)
- [ ] Multi-region failover strategy for critical services
- [ ] Store backups in a separate cloud region

---

### Phase 5: Performance & Scalability
> **Goal:** Handle traffic spikes (Black Friday) without degradation.

#### 5.1 - Caching Strategy
- [ ] Implement Redis caching layer beyond product service:
  - User sessions/profiles (reduce MongoDB reads)
  - Search results (short TTL)
  - Category trees (long TTL with invalidation)
- [ ] Add cache invalidation via RabbitMQ events (product.updated -> bust cache)
- [ ] Implement HTTP caching headers (ETag, Cache-Control) at gateway
- [ ] Add CDN (Cloudflare or CloudFront) for static assets and product images

#### 5.2 - Database Optimization
- [ ] Add MongoDB indexes for common queries (product search, user lookup)
- [ ] Analyze and optimize Prisma queries (avoid N+1, use includes)
- [ ] Implement read replicas for MongoDB (separate read/write connections)
- [ ] Add database query performance monitoring
- [ ] Implement pagination with cursors instead of offset (for large datasets)

#### 5.3 - Load Testing
- [ ] Set up k6 or Artillery load testing scripts
- [ ] Define performance baselines for key endpoints
- [ ] Test scenarios: normal load, peak load (10x), sustained load
- [ ] Identify bottlenecks and optimize
- [ ] Run load tests in CI on staging before production deploys

#### 5.4 - Async Processing
- [ ] Move heavy operations to background workers:
  - Email sending (already via RabbitMQ - verify reliability)
  - Image processing/resizing
  - Search index updates
  - Analytics event processing
- [ ] Implement job queue with retry logic and dead letter handling

---

### Phase 6: Advanced Features & Growth
> **Goal:** Competitive feature set and developer experience.

#### 6.1 - Recommendation Engine
- [ ] Track user behavior events (view, add-to-cart, purchase)
- [ ] Implement "Customers also bought" (collaborative filtering or simple co-purchase)
- [ ] "Recently viewed" products (client-side + server-side)
- [ ] Personalized product recommendations on home page
- [ ] "Frequently bought together" bundles

#### 6.2 - Internationalization
- [ ] Add i18n framework (next-intl or next-i18next)
- [ ] Extract all UI strings to translation files
- [ ] Multi-currency support (store prices in base currency, convert at display)
- [ ] Locale-aware date/number formatting
- [ ] RTL support if targeting Arabic/Hebrew markets

#### 6.3 - Analytics & Business Intelligence
- [ ] Track key business metrics: conversion rate, average order value, cart abandonment
- [ ] Implement event tracking (view product, add to cart, begin checkout, purchase)
- [ ] Build analytics dashboard for business team
- [ ] A/B testing infrastructure for frontend experiments

#### 6.4 - API Documentation & Developer Experience
- [ ] Complete OpenAPI/Swagger specs for all services
- [ ] Add request/response examples for every endpoint
- [ ] Versioned API (v1/v2) with deprecation strategy
- [ ] Rate limiting documentation and API key management for third-party integrations
- [ ] SDK generation from OpenAPI specs (optional)

#### 6.5 - CI/CD Improvements
- [ ] Add canary deployments (route 5% traffic to new version, monitor, then promote)
- [ ] Implement database migration safety checks in CI
- [ ] Add dependency vulnerability scanning (Snyk, Dependabot, or Trivy)
- [ ] Container image scanning in CI pipeline
- [ ] Automated rollback on failed health checks post-deploy
- [ ] Feature flags (LaunchDarkly, Unleash, or custom) for safe feature rollouts

---

## Phase Summary

| Phase | Focus | Key Outcome |
|-------|-------|-------------|
| **Phase 1** | Foundation & Security | Safe to put real users on; test coverage; secure auth |
| **Phase 2** | Core E-Commerce | Feature-complete store (shipping, inventory, search, wishlists, returns) |
| **Phase 3** | Frontend & UX | Polished, accessible, SEO-optimized storefront with admin panel |
| **Phase 4** | Observability & Reliability | 99.9% uptime with full visibility, alerting, and disaster recovery |
| **Phase 5** | Performance & Scale | Handle traffic spikes; optimized queries, caching, CDN |
| **Phase 6** | Advanced Features | Recommendations, i18n, analytics, developer experience |

---

## Architecture Target State

```
                          ┌─────────────┐
                          │   CDN       │
                          │ (CloudFront)│
                          └──────┬──────┘
                                 │
                          ┌──────▼──────┐
                          │  Traefik /  │
                          │  NGINX GW   │
                          │ (TLS, Rate  │
                          │  Limit)     │
                          └──────┬──────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
   ┌──────▼──────┐       ┌──────▼──────┐       ┌──────▼──────┐
   │   User      │       │  Product    │       │   Order     │
   │   Service   │       │  Service    │       │   Service   │
   │  (MongoDB)  │       │  (MongoDB)  │       │  (Postgres) │
   └──────┬──────┘       └──────┬──────┘       └──────┬──────┘
          │                      │                      │
   ┌──────▼──────┐       ┌──────▼──────┐       ┌──────▼──────┐
   │   Cart      │       │  Payment    │       │ Notification│
   │   Service   │       │  Service    │       │  Service    │
   │  (Redis)    │       │  (Postgres) │       │ (WebSocket) │
   └─────────────┘       └─────────────┘       └─────────────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                          ┌──────▼──────┐
                          │  RabbitMQ   │
                          │  (Events)   │
                          └──────┬──────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
   ┌──────▼──────┐       ┌──────▼──────┐       ┌──────▼──────┐
   │  Redis      │       │ Elasticsearch│      │  OpenTelemetry│
   │  (Cache)    │       │  (Search)    │      │  (Traces)    │
   └─────────────┘       └─────────────┘       └──────────────┘
                                 │
                          ┌──────▼──────┐
                          │ Prometheus  │──► Alertmanager
                          │ + Grafana   │──► PagerDuty/Slack
                          └─────────────┘
```

---

## Key Principles

1. **Test everything** - No code reaches production without automated tests
2. **Fail fast, recover faster** - Circuit breakers, retries, graceful degradation
3. **Observability is not optional** - If you can't measure it, you can't manage it
4. **Security by default** - HTTPS everywhere, secrets in vaults, least privilege
5. **Automate repetitive work** - CI/CD, database migrations, backups, alerts
6. **Design for failure** - Every service should handle its dependencies being down
7. **Measure before optimizing** - Load test first, then optimize bottlenecks
8. **Ship incrementally** - Feature flags, canary deploys, small PRs
