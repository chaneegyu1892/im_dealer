/**
 * 외부 차량 데이터 소스 JSON 임포트를 위한 코드 변환 상수
 *
 * - JSON 의 cartype/engine 코드를 DB 의 한글 카테고리로 매핑
 * - 이미지 상대경로를 절대 URL 로 변환
 * - 한글 차종명을 영문 slug 로 변환
 *
 * 변환 정책은 docs/vehicle-import.md 참조.
 */

/** JSON `cartype` 코드 → DB `Vehicle.category` 4분류 */
export const CARTYPE_TO_CATEGORY: Record<string, string> = {
  // 승용
  P1: "세단",   // 경형
  P3: "세단",   // 소형
  P4: "세단",   // 준중형
  P5: "세단",   // 중형
  P6: "세단",   // 준대형
  P7: "세단",   // 대형
  PS: "세단",   // 스포츠카
  // SUV
  R1: "SUV",    // 경형 SUV
  R2: "SUV",    // 소형 SUV
  R3: "SUV",    // 준중형 SUV
  R5: "SUV",    // 중형 SUV
  R7: "SUV",    // 대형 SUV
  // 밴 / 트럭
  RM: "밴",     // RV/MPV
  B0: "밴",     // 승합
  T0: "트럭",   // 화물
};

/** JSON `cartype` 코드의 세부 라벨 (jsonb 메타에 보관) */
export const CARTYPE_LABEL: Record<string, string> = {
  P1: "경형",
  P3: "소형",
  P4: "준중형",
  P5: "중형",
  P6: "준대형",
  P7: "대형",
  PS: "스포츠카",
  R1: "경형 SUV",
  R2: "소형 SUV",
  R3: "준중형 SUV",
  R5: "중형 SUV",
  R7: "대형 SUV",
  RM: "RV/MPV",
  B0: "승합",
  T0: "화물",
};

/** JSON `engine` 코드 → DB `Trim.engineType` */
export const ENGINE_TO_TYPE: Record<string, string> = {
  G: "가솔린",
  D: "디젤",
  L: "LPG",
  E: "EV",
  H: "수소",
  C: "CNG",
  X: "하이브리드",
};

/** 다중 엔진 코드 ("G,D") → 대표 1개 */
export function pickPrimaryEngine(code: string): string {
  const first = code.split(",")[0]?.trim();
  return ENGINE_TO_TYPE[first ?? ""] ?? "가솔린";
}

/** 외부 CDN base */
export const EXTERNAL_IMG_BASE = "https://p.ca8.kr/img/";

/** 상대 경로 (예: "model/202605/184241.png") → 절대 URL */
export function externalImageUrl(relativePath: string | null | undefined): string {
  if (!relativePath) return "";
  return EXTERNAL_IMG_BASE + relativePath;
}

/** 외부 PDF 뷰어 URL — files 객체의 url1/2/3 을 그대로 사용 (이미 절대 URL) */
export function pickFileUrl(file: {
  url1?: string;
  url2?: string;
  url3?: string;
}): string {
  return file.url1 ?? file.url2 ?? file.url3 ?? "";
}

/** 한글 차종명 + brand + externalId → 영문 slug
 *
 * 예: ("현대", "더 뉴 그랜저", "11874") → "external-hyundai-11874"
 *
 * 이름 음역은 어려우므로 brand 영문 + externalId 조합으로 유니크 보장.
 * 기존 27 대 slug 와 충돌 방지 위해 `external-` prefix 추가.
 */
export const BRAND_TO_SLUG: Record<string, string> = {
  // 국산
  현대: "hyundai",
  기아: "kia",
  제네시스: "genesis",
  쉐보레: "chevrolet",
  KGM: "kgm",
  쌍용: "kgm",
  르노: "renault",
  르노코리아: "renault",
  // 수입 (자주 등장)
  벤츠: "benz",
  BMW: "bmw",
  아우디: "audi",
  폭스바겐: "vw",
  볼보: "volvo",
  포르쉐: "porsche",
  미니: "mini",
  테슬라: "tesla",
  렉서스: "lexus",
  토요타: "toyota",
  혼다: "honda",
  닛산: "nissan",
  인피니티: "infiniti",
  포드: "ford",
  지프: "jeep",
  캐딜락: "cadillac",
  링컨: "lincoln",
};

