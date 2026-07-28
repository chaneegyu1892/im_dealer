export interface ExcludedRecommendationVehicle {
  readonly documentName: string;
  readonly slug: string;
}

export const EXCLUDED_RECOMMENDATION_VEHICLES: readonly ExcludedRecommendationVehicle[] =
  Object.freeze([
    { documentName: "봉고 3 트럭", slug: "kia-10047" },
    { documentName: "봉고 3 특장차", slug: "kia-10366" },
    { documentName: "포터 2", slug: "hyundai-10014" },
    { documentName: "포터 2 Electric", slug: "hyundai-10380" },
    { documentName: "포터 2 특장차", slug: "hyundai-10367" },
    { documentName: "더 뉴 마이티", slug: "hyundai-11753" },
    { documentName: "파비스", slug: "hyundai-11003" },
    { documentName: "카운티", slug: "hyundai-11067" },
    { documentName: "카운티 일렉트릭", slug: "hyundai-10435" },
    { documentName: "쏠라티", slug: "hyundai-10350" },
    { documentName: "ST1", slug: "hyundai-11672" },
    { documentName: "PV5", slug: "kia-11792" },
    { documentName: "무쏘 Q300", slug: "kg-11840" },
    { documentName: "무쏘 스포츠 Q250", slug: "kg-11757" },
    { documentName: "무쏘 칸 Q250", slug: "kg-11758" },
  ]);

const EXCLUSION_BY_SLUG = new Map(
  EXCLUDED_RECOMMENDATION_VEHICLES.map((vehicle) => [vehicle.slug, vehicle.documentName])
);

const STEP02_V3_EXCLUSION_BY_SLUG = new Map(
  EXCLUDED_RECOMMENDATION_VEHICLES
    .filter((vehicle) => !vehicle.documentName.startsWith("무쏘"))
    .map((vehicle) => [vehicle.slug, vehicle.documentName])
);

export type RecommendationExclusion =
  | { readonly kind: "document_slug"; readonly documentName: string }
  | { readonly kind: "vehicle_variant"; readonly documentName: string }
  | { readonly kind: "truck_category"; readonly documentName: null };

interface RecommendationVariantIdentity {
  readonly vehicleName?: string;
  readonly trimName?: string;
  readonly lineupName?: string | null;
}

const PERFORMANCE_VARIANT_PATTERN = /(?:^|[\s-])(?:GT|N)(?=$|[\s-])/i;
const BLACK_INK_PATTERN = /블랙\s*(?:잉크|링크)/;

function isExcludedRecommendationVariant(
  identity: RecommendationVariantIdentity
): boolean {
  return [identity.vehicleName, identity.trimName, identity.lineupName].some(
    (name) => typeof name === "string"
      && (PERFORMANCE_VARIANT_PATTERN.test(name) || BLACK_INK_PATTERN.test(name))
  );
}

export function isExcludedRecommendationTrim(trim: {
  readonly name: string;
  readonly lineup?: { readonly name: string } | null;
}): boolean {
  return isExcludedRecommendationVariant({
    trimName: trim.name,
    lineupName: trim.lineup?.name,
  });
}

export function isExcludedStep02V3RecommendationTrim(trim: {
  readonly name: string;
  readonly lineup?: { readonly name: string } | null;
}): boolean {
  return [trim.name, trim.lineup?.name].some(
    (name) => typeof name === "string" && BLACK_INK_PATTERN.test(name)
  );
}

export function getRecommendationExclusion(vehicle: {
  readonly slug: string;
  readonly category: string;
  readonly name?: string;
}): RecommendationExclusion | null {
  const documentName = EXCLUSION_BY_SLUG.get(vehicle.slug);
  if (documentName) return { kind: "document_slug", documentName };
  if (vehicle.category === "트럭") return { kind: "truck_category", documentName: null };
  if (
    vehicle.name
    && isExcludedRecommendationVariant({ vehicleName: vehicle.name })
  ) {
    return { kind: "vehicle_variant", documentName: vehicle.name };
  }
  return null;
}

export function getStep02V3RecommendationExclusion(vehicle: {
  readonly slug: string;
  readonly name?: string;
}): RecommendationExclusion | null {
  const documentName = STEP02_V3_EXCLUSION_BY_SLUG.get(vehicle.slug);
  if (documentName) return { kind: "document_slug", documentName };
  if (vehicle.name && BLACK_INK_PATTERN.test(vehicle.name)) {
    return { kind: "vehicle_variant", documentName: vehicle.name };
  }
  return null;
}
