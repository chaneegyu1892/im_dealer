import { describe, expect, it } from "vitest";
import { PUBLIC_VIEWPORT, ROOT_TOUCH_ACTION } from "./public-viewport";

describe("전역 모바일 확대 정책", () => {
  it("지원 브라우저에서 확대 제스처를 제한하고 스크롤은 유지한다", () => {
    expect(PUBLIC_VIEWPORT).toMatchObject({
      width: "device-width",
      initialScale: 1,
      minimumScale: 1,
      maximumScale: 1,
      userScalable: false,
    });
    expect(ROOT_TOUCH_ACTION).toBe("pan-x pan-y");
  });
});
