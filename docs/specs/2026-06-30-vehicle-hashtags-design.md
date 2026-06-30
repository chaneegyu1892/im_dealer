# 차량 카드 해시태그 설계

> 작성일: 2026-06-30
> 대상: 차량 탐색(`/cars`) 페이지의 차량 카드(`CarCard`)
> 상태: 설계 승인 대기

## 배경 / 문제

차량 탐색 카드는 `description`(마케팅 카피)을 36자로 잘라 `...`로 끝맺어 노출한다.
실데이터(노출차량 65대 전수)에서 description은 전부 채워져 있으나 내용이
"현대자동차 브랜드의 프리미엄을 대표하는 플래그십 세단 더 뉴 그랜저…" 식의 산문이라
잘라내면 정보가 남지 않아 "있으나마나"한 문구가 된다.

→ 잘리는 카피 대신 **차량 특징을 살린 해시태그(`#프리미엄` `#고연비` 등)**로 교체한다.

## 데이터 제약 (실측 기준, 2026-06-30)

| 항목 | 실태 | 영향 |
| ---- | ---- | ---- |
| `description` | 65/65 채워짐(산문체) | 교체 대상 |
| `Vehicle.tags` | 65/65 **비어 있음** | 어드민 보정 입력란으로 재활용 |
| `recConfig.highlights` | 전부 미설정 | 사용 안 함 |
| `detailedSpecs.externalRaw.person/carry` | **0건** | `#7인승` `#큰적재` **자동 생성 불가** |
| 하이브리드 차량 `engineType` | "가솔린"으로 저장됨 | 연료는 **차량명 기반 검출 병행** 필요 |
| `fuelEfficiency` 단위 | 연료별 상이(EV km/kWh, 가솔린 km/L) | `#고연비`는 **연료별 임계값** |
| AWD 트림 | 4대 | `#사륜구동` 소수 |
| category 분포 | SUV 34 · 세단 23 · 밴 7 · 트럭 1 | 폴백 태그로 사용 |
| 차량가 범위 | 1,395만 ~ 9,760만 | `#프리미엄`/`#실속` 프록시 |

## 결정 사항 (확정)

1. **생성 방식**: 자동 추출 + 어드민 보정(하이브리드).
2. **문구 처리**: 기존 description 줄을 **해시태그로 완전 대체**.
3. **표시 개수**: 최대 3개 + category 폴백(모든 카드 최소 1~2개 보장).
4. **어드민 UI**: 이번 작업에 **포함**.
5. **연료 태그 중복**: 우선순위대로 정상 노출(우측 엔진 뱃지와 중복 허용).

## 아키텍처

### 1. 순수 모듈 `src/lib/vehicle-hashtags.ts`

DB 접근 없이 입력만으로 동작한다(추천엔진 `src/lib/recommend/vehicle-attributes.ts`와 동일 철학).

```
interface HashtagInput {
  category: "SUV" | "세단" | "밴" | "트럭";
  isPopular: boolean;
  vehicleName: string;        // 연료/특징 검출용
  basePrice: number;          // 프리미엄/실속 프록시
  defaultTrim: {
    name: string;             // AWD 검출
    engineType: EngineType;
    fuelEfficiency: number | null;
  } | null;
  manualTags?: string[];      // 어드민 보정(Vehicle.tags)
}

function deriveHashtags(input: HashtagInput): string[]  // 항상 '#' 접두 포함, 최대 3개
```

- AWD 검출 등은 `vehicle-attributes.ts`의 기존 헬퍼/정규식을 재사용한다(중복 구현 금지).
- 임계값·우선순위는 모듈 상단 상수로 둬 튜닝 가능하게 한다.
- 단위 테스트(`vehicle-hashtags.test.ts`)로 규칙을 고정한다.

### 2. 자동 생성 규칙 (우선순위 순, 상위 3개 선택)

| 순위 | 태그 | 규칙 |
| ---- | ---- | ---- |
| 1 | `#인기` | `isPopular === true` |
| 2 | `#프리미엄` / `#실속` | `basePrice >= 60,000,000` / `<= 30,000,000` |
| 3 | `#전기차` / `#하이브리드` | 차량명 또는 engineType 기반 검출 |
| 4 | `#고연비` | 연료별 임계값 이상 (가솔린/LPG ≥15, 하이브리드 ≥16, 디젤 ≥13; EV 제외) |
| 5 | `#사륜구동` | 트림명 AWD/4WD 검출 |
| 6 | `#안전사양` / `#슬라이딩도어` | 차량명 검출 시 |
| 폴백 | `#SUV` · `#세단` · `#밴` · `#트럭` | 위 규칙으로 2개 미만이면 차종으로 채움 |

> 가치 태그(프리미엄·고연비·사륜·인기)를 먼저 채우고 슬롯이 남을 때 연료/차종을 채워
> 우측 엔진 뱃지와의 중복을 최소화한다. (단, 연료 태그 자체는 우선순위대로 노출 허용)

### 3. 어드민 보정 병합 정책

`deriveHashtags`는 `manualTags`(=`Vehicle.tags`)를 **앞에 두고** 자동 태그로 3개까지 채운다(중복 제거).
어드민이 비워두면 100% 자동.

```
result = dedup([...manualTags, ...autoTags]).slice(0, 3)
```

### 4. 데이터 흐름

- 초기 데이터: SSR. `/cars` 서버 페이지 `getVehicles`에서 `deriveHashtags` 호출 →
  `VehicleListItem`에 `hashtags: string[]` 필드 추가.
- 어드민 보정: 클라이언트 → API Route → Prisma(`Vehicle.tags` PATCH). 기존 어드민 패턴 준수.

### 5. UI 변경

- `CarCard`의 description `<p>` 블록을 해시태그 칩 행으로 교체.
  칩 스타일은 토스풍 네이비 디자인 토큰(`bg-brand-soft text-brand` 계열) 사용, 모바일 줄바꿈 허용.
- 어드민 차량 편집기(`BasicInfoTab` / `VehicleInfoForm`)에 태그 입력 UI(쉼표 구분 또는 chip 입력) 추가.
  검증: 기존 `aiConfigUpdateSchema.highlights` 패턴(개수·길이 제한) 참고.

## 적용 범위

- **포함**: `/cars` 차량 탐색 카드(`CarCard`), 어드민 태그 입력.
- **제외**: 홈 인기차량(`PopularCarsSection`)·`FeaturedCard` — description을 쓰지 않으므로 미변경.

## 검증 기준

- `vehicle-hashtags.test.ts`: 인기/프리미엄/실속/연료/고연비/AWD/폴백/병합 각 규칙 케이스 통과.
- 실데이터 65대 전수에 대해 모든 카드가 해시태그 ≥1개를 가진다(폴백 보장).
- HEV 차량(engineType=가솔린, 차량명에 HEV)이 `#하이브리드`로 검출된다.
- 어드민에서 입력한 태그가 자동 태그보다 앞에 노출되고 총 3개를 넘지 않는다.
- 기존 견적 계산 로직·추천 점수 로직과 독립적이다(영향 없음).

## 의도적 제외

- 승차인원·적재중량 기반 태그(`#7인승`/`#큰적재`) — 원천 데이터 없음.
- LLM 기반 태그 생성 — 비용·지연·환각 부담으로 후순위.
- description 텍스트 마이닝(프리미엄/플래그십 키워드 추출) — 가격 프록시로 대체.
