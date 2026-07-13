import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminVehicleDetail } from "@/types/admin";
import VehicleEditPage from "./page";

const mocks = vi.hoisted(() => ({
  getVehicleById: vi.fn(),
  requireAccess: vi.fn(),
}));

vi.mock("@/lib/admin-queries", () => ({ getVehicleById: mocks.getVehicleById }));
vi.mock("@/lib/require-access", () => ({ requireAccess: mocks.requireAccess }));
vi.mock("next/navigation", () => ({ notFound: vi.fn() }));

const vehicle = {
  id: "vehicle-1", slug: "sorento", name: "쏘렌토", brand: "기아", category: "SUV",
  vehicleCode: "MQ4", basePrice: 40_000_000, thumbnailUrl: "", imageUrls: [], surchargeRate: 0,
  isVisible: true, isPopular: false, isSpotlight: false, slidingDoorOverride: null,
  advancedSafetyOverride: null, displayOrder: 0, tags: [], description: null,
  createdAt: "2026-07-12T00:00:00.000Z", updatedAt: "2026-07-12T00:00:00.000Z",
  thumbnailImageId: null, imageRevision: 0, images: [], trims: [], lineups: [], colors: [],
} satisfies AdminVehicleDetail;

describe("VehicleEditPage purge capability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getVehicleById.mockResolvedValue(vehicle);
  });

  it.each([
    ["staff", false],
    ["admin", true],
    ["superadmin", true],
  ] as const)("derives canPurgeImages=false/true from trusted %s role", async (role, expected) => {
    mocks.requireAccess.mockResolvedValue({ role, admin: { role }, userId: "admin-1" });

    const element = await VehicleEditPage({ params: Promise.resolve({ id: vehicle.id }) });

    expect(mocks.requireAccess).toHaveBeenCalledWith(`/admin/vehicles/${vehicle.id}`);
    expect(element.props.canPurgeImages).toBe(expected);
  });
});
