import { generateKeyPairSync } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildServiceAccountJwt,
  buildSheetValues,
  SHEET_HEADER,
  sheetSyncConfig,
} from "./sheets-sync";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const BASE_INFO = {
  fileName: "260819_기아 정상 & 한정 재고리스트.xlsx",
  snapshotDate: "2026-08-19",
  rowCount: 2,
  vehicleCount: 5,
  uploadedAt: new Date("2026-08-21T01:00:00Z"),
  syncedAt: new Date("2026-08-21T02:30:00Z"),
};

describe("buildSheetValues", () => {
  it("1행 정보줄 + 2행 헤더 + 데이터 행 순서로 만든다", () => {
    const values = buildSheetValues(BASE_INFO, [
      {
        model: "쏘렌토",
        stockType: "NORMAL",
        trimName: "프레스티지",
        salesCode: "A1",
        optionText: "선루프",
        exteriorColor: "스노우 화이트",
        interiorColor: "블랙",
        price: 41000000,
        discount: null,
        quantity: 4,
        location: null,
      },
      {
        model: "쏘렌토",
        stockType: "LIMITED",
        trimName: "시그니처",
        salesCode: null,
        optionText: null,
        exteriorColor: null,
        interiorColor: null,
        price: null,
        discount: 1500000,
        quantity: 1,
        location: "광명",
      },
    ]);

    expect(values).toHaveLength(4);
    const info = values[0][0] as string;
    expect(info).toContain("260819_기아");
    expect(info).toContain("기준일 2026-08-19");
    expect(info).toContain("2행 5대");
    expect(values[1]).toEqual([...SHEET_HEADER]);
    expect(values[2]).toEqual([
      "쏘렌토", "정상", "프레스티지", "A1", "선루프", "스노우 화이트", "블랙", 41000000, "", 4, "",
    ]);
    expect(values[3]).toEqual([
      "쏘렌토", "한정/조건", "시그니처", "", "", "", "", "", 1500000, 1, "광명",
    ]);
  });

  it("기준일이 없으면 정보줄에서 생략한다", () => {
    const values = buildSheetValues({ ...BASE_INFO, snapshotDate: null }, []);
    expect(values[0][0]).not.toContain("기준일");
  });
});

describe("buildServiceAccountJwt", () => {
  it("RS256 3-세그먼트 JWT를 만들고 클레임이 올바르다", () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const jwt = buildServiceAccountJwt(
      { clientEmail: "svc@test.iam.gserviceaccount.com", privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString() },
      1_700_000_000,
    );
    const parts = jwt.split(".");
    expect(parts).toHaveLength(3);
    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    expect(header).toEqual({ alg: "RS256", typ: "JWT" });
    expect(payload.iss).toBe("svc@test.iam.gserviceaccount.com");
    expect(payload.scope).toBe("https://www.googleapis.com/auth/spreadsheets");
    expect(payload.aud).toBe("https://oauth2.googleapis.com/token");
    expect(payload.exp - payload.iat).toBe(3600);
    expect(parts[2].length).toBeGreaterThan(100);
  });
});

describe("sheetSyncConfig", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("env 3종이 모두 있어야 켜지고, 빈 문자열은 미설정으로 본다", () => {
    vi.stubEnv("GOOGLE_SHEETS_CLIENT_EMAIL", "svc@test.iam.gserviceaccount.com");
    vi.stubEnv("GOOGLE_SHEETS_PRIVATE_KEY", "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----");
    vi.stubEnv("IMMEDIATE_DELIVERY_SHEET_ID", "");
    expect(sheetSyncConfig()).toBeNull();

    vi.stubEnv("IMMEDIATE_DELIVERY_SHEET_ID", "sheet-id-123");
    const cfg = sheetSyncConfig();
    expect(cfg).not.toBeNull();
    // Vercel env의 "\n" 리터럴이 실제 개행으로 복원돼야 서명이 가능하다
    expect(cfg!.privateKey).toContain("\nabc\n");
  });
});
