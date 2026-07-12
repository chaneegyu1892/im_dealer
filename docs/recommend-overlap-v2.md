# AI 추천 overlap-v2 운영 명세

## 1. 기준과 범위

- 원문: `아임딜러_AI추천로직_중복가점방식 고도화_20260711.pdf`
- SHA-256: `213a63f7246c17940e9d7945210f69df5bf7798c8c48a5032f495514e0095767`
- 카탈로그: 45개 등급 묶음, 150개 차량 배치, 51개 고유 차량
- 런타임 식별자: `Vehicle.slug`. 문서 차량명은 부트스트랩/감사에서만 일치 여부를 확인한다.
- 공개 설문, 견적 공식, 차량 노출/요율 데이터는 변경하지 않는다.

소스 매니페스트는 `prisma/recommendation-overlap-v2-data.ts`, 컴파일러는
`src/lib/recommend/overlap-catalog.ts`, 독립 전사본은
`src/lib/recommend/__fixtures__/overlap-pdf-golden.ts`가 담당한다. 런타임은 부트스트랩
소스 파일을 import하지 않고 DB의 검증된 `RecommendationConfig.scoreMatrix`만 읽는다.

## 2. 점수 계약

적합도 점수는 `best=5`, `fit=3`, `support=1`, `none=0`이다.

| 축 | 가중치 |
| --- | ---: |
| 등록 형태 | 0.6 |
| 차종 기준 | 1.4 |
| 추가 조건 | 1.0 |
| 연간 주행거리 | 0.8 |
| 운행 지역 | 0.7 |

`documentScore`는 다섯 축의 `점수 × 가중치` 합이며 범위는 `0..22.5`다. 중간 반올림은
하지 않는다. `industryDetail`은 결과 근거에 기록하지만 점수에는 사용하지 않는다.

자녀 연령과 화물 종류는 별도 대형 가산축이 아니다. PDF의 `가족` 또는 `화물` 부모
등급 안에서 최종 한 등급을 고른다. 부모가 `none`이면 상세 조건도 항상 `none`이고,
근거가 있는 차량만 최대 한 단계 이동한다.

- 영유아: 슬라이딩 도어 승격, 그 외 세단 강등
- 미취학: 첨단 안전 근거가 있으면 승격
- 초등: 7인승 이상이면 승격
- 중학생 이상: SUV/세단 승격, 밴 강등
- 소형 박스: 밴 승격, SUV 유지, 세단 강등
- 대형 화물: 적재 1,000kg 이상·밴·7인승 이상 승격, SUV 유지, 세단 강등
- 근거 누락: 이동 없음

## 3. 연료와 EV 충전환경

연료는 점수 전에 강제 필터한다.

- `전기차` → `EV`
- `하이브리드` → `HEV`
- `가솔린/디젤` → `ICE`(가솔린·디젤·LPG)
- `상관없음` → 전체

트림의 `engineType` 문자열로 프로필 연료를 재분류하지 않는다. 따라서 DB 트림이
가솔린으로 표기된 HEV도 명시적 `HEV` 프로필로 정확히 처리된다.

EV 충전환경은 `best=+0.04`, `fit=+0.02`, `support=0`, `none=-0.04`의 미세 조정이다.
`rankScore = documentScore + chargingAdjustment`이며 두 값을 응답/저장 결과에 분리한다.
문서 점수의 최소 비동점 간격은 `0.1`, 충전 조정 전체 폭은 `0.08`이므로 비동점의
순서를 뒤집지 못한다.

등급 기준:

- 자택/직장: AC `>=11kW best`, `>=7kW fit`, `>0 support`, 그 외 `none`
- 외부: 10→80% `<=25분` 또는 DC `>=180kW`면 `best`; `<=35분` 또는 `>=100kW`면
  `fit`; 더 느린 DC는 `support`
- 충전환경 없음: 복합 인증거리 `>=500km best`, `>=400km fit`, `>=300km support`,
  `<300km none`

