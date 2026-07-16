# 캐피탈사 회수율 스크래퍼 워커

관리자 PC에서 실행하는 독립 Node 프로세스. 백엔드(`/api/worker/scrape-jobs/*`)를 폴링해
작업을 가져오고, puppeteer로 캐피탈사에 로그인→세션 유지→차량별 회수율을 수집해
**초안(draft)** 으로 보고한다. 확정(반영)은 어드민이 관리자 페이지에서 검토 후 수행한다.

> Vercel 서버리스는 장시간 브라우저 세션을 유지할 수 없어, 스크래핑은 이 로컬 워커가 담당한다.

## 준비

1. `.env.example` 를 `.env` 로 복사 후 채우기:
   - `WORKER_API_BASE` — 백엔드 주소 (로컬: `http://localhost:3000`)
   - `SCRAPER_WORKER_SECRET` — 백엔드 `.env` 의 같은 값과 일치
   - `PII_ENCRYPTION_KEY` — 백엔드 `.env` 와 **반드시 동일** (자격증명 복호화용)
2. Chromium 확보 (택1):
   - `pnpm-workspace.yaml` 의 `puppeteer: false` → `true` 로 바꾸고 `pnpm install` (Chromium 자동 다운로드), 또는
   - `.env` 의 `PUPPETEER_EXECUTABLE_PATH` 에 설치된 Chrome/Edge 경로 지정.

## 실행

```bash
# (백엔드가 떠 있어야 함: pnpm dev)
pnpm scraper:worker
```

관리자 페이지(회수율 관리)에서 캐피탈사 선택 → "회수율 정보 가져오기" 클릭 시,
이 워커가 작업을 가져가 자동 수집한다. 2FA/키보드보안이 필요한 사이트는 `SCRAPER_HEADFUL=true`
로 창을 띄워 직접 인증을 완료한 뒤, 관리자 페이지에서 [재개]를 누른다.

Chromium sandbox는 기본으로 활성화된다. 로컬 개발 컨테이너가 sandbox를 지원하지 않을 때만
`NODE_ENV=development`와 `SCRAPER_DISABLE_SANDBOX=true`를 함께 설정한다. production에서는 이
옵션이 무시된다.

## 목(mock) 사이트로 안전 테스트

실제 캐피탈사 없이 로그인+세션연장+수집 흐름을 검증:

```bash
pnpm scraper:mock          # http://localhost:4599 (login tester/secret)
```

`try-config.example.json`을 `try-config.json`으로 복사해 loginUrl을
`http://localhost:4599/login`으로 지정하고, `.env`에 목 로그인 값을 넣은 뒤
`pnpm scraper:try`를 실행한다. 이 경로는 DB나 관리자 자격증명 등록을 사용하지 않는다.

## 구조

- `index.ts` — 메인 루프(폴링·클레임·하트비트·세션연장·트림수집)
- `api-client.ts` — 백엔드 워커 라우트 통신
- `mapping.ts` — `buildDraftFromTrimResults` (순수함수, 단위테스트 대상)
- `adapters/` — `SiteAdapter` 인터페이스 + 사이트별 어댑터(+레지스트리)
- `mock-site/` — 테스트용 가짜 캐피탈사 서버
