# 차량 카드 해시태그 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 차량 탐색(`/cars`) 카드에서 잘리는 description 카피를 차량 특징 해시태그(`#프리미엄` 등)로 대체한다.

**Architecture:** DB 비접근 순수 모듈 `vehicle-hashtags.ts`가 차량 입력으로 해시태그 배열을 산출한다. `/cars` 서버 페이지가 SSR 시 호출해 `VehicleListItem.hashtags`에 담고, `CarCard`가 description 자리에 칩으로 렌더한다. 어드민은 `Vehicle.tags`로 수동 보정한다.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma, Vitest, Tailwind, Zod.

## Global Constraints

- 출력 언어 한국어. 코드 식별자·CLI는 영어 유지.
- 불변 패턴 사용(객체 직접 변경 금지).
- 견적 계산(`quote-calculator.ts`)·추천 점수 로직과 독립 — 건드리지 않는다.
- 어드민 UI 색상 체계 유지: Primary `#000666`, Accent `#6066EE`, Background `#F8F9FC`, Dark `#1A1A2E`.
- 공개 카드 스타일은 토스풍 네이비 토큰(`bg-brand-soft` / `text-brand` / `rounded-pill`) 사용.
- 자동 해시태그 최대 3개. 어드민 수동 태그 우선, 자동으로 3개까지 채움, 중복 제거.
- 테스트 실행: `pnpm test` (Vitest). 빌드: `pnpm build`.

---

### Task 1: 순수 모듈 `vehicle-hashtags.ts` + 단위 테스트

**Files:**
- Create: `src/lib/vehicle-hashtags.ts`
- Test: `src/lib/vehicle-hashtags.test.ts`
- Reuse: `src/lib/recommend/vehicle-attributes.ts` (`detectAwd` export)

**Interfaces:**
- Consumes: `detectAwd(trimName: string): boolean` from `@/lib/recommend/vehicle-attributes`; `EngineType` from `@/types/vehicle`.
- Produces:
  - `interface HashtagTrimInput { name: string; engineType: EngineType; fuelEfficiency: number | null }`
  - `interface HashtagInput { category: "SUV" | "세단" | "밴" | "트럭"; isPopular: boolean; vehicleName: string; basePrice: number; defaultTrim: HashtagTrimInput | null; manualTags?: string[] }`
  - `function deriveHashtags(input: HashtagInput): string[]` — 항상 `#` 접두, 최대 3개.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// src/lib/vehicle-hashtags.test.ts
import { describe, it, expect } from "vitest";
import { deriveHashtags } from "./vehicle-hashtags";

const base = {
  category: "세단" as const,
  isPopular: false,
  vehicleName: "테스트카",
  basePrice: 40_000_000,
  defaultTrim: { name: "기본", engineType: "가솔린" as const, fuelEfficiency: 12 },
};

