# 아임딜러 — 신규 개발자 온보딩 자료

> 이 문서를 읽으면 프로젝트의 **왜, 무엇을, 어떻게**를 한 번에 이해할 수 있다.  
> 코드 보기 전에 반드시 먼저 읽을 것.

---

## 1. 이 서비스가 뭔가요?

**아임딜러**는 자동차 장기렌트·리스 견적 플랫폼이다.

그런데 단순 견적 사이트가 아니다. **기존 시장의 구조적 문제를 뒤집는 것**이 핵심이다.

### 기존 시장의 문제
- 대부분의 견적 사이트 = 실제 견적이 목적이 아니라 **상담 DB 수집**이 목적
- 이름/전화번호 입력해야 견적 보여줌
- 견적이 미끼고, 실제로는 영업전화를 받게 되는 구조
- 고객은 비교하는 게 아니라 영업당하는 느낌

### 아임딜러가 뒤집는 것
- 고객이 **먼저 탐색하고, 먼저 이해하고, 먼저 신뢰**한 뒤 상담으로 연결
- 개인정보 없이도 견적을 볼 수 있음
- AI가 차량을 추천하고 이유를 설명
- 상담은 그 이후 자연스럽게 채널톡으로 연결

> **절대 원칙**: "상담접수형 구조로 보이면 실패다"

---

## 2. 3단계 로드맵

| 단계 | 목표 | 핵심 |
|------|------|------|
| **1단계** ← 현재 | 시장 진입 | 프론트 경험, AI 인상, 신뢰 구조, 빠른 베타 오픈 |
| 2단계 | 고객 리텐션 | 계약 후에도 관계 유지 (보험·사고·운행일지) |
| 3단계 | 플랫폼 확장 | 소형 에이전시 대상 SaaS CRM |

**현재는 1단계만 개발 중이다.** 단, 2·3단계 확장을 고려한 구조로 설계되어 있다.

---

## 3. 기술 스택

| 항목 | 기술 | 이유 |
|------|------|------|
| 프레임워크 | **Next.js 14** (App Router) | SSR + API Routes 통합 |
| 언어 | **TypeScript** | 전체 코드베이스 |
| 스타일링 | **Tailwind CSS** | 커스텀 디자인 토큰 포함 |
| DB | **PostgreSQL** (Supabase) | 관리형 DB + Row Level Security |
| ORM | **Prisma** | 타입 안전한 DB 접근 |
| Supabase | 인증·스토리지 용도도 고려 | 현재 DB 연결 목적 |
| 아이콘 | **Lucide React** | |
| 유틸 | **clsx, tailwind-merge** | 조건부 클래스 |
| 검증 | **Zod** | API Route 입력값 검증 |

---

## 4. 프로젝트 구조 한눈에 보기

```
src/
├── app/
│   ├── (public)/          # 고객용 페이지 그룹
│   │   ├── layout.tsx     # 공통 Header 포함
│   │   ├── page.tsx       # 홈 (/)
│   │   ├── recommend/     # AI 추천 (/recommend)
│   │   ├── cars/          # 차량 탐색 (/cars, /cars/[slug])
│   │   ├── quote/         # 견적 계산기 (/quote)
│   │   └── about/         # 브랜드 소개 (/about)
│   │
│   ├── (admin)/           # 관리자 페이지 그룹
│   │   ├── layout.tsx     # 사이드바 포함
│   │   └── admin/         # (/admin, /admin/vehicles, ...)
│   │
│   └── api/               # API Routes
│       ├── vehicles/      # 차량 API
│       ├── recommend/     # AI 추천 API
│       └── logs/          # 탐색 로그 API
│
├── components/
│   ├── ui/                # 디자인 시스템 원자 컴포넌트
│   ├── layout/            # Header, BottomNav
│   ├── home/              # 홈 섹션 컴포넌트
│   ├── recommend/         # AI 추천 플로우 컴포넌트
│   ├── cars/              # 차량 관련 컴포넌트
│   ├── quote/             # 견적 관련 컴포넌트
│   └── admin/             # 관리자 컴포넌트
│
├── lib/
│   ├── prisma.ts          # Prisma 클라이언트 싱글톤
│   ├── supabase.ts        # Supabase 클라이언트
│   ├── ai-recommender.ts  # AI 추천 엔진 (핵심)
│   ├── quote-calculator.ts # 견적 계산 로직 (순수 함수)
│   └── use-tracking.ts    # 탐색 로그 훅
│
├── types/                 # TypeScript 타입 정의
├── constants/             # 디자인 토큰, mock 데이터, 기본값
└── prisma/
    ├── schema.prisma      # DB 스키마 (전체 모델 정의)
    ├── migrations/        # 마이그레이션 이력
    └── seed.ts            # 초기 데이터 스크립트
```

---

## 5. 페이지별 역할

### 고객용 (Public)

