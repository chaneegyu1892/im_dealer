<!-- refreshed: 2026-05-04 -->
# Architecture

**Analysis Date:** 2026-05-04

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────┐
│                     Next.js 14 App Router (SSR/CSR)                 │
│  ┌───────────────────┬──────────────────┬────────────────────────┐  │
│  │  Public Routes    │ Admin Routes     │ API Routes             │  │
│  │ (src/app/(pub))   │ (src/app/(admin))│ (src/app/api/*)        │  │
│  │ • Quote calculator│ • Dashboard      │ • /api/quote/calculate │  │
│  │ • Car browse      │ • Vehicle mgmt   │ • /api/admin/vehicles  │  │
│  │ • Recommend (AI)  │ • User/quote CRM │ • /api/verification    │  │
│  │ • Doc verification│ • Analytics      │ • /api/logs/*          │  │
│  └───────────────────┴──────────────────┴────────────────────────┘  │
│         ↓                    ↓                    ↓                   │
│  ┌──────────────────────────────────────────────────────────┐        │
│  │         Middleware (src/middleware.ts)                   │        │
│  │  • Rate limiting (public & admin APIs)                   │        │
│  │  • Admin JWT validation / /admin/login redirect          │        │
│  │  • Supabase session refresh                              │        │
│  └──────────────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────────┐
│              Services Layer (src/lib/*)                              │
│  ┌──────────────────┬─────────────────┬────────────────────────┐   │
│  │ Data queries     │ Core engines    │ External integrations  │   │
│  │ • admin-queries/ │ • quote-calc    │ • codef.ts (docs)      │   │
│  │ • admin-ai-      │ • ai-recommend  │ • supabase/            │   │
│  │   queries        │ • quote-draft   │   (auth, file storage) │   │
│  │ • admin-auth     │ • quote-pdf     │ • rate-limit.ts        │   │
│  │ • activity-store │ • pii.ts        │ • audit.ts             │   │
│  └──────────────────┴─────────────────┴────────────────────────┘   │
│  ┌──────────────────┬─────────────────────────────────────────┐     │
│  │ Utilities & Validators                                    │     │
│  │ • security.ts, revalidate.ts, format.ts, notify.ts       │     │
│  │ • lib/validators/, lib/validations/                       │     │
│  └──────────────────┴─────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────────┐
│                 Data Layer (Prisma ORM)                              │
│              (prisma/schema.prisma)                                  │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐      │
│  │ Vehicles &   │ Quote/CRM    │ Rate sheets  │ Logs & audit │      │
│  │ inventory    │ • SavedQuote │ • Finance    │ • Exploration│      │
│  │ • Vehicle    │ • Quote      │   Config     │   Log        │      │
│  │ • Trim       │   Activity   │ • Rank       │ • Recommend  │      │
│  │ • TrimOption │   Log        │   Surcharge  │   Log        │      │
│  │ • OptionRule │ • Review     │ • Capital    │ • Activity/  │      │
│  │ • Inventory  │              │   RateSheet  │   Audit logs │      │
│  │ • Lineup     │ • Customer   │              │ • Quote calc │      │
│  │ • Popular    │   Verif.     │              │   Log        │      │
│  │   Config     │              │              │              │      │
│  └──────────────┴──────────────┴──────────────┴──────────────┘      │
└─────────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────────┐
│            PostgreSQL (Database)                                     │
│  Supabase-hosted primary + Vercel KV (rate limiting cache)          │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Middleware | Request validation, rate limiting, auth checks, session management | `src/middleware.ts` |
| Quote Calculator Engine | Multi-scenario quote calculation (회수율 기반) | `src/lib/quote-calculator.ts` |
| AI Recommender | Recommendation session creation & scoring | `src/lib/ai-recommender.ts` |
| Admin Queries Module | SSR data fetching for admin pages (dashboard, analytics, etc.) | `src/lib/admin-queries/` |
| Document Verification (Codef) | Integration with external document verification service | `src/lib/codef.ts` |
| PII Purge Handler | Scheduled deletion of personally identifiable info | `src/lib/pii.ts` |
| Activity Store | User action tracking & analytics logging | `src/lib/activity-store.ts` |
| Admin Auth | JWT token generation & validation for admin sessions | `src/lib/admin-auth.ts` |
| Quote PDF Template | PDF generation for saved quotes | `src/lib/quote-pdf-template.ts` |

## Pattern Overview

**Overall:** Layered Next.js 14 App Router architecture with SSR for data, CSR for interactivity.

**Key Characteristics:**
- **Route groups** (`(public)` and `(admin)`) separate public customer flows from admin/internal operations
- **SSR via async Server Components** for initial data (e.g., `getDashboardData()` in `src/lib/admin-queries/dashboard.ts`)
- **Client components** receive SSR data and manage state/interactivity (e.g., `DashboardClient`, `QuoteClientPage`)
- **API Routes** handle real-time operations, mutations, and external service integrations
- **Rate limiting** applied at middleware layer to protect all public APIs
- **JWT-based admin auth** with cookie-based session management

## Layers

**Route Layer (Server Components & Pages):**
- Purpose: Coordinate requests, fetch initial SSR data, pass to client components
- Location: `src/app/(public)/*/page.tsx`, `src/app/(admin)/admin/*/page.tsx`
- Contains: Async server functions calling `lib/admin-queries/*` or Prisma directly
- Depends on: Prisma client, lib/admin-queries functions, Supabase
- Used by: Client components passed as children

**Service Layer:**
- Purpose: Business logic, data operations, external integrations
- Location: `src/lib/` (quote-calculator.ts, ai-recommender.ts, codef.ts, admin-queries/, etc.)
- Contains: Pure functions, query builders, API integrations
- Depends on: Prisma, external APIs (Codef, Supabase, LLM)
- Used by: Route handlers, API endpoints, client-side hooks

**Client Component Layer:**
- Purpose: UI rendering, user interaction, client-side state
- Location: `src/components/admin/`, `src/components/home/`, `src/components/quote/`, etc.
- Contains: React components marked with `"use client"`, hooks for data fetching/state
- Depends on: Types, utilities, server actions where needed
- Used by: Server component pages, other client components

**API Route Layer:**
- Purpose: Handle mutations, real-time calculations, webhook events
- Location: `src/app/api/`
- Contains: POST/PUT/PATCH/DELETE endpoint handlers
- Depends on: Prisma, lib services (quote-calculator, validation, etc.)
- Used by: Client-side fetch calls, external systems (webhooks)

**Data Access Layer:**
- Purpose: Database access & query optimization
- Location: `prisma/schema.prisma`, Prisma client operations
- Contains: Model definitions, relationships, indexes
- Depends on: PostgreSQL
- Used by: All layers via Prisma client

## Data Flow

### Primary Request Path (Public Quote Calculation)

1. **User navigates to `/quote`** (`src/app/(public)/quote/page.tsx`)
   - Server component fetches vehicle list via Prisma (SSR)
   - Passes initial data to `QuoteClientPage` client component

2. **User selects car + trim + contract terms** (`src/components/quote/*`)
   - Client-side state updates (React hooks)

3. **POST to `/api/quote/calculate`** (`src/app/api/quote/calculate/route.ts`)
   - Request validated via Zod
   - Fetches: vehicle data, trim options, capital rate sheets, finance company configs
   - Calls `calculateMultiFinanceQuote()` from `src/lib/quote-calculator.ts`
   - Returns 3 scenarios (conservative, standard, aggressive) with breakdowns

4. **Quote displayed with comparison** (`QuoteClientPage`)
   - Results rendered via `QuoteBreakdownTabs` component
   - User can download PDF (triggers `/api/quote/pdf`)

5. **User saves quote**
   - POST to `/api/quote/save`
   - Creates `SavedQuote` record in DB
   - Stores breakdown JSON, customer details, verification session link

### Secondary Flow: AI Recommendation

1. **User navigates to `/recommend`** (`src/app/(public)/recommend/page.tsx`)
   - User fills form: industry, budget, annual mileage, return type

2. **POST to `/api/recommend`** (`src/app/api/recommend/route.ts`)
   - Creates `RecommendationLog` session
   - Calls `src/lib/ai-recommender.ts` for scoring
   - Returns list of recommended vehicles + reasoning (JSON)
   - Stores session ID in response

3. **Results page** (`/recommend/result?sessionId=...`)
   - Fetches recommendation details via `/api/recommend/[sessionId]`
   - Displays vehicle cards with "이 차량으로 견적" quick action

### Tertiary Flow: Admin Dashboard (SSR → Client)

1. **Admin navigates to `/admin`** (`src/app/(admin)/admin/page.tsx`)
   - Middleware validates JWT from cookie
   - Server component calls `getDashboardData()` from `src/lib/admin-queries/dashboard.ts`
   - Query executes multiple Prisma & raw SQL operations in parallel:
     - Vehicle counts, quote view logs, AI sessions, monthly saved quotes
     - Weekly aggregations (quote views, AI sessions)
     - Category distribution, top vehicles, recent notes

2. **SSR data passed to DashboardClient** (`src/components/admin/dashboard/DashboardClient.tsx`)
   - `"use client"` component receives `DashboardData` prop
   - Renders: KPI cards, 4 charts (LineChart, BarChart, DonutChart)
   - Charts implemented as direct SVG (no external chart library)

3. **Admin CRUD operations** (vehicles, quotes, users)
   - Mutations via API routes: `/api/admin/vehicles`, `/api/admin/quotes/[id]`, etc.
   - Client calls fetch(), receives JSON response
   - Local state updated, UI re-renders

**State Management:**
- **SSR data (initial load):** Passed from server to client as props
- **Client state:** React hooks (`useState`) for UI toggles, selections, pagination
- **Server mutations:** API routes called via fetch(), results update local state
- **Activity tracking:** Logged asynchronously via `/api/logs/*` endpoints
- **Quote calculations:** Stateless service (pure function in `quote-calculator.ts`)

## Key Abstractions

**RateConfigData (Quote Calculator):**
- Purpose: Encapsulates rate matrix + surcharge rates for a single finance company
- Examples: `src/lib/quote-calculator.ts` line 20–30
- Pattern: Immutable data transfer object used in multi-scenario calculations

**DashboardData (Admin Dashboard):**
- Purpose: Aggregated KPI, charts, and activity data for dashboard render
- Examples: `src/types/admin.ts`, `src/lib/admin-queries/dashboard.ts`
- Pattern: Computed once at SSR, passed to client, re-fetched on demand via API

**SavedQuote & QuoteActivityLog:**
- Purpose: Persistent quote storage + CRM audit trail
- Examples: `prisma/schema.prisma` lines 230–285
- Pattern: Quote record with JSON breakdown, soft-delete support, activity history

**ClientComponent ("use client"):**
- Purpose: Separate interactive UI from server logic
- Examples: `src/components/admin/dashboard/DashboardClient.tsx`, `src/app/(public)/quote/QuoteClientPage.tsx`
- Pattern: Receive SSR data as props, manage local state, call API routes for mutations

## Entry Points

**Root Layout:**
- Location: `src/app/layout.tsx`
- Triggers: Every request to the application
- Responsibilities: Metadata, font loading, global styles, wrapper for route groups

**Middleware:**
- Location: `src/middleware.ts`
- Triggers: Every request (via matcher config)
- Responsibilities: Rate limiting, admin JWT validation, Supabase session refresh, IP extraction

**Public Quote Flow Entry:**
- Location: `src/app/(public)/quote/page.tsx`
- Triggers: GET /quote
- Responsibilities: SSR vehicle list fetch, pass to `QuoteClientPage`

**Admin Dashboard Entry:**
- Location: `src/app/(admin)/admin/page.tsx`
- Triggers: GET /admin (after JWT validation in middleware)
- Responsibilities: SSR dashboard data fetch, pass to `DashboardClient`

**API Quote Calculation:**
- Location: `src/app/api/quote/calculate/route.ts`
- Triggers: POST /api/quote/calculate
- Responsibilities: Validate input, fetch rate sheets, call calculator, return 3 scenarios

**API Recommendation:**
- Location: `src/app/api/recommend/route.ts`
- Triggers: POST /api/recommend
- Responsibilities: Create recommendation log, call AI recommender, score vehicles

## Architectural Constraints

- **Threading:** Single-threaded event loop (Node.js); no worker threads used
- **Global state:** Prisma singleton (`src/lib/prisma.ts`), Supabase singleton per request via SSR
- **Circular imports:** None detected; imports follow layering (routes → lib → types/prisma)
- **Rate limiting:** Vercel KV cache for token bucket; IP extracted from `x-forwarded-for` header in production
- **Admin sessions:** JWT stored in HTTP-only cookie; no client-side token storage
- **Quote calculations:** Completely stateless pure functions; no database writes during calc
- **File uploads:** Supabase Storage (bucket: public); URL stored in `Vehicle.thumbnailUrl` and similar fields
- **PII purge:** Scheduled via `/api/cron/purge-pii` route; soft-delete on `SavedQuote.deletedAt` field

## Anti-Patterns

### Direct Mutation of SSR Data in Client

**What happens:** SSR-fetched data stored directly in component state and modified in-place.

```typescript
// WRONG
const [data, setData] = useState(initialData);
data.stats.totalVehicles = 999; // Direct mutation
```

**Why it's wrong:** Makes SSR data unreliable as a "source of truth" for re-renders; difficult to debug which mutation caused stale UI.

**Do this instead:** Always treat SSR data as immutable props; create new state for client mutations:

```typescript
// CORRECT
interface DashboardClientProps {
  data: DashboardData; // Immutable SSR data
}

export function DashboardClient({ data }: DashboardClientProps) {
  const [filters, setFilters] = useState({}); // Separate client state
  // Re-fetch or transform data on user action, don't mutate `data`
}
```

### Fetching in Route Handler Instead of API Route

**What happens:** Server components call external APIs or perform heavy operations inline.

```typescript
// WRONG
export default async function Page() {
  const external = await fetch("https://api.example.com/data");
  // Ties page render time to external API latency
}
```

**Why it's wrong:** Slow external calls block page rendering; no retry logic; difficult to rate-limit.

**Do this instead:** Use API routes to decouple external fetches from SSR:

```typescript
// CORRECT
// src/app/api/external/route.ts
export async function GET() {
  const data = await externalApi.fetch();
  return NextResponse.json(data);
}

// src/app/page.tsx calls /api/external in client component
```

### Missing Rate Limit on Public APIs

**What happens:** Endpoints like `/api/quote/calculate` accept unlimited requests without protection.

**Why it's wrong:** Vulnerable to abuse; can cause database/CPU exhaustion; impacts legitimate users.

**Do this instead:** Apply rate limiting at middleware for all public API routes; see `src/middleware.ts` lines 56–91 for pattern.

## Error Handling

**Strategy:** Explicit try-catch in route handlers; Zod schema validation at boundary; user-friendly error messages in responses.

**Patterns:**
- API routes wrap logic in try-catch, return `NextResponse.json({ error: "message" }, { status: 4xx })`
- Zod schemas validate input early; parse failures return `400 Bad Request`
- External API errors (Codef, LLM) caught and logged; user receives generic "일시적 오류" message
- Database errors logged via Sentry; user receives appropriate HTTP status code
- Client components display error boundaries and retry UI

## Cross-Cutting Concerns

**Logging:** 
- Server-side: Sentry for errors; custom `ActivityStore` for business events
- Client-side: `/api/logs/*` endpoints (exploration, quote-view, recommendation events)
- Sensitive data scrubbed via `src/lib/sentry-scrubber.ts` before transmission

**Validation:**
- Input: Zod schemas at API route boundaries (`src/lib/validators/`, `src/lib/validations/`)
- Database: Prisma enforces schema constraints
- Business logic: Manual validation in quote calculator (e.g., vehicle price range checks)

**Authentication:**
- Public pages: None (anonymous access)
- Admin pages: JWT cookie validated in middleware, redirects to `/admin/login` if missing
- Public APIs: Rate limiting only (no user auth required)
- Admin APIs: JWT validation in middleware

---

*Architecture analysis: 2026-05-04*
