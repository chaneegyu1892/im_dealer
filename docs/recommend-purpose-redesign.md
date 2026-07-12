# AI 추천 — 「목적」 질문 → 「원하는 차 느낌」 개편 설계

> **신규 세션 기준 대체됨 (2026-07-12):** 이 문서의 additive 점수와 차량 속성 추론은
> `legacy-v1` 롤백 및 과거 `result IS NULL` 복구에만 남아 있습니다. 신규 `overlap-v2`
> 기준은 `docs/recommend-overlap-v2.md`를 따릅니다. 아래 내용은 역사적 설계 기록입니다.

> 상태: **구현 완료(미배포)** · 작성/구현 2026-06-30
>
> 빌드·타입체크 통과. 스코어링 로직 9케이스 + label-consistency tsx 검증 통과
> (vitest 러너는 이 환경 Node 22 + rolldown styleText 충돌로 사용 불가 — 코드 무관).
> **DB 마이그레이션 파일은 생성됐으나 라이브 DB에 미적용** — 운영 DB 공유 상태라
> 적용 시 사용자 확인 필요. 적용 전 신규 POST/GET 은 런타임 에러.
> 관련 코드: `src/constants/recommend-options.ts`, `src/lib/recommend/scoring-rules.ts`,
> `src/lib/recommend/scoring.ts`, `src/components/recommend/RecommendFlow.tsx`,
> `src/app/api/recommend/route.ts`, `src/types/recommendation.ts`

---

## 1. 배경 / 목표

현행 2단계 「목적」 질문은 업종에 따라 3~5개 목적(출퇴근·업무용 / 영업·외근 / 화물·배달 /
임원용·의전 / 가정용)을 단일 선택시키고, 목적별 상세질문을 받는다. 그런데:

- **상세질문 3종이 점수에 전혀 반영되지 않는다** — 출퇴근(편도거리), 영업(외근 빈도),
  임원(운전 방식). 사용자에게 묻지만 결과 무영향.
- 목적 라벨이 "왜 차를 타는가"(상황) 기준이라, 정작 **차종 점수와의 연결이 간접적**이다.

### 목표

「목적」을 **"어떤 차를 원하세요?"** (차 선호 특징) 질문으로 교체한다.

- 모든 선택지가 **점수 규칙으로 직결**되도록 설계 (점수화 불가능한 옵션 배제).
- **복수 선택(최대 2개)** 허용 — 현실적 조합("크고 안정감 + 유지비") 반영.
- 정밀 점수 로직이 살아있는 **가정용·화물은 "상황형" 옵션으로 보존**.

---

## 2. 엔진이 구분 가능한 축 (설계 제약)

옵션은 반드시 아래 축의 조합으로만 만든다. (`scoring-rules.ts`, `vehicle-attributes.ts`)

| 축 | 값 / 기준 |
| --- | --- |
| 차종 `category` | `SUV` · `세단` · `밴` · `트럭` (4종) |
| 가격 프록시 | 경차·소형 `< 25,000,000` / 대형·프리미엄 `>= 50,000,000` / 의전 `>= 60,000,000` |
| 연비 `fuelEfficiency` | 고연비 `eff >= 15`, 중 `12~15`, 저 `< 12` |
| 연료 `fuel` | `EV` · `하이브리드` · `디젤` · `가솔린` · `LPG` · `수소` · `기타` |
| 속성 `VehicleAttrs` | `isAwd` · `cargoKg` · `isRefrigerated` · `seating` · `hasSlidingDoor` · `hasAdvancedSafety` · `isPopular` |

> 점수화 불가(설계 제외): 디자인/색상/브랜드 선호 등.

---

## 3. 신규 질문 설계

### 3-1. 화면

- 단계명: **"원하는 차"** (기존 "목적")
- 질문: **"어떤 차를 원하세요?"** / 보조: "가장 가까운 걸로 최대 2개까지 골라주세요"
- 2열 그리드, 카드 6개. **복수 선택(최대 2개)**.
- **상황형(`가족`·`화물`)은 둘 중 1개만 선택 가능** (확정). 따라서 허용 조합:
  - `{느낌1}` · `{느낌2}` · `{느낌1+느낌2}` · `{느낌1+상황1}` · `{상황1}`
  - 금지: `{가족+화물}`, 3개 이상.
- **상황형** 카드 선택 시 그 아래에 상세 카드가 인라인으로 펼쳐짐 (별도 스텝 없음 = A 방식).
- 업종별 분기(`PURPOSE_OPTIONS_BY_INDUSTRY`) **폐지** — 전 업종 동일 6개 노출.

### 3-2. 선택지 6개

