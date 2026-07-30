import { describe, expect, it } from "vitest";
import { residentRegistrationBirthDate } from "./resident-registration";

describe("residentRegistrationBirthDate", () => {
  it("derives the birth date from only the first six and one back-half digits", () => {
    expect(residentRegistrationBirthDate("900101", "1")).toBe("19900101");
    expect(residentRegistrationBirthDate("050101", "3")).toBe("20050101");
  });

  it("refuses a full back-half value so callers cannot reintroduce unnecessary collection", () => {
    expect(residentRegistrationBirthDate("900101", "1234567")).toBe("");
  });
});
