// 셋업 점검 — 워커를 처음 띄우는 PC 에서 무엇이 빠졌는지 한 번에 알려준다.
//   pnpm scraper:doctor
//
// 실제 job 을 가져오지 않으므로 아무 때나 안전하게 돌릴 수 있다.
import "./load-env";

import { existsSync } from "node:fs";
import { keyFingerprint } from "../../src/lib/scraper/key-fingerprint";
import { WORKER_PROTOCOL_VERSION } from "../../src/lib/scraper/worker-version";

type Result = { ok: boolean; label: string; detail: string; fix?: string };

async function collect(): Promise<Result[]> {
  const BASE = process.env.WORKER_API_BASE?.trim() ?? "";
  const SECRET = process.env.SCRAPER_WORKER_SECRET?.trim() ?? "";
  const PII_KEY = process.env.PII_ENCRYPTION_KEY?.trim() ?? "";

  const results: Result[] = [];
  const pass = (label: string, detail: string) => results.push({ ok: true, label, detail });
  const fail = (label: string, detail: string, fix: string) =>
    results.push({ ok: false, label, detail, fix });

  // ── 1. 필수 환경변수 ──────────────────────────────────────
  if (!BASE) {
    fail("WORKER_API_BASE", "미설정", "scripts/scraper-worker/.env 에 백엔드 주소를 넣으세요. 로컬이면 http://localhost:3000");
  } else {
    pass("WORKER_API_BASE", BASE);
  }

  if (!SECRET) {
    fail("SCRAPER_WORKER_SECRET", "미설정", "백엔드 .env 의 SCRAPER_WORKER_SECRET 과 같은 값을 넣으세요.");
  } else {
    pass("SCRAPER_WORKER_SECRET", `설정됨 (${SECRET.length}자)`);
  }

  const localFingerprint = keyFingerprint(PII_KEY);
  if (!PII_KEY) {
    fail("PII_ENCRYPTION_KEY", "미설정", "백엔드 .env 의 PII_ENCRYPTION_KEY 와 반드시 같은 값을 넣으세요.");
  } else if (!localFingerprint) {
    fail("PII_ENCRYPTION_KEY", "base64 로 해석할 수 없음", "값을 그대로 복사했는지 확인하세요(따옴표·줄바꿈이 섞이면 안 됩니다).");
  } else {
    pass("PII_ENCRYPTION_KEY", `설정됨 (지문 ${localFingerprint})`);
  }

  // ── 2. 브라우저 ──────────────────────────────────────────
  const execPath = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  if (execPath) {
    if (existsSync(execPath)) {
      pass("Chromium", `시스템 브라우저 사용: ${execPath}`);
    } else {
      fail("Chromium", `경로에 파일이 없음: ${execPath}`, "PUPPETEER_EXECUTABLE_PATH 를 실제 chrome.exe / msedge.exe 경로로 고치세요.");
    }
  } else {
    let bundled: string | null = null;
    try {
      const puppeteer = (await import("puppeteer")).default as { executablePath?: () => string };
      bundled = puppeteer.executablePath?.() ?? null;
    } catch {
      bundled = null;
    }
    if (bundled && existsSync(bundled)) {
      pass("Chromium", `번들 Chromium 사용: ${bundled}`);
    } else {
      fail(
        "Chromium",
        "번들 Chromium 이 없고 PUPPETEER_EXECUTABLE_PATH 도 비어 있음",
        "둘 중 하나: (a) .env 에 PUPPETEER_EXECUTABLE_PATH 로 설치된 Chrome/Edge 경로 지정, " +
          "(b) pnpm-workspace.yaml 의 puppeteer:false → true 후 pnpm install"
      );
    }
  }

  // ── 3. 백엔드 연결 + 시크릿 + 키 일치 ─────────────────────
  if (!BASE || !SECRET) return results;

  const url = `${BASE.replace(/\/+$/, "")}/api/worker/preflight`;
  try {
    const res = await fetch(url, { headers: { authorization: `Bearer ${SECRET}` } });

    if (res.status === 401) {
      fail("백엔드 인증", "401 Unauthorized", "SCRAPER_WORKER_SECRET 이 백엔드 값과 다릅니다.");
      return results;
    }
    if (res.status === 404) {
      fail("백엔드 연결", "404 — preflight 라우트 없음", "백엔드가 이 기능이 포함된 버전인지 확인하세요(배포 필요).");
      return results;
    }
    if (!res.ok) {
      fail("백엔드 연결", `HTTP ${res.status}`, "백엔드 로그를 확인하세요.");
      return results;
    }

    const body = (await res.json()) as {
      keyFingerprint: string | null;
      expectedWorkerVersion?: number;
    };
    pass("백엔드 연결", `${url} 응답 정상`);

    if (body.expectedWorkerVersion === undefined) {
      pass("프로그램 버전", `v${WORKER_PROTOCOL_VERSION} (서버가 버전을 알리지 않음)`);
    } else if (body.expectedWorkerVersion === WORKER_PROTOCOL_VERSION) {
      pass("프로그램 버전", `v${WORKER_PROTOCOL_VERSION} 일치`);
    } else {
      fail(
        "프로그램 버전",
        `이 프로그램 v${WORKER_PROTOCOL_VERSION} ≠ 서버 요구 v${body.expectedWorkerVersion}`,
        "개발 담당자에게 최신 파일을 받아 다시 설치하세요. 접속 정보는 유지됩니다."
      );
    }

    if (!body.keyFingerprint) {
      fail("암호화 키 일치", "백엔드에 PII_ENCRYPTION_KEY 가 없음", "백엔드(Vercel 또는 로컬 .env)에 키를 설정하세요.");
    } else if (localFingerprint && body.keyFingerprint === localFingerprint) {
      pass("암호화 키 일치", `지문 ${localFingerprint} 일치`);
    } else if (localFingerprint) {
      fail(
        "암호화 키 일치",
        `워커 ${localFingerprint} ≠ 백엔드 ${body.keyFingerprint}`,
        "키가 다릅니다. 이대로 두면 job 을 받아도 '자격증명 복호화 실패'로 끝납니다. " +
          "백엔드의 PII_ENCRYPTION_KEY 를 그대로 복사해 넣으세요."
      );
    }
  } catch (error) {
    fail(
      "백엔드 연결",
      error instanceof Error ? error.message : "알 수 없는 오류",
      `${BASE} 에 접속할 수 없습니다. 백엔드가 떠 있는지, 주소가 맞는지 확인하세요.`
    );
  }

  return results;
}

async function main(): Promise<void> {
  const results = await collect();

  console.log("\n스크래퍼 워커 셋업 점검\n" + "─".repeat(62));
  for (const r of results) {
    console.log(`${r.ok ? "  OK  " : " 실패 "} ${r.label.padEnd(22)} ${r.detail}`);
    if (!r.ok) console.log(`       ↳ ${r.fix}`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log("─".repeat(62));
  if (failed.length === 0) {
    console.log("모두 통과. `pnpm scraper:worker` 로 실행하세요.\n");
    return;
  }
  console.log(`${failed.length}건을 먼저 해결하세요.\n`);
  process.exitCode = 1;
}

main().catch((e) => {
  console.error("[doctor] 점검 중 오류:", e);
  process.exit(1);
});
