# 오릭스(ORIX) 캐피탈 스크래핑 — 역설계 노트

> 라이브 정찰(2026-06-12)로 파악한 오릭스 견적 사이트 구조. 어댑터 작성·유지보수용.
> 정찰 도구: `inspect-login.mjs` / `inspect-postlogin.mjs` / `inspect-quote.mjs` /
> `inspect-result.mjs` / `inspect-flow.mjs` / `inspect-api.mjs` (자격증명은 `.env` 의
> `SCRAPER_TEST_USER`/`SCRAPER_TEST_PASS`).

## 로그인 — `https://nf.orix.co.kr/com/login.frm`
- 셀렉터: `#usrId`(아이디), `#usrPw`(비밀번호), `#login`(버튼 → `goLogin()`).
- **키보드보안/캡차 없음** → `page.type()` 자동 입력 가능. 비번은 `crypto-js` 로 클라이언트
  암호화되어 `/COM0000.act`(`txGbCd:LOGIN`)로 전송됨 → 실제 input 채우고 버튼만 누르면 됨.
- **2FA 없음**(이 계정 기준). 로그인 성공 시 `/com/main.frm` 으로 이동.
- 견적 메뉴: `goPageMenu('/sit/sit0001.frm')` = 렌터카(장기렌트), `/sit/sit0002.frm` = 오토리스(리스).

## 내부 API — `POST /SIT0001.act` (JSON, `txGbCd` 로 분기)
응답: `{ LIST: [...], APP_HEADER: { respCd: "N00000"(정상), respMsg } }`.
로그인 세션 쿠키만 있으면 `page.evaluate(fetch('/SIT0001.act', {method,headers:{'Content-Type':'application/json'},body}))`
로 **헤드리스 직접 호출 가능**(리플레이 검증 완료).

| txGbCd | 의미 | 주요 파라미터 |
|---|---|---|
| `CONS_COMBO1` | 탁송사/브랜드 콤보 | — |
| `CAR_COMBO_1` | 브랜드→모델 | `LS_WORK_KUBUN`(렌터카=CF100006), `BRAND_CD`, `PRE_ADC_YN`(N) → `[{MDL_CD,MDL_NM}]` |
| `CAR_COMBO_2` | 모델→세부차종 | `LS_WORK_KUBUN`, `BRAND_CD`, `MDL_CD`, `PRE_ADC_YN` → `[{DT_MDL_CD,DT_MDL_NM,...}]` |
| `CAR_COMBO_3` | 세부차종→트림 | `LS_WORK_KUBUN`, `BRAND_CD`, `DT_MDL_CD`, `PRE_ADC_YN` → 트림별 `{CAR_CD, MDEL_NAME2(트림명), MDEL_PRICE(가격), NC_MODEL_ID, NC_GRADE_ID, RV_RANK, OPER_RV_KUBUN, IMPDOM_KUBUN, ENGINE_TYPE_NM, MDEL_YEAR...}` |
| `CAR_COMBO_4` | 트림→색상 | `NC_MODEL_ID` → `[{BCC_NAME(색상명), BCC_PRICE(추가금)}]` |
| `SEL_RV_LIST` | **잔가율(회수율) 그리드** | `LS_WORK_KUBUN`, `SHIPMENT_KUBUN`, `IMPDOM_KUBUN`, `MDEL_CD`(=CAR_CD), `RV_RANK`, `OPER_RV_KUBUN` → `[{KIKAN(기간), MT_DIST(거리), STD_RV_RATE, RV_RATE, OPER_RV_RATE, PM_RV_RATE, CR_RV_RATE}]` (기간 12~72 × 거리 1만~4만 = 30칸) |
| `SPECIFIC_TAX_CAL` | 개별소비세 계산(계산 일부) | `SHIPMENT_KUBUN`, `MDEL_CD`, `LOAD_AMT`(차량가) |

### API 카탈로그 수집 (검증됨 — scrape-sorento.mjs)
로그인 후 위 콤보 API 만으로 **차량 카탈로그 전체를 안정적으로 수집** 가능(DOM 불필요).
- 쏘렌토 실측: 세부차종 2(하이브리드 24트림 / 디젤·가솔린 48트림 = 총 72), 각 트림 정확한 가격·색상 5종 수집 성공.
- `node scripts/scraper-worker/scrape-sorento.mjs` → `%TEMP%/orix-sorento.json`.

