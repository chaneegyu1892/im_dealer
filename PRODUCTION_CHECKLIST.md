# 아임딜러 — 프로덕션 배포 체크리스트

> 작성일: 2026-04-07  
> 기준: PROJECT_SPEC.md + 실제 구현 현황 비교 분석

---

## 현재 구현 현황 요약

| 영역 | 상태 | 비고 |
|------|------|------|
| 공개 페이지 UI | ✅ 완료 | 홈, 차량목록, 차량상세, 견적, AI추천, 소개 |
| 공개 API Routes | ✅ 완료 | `/api/vehicles/*`, `/api/recommend/*`, `/api/logs/*` |
| Prisma 스키마 | ✅ 완료 | 전체 모델 정의 + 마이그레이션 적용 |
| AI 추천 엔진 | ✅ 완료 | 규칙 기반 스코어링 + 회수율 계산 |
| 견적 계산기 | ✅ 완료 | `quote-calculator.ts` (순수 함수) |
| 관리자 인증 | ❌ 없음 | 로그인/세션 전혀 없음 |
| Admin API Routes | ❌ 없음 | 디렉토리만 존재, 파일 0개 |
| 관리자 페이지 | 🔶 일부 | 대시보드·차량목록만 존재 (mock 데이터) |
| DB 실제 데이터 | ❌ 없음 | 마이그레이션만 완료, 데이터 미입력 |
| Quote API | 🔶 불완전 | 경로 불일치 + 저장/조회 미구현 |

---

## 🔴 Critical — 배포 전 필수

### 1. 관리자 인증 시스템

**현황**: `/admin/*` 전체가 인증 없이 누구나 접근 가능

**필요 작업**:
- [ ] `/admin/login` 로그인 페이지
- [ ] `src/middleware.ts` — `/admin/*` 경로 인증 게이트
- [ ] 세션 관리 (NextAuth.js 또는 Supabase Auth 중 선택)
- [ ] `AdminUser` 테이블 기반 이메일/비밀번호 인증
- [ ] 초기 관리자 계정 생성 스크립트

**권장 방식**: Supabase Auth (이미 Supabase 사용 중이므로 통합 용이)

---

### 2. Admin API Routes 전체 구현

**현황**: `src/app/api/admin/` 디렉토리 존재하지만 파일 0개

**필요 파일**:
```
src/app/api/admin/
├── cars/
│   └── route.ts          # GET(목록) / POST(등록)
├── cars/[id]/
│   └── route.ts          # GET / PUT / DELETE
├── cars/[id]/trims/
│   └── route.ts          # GET / POST
├── cars/[id]/trims/[trimId]/
│   └── route.ts          # GET / PUT / DELETE
├── quote-variables/
│   └── route.ts          # GET / PUT
├── recommendations/
│   └── route.ts          # GET / POST / PUT
├── content/
│   └── route.ts          # GET / POST / PUT / DELETE
├── logs/
│   └── route.ts          # GET (탐색·추천 로그 조회)
└── notes/
    └── route.ts          # GET / POST / PUT / DELETE
```

**모든 엔드포인트에 인증 미들웨어 적용 필수**

---

### 3. 관리자 페이지 미구현 목록

**현황**: 대시보드(`/admin`), 차량목록(`/admin/vehicles`)만 존재 — 둘 다 mock 데이터

**필요 페이지**:
```
src/app/(admin)/admin/
├── login/page.tsx                    # ❌ 없음
├── vehicles/[id]/trims/page.tsx      # ❌ 없음
├── quote-variables/page.tsx          # ❌ 없음
├── recommendations/page.tsx          # ❌ 없음
├── content/page.tsx                  # ❌ 없음
├── logs/page.tsx                     # ❌ 없음
└── notes/page.tsx                    # ❌ 없음
```

**기존 페이지 수정 필요**:
- `admin/page.tsx` — mock 데이터 → 실제 API 연동
- `admin/vehicles/page.tsx` — mock 데이터 → 실제 API 연동

---

### 4. Quote API 경로 불일치 및 미구현

**현황**:
- 스펙: `POST /api/quote/calculate`, `GET /api/quote/[id]`, `POST /api/quote/save`
- 실제: `GET /api/vehicles/[slug]/quote` 만 존재

**필요 작업**:
- [ ] `src/app/api/quote/calculate/route.ts` — POST, 독립 견적 계산 엔드포인트
- [ ] `src/app/api/quote/save/route.ts` — POST, 견적 저장 (비회원 UUID 기반)
- [ ] `src/app/api/quote/[id]/route.ts` — GET, 저장된 견적 조회
- [ ] `src/app/(public)/quote/[id]/page.tsx` — 견적 결과 공유 페이지 (프론트)

---

### 5. DB 초기 데이터 없음

**현황**: 마이그레이션 완료(`20260404091358_init`)됐지만 실제 데이터 없음  
차량 목록 페이지, AI 추천 등 모든 핵심 기능이 빈 화면으로 표시됨

