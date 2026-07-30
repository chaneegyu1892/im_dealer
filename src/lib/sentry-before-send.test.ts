import { describe, it, expect } from "vitest";
import type { ErrorEvent } from "@sentry/nextjs";
import {
  scrubEvent,
  scrubSpan,
  scrubTransaction,
} from "./sentry-before-send";

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

  it("후기 작성 URL은 Sentry 오류 이벤트에서 토큰만 제거하고 경로를 보존한다", () => {
    const reviewToken = "123e4567-e89b-12d3-a456-426614174000";
    const reviewUrl =
      `https://example.com/reviews/write/${reviewToken}` +
      `?token=${reviewToken}&utm_source=admin`;
    const event = {
      request: {
        // This is the pre-fix payload shape captured by the installed SDK: the
        // bearer URL reaches the beforeSend boundary in clear text.
        url: reviewUrl,
        query_string: `token=${reviewToken}&utm_source=admin`,
      },
    } as unknown as ErrorEvent;

    expect(event.request?.url).toContain(reviewToken);
    const out = scrubEvent(event);
    const serialized = JSON.stringify(out);

    expect(serialized).not.toContain(reviewToken);
    expect(out.request?.url).toContain("/reviews/write/[REDACTED]");
    expect(out.request?.url).toContain("utm_source=admin");
    expect(out.request?.query_string).toContain("utm_source=admin");
  });

  it("후기 capability가 아닌 URL의 관측성은 그대로 유지한다", () => {
    const event = {
      request: {
        url: "https://example.com/cars/sonata?utm_source=admin",
        query_string: { utm_source: "admin" },
      },
    } as unknown as ErrorEvent;

    const out = scrubEvent(event);
    expect(out.request?.url).toBe(
      "https://example.com/cars/sonata?utm_source=admin",
    );
    expect(out.request?.query_string).toEqual({ utm_source: "admin" });
  });

  it("transaction과 child span의 URL·description·data도 동일하게 정제한다", () => {
    const reviewToken = "123e4567-e89b-12d3-a456-426614174000";
    const reviewUrl = `https://example.com/reviews/write/${reviewToken}`;
    const event = {
      type: "transaction",
      transaction: `GET /reviews/write/${reviewToken}`,
      request: { url: reviewUrl },
      spans: [
        {
          data: { "http.url": `${reviewUrl}?token=${reviewToken}` },
          description: `GET /api/reviews/submit/${reviewToken}/image`,
          op: "http.client",
          span_id: "span-1",
          trace_id: "trace-1",
          start_timestamp: 1,
        },
      ],
    } as unknown as Parameters<typeof scrubTransaction>[0];

    const out = scrubTransaction(event);
    const serialized = JSON.stringify(out);

    expect(serialized).not.toContain(reviewToken);
    expect(out.transaction).toContain("/reviews/write/[REDACTED]");
    expect(out.request?.url).toContain("/reviews/write/[REDACTED]");
    expect(out.spans?.[0]?.description).toContain(
      "/api/reviews/submit/[REDACTED]/image",
    );
    expect(out.spans?.[0]?.data["http.url"]).toContain(
      "/reviews/write/[REDACTED]",
    );
  });

  it("독립적으로 전송되는 span도 bearer URL을 보존하지 않는다", () => {
    const reviewToken = "123e4567-e89b-12d3-a456-426614174000";
    const span = {
      data: { url: `/reviews/write/${reviewToken}` },
      description: `GET /reviews/write/${reviewToken}`,
      op: "pageload",
      span_id: "span-1",
      trace_id: "trace-1",
      start_timestamp: 1,
    };

    const out = scrubSpan(span);
    expect(JSON.stringify(out)).not.toContain(reviewToken);
    expect(out.description).toBe("GET /reviews/write/[REDACTED]");
    expect(out.data.url).toBe("/reviews/write/[REDACTED]");
  });

});
