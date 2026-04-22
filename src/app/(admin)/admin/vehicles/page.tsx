
import { getAdminVehicles, getAdminBrands } from "@/lib/admin-queries";
import { VehicleManager } from "@/components/admin/vehicles/VehicleManager";

export default async function AdminVehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ selected?: string }>;
}) {
  const [vehicles, brands, { selected }] = await Promise.all([
    getAdminVehicles(),
    getAdminBrands(),
    searchParams,
  ]);

  return (
    <VehicleManager
      initialVehicles={vehicles}
      initialBrands={brands}
      initialSelectedId={selected}
    />
  );
}
