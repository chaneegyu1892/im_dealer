import { describe, it, expect } from "vitest";
import type { ErrorEvent } from "@sentry/nextjs";
import { scrubEvent } from "./sentry-before-send";

// scrubEvent 는 scrubPII(별도 테스트됨) 를 event 의 각 영역에 적용한다.
// 여기서는 "이벤트 전송 직전 PII 가 실제로 마스킹되는지"를 영역별로 검증한다.
describe("scrubEvent", () => {
  it("request.data 의 한국 PII 를 마스킹한다", () => {
    const event = {
      request: { data: { phone: "010-1234-5678", note: "안녕" } },
    } as unknown as ErrorEvent;

    const out = scrubEvent(event);
    const data = out.request?.data as Record<string, string>;
    expect(data.phone).toBe("[PHONE]");
    expect(data.note).toBe("안녕");
  });

  it("extra 의 이메일을 마스킹한다", () => {
    const event = {
      extra: { email: "user@example.com" },
    } as unknown as ErrorEvent;

    const out = scrubEvent(event);
    expect((out.extra as Record<string, string>).email).toBe("[EMAIL]");
  });

  it("breadcrumbs 의 message 내 주민번호를 마스킹한다", () => {
    const event = {
      breadcrumbs: [{ message: "주민 900101-1234567 조회" }],
    } as unknown as ErrorEvent;

    const out = scrubEvent(event);
    const msg = out.breadcrumbs?.[0]?.message ?? "";
    expect(msg).toContain("[RRN]");
    expect(msg).not.toContain("900101-1234567");
  });

  it("PII 가 없는 이벤트는 형태를 보존한다", () => {
    const event = {
      request: { data: { ok: "정상" } },
    } as unknown as ErrorEvent;

    const out = scrubEvent(event);
    expect((out.request?.data as Record<string, string>).ok).toBe("정상");
  });
});
