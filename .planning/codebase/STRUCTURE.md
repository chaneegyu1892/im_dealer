# Codebase Structure

**Analysis Date:** 2026-05-04

## Directory Layout

```
im_dealer/
├── .claude/                    # User's Claude config (git-tracked notes)
├── .github/
│   └── workflows/              # GitHub Actions CI/CD
├── .planning/
│   └── codebase/               # Generated codebase docs (this directory)
├── docs/                       # Project documentation
│   ├── quote-calculator-spec.md
│   ├── admin-spec.md
│   └── screenshots/
├── e2e/                        # Playwright E2E tests
├── prisma/
│   ├── schema.prisma           # Prisma schema (data model)
│   ├── seed.ts                 # Database seed script
│   ├── migrations/             # Database migration files
│   └── update-vehicle-specs.ts # DB utilities
├── public/
│   └── images/
│       ├── logos/
│       └── vehicles/
├── scripts/                    # Utility scripts
├── src/
│   ├── app/                    # Next.js 14 App Router
│   │   ├── (public)/           # Public customer-facing routes
│   │   ├── (admin)/            # Admin/internal dashboard routes
│   │   ├── api/                # API routes (REST endpoints)
│   │   ├── auth/               # OAuth callback
│   │   ├── fonts/              # Local font files
│   │   ├── layout.tsx          # Root layout
│   │   ├── globals.css         # Global styles
│   │   ├── error.tsx           # Global error boundary
│   │   ├── not-found.tsx       # 404 page
│   │   ├── robots.ts           # SEO robots.txt
│   │   └── sitemap.ts          # SEO sitemap
│   ├── components/             # React components
│   │   ├── admin/              # Admin dashboard components
│   │   ├── home/               # Homepage components
│   │   ├── quote/              # Quote calculator components
│   │   ├── recommend/          # AI recommendation components
│   │   ├── cars/               # Vehicle browse components
│   │   ├── layout/             # Layout components (header, sidebar)
│   │   ├── ui/                 # Reusable UI primitives
│   │   └── (others)            # Feature-specific component groups
│   ├── lib/                    # Utilities, services, helpers
│   │   ├── admin-queries/      # SSR query functions (9 modules)
│   │   ├── validators/         # Zod schemas & validators
│   │   ├── validations/        # (Legacy) validation code
│   │   ├── supabase/           # Supabase client + server utils
│   │   ├── quote-calculator.ts # Core quote calculation engine
│   │   ├── ai-recommender.ts   # AI recommendation scoring
│   │   ├── codef.ts            # Document verification integration
│   │   ├── admin-auth.ts       # JWT token management
│   │   ├── admin-ai-queries.ts # LLM reasoning queries
│   │   ├── audit.ts            # Audit logging
│   │   ├── activity-store.ts   # Activity tracking store
│   │   ├── pii.ts              # PII purge handler
│   │   ├── quote-draft.ts      # Draft quote persistence (localStorage)
│   │   ├── quote-pdf-template.ts # PDF generation template
│   │   ├── rate-limit.ts       # Rate limiting (Vercel KV)
│   │   ├── prisma.ts           # Prisma singleton
│   │   ├── supabase.ts         # Supabase config
│   │   ├── sentry-scrubber.ts  # Error logging sanitizer
│   │   ├── notify.ts           # Notification utilities
│   │   ├── require-admin.ts    # Admin role enforcement
│   │   ├── security.ts         # Security utilities
│   │   ├── revalidate.ts       # ISR revalidation helpers
│   │   ├── review-utils.ts     # Review/feedback utilities
│   │   ├── llm-reason.ts       # LLM API calls
│   │   ├── format.ts           # Formatting utilities
│   │   ├── utils.ts            # General utilities
│   │   ├── ip-hash.ts          # IP hashing for tracking
│   │   └── env.ts              # Environment variable validation
│   ├── types/                  # TypeScript type definitions
│   │   ├── quote.ts            # Quote-related types
│   │   ├── api.ts              # API response types
│   │   ├── admin.ts            # Admin data types
│   │   ├── vehicle.ts          # Vehicle types
│   │   ├── inventory.ts        # Inventory types
│   │   ├── recommendation.ts   # Recommendation types
│   │   └── review.ts           # Review types
│   ├── constants/              # Constant values
│   │   ├── quote-defaults.ts   # Default rates, scenarios
│   │   └── (others)            # Domain-specific constants
│   ├── middleware.ts           # Request middleware
│   └── (env configs)           # tsconfig.json, etc.
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.ts
├── prettier.config.js
├── .eslintrc.json
├── .env (NEVER READ)
├── .env.local (NEVER READ)
└── README.md
```