| # | 유형 | value | 라벨 | 보조문구 | 상세질문 |
| --- | --- | --- | --- | --- | --- |
| 1 | 느낌형 | `안정감` | 크고 안정감 있는 차 | 든든한 주행감 | 없음 |
| 2 | 느낌형 | `주차편의` | 작고 주차 편한 차 | 좁은 길도 편하게 | 없음 |
| 3 | 느낌형 | `경제성` | 유지비 경제적인 차 | 연비·유류비 절감 | 없음 |
| 4 | 느낌형 | `고급` | 품격 있는 고급차 | 임원·의전용 | 없음 |
| 5 | 상황형 | `가족` | 아이와 함께 타요 | 가족·안전 우선 | 자녀 연령 (기존 유지) |
| 6 | 상황형 | `화물` | 짐을 많이 실어요 | 화물·적재 위주 | 소형/대형 (기존 유지) |

> 라벨·아이콘 문구는 확정 전 검토 대상.

---

## 4. 점수 매핑

신규 느낌형 4개는 `PREFERENCE_RULES`(신규)로 인코딩. 상황형 2개는 **기존 규칙 재사용**.

### 4-1. 느낌형 (신규 `PREFERENCE_RULES`)

```
안정감:
  SUV  & price>=LARGE_MIN   → +18  "든든한 차체와 시야로 안정적이에요"
  세단 & price>=LARGE_MIN   → +12
  isAwd                     → +10  "사륜구동으로 어떤 노면에도 안정적이에요"
  price < COMPACT_MAX       → -10        (반대 성향 페널티)

주차편의:
  price < COMPACT_MAX       → +18  "좁은 길·주차가 편한 차급이에요"
  세단                      → +6
  price >= LARGE_MIN        → -12        (반대 성향 페널티)
  밴 | 트럭                 → -8

경제성:
  eff >= 15                 → +15  "연비가 좋아 유지비를 아껴요"
  하이브리드                → +15
  EV                        → +12
  price < COMPACT_MAX       → +8
  fuelEfficiency≠null & <12 → -8

고급:
  세단 & price>=LARGE_MIN   → +20  "품격과 승차감이 검증된 차급이에요"
  SUV  & price>=LARGE_MIN   → +12
  price < COMPACT_MAX       → -20        (반대 성향 페널티)
```

### 4-2. 상황형 (기존 규칙 재사용 — 변경 없음)

```
가족  → PURPOSE_RULES["가정용"] (SUV+15, seating>=7 +12, hasAdvancedSafety+10)
       + CHILD_RULES[자녀연령]   (영유아/미취학/초등/중학생+ — 기존 그대로)

화물  → CARGO_RULES (소형박스: 밴+15/SUV+10/세단+5,
                     대형화물: cargoKg 1톤급+25 / 대형+30 / 세단·SUV-20,
                     isRefrigerated +25)
       ※ PURPOSE_RULES["화물·배달"]는 현행에서도 빈 배열이라 그대로 둠
```

### 4-3. 복수 선택 합산 규칙

- 선택된 preference 각각의 규칙셋을 적용하고 **점수는 누적 합산**.
- `reason`(추천 이유 문구)은 **중복 제거** 후 **상위 3개**만 노출(점수 높은 순). [확정]
- 상한 `MAX_SCORE = 250`, 베이스 `BASE_SCORE = 50` 유지.
- 업종 규칙(`INDUSTRY_RULES`)·주행거리×연비(`MILEAGE_FUEL_RULES`)·연료선호·거주지역 규칙은
  **현행 그대로** 추가 합산.

> 상충 조합(예: `안정감` + `주차편의`)은 페널티끼리 상쇄되어 중립차에 수렴 — 의도된 동작.

---

## 5. 데이터 모델 변경

핵심: 단일 `purpose: string` → **다중 `preferences: string[]`**.

### 5-1. 입력 타입 (`RecommendInput`)

```ts
// 변경 전
purpose: string;
purposeDetail?: string;

// 변경 후
preferences: string[];          // 1~2개, value 배열
childDetail?: string;           // "가족" 선택 시 자녀연령
cargoDetail?: string;           // "화물" 선택 시 소형/대형
// purpose / purposeDetail 은 옛 세션 호환용 옵셔널로만 잔존
```

> 상세를 `preferenceDetails: Record<string,string>` 한 필드로 묶는 대안도 가능.
> 단순성 위해 `childDetail` / `cargoDetail` 2개 분리안을 1안으로 제시.

### 5-2. 스코어링 입력 (`ScoreInput`)

```ts
// purpose, purposeDetail 제거 → 추가
preferences: string[];
childDetail?: string;
cargoDetail?: string;
```

`scoreVehicle()`에서:
- `apply(PURPOSE_RULES[input.purpose])` → `for (p of preferences) apply(PREFERENCE_RULES[p] 또는 매핑)`
- 화물/가정 분기는 preference 포함 여부로 판정 (`preferences.includes("화물")` 등).

