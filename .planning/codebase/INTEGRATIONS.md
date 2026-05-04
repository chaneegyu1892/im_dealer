# External Integrations

**Analysis Date:** 2026-05-04

## APIs & External Services

**Document Verification (Codef):**
- Codef API - Government document verification (driver license, insurance, business registration)
  - SDK/Client: Manual fetch (HTTP/2)
  - Auth: OAuth 2.0 Client Credentials (Bearer token)
  - Implementation: `src/lib/codef.ts`
  - Environment vars: `CODEF_CLIENT_ID`, `CODEF_CLIENT_SECRET`, `CODEF_SANDBOX`
  - Endpoints:
    - OAuth token: `https://oauth.codef.io/oauth/token`
    - API base: `https://development.codef.io` (sandbox) or production endpoint
  - Token cache: In-memory (6-day TTL to cover 1-week validity with buffer)
  - Used by: `/api/verification/session/[sessionId]` (retrieve verification result)

**Social Authentication (Kakao):**
- Kakao OAuth 2.0 - Customer login via Kakao account (mentioned in CLAUDE.md, images from `kakaocdn.net`)
  - SDK/Client: Supabase Auth provider integration
  - Auth: Kakao OAuth callback redirect to `/auth/callback`
  - Configuration: Kakao app settings registered in Supabase Auth
  - Note: Production domain registration required before deployment

**AI Recommendation (Google Gemini):**
- Google Gemini 2.5 Flash Lite - Generate natural language recommendation reasons
  - SDK/Client: `@google/genai` 1.50.1
  - Implementation: `src/lib/llm-reason.ts`
  - Auth: API key (Bearer token)
  - Environment var: `GOOGLE_GENAI_API_KEY` (server-only, NOT NEXT_PUBLIC_*)
  - Model: `gemini-2.5-flash-lite`
  - Input: Customer industry, vehicle purpose, budget, mileage, vehicle name, estimated monthly payment
  - Output: 70-character Korean recommendation reason (fallback: generic text if API fails)
  - Used by: `/api/recommend/[sessionId]` (AI recommendation endpoint)

## Data Storage

**Primary Database:**
- PostgreSQL 14+ (Supabase managed)
  - Connection: pgBouncer pooling at `aws-1-ap-northeast-2.pooler.supabase.com:6543` (API routes)
  - Direct: `db.*.supabase.co:5432` (migrations only)
  - Client: Prisma 5.22.0
  - ORM: `src/lib/prisma.ts` (singleton PrismaClient)
  - Connection logging: Queries + errors in dev, errors only in prod
  - Models: FinanceCompany, CapitalRateSheet, Trim, Option, Inventory, Quote, Customer, CustomerVerification, Admin, AdminAudit, ActivityLog, Review, RecommendationResult

**File Storage:**
- Supabase Storage (S3-compatible)
  - Client: `@supabase/supabase-js` 2.45.4
  - Auth: Service Role key (server-only) for admin uploads, Anon key (client) for public reads
  - Buckets: Images (vehicle photos), Documents (PDFs, verification docs)
  - Configuration: `src/lib/supabase/server.ts` (service role), `src/lib/supabase/client.ts` (browser client)
  - Image domains: `*.supabase.co` (Next.js remote image config)

**Caching:**
- Upstash Redis
  - Client: `@upstash/redis` 1.37.0 (REST API via HTTP)
  - Purpose: Rate limiting analytics, ephemeral cache
  - Configuration: REST URL + token from Upstash dashboard
  - Environment vars: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
  - Used by: `src/lib/rate-limit.ts` (sliding window & token bucket limiters)
  - Graceful degradation: If Redis unavailable, rate limiting disabled but app continues

## Authentication & Identity

**Admin Authentication:**
- Custom JWT-based (no OAuth)
  - Implementation: `src/lib/admin-auth.ts`
  - Secret: `ADMIN_JWT_SECRET` (32+ chars, stored in env)
  - Token signing: `jose` 6.2.2
  - Password hashing: `bcryptjs` 3.0.3
  - Initial account: Seeded in `prisma/seed.ts` via `ADMIN_INITIAL_EMAIL`, `ADMIN_INITIAL_PASSWORD`
  - Model: `Admin` table in PostgreSQL
  - Audit: `AdminAudit` table logs all admin actions (login, CRUD)

**Customer Authentication:**
- Supabase Auth (email/password + social)
  - Provider: Supabase Auth (built-in, no separate SaaS)
  - Social: Kakao OAuth via Supabase provider
  - Client: `@supabase/supabase-js` 2.45.4
  - SSR helper: `@supabase/ssr` 0.5.2 (cookie-based session for server components)
  - Redirect: `/auth/callback` (Kakao OAuth callback URL)
  - Session: Secure cookies (SSR-aware)

**PII Encryption:**
- AES-256-GCM symmetric encryption (no key rotation)
  - Key: `PII_ENCRYPTION_KEY` (base64-encoded 32-byte key)
  - Fields encrypted: CustomerVerification columns (licenseData, insuranceData, bizData, connectedId)
  - Implementation: `src/lib/pii.ts` (encrypt/decrypt functions)
  - Key loss: Permanent data loss — backup required in secret manager (1Password, etc.)

**IP Hashing:**
- SHA-256 HMAC for anonymization
  - Salt: `IP_HASH_SALT` (16+ chars, env var)
  - Implementation: `src/lib/ip-hash.ts`
  - Purpose: Track user activity without storing raw IPs (privacy compliance)
  - Used by: Activity tracking, analytics

## Monitoring & Observability