## Directory Purposes

**`src/app/(public)/*`:**
- Purpose: Customer-facing pages and flows
- Contains: Pages for quote calculator, vehicle browse, AI recommendation, document verification, homepage
- Key files: `page.tsx` (SSR server components), `*ClientPage.tsx` (client components)
- Example routes:
  - `/` → `src/app/(public)/page.tsx` (homepage with popular vehicles)
  - `/quote` → `src/app/(public)/quote/page.tsx` + `QuoteClientPage.tsx`
  - `/recommend` → `src/app/(public)/recommend/page.tsx`
  - `/cars` → `src/app/(public)/cars/page.tsx` (vehicle catalog)
  - `/verify` → `src/app/(public)/verify/page.tsx` (document submission)

**`src/app/(admin)/admin/*`:**
- Purpose: Admin dashboard and management interfaces
- Contains: Dashboard, vehicle editor, quote CRM, user/review management, analytics
- Key files: `page.tsx` (calls SSR query → client component)
- Example routes:
  - `/admin` → Dashboard with KPIs and charts
  - `/admin/vehicles` → Vehicle list + edit
  - `/admin/quotations` → Quote CRM with table + drawer
  - `/admin/analytics` → 30-day analytics
  - `/admin/users` → User management
  - `/admin/reviews` → Customer review management
  - `/admin/login` → Admin login form

**`src/app/api/*`:**
- Purpose: REST API endpoints for mutations and integrations
- Contains: Handler functions (GET, POST, PATCH, PUT, DELETE)
- Naming convention: Each route segment maps to endpoint path (e.g., `src/app/api/quote/calculate/route.ts` → `POST /api/quote/calculate`)
- Divided into:
  - `api/admin/*` - Admin CRUD operations (requires JWT)
  - `api/quote/*` - Public quote operations
  - `api/recommend/*` - Public AI recommendation
  - `api/vehicles/*` - Public vehicle data
  - `api/verification/*` - Document verification
  - `api/logs/*` - Analytics event logging
  - `api/cron/*` - Scheduled jobs (e.g., PII purge)
  - `api/health/*` - Health check

**`src/components/admin/`:**
- Purpose: Admin dashboard UI components
- Sub-directories by feature:
  - `dashboard/` - KPI cards, charts (LineChart, BarChart, DonutChart)
  - `vehicles/` - Vehicle list, editor, form
  - `quotations/` - Quote table with drawer + activity log
  - `users/` - User management table
  - `reviews/` - Review management & verification results
  - `analytics/` - 30-day KPI cards + charts
  - `audit-logs/` - Audit trail viewer
  - `settings/` - Admin settings (accounts, policy)
  - `ai/` - AI configuration
  - `recovery-rates/` - Rate sheet management
  - `finance/` - Finance company settings
- Pattern: All marked `"use client"`; receive SSR data as props; state management via useState

**`src/components/quote/`:**
- Purpose: Quote calculator UI components
- Key components:
  - `QuoteBreakdownTabs` - Scenario comparison & breakdown display
  - `ComparisonSection` - Side-by-side scenarios
  - `ChannelTalkButton` - Customer support button
- Pattern: Used by `QuoteClientPage`

**`src/components/recommend/`:**
- Purpose: AI recommendation UI
- Key components:
  - `RecommendResultView` - Recommended vehicle cards
- Pattern: Displays recommendation session results

**`src/components/home/`:**
- Purpose: Homepage components
- Key components:
  - `HeroSection`, `PopularCarsSection`, `CustomerReviewsSection`, `ServiceIntroSection`
- Pattern: Imported by `src/app/(public)/page.tsx`

**`src/lib/admin-queries/`:**
- Purpose: SSR data fetching functions for admin pages
- Files (1 module per domain):
  - `dashboard.ts` - getDashboardData()
  - `analytics.ts` - getAnalyticsData()
  - `vehicles.ts` - getVehiclesList(), getVehicleDetail()
  - `quotes.ts` - getSavedQuotes(), getQuoteDetail()
  - `users.ts` - getUsersList(), getUserDetail()
  - `reviews.ts` - getReviews()
  - `inventory.ts` - getInventory()
  - `finance.ts` - getFinanceCompanies()
  - `verifications.ts` - getVerificationResults()
