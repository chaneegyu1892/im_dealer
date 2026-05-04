import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * PII 컬럼 암호화 유틸 (AES-256-GCM).
 *
 * - DB 저장 시점에 `encryptPII(value)` 로 변환 → JSON 컬럼에 그대로 적재
 * - 조회 시점에 `decryptPII(blob)` 로 평문 복원
 * - 마이그레이션 양립: 레거시 평문(JSON) 도 그대로 통과시킨다 (모양 검사로 분기)
 *
 * 키는 `PII_ENCRYPTION_KEY` 환경변수 (base64 32바이트 권장).
 * 키 분실 = 모든 PII 영구 복구 불가 → 시크릿 매니저 백업 필수.
 */

export const ENCRYPTED_BLOB_VERSION = 1;

export interface EncryptedBlob {
  v: typeof ENCRYPTED_BLOB_VERSION;
  iv: string; // base64 12 bytes (GCM 표준)
  tag: string; // base64 16 bytes auth tag
  ct: string; // base64 ciphertext
}

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.PII_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "[pii] PII_ENCRYPTION_KEY 환경변수가 설정되지 않았습니다. base64-encoded 32바이트 키가 필요합니다."
    );
  }
  let buf: Buffer;
  try {
    buf = Buffer.from(raw, "base64");
  } catch {
    throw new Error("[pii] PII_ENCRYPTION_KEY 가 올바른 base64 가 아닙니다.");
  }
  if (buf.length !== KEY_LENGTH) {
    throw new Error(
      `[pii] PII_ENCRYPTION_KEY 는 32바이트(base64 인코딩 시 44자) 이어야 합니다. 받은 길이: ${buf.length}`
    );
  }
  cachedKey = buf;
  return buf;
}

// 테스트용 — 키를 강제로 재로드하기 위해
export function _resetKeyCacheForTesting(): void {
  cachedKey = null;
}

export function isEncryptedBlob(value: unknown): value is EncryptedBlob {
  if (value === null || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return (
    o.v === ENCRYPTED_BLOB_VERSION &&
    typeof o.iv === "string" &&
    typeof o.tag === "string" &&
    typeof o.ct === "string"
  );
}

export function encryptPII(value: unknown): EncryptedBlob {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: ENCRYPTED_BLOB_VERSION,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ct: ct.toString("base64"),
  };
}

/**
 * 복호화. 전략:
 *   - 입력이 EncryptedBlob 이면 복호화하여 반환
 *   - 그 외(레거시 평문 JSON, null, undefined, primitive) 는 그대로 반환
 *   - auth tag 검증 실패/키 불일치 시 throw
 */
export function decryptPII<T = unknown>(blob: unknown): T | null {
  if (blob === null || blob === undefined) return null as T | null;

  // 마이그레이션 진행 중 양립: 평문 레거시는 그대로 반환
  if (!isEncryptedBlob(blob)) return blob as T;

  const key = getKey();
  const iv = Buffer.from(blob.iv, "base64");
  const tag = Buffer.from(blob.tag, "base64");
  const ct = Buffer.from(blob.ct, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ct), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8")) as T;
}

/**
 * connectedId 는 String? 컬럼이라 EncryptedBlob 을 JSON.stringify 로 직렬화해 저장한다.
 */
export function encryptString(value: string | null): string | null {
  if (value === null || value === undefined) return null;
  return JSON.stringify(encryptPII(value));
}

export function decryptString(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  // EncryptedBlob JSON 형식이면 파싱 후 복호화. 그 외(레거시) 는 원본 반환.
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return value; // 평문 레거시
  }
  if (!isEncryptedBlob(parsed)) return value;
  return decryptPII<string>(parsed);
}

// ─── Verification 로우 매핑 헬퍼 ────────────────────────────

interface VerificationLikeRow {
  connectedId: string | null;
  licenseData: unknown;
  insuranceData: unknown;
  bizData: unknown;
}

/**
 * CustomerVerification 행의 4개 PII 컬럼을 한 번에 복호화한다.
 * 마이그레이션 진행 중에는 일부 행이 평문일 수 있고, 일부는 암호문일 수 있다.
 * 각 행의 모양에 따라 자동으로 분기.
 */
export function decryptVerificationRow<T extends VerificationLikeRow>(row: T): T {
  return {
    ...row,
    connectedId: decryptString(row.connectedId),
    licenseData: decryptPII(row.licenseData),
    insuranceData: decryptPII(row.insuranceData),
    bizData: decryptPII(row.bizData),
  };
}
