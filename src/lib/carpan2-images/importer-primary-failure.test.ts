import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { applyCarpan2ImagePlans } from "./importer";
import type { Carpan2ImagePersistence } from "./persistence";
import type { Carpan2ImageCandidate } from "./types";
import { mirrorImage, type MirrorContext } from "../vehicle-image-mirror";

const storageCleanupMocks = vi.hoisted(() => ({
  enqueueStorageCleanup: vi.fn().mockResolvedValue(true),
}));

vi.mock("../vehicle-images/storage-cleanup", () => ({
  enqueueStorageCleanup: storageCleanupMocks.enqueueStorageCleanup,
}));

const dbVehicle = { id: "vehicle-1", externalId: "model-1", brand: "기아", name: "쏘렌토" };
const ctx: MirrorContext = { cache: new Map<string, string>(), timeoutMs: 1, supabase: createClient("http://127.0.0.1:54321", "fake-key") };

function candidate(type: Carpan2ImageCandidate["type"]): Carpan2ImageCandidate {
  return {
    vehicleExternalId: "model-1", type, title: type,
    sourceUrl: `https://carpan.example/${type}.webp`, sourceKey: `${type}:${type.toLowerCase()}`,
    displayOrder: type === "MAIN" ? 0 : 1, metadata: { sourceField: type.toLowerCase() },
  };
}

async function apply(
  persistence: Carpan2ImagePersistence,
  candidates: readonly Carpan2ImageCandidate[],
  mirror?: typeof mirrorImage,
) {
  const prisma = new PrismaClient();
  try {
    const mirrorCandidate = mirror ?? (async (sourceUrl: string | null | undefined) => ({
      url: (sourceUrl ?? "").replace("carpan", "storage"),
      uploaded: true,
    }));
    return await applyCarpan2ImagePlans({
      prisma,
      ctx,
      persistence,
      mirror: mirrorCandidate,
      createListThumbnail: async ({ storageUrl, reserveBeforeUpload }) => {
        await reserveBeforeUpload("list-thumbnails/v1/test.webp");
        return {
          url: storageUrl.replace("/storage", "/storage/list"),
          storagePath: "list-thumbnails/v1/test.webp",
        };
      },
      listThumbnailCleanup: {
        reserve: async (storagePath) => ({ storagePath, token: "reservation-token" }),
        rollback: vi.fn(),
      },
      plans: [{ dbVehicle, candidates }],
    });
  } finally {
    await prisma.$disconnect();
  }
}

describe("Carpan2 primary candidate failures", () => {
  it("allows finalization after a non-primary candidate failure", async () => {
    const finalize = vi.fn<Carpan2ImagePersistence["finalizeVehicleRepresentative"]>().mockResolvedValue("missing");
    const persistence: Carpan2ImagePersistence = {
      findExisting: async () => null,
      applyMirroredCandidate: async () => "upserted",
      finalizeVehicleRepresentative: finalize,
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = await apply(persistence, [candidate("SPEC_OPTION")], async () => { throw new TypeError("Invalid URL"); });

    expect(result.failed).toBe(1);
    expect(finalize).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("defers partial PRIMARY finalization and converges to COVER on the next clean run", async () => {
    const stored = new Map<string, Carpan2ImageCandidate>();
    let representative: string | null = null;
    const finalize = vi.fn(async () => {
      representative = stored.has("COVER:cover") ? "COVER" : "MAIN";
      return "selected" as const;
    });
    const persistence: Carpan2ImagePersistence = {
      findExisting: async (_vehicleId, sourceKey) => {
        const existing = stored.get(sourceKey);
        return existing ? {
          id: `image-${sourceKey}`,
          origin: "CARPAN2",
          sourceUrl: existing.sourceUrl,
          storageUrl: existing.sourceUrl.replace("carpan", "storage"),
          listThumbnailUrl: existing.sourceUrl.replace("carpan", "storage/list"),
          listThumbnailStoragePath: "list-thumbnails/v1/test.webp",
        } : null;
      },
      applyMirroredCandidate: async ({ candidate: item }) => { stored.set(item.sourceKey, item); return "upserted"; },
      finalizeVehicleRepresentative: finalize,
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const first = await apply(persistence, [candidate("MAIN"), candidate("COVER")], async (sourceUrl) => {
      if (sourceUrl?.includes("COVER")) throw new TypeError("transient COVER failure");
      return { url: (sourceUrl ?? "").replace("carpan", "storage"), uploaded: true };
    });
    expect(first.failed).toBe(1);
    expect(finalize).not.toHaveBeenCalled();
    expect(representative).toBeNull();

    const second = await apply(persistence, [candidate("MAIN"), candidate("COVER")]);
    expect(second.failed).toBe(0);
    expect(finalize).toHaveBeenCalledOnce();
    expect(representative).toBe("COVER");
    warn.mockRestore();
  });

  it("does not touch an existing ADMIN representative after a PRIMARY failure", async () => {
    let representative = "ADMIN";
    const finalize = vi.fn(async () => { representative = "MAIN"; return "selected" as const; });
    const persistence: Carpan2ImagePersistence = {
      findExisting: async () => null,
      applyMirroredCandidate: async () => "upserted",
      finalizeVehicleRepresentative: finalize,
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await apply(persistence, [candidate("MAIN")], async () => { throw new TypeError("primary failure"); });

    expect(representative).toBe("ADMIN");
    expect(finalize).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
