# 아임딜러 — 경쟁 우위 분석 & Codex 실행 태스크

> 작성일: 2026-04-27  
> 기반 자료: `아임딜러_투자자용_경쟁우위문서_v1.0.pdf` (주식회사 바오밥오토플랜)  
> 목적: 투자자 문서 분석 + Codex가 바로 실행할 수 있는 엔지니어링 스펙

---

## PART 1 — 프로젝트 컨텍스트 (Codex 필독)

### 기술 스택
- **Framework**: Next.js 14 App Router (TypeScript)
- **DB**: PostgreSQL + Prisma ORM
- **Auth**: Supabase Auth
- **Styling**: Tailwind CSS (커스텀 토큰)
- **테스트**: Vitest

### 디렉토리 구조 (핵심만)
```
src/
  lib/
    quote-calculator.ts   ← 견적 계산 엔진 (수정 금지)
    admin-queries.ts      ← SSR 쿼리
    codef.ts              ← 서류 확인 API
  app/
    (public)/quote/       ← 고객 견적 화면
    (admin)/admin/        ← 어드민
    api/quote/            ← 견적 API routes
    api/admin/            ← 어드민 API routes
    api/verification/     ← 서류 확인 API
  components/
    quote/                ← 고객 견적 컴포넌트
    admin/                ← 어드민 컴포넌트
      dashboard/charts/   ← SVG 차트 (DonutChart, BarChart, LineChart)
prisma/
  schema.prisma
  seed.ts
```

### 절대 규칙 (위반 시 견적 오류 발생)
1. **`src/lib/quote-calculator.ts` 수정 금지** — 금융 계산 로직은 검증 완료 상태
2. **외부 차트 라이브러리 금지** — Recharts 등 사용 불가. `src/components/admin/dashboard/charts/` 의 SVG 직접 구현 패턴만 사용
3. **가산(surcharge) 정보를 고객 화면에 노출 금지** — 순위가산/차량가산/금융사가산은 영업 마진 정보. 어드민에서는 유지.
4. **`Math.round`는 견적 계산 최종 단계에서만** — 중간 계산은 float 유지

### 색상 토큰 (Tailwind)
```
primary:     #000666   (짙은 파랑)
accent:      #6066EE   (밝은 파랑)
secondary:   #71749A
background:  #F8F9FC   (neutral DEFAULT)
dark-text:   #1A1A2E
muted-text:  #9BA4C0
```

### 주요 타입 (src/types/quote.ts)
```typescript
interface QuoteScenarioDetail {
  monthlyPayment: number;
  depositAmount: number;
  prepayAmount: number;
  contractMonths: number;
  annualMileage: number;
  contractType: string;           // "반납형" | "인수형"
  bestFinanceCompany: string;
  purchaseSurcharge: number;      // 인수형 추가비 (반납형 = 0)
  breakdown: QuoteBreakdown | null;
  surcharges: SurchargeDetail | null;
  allFinanceResults: FinanceCompanyQuote[];
}

interface QuoteBreakdown {
  vehiclePrice: number;
  recoveryRate: number;
  baseMonthly: number;            // 보증금/선납 조정 전 기준 대여료
  depositDiscount: number;        // 보증금 할인액 (양수)
  prepayAdjust: number;           // 선납금 조정액 (음수면 절감)
  monthlyBeforeSurcharge: number; // 조정 후 대여료 (가산 전)
}

interface SurchargeDetail {
  rankSurcharge: number;
  vehicleSurcharge: number;
  financeSurcharge: number;
  totalSurcharge: number;
}
```

---

## PART 2 — 현재 구현 현황

### 완료된 작업
| 항목 | 파일 | 상태 |
|---|---|---|
| 견적 계산 엔진 | `src/lib/quote-calculator.ts` | 완료 (수정 금지) |
| 고객 견적 3단계 플로우 | `src/app/(public)/quote/QuoteClientPage.tsx` | 완료 |
| 견적 결과 탭 (보수/표준/공격형) | `src/components/quote/QuoteBreakdownTabs.tsx` | 완료 |
| **월 납입금 구성 도넛 차트** | `src/components/quote/QuoteMonthlyDonut.tsx` | **2026-04-27 신규 완료** |
| 가산 정보 고객 화면 제거 | `QuoteBreakdownTabs.tsx` | **2026-04-27 완료** |
| Codef 서류 확인 3종 | `src/lib/codef.ts` | 코드 완성 (sandbox 상태) |
| 어드민 대시보드/CRM | `src/app/(admin)/admin/` | 완료 |
| 어드민 SVG 차트 패턴 | `src/components/admin/dashboard/charts/` | 완료 (재사용 자산) |

