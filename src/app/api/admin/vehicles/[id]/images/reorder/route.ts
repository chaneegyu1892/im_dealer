import { NextResponse, type NextRequest } from "next/server";
import { logAdminAction } from "@/lib/audit";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { revalidatePublicVehicleSurfaces } from "@/lib/revalidate";
import { vehicleImageReorderSchema } from "@/lib/validations/admin-vehicle-images";
import { reorderVehicleImages } from "@/lib/vehicle-images/ordering";
import { imageResponse, imageRouteError, invalidInput, readJsonBody } from "../http";

type Params = { readonly params: Promise<{ readonly id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { admin, error } = await requireRoleAtLeast("staff");
  if (error) return error;
  try {
    const { id } = await params;
    const body = await readJsonBody(request);
    if (!body.ok) return body.response;
    const parsed = vehicleImageReorderSchema.safeParse(body.value);
    if (!parsed.success) return invalidInput(parsed.error.flatten());
    const result = await reorderVehicleImages(id, parsed.data);
    const before = result.before.map(imageResponse);
    const images = result.images.map(imageResponse);
    await logAdminAction({ request, actor: admin, action: "VEHICLE_IMAGE_REORDER", resource: "VehicleImage", targetId: id, before, after: images, meta: { group: parsed.data.group } });
    revalidatePublicVehicleSurfaces();
    return NextResponse.json({
      success: true,
      data: {
        images,
        imageRevision: result.imageRevision,
        vehicleUpdatedAt: result.vehicleUpdatedAt.toISOString(),
      },
    });
  } catch (error) { // no-excuse-ok: catch -- HTTP boundary maps typed service failures.
    return imageRouteError(error);
  }
}
