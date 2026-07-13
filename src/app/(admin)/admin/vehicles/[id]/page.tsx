import { notFound } from "next/navigation";
import { getVehicleById } from "@/lib/admin-queries";
import { VehicleEditor } from "@/components/admin/vehicles/edit/VehicleEditor";
import { isAtLeast } from "@/lib/access-control";
import { requireAccess } from "@/lib/require-access";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function VehicleEditPage({ params }: Props) {
  const { id } = await params;
  const [{ role }, vehicle] = await Promise.all([
    requireAccess(`/admin/vehicles/${id}`),
    getVehicleById(id),
  ]);

  if (!vehicle) {
    notFound();
  }

  return <VehicleEditor vehicle={vehicle} canPurgeImages={isAtLeast(role, "admin")} />;
}
