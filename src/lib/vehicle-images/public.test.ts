import { describe, expect, it } from "vitest";
import { resolvePublicThumbnailUrl } from "./public";

const managedHistory = { images: 1 } as const;
const noManagedHistory = { images: 0 } as const;

const primary = (overrides: {
  readonly type?: "MAIN" | "COVER";
  readonly sourceUrl?: string | null;
  readonly storageUrl?: string;
  readonly isVisible?: boolean;
  readonly deletedAt?: Date | null;
} = {}) => ({
  type: "COVER" as const,
  sourceUrl: "https://source.example/cover.webp",
  storageUrl: "https://cdn.example/cover.webp",
  isVisible: true,
  deletedAt: null,
  ...overrides,
});

function vehicle(overrides: Partial<Parameters<typeof resolvePublicThumbnailUrl>[0]> = {}) {
  return {
    id: "vehicle-1",
    thumbnailUrl: "https://cdn.example/cover.webp",
    thumbnailImageId: "image-cover",
    thumbnailImage: {
      vehicleId: "vehicle-1",
      isVisible: true,
      deletedAt: null,
      storageUrl: "https://cdn.example/cover.webp",
    },
    images: [primary()],
    _count: managedHistory,
    ...overrides,
  };
}

describe("resolvePublicThumbnailUrl", () => {
  it("returns the persisted URL when the linked representative is active and matches", () => {
    expect(resolvePublicThumbnailUrl(vehicle())).toBe("https://cdn.example/cover.webp");
  });

  it.each([
    ["hidden", { thumbnailImage: { vehicleId: "vehicle-1", isVisible: false, deletedAt: null, storageUrl: "https://cdn.example/cover.webp" } }],
    ["deleted", { thumbnailImage: { vehicleId: "vehicle-1", isVisible: true, deletedAt: new Date("2026-07-13"), storageUrl: "https://cdn.example/cover.webp" } }],
    ["stale URL", { thumbnailImage: { vehicleId: "vehicle-1", isVisible: true, deletedAt: null, storageUrl: "https://cdn.example/new-cover.webp" } }],
    ["missing relation", { thumbnailImage: null }],
  ] as const)("returns an empty projection for a %s linked representative", (_label, overrides) => {
    expect(resolvePublicThumbnailUrl(vehicle(overrides))).toBe("");
  });

  it("rejects a linked representative owned by another vehicle", () => {
    expect(resolvePublicThumbnailUrl(vehicle({
      thumbnailImage: {
        vehicleId: "vehicle-2",
        isVisible: true,
        deletedAt: null,
        storageUrl: "https://cdn.example/cover.webp",
      },
    }))).toBe("");
  });

  it("preserves a nonblank URL for a truly unmigrated vehicle", () => {
    expect(resolvePublicThumbnailUrl(vehicle({
      thumbnailImageId: null,
      thumbnailImage: null,
      images: [],
      _count: noManagedHistory,
      thumbnailUrl: "  /legacy-cover.webp  ",
    }))).toBe("/legacy-cover.webp");
  });

  it.each([
    ["mirrored storage URL", "https://cdn.example/cover.webp"],
    ["original source URL", "https://source.example/cover.webp"],
  ] as const)("preserves an unlinked %s when an exact managed row is active", (_label, thumbnailUrl) => {
    expect(resolvePublicThumbnailUrl(vehicle({
      thumbnailImageId: null,
      thumbnailImage: null,
      thumbnailUrl,
      images: [primary()],
    }))).toBe(thumbnailUrl);
  });

  it.each([
    ["hidden", primary({ isVisible: false })],
    ["deleted", primary({ deletedAt: new Date("2026-07-13") })],
  ] as const)("rejects an unlinked exact managed URL when every match is %s", (_label, image) => {
    expect(resolvePublicThumbnailUrl(vehicle({
      thumbnailImageId: null,
      thumbnailImage: null,
      thumbnailUrl: image.sourceUrl ?? image.storageUrl,
      images: [image],
    }))).toBe("");
  });

  it("keeps an unlinked custom URL even when unrelated primary history exists", () => {
    expect(resolvePublicThumbnailUrl(vehicle({
      thumbnailImageId: null,
      thumbnailImage: null,
      thumbnailUrl: "https://custom.example/407-cover.webp",
      images: [primary(), primary({ isVisible: false, storageUrl: "/old.webp", sourceUrl: "/old-source.webp" })],
    }))).toBe("https://custom.example/407-cover.webp");
  });

  it("allows an exact URL when at least one matching managed row is active", () => {
    expect(resolvePublicThumbnailUrl(vehicle({
      thumbnailImageId: null,
      thumbnailImage: null,
      images: [primary({ isVisible: false }), primary({ type: "MAIN" })],
    }))).toBe("https://cdn.example/cover.webp");
  });

  it("rejects blank persisted URLs", () => {
    expect(resolvePublicThumbnailUrl(vehicle({ thumbnailUrl: "   " }))).toBe("");
  });
});
