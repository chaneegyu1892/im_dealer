import { NextResponse, type NextRequest } from "next/server";
import { logAdminAction } from "@/lib/audit";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { revalidatePublicVehicleSurfaces } from "@/lib/revalidate";
import { vehicleImageDeleteSchema, vehicleImageEditSchema } from "@/lib/validations/admin-vehicle-images";
import { editVehicleImage, trashVehicleImage } from "@/lib/vehicle-images/item-mutations";
import { imageResponse, imageRouteError, invalidInput, readJsonBody } from "../http";

type Params = { readonly params: Promise<{ readonly id: string; readonly imageId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { admin, error } = await requireRoleAtLeast("staff");
  if (error) return error;
  try {
    const route = await params;
    const body = await readJsonBody(request);
    if (!body.ok) return body.response;
    const parsed = vehicleImageEditSchema.safeParse(body.value);
    if (!parsed.success) return invalidInput(parsed.error.flatten());
    const result = await editVehicleImage(route.id, route.imageId, parsed.data);
    const before = imageResponse(result.before);
    const image = imageResponse(result.image);
    await logAdminAction({ request, actor: admin, action: "VEHICLE_IMAGE_UPDATE", resource: "VehicleImage", targetId: route.imageId, before, after: image });
    revalidatePublicVehicleSurfaces();
    return NextResponse.json({
      success: true,
      data: { image, imageRevision: result.imageRevision, vehicleUpdatedAt: result.vehicleUpdatedAt.toISOString() },
    });
  } catch (error) { // no-excuse-ok: catch -- HTTP boundary maps typed service failures.
    return imageRouteError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { admin, error } = await requireRoleAtLeast("staff");
  if (error) return error;
  try {
    const route = await params;
    const body = await readJsonBody(request);
    if (!body.ok) return body.response;
    const parsed = vehicleImageDeleteSchema.safeParse(body.value);
    if (!parsed.success) return invalidInput(parsed.error.flatten());
    const result = await trashVehicleImage(route.id, route.imageId, parsed.data);
    const before = imageResponse(result.before);
    const image = imageResponse(result.image);
    await logAdminAction({ request, actor: admin, action: "VEHICLE_IMAGE_DELETE", resource: "VehicleImage", targetId: route.imageId, before, after: image });
    revalidatePublicVehicleSurfaces();
    return NextResponse.json({
      success: true,
      data: { image, imageRevision: result.imageRevision, vehicleUpdatedAt: result.vehicleUpdatedAt.toISOString() },
    });
  } catch (error) { // no-excuse-ok: catch -- HTTP boundary maps typed service failures.
    return imageRouteError(error);
  }
}
