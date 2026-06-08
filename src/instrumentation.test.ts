import { describe, it, expect, vi, beforeEach } from "vitest";

// Sentry / env / config 모듈을 모킹하여 instrumentation 배선만 검증한다.
// vi.hoisted 로 모킹 팩토리보다 먼저 초기화되도록 보장한다.
const { loadEnv, captureRequestError, serverConfigLoaded, edgeConfigLoaded } =
  vi.hoisted(() => ({
    loadEnv: vi.fn(),
    captureRequestError: vi.fn(),
    serverConfigLoaded: vi.fn(),
    edgeConfigLoaded: vi.fn(),
  }));

vi.mock("@sentry/nextjs", () => ({ captureRequestError }));
vi.mock("@/lib/env", () => ({ loadEnv }));
vi.mock("../sentry.server.config", () => {
  serverConfigLoaded();
  return {};
});
vi.mock("../sentry.edge.config", () => {
  edgeConfigLoaded();
  return {};
});

describe("instrumentation 배선", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    delete process.env.NEXT_RUNTIME;
  });

  it("onRequestError 가 Sentry.captureRequestError 로 연결되어 있다 (서버 에러 자동 캡처)", async () => {
    const mod = await import("./instrumentation");
    expect(mod.onRequestError).toBe(captureRequestError);
  });

  it("nodejs 런타임: loadEnv 로 환경변수를 검증하고 server config 를 로드한다", async () => {
    process.env.NEXT_RUNTIME = "nodejs";
    const mod = await import("./instrumentation");
    await mod.register();
    expect(loadEnv).toHaveBeenCalledTimes(1);
    expect(serverConfigLoaded).toHaveBeenCalledTimes(1);
    expect(edgeConfigLoaded).not.toHaveBeenCalled();
  });

  it("edge 런타임: edge config 만 로드하고 loadEnv 는 호출하지 않는다", async () => {
    process.env.NEXT_RUNTIME = "edge";
    const mod = await import("./instrumentation");
    await mod.register();
    expect(edgeConfigLoaded).toHaveBeenCalledTimes(1);
    expect(loadEnv).not.toHaveBeenCalled();
  });
});
