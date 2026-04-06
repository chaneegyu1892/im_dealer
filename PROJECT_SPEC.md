# PROJECT_SPEC.md — 아임딜러 1단계 설계 문서

> **기준 문서**: imdealers-RFP.md + DESIGN.md
> **개발 범위**: 1단계 집중 (2·3단계 확장 구조 고려)
> **절대 원칙**: 상담접수형 UI 금지 / AI 추천 중심 / 모바일 퍼스트

---

## 1. 전체 페이지 목록 및 역할

### 고객용 (Public)

| 경로 | 페이지명 | 역할 | 핵심 원칙 |
|------|----------|------|-----------|
| `/` | 홈 | AI 추천 진입 유도, 브랜드 첫인상, 신뢰 요소 노출 | 상담접수 없음, AI 중심 |
| `/recommend` | AI 추천 | 업종·목적·예산·성향 입력 → 추천 결과 | 서비스 핵심 경험 |
| `/recommend/result` | 추천 결과 | 추천 차량 1~3개 + 이유 + 비교 관점 | 탐색·이해 우선 |
| `/cars` | 차량 탐색 | 전체 차량 목록, 카테고리·필터 | 자율 탐색 구조 |
| `/cars/[slug]` | 차량 상세 | 트림·옵션 선택, 견적 미리보기 | 판단 근거 제공 |
| `/quote` | 견적 계산기 | 조건 입력 → 실시간 견적 계산 | 투명한 견적 |
| `/quote/[id]` | 견적 결과 | 시나리오별 견적, AI 해설, 채널톡 연계 | "월 xx원" 단순 강조 금지 |
| `/about` | 브랜드 소개 | 아임딜러 철학, 신뢰 요소, 팀 소개 | 솔직함 → 신뢰 |

### 관리자용 (Admin, `/admin/*`)

| 경로 | 페이지명 | 역할 |
|------|----------|------|
| `/admin` | 대시보드 | 주요 지표 요약, 빠른 접근 |
| `/admin/cars` | 차량 관리 | 차량 등록·수정·삭제·노출제어 |
| `/admin/cars/[id]/trims` | 트림 관리 | 트림별 정보·옵션·이미지 관리 |
| `/admin/quote-variables` | 견적변수 관리 | 금리·잔존가치·수수료 등 운영값 |
| `/admin/recommendations` | AI 추천 데이터 | 추천 문구, 추천 가중치 기초 데이터 |
| `/admin/content` | 콘텐츠 운영 | 메인 배너, 프로모션, 공지 |
| `/admin/logs` | 탐색 로그 | 고객 탐색 흐름, 추천 클릭, 이탈 지점 |
| `/admin/notes` | 운영 메모 | 차종별·상담별 운영 메모 기록 |

---

## 2. 컴포넌트 구조

