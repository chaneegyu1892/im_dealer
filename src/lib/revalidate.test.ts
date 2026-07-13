import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ revalidatePath: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { revalidatePublicVehicleSurfaces } from "./revalidate";

describe("revalidatePublicVehicleSurfaces", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invalidates the home, cars index, and vehicle detail pages", () => {
    revalidatePublicVehicleSurfaces();

    expect(mocks.revalidatePath.mock.calls).toEqual([
      ["/"],
      ["/cars"],
      ["/cars/[slug]", "page"],
    ]);
  });
});
