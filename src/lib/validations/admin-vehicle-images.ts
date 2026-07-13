import { z } from "zod";
import { IMAGE_GROUP_NAMES, VEHICLE_IMAGE_TYPES } from "@/lib/vehicle-images/groups";

const expectedUpdatedAtSchema = z.string().datetime({ offset: true });
const expectedImageRevisionSchema = z.number().int().nonnegative();
const titleSchema = z.string().trim().min(1).max(120);

function isMultipartFile(value: unknown): value is File {
  return typeof value === "object"
    && value !== null
    && "name" in value
    && typeof value.name === "string"
    && "size" in value
    && typeof value.size === "number"
    && "type" in value
    && typeof value.type === "string"
    && "slice" in value
    && typeof value.slice === "function";
}

export const vehicleImageCreateSchema = z.object({
  file: z.custom<File>(isMultipartFile),
  title: titleSchema,
  type: z.enum(VEHICLE_IMAGE_TYPES),
  isVisible: z.enum(["true", "false"]).transform((value) => value === "true"),
}).strict();

export const vehicleImageEditSchema = z.object({
  expectedUpdatedAt: expectedUpdatedAtSchema,
  expectedImageRevision: expectedImageRevisionSchema,
  title: titleSchema.optional(),
  type: z.enum(VEHICLE_IMAGE_TYPES).optional(),
}).strict().refine((value) => value.title !== undefined || value.type !== undefined, {
  message: "수정할 이미지 항목이 없습니다.",
});

export const vehicleImageVisibilitySchema = z.object({
  expectedUpdatedAt: expectedUpdatedAtSchema,
  expectedImageRevision: expectedImageRevisionSchema,
  isVisible: z.boolean(),
}).strict();

const versionOnlySchema = z.object({
  expectedUpdatedAt: expectedUpdatedAtSchema,
  expectedImageRevision: expectedImageRevisionSchema,
}).strict();

export const vehicleImageDeleteSchema = versionOnlySchema;
export const vehicleImageRestoreSchema = versionOnlySchema;
export const vehicleImagePurgeSchema = versionOnlySchema;

export const vehicleImageRepresentativeSchema = z.object({
  expectedImageUpdatedAt: expectedUpdatedAtSchema,
  expectedImageRevision: expectedImageRevisionSchema,
  expectedVehicleUpdatedAt: expectedUpdatedAtSchema,
}).strict();

const vehicleImageReorderItemSchema = z.object({
  id: z.string().trim().min(1),
  expectedUpdatedAt: expectedUpdatedAtSchema,
}).strict();

export const vehicleImageReorderSchema = z.object({
  group: z.enum(IMAGE_GROUP_NAMES),
  expectedImageRevision: expectedImageRevisionSchema,
  items: z.array(vehicleImageReorderItemSchema),
}).strict().superRefine((value, context) => {
  const ids = value.items.map((item) => item.id);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["items"],
      message: "중복된 이미지 ID가 있습니다.",
    });
  }
});

export type VehicleImageCreateInput = z.infer<typeof vehicleImageCreateSchema>;
export type VehicleImageEditInput = z.infer<typeof vehicleImageEditSchema>;
export type VehicleImageVisibilityInput = z.infer<typeof vehicleImageVisibilitySchema>;
export type VehicleImageVersionInput = z.infer<typeof versionOnlySchema>;
export type VehicleImageRepresentativeInput = z.infer<typeof vehicleImageRepresentativeSchema>;
export type VehicleImageReorderInput = z.infer<typeof vehicleImageReorderSchema>;