```
src/
├── app/                          # Next.js App Router
│   ├── (public)/                 # 고객용 레이아웃 그룹
│   │   ├── layout.tsx            # 공통 헤더 + BottomNav
│   │   ├── page.tsx              # 홈
│   │   ├── recommend/
│   │   ├── cars/
│   │   ├── quote/
│   │   └── about/
│   ├── (admin)/                  # 관리자 레이아웃 그룹
│   │   ├── layout.tsx            # 사이드바 + 헤더
│   │   └── admin/
│   └── api/                      # API Routes
│
├── components/
│   ├── ui/                       # 디자인 시스템 원자 컴포넌트
│   │   ├── Button.tsx            # Primary / Secondary / Inverted / Outlined
│   │   ├── Card.tsx              # 카드 컨테이너
│   │   ├── Badge.tsx             # 추천 배지, 라벨
│   │   ├── Input.tsx             # 검색·폼 입력
│   │   ├── Select.tsx
│   │   ├── Divider.tsx           # 3색 구분선
│   │   ├── BottomNav.tsx         # 모바일 하단 내비게이션
│   │   └── LoadingSpinner.tsx
│   │
│   ├── layout/
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   ├── BottomNav.tsx
│   │   └── AdminSidebar.tsx
│   │
│   ├── home/
│   │   ├── HeroSection.tsx       # AI 추천 진입 CTA
│   │   ├── TrustSection.tsx      # 신뢰 요소 (차별점 3가지)
│   │   ├── PopularCarsSection.tsx
│   │   └── BrandStorySection.tsx
│   │
│   ├── recommend/
│   │   ├── StepIndicator.tsx     # 단계 표시
│   │   ├── StepIndustry.tsx      # 업종 선택
│   │   ├── StepPurpose.tsx       # 사용 목적
│   │   ├── StepBudget.tsx        # 예산 범위
│   │   ├── StepPreference.tsx    # 납입 성향 / 거리
│   │   └── RecommendResult.tsx   # 추천 결과 카드
│   │
│   ├── cars/
│   │   ├── CarCard.tsx           # 차량 목록 카드
│   │   ├── CarGrid.tsx
│   │   ├── CarFilter.tsx
│   │   ├── TrimSelector.tsx
│   │   └── OptionSelector.tsx
│   │
│   ├── quote/
│   │   ├── QuoteForm.tsx         # 견적 조건 입력
│   │   ├── QuoteResult.tsx       # 견적 결과
│   │   ├── QuoteScenario.tsx     # 보수형/표준형/공격형
│   │   ├── QuoteBreakdown.tsx    # 비용 항목 상세
│   │   ├── AiInsight.tsx         # AI 해설
│   │   └── ChannelTalkButton.tsx # 채널톡 연계
│   │
│   └── admin/
│       ├── DataTable.tsx
│       ├── CarForm.tsx
│       ├── TrimForm.tsx
│       ├── QuoteVariableForm.tsx
│       └── LogViewer.tsx
│
├── lib/
│   ├── prisma.ts                 # Prisma 클라이언트 싱글톤
│   ├── supabase.ts               # Supabase 클라이언트
│   ├── quote-calculator.ts       # 견적 계산 로직 (순수 함수)
│   ├── ai-recommender.ts         # AI 추천 로직
│   └── logger.ts                 # 탐색 로그 유틸
│
├── types/
│   ├── vehicle.ts
│   ├── quote.ts
│   ├── recommendation.ts
│   └── admin.ts
│
└── constants/
    ├── design-tokens.ts          # DESIGN.md 토큰 상수화
    └── quote-defaults.ts         # 기본 견적 변수값
```

---

## 3. API 엔드포인트 목록

### 차량

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/cars` | 차량 목록 (필터: 카테고리, 브랜드, 노출여부) |
| GET | `/api/cars/[slug]` | 차량 상세 + 트림 목록 |
| GET | `/api/cars/popular` | 인기 차량 (홈 노출용) |

### 견적

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/quote/calculate` | 견적 계산 (조건 입력 → 결과 반환) |
| GET | `/api/quote/[id]` | 저장된 견적 결과 조회 |
| POST | `/api/quote/save` | 견적 저장 (비회원 가능, UUID) |

### AI 추천

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/recommend` | 입력값 기반 추천 차량 반환 |
| GET | `/api/recommend/[sessionId]` | 추천 결과 재조회 |

### 로그

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/logs/exploration` | 탐색 흐름 기록 |
| POST | `/api/logs/recommendation-click` | 추천 차량 클릭 기록 |
| POST | `/api/logs/quote-view` | 견적 결과 조회 기록 |

### 관리자 (인증 필요)

| Method | Path | 설명 |
|--------|------|------|
| GET/POST/PUT/DELETE | `/api/admin/cars` | 차량 CRUD |
| GET/POST/PUT/DELETE | `/api/admin/cars/[id]/trims` | 트림 CRUD |
| GET/PUT | `/api/admin/quote-variables` | 견적 변수 조회·수정 |
| GET/POST/PUT | `/api/admin/recommendations` | AI 추천 기초 데이터 |
| GET/POST/PUT/DELETE | `/api/admin/content` | 콘텐츠·배너 관리 |
| GET | `/api/admin/logs` | 탐색·추천 로그 조회 |
| GET/POST/PUT | `/api/admin/notes` | 운영 메모 |