### 5-3. DB (`RecommendationLog`)

**채택: 컬럼 신설(2안)** [확정] — 분석 품질 우선.

`purpose`(String, NOT NULL), `purposeDetail`(String?) 컬럼이 존재.

```prisma
// RecommendationLog 에 추가
preferences   String[]   // 선택한 preference value 1~2개
childDetail   String?    // "가족" 선택 시 자녀연령
cargoDetail   String?    // "화물" 선택 시 소형/대형
```

- 기존 `purpose`(NOT NULL)는 **하위호환용으로 잔존** — 신규 흐름은
  `preferences.join(",")`를 함께 넣어 NOT NULL 제약을 충족(빈 값 방지)하고,
  분석은 새 `preferences` 컬럼을 기준으로 한다.
- 기존 `purposeDetail`은 옛 세션 전용으로 남기고 신규 흐름은 미사용.
- 마이그레이션 필요 — `project_migration-workflow`의 수기 적용 4단계 절차 사용
  (`prisma migrate dev` 셰도우 DB 재생 실패 회피).

---

## 6. 영향 범위 (수정 파일)

| 파일 | 변경 내용 |
| --- | --- |
| `constants/recommend-options.ts` | `PREFERENCE_OPTIONS`(6개) 신설. `PURPOSE_OPTIONS_BY_INDUSTRY`·출퇴근/영업/임원 상세 제거. 가정/화물 상세는 유지 |
| `lib/recommend/scoring-rules.ts` | `PREFERENCE_RULES` 신설. `SCORING_PURPOSES`→`SCORING_PREFERENCES`. 출퇴근/영업/임원 `PURPOSE_RULES` 제거 |
| `lib/recommend/scoring.ts` | `ScoreInput` 변경, 다중 preference 합산 루프 |
| `lib/ai-recommender.ts` | 입력 전달부 변경 |
| `components/recommend/RecommendFlow.tsx` | step2를 `StepPreference`(복수선택+인라인 상세)로 교체. 검증식 변경 |
| `components/recommend/StepPurpose.tsx` | `StepPreference.tsx`로 대체 |
| `app/api/recommend/route.ts` | zod 스키마 변경, DB 저장 매핑 |
| `types/recommendation.ts` | `RecommendInput`/`RecommendResultResponse` 변경 |
| `lib/recommend/label-consistency.test.ts` | preference 정합성 검증으로 갱신 |
| `lib/recommend/scoring.test.ts` | 신규 케이스 추가 |
| `e2e/` | 추천 플로우 시나리오 갱신 |

### 정리 대상(부수)

- 죽은 컴포넌트: `StepBudget` · `StepBudgetDetail` · `StepPaymentStyle` · `StepIndustryDetail`
- 죽은 상수: `BUDGET_RANGE_OPTIONS` · `PAYMENT_STYLE_OPTIONS` · `BUDGET_DETAIL_OPTIONS`

---

## 7. 하위 호환

- 옛 세션(`purpose`/`purposeDetail`만 있는 freeze 결과)은 GET이 **재계산 없이 스냅샷 반환**
  ([api/recommend/[sessionId]])하므로 영향 없음.
- 신규 POST 입력만 `preferences` 사용. zod에서 `purpose`는 옵셔널 잔존(옛 클라이언트 방어).

---

## 8. 확정 사항 (2026-06-30)

1. **상황형 동시 선택** → **불가. `가족`·`화물` 중 1개만.** (총 최대 2개 안에서)
2. **상세 데이터 모델** → **`childDetail` / `cargoDetail` 분리.**
3. **DB 저장** → **컬럼 신설(`preferences`/`childDetail`/`cargoDetail`) + 마이그레이션.**
4. **느낌형 4개 라벨/아이콘** → **현재안 확정.**
5. **추천 이유 노출 개수** → **상위 3개** (점수 높은 순, 중복 제거 후).

---

## 9. 검증 케이스 (구현 후 확인)

```
케이스 1 (느낌형 단일): preferences=["안정감"]
  → 대형 SUV(가격≥5천)에 +18 +(SUV·EV 등 기존) 가점, 경차에 -10

케이스 2 (느낌형 복수): preferences=["경제성","주차편의"]
  → 고연비 경차·소형 하이브리드에 가점 집중

케이스 3 (상황형+상세): preferences=["화물"], cargoDetail="대형 화물"
  → cargoKg≥1500 차량 +30, 세단/SUV -20 (기존 CARGO_RULES 동일)

케이스 4 (느낌+상황): preferences=["안정감","가족"], childDetail="영유아"
  → 대형 SUV + 슬라이딩도어·안전사양 가점 누적
```
