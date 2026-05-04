# Testing Patterns

**Analysis Date:** 2026-05-04

## Test Framework

**Runner:**
- **Vitest** `^1.6.0` — configured in `vitest.config.mjs`
- **Playwright** `^1.59.1` — for E2E testing (Chromium only)

**Test Config:**
- Location: `vitest.config.mjs` (top-level)
- Environment: jsdom (browser environment simulation)
- Global APIs: Enabled (`globals: true`)
- Setup file: `setupTests.ts` (imports `@testing-library/jest-dom`)
- Excluded paths: `node_modules`, `.next`, `e2e/` (Playwright specs run separately)

**Assertion Library:**
- Vitest built-in expect (compatible with Jest API)
- `@testing-library/jest-dom` for DOM matchers

**Run Commands:**
```bash
npm run test              # Run all unit/integration tests (Vitest)
npm run test:watch       # Watch mode for development
npm run e2e              # Run Playwright E2E tests
npm run e2e:ui           # Run E2E tests with Playwright UI
npm run e2e:headed       # Run E2E tests in headed mode (visible browser)
```

**Playwright Configuration:**
- Location: `playwright.config.ts`
- Project: Chromium only
- Base URL: `http://localhost:3000` (or `E2E_BASE_URL` env var)
- Timeout: 30 seconds per test
- Expect timeout: 10 seconds
- Retries: 0 in local, 2 in CI
- Web server: Automatically starts dev server if not running

## Test File Organization

**Location Pattern:**
- **Unit/Integration tests:** Co-located with source file
  - `.test.ts` suffix for non-component utilities
  - `.test.tsx` suffix for component tests (if any exist)
- **E2E tests:** Separate `e2e/` directory at project root
  - Named `*.spec.ts` to distinguish from unit tests

**Example structure:**
```
src/
  lib/
    quote-calculator.ts
    quote-calculator.test.ts    ← Unit test
  components/
    ui/
      Button.tsx
e2e/
  quote.spec.ts                 ← E2E test
  admin.spec.ts                 ← E2E test
  verify.spec.ts                ← E2E test
```

**Files with Tests (observed):**
- `src/lib/quote-calculator.test.ts` — Exhaustive financial calculation tests
- `src/lib/security.test.ts` — Timing-safe string comparison
- `src/lib/pii.test.ts` — Encryption/decryption round-trip and tampering detection
- `src/lib/sentry-scrubber.test.ts` — PII masking for error reporting
- `src/lib/validators/korean.test.ts` — Korean phone/ID validation
- `src/lib/validations/admin.test.ts` — Zod schema validation for admin endpoints
- `e2e/*.spec.ts` — Playwright tests (3 golden-path flows)

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect } from "vitest";

describe("moduleName", () => {
  // Optional: Setup before all or each
  const mockRateConfig = { /* ... */ };
  const defaultInput = { /* ... */ };

  describe("feature/sub-area", () => {
    it("specific behavior description", () => {
      // Arrange
      const input = { ...defaultInput, depositRate: 30 };
      
      // Act
      const results = calculateMultiFinanceQuote(input);
      
      // Assert
      expect(results[0].baseMonthly).toBe(375000);
    });
  });

  describe("error cases", () => {
    it("throws when encryption key is missing", () => {
      delete process.env.PII_ENCRYPTION_KEY;
      _resetKeyCacheForTesting();
      expect(() => encryptPII({ x: 1 })).toThrow(/PII_ENCRYPTION_KEY/);
    });
  });
});
```

**Patterns (from actual codebase):**

1. **Setup and teardown:**
   - `beforeAll()` for expensive setup (e.g., key initialization)
   - `afterEach()` for cleanup (e.g., resetting cache, env vars)
   - No `beforeEach`/`afterAll` observed — minimal fixture overhead

2. **Test data:**
   - Mock objects defined at suite level (reused across tests)
   - Example from `quote-calculator.test.ts`:
     ```typescript
     const mockRateConfig: RateConfigData = { /* ... */ };
     const defaultInput: CalcInput = { /* ... */ };
     ```

3. **Assertion pattern:**
   - `.toBe()` for primitives and exact matches
   - `.toEqual()` for object/array deep equality
   - `.toHaveLength()` for array length checks
   - `.toBeGreaterThanOrEqual()`, `.toContain()` for numeric/string checks
   - `.toThrow(/regex/)` for error message matching

## Mocking

**Framework:** Vitest built-in mocking (not separately configured)

**No external mock library observed** — tests use:
- Test-specific utility functions (`_resetKeyCacheForTesting()`)
- Direct environment variable manipulation for config tests
- Inline mock objects for dependency injection

**Pattern for testing encryption with key rotation:**
```typescript
const TEST_KEY = randomBytes(32).toString("base64");
const OTHER_KEY = randomBytes(32).toString("base64");

