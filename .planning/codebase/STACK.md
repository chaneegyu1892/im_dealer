# Technology Stack

**Analysis Date:** 2026-05-04

## Languages

**Primary:**
- TypeScript 5+ - Type-safe frontend and backend application code

**Secondary:**
- JavaScript (JSX/TSX) - React component syntax
- SQL - Prisma migrations and raw queries in `src/lib/admin-queries`

## Runtime

**Environment:**
- Node.js 20+ (no explicit .nvmrc or .node-version file — inferred from package.json `@types/node: ^20`)

**Package Manager:**
- npm 10+ (using package-lock.json v3)
- Lockfile: `package-lock.json` (committed)

## Frameworks

**Core:**
- Next.js 16.2.2 - Full-stack React framework (App Router)
- React 19.2.4 - UI component library
- React DOM 19.2.4 - DOM rendering

**Build/Dev:**
- TypeScript 5+ - Type checking
- ESLint 9 (flat config at `eslint.config.mjs`) - Linting
  - Config: `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`
  - Rules: `@typescript-eslint/no-explicit-any: warn`, React hooks warnings as `warn`
- Turbopack - Next.js bundler (configured in `next.config.mjs` root config)

**Styling:**
- Tailwind CSS 3.4.1 - Utility CSS framework
- AutoPrefix 10.0.1 - Browser prefix generation
- PostCSS 8 - CSS transformation pipeline

**Database:**
- Prisma 5.22.0 - ORM for PostgreSQL
  - Client: `@prisma/client: ^5.22.0`
  - Config: `prisma/schema.prisma` with dual connection URLs (pgBouncer + direct)

**Testing:**
- Vitest 1.6.0 - Unit/integration test runner
  - Config: `vitest.config.mjs` with jsdom environment
  - Setup: `setupTests.ts`
  - UI: `@vitest/ui: ^1.6.0`
  - DOM utilities: `@testing-library/react: ^16.3.2`, `@testing-library/jest-dom: ^6.9.1`
- Playwright 1.59.1 - E2E testing framework
  - Config: `playwright.config.ts` (Chromium only, ko-KR locale, Asia/Seoul timezone)
  - Base URL: `http://localhost:3000` (local) or `E2E_BASE_URL` env var (CI)

## Key Dependencies

**Critical:**
- `@prisma/client` 5.22.0 - Database ORM (finances calculation, inventory, quotes, admin data)
- `@supabase/supabase-js` 2.45.4 - Supabase client (file storage, auth)
- `@supabase/ssr` 0.5.2 - Server-side rendering helper for Supabase Auth
- `zod` 3.23.8 - Schema validation (environment variables, API request/response validation)
- `jose` 6.2.2 - JWT sign/verify for admin authentication (`src/lib/admin-auth.ts`)
- `bcryptjs` 3.0.3 - Password hashing for admin accounts

**Infrastructure:**
- `@sentry/nextjs` 10.49.0 - Error monitoring + performance tracing (configured in `next.config.mjs` with auto-source-map upload)
- `@upstash/ratelimit` 2.0.8 - Rate limiting via Upstash Redis
- `@upstash/redis` 1.37.0 - Redis client (cache, rate limit analytics)
- `@google/genai` 1.50.1 - Google Gemini 2.5 Flash Lite for AI recommendation reason generation (`src/lib/llm-reason.ts`)

**Frontend Utilities:**
- `framer-motion` 12.38.0 - Animation library (admin dashboard components)
- `lucide-react` 0.454.0 - Icon library
- `clsx` 2.1.1 - Conditional className concatenation
- `tailwind-merge` 2.5.4 - Merge Tailwind classes without conflicts
- `date-fns` 4.1.0 - Date formatting and manipulation
- `uuid` 13.0.0 - UUID generation for IDs

**Development Utilities:**
- `tsx` 4.21.0 - TypeScript executor for `prisma/seed.ts`
- `puppeteer` 24.42.0 - Browser automation (potentially for PDF generation testing)
- `xlsx` 0.18.5 - Excel file export (admin analytics/reporting)
- `jsdom` 24.1.0 - DOM emulation for tests
- `dotenv` 17.4.1 - Load `.env` files in development

## Configuration