**필요 작업**:
- [ ] `prisma/seed.ts` 실제 데이터 작성 (현재 파일 존재하지만 내용 확인 필요)
  - 차량(Vehicle) 최소 5~10개
  - 각 차량별 트림(Trim) 2~3개
  - 트림별 견적변수(QuoteVariable) — 금리, 잔존가치율, 수수료율 등
  - 금융사(FinanceCompany) + 회수율(RateConfig) 데이터
  - AI 추천 기초 데이터(RecommendationConfig) — 업종·목적별 스코어 매트릭스
- [ ] `npx prisma db seed` 실행 후 동작 확인

---

## 🟡 Important — 조기 해결 권장

### 6. API 경로 불일치 확인

프론트엔드가 호출하는 경로 vs 실제 구현 경로:

| 스펙 경로 | 실제 구현 경로 | 상태 |
|-----------|---------------|------|
| `GET /api/cars` | `GET /api/vehicles` | 불일치 |
| `GET /api/cars/[slug]` | `GET /api/vehicles/[slug]` | 불일치 |
| `GET /api/cars/popular` | 미구현 | ❌ |

`CarDetailClient.tsx`에서 404가 발생하는 원인. 프론트 호출 경로와 백엔드 경로 중 하나를 통일해야 함.  
**권장**: API를 `/api/cars`로 통일 (스펙 기준)

---

### 7. 환경변수 관리

**현황**: `.env.example`은 존재하며, 운영 배포 환경변수와 OAuth Redirect 설정은 배포 플랫폼 기준으로 별도 확인 필요

**필요 작업**:
- [ ] `.env.example` 파일 생성 (값 없이 키 목록만)
- [ ] `.env.local`을 `.gitignore`에 추가 확인
- [ ] Railway 배포 시 환경변수 설정 가이드 문서화

**필요 환경변수 목록**:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
DIRECT_URL=
NEXT_PUBLIC_APP_URL=      # 운영: https://<railway-public-domain>
```

### 7-1. Supabase/Kakao OAuth Redirect 설정

Railway 운영 도메인에서 카카오 로그인이 `localhost`로 돌아가면 코드보다 Supabase Auth URL 설정을 먼저 확인한다.

**Supabase Dashboard**
- Authentication > URL Configuration
- Site URL: `https://<railway-public-domain>`
- Redirect URLs:
  - `https://<railway-public-domain>/auth/callback`
  - `http://localhost:3000/auth/callback` (로컬 개발 유지)

**Kakao Developers**
- Web 플랫폼 사이트 도메인: `https://<railway-public-domain>` 추가
- Kakao Login Redirect URI: `https://<supabase-project-ref>.supabase.co/auth/v1/callback`
- Railway 앱의 `/auth/callback`은 Kakao Redirect URI에 넣지 않는다. Supabase가 최종적으로 앱 콜백으로 보내는 목적지다.

**Railway**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL=https://<railway-public-domain>`
- 환경변수 변경 후 서비스 재시작 또는 재배포

---

### 8. Footer 컴포넌트

**현황**: 스펙에 명시됐지만 `src/components/layout/Footer.tsx` 없음  
`src/components/layout/` 아래 `Header.tsx`, `BottomNav.tsx`는 있음

---

### 9. 공개 API에 `/api/cars/popular` 없음

홈 화면 `PopularCarsSection`이 인기 차량을 어떻게 가져오는지 확인 필요.  
현재 `isPopular: true` 필터를 `/api/vehicles`에서 지원하지 않을 수 있음.

---

## 🟢 배포 인프라

### 10. 배포 설정

- [ ] `vercel.json` 또는 Vercel 프로젝트 설정
- [ ] 프로덕션 DB 연결 확인 (현재 Supabase pooler 사용 — 배포 환경에서 동일하게 적용)
- [ ] `next.config.mjs` 이미지 도메인 허용 설정 (차량 이미지 외부 URL 사용 시)

### 11. 보안

- [ ] Admin API에 인증 미들웨어 (Critical #1과 연계)
- [ ] API 레이트 리미팅 (현재 없음 — 어뷰징 가능)
- [ ] CORS 설정 확인
- [ ] `ipHash` 처리 — 개인정보보호법상 IP 수집 고지 필요 여부 검토

### 12. 에러 처리

- [ ] `src/app/error.tsx` — 전역 에러 바운더리
- [ ] `src/app/not-found.tsx` — 전역 404 페이지
- [ ] API Route 에러 응답 일관성 확인

---

## 작업 우선순위 로드맵

```
Phase 1 (배포 가능 최소 조건)
  1. DB 시드 데이터 입력           → 차량 데이터 없으면 모든 기능 무용
  2. API 경로 통일 (/api/cars)     → 현재 404 수정
  3. 관리자 인증 구현              → 보안 필수
  4. Admin API Routes 구현         → 관리자가 데이터 관리 가능하게

Phase 2 (완성도)
  5. 나머지 관리자 페이지 구현
  6. Quote 저장/공유 기능
  7. Footer 컴포넌트
  8. /api/cars/popular 엔드포인트

Phase 3 (안정화)
  9. 레이트 리미팅
  10. 에러 바운더리
  11. 배포 설정 문서화
```

---

*이 문서는 배포 진행 상황에 따라 지속 업데이트 필요*
