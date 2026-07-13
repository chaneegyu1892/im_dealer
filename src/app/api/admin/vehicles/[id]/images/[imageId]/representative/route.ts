import { NextResponse, type NextRequest } from "next/server";
import { logAdminAction } from "@/lib/audit";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { revalidatePublicVehicleSurfaces } from "@/lib/revalidate";
import { vehicleImageRepresentativeSchema } from "@/lib/validations/admin-vehicle-images";
import { setVehicleRepresentative } from "@/lib/vehicle-images/representative";
import { imageRouteError, invalidInput, readJsonBody } from "../../http";

type Params = { readonly params: Promise<{ readonly id: string; readonly imageId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { admin, error } = await requireRoleAtLeast("staff");
  if (error) return error;
  try {
    const route = await params;
    const body = await readJsonBody(request);
    if (!body.ok) return body.response;
    const parsed = vehicleImageRepresentativeSchema.safeParse(body.value);
    if (!parsed.success) return invalidInput(parsed.error.flatten());
    const result = await setVehicleRepresentative(route.id, route.imageId, parsed.data);
    const after = { thumbnailImageId: result.vehicle.thumbnailImageId, thumbnailUrl: result.vehicle.thumbnailUrl, updatedAt: result.vehicle.updatedAt };
    await logAdminAction({ request, actor: admin, action: "VEHICLE_IMAGE_SET_REPRESENTATIVE", resource: "Vehicle", targetId: route.id, before: result.before, after });
    revalidatePublicVehicleSurfaces();
    return NextResponse.json({
      success: true,
      data: {
        thumbnailImageId: after.thumbnailImageId,
        thumbnailUrl: after.thumbnailUrl,
        imageRevision: result.vehicle.imageRevision,
        vehicleUpdatedAt: result.vehicle.updatedAt.toISOString(),
      },
    });
  } catch (error) { // no-excuse-ok: catch -- HTTP boundary maps typed service failures.
    return imageRouteError(error);
  }
}
