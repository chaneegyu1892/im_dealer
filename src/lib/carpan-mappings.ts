/**
 * carpan.kr JSON 임포트를 위한 코드 변환 상수
 *
 * - JSON 의 cartype/engine 코드를 DB 의 한글 카테고리로 매핑
 * - 이미지 상대경로를 절대 URL 로 변환
 * - 한글 차종명을 영문 slug 로 변환
 *
 * 변환 정책은 docs/carpan-import.md 참조.
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

/** carpan CDN base */
export const CARPAN_IMG_BASE = "https://p.ca8.kr/img/";

/** 상대 경로 (예: "model/202605/184241.png") → 절대 URL */
export function carpanImageUrl(relativePath: string | null | undefined): string {
  if (!relativePath) return "";
  return CARPAN_IMG_BASE + relativePath;
}

/** carpan PDF 뷰어 URL — files 객체의 url1/2/3 을 그대로 사용 (이미 절대 URL) */
export function pickFileUrl(file: {
  url1?: string;
  url2?: string;
  url3?: string;
}): string {
  return file.url1 ?? file.url2 ?? file.url3 ?? "";
}

/** 한글 차종명 + brand + externalId → 영문 slug
 *
 * 예: ("현대", "더 뉴 그랜저", "11874") → "carpan-hyundai-11874"
 *
 * 이름 음역은 어려우므로 brand 영문 + externalId 조합으로 유니크 보장.
 * 기존 27 대 slug 와 충돌 방지 위해 `carpan-` prefix 추가.
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

export function makeCarpanSlug(brand: string, externalId: string): string {
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

/** carpan TSV "id\tprice\tflag\n..." 파싱 */
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

/** carpan TSV "optionId\tprice\tcondition\tflag\n..." 파싱 (trim.option 용) */
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

/** carpan efficiency 객체 (base64 key) → 평균 연비 (대표값)
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

/** carpan option.kind → DB TrimOption.category + isAccessory
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
