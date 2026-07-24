# 새 환경 셋업 체크리스트 (같은 Supabase 공유 방식)

이 저장소를 새 머신/환경에 **원본과 동일하게** 세팅하는 절차입니다.

> **핵심 개념**: 코드는 git에, **데이터는 Supabase(DB)에** 있습니다. git 클론/포크는 *코드만* 복사합니다.
> 같은 `.env`로 **같은 Supabase에 연결**하면 데이터(차량·트림·금리·잡 등)는 자동으로 "같이" 보입니다 — 별도 이전 불필요.
> 즉 필요한 건 **① 깃 링크(코드) + ② `.env`(연결정보)** 두 가지뿐입니다. `.env`는 gitignore라 포크에 안 따라오므로 **별도로 안전하게** 받아야 합니다.

---

## 0. 사전 준비물
- [ ] **Node 20+** (검증 환경: 24.x)
- [ ] **git**
- [ ] 원본 환경의 **`.env`** (안전하게 전달 — 공개 채널·채팅 금지, 커밋 금지)
- [ ] (스크래퍼 사용 시) **Chrome 또는 Edge** 설치

## 1. 코드 가져오기
```bash
git clone <포크 링크>
cd im_dealer
git checkout feat/capital-rate-scraper   # 작업 브랜치 (스크래퍼 포함)
```

## 2. 패키지 매니저 (pnpm) — ⚠️ 중요
이 저장소는 **pnpm 워크스페이스**입니다 (lockfile 9.0 + `allowBuilds` 문법 → **pnpm 10/11 필요**, pnpm 9는 에러).
- [ ] 전역 설치 (권장): `npm install -g pnpm`  → pnpm 11.x, 이후 `pnpm ...` 그대로 사용
- 대안(corepack): `corepack prepare pnpm@latest --activate` 후 `corepack pnpm ...`
  - ⚠️ Windows에서 `corepack enable`은 `C:\Program Files\nodejs` 권한(EPERM)으로 실패할 수 있음 → 위 `npm i -g` 방식 권장

## 3. `.env` 배치 — 데이터 연결의 핵심
원본의 `.env`(및 쓰는 경우 `.env.local`)를 **루트에 그대로** 복사. **이게 빠져서 "데이터가 안 넘어오는"** 것입니다.

| 역할 | 키 |
|---|---|
| **데이터 연결** (핵심) | `DATABASE_URL`, `DIRECT_URL` |
| Supabase 클라이언트·스토리지·인증 | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| **암호화 복호화** | `PII_ENCRYPTION_KEY` (원본과 **동일해야** 자격증명 등 복호화 가능) |
| 관리자 인증 | `ADMIN_JWT_SECRET` |
| (스크래퍼) 워커 인증 | `SCRAPER_WORKER_SECRET` |

- [ ] `.env` 복사
- [ ] `git check-ignore .env` 로 ignore 확인 (실수로 커밋 방지)

## 4. 의존성 설치
```bash
pnpm install
```
- `postinstall`이 `prisma generate`를 자동 실행합니다.

## 5. Prisma 클라이언트 — ⚠️ 함정
pnpm 심링크 타이밍상 클라이언트가 `@prisma/client did not initialize yet` 에러를 낼 수 있습니다.
- [ ] **`pnpm db:generate` 한 번 더 실행** → 해결
- 같은 Supabase는 이미 마이그레이션돼 있어 **마이그레이션 불필요**.
  (만약 *빈 새 DB*라면 `pnpm db:push` 또는 `prisma migrate deploy` 후 필요 시 `pnpm exec prisma db seed`)

## 6. 실행 + 검증
```bash
pnpm dev          # http://localhost:3000
```
- [ ] 홈 / 관리자 페이지 로드 확인
- [ ] **데이터 연결 검증**: 관리자 → 차량 관리에 차량 목록이 보이면 성공
      (또는 `pnpm db:studio` 로 Vehicle·Trim 행 수가 원본과 같은지 확인)

## 7. (선택) 스크래퍼 워커
- [ ] `scripts/scraper-worker/.env` 작성 (`.env.example` 복사):
  - `WORKER_API_BASE=http://localhost:3000`
  - `SCRAPER_WORKER_SECRET=` (백엔드 `.env`와 **동일**)
  - `PII_ENCRYPTION_KEY=` (백엔드 `.env`와 **동일**)
  - `SCRAPER_HEADFUL=true` (2FA/디버깅용 창 표시)
  - `PUPPETEER_EXECUTABLE_PATH=` ← 아래 Chromium 항목 참고
- [ ] **Chromium 확보** (pnpm은 `puppeteer:false`라 자동 다운로드 안 함):
  - 설치된 Chrome/Edge 경로를 `PUPPETEER_EXECUTABLE_PATH`에 지정, **또는**
  - `pnpm-workspace.yaml`의 `puppeteer: false` → `true`로 바꾸고 `pnpm install` (자동 다운로드)
- [ ] 백엔드(`pnpm dev`)가 떠 있는 상태에서: `pnpm scraper:worker`
- [ ] 실제 사이트 없이 안전 테스트: `pnpm scraper:mock` (localhost:4599)

---

## 자주 겪는 문제
| 증상 | 원인 / 해결 |
|---|---|
| 데이터가 비어 보임 | `.env`의 `DATABASE_URL`이 원본과 **다른 Supabase**를 가리킴 → 값 확인 |
| 자격증명 복호화 실패 | `PII_ENCRYPTION_KEY`가 원본과 다름 → 동일 키로 교체 (또는 자격증명 재등록) |
| `pnpm` 명령 없음 | `npm i -g pnpm`, 또는 `corepack pnpm ...` 사용 |
| `Prisma did not initialize` | `pnpm db:generate` 재실행 |
| 워커가 Chrome 못 찾음 | `PUPPETEER_EXECUTABLE_PATH` 지정 |

## ⚠️ 주의
- `.env`는 시크릿(DB 비밀번호·서비스 키)입니다. **안전 전달, 커밋 금지.**
- "같은 Supabase 공유"는 데이터를 **공유**합니다 → 한쪽에서 바꾸면 **양쪽 다 반영**. 운영 데이터를 보호하려면 별도 Supabase에 `pg_dump`/`pg_restore`로 **독립 복사본**을 만드세요.

---

## 부록: 데이터 이전 다른 방식
- **(B) 독립 복사본**: 원본 `pg_dump` → 새 Supabase `pg_restore` → 새 `.env`로 분리. (원본 DB 접속정보 필요)
- **(C) 시드만**: `pnpm exec prisma db seed` → `prisma/seed.ts`의 *샘플 데이터만* (원본 전체 아님).
