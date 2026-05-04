# Coding Conventions

**Analysis Date:** 2026-05-04

## Naming Patterns

**Files:**
- React components: PascalCase (e.g., `Button.tsx`, `QuotationTable.tsx`)
- Utilities and services: camelCase (e.g., `quote-calculator.ts`, `admin-auth.ts`)
- Type files: camelCase (e.g., `quote.ts`, `admin.ts`)
- Test files: Same name as source + `.test.ts` or `.spec.ts` suffix (e.g., `security.test.ts`, `admin.spec.ts`)
- Directories: kebab-case for organizational dirs (e.g., `trim-manager`, `audit-logs`), feature-based naming for feature dirs (e.g., `admin`, `recommend`, `quotations`)

**Functions:**
- Public functions: camelCase (e.g., `calculateMultiFinanceQuote`, `getRateFromMatrix`, `getInterpolatedRate`)
- Private/internal functions: camelCase with leading underscore optional, typically internal (e.g., `_resetKeyCacheForTesting`)
- Async functions: Standard camelCase, no special prefix (e.g., `getDashboardData`, `createAdminNotification`)
- Component functions: PascalCase (e.g., `DashboardClient`, `QuotationTable`)
- Hook-like utilities: camelCase with functional naming (e.g., `useDebounce`, `useTracking`)

**Variables:**
- Constants: UPPER_SNAKE_CASE for module-level constants (e.g., `TEST_KEY`, `OTHER_KEY`, `DEFAULT_LIMIT = 100`)
- Type/interface generic parameters: PascalCase single letters (e.g., `<T>`, `<U>`)
- DOM references and React refs: camelCase (e.g., `debouncedValue`, `profileSuccess`)
- Enum values: PascalCase or UPPER_SNAKE_CASE per enumeration (e.g., `QuoteStatus.NEW`, `status: "NEW"`)
- Database/API response fields: camelCase in TypeScript, snake_case optionally in database/API docs (e.g., `monthlyPayment`, `contractMonths`, `customerType`)

**Types:**
- Interfaces: PascalCase (e.g., `ButtonProps`, `CalcInput`, `FinanceQuoteResult`, `VehicleListItem`)
- Type aliases: PascalCase (e.g., `ButtonVariant`, `ButtonSize`, `RateSheetKey`)
- Zod schemas: camelCase with `Schema` suffix (e.g., `inventoryCreateSchema`, `vehicleUpdateSchema`, `aiConfigUpdateSchema`)
- Re-exported type utilities: PascalCase (e.g., `Readonly`, `Record`)

**IDs/Keys:**
- User/Entity IDs: lowercase with hyphens for prefixed IDs (e.g., `sessionId`, `userId`, `vehicleId`, `fc_mock_1`)
- Rate matrix keys: Pattern-based (e.g., `"36_10000"` for 36 months, 10,000 km)
- Database keys/slugs: kebab-case (e.g., `kia-ev9`, `trim-name`)
- Environment variable names: UPPER_SNAKE_CASE (e.g., `NEXT_PUBLIC_APP_URL`, `PII_ENCRYPTION_KEY`, `ADMIN_ACCESS_TOKEN`)

## Code Style

**Formatting:**
- No Prettier config detected; follows Next.js 16 defaults
- TypeScript strict mode enabled in `tsconfig.json`
- ESLint 9 with `eslint-config-next` (core-web-vitals + typescript presets)
- Code is formatted with 2-space indentation (inferred from source files)

**Linting:**
- Configuration: `eslint.config.mjs` (flat config format)
- Custom rules:
  - `@typescript-eslint/no-empty-object-type`: warn
  - `@typescript-eslint/no-explicit-any`: warn
  - `react-hooks/set-state-in-effect`: warn
  - `react-hooks/set-state-in-render`: warn
- Ignored paths: `.next/**`, `node_modules/**`, `out/**`, `build/**`, `scratch/**`
- Special ignored file: `src/app/(admin)/admin/inventory/generate-mock.ts`

**TypeScript Strictness:**
- `strict: true` enforced in `tsconfig.json`
- `noEmit: true` for type checking
- `isolatedModules: true` for bundler compatibility
- `skipLibCheck: true` to speed up type checking
- Path aliases: `@/*` maps to `./src/*`

## Import Organization

**Order (observed pattern):**
1. External dependencies (React, Next.js, third-party libraries)
2. Internal type imports (`type { ... } from "@/types/..."`)
3. Internal utility/lib imports (`from "@/lib/..."`)
4. Local component imports (`from "@/components/..."`)
5. Constants imports (from `@/constants/...`)

**Example from `/src/app/api/quotes/route.ts`:**
```typescript
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { createAdminNotification } from "@/lib/admin-notification";
import { isCustomerType } from "@/constants/customer-types";
```

**Path Aliases:**
- `@/*` → `src/*` (configured in `tsconfig.json` and `vitest.config.mjs`)
- Used consistently across all imports

**Type Imports:**
- Explicit `type` keyword used for type imports to enable tree-shaking (e.g., `import type { CalcInput } from "./quote-calculator"`)

## Error Handling

**Pattern (API Routes):**
```typescript
// Try-catch with structured error response
try {
  // operation
  return NextResponse.json({ success: true, data: savedQuote });
} catch (error) {
  console.error("[CONTEXT_NAME]", error);
  return NextResponse.json(
    { error: "User-friendly error message" },
    { status: 500 }
  );
}
```

