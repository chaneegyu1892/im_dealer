// ─── Codef API 유틸리티 ─────────────────────────────────────────────────────
//
// .env.local에 아래 환경변수를 설정하세요:
//   CODEF_CLIENT_ID=your_codef_client_id
//   CODEF_CLIENT_SECRET=your_codef_client_secret
//   CODEF_SANDBOX=true   # 샌드박스 mock 응답 사용 (실제 운영 시 false 또는 제거)
//
// 개발 샌드박스: https://development.codef.io
// OAuth 토큰: https://oauth.codef.io/oauth/token
// ─────────────────────────────────────────────────────────────────────────────

const CODEF_TOKEN_URL = "https://oauth.codef.io/oauth/token";
const CODEF_API_BASE = "https://development.codef.io";

type CodefResult<T> = { success: true; data: T } | { success: false; error: string };

interface CodefTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface CodefApiResponse {
  result: {
    code: string;
    extraMessage: string;
    message: string;
  };
  data: unknown;
}

// ─── OAuth 액세스 토큰 발급 ──────────────────────────────────────────────────
export async function getCodefToken(): Promise<CodefResult<string>> {
  const clientId = process.env.CODEF_CLIENT_ID;
  const clientSecret = process.env.CODEF_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return {
      success: false,
      error: "CODEF_CLIENT_ID 또는 CODEF_CLIENT_SECRET 환경변수가 설정되지 않았습니다.",
    };
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  try {
    const res = await fetch(CODEF_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({ grant_type: "client_credentials" }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `토큰 발급 실패 (${res.status}): ${text}` };
    }

    const json = (await res.json()) as CodefTokenResponse;

    if (!json.access_token) {
      return { success: false, error: "응답에 access_token이 없습니다." };
    }

    return { success: true, data: json.access_token };
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return { success: false, error: `토큰 발급 중 오류: ${message}` };
  }
}

// ─── Codef API 공통 호출 함수 ────────────────────────────────────────────────
export async function callCodefApi(
  endpoint: string,
  params: Record<string, string>,
  token: string
): Promise<CodefResult<unknown>> {
  try {
    const res = await fetch(`${CODEF_API_BASE}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    });

    const rawText = await res.text();

    let parsed: CodefApiResponse;
    try {
      const decoded = decodeURIComponent(rawText);
      parsed = JSON.parse(decoded) as CodefApiResponse;
    } catch {
      return { success: false, error: `응답 파싱 실패: ${rawText.slice(0, 200)}` };
    }

    if (parsed.result?.code !== "CF-00000") {
      return {
        success: false,
        error: `Codef API 오류 [${parsed.result?.code}]: ${parsed.result?.message ?? "알 수 없는 오류"}`,
      };
    }

    return { success: true, data: parsed.data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return { success: false, error: `Codef API 호출 오류: ${message}` };
  }
}

// ─── 샌드박스 여부 ───────────────────────────────────────────────────────────
function isSandbox(): boolean {
  return process.env.CODEF_SANDBOX === "true";
}

// ─── 운전면허 진위확인 ────────────────────────────────────────────────────────
export async function verifyDriverLicense(
  connectedId: string,
  name: string,
  licenseNo: string,
  birthDate: string
): Promise<CodefResult<unknown>> {
  if (isSandbox()) {
    return {
      success: true,
      data: { resAuthenticity: "1", resAuthenticityDesc: "정상면허" },
    };
  }

  const tokenResult = await getCodefToken();
  if (!tokenResult.success) return tokenResult;

  return callCodefApi(
    "/v1/kr/public/mw/driver-license/status",
    {
      connectedId,
      organization: "0001",
      name,
      birthDate,
      licenseNo,
      serialNo: "",
    },
    tokenResult.data
  );
}

// ─── 건강보험 자격득실 확인 ───────────────────────────────────────────────────
export async function verifyHealthInsurance(
  connectedId: string,
  name: string,
  birthDate: string
): Promise<CodefResult<unknown>> {
  if (isSandbox()) {
    return {
      success: true,
      data: { resInsureGbn: "직장", resCompanyNm: "테스트회사" },
    };
  }

  const tokenResult = await getCodefToken();
  if (!tokenResult.success) return tokenResult;

  return callCodefApi(
    "/v1/kr/public/nhis/health-insurance/insured-status",
    {
      connectedId,
      organization: "0014",
      name,
      birthDate,
    },
    tokenResult.data
  );
}

// ─── 사업자등록 상태조회 ──────────────────────────────────────────────────────
export async function verifyBusiness(bizNo: string): Promise<CodefResult<unknown>> {
  if (isSandbox()) {
    return {
      success: true,
      data: { resBusinessStatus: "01", resBusinessStatusDesc: "계속사업자" },
    };
  }

  const tokenResult = await getCodefToken();
  if (!tokenResult.success) return tokenResult;

  return callCodefApi(
    "/v1/kr/public/ntts/corp/registration-status",
    {
      organization: "0004",
      bizNo,
    },
    tokenResult.data
  );
}
