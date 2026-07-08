/**
 * Codef 회원 간편인증 2-way 실제 데모 스모크 테스트 (수동 실행 전용).
 *
 * 목적: easyauth.ts 의 startEasyAuth/completeEasyAuth 가 실제 데모 서버
 * (https://development.codef.io)에서 도는지, "회원" 전제조건이 무엇인지 검증.
 *
 * 보안: 이름·주민/생년월일·전화번호·PDF 원문은 절대 출력하지 않는다.
 *       성공 여부, 응답 코드, PDF 바이트 수, 문서확인번호 유무만 표시.
 *       테스트 입력은 실행 중 직접 입력받는다(파일에 PII 저장 불필요).
 *
 * 준비:
 *   1) 워크트리 루트에 .env.local (데모 키 CODEF_CLIENT_ID/SECRET 포함) — 이미 복사됨.
 *   2) 실행:  pnpm exec tsx scripts/codef-smoke.ts
 *   3) 프롬프트에 이름·생년월일·휴대폰·간편인증 제공자 입력.
 *   4) 휴대폰 간편인증 앱에서 승인 후 Enter.
 *
 * (선택) 반복 실행 시 .env.local 에 CODEF_SMOKE_NAME/BIRTH/PHONE/PROVIDER 등을
 *        넣어두면 프롬프트를 건너뛴다.
 */
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { startEasyAuth, completeEasyAuth, type EasyAuthInput } from "@/lib/codef/easyauth";
import type { DocType } from "@/lib/codef/doc-types";

function loadEnvLocal(): void {
  let text: string;
  try {
    text = readFileSync(".env.local", "utf8");
  } catch {
    console.error("✗ .env.local 이 없습니다 (데모 키 필요).");
    process.exit(1);
  }
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`✗ ${name} 누락 — .env.local 에 데모 키를 넣으세요.`);
    process.exit(1);
  }
  return v;
}

function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => { rl.close(); resolve(a.trim()); }));
}

/** env 값이 있으면 사용, 없으면 프롬프트. fallback 은 빈 입력 시 기본값. */
async function field(envKey: string, label: string, fallback?: string): Promise<string> {
  const fromEnv = process.env[envKey];
  if (fromEnv) return fromEnv;
  const ans = await ask(`  ${label}${fallback ? ` [${fallback}]` : ""}: `);
  return ans || fallback || "";
}

async function main(): Promise<void> {
  loadEnvLocal();
  required("CODEF_CLIENT_ID");
  required("CODEF_CLIENT_SECRET");

  console.log("\n=== Codef 스모크 테스트 입력 (Enter = 기본값) ===");
  const docType = (await field(
    "CODEF_SMOKE_DOC",
    "문서 (biz_registration_proof / income_proof / income_withholding / vat_taxbase / financial_statements)",
    "biz_registration_proof"
  )) as DocType;
  const userName = await field("CODEF_SMOKE_NAME", "이름");
  // 홈택스 4종 모두 회원 간편인증 본인확인값 = 생년월일 8자리.
  const birthDate = await field("CODEF_SMOKE_BIRTH", "생년월일 YYYYMMDD");
  const phoneNo = await field("CODEF_SMOKE_PHONE", "휴대폰 (- 없이)");
  const loginTypeLevel = await field(
    "CODEF_SMOKE_PROVIDER",
    "간편인증 (1 카카오 / 5 PASS / 6 네이버 / 8 toss)",
    "1"
  );
  const telecom =
    loginTypeLevel === "5"
      ? await field("CODEF_SMOKE_TELECOM", "통신사 (0 SKT / 1 KT / 2 LGU+)", "0")
      : process.env.CODEF_SMOKE_TELECOM;

  // 과세기간: 소득금액=귀속연도(yyyy), 부가세=기수코드(yyyyMM), 재무제표=사업종료년월(yyyyMM).
  let taxStartMonth: string | undefined;
  let taxEndMonth: string | undefined;
  if (docType === "income_proof") {
    taxStartMonth = await field("CODEF_SMOKE_TAX_START", "소득금액 귀속연도(yyyy)", "2025");
    taxEndMonth = await field("CODEF_SMOKE_TAX_END", "소득금액 귀속연도 종료(yyyy)", taxStartMonth);
  } else if (docType === "vat_taxbase") {
    taxStartMonth = await field("CODEF_SMOKE_TAX_START", "부가세 과세기간(yyyyMM, MM=01 1기/07 2기)", "202401");
    taxEndMonth = await field("CODEF_SMOKE_TAX_END", "부가세 과세기간 종료(yyyyMM)", taxStartMonth);
  } else if (docType === "financial_statements") {
    taxStartMonth = await field("CODEF_SMOKE_TAX_START", "재무제표 사업종료년월(yyyyMM)", "202312");
  }

  if (!userName || !phoneNo || !birthDate) {
    console.error("✗ 이름·휴대폰·생년월일은 필수입니다.");
    process.exit(1);
  }

  const input: EasyAuthInput = {
    docType,
    userName,
    birthDate,
    phoneNo,
    loginTypeLevel,
    telecom,
    id: "smoke-" + docType,
    taxStartMonth,
    taxEndMonth,
  };

  console.log(`\n[1/2] startEasyAuth — ${docType} (loginType=5, provider=${loginTypeLevel})`);
  const start = await startEasyAuth(input);

  if (start.kind === "error") {
    console.error(`✗ 1차 실패 [${start.code ?? "-"}]: ${start.error}`);
    process.exit(1);
  }
  console.log("✓ 추가인증 요청됨(CF-03002). twoWayInfo 수신.");
  console.log("  → 지금 휴대폰 간편인증 앱에서 인증을 완료하세요. (타임아웃 4분 30초)");
  await ask("  인증을 완료했으면 Enter ▶ ");

  console.log("[2/2] completeEasyAuth …");
  const done = await completeEasyAuth(input, start.twoWayInfo);

  if (!done.success) {
    console.error(`✗ 2차 실패 [${done.code ?? "-"}]: ${done.error}`);
    process.exit(1);
  }
  const bytes = done.pdfBase64 ? Buffer.from(done.pdfBase64, "base64").length : 0;
  console.log("✓ 발급 성공 (CF-00000)");
  console.log(`  PDF: ${bytes > 0 ? `${bytes.toLocaleString()} bytes` : "없음(원본 미수신)"}`);
  console.log(`  문서확인번호: ${done.docVerifyNo ? "수신됨" : "없음"}`);
}

main().catch((e) => {
  console.error("✗ 예외:", e instanceof Error ? e.message : e);
  process.exit(1);
});