**Error Tracking:**
- Sentry (`@sentry/nextjs` 10.49.0)
  - Configuration: Wrapped `next.config.mjs` with `withSentryConfig`
  - Environment vars: `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`
  - Features:
    - Automatic source map upload to Sentry
    - PII scrubbing before transmission: `src/lib/sentry-scrubber.ts` (masks phone, RRN, license, business no., email)
    - Breadcrumb capture (requests, transactions)
    - Performance monitoring (Core Web Vitals)
  - Client: Browser errors + server-side errors
  - Used by: API routes, server components (import `@sentry/nextjs` for capture)

**Logs:**
- Console (development) + Sentry (production)
  - Dev: `console.log/error/warn` to stdout (Next.js dev server)
  - Prod: Errors sent to Sentry; logs may go to Vercel logs (stdout captured)
  - Custom logger: None (no Winston/Pino dependency)
  - Scrubbing: Sentry scrubber applies to all logged data before external transmission

**Performance Monitoring:**
- Sentry Web Vitals
  - Metrics: LCP, FID, CLS, TTFB
  - Threshold: Default Sentry dashboard
  - Used by: Frontend performance tracking

## Rate Limiting

**Implementation:**
- Upstash Ratelimit + Redis
  - File: `src/lib/rate-limit.ts`
  - Three tiers:
    1. General API: 20 requests/10s (sliding window) — vehicle list, details
    2. Strict (quote calculate, AI recommend): 5 requests/1min (token bucket) — heavy/sensitive ops
    3. Admin login: 5 attempts/5min (sliding window) — brute force protection
  - Analytics: Enabled (Upstash dashboard)
  - Fallback: If Redis unavailable, rate limiting gracefully disabled

## CI/CD & Deployment

**Hosting:**
- Vercel (Next.js native deployment)
  - Function region: icn1 (Seoul, Asia Northeast 2) — recent commit: "Vercel 함수 region을 서울(icn1)로 이동"
  - Build: `npm run build` (includes Prisma generate via postinstall hook)
  - Cron: Vercel Cron or external scheduler triggers `/api/cron/purge-pii` (90-day PII auto-purge)
  - Environment: Vercel Project Settings (secrets synced from `.env`)

**CI/CD Pipeline:**
- None detected (no GitHub Actions, GitLab CI, or similar)
  - Assumption: Manual deployment via `git push` to Vercel main/deploy branch
  - Future: Could use Vercel + GitHub integration for automated deploys

**Build & Start:**
- Build: `npm run build`
  - Runs Prisma schema validation (`db:generate` via postinstall)
  - Compiles TypeScript + Next.js
  - Generates source maps for Sentry
- Start: `npm start` (production server on port 3000)

## Database Migrations

**Tool:** Prisma Migrate
- Command: `npm run db:migrate` (creates `.sql` files in `prisma/migrations/`)
- Execution:
  - Development: Direct connection (`DIRECT_URL`)
  - Production: Manual via `prisma migrate deploy` (CI/CD or manual)
- Rollback: `prisma migrate resolve` (mark as rolled back)

## Webhooks & Callbacks

**Incoming:**
- Vercel Cron trigger: `POST /api/cron/purge-pii` (90-day PII auto-purge)
  - Auth: `CRON_SECRET` (Bearer token validation)
  - Trigger: External cron (Vercel Cron, GitHub Actions, or custom scheduler)
  - Payload: None required

**Outgoing:**
- Slack Incoming Webhook (optional)
  - URL: `SLACK_WEBHOOK_URL` (optional env var)
  - Purpose: Admin notifications (if configured)
  - Implementation: `src/lib/notify.ts` (sends JSON payload to Slack)
  - Status: Disabled if env var missing (safe fallback)

## DNS & Domain Configuration

**Kakao OAuth Redirect:**
- Registered domain: `NEXT_PUBLIC_APP_URL` (e.g., `https://your-service.up.railway.app` or custom domain)
- Kakao App Settings: Redirect URL must match (protocol + domain + /auth/callback)
- Supabase Auth: Same URL registered in Supabase project settings

**Supabase Auth Callback:**
- URL: `{NEXT_PUBLIC_APP_URL}/auth/callback`
- Registered in Supabase project dashboard

## Environment Configuration

**Required env vars (production fails without):**
- `DATABASE_URL` — Prisma pgBouncer connection
- `DIRECT_URL` — Prisma direct migration connection
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Public anon key
- `SUPABASE_SERVICE_ROLE_KEY` — Service role (optional for dev, required for admin features)
- `ADMIN_JWT_SECRET` — JWT signing key (32+ chars)
- `IP_HASH_SALT` — IP anonymization salt (16+ chars)
- `PII_ENCRYPTION_KEY` — AES-256 key (base64 32-byte)
- `CRON_SECRET` — Cron authorization (32+ chars)
- `NEXT_PUBLIC_APP_URL` — App origin URL

**Optional env vars (graceful degradation):**
- `CODEF_CLIENT_ID`, `CODEF_CLIENT_SECRET`, `CODEF_SANDBOX` — Document verification
- `GOOGLE_GENAI_API_KEY` — AI recommendation (returns fallback text if missing)
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — Rate limiting (disabled if missing)
- `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` — Error monitoring (disabled if missing)
- `SLACK_WEBHOOK_URL` — Slack notifications (disabled if missing)
- `TRUST_PROXY` — Proxy trust setting (for X-Forwarded-For header, default false)

**Secrets location:**
- Development: `.env.local` (private, not committed)
- Staging/Production: Vercel Project Settings → Environment Variables

---

*Integration audit: 2026-05-04*
