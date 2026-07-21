# 캐피탈사 회수율 스크래퍼 워커

관리자 PC에서 실행하는 독립 Node 프로세스. 백엔드(`/api/worker/scrape-jobs/*`)를 폴링해
작업을 가져오고, puppeteer로 캐피탈사에 로그인→세션 유지→차량별 회수율을 수집해
**초안(draft)** 으로 보고한다. 확정(반영)은 어드민이 관리자 페이지에서 검토 후 수행한다.

> Vercel 서버리스는 장시간 브라우저 세션을 유지할 수 없어, 스크래핑은 이 로컬 워커가 담당한다.

---

## 담당자용 — 더블클릭 설치 (개발 지식 불필요)

수집을 담당할 직원 PC 에서는 아래 두 파일만 쓰면 됩니다. 터미널을 열 필요가 없습니다.

| 파일 | 언제 |
|---|---|
| **설치하기.bat** | 처음 한 번만 |
| **수집 시작.bat** | 수집할 때마다 |

**설치하기.bat** 이 하는 일: Node.js 확인(없으면 설치 페이지를 열어줌) → 필요한 파일 설치 →
Chrome/Edge 자동 탐지 → 접속 정보 3개 입력받아 저장 → 연결 점검.

담당자에게 **아래 3가지를 미리 전달**해 주세요. 설치 중 붙여넣게 됩니다.

```
1) 서버 주소      예: https://imdealer.co.kr
2) 워커 비밀키    백엔드의 SCRAPER_WORKER_SECRET
3) 암호화 키      백엔드의 PII_ENCRYPTION_KEY
```

> 🔐 3번은 **민감한 키**입니다. 메신저보다 직접 전달이나 비밀번호 관리자를 쓰세요.
> 이 키를 가진 PC 가 늘어날수록 위험도 늘어납니다.

문제가 생기면 담당자가 **화면을 캡처해 보내면** 됩니다. 점검 결과에 무엇이 잘못됐고
어떻게 고쳐야 하는지 한글로 표시됩니다.

---

## 개발자용 — 수동 셋업

### 1. 런타임 준비

```powershell
node -v          # 20 이상. 없으면 https://nodejs.org 에서 LTS 설치
corepack enable  # pnpm 활성화 (전역 pnpm 설치 불필요)
```

저장소를 받은 뒤 루트에서:

```powershell
corepack pnpm install
corepack pnpm prisma generate
```

### 2. 환경변수

`scripts/scraper-worker/.env.example` 를 같은 폴더에 `.env` 로 복사한 뒤 채웁니다.

| 키 | 값 | 주의 |
|---|---|---|
| `WORKER_API_BASE` | 백엔드 주소 | 로컬 `http://localhost:3000`, 운영은 배포 도메인 |
| `SCRAPER_WORKER_SECRET` | 백엔드와 동일 | 다르면 모든 요청이 401 |
| `PII_ENCRYPTION_KEY` | 백엔드와 **바이트 단위로 동일** | 아래 경고 참고 |

> ⚠️ `PII_ENCRYPTION_KEY` 가 틀리면 **에러 없이 조용히 실패**합니다. 워커가 작업을 하나
> 가져간 뒤에야 "자격증명 복호화 실패"로 끝나므로 원인을 찾기 어렵습니다.
> 그래서 워커는 기동 시 백엔드와 키 지문을 대조하고, 다르면 시작을 거부합니다.

### 3. Chromium 확보 (택1)

- `.env` 의 `PUPPETEER_EXECUTABLE_PATH` 에 이미 설치된 Chrome/Edge 경로 지정 — **권장**
  ```
  PUPPETEER_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
  ```
- 또는 `pnpm-workspace.yaml` 의 `puppeteer: false` → `true` 로 바꾸고 `corepack pnpm install`
  (Chromium 을 따로 내려받습니다)

### 4. 점검

```powershell
corepack pnpm scraper:doctor
```

환경변수·브라우저·백엔드 연결·시크릿·암호화 키 일치를 한 번에 확인하고,
실패한 항목마다 무엇을 고쳐야 하는지 알려줍니다. **모두 통과한 뒤에 실행하세요.**

## 실행

```powershell
# (백엔드가 떠 있어야 함. 로컬이면 다른 창에서 corepack pnpm dev)
corepack pnpm scraper:worker
```

기동 시 preflight 점검을 자동으로 수행하며, 키 불일치·인증 실패면 작업을 가져가지 않고 종료합니다.

## 캐피탈사별 특성

자격증명은 PC 에 저장하지 않습니다. 관리자 페이지에서 작업을 시작할 때마다 입력하며,
서버가 암호화해 작업 행에만 잠시 보관하고 끝나면 지웁니다.

| 캐피탈사 | 수집 방식 | 사람 개입 |
|---|---|---|
| ORIX | 내부 API | 불필요 — 무인 실행 가능 |
| WOORIFC | 내부 API | **필요** (키보드보안·2FA) |
| SHINHAN | 내부 API | **필요** |
| JBWOORI | DOM 자동화 | **필요** |
| MERITZ | 엑셀 업로드 | 워커 미사용 — 관리자 페이지에서 `.xlsm` 업로드 |
| MG | 엑셀 업로드 | 워커 미사용 — 동일 |

## 작업 흐름

관리자 페이지(회수율 관리)에서 캐피탈사를 고르고 "회수율 정보 가져오기"를 누르면
작업이 큐에 쌓이고, 폴링 중이던 워커가 가져가 수집합니다.

사람 개입이 필요한 3개사는 워커가 창을 띄우고 `needs_human` 상태로 대기합니다.
PC 앞에서 인증을 마친 뒤 관리자 페이지에서 **[재개]** 를 누르면 이어서 진행합니다.
따라서 **이 세 곳은 무인 상시 실행이 불가능**합니다.

수집 결과는 **초안**으로 저장됩니다. 관리자가 검토 화면에서 확인해야 실제 회수율에 반영됩니다.

> Chromium sandbox 는 기본 활성화입니다. sandbox 를 지원하지 않는 개발 컨테이너에서만
> `NODE_ENV=development` 와 `SCRAPER_DISABLE_SANDBOX=true` 를 함께 설정하세요.
> production 에서는 무시됩니다.

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
