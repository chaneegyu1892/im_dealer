/**
 * Codef 회원 간편인증 2-way 실제 데모 스모크 테스트 (수동 실행 전용).
 *
 * 목적: easyauth.ts 의 startEasyAuth/completeEasyAuth 가 실제 데모 서버
 * (https://development.codef.io)에서 도는지, "회원" 전제조건이 무엇인지 검증.
 *
 * 보안: 이름·주민/생년월일·전화번호·PDF 원문은 절대 출력하지 않는다.
 *       성공 여부, 응답 코드, PDF 바이트 수, 문서확인번호 유무만 표시.
 *
 * 준비:
 *   1) 워크트리 루트에 .env.local 복사 (데모 키 포함):
 *        cp /Users/jinkyu/im_dealer/.env.local .env.local
 *   2) .env.local 에 테스트 입력값 추가(.env.local 은 git 무시됨):
 *        CODEF_SMOKE_DOC=resident_register   # 또는 biz_registration_proof / income_proof
 *        CODEF_SMOKE_NAME=홍길동
 *        CODEF_SMOKE_BIRTH=19900101          # YYYYMMDD
 *        CODEF_SMOKE_PHONE=01012345678
 *        CODEF_SMOKE_PROVIDER=1              # 1 카카오, 5 PASS(통신사), 6 네이버, 8 toss
 *        CODEF_SMOKE_TELECOM=0              # PROVIDER=5 일 때만: 0 SKT, 1 KT, 2 LGU+
 *        CODEF_SMOKE_START_YEAR=2023        # income_proof 일 때만
 *        CODEF_SMOKE_END_YEAR=2024          # income_proof 일 때만
 *   3) 실행:  pnpm exec tsx scripts/codef-smoke.ts
 *   4) 휴대폰 간편인증 앱에서 승인 후, 터미널에서 Enter.
 */
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { startEasyAuth, completeEasyAuth, type EasyAuthInput } from "@/lib/codef/easyauth";
import type { DocType } from "@/lib/codef/doc-types";

// ─── .env.local 수동 로드 (의존성 없이) ──────────────────────────────
function loadEnvLocal(): void {
  let text: string;
  try {
    text = readFileSync(".env.local", "utf8");
  } catch {
    console.error("✗ .env.local 이 없습니다. 준비 1) 단계를 먼저 수행하세요.");
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
    console.error(`✗ ${name} 누락 — .env.local 에 추가하세요.`);
    process.exit(1);
  }
  return v;
}

function prompt(question: string): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, () => { rl.close(); resolve(); }));
}

async function main(): Promise<void> {
  loadEnvLocal();
  required("CODEF_CLIENT_ID");
  required("CODEF_CLIENT_SECRET");

  const docType = (process.env.CODEF_SMOKE_DOC ?? "resident_register") as DocType;
  const input: EasyAuthInput = {
    docType,
    userName: required("CODEF_SMOKE_NAME"),
    birthDate: required("CODEF_SMOKE_BIRTH"),
    phoneNo: required("CODEF_SMOKE_PHONE"),
    loginTypeLevel: process.env.CODEF_SMOKE_PROVIDER ?? "1",
    telecom: process.env.CODEF_SMOKE_TELECOM,
    id: "smoke-" + docType,
    startYear: process.env.CODEF_SMOKE_START_YEAR,
    endYear: process.env.CODEF_SMOKE_END_YEAR,
  };

  console.log(`\n[1/2] startEasyAuth — ${docType} (loginType=5, provider=${input.loginTypeLevel})`);
  const start = await startEasyAuth(input);

  if (start.kind === "error") {
    console.error(`✗ 1차 실패 [${start.code ?? "-"}]: ${start.error}`);
    process.exit(1);
  }
  console.log("✓ 추가인증 요청됨(CF-03002). twoWayInfo 수신.");
  console.log("  → 지금 휴대폰 간편인증 앱에서 인증을 완료하세요. (타임아웃 4분 30초)");
  await prompt("  인증을 완료했으면 Enter ▶ ");

  console.log(`[2/2] completeEasyAuth …`);
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