describe("deriveHashtags", () => {
  it("인기 차량은 #인기를 포함한다", () => {
    expect(deriveHashtags({ ...base, isPopular: true })).toContain("#인기");
  });

  it("고가 차량은 #프리미엄, 저가 차량은 #실속", () => {
    expect(deriveHashtags({ ...base, basePrice: 70_000_000 })).toContain("#프리미엄");
    expect(deriveHashtags({ ...base, basePrice: 25_000_000 })).toContain("#실속");
  });

  it("engineType=EV 또는 차량명 전기 → #전기차", () => {
    expect(
      deriveHashtags({ ...base, defaultTrim: { name: "롱레인지", engineType: "EV", fuelEfficiency: 5 } })
    ).toContain("#전기차");
    expect(deriveHashtags({ ...base, vehicleName: "아반떼 전기" })).toContain("#전기차");
  });

  it("HEV는 engineType=가솔린이라도 차량명으로 #하이브리드 검출", () => {
    const tags = deriveHashtags({
      ...base,
      vehicleName: "디 올 뉴 그랜저 HEV",
      defaultTrim: { name: "프리미엄", engineType: "가솔린", fuelEfficiency: 16.9 },
    });
    expect(tags).toContain("#하이브리드");
  });

  it("연료별 임계값 이상이면 #고연비 (EV는 제외)", () => {
    expect(
      deriveHashtags({ ...base, defaultTrim: { name: "기본", engineType: "가솔린", fuelEfficiency: 18 } })
    ).toContain("#고연비");
    expect(
      deriveHashtags({ ...base, defaultTrim: { name: "기본", engineType: "가솔린", fuelEfficiency: 10 } })
    ).not.toContain("#고연비");
    expect(
      deriveHashtags({ ...base, defaultTrim: { name: "롱레인지", engineType: "EV", fuelEfficiency: 5.5 } })
    ).not.toContain("#고연비");
  });

  it("트림명 AWD → #사륜구동", () => {
    expect(
      deriveHashtags({ ...base, defaultTrim: { name: "프레스티지 AWD", engineType: "가솔린", fuelEfficiency: 11 } })
    ).toContain("#사륜구동");
  });

  it("특징이 없으면 차종 폴백으로 최소 1개 보장", () => {
    const tags = deriveHashtags({ ...base, defaultTrim: { name: "기본", engineType: "가솔린", fuelEfficiency: 10 } });
    expect(tags).toContain("#세단");
    expect(tags.length).toBeGreaterThanOrEqual(1);
  });

  it("최대 3개로 제한된다", () => {
    const tags = deriveHashtags({
      ...base,
      isPopular: true,
      basePrice: 70_000_000,
      defaultTrim: { name: "AWD", engineType: "가솔린", fuelEfficiency: 18 },
    });
    expect(tags.length).toBeLessThanOrEqual(3);
  });

  it("어드민 수동 태그가 앞에 오고 # 정규화된다", () => {
    const tags = deriveHashtags({ ...base, isPopular: true, manualTags: ["대박할인", "#신차"] });
    expect(tags[0]).toBe("#대박할인");
    expect(tags).toContain("#신차");
  });

  it("수동+자동 합쳐도 중복 제거되고 3개 이하", () => {
    const tags = deriveHashtags({
      ...base,
      isPopular: true,
      manualTags: ["#인기", "#A", "#B", "#C"],
    });
    expect(tags).toEqual(["#인기", "#A", "#B"]);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm test src/lib/vehicle-hashtags.test.ts`
Expected: FAIL — `deriveHashtags` 모듈 없음.

- [ ] **Step 3: 모듈 구현**

```ts
// src/lib/vehicle-hashtags.ts
import type { EngineType } from "@/types/vehicle";
import { detectAwd } from "@/lib/recommend/vehicle-attributes";

export interface HashtagTrimInput {
  name: string;
  engineType: EngineType;
  fuelEfficiency: number | null;
}

export interface HashtagInput {
  category: "SUV" | "세단" | "밴" | "트럭";
  isPopular: boolean;
  vehicleName: string;
  basePrice: number;
  defaultTrim: HashtagTrimInput | null;
  manualTags?: string[];
}

const MAX_TAGS = 3;
const PREMIUM_PRICE = 60_000_000;
const VALUE_PRICE = 30_000_000;

// 연료별 고연비 임계값 (EV는 단위가 달라 제외)
const HIGH_MPG: Record<string, number> = {
  가솔린: 15,
  LPG: 15,
  하이브리드: 16,
  디젤: 13,
};

const EV_NAME_RE = /전기|\bEV\b/i;
const HEV_NAME_RE = /HEV|하이브리드|hybrid/i;

function normalizeTag(raw: string): string {
  const s = raw.trim().replace(/^#+/, "").trim();
  return s ? `#${s}` : "";
}

export function deriveHashtags(input: HashtagInput): string[] {
  const tags: string[] = [];
  const push = (t: string) => {
    if (t && !tags.includes(t)) tags.push(t);
  };

  // 1) 어드민 수동 태그 우선
  for (const raw of input.manualTags ?? []) {
    push(normalizeTag(raw));
  }

  const trim = input.defaultTrim;
  const isEv = trim?.engineType === "EV" || EV_NAME_RE.test(input.vehicleName);
  const isHev = trim?.engineType === "하이브리드" || HEV_NAME_RE.test(input.vehicleName);

  // 2) 가치 태그 (우선순위 순)
  if (input.isPopular) push("#인기");
  if (input.basePrice >= PREMIUM_PRICE) push("#프리미엄");
  else if (input.basePrice <= VALUE_PRICE) push("#실속");

  if (isEv) push("#전기차");
  else if (isHev) push("#하이브리드");

  if (!isEv && trim?.fuelEfficiency != null) {
    const key = isHev ? "하이브리드" : trim.engineType;
    const threshold = HIGH_MPG[key];
    if (threshold != null && trim.fuelEfficiency >= threshold) push("#고연비");
  }

  if (trim && detectAwd(trim.name)) push("#사륜구동");

  // 3) 폴백 — 차종으로 최소 노출 보장
  if (tags.length < MAX_TAGS) push(`#${input.category}`);

  return tags.slice(0, MAX_TAGS);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm test src/lib/vehicle-hashtags.test.ts`
Expected: PASS (전체 케이스).

- [ ] **Step 5: 커밋**

```bash
git add src/lib/vehicle-hashtags.ts src/lib/vehicle-hashtags.test.ts
git commit -m "feat(cars): 차량 특징 해시태그 산출 순수 모듈 추가"
```

---

### Task 2: `/cars` 카드에 해시태그 노출 (타입 + SSR + CarCard)

**Files:**
- Modify: `src/types/api.ts` (`VehicleListItem`에 `hashtags` 추가)
- Modify: `src/app/(public)/cars/page.tsx` (`getVehicles` 매핑에서 `deriveHashtags` 호출)
- Modify: `src/components/cars/CarCard.tsx` (description → 해시태그 칩 교체)

**Interfaces:**
- Consumes: `deriveHashtags`, `HashtagInput` from `@/lib/vehicle-hashtags` (Task 1).
- Produces: `VehicleListItem.hashtags: string[]` — `CarCard`가 렌더.

- [ ] **Step 1: `VehicleListItem`에 필드 추가**

`src/types/api.ts`의 `VehicleListItem` 인터페이스에서 `highlights: string[];` 줄 아래에 추가:

```ts
  highlights: string[];
  /** 차량 특징 해시태그 (자동 산출 + 어드민 수동 보정, 최대 3개). '#' 접두 포함. */
  hashtags: string[];
  tags: string[];
```

- [ ] **Step 2: SSR 매핑에 해시태그 산출 추가**

`src/app/(public)/cars/page.tsx` 상단 import 블록에 추가:

```ts
import { deriveHashtags } from "@/lib/vehicle-hashtags";
```

같은 파일 `getVehicles`의 `return vehicles.map((v) => { ... })` 안, `highlights: v.recConfigs?.highlights ?? [],` 줄 바로 위에 추가:

```ts
      hashtags: deriveHashtags({
        category: v.category as "SUV" | "세단" | "밴" | "트럭",
        isPopular: v.isPopular,
        vehicleName: v.name,
        basePrice: v.basePrice,
        defaultTrim: defaultTrim
          ? {
              name: defaultTrim.name,
              engineType: defaultTrim.engineType as EngineType,
              fuelEfficiency: defaultTrim.fuelEfficiency,
            }
          : null,
        manualTags: v.tags,
      }),
```

(`EngineType`은 해당 파일에 이미 import 되어 있음. `v.tags`는 기존 쿼리의 기본 select에 포함됨.)

- [ ] **Step 3: CarCard에서 description을 해시태그로 교체**

`src/components/cars/CarCard.tsx`:

1. import 제거 — 더 이상 쓰지 않는 줄 삭제:

```ts
import { summarizeVehicleDescription } from "@/lib/public-ui-text";
```

2. 컴포넌트 본문에서 description 계산 줄 삭제:

```ts
  const description = summarizeVehicleDescription(vehicle.description, 36);
```

3. description 렌더 블록 전체를 해시태그 칩으로 교체. 기존 블록:

```tsx
          {description && (
            <p className="mb-3 min-h-[18px] text-[12.5px] leading-relaxed text-g1">
              {description}
            </p>
          )}
```

→ 다음으로 교체:

```tsx
          {vehicle.hashtags.length > 0 && (
            <div className="mb-3 flex min-h-[18px] flex-wrap gap-1.5">
              {vehicle.hashtags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-pill bg-brand-soft px-2 py-0.5 text-[11.5px] font-bold text-brand"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
```

- [ ] **Step 4: 타입체크·빌드 확인**

Run: `pnpm build`
Expected: 성공 (타입 에러 없음). `CarCard`에서 `summarizeVehicleDescription` 미사용 import 잔존 시 lint 실패 → 제거 확인.

- [ ] **Step 5: 실데이터 스모크 확인**

Run: `pnpm dev` 후 `/cars` 접속 → 각 카드에 해시태그 칩이 보이고, 빈 카드가 없는지 확인. (개발 서버 미가용 시 Step 4 빌드 통과로 갈음.)

- [ ] **Step 6: 커밋**

```bash
git add src/types/api.ts "src/app/(public)/cars/page.tsx" src/components/cars/CarCard.tsx
git commit -m "feat(cars): 차량 탐색 카드 description을 특징 해시태그로 대체"
```

---

### Task 3: 어드민 수동 태그 보정 (스키마 + 타입 + 쿼리 + UI)

**Files:**
- Modify: `src/lib/validations/admin.ts` (`vehicleCreateSchema`에 `tags`)
- Modify: `src/types/admin.ts` (`AdminVehicle`에 `tags`)
- Modify: `src/lib/admin-queries/vehicles.ts` (목록·상세 매핑에 `tags`)
- Modify: `src/components/admin/vehicles/edit/tabs/BasicInfoTab.tsx` (태그 입력 UI)

**Interfaces:**
- Consumes: 기존 PATCH `/api/admin/vehicles/[id]` (변경 불필요 — `parsed.data` 그대로 저장).
- Produces: `AdminVehicle.tags: string[]` — `BasicInfoTab`가 편집, `/cars`의 `deriveHashtags(manualTags)`가 소비.

- [ ] **Step 1: Zod 스키마에 tags 추가**

`src/lib/validations/admin.ts`의 `vehicleCreateSchema`에서 `advancedSafetyOverride` 줄 아래에 추가:

```ts
  advancedSafetyOverride: z.boolean().nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(20)).max(10).optional(),
```

(`vehicleUpdateSchema = vehicleCreateSchema.partial()`이므로 PATCH에 자동 반영.)

- [ ] **Step 2: AdminVehicle 타입에 tags 추가**

`src/types/admin.ts`의 `AdminVehicle`에서 `description: string | null;` 줄 위에 추가:

```ts
  tags: string[];
  description: string | null;
```

- [ ] **Step 3: 쿼리 매핑에 tags 추가**

`src/lib/admin-queries/vehicles.ts`에서 `description: v.description,`이 나오는 **두 곳**(목록 매핑·상세 매핑) 각각의 바로 위에 추가:

```ts
    tags: v.tags,
    description: v.description,
```

- [ ] **Step 4: 타입체크로 누락 매핑 확인**

Run: `pnpm build`
Expected: `AdminVehicle.tags`를 채우지 않은 매핑이 있으면 타입 에러로 드러남 → 모두 채워지면 통과.

- [ ] **Step 5: BasicInfoTab에 태그 편집 UI 추가**

`src/components/admin/vehicles/edit/tabs/BasicInfoTab.tsx`:

1. `useState`의 `data` 초기값에 `slidingDoorOverride` 줄 위(또는 `description` 근처)에 추가:

```ts
    tags: vehicle.tags ?? [],
```

2. 태그 입력 로컬 상태를 컴포넌트 상단(`const [saving, ...]` 근처)에 추가:

```ts
  const [tagInput, setTagInput] = useState("");

  const addTag = () => {
    const t = tagInput.trim().replace(/^#+/, "").trim();
    if (!t) return;
    setData((prev) =>
      prev.tags.includes(t) ? prev : { ...prev, tags: [...prev.tags, t] }
    );
    setTagInput("");
  };

  const removeTag = (t: string) => {
    setData((prev) => ({ ...prev, tags: prev.tags.filter((x) => x !== t) }));
  };
```

3. 폼 JSX의 "한줄 홍보 문구" `FormField` 블록(닫는 `</FormField>`) **바로 아래**, 저장 버튼 `<div className="pt-2 ...">` **위**에 태그 편집 `FormField`를 추가(기존 `FormField` 래퍼 패턴 준수):

```tsx
          <FormField label="특징 태그 (자동 해시태그 보정 · 비워두면 100% 자동)">
            <div className="flex gap-2">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="예: 프리미엄 (Enter로 추가)"
                className={inputClass}
              />
              <button
                type="button"
                onClick={addTag}
                className="shrink-0 px-3 py-2 text-[13px] font-semibold text-white bg-[#000666] rounded-[6px] hover:bg-[#1A1A6E] transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
            {data.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {data.tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[12px] font-semibold text-[#000666] bg-[#EEF0FF] rounded-[6px]"
                  >
                    #{t}
                    <button type="button" onClick={() => removeTag(t)} className="text-[#6066EE] hover:text-[#000666]">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </FormField>
```

(`Plus`·`X`는 파일 상단 `lucide-react` import에 이미 포함. `FormField`도 이미 사용 중.)

- [ ] **Step 6: 빌드 확인**

Run: `pnpm build`
Expected: 성공.

- [ ] **Step 7: 어드민 수동 보정 동작 확인 (선택)**

`pnpm dev` → 어드민 차량 편집 → 기본 정보 탭에서 태그 추가·저장 → `/cars`에서 해당 차량 카드에 수동 태그가 앞에 노출되는지 확인. (개발 서버 미가용 시 빌드 통과로 갈음.)

- [ ] **Step 8: 커밋**

```bash
git add src/lib/validations/admin.ts src/types/admin.ts src/lib/admin-queries/vehicles.ts src/components/admin/vehicles/edit/tabs/BasicInfoTab.tsx
git commit -m "feat(admin): 차량 특징 태그 수동 보정 입력 추가"
```

---

## Self-Review

- **Spec coverage:** 자동 생성(Task 1) · 완전 대체 UI(Task 2) · 최대 3개+폴백(Task 1) · 어드민 보정(Task 3) · 연료 태그 우선순위 노출(Task 1) 모두 매핑됨. 데이터 제약(person/carry 불가)은 자동 규칙에서 배제하여 반영.
- **Placeholder scan:** 모든 코드 스텝에 실제 코드 포함. TBD 없음.
- **Type consistency:** `deriveHashtags`/`HashtagInput`/`HashtagTrimInput` 시그니처가 Task 1 정의와 Task 2 호출에서 일치. `AdminVehicle.tags: string[]`가 Task 2·3에서 일관.
- **사양 대비 단순화(명시):** 스펙 6순위였던 `#안전사양`/`#슬라이딩도어`는 목록 쿼리에 옵션·스펙 텍스트를 싣지 않으므로 자동 산출에서 제외하고 어드민 수동 태그로 대체한다. (목록 쿼리 확장 회피 — YAGNI)
