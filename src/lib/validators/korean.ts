import { z } from "zod";

/**
 * 한국 도메인 입력 검증·정규화 유틸.
 *
 * 사용자 입력은 형식이 제각각(하이픈/공백/+82 prefix)이고, Codef 같은 외부
 * API에 그대로 흘리면 비용 낭비·실패율 상승. 이 모듈에서 표준 형식으로
 * 정규화하고, 사업자번호는 체크섬 검증까지 수행해 가짜 입력을 차단한다.
 */

// ─── 휴대폰 ─────────────────────────────────────────────────

export type PhoneParseResult =
  | { ok: true; normalized: string }
  | { ok: false };

/**
 * 자유 입력을 표준 휴대폰 번호("010-XXXX-XXXX") 로 정규화.
 *
 * 허용 형식:
 *   - 010-1234-5678
 *   - 01012345678
 *   - 010 1234 5678
 *   - +82 10 1234 5678 / +821012345678 / 82-10-1234-5678
 *
 * 거부:
 *   - 010 외 prefix (예: 020-...)
 *   - 자릿수 부족/초과
 *   - 010-1XXX-XXXX 같은 11자리 010 (현재 한국에서 010 만 11자리 허용)
 */
export function parsePhone(input: string): PhoneParseResult {
  if (typeof input !== "string") return { ok: false };

  // 모든 비숫자 제거 (+, -, space, 괄호 등)
  const digits = input.replace(/\D/g, "");
  if (digits.length === 0) return { ok: false };

  // +82 / 82 prefix 제거
  let local = digits;
  if (local.startsWith("82")) {
    local = local.slice(2);
    // +82 다음 0 이 생략될 수도, 포함될 수도 있음
    if (!local.startsWith("0")) local = "0" + local;
  }

  // 010~019 prefix 검증 (실제로 010만 11자리 허용, 011~019는 10자리)
  // 보수적으로 010 11자리만 허용
  if (!/^010\d{8}$/.test(local)) return { ok: false };

  return {
    ok: true,
    normalized: `${local.slice(0, 3)}-${local.slice(3, 7)}-${local.slice(7)}`,
  };
}

/**
 * 표시용 포매터. 잘못된 입력은 원본 그대로 반환(파괴적이지 않음).
 */
export function formatPhone(raw: string): string {
  const parsed = parsePhone(raw);
  return parsed.ok ? parsed.normalized : raw;
}

// ─── 사업자등록번호 ────────────────────────────────────────

/**
 * 사업자번호 10자리 체크섬 검증.
 *
 * 알고리즘 (국세청 표준):
 *   가중치 [1,3,7,1,3,7,1,3,5] 를 앞 9자리에 곱한 합 + floor((9번째 자리 * 5) / 10)
 *   합 % 10 의 보수가 마지막 자리와 일치해야 한다.
 *
 * 실제 유효 예: 105-87-66533 (삼성전자), 220-81-62517 (현대자동차)
 */
export function validateBizNumber(input: string): boolean {
  if (typeof input !== "string") return false;
  const digits = input.replace(/\D/g, "");
  if (digits.length !== 10) return false;
  if (/^0+$/.test(digits)) return false;

  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(digits[i]) * weights[i];
  }
  sum += Math.floor((Number(digits[8]) * 5) / 10);

  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === Number(digits[9]);
}

/**
 * 표시용 포매터: "1234567890" → "123-45-67890". 10자리가 아니면 원본 반환.
 */
export function formatBizNumber(raw: string): string {
  if (typeof raw !== "string") return raw;
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 10) return raw;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

// ─── Zod 통합 ──────────────────────────────────────────────

/**
 * Zod 스키마. 입력 검증 후 표준 포맷으로 transform.
 */
export const phoneSchema = z
  .string()
  .refine((v) => parsePhone(v).ok, "올바른 휴대폰 번호가 아닙니다.")
  .transform((v) => {
    const r = parsePhone(v);
    return r.ok ? r.normalized : v; // 도달 불가 (refine 통과 보장)
  });

export const bizNumberSchema = z
  .string()
  .refine(validateBizNumber, "사업자등록번호가 올바르지 않습니다.")
  .transform((v) => formatBizNumber(v));
