import { z } from "zod";
import type { AdminVehicleImage } from "@/types/admin";
import {
  IMAGE_GROUP_NAMES,
  IMAGE_GROUP_TYPES,
  VEHICLE_IMAGE_TYPES,
  type VehicleImageGroup,
  type VehicleImageTypeValue,
} from "@/lib/vehicle-images/groups";

export const IMAGE_TYPE_LABELS = {
  MAIN: "주요 이미지",
  COVER: "커버",
  EXTERIOR_COLOR: "외장 색상",
  INTERIOR_COLOR: "내장 색상",
  SPEC_EXTERIOR: "외관 상세",
  SPEC_INTERIOR: "실내 상세",
  SPEC_SEAT: "시트 상세",
  SPEC_OPTION: "옵션 상세",
  CATALOG_PAGE: "카탈로그 페이지",
} as const satisfies Record<VehicleImageTypeValue, string>;

const GROUP_LABELS = {
  PRIMARY: "대표 및 주요 이미지",
  EXTERIOR_COLOR: "외장 색상",
  INTERIOR_COLOR: "내장 색상",
  SPEC_EXTERIOR: "외관 상세",
  SPEC_INTERIOR: "실내 상세",
  SPEC_SEAT: "시트 상세",
  SPEC_OPTION: "옵션 상세",
  CATALOG_PAGE: "카탈로그 페이지",
} as const satisfies Record<VehicleImageGroup, string>;

export const IMAGE_GROUPS = IMAGE_GROUP_NAMES.map((group) => ({
  group,
  label: GROUP_LABELS[group],
  types: IMAGE_GROUP_TYPES[group],
  initialType: IMAGE_GROUP_TYPES[group][0],
}));

export const VEHICLE_IMAGE_UPLOAD_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
export const VEHICLE_IMAGE_UPLOAD_FORMATS = "JPG, PNG, WebP, GIF";

export const fieldClass = "min-h-11 w-full rounded-[8px] border border-[#D9DDEA] bg-white px-3 text-[13px] text-[#1A1A2E] outline-none transition-colors focus:border-[#6066EE] focus:ring-2 focus:ring-[#6066EE]/20 disabled:cursor-not-allowed disabled:bg-[#F4F5F8]";
export const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6066EE] focus-visible:ring-offset-2";

const imageSchema = z.object({
  id: z.string(),
  type: z.enum(VEHICLE_IMAGE_TYPES),
  origin: z.enum(["CARPAN2", "ADMIN"]),
  title: z.string().nullable(),
  storageUrl: z.string(),
  sourceUrl: z.string().nullable(),
  sourceKey: z.string(),
  displayOrder: z.number().int(),
  isVisible: z.boolean(),
  deletedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  isRepresentative: z.boolean().optional().default(false),
});

export const imageListSchema = z.array(imageSchema);
export const imageListResultSchema = z.object({
  images: imageListSchema,
  thumbnailImageId: z.string().nullable(),
  thumbnailUrl: z.string(),
  imageRevision: z.number().int().nonnegative(),
  vehicleUpdatedAt: z.string(),
});
export const imageMutationResultSchema = z.object({
  image: imageSchema,
  imageRevision: z.number().int().nonnegative(),
  vehicleUpdatedAt: z.string(),
});
export const imageReorderResultSchema = z.object({
  images: imageListSchema,
  imageRevision: z.number().int().nonnegative(),
  vehicleUpdatedAt: z.string(),
});
export const representativeResultSchema = z.object({
  thumbnailImageId: z.string(),
  thumbnailUrl: z.string(),
  imageRevision: z.number().int().nonnegative(),
  vehicleUpdatedAt: z.string(),
});
export const purgeResultSchema = z.object({
  storageCleanup: z.enum(["deleted", "deferred"]),
  imageRevision: z.number().int().nonnegative(),
  vehicleUpdatedAt: z.string(),
});

export type ImageMutationResult = z.infer<typeof imageMutationResultSchema>;

const errorSchema = z.object({
  error: z.string().optional(),
  code: z.string().optional(),
});

export type ApiResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly status: number; readonly code: string; readonly message: string };

export async function readApiResult<T>(response: Response, schema: z.ZodType<T, z.ZodTypeDef, unknown>): Promise<ApiResult<T>> {
  const text = await response.text();
  let body: unknown = {};
  if (text !== "") {
    try {
      body = JSON.parse(text);
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      return { ok: false, status: response.status, code: "INVALID_RESPONSE", message: "서버 응답을 확인할 수 없습니다." };
    }
  }
  if (!response.ok) {
    const parsed = errorSchema.safeParse(body);
    const code = parsed.success ? (parsed.data.code ?? "REQUEST_FAILED") : "REQUEST_FAILED";
    const rawError = parsed.success ? parsed.data.error : undefined;
    const message = knownErrorMessage(code)
      ?? (rawError ? knownErrorMessage(rawError) : null)
      ?? rawError
      ?? errorMessage(code, response.status);
    return { ok: false, status: response.status, code, message };
  }
  const envelope = z.object({ success: z.literal(true), data: z.unknown().optional() }).safeParse(body);
  if (!envelope.success) {
    return { ok: false, status: 500, code: "INVALID_RESPONSE", message: "서버 응답을 확인할 수 없습니다." };
  }
  const parsed = schema.safeParse(envelope.data.data);
  if (!parsed.success) {
    return { ok: false, status: 500, code: "INVALID_RESPONSE", message: "서버 응답 형식이 올바르지 않습니다." };
  }
  return { ok: true, data: parsed.data };
}

export function errorMessage(code: string, status: number): string {
  return knownErrorMessage(code) ?? (status === 500 ? "이미지 처리 중 서버 오류가 발생했습니다." : "이미지 요청을 처리하지 못했습니다.");
}

export function knownErrorMessage(code: string): string | null {
  const messages: Readonly<Record<string, string>> = {
    STALE_IMAGE_STATE: "다른 관리자가 이미지를 변경했습니다.",
    STALE_IMAGE_REVISION: "다른 관리자가 이미지 구성을 변경했습니다.",
    STALE_VEHICLE_STATE: "다른 관리자가 대표 이미지를 변경했습니다.",
    IMAGE_GROUP_SET_MISMATCH: "이미지 구성이 바뀌어 정렬을 저장하지 못했습니다.",
    CONCURRENT_IMAGE_MUTATION: "동시에 처리된 변경이 있어 다시 불러와야 합니다.",
    REPRESENTATIVE_IMAGE_MUTATION_FORBIDDEN: "대표 이미지는 숨기거나 삭제할 수 없습니다.",
    REPRESENTATIVE_MIGRATION_REQUIRED: "대표 이미지 연결 작업이 먼저 필요합니다.",
    UNSUPPORTED_MIME: `${VEHICLE_IMAGE_UPLOAD_FORMATS} 이미지 파일만 업로드할 수 있습니다.`,
  };
  return messages[code] ?? null;
}

export function imageTitle(image: AdminVehicleImage): string {
  return image.title?.trim() || IMAGE_TYPE_LABELS[image.type];
}

export function belongsToGroup(image: AdminVehicleImage, group: VehicleImageGroup): boolean {
  return IMAGE_GROUP_TYPES[group].some((type) => type === image.type);
}
