import { PrismaClient, type Vehicle, type VehicleImage } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enqueueStorageCleanup: vi.fn().mockResolvedValue(true),
  markVehicleImageStorageReservationReady: vi.fn().mockResolvedValue(undefined),
  releaseVehicleImageStorageReservation: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../vehicle-images/storage-cleanup", () => ({
  enqueueStorageCleanup: mocks.enqueueStorageCleanup,
}));

vi.mock("../vehicle-images/storage-reservation", () => ({
  markVehicleImageStorageReservationReady: mocks.markVehicleImageStorageReservationReady,
  releaseVehicleImageStorageReservation: mocks.releaseVehicleImageStorageReservation,
  reserveVehicleImageStorage: vi.fn(),
}));

import { applyCarpan2ImagePlans, Carpan2ImageImportError } from "./importer";
import {
  createCarpan2ImagePersistence,
  type Carpan2ImageLockRunner,
  type Carpan2ImagePersistence,
} from "./persistence";
import type { Carpan2ImageCandidate } from "./types";

const now = new Date("2026-07-13T00:00:00.000Z");
const dbVehicle = { id: "vehicle-1", externalId: "model-1", brand: "기아", name: "쏘렌토" };
const ctx = { cache: new Map<string, string>(), timeoutMs: 1, supabase: createClient("http://127.0.0.1:54321", "fake-key") };

const candidate = (type: Carpan2ImageCandidate["type"] = "COVER"): Carpan2ImageCandidate => ({
  vehicleExternalId: "model-1", type, title: `크롤러 ${type}`,
  sourceUrl: `https://carpan.example/new-${type}.webp`, sourceKey: `${type}:${type.toLowerCase()}`,
  displayOrder: type === "MAIN" ? 0 : 1, metadata: { sourceField: type.toLowerCase() },
});

const imageRow = (overrides: Partial<VehicleImage> = {}): VehicleImage => ({
  id: "image-cover", vehicleId: dbVehicle.id, type: "MAIN", origin: "CARPAN2",
  title: "관리자 제목", storageUrl: "https://storage.example/old.webp",
  sourceUrl: "https://carpan.example/old.webp", sourceKey: "COVER:cover",
  adminStoragePath: null, displayOrder: 17, isVisible: false, deletedAt: now,
  listThumbnailUrl: "https://storage.example/list/old.webp",
  listThumbnailStoragePath: "list-thumbnails/v1/old.webp",
  metadata: { editorial: true }, createdAt: now, updatedAt: now, ...overrides,
});

const vehicleRow = (overrides: Partial<Vehicle> = {}): Vehicle => ({
  id: dbVehicle.id, slug: "sorento", name: "쏘렌토", brand: "기아", category: "SUV",
  vehicleCode: null, externalId: "model-1", externalSource: "carpan2", basePrice: 40_000_000,
  thumbnailUrl: "https://storage.example/old.webp", imageUrls: [], thumbnailImageId: "image-cover",
  imageRevision: 0,
  surchargeRate: 0, isVisible: true, isPopular: false, isSpotlight: false,
  slidingDoorOverride: null, advancedSafetyOverride: null, displayOrder: 0, description: null,
  tags: [], detailedSpecs: null, scraperRefs: null, createdAt: now, updatedAt: now, ...overrides,
});

async function applyWith(persistence: Carpan2ImagePersistence, candidates: readonly Carpan2ImageCandidate[], mirror = vi.fn(async (sourceUrl: string | null | undefined) => ({ url: (sourceUrl ?? "").replace("carpan", "storage"), uploaded: true }))) {
  const prisma = new PrismaClient();
  const createListThumbnail = vi.fn(async ({
    storageUrl,
    reserveBeforeUpload,
  }: {
    readonly storageUrl: string;
    readonly reserveBeforeUpload: (storagePath: string) => Promise<void>;
  }) => {
    await reserveBeforeUpload("list-thumbnails/v1/new.webp");
    return {
      url: storageUrl.replace("/new-", "/list/new-"),
      storagePath: "list-thumbnails/v1/new.webp",
    };
  });
  const stats = await applyCarpan2ImagePlans({
    prisma,
    ctx,
    persistence,
    mirror,
    createListThumbnail,
    listThumbnailCleanup: {
      reserve: async (storagePath) => ({ storagePath, token: "reservation-token" }),
      rollback: vi.fn(),
    },
    concurrency: 2,
    plans: [{ dbVehicle, candidates }],
  });
  await prisma.$disconnect();
  return stats;
}