---

## 4. DB 스키마 설계

### 4-1. 차량 (Vehicle)

```prisma
model Vehicle {
  id            String    @id @default(cuid())
  slug          String    @unique           // URL용 식별자
  name          String                      // 차량명 (ex: 현대 아반떼)
  brand         String                      // 브랜드
  category      String                      // 세단/SUV/밴/트럭
  basePrice     Int                         // 기본 차량가 (원)
  thumbnailUrl  String
  imageUrls     String[]                    // 다중 이미지
  isVisible     Boolean   @default(true)    // 노출 제어
  isPopular     Boolean   @default(false)   // 홈 노출 여부
  displayOrder  Int       @default(0)       // 정렬 순서
  description   String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  trims         Trim[]
  quoteVars     QuoteVariable[]
  recLogs       RecommendationLog[]
  exploLogs     ExplorationLog[]
  notes         OperationalNote[]
}
```

### 4-2. 트림 (Trim)

```prisma
model Trim {
  id            String    @id @default(cuid())
  vehicleId     String
  vehicle       Vehicle   @relation(fields: [vehicleId], references: [id])
  name          String                      // 트림명 (ex: 프리미엄)
  price         Int                         // 트림 차량가
  engineType    String                      // 가솔린/디젤/하이브리드/EV
  fuelEfficiency Float?                     // 연비
  isDefault     Boolean   @default(false)   // 기본 선택 트림
  isVisible     Boolean   @default(true)
  specs         Json?                       // 주요 사양 (key-value)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  options       TrimOption[]
  quoteVars     QuoteVariable[]
}
```

### 4-3. 트림 옵션 (TrimOption)

```prisma
model TrimOption {
  id            String    @id @default(cuid())
  trimId        String
  trim          Trim      @relation(fields: [trimId], references: [id])
  name          String                      // 옵션명
  price         Int       @default(0)       // 추가 금액
  category      String?                     // 편의/안전/외관
  isDefault     Boolean   @default(false)
  createdAt     DateTime  @default(now())
}
```

### 4-4. 견적 변수 (QuoteVariable)

```prisma
// 차량/트림별로 운영자가 조정 가능한 견적 변수
model QuoteVariable {
  id              String    @id @default(cuid())
  vehicleId       String
  vehicle         Vehicle   @relation(fields: [vehicleId], references: [id])
  trimId          String?                   // null이면 차량 전체 적용
  trim            Trim?     @relation(fields: [trimId], references: [id])

  // 계약 조건
  contractMonths  Int[]     @default([24, 36, 48, 60])  // 지원 계약기간(월)
  annualMileages  Int[]     @default([20000, 30000, 40000])  // 지원 약정거리

  // 금융 변수
  interestRate    Float                     // 금리 (%)
  residualRate    Float                     // 잔존가치율 (%)
  commissionRate  Float                     // 수수료율 (%)
  taxRate         Float     @default(0.1)   // 세금 (부가세 등)
  miscCost        Int       @default(0)     // 부대비용 (원)

  // 보증금/선납금
  depositOptions  Int[]     @default([0, 10, 20, 30])  // 보증금 비율(%)
  prepayOptions   Int[]     @default([0, 10, 20, 30])  // 선납금 비율(%)

  // 프로모션
  promoDiscount   Int       @default(0)     // 프로모션 할인액 (원)
  promoNote       String?                   // 프로모션 설명
  promoExpiry     DateTime?                 // 프로모션 만료일

  // 관리
  isActive        Boolean   @default(true)
  memo            String?                   // 운영 메모
  updatedAt       DateTime  @updatedAt
  updatedBy       String?                   // 수정 관리자 ID
}
```

### 4-5. 저장된 견적 (SavedQuote)

