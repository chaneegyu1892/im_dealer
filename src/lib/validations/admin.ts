import { z } from "zod";

// ─── Vehicle ────────────────────────────────────────────
export const vehicleCreateSchema = z.object({
  name: z.string().min(1, "차량명을 입력하세요"),
  brand: z.string().min(1, "브랜드를 입력하세요"),
  category: z.enum(["세단", "SUV", "밴", "트럭"]),
  basePrice: z.number().int().positive("기준가는 양수여야 합니다"),
  slug: z.string().min(1).optional(),
  thumbnailUrl: z.string().default(""),
  imageUrls: z.array(z.string()).default([]),
  description: z.string().optional(),
  isVisible: z.boolean().default(true),
  isPopular: z.boolean().default(false),
  displayOrder: z.number().int().default(0),
  surchargeRate: z.number().default(0),
  vehicleCode: z.string().optional(),
});

export const vehicleUpdateSchema = vehicleCreateSchema.partial();

// ─── Brand ──────────────────────────────────────────────
export const brandCreateSchema = z.object({
  name: z.string().min(1, "브랜드명을 입력하세요").max(40),
  logoUrl: z.string().url().nullable().optional(),
  displayOrder: z.number().int().default(0),
});

// ─── Lineup ─────────────────────────────────────────────
export const lineupCreateSchema = z.object({
  name: z.string().min(1, "라인업명을 입력하세요"),
});

export const lineupUpdateSchema = lineupCreateSchema.partial();

// ─── Trim ───────────────────────────────────────────────
export const trimCreateSchema = z.object({
  name: z.string().min(1, "트림명을 입력하세요"),
  lineupId: z.string().min(1, "라인업을 선택하세요"),
  price: z.number().int().positive("가격은 양수여야 합니다"),
  discountPrice: z.number().int().positive().nullable().optional(),
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
});

export const optionUpdateSchema = optionCreateSchema.partial();

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
// scoreMatrix 는 카테고리별 가중치 맵: { [category]: { [key]: 0..1 } }
export const aiConfigUpdateSchema = z.object({
  id: z.string().min(1, "config id 가 필요합니다"),
  highlights: z.array(z.string().max(200)).max(20).optional(),
  aiCaption: z.string().max(1000).optional(),
  scoreMatrix: z
    .record(
      z.string(),
      z.record(z.string(), z.number().min(0).max(1))
    )
    .optional(),
});

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
