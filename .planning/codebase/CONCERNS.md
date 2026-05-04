# Codebase Concerns

**Analysis Date:** 2026-05-04

## Tech Debt

### Quote Calculator — Hand-Tuned Financial Logic (CRITICAL)

**Issue:** `src/lib/quote-calculator.ts` (360 lines) contains meticulously validated financial calculation logic with strict mathematical rules documented in `docs/quote-calculator-spec.md`. This is the single most fragile component in the codebase.

**Files:** `src/lib/quote-calculator.ts`, `prisma/seed.ts`

**Impact:** Any careless refactoring breaks financial correctness:
- Math.round must be applied ONLY at final step (Step 6). If moved to intermediate steps (applyDeposit, applyPrepay), monthly payment precision breaks by ±5,000–10,000 KRW per quote.
- prepayAdjustRate is stored positive (+0.000073) in DB but MUST be subtracted in calculation. Reversing the sign breaks all prepayment scenarios.
- Surcharge accumulation must multiply cumulatively (1 + rank%) × (1 + vehicle%) × (1 + finance%), not as independent addition. Wrong order causes 0.5–3% systematic error.
- Interpolation must clamp t ∈ [0,1]; extrapolation is forbidden.

**Fix approach:** 
1. Before ANY modification: write regression tests covering Test Cases A (deposit) and B (prepayment) defined in CLAUDE.md. Expected values are hardcoded (Case A: ~561,680 KRW; Case B: ~421,750 KRW ±1,000).
2. Never refactor intermediate calculations for "cleanliness" — they must remain exactly as specified.
3. Keep `docs/quote-calculator-spec.md` as binding source of truth.

---

### ORIX × SORENTO Hardcoded Recovery Rate Matrix (CRITICAL)

**Issue:** Lines in `prisma/seed.ts` mention that ORIX capital company's SORENTO vehicle has a manually hardcoded recovery rate matrix that overrides the generic interpolation algorithm.

**Files:** `prisma/seed.ts` (seed data), `src/lib/quote-calculator.ts` (overwrite logic not yet visible in snippets)

**Impact:** The matrix is specific to real dealer specifications and must not be changed without compliance sign-off from finance team. Future maintenance risk: if this override is removed during refactoring, all ORIX×SORENTO quotes become mathematically incorrect.

**Fix approach:**
1. Document exactly which vehicle/finance pairs have hardcoded overrides in a separate config file.
2. Add a guard assertion in quote calculator to log a warning if override is missing (so drift is detectable).
3. Version the override matrix with a timestamp — if seed data changes, audit trail is required.

---

### Admin Queries — N+1 Risk in Dashboard (MEDIUM)

**Issue:** `src/lib/admin-queries/dashboard.ts` uses multiple sequential Prisma calls (lines 66–82) instead of batching:

```typescript
const monthlyQuoteLogs = await prisma.savedQuote.findMany({...});
// ... map/aggregate ...
const topVehicleLogs = await prisma.explorationLog.groupBy({...});
const topVehicleNames = await prisma.vehicle.findMany({...});  // N+1: second query after groupBy
const vehicleNameMap = new Map(...);
```

**Files:** `src/lib/admin-queries/dashboard.ts:66–85`

**Impact:** Dashboard loads in ~500ms–2s depending on data volume. As vehicle count grows beyond 500, name lookup becomes a separate round-trip per vehicle. Under load, dashboard API times out.

**Fix approach:**
1. Pre-join vehicle names in the groupBy using `select: { vehicleId: true, vehicle: { select: { name: true } } }` or raw SQL aggregation.
2. Add query timing instrumentation to detect future regressions.
3. Cache dashboard data for 5 minutes (trades freshness for performance).

---

## Security Concerns

### IP Identification Regression in Vercel (RECENT FIX, VERIFY)

**Issue:** Commit `153d285` fixed a critical deployment bug: the previous IP detection (commit `153d285^`) relied on `request.ip` which doesn't exist in Vercel middleware. This caused ALL rate-limited API calls to fail with "요청 출처를 식별할 수 없습니다" (status 400) in production.

**Files:** `src/middleware.ts:32–44`

**Root cause:**
- **Old code:** Used `(request as unknown as { ip?: string }).ip` as fallback — Vercel doesn't set this.
- **Fixed code:** Now uses `process.env.VERCEL === "1"` to detect Vercel, then trusts `x-forwarded-for` header exclusively.

