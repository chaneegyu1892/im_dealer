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

## 관리자 페이지

- 색상 체계: Primary `#000666`, Accent `#6066EE`, Background `#F8F9FC`.
- 차트는 SVG로 직접 구현 (Recharts 등 외부 차트 라이브러리 미사용).
- 데이터 흐름: 초기 로드는 SSR, CRUD는 Client → API Route → Prisma.

상세 명세: [`docs/admin-spec.md`](docs/admin-spec.md), 운영 가이드: [`ADMIN_MANUAL.md`](ADMIN_MANUAL.md).

---

## 추가 문서

- [`PROJECT_SPEC.md`](PROJECT_SPEC.md) — 프로젝트 사양
- [`DESIGN.md`](DESIGN.md) — 설계 문서

---

## 라이선스

Proprietary — 모든 권리 보유 (All rights reserved).