**Environment:**
- File: `.env` (local), `.env.local` (private dev), `.env.example` (template)
- Key vars required:
  - Database: `DATABASE_URL`, `DIRECT_URL` (Prisma)
  - Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  - Admin: `ADMIN_JWT_SECRET` (32+ chars), `ADMIN_INITIAL_EMAIL`, `ADMIN_INITIAL_PASSWORD`
  - Integrations: `CODEF_CLIENT_ID`, `CODEF_CLIENT_SECRET`, `CODEF_SANDBOX`, `GOOGLE_GENAI_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
  - Monitoring: `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`
  - Security: `IP_HASH_SALT` (16+ chars), `PII_ENCRYPTION_KEY` (base64 32-byte), `CRON_SECRET` (32+ chars)
  - App: `NEXT_PUBLIC_APP_URL`, `TRUST_PROXY`
  - Optional: `SLACK_WEBHOOK_URL`
- Validation: `src/lib/env.ts` uses Zod schema to validate at startup (throws on production, warns on dev)

**TypeScript:**
- File: `tsconfig.json`
- Target: ES2017
- Module: esnext
- Path aliases: `@/*` → `./src/*`
- Strict mode enabled

**Tailwind:**
- File: `tailwind.config.ts`
- Color system: Primary (`#000666`), Secondary (`#71749A`), Tertiary (`#5C1800`), Neutral palette
- Content paths: `./src/pages/**`, `./src/components/**`, `./src/app/**`
- Admin color scheme defined: Primary `#000666` (Deep Navy), Accent `#6066EE`, Background `#F8F9FC`

**Next.js:**
- File: `next.config.mjs`
- Security Headers: CSP Report-Only, HSTS (1 year preload), X-Frame-Options DENY, Permissions-Policy (geolocation/microphone/camera/payment blocked)
- Image Domains: Supabase, Hyundai/Kia/Genesis/BMW/Mercedes/Audi/Volkswagen/Tesla/Volvo brand CDNs, Kakao CDN, Unsplash
- Turbopack enabled
- Sentry integration with `withSentryConfig` wrapper

**ESLint:**
- File: `eslint.config.mjs` (flat config)
- Extends: `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`
- Ignores: `.next`, `node_modules`, `out`, `build`, `scratch`
- Custom rules: `@typescript-eslint/no-explicit-any: warn` (not error)

**Vitest:**
- File: `vitest.config.mjs`
- Environment: jsdom
- Globals: true
- Setup: `setupTests.ts`
- Excludes: `node_modules`, `.next`, `e2e` (Playwright handles E2E)

**Playwright:**
- File: `playwright.config.ts`
- Browser: Chromium only
- Locale: ko-KR, Timezone: Asia/Seoul
- Timeout: 30s per test, 10s expect, 10s action timeout
- CI config: retries 2x, parallel off, HTML reporter
- webServer: auto-starts `npm run dev` unless `E2E_BASE_URL` set

## Prisma

**Database:**
- Provider: PostgreSQL (Supabase)
- Connection: pgBouncer connection pooling (API routes) + direct URL (migrations)
- Client: `@prisma/client` 5.22.0
- Schema: `prisma/schema.prisma` (core models: FinanceCompany, CapitalRateSheet, Trim, Option, Inventory, Quote, Customer, CustomerVerification, etc.)
- Seed: `prisma/seed.ts` (populates rank surcharge rates, capital rate sheets, brands, trims)

## Run Commands

```bash
npm run dev               # Start Next.js dev server (port 3000)
npm run build            # Build for production
npm start                # Start production server
npm run lint             # Run ESLint
npm run typecheck        # Run TypeScript type check
npm test                 # Run Vitest (all unit tests)
npm run test:watch       # Run Vitest in watch mode
npm run e2e              # Run Playwright E2E tests
npm run e2e:ui           # Playwright UI mode
npm run e2e:headed       # Playwright headed mode
npm run db:generate      # Generate Prisma client
npm run db:push          # Sync schema to database (development)
npm run db:migrate       # Create migration (development)
npm run db:studio        # Open Prisma Studio GUI
```

## Platform Requirements

**Development:**
- Node.js 20+ (inferred from @types/node)
- npm 10+ (for package-lock.json v3 format)
- PostgreSQL 14+ (Supabase managed)

**Production:**
- Deployment: Vercel (mentioned in recent commits: "Vercel 함수 region을 서울(icn1)로 이동")
- Environment region: icn1 (Seoul, Asia Northeast 2)
- Database: Supabase PostgreSQL with pgBouncer connection pooling
- Redis: Upstash for rate limiting
- Storage: Supabase Storage (S3-compatible)

---

*Stack analysis: 2026-05-04*
