# AI 추천 점수 로직 고도화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 개발요청서(260617)에 따라 AI 추천 점수 엔진을 라벨 버그 수정 + 업종/목적/주행거리/화물/자녀연령/충전환경/지역 가점으로 고도화하되, 실제 보유 데이터로 구현 가능한 범위로 한정한다.

**Architecture:** 현재 `ai-recommender.ts` 한 파일에 인라인된 스코어링을 (1) 차량 속성 추출 순수 모듈 `vehicle-attributes.ts`, (2) 가점 규칙을 데이터 테이블로 인코딩한 순수 스코어링 모듈 `scoring.ts` 로 분리한다. `ai-recommender.ts` 는 데이터 로드 + 속성 추출 + 점수 합산 + 시나리오 계산만 오케스트레이션한다. 가점은 if-분기 대신 규칙 테이블로 표현해 테스트·확장을 쉽게 한다.

**Tech Stack:** Next.js 14 App Router, Prisma + PostgreSQL(Supabase), Vitest, TypeScript.

---

## 배경 — 현재 상태 (검증 완료)

- 운영 DB: 차량 452 / 트림 6,389 / 옵션 30,689 (외부 임포트 대량 데이터).
- **선행 버그 (현재 추천 점수 상당수가 dead code):**
  1. 목적/업종 라벨 3중 불일치 — 실제 선택지 `출퇴근·업무용`/`화물·배달`/`임원용·의전`/`가정용` vs 코드 검사값 `출퇴근`/`의전·임원용`/`가족`/`영업·외근`/`첫차`/`레저·캠핑`/`기타`. 분기 대부분 미작동.
  2. [src/lib/ai-recommender.ts:126](src/lib/ai-recommender.ts:126) `defaultTrim.fuelType` 참조 → 스키마 필드는 `engineType`. 연료 가점 전부 무효.
  3. 점수 상한 `Math.min(150)` — 문서는 250 요구.
- **데이터 실측 결과 (가점 가능 여부):**
  - ✅ 자동: AWD/4WD(트림명 1,912건), 화물 적재중량(`detailedSpecs.externalRaw.carry` kg), 냉장/냉동(트림명 89건), 승차인원(`externalRaw.person` 5,235건), 연비/연료/인기/카테고리/가격.
  - △ 하이브리드(자동검출 + 어드민 3-state 보정): 슬라이딩도어(옵션명 286 + 카니발·스타리아 차종규칙), 안전사양(옵션 535 + 스펙본문 2,444 트림 파싱).
  - ❌ 제외: 트렁크 용량 리터(19/452=4%) → '대형SUV·7인승'으로 대체. 재계약 고객(데이터 없음). 예산×차급(엔진은 예산 미반영 유지).

## 결정사항 (확정)

- 재계약 고객: **제외**. AWD×지역: **포함**(데이터 있음).
- 슬라이딩도어·안전사양: **자동검출 + 어드민 3-state 토글 보정** 하이브리드.
- 트렁크500L 가점: **제외**, 대형SUV·7인승으로 대체.
- 예산: **미반영 유지**.
- 신규 선택지 전부 추가: 영업·외근 목적 / 자녀연령 4단계 / 충전환경 3단계 / 거주지역.

## File Structure

| 파일 | 역할 | 신규/수정 |
|------|------|----------|
| `src/lib/recommend/vehicle-attributes.ts` | 차량/트림 → 속성(awd·cargoKg·냉장·승차·슬라이딩·안전·연료) 추출 순수 함수 | 신규 |
| `src/lib/recommend/vehicle-attributes.test.ts` | 위 단위 테스트 | 신규 |
| `src/lib/recommend/scoring-rules.ts` | 문서 가점 값을 데이터 테이블로 인코딩(업종·목적·주행연비·화물·자녀·충전·지역) | 신규 |
| `src/lib/recommend/scoring.ts` | 규칙 테이블 + 속성 → 점수·이유 산출 순수 함수 | 신규 |
| `src/lib/recommend/scoring.test.ts` | 스코어링 단위 테스트 | 신규 |
| `src/lib/ai-recommender.ts` | 오케스트레이션(로드·속성·합산·시나리오)으로 축소 | 수정 |
| `src/types/recommendation.ts` | `RecommendInput`에 `residenceRegion` 추가, `chargingEnvironment` 값 확장 | 수정 |
| `src/constants/recommend-options.ts` | 영업·외근 목적, 자녀연령 4단계, 충전환경 3단계, 지역 선택지 | 수정 |
| `prisma/schema.prisma` | `Vehicle.slidingDoorOverride`, `Vehicle.advancedSafetyOverride` (nullable Boolean) | 수정 |
| `prisma/migrations/<ts>_rec_attr_overrides/migration.sql` | 위 컬럼 추가 | 신규 |
| `src/components/recommend/StepPurpose*.tsx` 등 | 신규 선택지 UI 반영 | 수정 |
| `src/components/recommend/StepRegion.tsx` | 거주지역 선택 스텝 | 신규 |
| `src/components/recommend/RecommendFlow.tsx` | 지역 스텝·검증 추가 | 수정 |
| `src/components/admin/vehicles/edit/tabs/BasicInfoTab.tsx` | 슬라이딩도어·안전사양 3-state 토글 | 수정 |
| `src/lib/validations/admin.ts`, `src/app/api/admin/vehicles/[id]/route.ts` | override 필드 검증·저장 | 수정 |

---

## Phase 0 — 선행 버그 수정 + 모듈 골격

> 목표: 기존 로직을 "살아 있는" 상태로 만들고, 이후 가점을 얹을 순수 모듈 골격을 만든다. 이 Phase 만으로도 추천이 실제로 작동하게 된다.

### Task 0.1: 연료 필드 버그 수정 (`fuelType` → `engineType`)

**Files:**
- Modify: `src/lib/ai-recommender.ts:126`

- [ ] **Step 1: 필드명 수정**

`src/lib/ai-recommender.ts:126` 의

```typescript
    const trimFuel = (defaultTrim as { fuelType?: string }).fuelType ?? "";
```

를 아래로 교체:

```typescript
    const trimFuel = defaultTrim.engineType ?? "";
```

- [ ] **Step 2: 타입 확인 빌드**

