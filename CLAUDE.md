# 아임딜러 프로젝트 — Claude 지침

## 프로젝트 개요

장기렌트/리스 견적 산출 플랫폼. Next.js 14 App Router + Prisma + PostgreSQL 기반.

---

## 🌐 출력 언어 규칙 (GSD 포함)

> 이 프로젝트의 모든 응답·메시지·문서·로그는 **한국어**로 출력한다.
> 특히 `/gsd-*` 계열 스킬·커맨드(예: `/gsd-plan-phase`, `/gsd-execute-phase`,
> `/gsd-debug`, `/gsd-progress`, `/gsd-ship` 등)를 실행할 때도 동일하게 적용된다.

### 적용 대상

- GSD 워크플로우의 **진행 상태 메시지**, **단계별 요약**, **질문 프롬프트**, **최종 보고**
- 서브에이전트(`gsd-planner`, `gsd-executor`, `gsd-debugger`, `gsd-verifier` 등)가
  생성하는 `PLAN.md`, `RESEARCH.md`, `REVIEW.md`, `VERIFICATION.md` 등
  `.planning/` 산출물의 본문 서술
- 커밋 메시지 본문, PR 설명, 인라인 진행 보고

### 예외 (영어 유지)

다음 항목은 의미 보존을 위해 원문(영어)을 유지한다.

- 코드 식별자: 함수명, 변수명, 타입명, 파일 경로, CLI 플래그
- 외부 라이브러리·툴 명칭, 에러 메시지 원문, 로그 키
- 표준 용어(예: `commit`, `PR`, `merge`, `rebase`, `RFC`)
- 인용된 명령어·코드 블록·스택 트레이스

### 번역 원칙

- 영어 산출물을 그대로 출력하지 말고, 사용자에게 보이기 전에 **한국어로 번역**한 뒤 노출한다.
- 기술 용어는 한글 표기 + 괄호 영문 병기를 허용한다 (예: "회복률(recovery rate)").
- 번역 때문에 정확성이 흔들리는 핵심 규칙·식별자는 영어를 그대로 두고 한국어로 부연 설명한다.

---

## 🚨 견적 계산 로직 — 절대 규칙

> `src/lib/quote-calculator.ts`를 수정할 때 반드시 아래 규칙을 지켜야 한다.
> 이 파일의 로직은 실제 금융 명세에 맞게 검증된 상태다. 임의로 변경하지 마라.

### 1. Math.round 적용 위치

**최종 단계(가산 합산 직후)에서만 `Math.round` 적용.**
중간 단계(기준 대여료, 보증금/선납금 적용 대여료, 가산 월 추가금)는 반드시 float을 유지해야 한다.

```
❌ 잘못된 예:
  return Math.round(vehiclePrice * recoveryRate);   // calcBaseMonthly
  const monthly = Math.round(vehiclePrice * adjustedRate);  // applyDeposit

✅ 올바른 예:
  return vehiclePrice * recoveryRate;               // float 유지
  const monthly = vehiclePrice * adjustedRate;      // float 유지
  const monthlyPayment = Math.round(monthlyBeforeSurcharge + totalSurchargeRaw);  // 최종만 반올림
```

### 2. 보증금 / 선납금 부호 규칙

**보증금(`depositDiscountRate`) — 음수만 허용 (Deposit Discount 전용).**
- DB·시드·어드민 입력 모두 0 또는 음수.
- 양수가 산출되는 입력은 어드민 API에서 400 으로 거부한다.

**선납금(`prepayAdjustRate`) — 부호 자유 (양수=가산, 음수=할인).**
- DB에 부호 그대로 저장하고, 계산식에서도 **그대로 반영**해야 한다.

```
✅ 올바른 공식 (선납금):
  monthly = baseMonthly - (prepayAmount / contractMonths) + (vehiclePrice × prepayAdjustRate × steps)

❌ 잘못된 예 (- 로 빼면 부호 의미가 뒤집힘):
  monthly = baseMonthly - (prepayAmount / contractMonths) - (vehiclePrice × prepayAdjustRate × steps)
```

### 3. 가산율 계산 — 차량가 기준 합산

**순위·차량·금융사 가산은 누적 곱셈이 아니라 차량가 기준 분할 합산이다.**
누적 곱셈은 금지.

```
월 추가금(i)   = (차량가 × 가산율_i / 100) ÷ 계약개월수
최종 대여료    = 보증금/선납금 적용 대여료
              + 월 추가금(순위) + 월 추가금(차량) + 월 추가금(금융사)
```

```
✅ 올바른 예:
  const perMonth = (rate) => (vehiclePrice * rate / 100) / contractMonths;
  const monthlyPayment = Math.round(
    monthlyBeforeSurcharge
    + perMonth(rankRate)
    + perMonth(vehicleSurchargeRate)
    + perMonth(financeSurchargeRate)
  );

❌ 잘못된 예 (누적 곱셈):
  const afterRank    = monthly × (1 + rankRate/100);
  const afterVehicle = afterRank × (1 + vehicleSurchargeRate/100);
  const monthlyPayment = afterVehicle × (1 + financeSurchargeRate/100);
```