**Error Response Shape:**
- Success: `{ success: true, data: T }`
- Error: `{ error: string }` with appropriate HTTP status code (typically 400, 401, 403, 404, 500)

**Validation Errors:**
- Use `safeParse()` from Zod schemas to avoid throwing
- Check `.success` flag before accessing `.data` or `.error`

**Logging Pattern:**
- Error context logged as `[ROUTE_OR_FUNCTION_NAME]` prefix
- Example: `console.error("[POST /api/quotes]", error);`

## Validation

**Framework:** Zod (`zod: ^3.23.8` in dependencies)

**Pattern:**
- All schemas defined in `src/lib/validations/` (e.g., `admin.ts`, `user.ts`)
- Exported with `Schema` suffix (e.g., `inventoryCreateSchema`, `trimUpdateSchema`)
- Partial updates use `.partial()` method
- Test coverage for each schema in co-located `.test.ts` files

**Example from `/src/lib/validations/admin.ts`:**
```typescript
export const vehicleCreateSchema = z.object({
  name: z.string().min(1, "차량명을 입력하세요"),
  brand: z.string().min(1, "브랜드를 입력하세요"),
  category: z.enum(["세단", "SUV", "밴", "트럭"]),
  basePrice: z.number().int().positive("기준가는 양수여야 합니다"),
  // ...
});

export const vehicleUpdateSchema = vehicleCreateSchema.partial();
```

**Validation at Boundaries:**
- All API route POST/PATCH bodies validated with Zod before processing
- Client-side form validation uses same schemas with `.parse()` or `.safeParse()`

## State Management

**React:**
- `useState` for component-level state (e.g., `const [loading, setLoading] = useState(false)`)
- `useEffect` for side effects with dependency arrays
- State updates are immutable (spread operator used for updates)

**Server Components:**
- Async functions directly in `page.tsx` to fetch data (SSR pattern)
- Example from `/src/app/(public)/page.tsx`: `export const revalidate = 600` for ISR (Incremental Static Regeneration)

**Global State:**
- Supabase auth state via `createClient()` in server/client contexts
- Admin session state via `getAdminSession()` utility

**Data Caching:**
- `revalidatePath()` used to invalidate cache after mutations
- Example: After quote creation, admin page revalidated to show new quote

## Comments

**Language:** Primarily Korean with technical terms in English
- JSDoc/TSDoc blocks in Korean for complex functions
- Line comments in Korean explaining business logic

**When to Comment:**
- Complex calculations (especially financial formulas)
- Non-obvious algorithm steps
- Business rule context (e.g., rate calculation formulas)
- Database/API quirks
- Migration notes (e.g., encryption compatibility in PII tests)

**JSDoc/TSDoc Pattern:**
```typescript
/**
 * 견적 계산 엔진 — 회수율(Recovery Rate) 기반
 *
 * 핵심 공식:
 *   기준 대여료 = 차량가 × 회수율
 *   보증금 적용 = ...
 */

/** 차량 실제 가격으로 min·max 사이를 선형보간한 회수율 반환 */
function getInterpolatedRate(config: RateConfigData, ...): number
```

**Section Dividers:**
- Use `// ─── Section Name ──────────────────────────────────────────` format (observed in `quote-calculator.ts`)

## Function Design

**Size Guidelines:**
- Typical range: 20-60 lines
- Larger functions (>100 lines) found only for complex business logic (e.g., `calculateMultiFinanceQuote` at 80 lines, `quote-pdf-template.ts` at 394 lines)

**Parameters:**
- Single object parameter for functions with 3+ parameters (destructuring in function signature)
- Typed explicitly with interfaces (e.g., `CalcInput`, `RateConfigData`)

**Return Values:**
- Explicit return types on all public/exported functions
- Use `null` for "not found" cases, not `undefined` in most API contexts
- Return objects for multiple values (e.g., `{ monthly, depositAmount, discount }`)

**Immutability:**
- All calculations produce new values, no in-place mutations
- Example: `return { ...user, name };` pattern used for updates
- Destructuring used to avoid modifying inputs

## Module Design

**Exports:**
- Named exports for most utilities and types
- Default exports only for Next.js pages and layouts
- Example: `export { Button, type ButtonProps, type ButtonVariant, type ButtonSize }`

**Barrel Files:**
- Not heavily used; imports are typically direct from modules
- Some component libs may re-export (observed in UI components)

**Module Cohesion:**
- Utility files (lib): Single responsibility, focused on one domain
- Examples: `quote-calculator.ts` (only quote math), `pii.ts` (only encryption/decryption)
- Component files: Single component per file, sometimes with co-located types

## React Component Patterns

**Props Definition:**
- Named interface for all component props (e.g., `ButtonProps`, `CardProps`)
- Props interface extends native HTML element attributes where applicable
- Example from `/src/components/ui/Button.tsx`:
```typescript
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  asChild?: boolean;
}
```

**ForwardRef:**
- Used for UI components that need ref access (e.g., `Button`, `Card`)
- Pattern: `const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ ...props }, ref) => { ... })`
- Must set `displayName` for debugging

**Server vs Client:**
- Server components (default) for data fetching pages
- `'use client'` directive used for interactive components
- Clear separation maintained (e.g., `DashboardClient.tsx` for client logic, `page.tsx` for server fetch)

---

*Convention analysis: 2026-05-04*