제조사 근거(접근일 2026-07-12, 각 모델 최신 공개 사양 중 보수값):

아래 근거는 EV 프로필의 충전 성능을 위한 자료이며, DB의 활성 요율 연결 여부를
의미하지 않는다. 실제 추천 가능 여부는 요청 시점의 `no_valid_active_rate` 검사를 별도로
통과해야 한다.

| 차량 | 복합 km | AC kW | DC 근거 | 공식 출처 |
| --- | ---: | ---: | --- | --- |
| Electrified G80 F/L | 475 | 11 | 10→80% 25분 | [Genesis](https://www.genesis.com/kr/ko/models/electrified-g80) |
| 더 EV3 | 347 | 11 | 10→80% 31분 | [Kia catalog](https://www.kia.com/content/dam/kwp/kr/ko/vehicles/pdf/catalog/catalog_ev3.pdf) |
| 더 뉴 아이오닉 5 | 411 | 11 | 10→80% 18분 | [Hyundai](https://www.hyundai.com/kr/ko/e/vehicles/ioniq5/intro) |
| 더 뉴 EV6 | 432 | 11 | 10→80% 18분 | [Kia catalog](https://www.kia.com/content/dam/kwp/kr/ko/vehicles/pdf/catalog/catalog_ev6.pdf) |
| 디 올 뉴 코나 EV | 311 | 11 | 10→80% 39분 | [Hyundai](https://www.hyundai.com/kr/ko/e/vehicles/kona-electric/intro) |
| 아이오닉 9 | 501 | 11 | 10→80% 24분 | [Hyundai](https://www.hyundai.com/kr/ko/e/vehicles/ioniq9/intro) |
| 더 EV5 | 342 | 11 | 10→80% 30분 | [Kia](https://www.kia.com/kr/vehicles/ev5/specification) |
| 디 올 뉴 니로 EV | 401 | 11 | DC 85kW / 43분 | [Kia price PDF](https://www.kia.com/content/dam/kwp/kr/ko/vehicles/pdf/price/price_niro-ev.pdf) |
| 캐스퍼 일렉트릭 | 248 | 11 | DC 120kW / 30분 | [Hyundai Casper](https://casper.hyundai.com/vehicles/electric/spec) |
| 더 레이 EV | 205 | 7 | 10→80% 40분 | [Kia](https://www.kia.com/kr/vehicles/ray-ev/specification) |
| GV60 F/L | 382 | 11 | 10→80% 18분 | [Genesis](https://www.genesis.com/kr/ko/models/luxury-suv-genesis/gv60/specs.html) |

근거가 빠지거나 충돌하면 해당 EV 프로필 컴파일이 실패한다. 제주 등급을 충전 등급으로
복사하지 않는다.

## 4. 운영 가능성과 순위

`assessOperationalEligibility`가 런타임·관리자·감사에서 공유된다. 요청 마일리지별로 다음
상태 중 하나를 반환한다: `excluded_vehicle_class`, `hidden`, `no_profile`,
`inactive_profile`, `invalid_profile`, `no_visible_latest_trim`, `no_valid_active_rate`,
`non_positive_quote`, `eligible`.

트림 선택 순서는 최신 노출 연식/라인업 → 활성 금융사/시트와 해석 가능한 요율 → 양수
견적 → 기본 트림 → 낮은 가격 → trim id이다. 부적격 차량으로 3대를 억지로 채우지 않아
결과는 0~3대일 수 있다.

최종 정렬은 `rankScore desc → modelYear desc → companyPriority desc → isPopular true →
profitPriority desc → slug asc`다. 회사/수익 우선순위 초기값은 0이며 관리자가 설정하기
전에는 동률이다.

다음 15개 slug와 `category=트럭`은 프로필과 무관하게 항상 제외된다.

`kia-10047`, `kia-10366`, `hyundai-10014`, `hyundai-10380`, `hyundai-10367`,
`hyundai-11753`, `hyundai-11003`, `hyundai-11067`, `hyundai-10435`,
`hyundai-10350`, `hyundai-11672`, `kia-11792`, `kg-11840`, `kg-11757`, `kg-11758`.

## 5. 엔진 선택과 동결 결과

`RECOMMEND_ENGINE_VERSION=legacy-v1|overlap-v2`가 전역 엔진을 고른다. 미설정은 배포
준비 단계의 `legacy-v1`, 정확한 `overlap-v2`만 신규 엔진이며 오타는 오류다. v2 후보가
부족하거나 설정이 잘못되어도 차량 단위 v1 폴백은 없다.

- 신규 v2 POST 저장: `{ "version": "overlap-v2", "vehicles": [...] }`
- 과거 배열: legacy 동결 결과로 그대로 읽음
- v2 빈 배열 envelope: 유효한 동결 결과이며 재계산하지 않음
- 비-NULL 잘못된 JSON: 500으로 fail closed
- 실제 SQL `NULL`: `recommendLegacyV1`로만 한 번 복구

v2 차량은 `documentScore`, `chargingAdjustment`, `rankScore`, 기여도, 모델연식/우선순위
tie-break 근거, 결정적 한국어 추천 이유를 함께 저장한다. v2는 LLM이나 `aiCaption`으로
순위/이유를 변경하지 않는다.

## 6. 관리자와 데이터 적용

`/admin/ai`는 설정 없는 차량·숨김 차량·제외 차량을 포함해 전 차량을 보여준다. 연료,
45개 기본/상세 등급, EV 충전환경, 우선순위, 활성 상태, 하이라이트와 캡션을 구조화된
컨트롤로 편집한다. 업데이트/비활성화에는 `expectedUpdatedAt`이 필요하고 stale 저장은
409를 반환한다. 제외 차량 저장은 차단하며, 잘못된 과거 설정은 파싱 없이 비활성화할
수 있다.

기본 dry-run:

```bash
node --import tsx scripts/seed-recommendation-overlap-v2.ts --dry-run
```

비운영 적용은 명시적 환경과 플래그가 모두 필요하다.

```bash
RECOMMEND_PROFILE_TARGET=staging RECOMMEND_PROFILE_APPLY=1 \
node --import tsx scripts/seed-recommendation-overlap-v2.ts --apply
```

유효한 기존 v2 프로필과 운영자 우선순위는 보존한다. 적용 전 PII 없는 스냅샷을 만들고
트랜잭션에서 `RecommendationConfig`만 변경한다.

## 7. 운영 배포와 롤백

1. 플래그 미설정 또는 `legacy-v1`로 코드를 먼저 배포한다.
2. 운영 dry-run에서 51/51 slug/문서명과 DB fingerprint를 확인한다.
3. 별도 승인 후 아래 세 가지 운영 확인값으로 적용한다.

```bash
RECOMMEND_PROFILE_TARGET=production \
RECOMMEND_PROFILE_APPLY=production-confirmed \
RECOMMEND_PROFILE_DB_FINGERPRINT=<dry-run의 정확한 fingerprint> \
node --import tsx scripts/seed-recommendation-overlap-v2.ts \
  --apply --confirm-production overlap-v2-51
```

4. 읽기 전용 전수 감사를 두 번 실행해 동일 JSON과 모든 게이트 통과를 확인한다.

```bash
node --import tsx scripts/diag/recommend-overlap-audit.ts \
  --output .omo/evidence/ai-recommend-overlap-scoring/task-11-audit/report.json
```

5. `RECOMMEND_ENGINE_VERSION=overlap-v2`로 전환하고 health/API/E2E smoke를 실행한다.
6. 문제 시 데이터 삭제 없이 플래그만 `legacy-v1`로 되돌린다.

구현 작업 자체는 운영 apply나 플래그 전환을 실행하지 않는다.
