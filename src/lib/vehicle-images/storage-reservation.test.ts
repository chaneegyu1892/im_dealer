import { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  VehicleImageStorageReservationError,
  markVehicleImageStorageReservationReady,
  releaseVehicleImageStorageReservation,
  reserveVehicleImageStorage,
} from "./storage-reservation";

describe("vehicle image storage reservation", () => {
  it("reserves a cleanup row before storage upload", async () => {
    const prisma = new PrismaClient();
    const query = vi.spyOn(prisma, "$queryRawUnsafe").mockResolvedValue([
      { id: "cleanup-1" },
    ]);

    const reservation = await reserveVehicleImageStorage(
      prisma,
      "list-thumbnails/v1/source.webp",
      new Date("2026-07-20T00:00:00.000Z"),
    );

    expect(reservation.storagePath).toBe("list-thumbnails/v1/source.webp");
    expect(reservation.token).not.toBe("");
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("ON CONFLICT"),
      expect.any(String),
      reservation.storagePath,
      reservation.token,
      new Date("2026-07-20T00:15:00.000Z"),
    );
    await prisma.$disconnect();
  });

  it("rejects an active reservation instead of stealing its cleanup ownership", async () => {
    const prisma = new PrismaClient();
    vi.spyOn(prisma, "$queryRawUnsafe").mockResolvedValue([]);

    await expect(
      reserveVehicleImageStorage(prisma, "list-thumbnails/v1/source.webp"),
    ).rejects.toEqual(
      new VehicleImageStorageReservationError("RESERVATION_CONFLICT"),
    );
    await prisma.$disconnect();
  });

  it("releases attached objects and readies failed objects with the same token", async () => {
    const prisma = new PrismaClient();
    const execute = vi.spyOn(prisma, "$executeRawUnsafe").mockResolvedValue(1);
    const reservation = {
      storagePath: "list-thumbnails/v1/source.webp",
      token: "reservation-token",
    };

    await releaseVehicleImageStorageReservation(prisma, reservation);
    await markVehicleImageStorageReservationReady(
      prisma,
      reservation,
      new Date("2026-07-20T00:01:00.000Z"),
    );

    expect(execute.mock.calls[0]?.[0]).toContain("DELETE FROM");
    expect(execute.mock.calls[1]?.[0]).toContain("\"status\" = 'READY'");
    expect(execute.mock.calls[1]?.slice(1)).toEqual([
      reservation.storagePath,
      reservation.token,
      new Date("2026-07-20T00:01:00.000Z"),
    ]);
    await prisma.$disconnect();
  });
});
