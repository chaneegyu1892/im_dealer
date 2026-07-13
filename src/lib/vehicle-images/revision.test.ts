import { describe, expect, it, vi } from "vitest";
import { advanceVehicleImageRevision } from "./revision";

describe("vehicle image revision", () => {
  it("atomically increments imageRevision without forging updatedAt", async () => {
    // Given
    const update = vi.fn().mockResolvedValue({
      id: "vehicle-1",
      imageRevision: 8,
      updatedAt: new Date("2026-07-13T00:00:01.000Z"),
    });

    // When
    const vehicle = await advanceVehicleImageRevision(
      { vehicle: { update } },
      { id: "vehicle-1" },
      { thumbnailImageId: "image-1", thumbnailUrl: "/image.webp" },
    );

    // Then
    expect(update).toHaveBeenCalledWith({
      where: { id: "vehicle-1" },
      data: {
        thumbnailImageId: "image-1",
        thumbnailUrl: "/image.webp",
        imageRevision: { increment: 1 },
      },
      select: {
        id: true,
        thumbnailImageId: true,
        thumbnailUrl: true,
        imageRevision: true,
        updatedAt: true,
      },
    });
    expect(vehicle.imageRevision).toBe(8);
    expect(vehicle.updatedAt.toISOString()).toBe("2026-07-13T00:00:01.000Z");
  });
});