beforeAll(() => {
  process.env.PII_ENCRYPTION_KEY = TEST_KEY;
  _resetKeyCacheForTesting();
});

afterEach(() => {
  process.env.PII_ENCRYPTION_KEY = TEST_KEY;
  _resetKeyCacheForTesting();
});

it("throws when decrypting with a different key", () => {
  const enc = encryptPII({ secret: "topsecret" });
  process.env.PII_ENCRYPTION_KEY = OTHER_KEY;
  _resetKeyCacheForTesting();
  expect(() => decryptPII(enc)).toThrow();
});
```

**What to Mock:**
- External APIs (Codef, Supabase) — typically mocked in E2E tests via fixtures/cookies
- Environment configuration (via `process.env` manipulation)
- Crypto operations (use real crypto for security tests, but control key rotation)

**What NOT to Mock:**
- Database queries (integration tests hit real DB or use transactions)
- Encryption/decryption logic (must be tested end-to-end)
- Schema validation (test with real Zod instances)
- Business logic calculations (financial formulas tested comprehensively)

## Fixtures and Factories

**Test Data Location:**
- Inline at suite level (no separate fixtures directory observed)
- Each test file defines its own `mockX` and `defaultX` constants

**Example from `/src/lib/validations/admin.test.ts`:**
```typescript
const valid = {
  vehicleSlug: "kia-ev9",
  trimName: "Earth",
  stockCount: 3,
  immediateDelivery: true,
};

it("accepts a valid payload", () => {
  expect(inventoryCreateSchema.safeParse(valid).success).toBe(true);
});