Run: `npx tsc --noEmit`
Expected: 에러 없음 (engineType 은 Trim 의 실제 필드).

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai-recommender.ts
git commit -m "fix(recommend): 연료 가점이 읽던 fuelType을 실제 필드 engineType으로 수정"
```

### Task 0.2: 점수 상한 150 → 250

**Files:**
- Modify: `src/lib/ai-recommender.ts:237`

- [ ] **Step 1: 상한 상수화 + 250 적용**

`src/lib/ai-recommender.ts` 상단 import 직후에 상수 추가:

```typescript
const BASE_SCORE = 50;
const MAX_SCORE = 250;
```

`src/lib/ai-recommender.ts:123` `let score = 50;` → `let score = BASE_SCORE;`
`src/lib/ai-recommender.ts:237` `score = Math.min(150, score);` → `score = Math.min(MAX_SCORE, score);`

- [ ] **Step 2: Commit**

```bash
git add src/lib/ai-recommender.ts
git commit -m "feat(recommend): 점수 상한 150→250 확장 및 상수화"
```

### Task 0.3: 목적/업종 라벨 정합성 단위 테스트 (실패 → 수정)

문서 2장의 라벨 불일치를 회귀 방지 테스트로 못박는다. 실제 선택지 라벨은 `recommend-options.ts` 의 `PURPOSE_OPTIONS`/`INDUSTRY_OPTIONS` 가 SSOT.

**Files:**
- Create: `src/lib/recommend/label-consistency.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```typescript
import { describe, it, expect } from "vitest";
import { PURPOSE_OPTIONS, INDUSTRY_OPTIONS } from "@/constants/recommend-options";
import { SCORING_PURPOSES, SCORING_INDUSTRIES } from "@/lib/recommend/scoring-rules";

describe("스코어링 라벨이 실제 선택지와 일치", () => {
  it("스코어링이 참조하는 목적은 모두 실제 선택지에 존재", () => {
    const valid = new Set(PURPOSE_OPTIONS.map((o) => o.value));
    for (const p of SCORING_PURPOSES) expect(valid.has(p)).toBe(true);
  });
  it("스코어링이 참조하는 업종은 모두 실제 선택지에 존재", () => {
    const valid = new Set(INDUSTRY_OPTIONS.map((o) => o.value));
    for (const i of SCORING_INDUSTRIES) expect(valid.has(i)).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/recommend/label-consistency.test.ts`
Expected: FAIL — `scoring-rules` 모듈이 아직 없음.

- [ ] **Step 3: Task 1.x 이후 통과** — 이 테스트는 Phase 1(`scoring-rules.ts`)에서 통과시킨다. 지금은 RED 상태로 커밋만.

```bash
git add src/lib/recommend/label-consistency.test.ts
git commit -m "test(recommend): 스코어링 라벨↔선택지 정합성 테스트 추가 (RED)"
```

---

## Phase 1 — 차량 속성 추출 순수 모듈

> 목표: 차량/트림에서 가점 판단에 필요한 속성을 추출하는 순수 함수를 TDD로 작성. 전부 입력→출력 순수 함수라 DB 없이 테스트한다.

### 입력 타입 (이 Phase에서 정의)

```typescript
// vehicle-attributes.ts 상단
export interface AttrTrimInput {
  name: string;
  engineType: string;            // EV | 하이브리드 | 디젤 | 가솔린 | LPG | 수소
  fuelEfficiency: number | null;
  price: number;
  detailedSpecs: unknown;        // externalRaw.{carry, person, documents[].content}
  options: { name: string }[];   // TrimOption.name 목록
}
export interface AttrVehicleInput {
  name: string;
  category: string;              // SUV | 세단 | 밴 | 트럭
  isPopular: boolean;
  slidingDoorOverride: boolean | null;
  advancedSafetyOverride: boolean | null;
}
export interface VehicleAttrs {
  isAwd: boolean;
  cargoKg: number | null;        // 적재중량(kg)
  isRefrigerated: boolean;
  seating: number | null;
  fuel: "EV" | "하이브리드" | "디젤" | "가솔린" | "LPG" | "수소" | "기타";
  hasSlidingDoor: boolean;
  hasAdvancedSafety: boolean;
}
```

### Task 1.1: AWD 판별

**Files:**
- Create: `src/lib/recommend/vehicle-attributes.ts`
- Test: `src/lib/recommend/vehicle-attributes.test.ts`

- [ ] **Step 1: 실패 테스트**

```typescript
import { describe, it, expect } from "vitest";
import { detectAwd } from "./vehicle-attributes";

describe("detectAwd", () => {
  it.each([
    ["2025년형 롱레인지 프레스티지 AWD (19인치)", true],
    ["라운지 리무진 디젤 2.2 7인승 인스퍼레이션 4WD A/T", true],
    ["E-Class 4MATIC", true],
    ["콰트로 45 TFSI", true],
    ["2024년형 가솔린 2.5 익스클루시브", false],
  ])("'%s' → %s", (name, expected) => {
    expect(detectAwd(name)).toBe(expected);
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/lib/recommend/vehicle-attributes.test.ts` → FAIL (함수 없음).

- [ ] **Step 3: 구현**

```typescript
const AWD_RE = /\bAWD\b|\b4WD\b|4MATIC|4motion|사륜|x[Dd]rive|quattro|콰트로/i;
export function detectAwd(trimName: string): boolean {
  return AWD_RE.test(trimName);
}
```

- [ ] **Step 4: 통과 확인** — Run: 위 명령 → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/recommend/vehicle-attributes.ts src/lib/recommend/vehicle-attributes.test.ts
git commit -m "feat(recommend): AWD/4WD 트림명 판별 함수"
```

### Task 1.2: 적재중량·냉장/냉동·승차인원 추출

**Files:**
- Modify: `src/lib/recommend/vehicle-attributes.ts`, `vehicle-attributes.test.ts`

- [ ] **Step 1: 실패 테스트 추가**

```typescript
import { extractCargoKg, detectRefrigerated, extractSeating } from "./vehicle-attributes";

