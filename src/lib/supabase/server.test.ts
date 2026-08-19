import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addBreadcrumb: vi.fn(),
  setTag: vi.fn(),
  createServerClient: vi.fn(),
  cookieSet: vi.fn(),
  cookieGetAll: vi.fn(() => []),
}));

vi.mock("@sentry/nextjs", () => ({
  addBreadcrumb: mocks.addBreadcrumb,
  setTag: mocks.setTag,
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    getAll: mocks.cookieGetAll,
    set: mocks.cookieSet,
  })),
}));

describe("createClient token-rotation observation (T38/C5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-for-tests";
    mocks.createServerClient.mockImplementation((_url, _key, options: {
      cookies: {
        setAll: (cookies: Array<{ name: string; value: string; options: Record<string, unknown> }>) => void;
      };
    }) => {
      return {
        __options: options,
      };
    });
  });

  it("tags both successful and failed setAll cookie writes with budget_tag=refresh", async () => {
    const { createClient } = await import("./server");
    const client = await createClient() as unknown as {
      __options: {
        cookies: {
          setAll: (cookies: Array<{ name: string; value: string; options: Record<string, unknown> }>) => void;
        };
      };
    };

    client.__options.cookies.setAll([
      { name: "sb-access-token", value: "new", options: {} },
    ]);

    expect(mocks.setTag).toHaveBeenCalledWith("budget_tag", "refresh");
    expect(mocks.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "auth.refresh",
        data: expect.objectContaining({ outcome: "success" }),
      }),
    );

    mocks.setTag.mockClear();
    mocks.addBreadcrumb.mockClear();
    mocks.cookieSet.mockImplementation(() => {
      throw new Error("Cookies can only be modified in a Server Action or Route Handler.");
    });

    client.__options.cookies.setAll([
      { name: "sb-access-token", value: "retry", options: {} },
    ]);

    expect(mocks.setTag).toHaveBeenCalledWith("budget_tag", "refresh");
    expect(mocks.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "auth.refresh",
        data: expect.objectContaining({ outcome: "skipped" }),
      }),
    );
  });
});