### ⚠️ 잔존율(회수율) / 월 렌트료 값은 "계산 단계"에서만 채워짐
- `SEL_RV_LIST` 는 기간×거리 **그리드 차원**은 반환하나 rate 값은 빈 칸으로 옴(`MDEL_CD=CAR_CD` 시 그리드, `NC_MODEL_ID` 시 빈 목록).
- 실제 잔존율·월 렌트료는 **차량 완전구성(외장/내장 색상)→고객구분→출고구분→탁송→계산하기** 까지 끝낸 뒤에야 산출됨.
- 그런데 이 폼의 **출고구분 라디오·잔존율 select 등은 커스텀 컨트롤이라 in-page 합성 클릭(untrusted)·page.click 모두 핸들러 발화 실패**, 색상도 별도 위젯이라 DOM 자동화로 계산까지 도달하지 못함(inspect-calc.mjs 진단 기록).
- **다음 단계 후보**: (a) 계산하기가 호출하는 최종 calc txGbCd 를 실제 완료된 견적에서 1회 캡처해 API 리플레이, 또는 (b) puppeteer 좌표 클릭/색상 위젯까지 포함한 완전한 UI 구동. (a) 가 견고함.

## ✅ 월납입금 계산 완전 해독 (CAL_LSRYOW — 그랜저 정답 won 단위 재현 검증)
계산하기 = `txGbCd: CAL_LSRYOW` (`/SIT0001.act`). **응답 `LSRYO` = 월납입금.** 페이로드 `NOT_WRNT_RV` = 잔존율(입력).
capture-quote.mjs 로 실제 견적 1건 캡처 → 파라미터 출처를 전부 역매핑 → scrape-monthly.mjs 로 일반화.
검증: 그랜저 1.6 아너스 36/48/60개월 = 803,500 / 742,330 / 695,820 **정확 일치**.

**파라미터 출처**
- 트림 코드(CAR_COMBO_3): `MDEL_CD`, `CAR_INSU_KUBUN`, `CAR_MT_KUBUN`, `OPER_RV_KUBUN`, `RT_MT_RATE`, `RT_SELF_CAR_RATE`, `IMPDOM_KUBUN`, `KIRATE_2015`, `MDEL_PRICE`, `BASE_AMT`, `RV_RANK`, `STD_RV_KUBUN`, `ADJ_RV_KUBUN`.
- 잔존율 `NOT_WRNT_RV`: SEL_RV_LIST 의 `RV_RATE`(기간×거리).
- 표준 상수: `LS_GOOD_CODE=0051`(정비제외), `MT_CODE=014`, `SHIPMENT_KUBUN=LI260002`(대리점), `LS_GOOD_CLASS=CF200009`, `CF_PRI_KUBUN=DA110001`, `DRIVE_SPEC=RT140026`, `SPC_KUBUN=RT130004`, `INSU_SPEC_KUBUN=N`.
- `MT_DIST` 코드: 1만=`LH120001`, 2만=`LH120002`, 3만=`LH120003`.

**금액 공식(모두 그랜저 정답 재현 확인)**
- `LOAD_AMT = ceil10( GET_SUPPLAYAMT[AMT_KUBUN=1].LOAD_AMT )`  (공급가, 10원 올림)
- 개소세 `SPECIFIC_TAX = SPECIFIC_TAX_CAL(LOAD_AMT=총차량가)`; 취득세 `GET_TAX = REG_TAX_CAL(LOAD_AMT)`
- `lsAmount = LOAD_AMT + GET_TAX + 65000`
- `notRvAmt = round( 총차량가/1.1 × 잔존율% )`   (총차량가 = MDEL_PRICE + 색상가)
- `ADDON_SPEND_W = ceil10( SPECIFIC_TAX / 기간 )` ; `ADDON_CAR_TAX = ceil10( BASE_AMT/10 )` ; `ADDON_TST_FEE = 2600`(상수)
- **우리 회수율 = LSRYO / 차량가** (quote-calculator 의 calcRateMatrix 와 동일).

**미검증(권장: 쏘렌토 1트림 수기 대조)**: 소액 고정값(ADDON_TST_FEE 2600, lsAmount 의 +65000, ADDON_CAR_TAX 공식)은 그랜저 1건으로만 확인 — 타 차종 1건 교차검증 권장. 색상은 기본(0원) 기준 수집.

## 차량 선택 cascade (브랜드→모델→세부차종→트림→외장/내장색상)
페이지 전역 함수로 구동(클릭 또는 `page.evaluate` 직접 호출):
1. **브랜드**: `getBrandCd('<BRAND_CD>')`. 버튼 `<li id="<BRAND_CD>" onclick="getBrandCd(...)">`.
   코드: 현대 `CA100001`, 제네시스 `CA100088`, 기아 `CA100002`, 쉐보레 `CA100045`,
   르노코리아 `CA100004`, GMC `CA100060`, KGM `CA100005`, 대창모터스 `CA100095`.
   → `inqModel(brandCd)` 가 `CAR_COMBO_1` 호출, `#mdl .choose` 에 모델 렌더.
2. **모델**: `<li id="<MDL_CD>" onclick="inqDtlMdl(this)" data-mdlcd="<MDL_CD>">`. 클릭 → 세부차종 조회.
   (기아 예: EV3/EV4/EV5/EV6/EV9/K5/K8/K9/PV5/니로/레이/모닝/셀토스/스포티지/쏘렌토/카니발)
