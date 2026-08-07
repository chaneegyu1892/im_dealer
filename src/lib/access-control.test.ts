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

// (member) 그룹 layout 이 x-pathname 으로 실제 경로를 판정하므로, 그룹 내 모든
// 경로가 PAGE_ACCESS 에 등록돼 있어야 한다. 정책 미정의 경로는 기본 허용이라
// 등록이 빠지면 로그인 없이도 통과한다 — /welcome 이 그 예시로 한 번 빠졌었다.
describe("member 그룹 라우트 접근 정책", () => {
  it("비로그인 사용자는 /welcome 에 접근할 수 없다", () => {
    expect(hasAccess("guest", "/welcome")).toBe(false);
  });

  it("로그인한 회원은 /welcome 에 접근할 수 있다", () => {
    expect(hasAccess("member", "/welcome")).toBe(true);
  });
});
