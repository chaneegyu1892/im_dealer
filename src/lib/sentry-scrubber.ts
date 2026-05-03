/**
 * Sentry/로그용 PII 스크러버.
 *
 * 운영 에러 발생 시 요청 본문·breadcrumb 등에 한국 PII (휴대폰, 사업자번호,
 * 면허번호, 주민번호, 이메일) 가 포함될 수 있다. 외부 SaaS(Sentry US 서버)로
 * 전송되기 전 마스킹해 개인정보보호법 위반·국외이전 이슈를 차단한다.
 *
 * 두 단계 마스킹:
 *   1) 키 기반 — 알려진 민감 키는 값 통째로 "***" 로 대체
 *   2) 패턴 기반 — 임의 문자열 안의 PII 정규식 매치를 마스킹
 */

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "password_hash",
  "passwordhashed",
  "licenseno",
  "licensedata",
  "license_data",
  "insurancedata",
  "insurance_data",
  "bizdata",
  "biz_data",
  "connectedid",
  "connected_id",
  "ssn",
  "rrn",
  "residentregistrationnumber",
  "token",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
  "authorization",
  "cookie",
  "set-cookie",
]);

interface PatternRule {
  re: RegExp;
  replace: string;
}

const PATTERNS: PatternRule[] = [
  // 휴대폰: 010~019 - 3~4자리 - 4자리. 예: 010-1234-5678, 01012345678, +82 10 1234 5678
  { re: /(\+?82[\s-]?)?0?1[016789][\s-]?\d{3,4}[\s-]?\d{4}/g, replace: "[PHONE]" },
  // 주민번호: 6자리 - 7자리(첫자리 1~4)
  { re: /\d{6}[\s-]?[1-4]\d{6}/g, replace: "[RRN]" },
  // 면허번호: 2-2-6-2 패턴
  { re: /\d{2}[\s-]?\d{2}[\s-]?\d{6}[\s-]?\d{2}/g, replace: "[LICENSE]" },
  // 사업자번호: 3-2-5
  { re: /\b\d{3}[\s-]?\d{2}[\s-]?\d{5}\b/g, replace: "[BIZ_NO]" },
  // 이메일
  { re: /[\w.+-]+@[\w-]+\.[\w.-]+/g, replace: "[EMAIL]" },
];

const MAX_DEPTH = 8;
const MAX_STRING_LENGTH = 4000;

function scrubString(input: string): string {
  let out = input.length > MAX_STRING_LENGTH ? input.slice(0, MAX_STRING_LENGTH) + "...[truncated]" : input;
  for (const rule of PATTERNS) {
    out = out.replace(rule.re, rule.replace);
  }
  return out;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function scrubPII(input: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return "[truncated:depth]";

  if (input == null) return input;

  if (typeof input === "string") return scrubString(input);

  if (typeof input === "number" || typeof input === "boolean") return input;

  if (Array.isArray(input)) {
    return input.map((item) => scrubPII(item, depth + 1));
  }

  if (isPlainObject(input)) {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        out[key] = "***";
      } else {
        out[key] = scrubPII(value, depth + 1);
      }
    }
    return out;
  }

  // 그 외(Error, Date, Map 등): 문자열화 후 패턴 마스킹
  try {
    return scrubString(String(input));
  } catch {
    return "[unserializable]";
  }
}
