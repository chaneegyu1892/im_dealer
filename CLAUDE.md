# 아임딜러 프로젝트 — Claude 지침

## 프로젝트 개요

장기렌트/리스 견적 산출 플랫폼. Next.js 14 App Router + Prisma + PostgreSQL 기반.

---

## 🚨 견적 계산 로직 — 절대 규칙

> `src/lib/quote-calculator.ts`를 수정할 때 반드시 아래 규칙을 지켜야 한다.
> 이 파일의 로직은 실제 금융 명세에 맞게 검증된 상태다. 임의로 변경하지 마라.

### 1. Math.round 적용 위치

**최종 단계(Step 6: 금융사 가산율 적용 후)에서만 `Math.round` 적용.**
중간 단계(Step 1~5)는 반드시 float을 유지해야 한다.

```
❌ 잘못된 예:
  return Math.round(vehiclePrice * recoveryRate);   // calcBaseMonthly
  const monthly = Math.round(vehiclePrice * adjustedRate);  // applyDeposit

✅ 올바른 예:
  return vehiclePrice * recoveryRate;               // float 유지
  const monthly = vehiclePrice * adjustedRate;      // float 유지
  const monthlyPayment = Math.round(afterVehicle * (1 + financeSurchargeRate / 100));  // 최종만 반올림
```

### 2. prepayAdjustRate 부호 규칙

- DB에 **양수(+0.000073)** 로 저장
- 계산 시 반드시 **차감(-)** 해야 함

```
✅ 올바른 공식:
  monthly = baseMonthly - (prepayAmount / contractMonths) - (vehiclePrice × prepayAdjustRate × steps)

❌ 잘못된 예 (+로 더하면 안 됨):
  monthly = baseMonthly - (prepayAmount / contractMonths) + (vehiclePrice × prepayAdjustRate × steps)
```

### 3. 가산율 적용 순서 (누적 곱셈)

반드시 **순위 → 차량 → 금융사** 순으로 누적 곱셈해야 한다. 독립 합산 방식 금지.

```
✅ 올바른 예:
  afterRank    = monthlyBeforeSurcharge × (1 + rankRate / 100)
  afterVehicle = afterRank × (1 + vehicleSurchargeRate / 100)
  monthlyPayment = Math.round(afterVehicle × (1 + financeSurchargeRate / 100))

❌ 잘못된 예 (독립 합산):
  monthlyPayment = monthlyBeforeSurcharge × (1 + rankRate/100 + vehicleSurchargeRate/100 + financeSurchargeRate/100)
```

### 4. 선형보간 클램핑

`lerp` 함수에서 외삽(extrapolation) 불허. t를 [0, 1]로 클램핑해야 한다.

```typescript
const t = Math.max(0, Math.min(1, (x - x0) / (x1 - x0)));
```

### 5. 보증금 / 선납금 동시 적용 불가

둘 중 하나만 적용. `depositRate > 0`이면 보증금, `prepayRate > 0`이면 선납금.

---

## 시드 데이터 규칙 (`prisma/seed.ts`)

### 순위 가산율

| 순위 | 가산율 |
|------|--------|
| 1순위 | **1.0%** |
| 2순위 | **1.5%** |
| 3순위 | **2.0%** |
| 4순위 이상 | **2.5%** |

### 렌트 기준 할인율 (전 차량 공통)

| 항목 | 값 |
|------|----|
| `depositDiscountRate` | **-0.000523** (음수 저장) |
| `prepayAdjustRate` | **+0.000073** (양수 저장) |

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

※ 조건 대여료 = 가산율 적용 전 monthlyBeforeSurcharge
```

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

| 컴포넌트 | 경로 | 핵심 기능 |
|----------|------|-----------|
| QuotationTable | `src/components/admin/quotations/QuotationTable.tsx` | 견적 테이블 + 우측 Drawer + 서류 링크 복사 |
| VerificationResult | `src/components/admin/VerificationResult.tsx` | 서류 확인 결과 (운전면허/보험/사업자) |
| DashboardClient | `src/components/admin/DashboardClient.tsx` | KPI 카드 5개 + 차트 4종 |
| VehicleManager | `src/components/admin/VehicleManager.tsx` | 차량 관리 3열 레이아웃 |
| AnalyticsDashboard | `src/components/admin/AnalyticsDashboard.tsx` | 30일 분석 데이터 |

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