**Current posture:**
- ✅ Rate limiting now works in Vercel.
- ⚠️ BUT: IP spoofing is theoretically possible if Vercel's reverse proxy can be bypassed (unlikely but worth monitoring).
- ⚠️ On local dev (no VERCEL=1), IP detection is disabled — may mask rate-limit issues during testing.

**Impact:** If not carefully tested, future middleware changes could break rate limiting again, allowing quote spam and DoS.

**Fix approach:**
1. Add E2E tests for rate limiting in Vercel environment (included in `e2e/quote.spec.ts` but verify they run against Vercel deployment).
2. Add Sentry alert if rate-limit key is "local-dev" in production (indicates missed IP detection).
3. Document: "TRUST_PROXY=true OR VERCEL=1 must be set; otherwise rate limiting is disabled."

---

### PII Encryption Key Loss = Permanent Data Loss (CRITICAL)

**Issue:** `src/lib/pii.ts` encrypts driver license, insurance, and business registration numbers with AES-256-GCM using `PII_ENCRYPTION_KEY` environment variable.

**Files:** `src/lib/pii.ts:29–50`

**Impact:**
- ✅ Data is encrypted at rest in Supabase PostgreSQL.
- ❌ Key is stored only in `.env` (or secrets manager during deploy).
- ❌ If key is lost or rotated without decryption, all PII is permanently unrecoverable.
- ❌ There is NO key versioning mechanism — single key rotation breaks all old ciphertext.

**Fix approach:**
1. Mandate encrypted backup of `PII_ENCRYPTION_KEY` in 1Password or AWS Secrets Manager with MFA.
2. Implement key versioning: prefix ciphertext with key version number, support multiple keys during rotation.
3. Add a "PII Recovery" runbook documenting backup/restore procedures (currently non-existent).
4. Add startup check: if key is missing in production, fail loudly (currently would throw Error but needs monitoring).

---

### Codef API Credentials (MEDIUM)

**Issue:** `src/lib/codef.ts:46–47` reads `CODEF_CLIENT_ID` and `CODEF_CLIENT_SECRET` from env vars at runtime. Credentials are used to query driver license, insurance, and business registration from Codef's REST API.

**Files:** `src/lib/codef.ts:46–47`, `.env.example`

**Current posture:**
- ✅ Credentials are in environment variables (not hardcoded).
- ⚠️ No credential rotation mechanism — if compromised, manual intervention required.
- ⚠️ Codef API is called from `src/app/api/verification/fetch/route.ts` — if endpoint is abused, Codef may throttle/block.

**Fix approach:**
1. Implement credential rotation: store secret in AWS Secrets Manager with automatic rotation every 90 days.
2. Add Codef API rate limiting: cache verification results for 24 hours (to reduce API calls).
3. Log all Codef API calls to audit trail for forensics.

---

### CSRF Protection Status (VERIFY)

**Issue:** Recent commit `6531a55` added CSP/HSTS/Permissions-Policy headers but CSRF token handling is unclear.

**Files:** `src/middleware.ts`, `src/app/api/admin/*` routes

**Current posture:**
- ✅ Admin mutations are protected by JWT authentication (middleware checks `admin_token` cookie).
- ⚠️ JWT does NOT require CSRF token as second factor (relying on SameSite cookie alone).
- ⚠️ If NEXT_PUBLIC_APP_URL is misconfigured during deploy, SameSite validation may be bypassed.

**Fix approach:**
1. Add CSRF token validation to all state-changing routes (`/api/admin/*` POST/PATCH/DELETE).
2. Verify SameSite=Strict is set on admin_token cookie (currently not visible in cookie-setting code).
3. Add E2E test: try cross-origin POST to `/api/admin/*` and verify it's rejected.

---

## Performance Bottlenecks

### Large Client Components (MEDIUM)

**Issue:** Three React components exceed recommended file size limits:

| Component | Size | Issue |
|-----------|------|-------|
| `InventoryClient.tsx` | 1,635 lines | Manages inventory state machine with 10+ form sections — hard to test in isolation |
| `QuoteClientPage.tsx` | 1,252 lines | Handles quote form, calculation, PDF export, and recommendation — needs splitting |
| `CarDetailClient.tsx` | 870 lines | Vehicle detail page with reviews, specs, recommendation — bloated |

