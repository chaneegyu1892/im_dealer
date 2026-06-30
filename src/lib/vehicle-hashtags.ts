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