describe("Carpan2 image persistence", () => {
  it("source refresh가 asset 필드만 바꾸고 선택된 projection을 같은 lock 안에서 갱신한다", async () => {
    const prisma = new PrismaClient();
    vi.spyOn(prisma.vehicleImage, "findUnique").mockResolvedValue(imageRow());
    vi.spyOn(prisma.vehicle, "findUnique").mockResolvedValue(vehicleRow());
    const imageUpdate = vi.spyOn(prisma.vehicleImage, "update").mockResolvedValue(imageRow());
    const vehicleUpdate = vi.spyOn(prisma.vehicle, "update").mockResolvedValue(vehicleRow());
    const requests: Parameters<Carpan2ImageLockRunner>[0][] = [];
    const lock: Carpan2ImageLockRunner = async (request, mutation) => {
      requests.push(request);
      return mutation(prisma);
    };
    const persistence = createCarpan2ImagePersistence(prisma, lock);

    await applyWith(persistence, [candidate()]);

    expect(imageUpdate).toHaveBeenCalledWith({ where: { id: "image-cover" }, data: {
      sourceUrl: "https://carpan.example/new-COVER.webp",
      storageUrl: "https://storage.example/new-COVER.webp",
      listThumbnailUrl: "https://storage.example/list/new-COVER.webp",
      listThumbnailStoragePath: "list-thumbnails/v1/new.webp",
      metadata: { sourceField: "cover" },
    } });
    expect(mocks.enqueueStorageCleanup).toHaveBeenCalledOnce();
    expect(mocks.enqueueStorageCleanup.mock.calls[0]?.[1]).toBe(
      "list-thumbnails/v1/old.webp",
    );
    expect(mocks.enqueueStorageCleanup.mock.calls[0]?.[2]).toBe("IMAGE_PURGE");
    expect(vehicleUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: dbVehicle.id },
      data: {
        thumbnailUrl: "https://storage.example/new-COVER.webp",
        imageRevision: { increment: 1 },
      },
    }));
    expect(requests[0]?.requestedImageIds).toEqual(["image-cover"]);
    await prisma.$disconnect();
  });

  it("lock 획득 뒤 representative가 바뀌면 projection은 보존하고 image revision만 올린다", async () => {
    const prisma = new PrismaClient();
    vi.spyOn(prisma.vehicleImage, "findUnique").mockResolvedValue(imageRow());
    vi.spyOn(prisma.vehicle, "findUnique").mockResolvedValue(vehicleRow({ thumbnailImageId: "image-admin", thumbnailUrl: "/admin.webp" }));
    const imageUpdate = vi.spyOn(prisma.vehicleImage, "update").mockResolvedValue(imageRow());
    const vehicleUpdate = vi.spyOn(prisma.vehicle, "update").mockResolvedValue(vehicleRow());
    const lock: Carpan2ImageLockRunner = async (_request, mutation) => mutation(prisma);

    await applyWith(createCarpan2ImagePersistence(prisma, lock), [candidate()]);

    expect(imageUpdate).toHaveBeenCalledOnce();
    expect(vehicleUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: dbVehicle.id },
      data: { imageRevision: { increment: 1 } },
    }));
    await prisma.$disconnect();
  });

  it("ADMIN sourceKey 충돌은 mirror와 쓰기 없이 건너뛴다", async () => {
    const apply = vi.fn<Carpan2ImagePersistence["applyMirroredCandidate"]>();
    const finalize = vi.fn<Carpan2ImagePersistence["finalizeVehicleRepresentative"]>().mockResolvedValue("preserved");
    const mirror = vi.fn(async () => ({ url: "/never.webp", uploaded: true }));
    const persistence: Carpan2ImagePersistence = {
      findExisting: async () => ({
        id: "admin",
        origin: "ADMIN",
        sourceUrl: null,
        storageUrl: "/admin.webp",
        listThumbnailUrl: "/admin-list.webp",
        listThumbnailStoragePath: "list-thumbnails/v1/admin.webp",
      }),
      applyMirroredCandidate: apply,
      finalizeVehicleRepresentative: finalize,
    };

    const stats = await applyWith(persistence, [candidate()], mirror);

    expect(mirror).not.toHaveBeenCalled();
    expect(apply).not.toHaveBeenCalled();
    expect(stats.skippedExisting).toBe(1);
    expect(finalize).toHaveBeenCalledOnce();
  });

  it("new source row를 CARPAN2 origin으로 만들고 candidate upsert에서는 대표를 선택하지 않는다", async () => {
    const prisma = new PrismaClient();
    vi.spyOn(prisma.vehicleImage, "findUnique").mockResolvedValue(null);
    vi.spyOn(prisma.vehicle, "findUnique").mockResolvedValue(vehicleRow({ thumbnailImageId: null, thumbnailUrl: "/legacy.webp" }));
    const create = vi.spyOn(prisma.vehicleImage, "create").mockResolvedValue(imageRow({ id: "created-cover", type: "COVER" }));
    const updateVehicle = vi.spyOn(prisma.vehicle, "update").mockResolvedValue(vehicleRow());
    const lock: Carpan2ImageLockRunner = async (_request, mutation) => mutation(prisma);

    await applyWith(createCarpan2ImagePersistence(prisma, lock), [candidate()]);

    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ origin: "CARPAN2", sourceKey: "COVER:cover" }) });
    expect(updateVehicle).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: dbVehicle.id },
      data: { imageRevision: { increment: 1 } },
    }));
    await prisma.$disconnect();
  });

  it("파생 이미지 업로드 뒤 DB 저장이 실패하면 예약을 READY로 되돌린다", async () => {
    const prisma = new PrismaClient();
    const reservation = {
      storagePath: "list-thumbnails/v1/new.webp",
      token: "reservation-token",
    };
    const rollback = vi.fn().mockResolvedValue(undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const persistence: Carpan2ImagePersistence = {
      findExisting: async () => null,
      applyMirroredCandidate: async () => {
        throw new Error("database unavailable");
      },
      finalizeVehicleRepresentative: vi.fn().mockResolvedValue("missing"),
    };

    const stats = await applyCarpan2ImagePlans({
      prisma,
      ctx,
      persistence,
      mirror: async () => ({
        url: "https://storage.example/new-COVER.webp",
        uploaded: true,
      }),
      createListThumbnail: async ({ reserveBeforeUpload }) => {
        await reserveBeforeUpload(reservation.storagePath);
        return {
          url: "https://storage.example/list/new-COVER.webp",
          storagePath: reservation.storagePath,
        };
      },
      listThumbnailCleanup: {
        reserve: vi.fn().mockResolvedValue(reservation),
        rollback,
      },
      plans: [{ dbVehicle, candidates: [candidate()] }],
    });

    expect(stats.failed).toBe(1);
    expect(rollback).toHaveBeenCalledWith(reservation);
    warn.mockRestore();
    await prisma.$disconnect();
  });

  it.each(["MAIN_FIRST", "COVER_FIRST"] as const)("%s 완료 순서에서도 모든 upsert 뒤 한 번 finalize한다", async (schedule) => {
    const events: string[] = [];
    let releaseMain: (() => void) | null = null;
    const mainGate = new Promise<void>((resolve) => { releaseMain = resolve; });
    const persistence: Carpan2ImagePersistence = {
      findExisting: async () => null,
      applyMirroredCandidate: async ({ candidate: item }) => {
        events.push(item.type);
        if (schedule === "COVER_FIRST" && item.type === "COVER") releaseMain?.();
        return "upserted";
      },
      finalizeVehicleRepresentative: async () => { events.push("FINALIZE"); return "selected"; },
    };
    const mirror = vi.fn(async (sourceUrl: string | null | undefined) => {
      const url = sourceUrl ?? "";
      if (schedule === "COVER_FIRST" && url.includes("MAIN")) await mainGate;
      return { url: url.replace("carpan", "storage"), uploaded: true };
    });

    await applyWith(persistence, [candidate("MAIN"), candidate("COVER")], mirror);

    expect(events.at(-1)).toBe("FINALIZE");
    expect(events.filter((event) => event === "FINALIZE")).toHaveLength(1);
    expect(events.slice(0, 2).sort()).toEqual(["COVER", "MAIN"]);
  });

  it("한 finalizer가 먼저 실패해도 시작된 finalizer를 drain한 뒤 caller cleanup 전에 reject한다", async () => {
    const prisma = new PrismaClient();
    const failure = new Carpan2ImageImportError("vehicle-1 finalize failed");
    const secondFailure = new Carpan2ImageImportError("vehicle-3 finalize failed");
    let started = 0;
    let finishStarting = (): void => undefined;
    let finishDelayed = (): void => undefined;
    let disconnected = false;
    const allStarted = new Promise<void>((resolve) => { finishStarting = resolve; });
    const delayed = new Promise<void>((resolve) => { finishDelayed = resolve; });
    const persistence: Carpan2ImagePersistence = {
      findExisting: async () => null,
      applyMirroredCandidate: async () => "upserted",
      finalizeVehicleRepresentative: async (vehicleId) => {
        started += 1;
        if (started === 2) finishStarting();
        await allStarted;
        if (vehicleId === "vehicle-1") throw failure;
        if (vehicleId === "vehicle-3") throw secondFailure;
        await delayed;
        expect(disconnected).toBe(false);
        return "selected";
      },
    };
    const action = applyCarpan2ImagePlans({
      prisma, ctx, persistence, concurrency: 2,
      plans: [
        { dbVehicle, candidates: [] },
        { dbVehicle: { ...dbVehicle, id: "vehicle-2", externalId: "model-2" }, candidates: [] },
        { dbVehicle: { ...dbVehicle, id: "vehicle-3", externalId: "model-3" }, candidates: [] },
      ],
    }).finally(async () => {
      disconnected = true;
      await prisma.$disconnect();
    });
    const observed = action.then(
      () => ({ kind: "fulfilled" as const }),
      (error: unknown) => ({ kind: "rejected" as const, error }),
    );

    await allStarted;
    await new Promise<void>((resolve) => { setImmediate(resolve); });
    expect(disconnected).toBe(false);
    finishDelayed();
    const result = await observed;

    expect(result.kind).toBe("rejected");
    if (result.kind === "rejected") {
      expect(result.error).toMatchObject({
        name: "Carpan2ImageFinalizationError", cause: failure, failures: [failure, secondFailure],
      });
    }
    expect(disconnected).toBe(true);
  });
});