### 4. 선형보간 클램핑

`getInterpolatedRate` 에서 외삽(extrapolation) 불허. t를 [0, 1]로 클램핑해야 한다.

```typescript
const t = Math.max(0, Math.min(1, (x - x0) / (x1 - x0)));
```

### 5. 보증금 / 선납금 동시 적용 불가

둘 중 하나만 적용. `depositRate > 0`이면 보증금, `prepayRate > 0`이면 선납금.

---

## 시드 데이터 규칙 (`prisma/seed.ts`)

### 순위 가산율

| 순위       | 가산율   |
| ---------- | -------- |
| 1순위      | **1.0%** |
| 2순위      | **1.5%** |
| 3순위      | **2.0%** |
| 4순위 이상 | **2.5%** |

### 렌트 기준 할인율 (전 차량 공통)

| 항목                  | 값                            | 부호 의미             |
| --------------------- | ----------------------------- | --------------------- |
| `depositDiscountRate` | **-0.000523**                 | 음수만 허용(할인 전용) |
| `prepayAdjustRate`    | **-0.000073** (시드 기본 할인) | 양수=가산, 음수=할인  |

### ORIX × SORENTO 실제 회수율 (명세 기준 하드코딩)

일반 루프의 `generateRateMatrix`로 생성된 값은 ORIX × SORENTO에 한해 아래 실제값으로 덮어써야 한다.

- minVehiclePrice: 43,840,000
- maxVehiclePrice: 49,290,000

자세한 테이블은 `docs/quote-calculator-spec.md` 참조.

---

## 검증 케이스 (로직 수정 후 반드시 확인)

```
케이스 A (보증금):
  입력: 43,840,000원 / 2만km / 36개월 / 보증금 10%
  조건 대여료 기대값: ~561,680원

케이스 B (선납금):
  입력: 43,840,000원 / 1만km / 36개월 / 선납금 10%
  조건 대여료 기대값: ~421,750원 (±1,000원)

케이스 C (가산 합산 공식 — 차량가 기준 합산):
  입력: 차량가 50,000,000원 / 기본 월대여료 500,000원 / 48개월 / 가산율 1%
  월 추가금 기대값: (50,000,000 × 0.01) / 48 = 10,416.67원
  최종 월대여료 기대값: 500,000 + 10,417 = 510,417원

※ 조건 대여료 = 가산율 적용 전 monthlyBeforeSurcharge
```

---

## 🧭 AI 추천 엔진 구조

> 추천 점수 산출 로직은 `src/lib/recommend/` 의 순수 모듈로 분리되어 있다.
> 이 모듈들은 DB 접근 없이 입력 데이터만으로 동작하며, 독립적으로 테스트 가능하다.

### 핵심 모듈

| 파일 | 역할 |
| ---- | ---- |
| `vehicle-attributes.ts` | 차량/트림 → 속성 추출 (AWD·적재중량·냉장냉동·승차인원·연료·슬라이딩도어·안전사양·인기). 슬라이딩도어·안전사양은 차량명·트림명 자동검출 + `Vehicle.slidingDoorOverride` / `advancedSafetyOverride` (3-state: `null`=자동 / `true` / `false`) 보정. |
| `scoring-rules.ts` | 문서 가점을 데이터 테이블로 인코딩 (`INDUSTRY_RULES` / `PURPOSE_RULES` / `MILEAGE_FUEL_RULES` / `CARGO_RULES` / `CHILD_RULES` / `CHARGING_POINTS` / `FUEL_PREFERENCE_POINTS` / `REGION_RULES`). category는 SUV·세단·밴·트럭 4종뿐이므로 대형·프리미엄·경차 개념은 가격 프록시(`COMPACT_MAX` / `LARGE_MIN` / `OFFICIAL_MIN` / `OVER_LIMIT`)로 근사. |
| `scoring.ts` | 순수 함수 `scoreVehicle(input, attrs, ctx)`. BASE 50, 상한 250. |
| `ai-recommender.ts` | 오케스트레이터. DB 로드 → `buildVehicleAttrs` → `scoreVehicle` → 시나리오 계산 → LLM 추천 이유 생성. |

### 정합성 보장

- 규칙 라벨은 실제 선택지(`recommend-options.ts`)와 1:1 대응한다.
- `label-consistency.test.ts` 가 `scoring-rules.ts` ↔ `recommend-options.ts` 양방향 정합성을 강제한다. 규칙 추가 시 반드시 두 파일을 함께 수정해야 한다.

### 의도적 제외 항목

