import { z } from "zod";
import { overlapProfileSchema } from "@/lib/recommend/overlap-profile";

// ─── Vehicle ────────────────────────────────────────────
const vehicleFields = {
  name: z.string().min(1, "차량명을 입력하세요"),
  brand: z.string().min(1, "브랜드를 입력하세요"),
  category: z.enum(["세단", "SUV", "밴", "트럭"]),
  basePrice: z.number().int().positive("기준가는 양수여야 합니다"),
  slug: z.string().min(1).optional(),
  description: z.string().optional(),
  isVisible: z.boolean().default(true),
  isPopular: z.boolean().default(false),
  isSpotlight: z.boolean().default(false),
  displayOrder: z.number().int().default(0),
  surchargeRate: z.number().default(0),
  vehicleCode: z.string().optional(),
  slidingDoorOverride: z.boolean().nullable().optional(),
  advancedSafetyOverride: z.boolean().nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(20)).max(10).optional(),
} as const;

export const vehicleCreateSchema = z.object(vehicleFields).strict();

export const vehicleUpdateSchema = z.object(vehicleFields).partial().strict();

// 차량 노출 순서 일괄 저장: 전달된 id 배열 순서대로 displayOrder(0,1,2…) 부여
export const vehicleReorderSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "정렬할 차량이 없습니다").max(500),
});

// ─── Brand ──────────────────────────────────────────────
export const brandCreateSchema = z.object({
  name: z.string().min(1, "브랜드명을 입력하세요").max(40),
  logoUrl: z.string().url().nullable().optional(),
  displayOrder: z.number().int().default(0),
  isFeatured: z.boolean().default(false),
});

export const brandUpdateSchema = z
  .object({
    name: z.string().min(1, "브랜드명을 입력하세요").max(40).optional(),
    logoUrl: z.string().url().nullable().optional(),
    displayOrder: z.number().int().optional(),
    isFeatured: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "수정할 항목이 없습니다.",
  });

// ─── Lineup ─────────────────────────────────────────────
export const lineupCreateSchema = z.object({
  name: z.string().min(1, "라인업명을 입력하세요"),
});

export const lineupUpdateSchema = z
  .object({
    name: z.string().min(1, "라인업명을 입력하세요").optional(),
    isVisible: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "수정할 항목이 없습니다." });

// ─── Trim ───────────────────────────────────────────────
export const trimCreateSchema = z.object({
  name: z.string().min(1, "트림명을 입력하세요"),
  lineupId: z.string().min(1, "라인업을 선택하세요"),
  price: z.number().int().positive("가격은 양수여야 합니다"),
  discountPrice: z.number().int().positive().nullable().optional(),
  // 전기차 보조금(안내용, 견적 미반영). 0 이상 또는 null(미입력=보조금 없음).
  evSubsidy: z.number().int().min(0, "보조금은 0 이상이어야 합니다").nullable().optional(),
  engineType: z.enum(["가솔린", "디젤", "하이브리드", "EV"]),
  isDefault: z.boolean().default(false),
  isVisible: z.boolean().default(true),
  fuelEfficiency: z.number().nullable().optional(),
  specs: z.record(z.string()).nullable().optional(),
});

export const trimUpdateSchema = trimCreateSchema.partial();

// ─── TrimOption ─────────────────────────────────────────
export const optionCreateSchema = z.object({
  name: z.string().min(1, "옵션명을 입력하세요"),
  price: z.number().int().min(0, "가격은 0 이상이어야 합니다"),
  category: z.string().nullable().optional(),
  isDefault: z.boolean().default(false),
  isAccessory: z.boolean().default(false),
  description: z.string().nullable().optional(),
  displayOrder: z.number().int().default(0),
  badgeId: z.string().nullable().optional(),
});

export const optionUpdateSchema = optionCreateSchema.partial();

// 옵션 노출 순서 일괄 저장: id 배열 순서대로 displayOrder(0,1,2…) 부여
export const optionReorderSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "정렬할 옵션이 없습니다").max(500),
});

// ─── OptionBadge (추천 배지 라벨 관리) ──────────────────
export const optionBadgeCreateSchema = z.object({
  label: z.string().min(1, "배지 문구를 입력하세요").max(20, "배지 문구는 20자 이하여야 합니다"),
  displayOrder: z.number().int().default(0),
});

export const optionBadgeUpdateSchema = z
  .object({
    label: z.string().min(1, "배지 문구를 입력하세요").max(20).optional(),
    displayOrder: z.number().int().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "수정할 항목이 없습니다." });

// ─── VehicleColor ───────────────────────────────────────
const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;

