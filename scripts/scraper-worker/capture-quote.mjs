import puppeteer from "puppeteer";
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { appendFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

/**
 * 사용자가 직접 견적을 끝까지(계산하기까지) 진행하는 동안 모든 내부 .act POST 를
 * 캡처해 파일로 적재한다. 헤드풀 브라우저는 로그인·견적페이지까지 자동 진입 후 대기.
 *   node scripts/scraper-worker/capture-quote.mjs
 * 캡처 파일: %TEMP%/orix-capture.jsonl  (계산하기 클릭 시의 calc API 가 여기 기록됨)
 */
const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, ".env") });
const USER = process.env.SCRAPER_TEST_USER, PASS = process.env.SCRAPER_TEST_PASS;
const EXE = process.env.PUPPETEER_EXECUTABLE_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!USER || !PASS) { console.error("자격증명 없음(.env)"); process.exit(1); }

const OUT = join(tmpdir(), "orix-capture.jsonl");
writeFileSync(OUT, ""); // 새 세션 시작 — 비우기

const browser = await puppeteer.launch({
  headless: false,
  executablePath: EXE,
  defaultViewport: null,
  args: ["--start-maximized", "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
});
const page = (await browser.pages())[0] || (await browser.newPage());

// 사용자 클릭 흐름을 막지 않도록: 네이티브 다이얼로그는 자동 수락
page.on("dialog", async (d) => { try { console.log(`[dialog] ${d.type()}: ${d.message().slice(0, 60)}`); await d.accept(); } catch {} });

let n = 0;
page.on("requestfinished", async (req) => {
  try {
    if (req.method() !== "POST" || !/\.act(\?|$)/.test(req.url())) return;
    let resp = "";
    try { const r = req.response(); resp = r ? (await r.text()).slice(0, 6000) : ""; } catch {}
    const payload = (req.postData() || "").slice(0, 3000);
    let tx = "";
    try { tx = JSON.parse(req.postData() || "{}").txGbCd || ""; } catch {}
    const rec = { t: new Date().toISOString().slice(11, 19), path: req.url().replace(/^https?:\/\/[^/]+/, ""), txGbCd: tx, payload, resp };
    appendFileSync(OUT, JSON.stringify(rec) + "\n");
    // 비밀번호가 들어가는 LOGIN 페이로드는 마커에서 가린다
    console.log(`[${++n}] ${rec.t}  ${rec.path}  ${tx}${/렌트료|월납|MONTH|RENT|FEE|CALC|월정액/i.test(resp) ? "  ← 금액 응답 가능성" : ""}`);
  } catch {}
});

// 자동 로그인 + 견적 페이지 진입
await page.goto("https://nf.orix.co.kr/com/login.frm", { waitUntil: "networkidle2", timeout: 45000 });
await page.waitForSelector("#usrId");
await page.type("#usrId", USER, { delay: 40 });
await page.type("#usrPw", PASS, { delay: 40 });
await Promise.all([page.click("#login"), page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => null)]);
await sleep(1500);
await page.evaluate(() => window.goPageMenu && window.goPageMenu("/sit/sit0001.frm"));
await sleep(2500);

console.log("\n========================================================");
console.log("준비 완료. 이 창에서 직접 견적을 끝까지 진행하세요:");
console.log("  브랜드→모델→세부차종→트림→외장/내장 색상→고객/출고/탁송→[계산하기]");
console.log("월납입금이 표시되면 끝. 모든 .act 호출이 아래 파일에 적재됩니다:");
console.log("  " + OUT);
console.log("끝나면 채팅창에 '완료'라고 알려주세요.");
console.log("========================================================\n");

// 프로세스 유지(브라우저 열어둠)
setInterval(() => {}, 1 << 30);
