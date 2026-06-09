import { describe, expect, it } from "vitest";
import { hasAccess } from "./access-control";

describe("admin page access policy", () => {
  it("blocks dealers from the customer quotation admin page", () => {
    expect(hasAccess("dealer", "/admin/quotations")).toBe(false);
    expect(hasAccess("staff", "/admin/quotations")).toBe(true);
    expect(hasAccess("admin", "/admin/quotations")).toBe(true);
    expect(hasAccess("superadmin", "/admin/quotations")).toBe(true);
  });
});