export const vehicleColorCreateSchema = z.object({
  kind: z.enum(["EXTERIOR", "INTERIOR"]),
  name: z.string().min(1, "색상명을 입력하세요").max(60),
  hexCode: z.string().regex(HEX_REGEX, "Hex 색상 코드는 #RRGGBB 형식이어야 합니다"),
  imageUrl: z
    .string()
    .max(1000)
    .refine((v) => v.startsWith("/") || /^https?:\/\//.test(v), {
      message: "이미지 URL은 절대 URL 또는 / 로 시작하는 경로여야 합니다",
    })
    .nullable()
    .optional(),
  priceDelta: z.number().int().min(0, "추가요금은 0 이상이어야 합니다").default(0),
  isDefault: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

export const vehicleColorUpdateSchema = vehicleColorCreateSchema.partial();

// ─── OptionRule ─────────────────────────────────────────
export const ruleCreateSchema = z.object({
  ruleType: z.enum(["REQUIRED", "INCLUDED", "CONFLICT"]),
  sourceOptionId: z.string().min(1, "기준 옵션을 선택하세요"),
  targetOptionId: z.string().min(1, "대상 옵션을 선택하세요"),
});

// ─── PopularConfig ──────────────────────────────────────
export const popularConfigItemSchema = z.object({
  name: z.string().min(1, "항목명을 입력하세요"),
  price: z.number().int().min(0, "가격은 0 이상이어야 합니다"),
  trimOptionId: z.string().nullable().optional(),
  displayOrder: z.number().int().default(0),
});

export const popularConfigCreateSchema = z.object({
  name: z.string().min(1, "구성명을 입력하세요"),
  note: z.string().nullable().optional(),
  displayOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  items: z.array(popularConfigItemSchema).default([]),
});

export const popularConfigUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  note: z.string().nullable().optional(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  items: z.array(popularConfigItemSchema).optional(),
});

// ─── Inventory ──────────────────────────────────────────
export const inventoryCreateSchema = z.object({
  vehicleSlug: z.string().min(1, "차량 slug 가 필요합니다"),
  trimName: z.string().min(1, "트림명이 필요합니다"),
  financeCompanyName: z.string().optional(),
  stockCount: z.number().int().min(0).max(9999),
  immediateDelivery: z.boolean().default(false),
  colorExt: z.string().max(50).optional(),
  selectedOptions: z.array(z.string().max(200)).max(50).default([]),
  memo: z.string().max(2000).optional(),
});

export const inventoryUpdateSchema = z.object({
  stockCount: z.number().int().min(0).max(9999).optional(),
  immediateDelivery: z.boolean().optional(),
  colorExt: z.string().max(50).optional(),
  selectedOptions: z.array(z.string().max(200)).max(50).optional(),
  memo: z.string().max(2000).optional(),
  financeCompanyName: z.string().optional(),
  trimName: z.string().min(1).optional(),
  vehicleName: z.string().optional(),
  // 옵티미스틱 락: 클라이언트가 마지막으로 본 updatedAt (ISO 문자열).
  // 누락 시 락 비활성화(하위 호환).
  expectedUpdatedAt: z.string().datetime({ offset: true }).optional(),
});

// ─── AI Recommendation Config ───────────────────────────
const aiConfigMetadataShape = {
  highlights: z.array(z.string().max(200)).max(20).optional(),
  aiCaption: z.string().max(1000).nullable().optional(),
};

const aiConfigCreateSchema = z.object({
  action: z.literal("create"),
  vehicleId: z.string().min(1, "vehicleId가 필요합니다"),
  expectedUpdatedAt: z.never().optional(),
  profile: overlapProfileSchema,
  isActive: z.boolean(),
  ...aiConfigMetadataShape,
}).strict();

const aiConfigUpdateSchema = z.object({
  action: z.literal("update"),
  vehicleId: z.string().min(1, "vehicleId가 필요합니다"),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
  profile: overlapProfileSchema,
  isActive: z.boolean(),
  ...aiConfigMetadataShape,
}).strict();

const aiConfigDeactivateSchema = z.object({
  action: z.literal("deactivate"),
  vehicleId: z.string().min(1, "vehicleId가 필요합니다"),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
}).strict();

export const aiConfigMutationSchema = z.union([
  aiConfigUpdateSchema,
  aiConfigCreateSchema,
  aiConfigDeactivateSchema,
]);

// ─── Slug 생성 유틸 ─────────────────────────────────────
export function generateSlug(brand: string, name: string): string {
  const korean: Record<string, string> = {
    현대: "hyundai", 기아: "kia", 제네시스: "genesis",
    KGM: "kgm", BMW: "bmw", 벤츠: "benz",
  };
  const brandSlug = korean[brand] ?? brand.toLowerCase().replace(/\s+/g, "-");
  const nameSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .replace(/\s+/g, "-");
  return `${brandSlug}-${nameSlug}`;
}
