import { notFound } from "next/navigation";
import { getVehicleById } from "@/lib/admin-queries";
import { VehicleEditor } from "@/components/admin/vehicles/edit/VehicleEditor";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function VehicleEditPage({ params }: Props) {
  const { id } = await params;
  const vehicle = await getVehicleById(id);

  if (!vehicle) {
    notFound();
  }

  return <VehicleEditor vehicle={vehicle} />;
}
