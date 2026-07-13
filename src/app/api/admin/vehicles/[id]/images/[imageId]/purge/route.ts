import { NextResponse, type NextRequest } from "next/server";
import { logAdminAction } from "@/lib/audit";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { revalidatePublicVehicleSurfaces } from "@/lib/revalidate";
import { vehicleImagePurgeSchema } from "@/lib/validations/admin-vehicle-images";
import { purgeVehicleImage } from "@/lib/vehicle-images/storage-cleanup";
import { imageResponse, imageRouteError, invalidInput, readJsonBody } from "../../http";

type Params = { readonly params: Promise<{ readonly id: string; readonly imageId: string }> };

export async function DELETE(request: NextRequest, { params }: Params) {
  const { admin, error } = await requireRoleAtLeast("admin");
  if (error) return error;
  try {
    const route = await params;
    const body = await readJsonBody(request);
    if (!body.ok) return body.response;
    const parsed = vehicleImagePurgeSchema.safeParse(body.value);
    if (!parsed.success) return invalidInput(parsed.error.flatten());
    const result = await purgeVehicleImage(route.id, route.imageId, parsed.data);
    await logAdminAction({ request, actor: admin, action: "VEHICLE_IMAGE_PURGE", resource: "VehicleImage", targetId: route.imageId, before: imageResponse(result.before), meta: { storageCleanup: result.storageCleanup } });
    revalidatePublicVehicleSurfaces();
    return NextResponse.json({
      success: true,
      data: {
        storageCleanup: result.storageCleanup,
        imageRevision: result.imageRevision,
        vehicleUpdatedAt: result.vehicleUpdatedAt.toISOString(),
      },
    });
  } catch (error) { // no-excuse-ok: catch -- HTTP boundary maps typed service failures.
    return imageRouteError(error);
  }
}