### 현재 견적 플로우 동작 방식
```
STEP 1: 차량 선택 (차량 목록 → 트림 선택)
STEP 2: 조건 설정
  - 계약기간: 36/48/60개월 (고정 버튼)
  - 연간 약정거리: 1/2/3만km (고정 버튼)
  - 계약 종류: 반납형/인수형 (고정 버튼)
  → "견적 계산하기" 버튼 클릭 → POST /api/vehicles/[slug]/quote → setStep(3)
STEP 3: 결과 확인
  - 보수형/표준형/공격형 탭 (API에서 3개 시나리오 반환)
  - QuoteBreakdownTabs 컴포넌트
    ① 월 납입금 + 금융사 배지
    ② 표준형 전용 보증금/선납금 슬라이더 + 도넛 차트
    ③ 계약 조건 그리드
    ④ 견적 산출 내역 (accordion)
    ⑤ 금융사별 비교 (accordion)
    ⑥ 체크포인트
```

### 현재 API 구조 (src/app/api/vehicles/[slug]/quote/route.ts)
- POST `/api/vehicles/[slug]/quote` — trimId, selectedOptionIds, contractMonths, annualMileage, contractType, productType 받아 3개 시나리오 반환
- 3개 시나리오는 내부적으로 보수형(보증금 20%), 표준형(없음), 공격형(선납금 30%) 고정 조건으로 계산
- customDepositRate/customPrepayRate가 들어오면 표준형(standard)만 해당 조건으로 재계산해 반환

### 현재 sessionStorage 임시저장 위치
```
QuoteClientPage.tsx:280
sessionStorage.setItem(`quote_${quoteSessionId}`, JSON.stringify({...quoteResult}))
→ 탭 종료 시 소실 (localStorage 전환 필요)
```

### 현재 SavedQuote 스키마 (prisma/schema.prisma:228)
```prisma
model SavedQuote {
  id             String
  sessionId      String
  userId         String?
  vehicleId      String
  trimId         String
  contractMonths Int
  annualMileage  Int
  depositRate    Int
  prepayRate     Int
  contractType   String
  monthlyPayment Int
  ...
  // customerType 컬럼 없음 ← 추가 필요
}
```

---

## PART 3 — 전략적 배경 (작업 우선순위 근거)

차즘(CHAZM, 19개월·189억 투자)과의 차별화 전략:

| 차즘의 한계 | 아임딜러의 기회 |
|---|---|
| 블랙박스 견적 — 왜 이 금액인지 고객이 모름 | 견적 구조 분해 시각화 — 고객이 직접 만드는 경험 |
| 개인 소비자 타겟, 법인 컨설팅 없음 | 법인·사업자 전용 설계 엔진 (20년 실무 로직) |
| 계약 이후 관계 단절 | 계약 시점부터 평생 관리 생태계 |

**핵심 메시지**: "고객이 견적을 보는 게 아니라 직접 만드는 경험"

---

## PART 4 — Codex 실행 태스크

> 각 태스크는 독립적으로 실행 가능. Phase A → B → C → D 순서 권장.  
> 각 태스크 완료 후 `npx tsc --noEmit` 통과 필수.

---

### [A2] STEP3 선납금/보증금 슬라이더 + 실시간 도넛 업데이트

**목표**: 고객이 STEP3 결과 화면에서 보증금률/선납금률을 직접 조절하면 도넛 차트와 월 납입금이 실시간으로 바뀌는 경험

**현재 상태**:
- STEP2에서 조건 고정 후 "견적 계산하기" 클릭 → 1회 API 호출
- 3개 시나리오(보수/표준/공격)는 API 내부에서 고정값(20%/0%/30%)으로 계산
- STEP3 표준형 탭에서 보증금/선납금 슬라이더로 standard 시나리오만 실시간 재계산
- 슬라이더를 0%로 되돌리거나 다른 탭으로 이동하면 기본 표준형 견적으로 복원

**구현 스펙**:

1. **`src/app/api/vehicles/[slug]/quote/route.ts` 수정**  
   요청 body에 optional 파라미터 추가:
   ```typescript
   {
     trimId?: string;
     selectedOptionIds?: string[];
     extraOptionsPrice?: number;
     contractMonths: 36 | 48 | 60;
     annualMileage: 10000 | 20000 | 30000;
     contractType: "반납형" | "인수형";
     productType: "장기렌트" | "리스";
     customDepositRate?: number;   // 0~30 (%), 표준형만 재계산
     customPrepayRate?: number;    // 0~30 (%), 표준형만 재계산
   }
   ```
   `customDepositRate` 또는 `customPrepayRate`가 있으면 해당 조건으로 standard 시나리오를 재계산해서 반환.

2. **`src/components/quote/QuoteBreakdownTabs.tsx` 수정**  
   Props에 슬라이더 콜백 추가:
   ```typescript
   interface Props {
     scenarios: QuoteScenarioDetails;
     defaultTab?: ScenarioKey;
     onTabChange?: (tab: ScenarioKey) => void;
     customRates?: { depositRate: number; prepayRate: number };
     onCustomRatesChange?: (rates: { depositRate: number; prepayRate: number }) => void;
     isRecalculating?: boolean;
   }
   ```
   STEP3 결과 상단(도넛 차트 위)에 슬라이더 UI 추가:
   - 보증금률 슬라이더: 0% ~ 30% (step: 5%)
   - 선납금률 슬라이더: 0% ~ 30% (step: 5%)
   - 둘 중 하나를 0 이상으로 올리면 다른 하나는 자동으로 0으로 리셋 (동시 적용 불가 — CLAUDE.md 규칙)
   - 슬라이더 값 변경 시 `onCustomRatesChange` 호출 (debounce 500ms)

3. **`src/app/(public)/quote/QuoteClientPage.tsx` 수정**  
   `QuoteBreakdownTabs`에 `customRates`와 `onCustomRatesChange` 연결:
   ```typescript
   const [customRates, setCustomRates] = useState({ depositRate: 0, prepayRate: 0 });

   useEffect(() => {
     // 500ms debounce 후 /api/vehicles/[slug]/quote 재호출
     // 0/0이면 최초 standard 시나리오로 복원
   }, [customRates.depositRate, customRates.prepayRate]);
   ```

**수정 파일**:
- `src/app/api/vehicles/[slug]/quote/route.ts`
- `src/components/quote/QuoteBreakdownTabs.tsx`
- `src/app/(public)/quote/QuoteClientPage.tsx`

**검증**:
- 보증금 슬라이더를 10%로 올리면 → 도넛 "차량 대여료" 비중 감소 확인
- 선납금을 올리면 보증금은 자동 0으로 리셋 확인
- 슬라이더를 다시 0%로 내리면 기본 표준형 견적으로 복원 확인
- 500ms 후 API 호출 (중간에 연속 변경 시 마지막 한 번만 호출)
- `npx tsc --noEmit` 통과

---

### [A3] 금융사별 비교 SVG 막대그래프

**목표**: `FinanceCompareTable`의 텍스트 리스트를 수평 막대그래프로 시각화

**현재 상태**:  
`src/components/quote/QuoteBreakdownTabs.tsx`의 `FinanceCompareTable` 함수 (L290~):
- 금융사명, 월 납입금, 최저가 대비 차이를 텍스트로 나열

**구현 스펙**:

`FinanceCompareTable` 내부에 SVG 막대그래프 추가 (텍스트 리스트 위 또는 대체):
- 가장 낮은 금융사 = 100% 기준 막대 (`#000666`)
- 나머지는 상대 비율로 (`#E8EAF2` 베이스 + `#6066EE` 채움)
- 막대 오른쪽에 월 납입금 숫자 표시
- 최저가 배지(`최저가`) 유지

**재사용 패턴**: `src/components/admin/dashboard/charts/BarChart.tsx` SVG 구현 참고

**수정 파일**: `src/components/quote/QuoteBreakdownTabs.tsx`의 `FinanceCompareTable` 함수

---

### [B1] 사업자 유형 진입 분기 + 스키마 추가

**목표**: 견적 첫 화면에서 고객 유형을 선택하게 하고, 이 정보가 견적 저장까지 흐르도록

**현재 상태**:
- 견적 진입에 고객 유형 선택 없음
- `VerifyClient.tsx`에 `individual / self_employed / corporate` 3종만 (비영리법인 없음)
- `SavedQuote` 모델에 `customerType` 컬럼 없음

**구현 스펙**:

**Step 1 — 스키마 수정** (`prisma/schema.prisma`)  
`SavedQuote` 모델에 컬럼 추가:
```prisma
model SavedQuote {
  ...기존 필드...
  customerType  String  @default("individual")
  // individual | self_employed | corporate | nonprofit
}
```
마이그레이션 생성: `npx prisma migrate dev --name add_customer_type_to_quote`

**Step 2 — 견적 STEP1 앞에 고객 유형 선택 화면 추가**  
`src/app/(public)/quote/QuoteClientPage.tsx`:
- `step` 타입을 `0 | 1 | 2 | 3`으로 확장 (0 = 유형 선택, 1 = 차량 선택, 2 = 조건, 3 = 결과)
- 또는 별도 `customerType` state 추가, 미선택 시 STEP1 진입 불가

4가지 카드 선택 UI:
```
[개인]          [개인사업자]      [법인]           [비영리법인]
월 납입금 비교  비용처리 최적화   운용리스 + 세무   전기차·보조금
                                  컨설팅
```

**Step 3 — customerType을 API 및 저장 로직에 전달**  
- `POST /api/vehicles/[slug]/quote` body에 `customerType` 추가 (현재 미사용이어도 저장)
- `POST /api/quote/save` body에 `customerType` 추가 → DB 저장
- `src/app/api/quote/save/route.ts` 수정

**Step 4 — VerifyClient.tsx enum 확장** (`src/app/(public)/verify/VerifyClient.tsx:200`)  
`individual | self_employed | corporate` → `individual | self_employed | corporate | nonprofit` 추가

**수정 파일**:
- `prisma/schema.prisma`
- `src/app/(public)/quote/QuoteClientPage.tsx`
- `src/app/api/vehicles/[slug]/quote/route.ts`
- `src/app/api/quote/save/route.ts`
- `src/app/(public)/verify/VerifyClient.tsx`

**검증**:
- 견적 진입 시 유형 선택 화면 노출
- 유형 선택 후 STEP1(차량 선택) 진입
- 견적 완료 후 어드민 `/admin/quotations`에서 customerType 확인 가능 (컬럼 추가)

---

### [B2] 사업자 유형별 추천 안내 문구

**목표**: 견적 결과 STEP3에서 선택한 customerType에 따라 맞춤 안내 표시

**현재 상태**: 체크포인트(CostCheckpoint)가 반납형/인수형으로만 분기

**구현 스펙**:

`src/components/quote/QuoteBreakdownTabs.tsx`의 `CostCheckpoint` 함수 수정:
- Props에 `customerType: string` 추가
- customerType별 추가 안내 문구:

```typescript
const CUSTOMER_TIPS: Record<string, string[]> = {
  corporate: [
    "운용리스 비용처리 한도: 연 800만원",
    "업무전용 자동차보험 가입 시 전액 비용처리 가능",
    "부가세 환급 여부는 법인 업종에 따라 상이",
  ],
  self_employed: [
    "성실신고 대상자: 연 1,500만원까지 비용처리 가능",
    "일반 개인사업자: 연 800만원 한도 적용",
    "렌트 vs 리스 부가세 처리 방식 상이 — 세무사 확인 권장",
  ],
  nonprofit: [
    "전기차 보조금 적용 가능 여부 사전 확인 필요",
    "비영리법인은 부가세 환급 불가",
    "업무 전용 차량으로 등록 시 보험 조건 상이",
  ],
  individual: [], // 기존 체크포인트 유지
};
```

**수정 파일**: `src/components/quote/QuoteBreakdownTabs.tsx`

---

### [B3] 카카오 알림톡 견적서 발송

**목표**: 고객이 견적 결과 화면에서 "카카오로 받기" 버튼 클릭 시, 구성 내역 포함된 견적서를 카카오 알림톡으로 발송

**전제 조건** (개발 전 확인):
- 카카오 비즈니스 채널 등록 완료 여부
- 알림톡 템플릿 사전심사 승인 여부

**구현 스펙**:

**Step 1 — Kakao 알림톡 유틸** (`src/lib/kakao-alimtalk.ts` 신규):
```typescript
export async function sendQuoteAlimtalk(params: {
  phone: string;
  vehicleName: string;
  monthlyPayment: number;
  vehicleShare: number;
  financeShare: number;
  bestFinanceCompany: string;
  contractMonths: number;
}) { ... }
```
환경변수: `KAKAO_ALIMTALK_API_KEY`, `KAKAO_SENDER_KEY`, `KAKAO_TEMPLATE_CODE`