it("rejects negative or oversized stockCount", () => {
  expect(
    inventoryCreateSchema.safeParse({ ...valid, stockCount: -1 }).success
  ).toBe(false);
});
```

**Factory Pattern:**
- Spread operator used to create variations: `{ ...valid, fieldToChange: newValue }`
- No factory function library (simple and readable for small test data sets)

## Coverage

**Requirements:** Not explicitly enforced (no coverage tool configured)

**Coverage Present (estimated from observed tests):**
- **Critical calculation logic:** ~95% (quote-calculator, PII encryption)
- **Validation schemas:** ~90% (admin.ts, korean.ts)
- **Utilities:** ~85% (security, sentry-scrubber)
- **Integration/E2E:** Golden-path flows covered by Playwright

**View Coverage (if desired):**
No coverage commands in `package.json`. To add coverage:
```bash
npx vitest run --coverage
```

## Test Types

**Unit Tests:**
- **Scope:** Individual functions, validators, utilities
- **Approach:** Pure function testing with diverse inputs
- **Examples:**
  - `quote-calculator.test.ts` — Tests calculation formulas with deposit/prepay variations
  - `security.test.ts` — Tests timing-safe string comparison
  - `korean.test.ts` — Tests phone number and ID validation

**Integration Tests:**
- **Scope:** Zod schema validation, encryption/decryption round-trips
- **Approach:** Test module interfaces with real dependencies (crypto, JSON serialization)
- **Examples:**
  - `pii.test.ts` — Encrypts data, tests tampering detection, key rotation
  - `validations/admin.test.ts` — Tests Zod schemas accept/reject edge cases

**E2E Tests:**
- **Framework:** Playwright
- **Scope:** Critical user flows end-to-end
- **Approach:** Browser automation testing golden paths
- **Test Files:**
  - `e2e/quote.spec.ts` — Public quote flow (home → vehicle detail → quote scenario)
  - `e2e/admin.spec.ts` — Admin login → dashboard → vehicle list (read-only)
  - `e2e/verify.spec.ts` — Document verification form (3 steps, validation)

**E2E Golden Paths (from `e2e/` comments):**
- **Path A (Quote):** Home → Popular Vehicles → Vehicle Detail → Quote Scenarios
  - Validates: Hero section loads, vehicle cards link correctly, metadata dynamically generated, scenarios visible
- **Path B (Verify):** `/verify` form → Step 1 (Consent) → Step 2 (Customer Type) → Step 3 (Info Input)
  - Validates: Form progression, conditional fields (business ID for self-employed), validation feedback
- **Path C (Admin):** `/admin/login` (with cookie) → Dashboard → Vehicle List
  - Validates: Authentication, session handling, data loading (read-only, no mutations)

## Common Patterns

**Async Testing:**
```typescript
// Vitest handles async/await naturally
it("async operation resolves correctly", async () => {
  const result = await someAsyncFunction();
  expect(result).toBe(expectedValue);
});
```

**Error Testing:**
```typescript
it("throws with specific message", () => {
  expect(() => riskyFunction()).toThrow(/error message pattern/);
});

// For async errors:
it("rejects with specific error", async () => {
  await expect(riskyAsyncFunction()).rejects.toThrow(/pattern/);
});
```

**Schema Validation Testing:**
```typescript
it("accepts valid input", () => {
  expect(schema.safeParse(validData).success).toBe(true);
});

it("rejects invalid input with message", () => {
  const result = schema.safeParse(invalidData);
  expect(result.success).toBe(false);
  expect(result.error.issues[0].message).toContain("expected text");
});

// Or using .parse() to throw:
it("throws on invalid input", () => {
  expect(() => schema.parse(invalidData)).toThrow();
});
```

**Encryption Round-Trip Testing:**
```typescript
it("round-trips data without loss", () => {
  const original = { name: "홍길동", license: "12-34-567890-12" };
  const encrypted = encryptPII(original);
  const decrypted = decryptPII(encrypted);
  expect(decrypted).toEqual(original);
});

it("produces different ciphertext for same input (random IV)", () => {
  const a = encryptPII({ x: 1 });
  const b = encryptPII({ x: 1 });
  expect(a.ct).not.toBe(b.ct);
});
```

**E2E Navigation Testing (Playwright):**
```typescript
test("user can navigate from home to vehicle detail", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("AI 기반 진짜견적")).toBeVisible();
  
  const carLink = page.locator('a[href^="/cars/"]:not([href="/cars"])').first();
  const href = await carLink.getAttribute("href");
  
  await page.goto(href);
  await expect(page).toHaveTitle(/아임딜러$/);
  await expect(page.getByText(/월 납입금|만원/)).toBeVisible({ timeout: 15_000 });
});
```

## CI/CD Integration

**Playwright CI Configuration:**
- Runs in GitHub Actions (reporter: `github`, `html`)
- Parallelization: 1 worker (to avoid DB locks)
- Retries: 2 attempts per test
- Screenshots/videos: Retained on failure for debugging
- Base URL: Configurable via `E2E_BASE_URL` env var

**Environment Variables (Playwright):**
- `ADMIN_ACCESS_TOKEN` — Admin middleware knock token (required to skip admin tests if missing)
- `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` — Test admin account (falls back to `ADMIN_INITIAL_*`)
- `E2E_BASE_URL` — Override default localhost:3000

---

*Testing analysis: 2026-05-04*