export function makeExternalSlug(brand: string, externalId: string): string {
  const fallback =
    brand
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 10) || "unknown";
  const brandSlug = BRAND_TO_SLUG[brand] ?? fallback;
  return `${brandSlug}-${externalId}`;
}

/** JSON `state` 코드 → 노출 가능 여부
 *
 * "2" = 현행 판매, "3" = 단종/구형. 임포트 시 단종은 isVisible=false 고정.
 */
export function isCurrentlySold(state: string | undefined | null): boolean {
  return state === "2";
}

/** 외부 TSV "id\tprice\tflag\n..." 파싱 */
export interface TsvColorRow {
  id: string;
  priceDelta: number;
  flag: string;
}

export function parseColorTsv(tsv: string | undefined | null): TsvColorRow[] {
  if (!tsv) return [];
  return tsv
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [id, price, flag] = line.split("\t");
      return {
        id: id ?? "",
        priceDelta: parseInt(price ?? "0", 10) || 0,
        flag: flag ?? "",
      };
    });
}

/** 외부 TSV "optionId\tprice\tcondition\tflag\n..." 파싱 (trim.option 용) */
export interface TsvOptionRow {
  id: string;
  price: number;
  condition: string;
  flag: string;
}

export function parseOptionTsv(tsv: string | undefined | null): TsvOptionRow[] {
  if (!tsv) return [];
  return tsv
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [id, price, condition, flag] = line.split("\t");
      return {
        id: id ?? "",
        price: parseInt(price ?? "0", 10) || 0,
        condition: condition ?? "",
        flag: flag ?? "",
      };
    });
}

/** rgb "E9E9E7" → "#E9E9E7" */
export function normalizeHex(rgb: string | undefined | null): string {
  const v = (rgb ?? "").trim();
  if (!v) return "#000000";
  return v.startsWith("#") ? v : `#${v}`;
}

/** 외부 efficiency 객체 (base64 key) → 평균 연비 (대표값)
 *
 * 예: { "휘발유": { min:"8.9", max:"11.6" } } → 10.25
 * 여러 연료가 있으면 첫 번째 평균값 사용.
 */
export function pickRepresentativeEfficiency(
  efficiency: Record<string, { name?: string; min?: string; max?: string; unit?: string }> | undefined | null
): number | null {
  if (!efficiency) return null;
  const entries = Object.values(efficiency);
  if (entries.length === 0) return null;
  const first = entries[0];
  if (!first) return null;
  const min = parseFloat(first.min ?? "0");
  const max = parseFloat(first.max ?? "0");
  if (min <= 0 && max <= 0) return null;
  if (min > 0 && max > 0) return Math.round(((min + max) / 2) * 10) / 10;
  return min || max;
}

// ─────────────────────────────────────────────────────────────
// 외부 spec/specGroup/specDefine → 기존 UI 가 읽는 jsonb 구조 변환
// CarDetailClient.tsx 의 DetailedSpecsSection 은
//   specs.dimensions / specs.[variant_key] / technical_specs.[section]
// 형태만 인식하므로, 이 형태로 펼쳐서 저장한다.
// ─────────────────────────────────────────────────────────────

/** JSON 의 한국어 항목명 → 기존 UI 가 쓰는 영문 키 + 배치 섹션 */
type FieldTarget = {
  key: string;
  /** "engine" = engine variant 안으로, "dimensions" = specs.dimensions, 그 외는 technical_specs 의 section 이름 */
  section: "engine" | "dimensions" | "efficiency" | "transmission" | "capacities" | "cargo" | "electric_system" | "tire" | "weight";
};