- **예산 × 차급 연동** — 현재 엔진은 예산 범위를 점수에 미반영 (후순위 과제).
- **재계약 고객 우대** — 재계약 이력 데이터 없음.
- **`industryDetail` 기반 가점** — 현재 선택지 설계상 미구현.
- **트렁크 용량(리터)** — DB 데이터 부족. 대형 SUV / 7인승 속성으로 대체.

### 전기차 보조금 처리

`Trim.evSubsidy` 는 **표기 전용** — 추천 점수 및 견적 계산에 미반영. 기존 견적 계산 규칙(위 섹션)과 독립적으로 유지한다.

---

## 🚨 어드민 페이지 — 절대 규칙

> `src/app/(admin)/`과 `src/components/admin/` 하위 파일을 수정할 때 아래 기준을 유지해야 한다.
> 전체 명세는 `docs/admin-spec.md` 참조.

### UI 색상 체계 (변경 금지)

- Primary: `#000666` (짙은 파랑)
- Accent: `#6066EE` (밝은 파랑)
- Background: `#F8F9FC`
- Dark Text: `#1A1A2E`
- Muted Text: `#9BA4C0`

### 데이터 흐름 패턴 (변경 금지)

- **초기 데이터**: SSR (`lib/admin-queries.ts`의 함수로 서버에서 fetch)
- **CRUD 작업**: 클라이언트 → API Route → Prisma

### 핵심 컴포넌트 보호 목록

| 컴포넌트           | 경로                                                 | 핵심 기능                                  |
| ------------------ | ---------------------------------------------------- | ------------------------------------------ |
| QuotationTable     | `src/components/admin/quotations/QuotationTable.tsx` | 견적 테이블 + 우측 Drawer + 서류 링크 복사 |
| VerificationResult | `src/components/admin/VerificationResult.tsx`        | 서류 확인 결과 (운전면허/보험/사업자)      |
| DashboardClient    | `src/components/admin/DashboardClient.tsx`           | KPI 카드 5개 + 차트 4종                    |
| VehicleManager     | `src/components/admin/VehicleManager.tsx`            | 차량 관리 3열 레이아웃                     |
| AnalyticsDashboard | `src/components/admin/AnalyticsDashboard.tsx`        | 30일 분석 데이터                           |

### 차트 구현 방식 (외부 라이브러리 도입 금지)

SVG 직접 구현 방식을 유지. Recharts 등 외부 차트 라이브러리 사용 금지.

- `LineChart.tsx` — SVG 라인 차트 (7일 트렌드)
- `BarChart.tsx` — SVG 바 차트 (월별)
- `DonutChart.tsx` — SVG 도넛 차트 (카테고리 분포)

### API Route 구조 (경로 변경 금지)

```
/api/admin/vehicles        GET(목록) POST(생성)
/api/admin/vehicles/[id]   GET PATCH DELETE
/api/admin/vehicles/[id]/trims          POST
/api/admin/vehicles/[id]/trims/[trimId] PATCH DELETE
/api/admin/trims/[trimId]/options          POST
/api/admin/trims/[trimId]/options/[optId]  PATCH DELETE
/api/admin/brands          GET
/api/admin/quotes          GET (페이지네이션)
/api/admin/dashboard/stats GET
/api/admin/analytics       GET
/api/verification/session/[sessionId]  GET (서류 확인 결과)
```

---

## 디렉토리 구조 (핵심)

```
src/
  lib/
    quote-calculator.ts   ← 견적 계산 엔진 (위 규칙 적용 대상)
    admin-queries.ts      ← SSR용 쿼리 함수 모음
    codef.ts              ← Codef API 연동 (서류 확인)
  app/
    (public)/
      cars/[slug]/        ← 차량 상세 페이지
      verify/             ← 고객 서류 동의/제출 플로우
    (admin)/admin/
      page.tsx            ← 대시보드
      analytics/          ← 데이터 분석
      quotations/         ← 관리자 견적/CRM 페이지
      vehicles/           ← 차량 목록
      vehicles/[id]/      ← 차량 상세 편집
    api/
      admin/              ← 어드민 API routes
      verification/       ← 서류 확인 API
  components/
    admin/
      AdminSidebar.tsx
      DashboardClient.tsx
      AnalyticsDashboard.tsx
      VerificationResult.tsx  ← 서류 확인 결과 컴포넌트
      charts/
        LineChart.tsx
        BarChart.tsx
        DonutChart.tsx
      quotations/
        QuotationTable.tsx
      vehicles/
        VehicleManager.tsx
        VehicleEditor.tsx
        VehicleDetail.tsx
        VehicleList.tsx
        BrandList.tsx
        VehicleInfoForm.tsx
        TrimManager.tsx
        OptionManager.tsx
    recommend/
      RecommendResultView.tsx
prisma/
  schema.prisma
  seed.ts                 ← 시드 데이터 (위 규칙 적용 대상)
```

# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
