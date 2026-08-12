import { describe, expect, it } from "vitest";
import { canReviewVerifications } from "./admin-roles";

describe("canReviewVerifications", () => {
  it.each(["staff", "admin", "superadmin"])(
    "allows %s to review verification details and documents",
    (role) => {
      expect(canReviewVerifications(role)).toBe(true);
    }
  );

  it.each(["dealer", "member", null, undefined])(
    "blocks lower or missing role %s",
    (role) => {
      expect(canReviewVerifications(role)).toBe(false);
    }
  );
});