**Step 2 — API Route** (`src/app/api/quote/send-kakao/route.ts` 신규):
POST 엔드포인트. Zod로 입력 검증 필수.

**Step 3 — UI** (`QuoteBreakdownTabs.tsx` 또는 `QuoteClientPage.tsx`):
STEP3 하단에 "카카오로 견적서 받기" 버튼 추가. 클릭 시 전화번호 입력 모달 → 발송.

**수정/신규 파일**:
- `src/lib/kakao-alimtalk.ts` (신규)
- `src/app/api/quote/send-kakao/route.ts` (신규)
- `src/components/quote/QuoteBreakdownTabs.tsx` 또는 `QuoteClientPage.tsx`
- `.env.example` (신규 환경변수 추가)

---

### [C1] sessionStorage → localStorage 전환

**목표**: 비로그인 견적 데이터를 탭 종료 후에도 유지

**현재 상태**: `QuoteClientPage.tsx:280`에서 sessionStorage 사용

**구현 스펙**:

`QuoteClientPage.tsx:280` 수정:
```typescript
// 변경 전
sessionStorage.setItem(`quote_${quoteSessionId}`, JSON.stringify({...}))

// 변경 후 — 민감 정보(이름, 연락처) 제외
const { customerName, phone, ...safeData } = quoteResult;
localStorage.setItem(`quote_draft_${quoteSessionId}`, JSON.stringify(safeData));
```

복원 시 (`/verify` 페이지 진입 후): `localStorage.getItem` 사용. 로그인 성공 후 서버 저장 완료 시 해당 키 삭제.

**주의**: 차량 가격, 견적 조건은 민감 정보 아님. 저장 OK.

**수정 파일**: `src/app/(public)/quote/QuoteClientPage.tsx`

---

### [C2] 즉시출고 뱃지 연결

**목표**: 재고 차량에 [즉시출고] 뱃지 표시

**현재 상태**:
- `prisma/schema.prisma`에 `Inventory` 모델 존재 (status: AVAILABLE/RESERVED/SOLD)
- 어드민 `InventoryClient.tsx`에만 연결됨
- 공개 차량 목록 페이지에서 Inventory 조회 없음

**구현 스펙**:

`src/app/(public)/cars/` 내 차량 목록/상세 페이지에서 Inventory 조회 추가:
- 차량 slug로 vehicleId 조회 → `Inventory` 테이블에서 `status = AVAILABLE` 건 수 확인
- AVAILABLE > 0이면 `[즉시출고]` 뱃지 표시 (색상: `bg-primary text-white`)
- 클릭 시 견적 페이지로 이동 (`/quote?vehicle={slug}`)

**수정 파일**: 차량 목록 페이지 (경로 확인 후 수정)

---

### [C3] 승인 확률 미리보기 (Mock)

**목표**: 견적 신청 전 "이 조건으로 승인 가능성이 높습니다" 표시로 이탈 방지

**현재 상태**: 없음

**구현 스펙 (Mock)**:

견적 STEP3에서 `monthlyPayment`와 `contractMonths` 기반 규칙 기반 mock:
```typescript
function estimateApprovalRate(monthlyPayment: number, depositRate: number): "high" | "medium" | "low" {
  if (depositRate >= 20) return "high";
  if (monthlyPayment < 400000) return "high";
  if (monthlyPayment < 700000) return "medium";
  return "low";
}
```

결과 표시 — STEP3 하단:
- "high": "이 조건으로 대부분 승인됩니다" (초록 뱃지)
- "medium": "보증금 추가 시 승인률이 높아집니다" (노란 뱃지)
- "low": "소득 증빙 또는 보증금 확대를 권장합니다" (주황 뱃지)

**수정 파일**: `src/components/quote/QuoteBreakdownTabs.tsx`

---

### [C4] SavedQuote 기반 고객/계약 전환 뷰 정리

**목표**: 계약 이후 관리 생태계의 데이터 기반 구축

**현재 상태**: `SavedQuote`가 고객 정보, 견적 조건, 상담 상태, 계약 완료 상태를 함께 들고 있음. DB 구조가 계속 바뀌고 있으므로 별도 `Customer`, `Contract` 모델을 지금 확정하면 중복 저장과 마이그레이션 부담이 커짐.

**구현 스펙 (v1, DB 변경 없음)**:

기존 `/admin/users`를 고객/계약 전환 관리 화면으로 확장:
- 고객은 `SavedQuote.phone` 기준으로 그룹화
- 상담/견적 이력은 기존 `SavedQuote.status` 기준으로 유지
- `SavedQuote.status === "CONVERTED"`인 견적을 계약 완료 건으로 집계
- 계약 시작일은 `convertedAt ?? updatedAt ?? createdAt` 기준으로 계산
- 예상 만기일은 `계약 시작일 + contractMonths`
- 예상 만기 90일 이내는 "만기 임박"으로 표시

추가 표시:
- KPI: 계약 완료 건수, 만기 임박 건수
- 고객 목록: 진행 상담과 계약 완료 요약
- 고객 상세 패널: 계약 관리 미리보기, 월납입금, 계약기간, 예상 만기일

**v2 전환 조건**:
실제 계약 시작일/종료일, 금융사 계약번호, 계약 상태 변경 이력, 재계약/만기 알림 정책이 확정되면 그때 `Customer`, `Contract` 모델을 신설하고 `SavedQuote`에서 backfill한다.

---

### [C5] Codef connectedId 발급 플로우

**목표**: 현재 sandbox 상태인 서류 확인을 실 운영 가능하게

**현재 상태**: `src/lib/codef.ts`에 3종 서류 확인 코드 완성. 단, individual의 건강보험/면허 확인에 `connectedId`(Codef 본인 계정 식별자) 발급 플로우 없어 운영 불가.

**구현 스펙**:

`src/lib/codef.ts`에 connectedId 발급 함수 추가:
```typescript
export async function createConnectedId(params: {
  loginType: "SIMPLE" | "KEYPAD";
  organization: string;  // 기관 코드
  loginId: string;
  loginPassword: string;
}): Promise<string>  // connectedId 반환
```

`src/app/api/verification/` 하위에 connectedId 발급 라우트 신규:
- `POST /api/verification/connect` — 동의 후 connectedId 발급 요청
- 발급된 connectedId를 `CustomerVerification` 모델에 저장

**수정/신규 파일**:
- `src/lib/codef.ts`
- `src/app/api/verification/connect/route.ts` (신규)
- `src/app/(public)/verify/VerifyClient.tsx` (동의 → connectedId 발급 플로우 연결)

---

## PART 5 — 태스크 우선순위 요약

```
Phase A (투자자 데모 임팩트 — 즉시)
  [x] A1  도넛 차트 (완료 2026-04-27)
  [x] A2  슬라이더 + 실시간 재계산 (완료 2026-04-28)
  [x] A3  금융사 비교 막대그래프 (완료 2026-04-28)

Phase B (사업자 분기 + 카카오 — 1~2주)
  [ ] B1  사업자 유형 진입 분기 + 스키마
  [ ] B2  사업자별 추천 안내 문구
  [ ] B3  카카오 알림톡 (채널 준비 확인 후)

Phase C (이탈 방지 + 사후관리 모형 — 2~4주)
  [ ] C1  localStorage 전환 (소규모, 빠름)
  [ ] C2  즉시출고 뱃지 연결 (소규모, 빠름)
  [ ] C3  승인 확률 미리보기 Mock
  [x] C4  SavedQuote 기반 고객/계약 전환 뷰 정리
  [ ] C5  Codef 실 운영 플로우 (외부 API 계약 필요)

Phase D (투자 후 — B2B SaaS)
  [ ] 멀티 테넌트 재설계 (Tenant / Agency / Subscription)
  [ ] 만기 알림 / 재계약 AI / 중고차 연계
```

---

## PART 6 — 검증 케이스 (모든 코드 변경 후 반드시 확인)

```
케이스 A (보증금):
  차량가: 43,840,000원 / 약정거리: 2만km / 계약기간: 36개월 / 보증금 10%
  → 조건 대여료(monthlyBeforeSurcharge): ~561,680원

케이스 B (선납금):
  차량가: 43,840,000원 / 약정거리: 1만km / 계약기간: 36개월 / 선납금 10%
  → 조건 대여료(monthlyBeforeSurcharge): ~421,750원 (±1,000원)

주의: 조건 대여료는 가산(surcharge) 적용 전 값.
      최종 monthlyPayment는 이보다 높음.
```

---

*이 문서는 코드베이스 분석 기반 엔지니어링 스펙입니다. 투자자 커뮤니케이션 및 개발팀 작업 지시용.*