| 경로 | 역할 | 핵심 포인트 |
|------|------|-------------|
| `/` | 홈 | AI 추천 진입 유도, 브랜드 첫인상, 신뢰 요소 노출 |
| `/recommend` | **AI 추천** | 업종→목적→예산→성향 4단계 입력 후 추천 결과 |
| `/cars` | 차량 탐색 | 전체 차량 목록, 카테고리·브랜드 필터 |
| `/cars/[slug]` | 차량 상세 | 트림·옵션 선택, 견적 미리보기 |
| `/quote` | 견적 계산기 | 조건 직접 입력 → 3가지 시나리오 견적 |
| `/about` | 브랜드 소개 | 아임딜러 철학, 신뢰 요소 |

### 관리자용 (Admin)

| 경로 | 역할 |
|------|------|
| `/admin` | 대시보드 |
| `/admin/vehicles` | 차량 등록·수정·노출 관리 |
| `/admin/vehicles/[id]/trims` | 트림 관리 |
| `/admin/quote-variables` | 금리·잔존가치 등 견적 운영값 |
| `/admin/recommendations` | AI 추천 기초 데이터 |
| `/admin/content` | 메인 배너·프로모션·공지 |
| `/admin/logs` | 탐색 흐름·추천 클릭 로그 |
| `/admin/notes` | 운영 메모 |

---

## 6. 핵심 비즈니스 로직

### 6-1. AI 추천 엔진 (`src/lib/ai-recommender.ts`)

외부 AI API 없이 **규칙 기반 스코어링**으로 구현되어 있다.

```
동작 흐름:
1. DB에서 노출 가능한 차량 전체 조회
2. 차량의 vehicleCode로 금융사별 RateConfig 조회
3. 각 차량의 예산 적합도 계산 (월 납입금 추정)
4. 업종·목적별 스코어 행렬(RecommendationConfig)로 추가 점수 부여
5. 종합 점수 상위 3개 차량 추천
6. 추천된 차량에 대해 3가지 시나리오(보수형/표준형/공격형) 계산
```

**향후 방향**: 탐색 로그 데이터 축적 → 2단계에서 ML 기반으로 고도화

---

### 6-2. 견적 계산 로직 (`src/lib/quote-calculator.ts`)

순수 함수로 구현되어 있다 (DB 의존 없음, 테스트 용이).

```
월 납입금 = (차량가 × (1 - 잔존가치율) × (1 - 선납금비율) × 금리계수)
           + (수수료율 × 차량가 / 계약기간)
           + (세금 + 부대비용 / 계약기간)
           - 프로모션할인 / 계약기간
```

**3가지 시나리오**:
- **보수형**: 낮은 약정거리, 높은 보증금 → 월 납입 낮음, 안전한 선택
- **표준형**: 균형 조건 → **기본 추천 (UI에서 강조)**
- **공격형**: 높은 약정거리, 낮은 보증금 → 월 납입 가장 낮음, 공격적 운용

---

### 6-3. 데이터 모델 핵심 관계

```
Vehicle (차량)
  └── Trim[] (트림)
        └── TrimOption[] (옵션)
        └── QuoteVariable[] (견적변수 ← 금리·잔존가치 등)

FinanceCompany (금융사)
  └── RateConfig[] (회수율 매트릭스 ← 금융사×차명 단위)

RecommendationConfig (AI 추천 기초 데이터 ← 운영자 관리)
  └── scoreMatrix: { "업종": { "목적": 점수 } }

RecommendationLog (추천 로그 ← AI 고도화용 데이터)
ExplorationLog (탐색 로그 ← 이탈 지점 파악용)
```

---

## 7. API 엔드포인트

### 공개 API

| Method | 경로 | 설명 |
|--------|------|------|
| GET | `/api/vehicles` | 차량 목록 (category, brand, sort, page 필터) |
| GET | `/api/vehicles/[slug]` | 차량 상세 + 트림 목록 |
| GET | `/api/vehicles/[slug]/quote` | 차량 기반 견적 계산 |
| POST | `/api/recommend` | AI 추천 (업종·목적·예산·성향 입력) |
| GET | `/api/recommend/[sessionId]` | 추천 결과 재조회 |
| POST | `/api/logs/exploration` | 탐색 흐름 기록 |
| POST | `/api/logs/recommendation-click` | 추천 차량 클릭 기록 |
| POST | `/api/logs/quote-view` | 견적 결과 조회 기록 |

### 관리자 API (구현 예정)

| Method | 경로 | 설명 |
|--------|------|------|
| CRUD | `/api/admin/cars` | 차량 관리 |
| CRUD | `/api/admin/cars/[id]/trims` | 트림 관리 |
| GET/PUT | `/api/admin/quote-variables` | 견적 변수 |
| CRUD | `/api/admin/content` | 배너·콘텐츠 |
| GET | `/api/admin/logs` | 탐색·추천 로그 |

