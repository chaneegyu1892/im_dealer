import { NextResponse, type NextRequest } from "next/server";
import { logAdminAction } from "@/lib/audit";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { revalidatePublicVehicleSurfaces } from "@/lib/revalidate";
import { vehicleImageCreateSchema } from "@/lib/validations/admin-vehicle-images";
import { listVehicleImages } from "@/lib/vehicle-images/item-mutations";
import { uploadVehicleImage } from "@/lib/vehicle-images/upload";
import { imageResponse, imageRouteError, invalidInput, readMultipartBody } from "./http";

type Params = { readonly params: Promise<{ readonly id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { error } = await requireRoleAtLeast("staff");
  if (error) return error;
  try {
    const { id } = await params;
    return NextResponse.json({ success: true, data: await listVehicleImages(id) });
  } catch (error) { // no-excuse-ok: catch -- HTTP boundary maps typed service failures.
    return imageRouteError(error);
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const { admin, error } = await requireRoleAtLeast("staff");
  if (error) return error;
  try {
    const { id } = await params;
    const body = await readMultipartBody(request);
    if (!body.ok) return body.response;
    const form = body.value;
    const keys = [...form.keys()];
    if (new Set(keys).size !== keys.length) return invalidInput({ form: ["중복된 필드가 있습니다."] });
    const parsed = vehicleImageCreateSchema.safeParse(Object.fromEntries(form.entries()));
    if (!parsed.success) return invalidInput(parsed.error.flatten());
    const result = await uploadVehicleImage(id, parsed.data);
    const image = imageResponse(result.image);
    await logAdminAction({
      request,
      actor: admin,
      action: "VEHICLE_IMAGE_CREATE",
      resource: "VehicleImage",
      targetId: result.image.id,
      after: image,
    });
    revalidatePublicVehicleSurfaces();
    return NextResponse.json({
      success: true,
      data: {
        image,
        imageRevision: result.imageRevision,
        vehicleUpdatedAt: result.vehicleUpdatedAt.toISOString(),
      },
    }, { status: 201 });
  } catch (error) { // no-excuse-ok: catch -- HTTP boundary maps typed service failures.
    return imageRouteError(error);
  }
}
