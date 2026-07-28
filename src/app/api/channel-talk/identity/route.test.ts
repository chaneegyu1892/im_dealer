import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));

vi.mock("@/lib/admin-auth", () => ({ getCurrentUser: mocks.getCurrentUser }));

// 채널톡 스펙: memberHash 는 시크릿키를 hex 디코딩한 바이트를 키로 쓴다.
const SECRET_HEX = "a".repeat(64);

function member(overrides: Record<string, unknown> = {}) {
  return {
    id: "cuid-member-1",
    name: "김재현",
    email: "member@example.com",
    phone: null,
    ...overrides,
  };
}

describe("GET /api/channel-talk/identity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CHANNEL_TALK_SECRET_KEY", SECRET_HEX);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("비로그인은 익명으로 내려 채널톡이 리드로 처리하게 한다", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ anonymous: true });
  });

  it("카카오싱크로 받은 이름·이메일·전화번호를 프로필에 싣는다", async () => {
    // 카카오는 "+82 10-1234-5678" 형태로 내려준다 — E.164 로 정규화되어야 한다.
    mocks.getCurrentUser.mockResolvedValue(member({ phone: "+82 10-8481-3357" }));

    const body = await (await GET()).json();

    expect(body.anonymous).toBe(false);
    expect(body.memberId).toBe("cuid-member-1");
    expect(body.profile).toEqual({
      name: "김재현",
      email: "member@example.com",
      mobileNumber: "+821084813357",
    });
  });

  it("싱크 이전 가입자는 이름만 실린다(미수집 필드는 키 자체를 뺀다)", async () => {
    mocks.getCurrentUser.mockResolvedValue(member({ email: null, phone: null }));

    const body = await (await GET()).json();

    expect(body.profile).toEqual({ name: "김재현" });
  });

  it("변환 불가한 전화번호는 프로필에서 제외한다", async () => {
    mocks.getCurrentUser.mockResolvedValue(member({ phone: "연락처 없음" }));

    const body = await (await GET()).json();

    expect(body.profile.mobileNumber).toBeUndefined();
  });

  it("memberHash 는 시크릿 hex 디코딩 키로 만든 SHA256 이다", async () => {
    mocks.getCurrentUser.mockResolvedValue(member());

    const body = await (await GET()).json();

    const { createHmac } = await import("node:crypto");
    const expected = createHmac("sha256", Buffer.from(SECRET_HEX, "hex"))
      .update("cuid-member-1")
      .digest("hex");
    expect(body.memberHash).toBe(expected);
  });

  it("시크릿 미설정이면 hash 없이 memberId 만으로 동작한다", async () => {
    vi.stubEnv("CHANNEL_TALK_SECRET_KEY", "");
    mocks.getCurrentUser.mockResolvedValue(member());

    const body = await (await GET()).json();

    expect(body.memberId).toBe("cuid-member-1");
    expect(body.memberHash).toBeUndefined();
  });
});