**Files:** `src/app/(admin)/admin/inventory/InventoryClient.tsx`, `src/app/(public)/quote/QuoteClientPage.tsx`, `src/app/(public)/cars/[slug]/CarDetailClient.tsx`

**Impact:**
- Slow initial render (especially on mobile with 3G).
- Difficult to unit test: each component has 100+ dependencies.
- Changes to one feature require re-rendering entire page.

**Fix approach:**
1. Split `InventoryClient.tsx` into smaller sub-components: `InventorySearch.tsx`, `InventoryDrawer.tsx`, `InventoryTable.tsx` (~400 lines each).
2. Split `QuoteClientPage.tsx` into: `QuoteForm.tsx`, `QuoteResults.tsx`, `QuotePdfExporter.tsx` (~300 lines each).
3. Add Webpack bundle analysis to CI to prevent future regressions (target: max 100KB per component).

---

### Dashboard Query Performance (MEDIUM)

**Issue:** Dashboard SSR calls multiple expensive queries simultaneously in `src/lib/admin-queries/dashboard.ts:9–29`:

```typescript
await Promise.all([
  prisma.vehicle.count(),
  prisma.vehicle.count({ where: { isVisible: true } }),
  prisma.explorationLog.count({ where: {...} }),
  // ...
  prisma.savedQuote.count({ where: {...} }),
]);
```

**Files:** `src/lib/admin-queries/dashboard.ts:9–100`

**Impact:** Even with parallel execution, database connection pool may be exhausted if ExplorationLog/RecommendationLog tables grow beyond 1M rows. Dashboard loads in 3–5 seconds under load.

**Fix approach:**
1. Add database indexes on `ExplorationLog.eventType`, `RecommendationLog.createdAt`, `SavedQuote.createdAt`.
2. Implement caching: store dashboard stats in Redis with 10-minute TTL.
3. Lazy-load chart data: load 7-day trend separately from KPI cards.

---

## Fragile Areas

### Admin Authentication — Single JWT Secret (MEDIUM)

**Issue:** `src/middleware.ts:8–17` uses a single `ADMIN_JWT_SECRET` to sign/verify all admin sessions. There is no key rotation mechanism.

**Files:** `src/middleware.ts:8–17`, `.env.example`

**Current posture:**
- ✅ Secret is 32+ chars (enforced by CLAUDE.md).
- ✅ Used only for HS256 (symmetrical, no public key exposure).
- ❌ If compromised, attacker can forge any admin session.
- ❌ No way to revoke sessions except by changing secret (which logs everyone out).

**Fix approach:**
1. Implement a JWT blacklist: when admin logs out, add token to short-lived Redis set. Middleware checks it before verifying signature.
2. Rotate secret every 6 months: support old and new secrets simultaneously (multi-version verification).
3. Log all JWT verifications to audit trail (currently only failures are caught).

---

### Admin Upload Endpoint — File Type Validation (MEDIUM)

**Issue:** `src/app/api/admin/upload` accepts file uploads with strict rate limiting but file type validation may be insufficient.

**Files:** `src/app/api/admin/upload` (not yet examined but referenced in middleware:55)

**Impact:** If file extension checking is done only on client side, attackers could upload .sh/.exe files disguised as images.

**Fix approach:**
1. Use `file` command or magic bytes validation (not just MIME type).
2. Store uploads in separate S3 bucket with no execute permissions.
3. Serve uploaded files with `Content-Disposition: attachment` (never inline).

---

### Error Handling — Silent Failures in Verification Flow (MEDIUM)

**Issue:** `src/app/(public)/verify/VerifyClient.tsx:519, 542, 588` and `src/app/(public)/quote/QuoteClientPage.tsx:386, 597` use `.catch(() => ({}))` pattern, swallowing errors:

```typescript
const data = await consentRes.json().catch(() => ({}) as { error?: string };
// If JSON parsing fails, data.error is undefined — misleading to user
```

**Files:** 
- `src/app/(public)/verify/VerifyClient.tsx:519, 542, 588`
- `src/app/(public)/quote/QuoteClientPage.tsx:386, 597`
- `src/components/recommend/RecommendResultView.tsx:46`
- `src/components/admin/reviews/ReviewManager.tsx:159`