describe("extractCargoKg", () => {
  it("externalRaw.carry 숫자 문자열을 kg로", () => {
    expect(extractCargoKg({ externalRaw: { carry: "1000" } })).toBe(1000);
  });
  it("0 또는 누락은 null", () => {
    expect(extractCargoKg({ externalRaw: { carry: "0" } })).toBeNull();
    expect(extractCargoKg({})).toBeNull();
    expect(extractCargoKg(null)).toBeNull();
  });
});
describe("detectRefrigerated", () => {
  it.each([
    ["전기 특장차 냉동탑차 로우 킹캡", true],
    ["하이 내장탑차", true],
    ["17톤 윙바디 초장축", true],
    ["슈퍼캡 초장축 프리미엄", false],
  ])("'%s' → %s", (name, exp) => expect(detectRefrigerated(name)).toBe(exp));
});
describe("extractSeating", () => {
  it("person 추출", () => {
    expect(extractSeating({ externalRaw: { person: "7" } })).toBe(7);
    expect(extractSeating({ externalRaw: { person: "" } })).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인** → FAIL.

- [ ] **Step 3: 구현 추가**

```typescript
function rawOf(detailedSpecs: unknown): Record<string, unknown> | null {
  if (!detailedSpecs || typeof detailedSpecs !== "object") return null;
  const raw = (detailedSpecs as { externalRaw?: unknown }).externalRaw;
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
}
export function extractCargoKg(detailedSpecs: unknown): number | null {
  const raw = rawOf(detailedSpecs);
  const n = raw ? Number(raw.carry) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}
const COLD_RE = /냉장|냉동|탑차|윙바디|보냉/;
export function detectRefrigerated(trimName: string): boolean {
  return COLD_RE.test(trimName);
}
export function extractSeating(detailedSpecs: unknown): number | null {
  const raw = rawOf(detailedSpecs);
  const n = raw ? Number(raw.person) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}
```

- [ ] **Step 4: 통과 확인** → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/recommend/vehicle-attributes.ts src/lib/recommend/vehicle-attributes.test.ts
git commit -m "feat(recommend): 적재중량·냉장냉동·승차인원 추출 함수"
```

### Task 1.3: 슬라이딩도어·안전사양 자동검출 + override 우선

**Files:**
- Modify: `src/lib/recommend/vehicle-attributes.ts`, `vehicle-attributes.test.ts`

- [ ] **Step 1: 실패 테스트**

```typescript
import { resolveSlidingDoor, resolveAdvancedSafety } from "./vehicle-attributes";

describe("resolveSlidingDoor (override 우선, 없으면 자동)", () => {
  it("override=false 면 자동검출 무시하고 false", () => {
    expect(resolveSlidingDoor({ name: "카니발", override: false, optionNames: ["파워 슬라이딩 도어"] })).toBe(false);
  });
  it("차종명이 슬라이딩도어 차종이면 자동 true", () => {
    expect(resolveSlidingDoor({ name: "기아 카니발", override: null, optionNames: [] })).toBe(true);
    expect(resolveSlidingDoor({ name: "스타리아 라운지", override: null, optionNames: [] })).toBe(true);
  });
  it("옵션명에 슬라이딩 도어가 있으면 자동 true", () => {
    expect(resolveSlidingDoor({ name: "쏘렌토", override: null, optionNames: ["2열 파워 슬라이딩 도어"] })).toBe(true);
  });
  it("아무 신호 없으면 false", () => {
    expect(resolveSlidingDoor({ name: "G80", override: null, optionNames: ["선루프"] })).toBe(false);
  });
});

describe("resolveAdvancedSafety", () => {
  it("override 우선", () => {
    expect(resolveAdvancedSafety({ override: true, optionNames: [], specText: "" })).toBe(true);
  });
  it("스펙 본문에 지능형 안전기술 문구가 있으면 자동 true", () => {
    expect(resolveAdvancedSafety({ override: null, optionNames: [], specText: "전방 충돌방지 보조, 차로 이탈방지 보조" })).toBe(true);
  });
  it("옵션명에 후측방 충돌방지가 있으면 자동 true", () => {
    expect(resolveAdvancedSafety({ override: null, optionNames: ["후측방 충돌방지 보조"], specText: "" })).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인** → FAIL.

- [ ] **Step 3: 구현**

```typescript
// 차종 자체가 기본 슬라이딩도어인 차량 (소수 화이트리스트)
const SLIDING_DOOR_MODELS = ["카니발", "스타리아", "스타렉스", "쏠라티"];
const SLIDING_OPT_RE = /슬라이딩\s*도어|파워\s*슬라이딩|사이드\s*슬라이딩|양측\s*도어/;
export function resolveSlidingDoor(p: { name: string; override: boolean | null; optionNames: string[] }): boolean {
  if (p.override !== null) return p.override;
  if (SLIDING_DOOR_MODELS.some((m) => p.name.includes(m))) return true;
  return p.optionNames.some((o) => SLIDING_OPT_RE.test(o));
}

const SAFETY_RE = /전방\s*충돌방지\s*보조|차로\s*이탈|후측방\s*충돌|지능형\s*안전|긴급제동|FCA|BCW/;
export function resolveAdvancedSafety(p: { override: boolean | null; optionNames: string[]; specText: string }): boolean {
  if (p.override !== null) return p.override;
  if (SAFETY_RE.test(p.specText)) return true;
  return p.optionNames.some((o) => SAFETY_RE.test(o));
}
```

- [ ] **Step 4: 통과 확인** → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/recommend/vehicle-attributes.ts src/lib/recommend/vehicle-attributes.test.ts
git commit -m "feat(recommend): 슬라이딩도어·안전사양 자동검출+override 해석 함수"
```

### Task 1.4: 연료 정규화 + 통합 빌더 `buildVehicleAttrs`

**Files:**
- Modify: `src/lib/recommend/vehicle-attributes.ts`, `vehicle-attributes.test.ts`

- [ ] **Step 1: 실패 테스트**

```typescript
import { buildVehicleAttrs } from "./vehicle-attributes";

describe("buildVehicleAttrs", () => {
  it("트림+차량 입력을 VehicleAttrs로 통합", () => {
    const attrs = buildVehicleAttrs(
      { name: "카니발 9인승 디젤", category: "SUV", isPopular: true, slidingDoorOverride: null, advancedSafetyOverride: null },
      { name: "카니발 9인승 디젤 4WD", engineType: "디젤", fuelEfficiency: 11, price: 40000000,
        detailedSpecs: { externalRaw: { person: "9", carry: "0", documents: [{ content: "전방 충돌방지 보조" }] } },
        options: [{ name: "2열 파워 슬라이딩 도어" }] },
    );
    expect(attrs).toMatchObject({
      isAwd: true, seating: 9, fuel: "디젤", hasSlidingDoor: true, hasAdvancedSafety: true, isRefrigerated: false,
    });
  });
});
```

- [ ] **Step 2: 실패 확인** → FAIL.

- [ ] **Step 3: 구현 (specText 합성 + 연료 정규화 포함)**

```typescript
const FUELS = ["EV", "하이브리드", "디젤", "가솔린", "LPG", "수소"] as const;
function normalizeFuel(engineType: string): VehicleAttrs["fuel"] {
  return (FUELS as readonly string[]).includes(engineType) ? (engineType as VehicleAttrs["fuel"]) : "기타";
}
function specTextOf(detailedSpecs: unknown): string {
  const raw = rawOf(detailedSpecs);
  const docs = raw?.documents;
  if (!Array.isArray(docs)) return "";
  return docs.map((d) => (d && typeof d === "object" ? String((d as { content?: unknown }).content ?? "") : "")).join(" ");
}
export function buildVehicleAttrs(v: AttrVehicleInput, t: AttrTrimInput): VehicleAttrs {
  const optionNames = t.options.map((o) => o.name);
  return {
    isAwd: detectAwd(t.name),
    cargoKg: extractCargoKg(t.detailedSpecs),
    isRefrigerated: detectRefrigerated(t.name),
    seating: extractSeating(t.detailedSpecs),
    fuel: normalizeFuel(t.engineType),
    hasSlidingDoor: resolveSlidingDoor({ name: v.name, override: v.slidingDoorOverride, optionNames }),
    hasAdvancedSafety: resolveAdvancedSafety({ override: v.advancedSafetyOverride, optionNames, specText: specTextOf(t.detailedSpecs) }),
  };
}
```

- [ ] **Step 4: 통과 확인** → PASS (전체: `npx vitest run src/lib/recommend/vehicle-attributes.test.ts`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/recommend/vehicle-attributes.ts src/lib/recommend/vehicle-attributes.test.ts
git commit -m "feat(recommend): 연료 정규화 및 VehicleAttrs 통합 빌더"
```

---

## Phase 2 — 스키마 override 컬럼 + 어드민 토글

> 목표: 슬라이딩도어·안전사양 자동검출을 운영자가 보정할 수 있는 3-state(null=자동/true/false) 컬럼과 어드민 UI 추가.

### Task 2.1: Prisma 스키마 + 마이그레이션

**Files:**
- Modify: `prisma/schema.prisma` (model Vehicle)
- Create: `prisma/migrations/<timestamp>_rec_attr_overrides/migration.sql`

- [ ] **Step 1: 스키마에 컬럼 추가** — `model Vehicle` 의 `isSpotlight` 라인 아래에:

```prisma
  // 추천 자동검출 보정값. null=자동검출, true/false=운영자 강제. (AI 추천 가점용)
  slidingDoorOverride    Boolean?
  advancedSafetyOverride Boolean?
```

- [ ] **Step 2: 마이그레이션 SQL 작성** (메모리 `project_migration-workflow.md` 의 수기 적용 절차 준수 — `migrate dev` 셰도우 DB 실패 회피)

`prisma/migrations/<timestamp>_rec_attr_overrides/migration.sql`:

```sql
ALTER TABLE "Vehicle" ADD COLUMN "slidingDoorOverride" BOOLEAN;
ALTER TABLE "Vehicle" ADD COLUMN "advancedSafetyOverride" BOOLEAN;
```

- [ ] **Step 3: 수기 적용 + resolve**

Run:
```bash
npx prisma db execute --file prisma/migrations/<timestamp>_rec_attr_overrides/migration.sql --schema prisma/schema.prisma
npx prisma migrate resolve --applied <timestamp>_rec_attr_overrides
npx prisma generate
```
Expected: 컬럼 추가 성공, client 재생성.

- [ ] **Step 4: 타입 확인** — Run: `npx tsc --noEmit` → 에러 없음.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(recommend): 슬라이딩도어·안전사양 override 컬럼 추가"
```

### Task 2.2: override 검증 스키마 + API 저장

**Files:**
- Modify: `src/lib/validations/admin.ts`, `src/app/api/admin/vehicles/[id]/route.ts`

- [ ] **Step 1: Zod 스키마에 필드 추가** — `admin.ts` 의 차량 수정 스키마(vehicle update schema)에:

```typescript
  slidingDoorOverride: z.boolean().nullable().optional(),
  advancedSafetyOverride: z.boolean().nullable().optional(),
```

- [ ] **Step 2: PATCH 핸들러가 필드 통과** — `route.ts` 의 vehicle update `data` 매핑에 위 두 필드를 포함(이미 `...validated` 스프레드면 자동 반영, 명시 매핑이면 두 줄 추가).

- [ ] **Step 3: 타입 확인** — Run: `npx tsc --noEmit` → 에러 없음.

- [ ] **Step 4: Commit**

```bash
git add src/lib/validations/admin.ts src/app/api/admin/vehicles/[id]/route.ts
git commit -m "feat(admin): 추천 override 필드 검증·저장"
```

### Task 2.3: 어드민 3-state 토글 UI

**Files:**
- Modify: `src/components/admin/vehicles/edit/tabs/BasicInfoTab.tsx`

- [ ] **Step 1: 토글 컴포넌트 추가** — 슬라이딩도어/안전사양 각각 `자동 | 있음 | 없음` 3선택 라디오. 값 매핑: `자동→null`, `있음→true`, `없음→false`. 어드민 색상(`#000666`/`#6066EE`) 유지.

```tsx
function TriToggle({ label, value, onChange }: {
  label: string; value: boolean | null; onChange: (v: boolean | null) => void;
}) {
  const opts: { k: string; v: boolean | null }[] = [
    { k: "자동", v: null }, { k: "있음", v: true }, { k: "없음", v: false },
  ];
  return (
    <div className="space-y-1">
      <span className="text-sm font-medium text-[#1A1A2E]">{label}</span>
      <div className="flex gap-1">
        {opts.map((o) => (
          <button
            key={o.k}
            type="button"
            onClick={() => onChange(o.v)}
            className={value === o.v
              ? "px-3 py-1.5 rounded-md text-sm bg-[#000666] text-white"
              : "px-3 py-1.5 rounded-md text-sm bg-white text-[#9BA4C0] border border-[#E5E8F0]"}
          >
            {o.k}
          </button>
        ))}
      </div>
    </div>
  );
}
```

폼 상태에 `slidingDoorOverride`/`advancedSafetyOverride` 를 연결하고 `<TriToggle label="슬라이딩 도어" ... />`, `<TriToggle label="고급 안전사양" ... />` 렌더.

- [ ] **Step 2: 수동 확인** — 어드민 차량 편집에서 토글 저장 후 새로고침 시 값 유지.

Run: `npm run dev` → `/admin/vehicles/<id>` 편집 → 토글 변경·저장·재조회.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/vehicles/edit/tabs/BasicInfoTab.tsx
git commit -m "feat(admin): 슬라이딩도어·안전사양 3-state 토글 UI"
```

---

## Phase 3 — 신규 입력 선택지 + UI 플로우

> 목표: 영업·외근 목적, 자녀연령 4단계, 충전환경 3단계, 거주지역을 선택지·타입·플로우에 추가. 가점 반영은 Phase 4.

### Task 3.1: 타입 확장

**Files:**
- Modify: `src/types/recommendation.ts`

- [ ] **Step 1: RecommendInput 확장**

`chargingEnvironment` 를 새 3단계로, `residenceRegion` 추가:

```typescript
  // 전기차 선택 시 충전 환경 (3단계)
  chargingEnvironment?: "자택" | "직장" | "외부" | "없음";
  // 거주지역 (선택)
  residenceRegion?: "일반" | "강원·산간" | "제주";
```

- [ ] **Step 2: 타입 확인** — Run: `npx tsc --noEmit`. `ai-recommender.ts:38` 의 인라인 `chargingEnvironment` 캐스팅 타입도 동일하게 갱신. Expected: 에러 없음.

- [ ] **Step 3: Commit**

```bash
git add src/types/recommendation.ts src/lib/ai-recommender.ts
git commit -m "feat(recommend): 충전환경 3단계·거주지역 입력 타입 추가"
```

### Task 3.2: 선택지 상수 추가

**Files:**
- Modify: `src/constants/recommend-options.ts`

- [ ] **Step 1: 영업·외근 목적 추가** — `PURPOSE_OPTIONS` 에 항목 추가하고 `PURPOSE_OPTIONS_BY_INDUSTRY` 의 법인/개인사업자/개인에 노출:

```typescript
export const PURPOSE_OPTIONS = [
  { value: "출퇴근·업무용", label: "출퇴근·업무용", desc: "출퇴근·통근", icon: "🚗" },
  { value: "영업·외근", label: "영업·외근", desc: "외근·미팅 잦은 영업", icon: "🧳" },
  { value: "화물·배달", label: "화물·배달", desc: "물건 운반·배달 업무", icon: "📦" },
  { value: "임원용·의전", label: "임원용·의전", desc: "임원·VIP 의전 차량", icon: "🎖️" },
  { value: "가정용", label: "가정용", desc: "가족 이동·장거리 여행", icon: "👨‍👩‍👧" },
] as const;
```

`PURPOSE_OPTIONS_BY_INDUSTRY` 인덱스는 라벨 기준으로 재작성(인덱스 번호 깨짐 방지 — `.find` 사용):

```typescript
const P = (v: string) => PURPOSE_OPTIONS.find((o) => o.value === v)!;
export const PURPOSE_OPTIONS_BY_INDUSTRY: Record<string, ReadonlyArray<typeof PURPOSE_OPTIONS[number]>> = {
  법인:       [P("출퇴근·업무용"), P("영업·외근"), P("화물·배달"), P("임원용·의전")],
  개인사업자: [P("출퇴근·업무용"), P("영업·외근"), P("화물·배달"), P("가정용")],
  개인:       [P("출퇴근·업무용"), P("화물·배달"), P("가정용")],
};
```

- [ ] **Step 2: 영업·외근 목적 상세 + 자녀연령 4단계**

`PURPOSE_DETAIL_OPTIONS` 에 `영업·외근` 추가, `가정용` 을 4단계로 교체:

```typescript
  "영업·외근": [
    { value: "매일 외근", label: "매일 외근해요", desc: "하루 대부분 이동", icon: "🛣️" },
    { value: "가끔 외근", label: "가끔 외근해요", desc: "주 1~2회", icon: "📅" },
  ],
  가정용: [
    { value: "영유아", label: "영유아 (0~3세)", desc: "유모차·카시트 환경", icon: "👶" },
    { value: "미취학", label: "미취학 (4~7세)", desc: "카시트 환경", icon: "🧒" },
    { value: "초등", label: "초등학생 (8~13세)", desc: "넉넉한 실내 공간", icon: "🎒" },
    { value: "중학생+", label: "중학생 이상 (14세~)", desc: "성인 위주 이용", icon: "🧑" },
  ],
```

`PURPOSE_DETAIL_QUESTION` 에 `"영업·외근": { title: "외근 빈도는요?", subtitle: "..." }` 추가.

- [ ] **Step 3: 충전환경 3단계 교체**

```typescript
export const CHARGING_OPTIONS = [
  { value: "자택", label: "자택 충전 가능", desc: "집에서 충전돼요", icon: "🏠" },
  { value: "직장", label: "직장 충전 가능", desc: "회사에서 충전돼요", icon: "🏢" },
  { value: "외부", label: "외부 충전만", desc: "공용 충전소 이용", icon: "🔌" },
  { value: "없음", label: "충전 환경 없어요", desc: "충전이 어려워요", icon: "🚫" },
] as const;
```

- [ ] **Step 4: 거주지역 선택지 신설**

```typescript
export const REGION_OPTIONS = [
  { value: "일반", label: "일반 지역", desc: "수도권·도심 등", icon: "🏙️" },
  { value: "강원·산간", label: "강원·산간", desc: "눈길·비포장 잦음", icon: "🏔️" },
  { value: "제주", label: "제주", desc: "전기차 인프라 우수", icon: "🌴" },
] as const;
```

- [ ] **Step 5: 라벨 정합성 테스트(Task 0.3) 통과 확인** — Run: `npx vitest run src/lib/recommend/label-consistency.test.ts` (scoring-rules 가 Phase 4 에서 생기면 통과). 지금은 옵션만 검증하는 임시 테스트로 충분.

- [ ] **Step 6: Commit**

```bash
git add src/constants/recommend-options.ts
git commit -m "feat(recommend): 영업·외근·자녀연령4단계·충전3단계·거주지역 선택지 추가"
```

### Task 3.3: 거주지역 스텝 컴포넌트

**Files:**
- Create: `src/components/recommend/StepRegion.tsx`

- [ ] **Step 1: 컴포넌트 작성** — 기존 `StepFuelPreference.tsx` 패턴 복제(SelectionCard 사용). props: `value: string`, `onChange: (v: string) => void`. `REGION_OPTIONS` 렌더.

```tsx
import { REGION_OPTIONS } from "@/constants/recommend-options";
import { SelectionCard } from "./SelectionCard";

interface StepRegionProps { value: string; onChange: (v: string) => void; }
export function StepRegion({ value, onChange }: StepRegionProps) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">주로 어디서 운행하시나요?</h2>
      <p className="text-sm text-gray-500">지역 환경에 맞는 차량을 추천해 드려요.</p>
      <div className="grid grid-cols-1 gap-2">
        {REGION_OPTIONS.map((o) => (
          <SelectionCard key={o.value} icon={o.icon} label={o.label} desc={o.desc}
            selected={value === o.value} onClick={() => onChange(o.value)} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/recommend/StepRegion.tsx
git commit -m "feat(recommend): 거주지역 선택 스텝 컴포넌트"
```

### Task 3.4: RecommendFlow에 지역 통합

**Files:**
- Modify: `src/components/recommend/RecommendFlow.tsx`, `src/components/recommend/StepIndicator.tsx`

- [ ] **Step 1: 플로우 상태·렌더·검증·제출 연결** — Step 3(주행거리/연료) 영역에 `StepRegion` 을 추가 질문으로 노출(기본값 `"일반"` 이라 미선택 차단 안 함). `FlowState` 에 `residenceRegion: string` 추가(`INITIAL_STATE` 에 `"일반"`). 제출 payload(`handleSubmit`)에 `residenceRegion` 포함. `chargingEnvironment` 분기는 새 3단계 값 기준으로 유지(`전기차` 선택 시 노출).

구체 편집:
- `FlowState` 에 `residenceRegion: string;`
- `INITIAL_STATE` 에 `residenceRegion: "일반",`
- Step 3 JSX 에 `<StepRegion value={state.residenceRegion} onChange={(v) => setState((s) => ({ ...s, residenceRegion: v }))} />`
- payload 객체에 `residenceRegion: state.residenceRegion,`

- [ ] **Step 2: 수동 확인** — Run: `npm run dev` → `/recommend` 4단계 통과, 영업·외근/자녀4단계/충전3단계/지역 노출, 결과 도출.

- [ ] **Step 3: Commit**

```bash
git add src/components/recommend/RecommendFlow.tsx src/components/recommend/StepIndicator.tsx
git commit -m "feat(recommend): 추천 플로우에 거주지역 질문 통합"
```

---

## Phase 4 — 스코어링 규칙 테이블 + 엔진 재작성

> 목표: 문서의 모든 가점을 데이터 테이블로 인코딩하고, 속성 기반 순수 스코어링 함수로 합산. `ai-recommender.ts` 는 이 함수를 호출하도록 축소.

### Task 4.1: 스코어링 규칙 테이블

**Files:**
- Create: `src/lib/recommend/scoring-rules.ts`

문서 1~5장 + 6-2,6-4 의 가점을 데이터로 인코딩. (6-1 예산·6-3 재계약 제외.) 라벨은 `recommend-options.ts` 의 `value` 와 1:1.

- [ ] **Step 1: 규칙 테이블 작성**

```typescript
// 카테고리·연료·속성 기준 가점 규칙. 모든 라벨은 실제 선택지 value와 일치.
export const SCORING_INDUSTRIES = ["법인", "개인사업자", "개인"] as const;
export const SCORING_PURPOSES = ["출퇴근·업무용", "영업·외근", "화물·배달", "임원용·의전", "가정용"] as const;

// 업종 가점 (문서 1장) — 카테고리/연료 키워드 → 점수
export const INDUSTRY_RULES: Record<string, { match: (a: import("./vehicle-attributes").VehicleAttrs, cat: string, price: number) => boolean; pts: number; reason?: string }[]> = {
  법인: [
    { match: (a, cat) => cat.includes("대형") || cat.includes("세단"), pts: 20, reason: "법인 임원용 품격과 비용처리 효율" },
    { match: (a, cat) => cat.includes("프리미엄") || cat === "SUV", pts: 18, reason: "법인 운용리스 회수율이 높아 월납입 유리" },
    { match: (a) => a.fuel === "EV", pts: 15, reason: "법인 전기차 취득세 감면+비용처리 100%" },
    { match: (a, cat) => cat.includes("경차") || cat.includes("소형"), pts: -15 },
  ],
  개인사업자: [
    { match: (a) => a.fuel === "하이브리드" || a.fuel === "EV", pts: 12, reason: "연료비 절감으로 운영비 절감" },
    { match: (a, cat) => cat === "밴" || cat === "트럭", pts: 10 },
    { match: (a, cat) => cat.includes("경차"), pts: 8, reason: "취득세·보험료·주차비 절감" },
    { match: (a, cat, price) => price >= 80_000_000, pts: -10, reason: "업무용 한도 초과 리스크" },
  ],
  개인: [
    { match: (a) => a.isPopular, pts: 10, reason: "많은 분들이 선택한 검증된 차량" },
    { match: (a) => a.fuel === "EV", pts: 12, reason: "유지비 절감" },
  ],
};

// 목적 가점 (문서 2장)
export const PURPOSE_RULES: Record<string, { match: (a, cat, eff: number | null) => boolean; pts: number; reason?: string }[]> = {
  "출퇴근·업무용": [
    { match: (a, cat, eff) => (eff ?? 0) >= 15, pts: 15, reason: "매일 타는 차, 연비가 곧 월 절감액" },
    { match: (a) => a.fuel === "하이브리드", pts: 12, reason: "시내 주행 많은 출퇴근에 최적" },
    { match: (a) => a.fuel === "EV", pts: 15, reason: "출퇴근 구간 연료비 절감" },
    { match: (a, cat) => cat === "트럭" || cat === "밴", pts: -15 },
  ],
  "영업·외근": [
    { match: (a, cat, eff) => (eff ?? 0) >= 15, pts: 15 },
    { match: (a) => a.fuel === "하이브리드", pts: 12 },
    { match: (a, cat) => cat === "SUV", pts: 8, reason: "영업 샘플·장비 적재" },
  ],
  "임원용·의전": [
    { match: (a, cat) => cat.includes("대형") || cat.includes("세단"), pts: 20, reason: "임원 의전용 품격·승차감" },
    { match: (a, cat) => cat.includes("프리미엄"), pts: 18 },
    { match: (a, cat, _e) => cat.includes("경차") || cat.includes("소형"), pts: -25 },
  ],
  가정용: [
    { match: (a, cat) => cat === "SUV", pts: 15, reason: "가족 나들이에 넓은 공간·높은 시야" },
    { match: (a) => (a.seating ?? 0) >= 7, pts: 12, reason: "온 가족이 함께" },
    { match: (a) => a.hasAdvancedSafety, pts: 10, reason: "가족 안전 첨단 안전사양" },
  ],
};

// 주행거리×연비 (문서 3장)
export const MILEAGE_FUEL_RULES: Record<number, { match: (a, eff: number | null) => boolean; pts: number; reason?: string }[]> = {
  10000: [{ match: (a, eff) => false, pts: 0 }],
  20000: [
    { match: (a, eff) => (eff ?? 0) >= 15, pts: 10 },
    { match: (a, eff) => (eff ?? 0) >= 12 && (eff ?? 0) < 15, pts: 5 },
    { match: (a, eff) => (eff ?? 99) < 12, pts: -5 },
    { match: (a) => a.fuel === "하이브리드", pts: 12, reason: "연 2만km면 하이브리드로 연료비 절감" },
  ],
  30000: [
    { match: (a) => a.fuel === "EV", pts: 20, reason: "연 3만km EV로 연료비 대폭 절감" },
    { match: (a) => a.fuel === "하이브리드", pts: 18 },
    { match: (a, eff) => (eff ?? 0) >= 15, pts: 15 },
    { match: (a, eff) => (eff ?? 99) < 12, pts: -10 },
    { match: (a) => a.fuel === "디젤", pts: 10, reason: "장거리에 디젤 고효율 유리" },
  ],
};

// 화물 종류 (문서 4장) — purposeDetail + 적재중량/냉장
export const CARGO_RULES: { match: (a, cat, detail: string) => boolean; pts: number; reason?: string }[] = [
  { match: (a, cat, d) => d === "소형 박스" && cat === "밴", pts: 15 },
  { match: (a, cat, d) => d === "소형 박스" && cat === "SUV", pts: 10 },
  { match: (a, cat, d) => d === "대형 화물" && a.cargoKg !== null && a.cargoKg >= 1000 && a.cargoKg < 1500, pts: 25, reason: "1톤급 적재" },
  { match: (a, cat, d) => d === "대형 화물" && a.cargoKg !== null && a.cargoKg >= 1500, pts: 30, reason: "대형 적재" },
  { match: (a, cat, d) => d === "대형 화물" && (cat === "세단" || cat === "SUV"), pts: -20 },
  { match: (a) => a.isRefrigerated, pts: 25, reason: "냉장·냉동 특장" },
];

// 자녀연령 (문서 5장) — purposeDetail
export const CHILD_RULES: Record<string, { match: (a, cat) => boolean; pts: number; reason?: string }[]> = {
  영유아: [
    { match: (a, cat) => cat === "SUV", pts: 20, reason: "유모차 적재 쉬운 넓은 공간" },
    { match: (a) => a.hasSlidingDoor, pts: 15, reason: "슬라이딩 도어로 카시트·유모차 편리" },
    { match: (a, cat) => cat.includes("세단"), pts: -10 },
  ],
  미취학: [
    { match: (a, cat) => cat === "SUV", pts: 18, reason: "카시트·승하차 편한 실내" },
    { match: (a) => (a.seating ?? 0) >= 7, pts: 10 },
    { match: (a) => a.hasAdvancedSafety, pts: 15, reason: "어린이 동승 안전사양" },
  ],
  초등: [
    { match: (a, cat) => cat === "SUV" || cat === "밴", pts: 15 },
    { match: (a) => (a.seating ?? 0) >= 7, pts: 12 },
  ],
  "중학생+": [{ match: (a, cat) => cat === "SUV" || cat.includes("세단"), pts: 10 }],
};

// 충전환경 (문서 6-4) — EV에만 적용
export const CHARGING_RULES: Record<string, number> = { 자택: 20, 직장: 15, 외부: 5, 없음: -15 };

// 거주지역 (문서 6-2)
export const REGION_RULES: { region: string; match: (a) => boolean; pts: number; reason?: string }[] = [
  { region: "강원·산간", match: (a) => a.isAwd, pts: 15, reason: "눈길·비포장 안정적 AWD" },
  { region: "제주", match: (a) => a.fuel === "EV", pts: 20, reason: "제주 전기차 보조금·충전 인프라 우수" },
];
```

> 참고: `match` 시그니처는 모듈 내부에서 동일하게 쓰이므로 `scoring.ts` 에서 호출부 타입을 맞춘다. 위 인라인 `any` 는 Task 4.2 에서 `VehicleAttrs` 로 명시 타이핑한다(coding-style: any 금지).

- [ ] **Step 2: 타입 확인** — Run: `npx tsc --noEmit`. (any 제거는 4.2에서 최종 정리.)

- [ ] **Step 3: 라벨 정합성 테스트 통과** — Run: `npx vitest run src/lib/recommend/label-consistency.test.ts` → PASS (SCORING_PURPOSES/INDUSTRIES export 됨).

- [ ] **Step 4: Commit**

```bash
git add src/lib/recommend/scoring-rules.ts
git commit -m "feat(recommend): 문서 가점을 규칙 테이블로 인코딩"
```

### Task 4.2: 스코어링 순수 함수

**Files:**
- Create: `src/lib/recommend/scoring.ts`, `src/lib/recommend/scoring.test.ts`

`scoreVehicle(input, attrs, ctx)` 가 `{ score, reasons }` 반환. `BASE_SCORE=50`, 상한 `MAX_SCORE=250`.

- [ ] **Step 1: 실패 테스트 (문서 검증 케이스)**

```typescript
import { describe, it, expect } from "vitest";
import { scoreVehicle } from "./scoring";
import type { VehicleAttrs } from "./vehicle-attributes";

const evSUV: VehicleAttrs = { isAwd: false, cargoKg: null, isRefrigerated: false, seating: 5, fuel: "EV", hasSlidingDoor: false, hasAdvancedSafety: false };

describe("scoreVehicle", () => {
  it("법인 + EV SUV: 기본50 + 업종(SUV18, EV15) 가산", () => {
    const { score } = scoreVehicle(
      { industry: "법인", purpose: "출퇴근·업무용", annualMileage: 10000 },
      evSUV, { category: "SUV", price: 50_000_000, fuelEfficiency: 13 },
    );
    expect(score).toBeGreaterThanOrEqual(50 + 18 + 15);
  });
  it("가정용 영유아 + 슬라이딩도어 SUV: 슬라이딩 가점 반영", () => {
    const attrs: VehicleAttrs = { ...evSUV, hasSlidingDoor: true, seating: 7 };
    const { score, reasons } = scoreVehicle(
      { industry: "개인", purpose: "가정용", purposeDetail: "영유아", annualMileage: 10000 },
      attrs, { category: "SUV", price: 45_000_000, fuelEfficiency: 12 },
    );
    expect(reasons.join()).toContain("슬라이딩");
    expect(score).toBeGreaterThan(50);
  });
  it("상한 250 클램핑", () => {
    const attrs: VehicleAttrs = { ...evSUV, hasAdvancedSafety: true, seating: 7, isAwd: true };
    const { score } = scoreVehicle(
      { industry: "법인", purpose: "가정용", purposeDetail: "미취학", annualMileage: 30000, residenceRegion: "제주", fuelPreference: "전기차", chargingEnvironment: "자택" },
      attrs, { category: "SUV", price: 50_000_000, fuelEfficiency: 18 },
    );
    expect(score).toBeLessThanOrEqual(250);
  });
});
```

- [ ] **Step 2: 실패 확인** → FAIL (scoring.ts 없음).

- [ ] **Step 3: 구현** — 규칙 테이블을 순회하며 매칭된 가점 합산. 충전환경은 EV+`fuelPreference==="전기차"` 일 때만. `any` 제거하고 `VehicleAttrs` 명시.

```typescript
import type { VehicleAttrs } from "./vehicle-attributes";
import {
  INDUSTRY_RULES, PURPOSE_RULES, MILEAGE_FUEL_RULES, CARGO_RULES,
  CHILD_RULES, CHARGING_RULES, REGION_RULES,
} from "./scoring-rules";
import type { RecommendInput } from "@/types/recommendation";

const BASE_SCORE = 50;
const MAX_SCORE = 250;

interface ScoreCtx { category: string; price: number; fuelEfficiency: number | null; }

export function scoreVehicle(
  input: Pick<RecommendInput, "industry" | "purpose" | "purposeDetail" | "annualMileage" | "residenceRegion" | "fuelPreference" | "chargingEnvironment">,
  attrs: VehicleAttrs,
  ctx: ScoreCtx,
): { score: number; reasons: string[] } {
  let score = BASE_SCORE;
  const reasons: string[] = [];
  const add = (pts: number, reason?: string) => { score += pts; if (reason) reasons.push(reason); };

  for (const r of INDUSTRY_RULES[input.industry] ?? []) if (r.match(attrs, ctx.category, ctx.price)) add(r.pts, r.reason);
  for (const r of PURPOSE_RULES[input.purpose] ?? []) if (r.match(attrs, ctx.category, ctx.fuelEfficiency)) add(r.pts, r.reason);

  const mileageKey = [10000, 20000, 30000].reduce((p, c) => Math.abs(c - input.annualMileage) < Math.abs(p - input.annualMileage) ? c : p, 10000);
  for (const r of MILEAGE_FUEL_RULES[mileageKey] ?? []) if (r.match(attrs, ctx.fuelEfficiency)) add(r.pts, r.reason);

  if (input.purpose === "화물·배달")
    for (const r of CARGO_RULES) if (r.match(attrs, ctx.category, input.purposeDetail ?? "")) add(r.pts, r.reason);

  if (input.purpose === "가정용" && input.purposeDetail)
    for (const r of CHILD_RULES[input.purposeDetail] ?? []) if (r.match(attrs, ctx.category)) add(r.pts, r.reason);

  if (input.fuelPreference === "전기차" && attrs.fuel === "EV" && input.chargingEnvironment)
    add(CHARGING_RULES[input.chargingEnvironment] ?? 0);

  if (input.residenceRegion)
    for (const r of REGION_RULES) if (r.region === input.residenceRegion && r.match(attrs)) add(r.pts, r.reason);

  return { score: Math.min(MAX_SCORE, score), reasons };
}
```

> Task 4.1 의 규칙 `match` 시그니처를 위 호출(`(attrs, cat, price/eff/detail)`)에 맞춰 `VehicleAttrs` 로 타이핑 정리하고 `any` 제거.

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run src/lib/recommend/scoring.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/recommend/scoring.ts src/lib/recommend/scoring.test.ts src/lib/recommend/scoring-rules.ts
git commit -m "feat(recommend): 규칙 테이블 기반 순수 스코어링 함수 + 검증 테스트"
```

### Task 4.3: `ai-recommender.ts` 를 새 엔진으로 교체

**Files:**
- Modify: `src/lib/ai-recommender.ts`

- [ ] **Step 1: 옵션 로드 추가** — vehicle include 에 트림 옵션명 포함(슬라이딩/안전 자동검출용):

```typescript
      trims: {
        where: { isVisible: true },
        orderBy: { isDefault: "desc" },
        include: { options: { select: { name: true } } },
      },
```

- [ ] **Step 2: 인라인 스코어링(123~262행) 제거 후 새 함수 호출** — `buildVehicleAttrs` + `scoreVehicle` 사용. `isOfficial` 트림 선택(최고가) 로직과 `defaultTrim.price < 60_000_000` 컷은 유지(임원·의전 특수 규칙).

```typescript
import { buildVehicleAttrs } from "@/lib/recommend/vehicle-attributes";
import { scoreVehicle } from "@/lib/recommend/scoring";

// ... 루프 내부, bestMonthly 확정 직후:
const attrs = buildVehicleAttrs(
  { name: v.name, category: v.category, isPopular: v.isPopular,
    slidingDoorOverride: v.slidingDoorOverride, advancedSafetyOverride: v.advancedSafetyOverride },
  { name: defaultTrim.name, engineType: defaultTrim.engineType, fuelEfficiency: defaultTrim.fuelEfficiency,
    price: defaultTrim.price, detailedSpecs: defaultTrim.detailedSpecs, options: defaultTrim.options },
);
const { score, reasons } = scoreVehicle(
  { industry: input.industry, purpose: input.purpose, purposeDetail: input.purposeDetail,
    annualMileage: input.annualMileage, residenceRegion: input.residenceRegion,
    fuelPreference: input.fuelPreference, chargingEnvironment: input.chargingEnvironment },
  attrs,
  { category: v.category ?? "", price: defaultTrim.price, fuelEfficiency: defaultTrim.fuelEfficiency },
);
```

기존 `reason`/`highlights` 생성은 `reasons` 를 활용하도록 정리(LLM reason 폴백은 유지). `recConfig.scoreMatrix` 가산은 제거하거나 보조 가중치로 유지할지 결정 — 기본은 **제거**(문서 로직으로 일원화), 단 `recConfig.aiCaption`/`highlights` 표시는 유지.

- [ ] **Step 3: 타입·빌드 확인** — Run: `npx tsc --noEmit` → 에러 없음.

- [ ] **Step 4: 통합 스모크** — Run: `npm run dev` → `/recommend` 각 분기(법인/임원·의전, 가정용 영유아, 화물·배달 대형, 영업·외근, 제주+전기차) 추천 결과·이유 확인.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai-recommender.ts
git commit -m "feat(recommend): 추천 엔진을 속성·규칙 기반 스코어링으로 교체"
```

---

## Phase 5 — 회귀·정리

### Task 5.1: 기존 추천 테스트 회귀 + 전체 그린

**Files:**
- Verify: 전체 테스트

- [ ] **Step 1: 전체 테스트** — Run: `npm test` → 전부 PASS. 실패 시 해당 테스트가 옛 라벨/필드 가정인지 확인 후 수정(구현이 옳다면 테스트 갱신).

- [ ] **Step 2: 빌드** — Run: `npm run build` → 성공.

- [ ] **Step 3: Commit (필요 시 테스트 수정)**

```bash
git add -A
git commit -m "test(recommend): 추천 고도화에 따른 회귀 테스트 정리"
```

### Task 5.2: 점검 스크립트 정리

**Files:**
- Delete: `scripts/inspect-rec-data.ts`, `scripts/inspect-rec-data2.ts`

- [ ] **Step 1: 일회성 스크립트 제거**

```bash
git rm -f scripts/inspect-rec-data.ts scripts/inspect-rec-data2.ts 2>/dev/null || rm -f scripts/inspect-rec-data*.ts
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "chore(recommend): 일회성 데이터 점검 스크립트 제거"
```

### Task 5.3: 문서 동기화

**Files:**
- Modify: `CLAUDE.md` (추천 엔진 섹션이 있으면) 또는 `docs/` 의 추천 명세

- [ ] **Step 1: 추천 로직 구조 변경 반영** — `src/lib/recommend/` 모듈 분리, 가점 규칙 테이블 위치, override 컬럼·어드민 토글을 간단히 문서화.

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "docs(recommend): AI 추천 고도화 구조·규칙 문서화"
```

---

## Self-Review 결과

- **Spec 커버리지:** 문서 1장(업종)=Task4.1 INDUSTRY_RULES / 2장(목적)=PURPOSE_RULES / 3장(주행×연비)=MILEAGE_FUEL_RULES / 4장(화물)=CARGO_RULES+적재중량(1.2) / 5장(자녀)=CHILD_RULES+4단계선택지(3.2) / 6-2(지역)=REGION_RULES+지역스텝(3.3,3.4) / 6-4(충전3단계)=CHARGING_RULES+선택지(3.2). 6-1(예산)·6-3(재계약)=**의도적 제외**(결정사항). 트렁크500L=대형SUV·7인승 대체(CHILD_RULES). 선행버그=Phase0.
- **플레이스홀더:** 없음(규칙 값은 PDF 전사, 코드 블록 제공).
- **타입 일관성:** `VehicleAttrs` 필드(isAwd/cargoKg/isRefrigerated/seating/fuel/hasSlidingDoor/hasAdvancedSafety)를 Phase1 정의→Phase4 소비까지 동일 사용. `scoreVehicle` 시그니처 1.x/4.2 일치. 잔여 정리: 4.1 규칙 `match` 의 임시 `any` 를 4.2에서 `VehicleAttrs` 로 확정(coding-style any 금지 준수).

## 미해결/실행 중 결정 필요

- **Task 4.2 충전환경 적용 조건:** 현재 `fuelPreference==="전기차"` AND `attrs.fuel==="EV"` 둘 다일 때만 가산. 비-전기 선호인데 EV 차량이 떴을 때도 충전환경을 반영할지는 실행 중 1줄로 조정 가능.
- **Task 4.3 `recConfig.scoreMatrix` 처리:** 기본은 제거(문서 로직 일원화). 어드민에서 수동 조정해온 기존 가중치를 유지해야 하면 보조 가산으로 남길 수 있음 — 실행 시 확인.
