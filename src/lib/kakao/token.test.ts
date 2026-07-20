import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { storeKakaoRefreshToken, getKakaoAccessToken } from "./token";
import { decryptString } from "@/lib/pii";

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { update: mocks.update, findUnique: mocks.findUnique } },
}));

const KEY = Buffer.alloc(32, 3).toString("base64");

function mockFetchOnce(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    }))
  );
}

describe("kakao/token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PII_ENCRYPTION_KEY = KEY;
    process.env.KAKAO_REST_API_KEY = "rest-key";
    delete process.env.KAKAO_CLIENT_SECRET;
    mocks.update.mockResolvedValue({});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.KAKAO_REST_API_KEY;
  });

  describe("storeKakaoRefreshToken", () => {
    it("평문이 아니라 암호문으로 저장한다", async () => {
      await storeKakaoRefreshToken("sb-1", "refresh-abc");

      const stored = mocks.update.mock.calls[0][0].data.kakaoRefreshToken;
      expect(stored).not.toContain("refresh-abc");
      expect(decryptString(stored)).toBe("refresh-abc");
    });

    it("토큰이 없으면 아무것도 하지 않는다", async () => {
      await storeKakaoRefreshToken("sb-1", null);
      expect(mocks.update).not.toHaveBeenCalled();
    });

    it("암호화 키가 없어도 throw 하지 않는다(로그인 보호)", async () => {
      delete process.env.PII_ENCRYPTION_KEY;
      await expect(storeKakaoRefreshToken("sb-1", "refresh-abc")).resolves.toBeUndefined();
    });
  });

  describe("getKakaoAccessToken", () => {
    beforeEach(async () => {
      await storeKakaoRefreshToken("sb-1", "refresh-abc");
      const sealed = mocks.update.mock.calls[0][0].data.kakaoRefreshToken;
      mocks.findUnique.mockResolvedValue({ kakaoRefreshToken: sealed });
      mocks.update.mockClear();
    });

    it("저장된 토큰으로 액세스 토큰을 재발급한다", async () => {
      mockFetchOnce(200, { access_token: "access-xyz" });

      await expect(getKakaoAccessToken("sb-1")).resolves.toBe("access-xyz");

      const body = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body;
      expect(body.get("grant_type")).toBe("refresh_token");
      expect(body.get("refresh_token")).toBe("refresh-abc");
      expect(body.get("client_secret")).toBeNull();
    });

    it("리프레시 토큰이 회전되면 새 값을 다시 암호화해 저장한다", async () => {
      mockFetchOnce(200, { access_token: "access-xyz", refresh_token: "refresh-new" });

      await getKakaoAccessToken("sb-1");

      const stored = mocks.update.mock.calls[0][0].data.kakaoRefreshToken;
      expect(decryptString(stored)).toBe("refresh-new");
    });

    it("회전이 없으면 저장하지 않는다", async () => {
      mockFetchOnce(200, { access_token: "access-xyz" });
      await getKakaoAccessToken("sb-1");
      expect(mocks.update).not.toHaveBeenCalled();
    });

    it("client_secret 이 설정되면 함께 보낸다", async () => {
      process.env.KAKAO_CLIENT_SECRET = "secret-1";
      mockFetchOnce(200, { access_token: "access-xyz" });

      await getKakaoAccessToken("sb-1");

      const body = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body;
      expect(body.get("client_secret")).toBe("secret-1");
    });

    it("만료·폐기(HTTP 400)면 null", async () => {
      mockFetchOnce(400, { error: "invalid_grant" });
      await expect(getKakaoAccessToken("sb-1")).resolves.toBeNull();
    });

    it("REST API 키가 없으면 조회조차 하지 않는다", async () => {
      delete process.env.KAKAO_REST_API_KEY;
      await expect(getKakaoAccessToken("sb-1")).resolves.toBeNull();
      expect(mocks.findUnique).not.toHaveBeenCalled();
    });

    it("저장된 토큰이 없으면 null", async () => {
      mocks.findUnique.mockResolvedValue({ kakaoRefreshToken: null });
      await expect(getKakaoAccessToken("sb-1")).resolves.toBeNull();
    });

    it("키가 바뀌어 복호화가 실패하면 null(재로그인 유도)", async () => {
      process.env.PII_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
      const { _resetKeyCacheForTesting } = await import("@/lib/pii");
      _resetKeyCacheForTesting();

      await expect(getKakaoAccessToken("sb-1")).resolves.toBeNull();
    });
  });
});