const SPEC_FIELD_MAP: Record<string, FieldTarget> = {
  // 외관 (1853 그룹)
  "전장":           { key: "length",        section: "dimensions" },
  "전폭":           { key: "width",         section: "dimensions" },
  "전고":           { key: "height",        section: "dimensions" },
  "축간거리":       { key: "wheelbase",     section: "dimensions" },
  "윤거(전)":       { key: "front_track",   section: "dimensions" },
  "윤거(후)":       { key: "rear_track",    section: "dimensions" },
  "트렁크 용량":    { key: "trunk_capacity",section: "capacities" },
  "적재함(장)":     { key: "cargo_length",  section: "cargo" },
  "적재함(폭)":     { key: "cargo_width",   section: "cargo" },
  "적재함(고)":     { key: "cargo_height",  section: "cargo" },
  "상면고":         { key: "bed_height",    section: "cargo" },

  // 엔진 (1854 그룹)
  "엔진형식":       { key: "engine",        section: "engine" },
  "배기량":         { key: "displacement",  section: "engine" },
  "최고출력":       { key: "max_power",     section: "engine" },
  "최대토크":       { key: "max_torque",    section: "engine" },
  "연료탱크":       { key: "fuel_tank",     section: "capacities" },
  "모터형식":       { key: "motor_type",    section: "electric_system" },
  "모터 최고출력":  { key: "motor_max_power",  section: "electric_system" },
  "모터 최대토크":  { key: "motor_max_torque", section: "electric_system" },
  "배터리 종류":    { key: "battery_type",     section: "electric_system" },
  "배터리 용량":    { key: "battery",          section: "electric_system" },
  "축전지 정격전압":{ key: "battery_voltage",  section: "electric_system" },
  "축전지 정격용량":{ key: "battery_amp_hours",section: "electric_system" },

  // 연비 (1855 그룹)
  "연료":             { key: "fuel_type",            section: "engine" },
  "복합연비":         { key: "fuel_efficiency",      section: "efficiency" },
  "도심연비":         { key: "fuel_efficiency_city", section: "efficiency" },
  "고속도로연비":     { key: "fuel_efficiency_hwy",  section: "efficiency" },
  "CO2 배출량":       { key: "co2_emissions",        section: "efficiency" },
  "공차중량":         { key: "curb_weight",          section: "weight" },
  "변속기":           { key: "transmission",         section: "transmission" },
  "타이어":           { key: "tire_size",            section: "tire" },
  "1회충전 주행거리 (복합)":      { key: "range",         section: "electric_system" },
  "1회충전 주행거리 (도심)":      { key: "range_city",    section: "electric_system" },
  "1회충전 주행거리 (고속도로)":  { key: "range_hwy",     section: "electric_system" },

  // 타이어 (1882 그룹)
  "제조사":           { key: "tire_manufacturer",        section: "tire" },
  "규격":             { key: "tire_spec",                section: "tire" },
  "모델명":           { key: "tire_model",               section: "tire" },
  "회전저항(계수)":   { key: "tire_rolling_resistance",  section: "tire" },
  "젖은 노면 제동력 지수": { key: "tire_wet_grip",       section: "tire" },
  "장착 위치":        { key: "tire_position",            section: "tire" },
};

/** specGroup.name 의 한국어 → 처리 카테고리 */
function classifyGroupName(name: string | undefined): "exterior" | "engine" | "efficiency" | "tire" | "other" {
  const n = name ?? "";
  if (n.includes("외관") || n.includes("치수")) return "exterior";
  if (n.includes("엔진") || n.includes("동력")) return "engine";
  if (n.includes("연비") || n.includes("성능")) return "efficiency";
  if (n.includes("타이어")) return "tire";
  return "other";
}

/** specSet.name → engine variant 키 (snake_case)
 * 예: "가솔린 2.5" → "gasoline_2.5", "LPG 3.5" → "lpg_3.5", "EV" → "electric"
 */
export function normalizeVariantKey(name: string | undefined): string {
  const n = (name ?? "").trim();
  if (!n) return "default";
  if (/전기|electric|^EV$|\bEV\b/i.test(n)) return "electric";
  if (/수소|hydrogen|fuel\s?cell/i.test(n)) return "hydrogen";

  let prefix = "gasoline";
  if (/하이브리드|hybrid|HEV|PHEV/i.test(n)) prefix = "hybrid";
  else if (/디젤|diesel/i.test(n)) prefix = "diesel";
  else if (/LPG|lpg/i.test(n)) prefix = "lpg";
  else if (/가솔린|gasoline|petrol/i.test(n)) prefix = "gasoline";

  const disp = n.match(/(\d+\.\d+)/)?.[1];
  return disp ? `${prefix}_${disp}` : prefix;
}

/** 값에 단위 붙이기 ("2497" + "㏄" → "2,497㏄") */
function formatWithUnit(value: string, unit: string | undefined): string {
  const v = (value ?? "").trim();
  if (!v) return "";
  const u = (unit ?? "").trim();
  return u ? `${v}${u}` : v;
}

