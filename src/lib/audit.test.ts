import { describe, expect, it } from "vitest";
import { VEHICLE_IMAGE_AUDIT_ACTIONS } from "./audit";

describe("vehicle image audit actions", () => {
  it("publishes the eight exact mutation actions", () => {
    expect(VEHICLE_IMAGE_AUDIT_ACTIONS).toEqual([
      "VEHICLE_IMAGE_CREATE",
      "VEHICLE_IMAGE_UPDATE",
      "VEHICLE_IMAGE_VISIBILITY",
      "VEHICLE_IMAGE_REORDER",
      "VEHICLE_IMAGE_SET_REPRESENTATIVE",
      "VEHICLE_IMAGE_DELETE",
      "VEHICLE_IMAGE_RESTORE",
      "VEHICLE_IMAGE_PURGE",
    ]);
  });
});