- Pattern: Exported from `index.ts`; called in server components via top-level await

**`src/lib/validators/` & `src/lib/validations/`:**
- Purpose: Input validation schemas
- Validators (Zod): Route input schemas (quote-calculator, admin endpoints)
- Validations (Legacy): Older validation code (being phased out in favor of Zod)
- Pattern: Used in API routes via `.parse()` to validate request.json()

**`src/lib/supabase/`:**
- Purpose: Supabase client & server utilities
- Files:
  - `client.ts` - Browser client for auth/realtime
  - `server.ts` - Server-side client for auth sessions
  - (possibly other integration files)

**`src/types/`:**
- Purpose: TypeScript type definitions for domain models
- Files:
  - `quote.ts` - Quote, FinanceQuoteResult, SurchargeDetail, etc.
  - `api.ts` - API response types
  - `admin.ts` - Admin dashboard types (DashboardData, etc.)
  - `vehicle.ts` - Vehicle, Trim, EngineType enums
  - Others: inventory.ts, recommendation.ts, review.ts

**`src/constants/`:**
- Purpose: Constant values (enums, defaults, lookup tables)
- Files:
  - `quote-defaults.ts` - RANK_SURCHARGE_RATES, CONTRACT_MONTHS, etc.
  - (others as needed)

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx`: Root layout wrapping all routes
- `src/middleware.ts`: Request pre-processing (rate limiting, auth, session)

**Configuration:**
- `src/env.ts`: Environment variable schema & validation
- `next.config.js`: Next.js build config
- `prisma/schema.prisma`: Database schema

**Core Logic:**
- `src/lib/quote-calculator.ts`: Quote calculation (회수율 기반, multi-finance, scenarios)
- `src/lib/ai-recommender.ts`: Vehicle recommendation scoring
- `src/lib/codef.ts`: Document verification (면허, 보험, 사업자) via Codef API

**Admin Query Functions:**
- `src/lib/admin-queries/dashboard.ts`: KPI aggregation
- `src/lib/admin-queries/analytics.ts`: 30-day analytics data
- `src/lib/admin-queries/vehicles.ts`: Vehicle list/detail for admin edit page
- `src/lib/admin-queries/quotes.ts`: Quote CRM data

**API Routes (Public Quote Flow):**
- `src/app/api/quote/calculate/route.ts`: Main quote calculation endpoint
- `src/app/api/quote/save/route.ts`: Save quote to database
- `src/app/api/quote/pdf/route.ts`: Generate PDF
- `src/app/api/recommend/route.ts`: AI recommendation creation

**API Routes (Admin CRUD):**
- `src/app/api/admin/vehicles/route.ts`: List/create vehicles
- `src/app/api/admin/vehicles/[id]/route.ts`: Get/update/delete specific vehicle
- `src/app/api/admin/vehicles/[id]/trims/route.ts`: Trim management
- `src/app/api/admin/quotes/route.ts`: Quote list (pagination)
- `src/app/api/admin/quotes/[id]/route.ts`: Quote detail/update/CRM actions
- `src/app/api/admin/users/route.ts`: User management
- `src/app/api/admin/reviews/route.ts`: Review management

**Testing:**
- `src/lib/quote-calculator.test.ts`: Quote calculator unit tests
- `src/lib/pii.test.ts`: PII purge handler tests
- `src/lib/sentry-scrubber.test.ts`: Error scrubber tests
- `e2e/`: Playwright E2E tests (structure TBD)

## Naming Conventions

**Files:**
- Routes: `page.tsx` (server component), `*Page.tsx` or `*Client.tsx` (client component)
- API routes: `route.ts`
- Components: `PascalCase.tsx` (e.g., `DashboardClient.tsx`, `QuoteBreakdownTabs.tsx`)
- Utilities: `camelCase.ts` (e.g., `quote-calculator.ts`, `admin-auth.ts`)
- Tests: `*.test.ts` or `*.spec.ts`

**Directories:**
- Features/domains: Lowercase (e.g., `admin/`, `quote/`, `vehicles/`)
- Route groups: Parentheses (e.g., `(public)/`, `(admin)/`)
- Dynamic segments: Brackets (e.g., `[id]/`, `[slug]/`, `[sessionId]/`)
- Components organized by feature, not by type (not `containers/` or `presentational/`)

**Functions:**
- Query functions: Prefix with `get` (e.g., `getDashboardData()`, `getVehiclesList()`)
- Calculation functions: Verb + noun (e.g., `calculateMultiFinanceQuote()`, `applyDeposit()`)
- Validation functions: Prefix with `is` or `validate` (e.g., `isValidAdminJwt()`)

**Variables & Constants:**
- camelCase for local variables
- UPPER_SNAKE_CASE for module-level constants (e.g., `RANK_SURCHARGE_RATES`, `CONTRACT_MONTHS`)

## Where to Add New Code

**New Feature (End-to-End):**
1. **Server Component (SSR):** `src/app/(public|admin)/<feature>/page.tsx`
   - Fetches initial data via Prisma or lib query function
   - Passes data to client component
2. **Client Component:** `src/app/(public|admin)/<feature>/<FeaturePage>.tsx` (marked `"use client"`)
   - Manages state and interactivity
   - Calls API endpoints for mutations
3. **API Route:** `src/app/api/<feature>/route.ts` or `src/app/api/<feature>/[id]/route.ts`
   - Handles POST/PUT/PATCH/DELETE
   - Validates input via Zod schema
   - Calls lib service functions (quote-calculator, ai-recommender, etc.)
4. **Components:** `src/components/<feature>/*.tsx`
   - Feature-specific UI components
5. **Types:** Add or extend `src/types/*.ts`
6. **Tests:** `src/lib/*.test.ts` or `e2e/*.spec.ts`

**New Admin Page:**
1. Create `src/app/(admin)/admin/<page-name>/page.tsx` (SSR server component)
   - Call `src/lib/admin-queries/<page-name>.ts` for initial data
2. Create `src/components/admin/<page-name>/` components (all marked `"use client"`)
3. Create `src/lib/admin-queries/<page-name>.ts` with SSR query functions
4. Create API routes in `src/app/api/admin/<resource>/` for CRUD operations
5. Add navigation link in `src/components/layout/AdminSidebar.tsx`

**New Utility/Service:**
- If it's quote/finance related: `src/lib/quote-*.ts`
- If it's admin data: `src/lib/admin-queries/*.ts` (for SSR) or `src/lib/admin-*.ts` (for services)
- If it's validation: `src/lib/validators/*.ts` (Zod schemas)
- If it's integrations: `src/lib/codef.ts`, `src/lib/supabase/`, etc.
- If it's general: `src/lib/utils.ts` or a new descriptive file

**New API Endpoint:**
1. Create `src/app/api/<resource>/route.ts` or `src/app/api/<resource>/[id]/route.ts`
2. Add Zod validation schema (in `src/lib/validators/` or inline)
3. Implement handler (GET/POST/PATCH/DELETE)
4. Return `NextResponse.json(data, { status: 200 })` or error response
5. Add rate limiting if public endpoint (handled by middleware)

**New Component:**
- Feature-based: `src/components/<feature>/<ComponentName>.tsx`
- Reusable UI primitives: `src/components/ui/<ComponentName>.tsx`
- Admin-specific: `src/components/admin/<domain>/<ComponentName>.tsx`
- Always define props interface at top of file

## Special Directories

**`prisma/migrations/`:**
- Purpose: Tracks database schema changes
- Generated: Automatically by Prisma CLI (`prisma migrate dev`)
- Committed: Yes
- Do not edit by hand; use `prisma migrate dev` or `prisma db push`

**`public/images/`:**
- Purpose: Static assets (logos, vehicle thumbnails)
- Generated: No (manually added)
- Committed: Yes
- Referenced via `src="/images/..."` in components

**`docs/`:**
- Purpose: Project documentation (specs, guides, screenshots)
- Generated: No (manually written)
- Committed: Yes
- Examples: `quote-calculator-spec.md`, `admin-spec.md`

**`.planning/codebase/`:**
- Purpose: Auto-generated codebase documentation (ARCHITECTURE.md, STRUCTURE.md, etc.)
- Generated: Yes (via `/gsd-map-codebase` command)
- Committed: Yes (updated on each analysis)

**`e2e/`:**
- Purpose: Playwright end-to-end tests
- Generated: No (manually written)
- Committed: Yes
- Run via: `npx playwright test`

**`.claude/`:**
- Purpose: User's Claude notes and project memory
- Generated: No (manually created)
- Committed: Yes
- Contains: CLAUDE.md, MEMORY.md, project-specific instructions

---

*Structure analysis: 2026-05-04*
