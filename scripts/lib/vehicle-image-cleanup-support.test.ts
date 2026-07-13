import { describe, expect, it } from "vitest";
import { vehicleImageAuditWhere } from "../../e2e/fixtures/vehicle-image-cleanup-support";

describe("vehicle image E2E audit ownership", () => {
  it("scopes cleanup to the parent actor and owned image targets", () => {
    expect(vehicleImageAuditWhere({
      auditActorId: "parent-admin",
      auditTargetIds: ["forced-upload"],
    })).toEqual({
      actorId: "parent-admin",
      action: { startsWith: "VEHICLE_IMAGE_" },
      resource: "VehicleImage",
      targetId: { in: ["forced-upload"] },
    });
  });

  it("can identify only the actual upload action", () => {
    expect(vehicleImageAuditWhere({
      auditActorId: "parent-admin",
      auditTargetIds: ["forced-upload"],
    }, "VEHICLE_IMAGE_CREATE")).toMatchObject({
      actorId: "parent-admin",
      action: "VEHICLE_IMAGE_CREATE",
      resource: "VehicleImage",
      targetId: { in: ["forced-upload"] },
    });
  });
});