```prisma
model SavedQuote {
  id              String    @id @default(cuid())
  sessionId       String                    // 비회원 세션 UUID
  vehicleId       String
  trimId          String

  // 선택한 조건
  contractMonths  Int
  annualMileage   Int
  depositRate     Int
  prepayRate      Int
  contractType    String                    // 인수형 / 반납형

  // 계산 결과 스냅샷
  monthlyPayment  Int                       // 월 납입금
  totalCost       Int                       // 총 비용
  breakdown       Json                      // 비용 항목 상세

  createdAt       DateTime  @default(now())
  expiresAt       DateTime                  // 견적 유효기간 (7일)
}
```

### 4-6. AI 추천 로그 (RecommendationLog)

```prisma
// 추천 흐름 데이터 — AI 고도화용 핵심 데이터
model RecommendationLog {
  id              String    @id @default(cuid())
  sessionId       String                    // 비회원 세션 UUID

  // 입력 변수 (추천 요청)
  industry        String                    // 업종
  purpose         String                    // 사용 목적
  budgetMin       Int                       // 예산 하한
  budgetMax       Int                       // 예산 상한
  paymentStyle    String                    // 납입 성향 (보수/표준/공격)
  annualMileage   Int                       // 연간 주행거리
  returnType      String                    // 인수형/반납형 선호

  // 추천 결과
  recommendedVehicleIds  String[]           // 추천된 차량 ID 목록
  recommendedReason      Json               // 추천 이유 (차량ID → 이유 맵)

  // 사용자 행동
  clickedVehicleId       String?            // 클릭한 차량 (null = 이탈)
  clickedAt              DateTime?
  proceedToQuote         Boolean  @default(false)  // 견적으로 진행 여부

  vehicleId       String?
  vehicle         Vehicle?  @relation(fields: [vehicleId], references: [id])

  createdAt       DateTime  @default(now())
  userAgent       String?
  ipHash          String?                   // 개인정보 고려 해시 처리
}
```

### 4-7. 고객 탐색 로그 (ExplorationLog)

```prisma
// 이탈 지점 파악 + 선호 데이터 축적
model ExplorationLog {
  id              String    @id @default(cuid())
  sessionId       String
  eventType       String    // page_view | car_click | filter_apply | quote_start | quote_complete | chat_click
  path            String?   // 이벤트 발생 경로
  vehicleId       String?
  vehicle         Vehicle?  @relation(fields: [vehicleId], references: [id])
  metadata        Json?     // 필터 조건, 선택 트림 등 추가 컨텍스트
  createdAt       DateTime  @default(now())
  userAgent       String?
  ipHash          String?
}
```

### 4-8. AI 추천 기초 데이터 (RecommendationConfig)

```prisma
// 운영자가 관리하는 추천 가중치/문구
model RecommendationConfig {
  id              String    @id @default(cuid())
  vehicleId       String    @unique
  
  // 업종·목적별 추천 점수 (JSON)
  // ex: { "법인": { "출퇴근": 90, "영업": 85 }, "개인": { "가족": 70 } }
  scoreMatrix     Json

  // 특징 문구 (AI 해설용)
  highlights      String[]  // ex: ["연비 최상위", "법인 세제 혜택"]
  aiCaption       String?   // 짧은 AI 추천 이유 기본값

  isActive        Boolean   @default(true)
  updatedAt       DateTime  @updatedAt
  updatedBy       String?
}
```

### 4-9. 콘텐츠/배너 (ContentBanner)