3. **세부차종**: `#dtlMdl .swiper-slide`, `data-dtlmdlcd`/`data-dtmdlimgtemp`. 클릭 → `inqTrim(this)` → 트림 조회.
4. **트림**: `#trim input[name="trim"]` 라디오 + `label`(트림명 + 가격). 선택 시 `estmtCar.CAR_AMT`(차량가) 세팅.
5. `setCarInfo()` 가 선택값(brand/model/dtlMdl/trim/CAR_AMT)을 `estmtCar` 에 확정.

상태는 전역 `estmtCar`(Map): `LS_WORK_KUBUN`, `SHIPMENT_KUBUN`, `IMPDOM_KUBUN`(국산 CK120002/수입),
`MDEL_CD`, `TOT_CAR_AMT`/`CAR_AMT`, `condition1/2/3`(LEASE_KIKAN, LS_GOOD_CODE...).

## 계약조건 (`#condition` 섹션)
- 상품명 `select[name="lsGoodCode"]`: `0049` 만기선택형(정비포함) / **`0051` 만기선택형(정비제외, 기본)** / `0075` 만기인수형(수입차).
- 기간 `select[name="leaseKikan"]`: 24/36(기본)/48/60.
- 약정거리 `select[name="mtDist"]`: 10000/15000/20000(기본)/30000/40000/999999. (우리 키: 10000/20000/30000)
- 정비 `select[name="mtproductCode"]`: `014` 정비미포함(정비제외 시 기본·disabled) / `015` 오릭스 정비 Premium.
- 선납금 `[name="prepayAmt"]`, 보증금 `[name="wrnt"]`: **팝업**(`openPopup('PopUp08')`)으로 % 입력.
- 잔존가치 `select[name="rvRate"]` + 만기인수가격 표시 `.residual .num .red`.
- 고객구분 라디오: 개인 `#radio-3`(기본 선택), 개인사업자 `#radio-4`, 법인 `#radio-5`.
- 출고구분 라디오: 특판출고 `#radio-1`(SHIPMENT_KUBUN `LI260001`), 대리점출고 `#radio-2`(`LI260002`).

## 계산 (`계산하기`)
- `calcRentFee()` 핸들러(`#condition .active` 클릭). **검증**: 출고구분(release) 필수,
  국산차(`IMPDOM_KUBUN==CK120002`)+SHIPMENT_KUBUN 세팅 시 **탁송방법(`#deliType`)·출고지(`#fromArea`)·도착지(`#toArea`) 필수**.
- 이후 `calcSpend(index)` 등으로 개소세·렌트료 산출 → **월납입금이 `#calcPayment .num` 에 표시**.
- 결과표: T0(조건: 렌트기간/만기처리/약정거리/정비/선납/보증/만기인수가격), T1(매회 렌트료/선납/납입/초기납입액).

## 우리 데이터 모델 매핑 (`mapping.ts` / `ScrapeDraft`)
- `vehiclePrice` ← `CAR_AMT`(트림 선택 후).
- `baseRates["<기간>_<거리>"]` ← 선납0·보증0 으로 leaseKikan×mtDist 조합별 `계산하기` → 월납입금. (36/48/60 × 10000/20000/30000 = 9칸)
- `depositRate36_10000` ← 보증금 팝업 세팅 후 36/10000 계산. `prepayRate36_10000` ← 선납금 세팅 후.
- **회수율(잔가율)** 자체는 `SEL_RV_LIST`/`rvRate`/만기인수가격에 있음 — 우리가 저장하는 건 결과 "월납입금"이지만,
  회수율 값 자체를 별도 기록하려면 draft 확장 필요(현재 모델엔 칸 없음 — 운영 정책 확인 후 결정).

## 어댑터 작성 시 config 로 주입할 값 (기본값)
```
{
  "adapter": "ORIX",
  "lsGoodCode": "0051",        // 만기선택형(정비제외) — 사용자 확정
  "client": "radio-3",          // 개인 — 사용자 확정
  "shipment": "radio-2",        // 대리점출고(대리점 계정) — 기본값, 검증 필요
  "delivery": { "deliType": "...", "fromArea": "...", "toArea": "..." }, // 국산차 탁송 필수
  "trimMap": { "<우리trimId>": { "brandCd":"CA100002","mdlCd":"쏘렌토","dtlMdlCd":"...","trimLabel":"1.6 프리미엄 [5인승]" } }
}
```

## 남은 검증 (헤드풀 1회 권장)
- 전체 happy-path(브랜드→…→트림→출고/탁송→계산)로 `#calcPayment .num` 실제 수집 확인.
- **출고구분(특판/대리점)** 과 **탁송 기본값**: 수기 견적 시 실제로 고르던 값 확정 필요(월납입금에 영향).
- 잔존율(`rvRate`/`RV_RANK`) 자동값 사용 여부.