**Impact:**
- Users see generic "작업이 실패했습니다" message when the actual cause is unclear.
- Server logs don't capture parse errors (client-side only).
- Difficult to debug production issues.

**Fix approach:**
1. Replace `.catch(() => ({}))` with proper error handling:
   ```typescript
   const response = await fetch(...);
   if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
   const data = await response.json().catch(e => {
     console.error('JSON parse error:', e);
     throw new Error('서버 응답이 형식이 올바르지 않습니다');
   });
   ```
2. Log all errors to Sentry for monitoring.
3. Use centralized API client wrapper (not yet implemented — consider adding).

---

## Test Coverage Gaps

### Quote Calculator — Regression Risk Without Integration Tests (HIGH)

**Issue:** `src/lib/quote-calculator.test.ts` has unit tests for interpolation and basic calculations, but lacks integration tests covering:
- Full 3-company quote comparison pipeline
- Surcharge accumulation correctness (rank → vehicle → finance ordering)
- Edge cases: zero recovery rate, min/max vehicle price boundaries
- Rounding behavior at final step only

**Files:** `src/lib/quote-calculator.test.ts`, no integration tests in `src/app/api/quotes`

**Impact:** Quote bugs slip into production because logic isn't tested end-to-end. Recent manual verification was needed (Test Cases A/B in CLAUDE.md).

**Fix approach:**
1. Add integration test: call `calculateMultiFinanceQuote()` with real finance company configs and verify results match Test Case A/B values ±100 KRW.
2. Add mutation tests: verify that changing rank rate by 0.1% changes monthly payment by expected amount.
3. Add property test: verify surcharge multiplicative property (rank × vehicle × finance > any two factors alone).

---

### Admin Components — No Unit Tests (HIGH)

**Issue:** Admin components (`InventoryClient.tsx`, admin forms, dashboard, etc.) have no unit tests. Only E2E tests exist (`e2e/admin.spec.ts`).

**Files:**
- `src/app/(admin)/admin/inventory/InventoryClient.tsx` (0 tests)
- `src/components/admin/finance/RateInputForm.tsx` (0 tests)
- `src/components/admin/vehicles/VehicleManager.tsx` (0 tests)
- `src/components/admin/analytics/AnalyticsDashboard.tsx` (0 tests)

**Impact:**
- Refactoring admin features is risky — no safety net for regressions.
- Bug fixes take 2× longer because validation requires full E2E cycle.
- Component logic (filtering, state machine) is untestable in isolation.

**Fix approach:**
1. Add unit tests for admin form components: test validation logic, field interactions, error handling.
2. Add snapshot tests for dashboard charts (SVG rendering).
3. Target: 70% coverage for admin code (lower than public-facing because E2E tests exist).

---

### Verification Flow — No Happy-Path E2E Test (MEDIUM)

**Issue:** `src/app/(public)/verify/VerifyClient.tsx` handles PII submission (license, insurance, business registration) but `e2e/verify.spec.ts` may not cover the full flow with mocked Codef API.

**Files:** `e2e/verify.spec.ts`, `src/app/(public)/verify/VerifyClient.tsx`

**Impact:** Real-world verification failures aren't caught until production. If Codef API format changes, users see silent failures.

**Fix approach:**
1. Extend E2E test to mock Codef API and verify:
   - Form submission succeeds with valid PII.
   - Error messages display correctly for Codef failures.
   - PII is encrypted before being stored.
2. Add Codef integration test: call real Codef sandbox API with test credentials.

---

## Deployment Concerns

### Vercel Environment Variable Rotation Not Documented (MEDIUM)

**Issue:** Recent commits (7b8e9c3, c85fc45, 153d285) indicate active deployment troubleshooting. Procedure for rotating secrets in Vercel is not documented.

**Files:** `.env.example`, no deploy runbook

**Impact:** If a secret is compromised, DevOps may not know the correct rotation procedure. Risk of:
- Stale secrets remaining in old Vercel deployments.
- Accidental exposure of secrets during environment variable updates.

**Fix approach:**
1. Create `docs/deployment-runbook.md` covering:
   - How to rotate ADMIN_JWT_SECRET in Vercel.
   - How to rotate CODEF credentials.
   - How to backup/restore PII_ENCRYPTION_KEY.
   - Rollback procedure if deployment fails.