interface SpecConversionArgs {
  spec?: Record<string, Record<string, string>>;
  specGroup?: Record<string, { name?: string; list?: string }>;
  specDefine?: Record<string, { name?: string; unit?: string; group?: string }>;
  /** model.efficiency (base64 키) — 연료별 min/max */
  efficiency?: Record<string, { name?: string; min?: string; max?: string; unit?: string }>;
}

export interface LegacySpecsShape {
  specs: Record<string, Record<string, string>>;
  technical_specs: Record<string, Record<string, string>>;
}

/**
 * 외부 spec/specGroup/specDefine 을 기존 UI 가 인식하는
 * { specs: {dimensions, variants}, technical_specs: {sections} } 형태로 변환.
 *
 * 처리 우선순위:
 *   1. specGroup.name 에서 "외관/엔진/연비/타이어" 분류
 *   2. 각 그룹의 모든 specSet 을 순회하며 specDefine 으로 항목명 lookup
 *   3. SPEC_FIELD_MAP 으로 영문 키 + 배치 섹션 결정
 *   4. engine 섹션이면 variant 별 객체 생성, 그 외는 technical_specs 의 section 으로
 */
export function buildLegacySpecsShape(args: SpecConversionArgs): LegacySpecsShape {
  const { spec, specGroup, specDefine, efficiency } = args;
  const result: LegacySpecsShape = { specs: {}, technical_specs: {} };

  if (!spec || !specDefine || !specGroup) return result;

  // specDefineId → { name, unit, group }
  const defines = specDefine;

  // specSetId → { fields: {name → value} } (with units appended)
  // 각 specSet 의 모든 항목에 단위 붙여서 보관
  const specSetById: Record<string, { name: string; groupId: string; fields: { defName: string; value: string }[] }> = {};
  for (const [setId, fields] of Object.entries(spec)) {
    const items: { defName: string; value: string }[] = [];
    let groupId = "";
    for (const [defId, rawValue] of Object.entries(fields)) {
      if (defId === "name") continue;
      const def = defines[defId];
      if (!def?.name) continue;
      if (!groupId && def.group) groupId = def.group;
      items.push({
        defName: def.name,
        value: formatWithUnit(rawValue, def.unit),
      });
    }
    const setName = (fields as Record<string, string>).name ?? "";
    specSetById[setId] = { name: setName, groupId, fields: items };
  }

  // groupId → category
  const groupCategory: Record<string, ReturnType<typeof classifyGroupName>> = {};
  for (const [gid, g] of Object.entries(specGroup)) {
    groupCategory[gid] = classifyGroupName(g.name);
  }

  // 변환할 임시 버킷
  const dimensions: Record<string, string> = {};
  const capacities: Record<string, string> = {};
  const cargo: Record<string, string> = {};
  const electric: Record<string, string> = {};
  const tire: Record<string, string> = {};
  const weight: Record<string, string> = {};

  /** variant key → 누적 객체 */
  const variants: Record<string, Record<string, string>> = {};

  function pushToSection(section: FieldTarget["section"], key: string, value: string) {
    if (!value) return;
    switch (section) {
      case "dimensions":  dimensions[key] = value; break;
      case "capacities":  capacities[key] = value; break;
      case "cargo":       cargo[key] = value; break;
      case "electric_system": electric[key] = value; break;
      case "tire":        tire[key] = value; break;
      case "weight":      weight[key] = value; break;
      default: break; // engine/efficiency/transmission 은 variant 안으로 별도 처리
    }
  }

  // 1) 외관 그룹: 첫 specSet 만 사용 (트림마다 윤거가 살짝 달라도 대표값으로)
  const exteriorGroupId = Object.keys(groupCategory).find((g) => groupCategory[g] === "exterior");
  if (exteriorGroupId) {
    const firstExtSet = Object.values(specSetById).find((s) => s.groupId === exteriorGroupId);
    if (firstExtSet) {
      for (const { defName, value } of firstExtSet.fields) {
        const map = SPEC_FIELD_MAP[defName];
        if (!map) continue;
        pushToSection(map.section, map.key, value);
      }
    }
  }

  // 2) 엔진 그룹: 모든 specSet → 각 variant
  const engineGroupId = Object.keys(groupCategory).find((g) => groupCategory[g] === "engine");
  if (engineGroupId) {
    for (const { name, groupId, fields } of Object.values(specSetById)) {
      if (groupId !== engineGroupId) continue;
      const variantKey = normalizeVariantKey(name);
      const variant = (variants[variantKey] ??= {});
      for (const { defName, value } of fields) {
        const map = SPEC_FIELD_MAP[defName];
        if (!map) continue;
        if (map.section === "engine") {
          variant[map.key] = value;
        } else {
          pushToSection(map.section, map.key, value);
        }
      }
    }
  }

  // 3) 연비 그룹: variant 별 fuel_efficiency 등 — 매칭되는 engine variant 에 합치기
  const efficiencyGroupId = Object.keys(groupCategory).find((g) => groupCategory[g] === "efficiency");
  if (efficiencyGroupId) {
    for (const { name, groupId, fields } of Object.values(specSetById)) {
      if (groupId !== efficiencyGroupId) continue;
      const variantKey = normalizeVariantKey(name);
      const variant = (variants[variantKey] ??= {});
      for (const { defName, value } of fields) {
        const map = SPEC_FIELD_MAP[defName];
        if (!map) continue;
        if (map.section === "efficiency" || map.section === "transmission") {
          variant[map.key] = value;
        } else {
          pushToSection(map.section, map.key, value);
        }
      }
    }
  }

  // 4) 타이어 그룹
  const tireGroupId = Object.keys(groupCategory).find((g) => groupCategory[g] === "tire");
  if (tireGroupId) {
    for (const { groupId, fields } of Object.values(specSetById)) {
      if (groupId !== tireGroupId) continue;
      for (const { defName, value } of fields) {
        const map = SPEC_FIELD_MAP[defName];
        if (!map) continue;
        pushToSection(map.section, map.key, value);
      }
    }
  }

  // 5) model.efficiency 백업 매칭 — variant 에 fuel_efficiency 없으면 채움
  if (efficiency) {
    for (const eff of Object.values(efficiency)) {
      const fuelName = eff.name ?? "";
      // 휘발유 → gasoline, 경유 → diesel, LPG → lpg, 전기 → electric
      let variantPrefix = "gasoline";
      if (/경유|디젤/i.test(fuelName)) variantPrefix = "diesel";
      else if (/LPG/i.test(fuelName)) variantPrefix = "lpg";
      else if (/전기/i.test(fuelName)) variantPrefix = "electric";
      else if (/수소/i.test(fuelName)) variantPrefix = "hydrogen";
      else if (/휘발유/i.test(fuelName)) variantPrefix = "gasoline";

      const min = eff.min ?? "";
      const max = eff.max ?? "";
      const unit = eff.unit ?? "";
      const range = min && max && min !== max ? `${min}~${max}${unit}` : `${min || max}${unit}`;

      // 매칭되는 모든 variant 에 백업 적용
      for (const [vKey, vObj] of Object.entries(variants)) {
        if (vKey.startsWith(variantPrefix) && !vObj.fuel_efficiency) {
          vObj.fuel_efficiency = range;
        }
      }
    }
  }

  // 결과 조립
  if (Object.keys(dimensions).length > 0) result.specs.dimensions = dimensions;
  for (const [vKey, vObj] of Object.entries(variants)) {
    if (Object.keys(vObj).length > 0) result.specs[vKey] = vObj;
  }
  if (Object.keys(capacities).length > 0) result.technical_specs.capacities = capacities;
  if (Object.keys(cargo).length > 0) result.technical_specs.cargo = cargo;
  if (Object.keys(electric).length > 0) result.technical_specs.electric_system = electric;
  if (Object.keys(tire).length > 0) result.technical_specs.tire = tire;
  if (Object.keys(weight).length > 0) result.technical_specs.weight = weight;

  return result;
}

/** 외부 option.kind → DB TrimOption.category + isAccessory
 *
 * - "A": 악세서리 → isAccessory=true, category="악세서리"
 * - "G": 일반 옵션 → category="옵션"
 * - "F": 기본 사양 (엔진 변형 등) → category="기본사양"
 * - 기타: category=원본 코드
 */
export function mapOptionKind(kind: string | undefined | null): {
  category: string;
  isAccessory: boolean;
} {
  switch (kind) {
    case "A":
      return { category: "악세서리", isAccessory: true };
    case "G":
      return { category: "옵션", isAccessory: false };
    case "F":
      return { category: "기본사양", isAccessory: false };
    default:
      return { category: kind ?? "옵션", isAccessory: false };
  }
}
