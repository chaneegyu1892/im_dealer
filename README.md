# 아임딜러 (im-dealer)

장기렌트 · 리스 견적 산출과 딜러 운영을 한 번에 처리하는 웹 플랫폼입니다. 검증된 금융 명세 기반의 견적 엔진, AI 차종 추천, 관리자 CRM, 고객 서류 자동 확인까지 한 저장소에 담겨 있습니다.

![Next.js](https://img.shields.io/badge/Next.js-16-black) ![React](https://img.shields.io/badge/React-19-61dafb) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6) ![Prisma](https://img.shields.io/badge/Prisma-5-2d3748) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-336791)

---

## 주요 기능

- **견적 산출 엔진** — 6단계 누적 곱셈 방식의 월 렌탈료 계산. 금융 명세에 맞춰 검증된 로직.
- **AI 차종 추천** — Google Gemini 기반으로 사용자의 산업/예산/주행 패턴에 맞는 차량 추천.
- **관리자 대시보드** — KPI 카드 5종 + 차트 4종(SVG 직접 구현), 견적/차량/재고/캐피탈사/AI 설정 일괄 관리.
- **고객 서류 자동 확인** — Codef API 연동으로 운전면허·자동차보험·사업자등록증 검증.
- **운영 안전성** — 옵티미스틱 락, 소프트 삭제, JWT 관리자 인증, Upstash Ratelimit, Sentry 모니터링.

---

## 기술 스택

| 영역 | 사용 기술 |
| --- | --- |
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS, Framer Motion, Lucide |
| Backend | Next.js API Routes, Prisma 5, PostgreSQL (Supabase) |
| 인증/보안 | jose (JWT), bcryptjs, Upstash Ratelimit |
| 외부 API | Codef, Google GenAI (Gemini), Sentry |
| 테스트 | Vitest, Testing Library |

---

## 디렉토리 구조

```
im_dealer/
├─ src/
│  ├─ app/
│  │  ├─ (public)/            고객 페이지: cars, recommend, quote, verify, login
│  │  ├─ (admin)/admin/       관리자 대시보드
│  │  └─ api/                 Route Handlers (admin / quote / recommend / verification ...)
│  ├─ components/             UI 컴포넌트 (admin, recommend, charts ...)
│  └─ lib/
│     ├─ quote-calculator.ts  견적 계산 엔진 (핵심)
│     ├─ admin-queries.ts     SSR 쿼리
│     └─ codef.ts             Codef 연동
├─ prisma/
│  ├─ schema.prisma           DB 스키마 (Vehicle, Trim, SavedQuote, AdminUser ...)
│  ├─ migrations/
│  └─ seed.ts                 시드 데이터
├─ docs/                      명세 문서 (admin-spec, quote-calculator-spec ...)
├─ public/
└─ scripts/
```

---

## 시작하기

### 사전 요구사항
- Node.js 20 이상
- PostgreSQL 데이터베이스 (Supabase 권장)

### 설치 & 실행
```bash
# 1) 의존성 설치
npm install

# 2) 환경변수 설정
cp .env.example .env
# .env 파일을 열어 값 채우기

# 3) 데이터베이스 마이그레이션 + 시드
npm run db:migrate
npx prisma db seed

# 4) 개발 서버
npm run dev
# → http://localhost:3000
```

---

## 환경변수

`.env.example`을 참고해 그룹별로 다음 키를 채워 주세요.

| 그룹 | 키 |
| --- | --- |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Database | `DATABASE_URL`, `DIRECT_URL` |
| App | `NEXT_PUBLIC_APP_URL` |
| 관리자 인증 | `ADMIN_JWT_SECRET`, `ADMIN_ACCESS_TOKEN`, `ADMIN_INITIAL_EMAIL`, `ADMIN_INITIAL_PASSWORD` |
| 보안 | `IP_HASH_SALT` |
| Codef | `CODEF_CLIENT_ID`, `CODEF_CLIENT_SECRET`, `CODEF_SANDBOX` |
| AI | `GOOGLE_GENAI_API_KEY` |
| Redis | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| Sentry | `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` |
| 알림 (선택) | `SLACK_WEBHOOK_URL` |

---

## 스크립트

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 빌드 결과 실행 |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript 타입 검사 |
| `npm run test` | Vitest 단위 테스트 |
| `npm run test:watch` | Vitest watch 모드 |
| `npm run db:generate` | Prisma Client 생성 |
| `npm run db:migrate` | 마이그레이션 |
| `npm run db:push` | 스키마 push |
| `npm run db:studio` | Prisma Studio |
| `npx prisma db seed` | 시드 데이터 주입 |

---

## 견적 계산 엔진

`src/lib/quote-calculator.ts`가 핵심입니다. 다음 규칙을 따릅니다.

- **6단계 계산**, `Math.round`는 최종 단계(금융사 가산율 적용 후)에서만 적용합니다.
- 가산율은 **순위 → 차량 → 금융사** 순서로 누적 곱셈합니다.
- `prepayAdjustRate`는 DB에 양수로 저장하고 계산 시 **차감**합니다.
- 보증금과 선납금은 **동시에 적용하지 않습니다**.
- `lerp` 외삽 금지 (t는 [0, 1]로 클램핑).

상세 명세는 [`docs/quote-calculator-spec.md`](docs/quote-calculator-spec.md)를 참고하세요.

---

## 관리자 페이지

- 색상 체계: Primary `#000666`, Accent `#6066EE`, Background `#F8F9FC`.
- 차트는 SVG로 직접 구현 (Recharts 등 외부 차트 라이브러리 미사용).
- 데이터 흐름: 초기 로드는 SSR, CRUD는 Client → API Route → Prisma.

상세 명세: [`docs/admin-spec.md`](docs/admin-spec.md), 운영 가이드: [`ADMIN_MANUAL.md`](ADMIN_MANUAL.md).

---

## 추가 문서

- [`PROJECT_SPEC.md`](PROJECT_SPEC.md) — 프로젝트 사양
- [`DESIGN.md`](DESIGN.md) — 설계 문서
- [`ONBOARDING.md`](ONBOARDING.md) — 온보딩 가이드
- [`docs/competitive-analysis-2026-04.md`](docs/competitive-analysis-2026-04.md) — 경쟁사 분석

---

## 라이선스

Proprietary — 모든 권리 보유 (All rights reserved).