---

## 8. 디자인 시스템

`DESIGN.md`에 전체 정의되어 있다. 핵심만 요약:

### 컬러 팔레트

| 역할 | 색상 | 용도 |
|------|------|------|
| Primary | `#000666` (Deep Navy) | CTA, 활성 상태, 핵심 UI |
| Secondary | `#71749A` (Slate Blue) | 보조 텍스트, 비활성 상태 |
| Tertiary | `#5C1800` (Deep Burgundy) | 파괴적 상태, 3차 액션만 |
| Neutral | `#F8F9FA` | 페이지 배경 |

### 개발 원칙
- **Desktop-First**: 1280px 기준으로 설계, 모바일은 `max-md:` 프리픽스로 최소 대응
- **Max content width**: 1200px
- **카드 radius**: `12px` / **버튼 radius**: `8px`
- Tailwind 커스텀 토큰은 `tailwind.config.ts`에 정의되어 있음

### 주요 UI 규칙
- 상담접수 유도 버튼/문구 절대 금지
- "월 xx원부터"처럼 최저가 강조 금지
- 신뢰 배지(허위견적 없음, 개인정보 없이 견적 확인, 상담 압박 없음)는 자연스럽게 배치

---

## 9. 환경 설정

### 필요한 환경변수 (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=              # Supabase pooler (포트 6543)
DIRECT_URL=                # Supabase direct (포트 5432, 마이그레이션용)
```

### 로컬 실행

```bash
# 의존성 설치
npm install

# DB 마이그레이션 (이미 적용됨)
npx prisma migrate deploy

# 초기 데이터 입력 (차량/트림/견적변수 등)
npx prisma db seed

# 개발 서버 실행
npm run dev
```

---

## 10. 현재 개발 상태 및 남은 작업

### 완료된 것

- ✅ 전체 공개 페이지 UI (홈, 추천, 차량, 견적, 소개)
- ✅ AI 추천 4단계 플로우
- ✅ 견적 계산 로직 (3가지 시나리오)
- ✅ 공개 API Routes
- ✅ Prisma 스키마 + DB 마이그레이션
- ✅ 탐색 로그 수집 구조

### 진행 중 / 남은 것

- ❌ **관리자 인증** — 현재 `/admin`이 인증 없이 접근 가능
- ❌ **Admin API Routes** — 파일 0개, 모든 관리자 기능 미구현
- ❌ **관리자 페이지** — 대시보드·차량목록만 존재 (mock 데이터)
- ❌ **DB 실제 데이터** — 차량/트림/견적변수 데이터 없음
- 🔶 **Quote 저장/공유** — `/api/quote/save`, `/quote/[id]` 미구현
- 🔶 **API 경로 불일치** — 스펙은 `/api/cars`지만 현재 `/api/vehicles`

> 상세 내용은 `PRODUCTION_CHECKLIST.md` 참고

---

## 11. 참고 문서

| 문서 | 내용 |
|------|------|
| `imdealers-RFP.md` | 서비스 철학, 3단계 로드맵, 핵심 원칙 |
| `PROJECT_SPEC.md` | 페이지 목록, 컴포넌트 구조, DB 스키마, API 목록 |
| `DESIGN.md` | 디자인 시스템 전체 (컬러, 타이포, 컴포넌트 스펙) |
| `PRODUCTION_CHECKLIST.md` | 배포 전 미완성 항목 체크리스트 |
| `prisma/schema.prisma` | DB 모델 전체 정의 |

---

## 12. 자주 헷갈리는 것들

**Q. AI 추천이 ChatGPT 같은 걸 쓰나요?**  
A. 아니다. 외부 AI API 없이 규칙 기반 스코어링으로 구현되어 있다. `src/lib/ai-recommender.ts` 참고.

**Q. 인증은 어떻게 되어 있나요?**  
A. 현재 고객용 페이지는 인증이 없다 (비회원 세션 UUID 방식). 관리자 인증은 아직 미구현 상태다.

**Q. 차량 데이터는 어디서 관리하나요?**  
A. 관리자 페이지(`/admin`)에서 직접 등록한다. 현재는 mock 데이터를 쓰고 있고, 관리자 기능 구현 후 실제 DB 데이터로 전환 예정이다.

**Q. 견적이 실제 계약 가능한 금액인가요?**  
A. 운영자가 `QuoteVariable`(금리·잔존가치율·수수료율 등)을 관리자 페이지에서 직접 입력하고, 그 값으로 계산한다. 유인용 최저가 방식이 아닌 실제 운영 가능한 견적이 원칙이다.

**Q. 채널톡은 뭐예요?**  
A. 고객 상담 채널이다. 견적 확인 후 "상담 요청" 클릭 시 채널톡으로 연결된다. `src/components/quote/ChannelTalkButton.tsx` 참고.