describe("finalizeVehicleRepresentative", () => {
  it("visible active mirrored CARPAN2 COVER를 MAIN보다 우선 선택한다", async () => {
    const prisma = new PrismaClient();
    vi.spyOn(prisma.vehicle, "findUnique").mockResolvedValue(vehicleRow({ thumbnailImageId: null, thumbnailUrl: "   " }));
    vi.spyOn(prisma.vehicleImage, "findMany").mockResolvedValue([
      imageRow({ id: "cover-hidden", type: "COVER", isVisible: false, deletedAt: null }),
      imageRow({ id: "cover-deleted", type: "COVER", isVisible: true, deletedAt: now }),
      imageRow({ id: "cover-admin", type: "COVER", origin: "ADMIN", isVisible: true, deletedAt: null }),
      imageRow({ id: "main-hidden", type: "MAIN", isVisible: false, deletedAt: null, storageUrl: "/hidden-main.webp" }),
      imageRow({ id: "main-ok", type: "MAIN", isVisible: true, deletedAt: null, storageUrl: "/main.webp" }),
      imageRow({ id: "cover-ok", type: "COVER", isVisible: true, deletedAt: null, storageUrl: "/cover.webp" }),
    ]);
    const update = vi.spyOn(prisma.vehicle, "update").mockResolvedValue(vehicleRow());
    const lock: Carpan2ImageLockRunner = async (_request, mutation) => mutation(prisma);

    const result = await createCarpan2ImagePersistence(prisma, lock).finalizeVehicleRepresentative(dbVehicle.id);

    expect(result).toBe("selected");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: dbVehicle.id },
      data: {
        thumbnailImageId: "cover-ok",
        thumbnailUrl: "/cover.webp",
        imageRevision: { increment: 1 },
      },
    }));
    await prisma.$disconnect();
  });

  it("non-empty unlinked legacy thumbnail은 후보를 읽거나 선택하지 않는다", async () => {
    const prisma = new PrismaClient();
    vi.spyOn(prisma.vehicle, "findUnique").mockResolvedValue(vehicleRow({ thumbnailImageId: null, thumbnailUrl: " /custom.webp " }));
    const findCandidates = vi.spyOn(prisma.vehicleImage, "findMany");
    const update = vi.spyOn(prisma.vehicle, "update");
    const lock: Carpan2ImageLockRunner = async (_request, mutation) => mutation(prisma);

    const result = await createCarpan2ImagePersistence(prisma, lock).finalizeVehicleRepresentative(dbVehicle.id);

    expect(result).toBe("preserved");
    expect(findCandidates).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    await prisma.$disconnect();
  });
});