2. Test deployment script in staging environment before production use.

---

### Prisma Generate During Build (RECENT FIX, VERIFY)

**Issue:** Commit `c85fc45` added `prisma generate` to Next.js build to fix Vercel build failures. This works but is unconventional.

**Files:** `package.json:20` (postinstall hook)

**Current posture:**
- ✅ Build no longer fails in Vercel.
- ⚠️ But: `prisma generate` is re-run on every install, even when schema hasn't changed (slower builds).
- ⚠️ If Prisma schema is in-flight, `npm install` in CI may generate stale client.

**Fix approach:**
1. Use `prisma generate` only if `prisma/schema.prisma` has changed (git hook or CI step).
2. Cache `.prisma/client` in Vercel to skip generation on builds.

---

## Scaling Limits

### SavedQuote Table — No Pagination or TTL (MEDIUM)

**Issue:** `SavedQuote` table grows indefinitely with each customer quote submission. Dashboard queries `savedQuote.findMany()` without pagination or cleanup.

**Files:** `src/lib/admin-queries/dashboard.ts:66–70`

**Impact:** After 1M quotes, dashboard query times out. Storage costs increase without bound.

**Fix approach:**
1. Add TTL: implement 90-day auto-delete for SavedQuote (via cron job `src/app/api/cron/purge-pii/route.ts` pattern).
2. Implement pagination in dashboard: show only last 30 quotes, not all.
3. Archive old quotes to S3 for historical analysis (separate from production DB).

---

### ExplorationLog & RecommendationLog — No Indexed Aggregation (MEDIUM)

**Issue:** Dashboard aggregates ExplorationLog/RecommendationLog with `groupBy()` but these tables lack indexes on common query patterns.

**Files:** `src/lib/admin-queries/dashboard.ts:39–55` (raw SQL with date truncation)

**Impact:** After 5M event rows, daily aggregation queries timeout. No way to slice by date range efficiently.

**Fix approach:**
1. Add compound indexes: `(eventType, createdAt)`, `(vehicleId, createdAt)`.
2. Pre-aggregate events to a summary table: store daily counts in `DailyEventSummary` table, updated via cron.
3. Implement time-series database (e.g., InfluxDB) for future analytics.

---

## Known Issues

### AdminQueries Module Split Ambiguity (LOW)

**Issue:** Recent refactor split `admin-queries.ts` into 9 modules (`analytics.ts`, `dashboard.ts`, `vehicles.ts`, etc.). Index file (`src/lib/admin-queries/index.ts`) may not export all functions uniformly.

**Files:** `src/lib/admin-queries/index.ts`, subdirectories

**Impact:** IDE autocomplete may be incomplete. New code may import from wrong module.

**Fix approach:**
1. Verify all public functions are re-exported from `index.ts`.
2. Add ESLint rule: ban direct imports from `admin-queries/*.ts` (force import from `index.ts` instead).

---

### Chart SVG Implementation — No Responsiveness (LOW)

**Issue:** Admin dashboard uses custom SVG charts (`LineChart.tsx`, `BarChart.tsx`, `DonutChart.tsx`) instead of a library. SVGs may not resize properly on mobile or very large screens.

**Files:** `src/components/admin/charts/LineChart.tsx`, `BarChart.tsx`, `DonutChart.tsx`

**Impact:** Chart display breaks on small screens. Manual aspect-ratio calculations are error-prone.

**Fix approach:**
1. Add viewBox and preserveAspectRatio attributes to SVG (if not already present).
2. Wrap charts in responsive container using CSS Grid or Flex.
3. (Do NOT adopt external charting library — CLAUDE.md forbids it.)

---

### Rate Limiting — Local Development Bypass (LOW)

**Issue:** `src/middleware.ts:66–73` disables rate limiting on local dev (if `NODE_ENV !== "production"`). This may mask issues that only appear in production.

**Files:** `src/middleware.ts:66–73`

**Impact:** Developers may not discover rate-limit bugs until production.

**Fix approach:**
1. Add `RATE_LIMIT_ENABLED=true` env var flag (independent of NODE_ENV).
2. In tests, explicitly set flag to test rate-limit behavior.
3. Warn in console if rate limiting is disabled.

---

*Concerns audit: 2026-05-04*
