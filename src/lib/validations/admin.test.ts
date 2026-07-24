import { describe, it, expect } from "vitest";
import {
  inventoryCreateSchema,
  inventoryUpdateSchema,
  aiConfigMutationSchema,
  popularConfigCreateSchema,
  scraperCredentialUpsertSchema,
  scraperConfigSchema,
} from "./admin";
import { compileOverlapCatalog } from "@/lib/recommend/overlap-catalog";

describe("inventoryCreateSchema", () => {
  const valid = {
    vehicleSlug: "kia-ev9",
    trimName: "Earth",
    stockCount: 3,
    immediateDelivery: true,
  };

  it("accepts a valid payload", () => {
    expect(inventoryCreateSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects missing required fields", () => {
    expect(inventoryCreateSchema.safeParse({}).success).toBe(false);
    expect(
      inventoryCreateSchema.safeParse({ ...valid, vehicleSlug: "" }).success
    ).toBe(false);
  });

  it("rejects negative or oversized stockCount", () => {
    expect(
      inventoryCreateSchema.safeParse({ ...valid, stockCount: -1 }).success
    ).toBe(false);
    expect(
      inventoryCreateSchema.safeParse({ ...valid, stockCount: 100000 }).success
    ).toBe(false);
  });

  it("rejects non-integer stockCount", () => {
    expect(
      inventoryCreateSchema.safeParse({ ...valid, stockCount: 1.5 }).success
    ).toBe(false);
  });

  it("caps selectedOptions length", () => {
    const tooMany = Array.from({ length: 51 }, (_, i) => `opt-${i}`);
    expect(
      inventoryCreateSchema.safeParse({ ...valid, selectedOptions: tooMany })
        .success
    ).toBe(false);
  });

  it("defaults immediateDelivery to false and selectedOptions to []", () => {
    const parsed = inventoryCreateSchema.parse({
      vehicleSlug: "x",
      trimName: "y",
      stockCount: 0,
    });
    expect(parsed.immediateDelivery).toBe(false);
    expect(parsed.selectedOptions).toEqual([]);
  });
});

describe("inventoryUpdateSchema", () => {
  it("accepts empty object (all optional)", () => {
    expect(inventoryUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("accepts ISO datetime for expectedUpdatedAt", () => {
    expect(
      inventoryUpdateSchema.safeParse({
        expectedUpdatedAt: "2026-05-01T12:00:00.000Z",
      }).success
    ).toBe(true);
  });

  it("rejects non-ISO string for expectedUpdatedAt", () => {
    expect(
      inventoryUpdateSchema.safeParse({ expectedUpdatedAt: "yesterday" })
        .success
    ).toBe(false);
  });
});

describe("aiConfigMutationSchema", () => {
  const profile = compileOverlapCatalog()[0]?.profile;

  it("accepts create, update, and deactivate boundaries", () => {
    expect(profile).toBeDefined();
    if (!profile) return;
    expect(aiConfigMutationSchema.safeParse({ action: "create", vehicleId: "vehicle", profile, isActive: true }).success).toBe(true);
    expect(aiConfigMutationSchema.safeParse({ action: "update", vehicleId: "vehicle", expectedUpdatedAt: "2026-07-12T00:00:00.000Z", profile, isActive: true }).success).toBe(true);
    expect(aiConfigMutationSchema.safeParse({ action: "deactivate", vehicleId: "vehicle", expectedUpdatedAt: "2026-07-12T00:00:00.000Z" }).success).toBe(true);
  });

  it("rejects legacy matrices and malformed v2 profiles", () => {
    expect(aiConfigMutationSchema.safeParse({ action: "create", vehicleId: "vehicle", profile: { fuel: { gasoline: 0.7 } }, isActive: true }).success).toBe(false);
    expect(aiConfigMutationSchema.safeParse({ action: "create", vehicleId: "vehicle", profile: { version: "overlap-v2" }, isActive: true }).success).toBe(false);
  });

  it("requires optimistic locking for deactivate and distinguishes create from update", () => {
    expect(aiConfigMutationSchema.safeParse({ action: "deactivate", vehicleId: "vehicle" }).success).toBe(false);
    expect(aiConfigMutationSchema.safeParse({ action: "update", vehicleId: "vehicle", profile, isActive: true }).success).toBe(false);
    expect(aiConfigMutationSchema.safeParse({ action: "update", vehicleId: "vehicle", expectedUpdatedAt: "not-a-date", profile, isActive: true }).success).toBe(false);
  });

  it("rejects oversized highlights array", () => {
    const tooMany = Array.from({ length: 21 }, (_, i) => `h${i}`);
    expect(
      aiConfigMutationSchema.safeParse({ action: "create", vehicleId: "vehicle", profile, isActive: true, highlights: tooMany }).success
    ).toBe(false);
  });
});

describe("popularConfigCreateSchema", () => {
  it("accepts a valid config", () => {
    const result = popularConfigCreateSchema.safeParse({
      name: "기본 구성",
      items: [
        { name: "썬루프", price: 1000000, displayOrder: 0 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative price", () => {
    const result = popularConfigCreateSchema.safeParse({
      name: "x",
      items: [{ name: "i", price: -1, displayOrder: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    expect(popularConfigCreateSchema.safeParse({ name: "" }).success).toBe(false);
  });
});

describe("scraperCredentialUpsertSchema", () => {
  const valid = {
    financeCompanyId: "fc1",
    loginUrl: "https://capital.example.com/login",
    username: "agent01",
    password: "secret",
  };

  it("accepts a valid https payload", () => {
    expect(scraperCredentialUpsertSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts http localhost (mock site)", () => {
    expect(
      scraperCredentialUpsertSchema.safeParse({
        ...valid,
        loginUrl: "http://localhost:4599/login",
      }).success
    ).toBe(true);
  });

  it("rejects non-http(s) loginUrl schemes", () => {
    for (const loginUrl of [
      "javascript:alert(1)",
      "file:///etc/passwd",
      "data:text/html,<h1>x</h1>",
    ]) {
      expect(
        scraperCredentialUpsertSchema.safeParse({ ...valid, loginUrl }).success
      ).toBe(false);
    }
  });

  it("rejects missing required fields", () => {
    expect(scraperCredentialUpsertSchema.safeParse({}).success).toBe(false);
    expect(
      scraperCredentialUpsertSchema.safeParse({ ...valid, username: "" }).success
    ).toBe(false);
  });

  it("accepts null config and a config with valid selectors", () => {
    expect(
      scraperCredentialUpsertSchema.safeParse({ ...valid, config: null }).success
    ).toBe(true);
    expect(
      scraperCredentialUpsertSchema.safeParse({
        ...valid,
        config: {
          usernameSelector: "#usrId",
          passwordSelector: 'input[name="pw"]',
          quoteUrlTemplate: "https://site/quote?trim={code}",
        },
      }).success
    ).toBe(true);
  });
});

describe("scraperConfigSchema", () => {
  it("rejects selectors with disallowed characters", () => {
    for (const usernameSelector of ["#a\nb", "#a`b", "<script>"]) {
      expect(scraperConfigSchema.safeParse({ usernameSelector }).success).toBe(
        false
      );
    }
  });

  it("rejects non-http(s) quoteUrlTemplate", () => {
    expect(
      scraperConfigSchema.safeParse({
        quoteUrlTemplate: "javascript:fetch('/'+{code})",
      }).success
    ).toBe(false);
  });

  it("accepts quoteUrlTemplate with {code} placeholder", () => {
    expect(
      scraperConfigSchema.safeParse({
        quoteUrlTemplate: "https://site/q?t={code}",
      }).success
    ).toBe(true);
  });

  it("bounds requestDelayMs to a sane range", () => {
    expect(scraperConfigSchema.safeParse({ requestDelayMs: 150 }).success).toBe(
      true
    );
    expect(scraperConfigSchema.safeParse({ requestDelayMs: -1 }).success).toBe(
      false
    );
    expect(
      scraperConfigSchema.safeParse({ requestDelayMs: 999999 }).success
    ).toBe(false);
  });

  it("passes through adapter-specific keys (trimMap, productMenu)", () => {
    const parsed = scraperConfigSchema.parse({
      usernameSelector: "#usrId",
      trimMap: { "trim-1": { brandCd: "B", dtMdlCd: "D", mdelCd: "M" } },
      productMenu: "/sit/sit0001.frm",
    });
    expect(parsed.trimMap).toEqual({
      "trim-1": { brandCd: "B", dtMdlCd: "D", mdelCd: "M" },
    });
    expect(parsed.productMenu).toBe("/sit/sit0001.frm");
  });
});