```prisma
model ContentBanner {
  id              String    @id @default(cuid())
  type            String    // hero | notice | promo | trust
  title           String
  subtitle        String?
  imageUrl        String?
  ctaLabel        String?
  ctaUrl          String?
  isVisible       Boolean   @default(true)
  displayOrder    Int       @default(0)
  startsAt        DateTime?
  endsAt          DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

### 4-10. 운영 메모 (OperationalNote)

```prisma
model OperationalNote {
  id              String    @id @default(cuid())
  vehicleId       String?
  vehicle         Vehicle?  @relation(fields: [vehicleId], references: [id])
  category        String    // vehicle | quote | consultation | general
  content         String
  isPinned        Boolean   @default(false)
  createdBy       String
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

### 4-11. 관리자 계정 (AdminUser)

```prisma
model AdminUser {
  id              String    @id @default(cuid())
  email           String    @unique
  passwordHash    String
  name            String
  role            String    @default("operator")  // superadmin | admin | operator
  isActive        Boolean   @default(true)
  lastLoginAt     DateTime?
  createdAt       DateTime  @default(now())
}
```

---

## 5. 견적 계산 로직 개요

```
월 납입금 = (차량가 × (1 - 잔존가치율) × (1 - 선납금비율) × 금리계수)
           + (수수료율 × 차량가 / 계약기간)
           + (세금 + 부대비용 / 계약기간)
           - 프로모션할인 / 계약기간
           - 보증금운용이익환산액
```

3개 시나리오:
- **보수형**: 낮은 약정거리, 높은 보증금, 높은 잔존가치
- **표준형**: 표준 조건
- **공격형**: 높은 약정거리, 낮은 보증금/선납금, 낮은 잔존가치

---

## 6. 2·3단계 확장 고려 구조

| 영역 | 1단계 구조 | 확장 고려 |
|------|-----------|-----------|
| 사용자 인증 | 없음 (sessionId 기반) | 2단계: 회원가입 → `User` 테이블 추가, sessionId → userId 마이그레이션 |
| 계약 관리 | 없음 | 2단계: `Contract` 테이블, 계약 후 고객 접점 |
| 보험/사고 | 없음 | 2단계: `InsuranceRecord`, `AccidentLog` |
| 운행일지 | 없음 | 2단계: `DrivingLog` |
| CRM | 관리자 메모 수준 | 3단계: 외부 에이전시 멀티테넌트 SaaS (`tenantId` 컬럼 추가) |
| AI 추천 | 규칙 기반 + 점수 행렬 | 2단계: 탐색로그 학습 기반 고도화 |
| 다국어 | 미지원 | 3단계: i18n 구조 |

**설계 원칙**:
- 모든 테이블에 `createdAt` / `updatedAt` 포함
- sessionId → userId 전환을 고려한 컬럼 설계
- `tenantId` 추가 시 Row Level Security(RLS)로 Supabase에서 격리 가능한 구조
- API Routes는 서비스 레이어(`/lib`) 분리로 로직 재사용 가능

---

## 7. Tailwind 디자인 토큰 설정 계획

`tailwind.config.ts`에 DESIGN.md 토큰 반영:

```typescript
colors: {
  primary: {
    DEFAULT: '#000666',
    900: '#000999', 800: '#0010CC', 700: '#3333CC',
    600: '#6666DD', 400: '#9999EE', 200: '#CCCCF5', 100: '#E5E5FA',
  },
  secondary: {
    DEFAULT: '#71749A',
    900: '#4A4D70', 800: '#5A5D80', 600: '#8185AA',
    400: '#9196BB', 300: '#B0B4CC', 200: '#D0D3E5', 100: '#E8EAF2',
  },
  tertiary: {
    DEFAULT: '#5C1800',
    900: '#7A2000', 800: '#992800', 700: '#BB3300',
    600: '#CC5533', 400: '#DD8866', 200: '#EEBBAA', 100: '#F5DDD5',
  },
  neutral: {
    DEFAULT: '#F8F9FA',
    800: '#E0E0E0', 600: '#C0C0C0', 500: '#A0A0A0',
    400: '#606060', 300: '#404040', 200: '#202020', 0: '#000000',
  },
},
borderRadius: {
  card: '12px',
  btn: '8px',
},
```

---

## 8. 폴더 구조 초기화 계획

```bash
# 패키지 설치 목록
next@14, react@18, typescript
tailwindcss, postcss, autoprefixer
@prisma/client, prisma
@supabase/supabase-js
@supabase/ssr
zod                    # 스키마 검증
lucide-react           # 아이콘
clsx, tailwind-merge   # 조건부 클래스
```

---

*이 문서는 승인 후 프로젝트 초기화 및 구현의 기준으로 사용됩니다.*
