import type { ErrorEvent } from "@sentry/nextjs";
import { scrubPII } from "./sentry-scrubber";

// Sentry 로 이벤트가 전송되기 전 한국 PII(휴대폰/주민번호/면허번호/사업자번호/이메일)를 마스킹한다.
// server / edge / client 세 런타임 설정에서 공통으로 사용한다(중복 제거).
// 키 기반(licenseData, connectedId, passwordHash 등) + 패턴 기반 두 단계 마스킹.
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request?.data !== undefined) {
    event.request.data = scrubPII(event.request.data);
  }
  if (event.request?.cookies) {
    event.request.cookies = scrubPII(event.request.cookies) as typeof event.request.cookies;
  }
  if (event.request?.headers) {
    event.request.headers = scrubPII(event.request.headers) as typeof event.request.headers;
  }
  if (event.extra) {
    event.extra = scrubPII(event.extra) as Record<string, unknown>;
  }
  if (event.contexts) {
    event.contexts = scrubPII(event.contexts) as typeof event.contexts;
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((b) => ({
      ...b,
      data: b.data ? (scrubPII(b.data) as Record<string, unknown>) : b.data,
      message: b.message ? (scrubPII(b.message) as string) : b.message,
    }));
  }
  return event;
}
