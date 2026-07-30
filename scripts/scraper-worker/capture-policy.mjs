const SENSITIVE_KEY =
  /pass(?:word)?|usrpw|token|secret|authorization|cookie|session/i;
const LOGIN_PATH = /(?:^|\/)login(?:[./]|$)/i;

function redactStructured(value) {
  if (Array.isArray(value)) {
    return value.map(redactStructured);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      SENSITIVE_KEY.test(key) ? "[REDACTED]" : redactStructured(child),
    ])
  );
}

function sanitizeText(value) {
  if (!value) return "";

  try {
    return JSON.stringify(redactStructured(JSON.parse(value)));
  } catch {
    // JSON 이 아닌 form-urlencoded 또는 평문 응답은 아래에서 처리한다.
  }

  if (value.includes("=")) {
    const params = new URLSearchParams(value);
    for (const key of [...params.keys()]) {
      if (SENSITIVE_KEY.test(key)) {
        params.set(key, "[REDACTED]");
      }
    }
    return params.toString();
  }

  return value.replace(
    /((?:pass(?:word)?|usrpw|token|secret|authorization|cookie|session)\s*[:=]\s*)([^&\s,"}]+)/gi,
    "$1[REDACTED]"
  );
}

export function sanitizeCaptureRecord({ path, payload, resp }) {
  if (LOGIN_PATH.test(path)) return null;
  return {
    path,
    payload: sanitizeText(payload),
    resp: sanitizeText(resp),
  };
}
