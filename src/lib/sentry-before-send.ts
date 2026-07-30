import type { ErrorEvent } from "@sentry/nextjs";
import { scrubPII } from "./sentry-scrubber";

type SpanJSON = NonNullable<ErrorEvent["spans"]>[number];
type TransactionEvent = Omit<ErrorEvent, "type"> & { type: "transaction" };

const REDACTED_TOKEN = "[REDACTED]";

// Review capabilities are bearer tokens. Keep the route useful for debugging, but
// never send the dynamic path segment to Sentry. The API routes are included too:
// browser spans can capture the upload/submit requests after the page loads.
const REVIEW_TOKEN_PATH_PATTERNS = [
  /((?:^|\/)reviews\/write\/)[^\/?#\s]+/gi,
  /((?:^|\/)api\/reviews\/submit\/)[^\/?#\s]+/gi,
  /((?:^|\/)api\/admin\/review-tokens\/)[^\/?#\s]+/gi,
];

function redactReviewTokenPaths(input: string): string {
  return REVIEW_TOKEN_PATH_PATTERNS.reduce(
    (value, pattern) => value.replace(pattern, `$1${REDACTED_TOKEN}`),
    input,
  );
}

function isSensitiveQueryKey(key: string): boolean {
  const compact = key.toLowerCase().replace(/[\s_-]/g, "");
  return (
    compact === "token" ||
    compact.endsWith("token") ||
    compact === "authorization" ||
    compact.endsWith("authorization") ||
    compact.endsWith("secret") ||
    compact.endsWith("password") ||
    compact.endsWith("cookie")
  );
}

/**
 * Redact bearer-like query parameters while retaining the parameter names and
 * all non-sensitive values for useful request diagnostics.
 */
export function scrubSentryQueryString(
  query: string | Record<string, string> | Array<[string, string]>,
): string | Record<string, string> | Array<[string, string]> {
  if (typeof query === "string") {
    const hasQuestionMark = query.startsWith("?");
    const body = hasQuestionMark ? query.slice(1) : query;
    const params = new URLSearchParams(body);

    for (const [key, value] of params.entries()) {
      if (isSensitiveQueryKey(key)) {
        params.set(key, REDACTED_TOKEN);
      } else {
        params.set(key, scrubSentryString(value));
      }
    }

    const sanitized = params.toString();
    return hasQuestionMark ? `?${sanitized}` : sanitized;
  }

  if (Array.isArray(query)) {
    return query.map(
      ([key, value]): [string, string] => [
        key,
        isSensitiveQueryKey(key) ? REDACTED_TOKEN : scrubSentryString(value),
      ],
    );
  }

  return Object.fromEntries(
    Object.entries(query).map(([key, value]) => [
      key,
      isSensitiveQueryKey(key) ? REDACTED_TOKEN : scrubSentryString(value),
    ]),
  );
}

/**
 * Scrub a URL without dropping its host, route, or non-sensitive query data.
 * This is intentionally string based so relative browser URLs and malformed
 * values are handled without introducing a synthetic origin into telemetry.
 */
export function scrubSentryUrl(input: string): string {
  const piiScrubbed = scrubPII(input);
  const source = typeof piiScrubbed === "string" ? piiScrubbed : input;

  const hashIndex = source.indexOf("#");
  const withoutHash = hashIndex >= 0 ? source.slice(0, hashIndex) : source;
  const fragment = hashIndex >= 0 ? source.slice(hashIndex + 1) : undefined;
  const queryIndex = withoutHash.indexOf("?");
  const path = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  const query = queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : undefined;

  const sanitizedPath = redactReviewTokenPaths(path);
  const sanitizedQuery =
    query === undefined
      ? ""
      : `?${scrubSentryQueryString(query) as string}`;
  const sanitizedFragment =
    fragment === undefined ? "" : `#${redactReviewTokenPaths(scrubSentryString(fragment))}`;

  return `${sanitizedPath}${sanitizedQuery}${sanitizedFragment}`;
}

function scrubSentryString(input: string): string {
  const piiScrubbed = scrubPII(input);
  const source = typeof piiScrubbed === "string" ? piiScrubbed : input;
  let output = redactReviewTokenPaths(source);

  // This covers URL-like strings embedded in messages, breadcrumbs, and span
  // descriptions where there is no separately typed request.url field.
  output = output.replace(
    /([?&][^=&#\s]*(?:token|secret|authorization|password|cookie)[^=&#\s]*=)[^&#\s]*/gi,
    `$1${REDACTED_TOKEN}`,
  );
  return output;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Apply the existing PII policy and the capability URL policy recursively. */
function scrubTelemetryValue(value: unknown): unknown {
  const piiScrubbed = scrubPII(value);
  if (typeof piiScrubbed === "string") return scrubSentryString(piiScrubbed);
  if (Array.isArray(piiScrubbed)) return piiScrubbed.map(scrubTelemetryValue);
  if (isRecord(piiScrubbed)) {
    return Object.fromEntries(
      Object.entries(piiScrubbed).map(([key, nested]) => [
        key,
        scrubTelemetryValue(nested),
      ]),
    );
  }
  return piiScrubbed;
}

function scrubRequest(request: NonNullable<ErrorEvent["request"]>): void {
  if (request.url !== undefined) request.url = scrubSentryUrl(request.url);
  if (request.query_string !== undefined) {
    request.query_string = scrubSentryQueryString(request.query_string);
  }
  if (request.data !== undefined) request.data = scrubTelemetryValue(request.data);
  if (request.cookies !== undefined) {
    request.cookies = scrubTelemetryValue(request.cookies) as typeof request.cookies;
  }
  if (request.headers !== undefined) {
    request.headers = scrubTelemetryValue(request.headers) as typeof request.headers;
  }
  if (request.env !== undefined) {
    request.env = scrubTelemetryValue(request.env) as typeof request.env;
  }
}

function scrubEventFields<T extends ErrorEvent | TransactionEvent>(event: T): T {
  if (event.request) scrubRequest(event.request);
  if (event.message !== undefined) event.message = scrubSentryString(event.message);
  if (event.logentry) {
    if (event.logentry.message !== undefined) {
      event.logentry.message = scrubSentryString(event.logentry.message);
    }
    if (event.logentry.params !== undefined) {
      event.logentry.params = event.logentry.params.map(scrubTelemetryValue);
    }
  }
  if (event.transaction !== undefined) {
    event.transaction = scrubSentryString(event.transaction);
  }
  if (event.fingerprint !== undefined) {
    event.fingerprint = event.fingerprint.map(scrubSentryString);
  }
  if (event.exception?.values) {
    event.exception.values = event.exception.values.map(
      (value) => scrubTelemetryValue(value) as typeof value,
    );
  }
  if (event.user !== undefined) {
    event.user = scrubTelemetryValue(event.user) as typeof event.user;
  }
  if (event.tags !== undefined) {
    event.tags = scrubTelemetryValue(event.tags) as typeof event.tags;
  }
  if (event.extra !== undefined) {
    event.extra = scrubTelemetryValue(event.extra) as typeof event.extra;
  }
  if (event.contexts !== undefined) {
    event.contexts = scrubTelemetryValue(event.contexts) as typeof event.contexts;
  }
  if (event.breadcrumbs !== undefined) {
    event.breadcrumbs = event.breadcrumbs.map(
      (breadcrumb) => scrubTelemetryValue(breadcrumb) as typeof breadcrumb,
    );
  }
  if (event.spans !== undefined) {
    event.spans = event.spans.map(scrubSpan);
  }
  return event;
}

/**
 * Sentry error-event callback. Existing PII scrubbing is retained and now also
 * covers URL/query fields and URL-bearing messages before the event is sent.
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  return scrubEventFields(event);
}

/** Transaction callback for sampled traces. */
export function scrubTransaction(event: TransactionEvent): TransactionEvent {
  return scrubEventFields(event);
}

/** Span callback for child spans emitted independently of a transaction event. */
export function scrubSpan(span: SpanJSON): SpanJSON {
  if (span.description !== undefined) {
    span.description = scrubSentryString(span.description);
  }
  if (span.op !== undefined) span.op = scrubSentryString(span.op);
  if (span.data !== undefined) {
    span.data = scrubTelemetryValue(span.data) as SpanJSON["data"];
  }
  if (span.links !== undefined) {
    span.links = scrubTelemetryValue(span.links) as SpanJSON["links"];
  }

  // Streamed v2 spans expose the same URL-bearing values under attributes/name
  // instead of data/description. Keep this branch structural so the helper is
  // safe for both Sentry span payload formats without weakening observability.
  const streamedSpan = span as SpanJSON & {
    attributes?: unknown;
    name?: unknown;
  };
  if (streamedSpan.name !== undefined) {
    streamedSpan.name =
      typeof streamedSpan.name === "string"
        ? scrubSentryString(streamedSpan.name)
        : scrubTelemetryValue(streamedSpan.name);
  }
  if (streamedSpan.attributes !== undefined) {
    streamedSpan.attributes = scrubTelemetryValue(streamedSpan.attributes);
  }
  return span;
}
