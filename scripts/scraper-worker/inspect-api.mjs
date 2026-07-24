import puppeteer from "puppeteer";
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

/**
 * 견적 cascade 를 구동하는 내부 함수(getBrandCd 등)의 JS 소스를 추출해
 * /SIT0001.act 의 txGbCd 체인·파라미터를 확정한다. + 헤드리스 fetch 리플레이 검증.
 *   node scripts/scraper-worker/inspect-api.mjs
 */
const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, ".env") });
const USER = process.env.SCRAPER_TEST_USER;
const PASS = process.env.SCRAPER_TEST_PASS;
const EXE = process.env.PUPPETEER_EXECUTABLE_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!USER || !PASS) { console.error("자격증명 없음"); process.exit(1); }

const browser = await puppeteer.launch({
  headless: true, executablePath: EXE,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
});
try {
  const page = await browser.newPage();
  await page.goto("https://nf.orix.co.kr/com/login.frm", { waitUntil: "networkidle2", timeout: 45000 });
  await page.waitForSelector("#usrId", { timeout: 15000 });
  await page.type("#usrId", USER, { delay: 40 });
  await page.type("#usrPw", PASS, { delay: 40 });
  await Promise.all([page.click("#login"), page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }).catch(() => null)]);
  await sleep(1500);
  await page.evaluate(() => window.goPageMenu && window.goPageMenu("/sit/sit0001.frm"));
  await sleep(3500);
  console.log("견적:", page.url());

  // 1) cascade 관련 전역 함수 소스 추출
  const fns = await page.evaluate(() => {
    const names = Object.getOwnPropertyNames(window).filter((n) => {
      try { return typeof window[n] === "function"; } catch { return false; }
    });
    const want = names.filter((n) => /brand|model|car|trim|color|combo|calc|getCar|rvRate|jandun|estimat|payment/i.test(n));
    const out = {};
    for (const n of want) {
      try {
        const s = String(window[n]);
        if (/SIT0001|CAR_COMBO|txGbCd|ajax|fetch|MDL_CD|TRIM/i.test(s)) out[n] = s.replace(/\s+/g, " ").slice(0, 700);
      } catch {}
    }
    return out;
  });
  console.log("\n=== cascade 관련 함수 소스 ===");
  for (const [n, s] of Object.entries(fns)) console.log(`\n• ${n}\n  ${s}`);

  // 2) 공통 ajax 래퍼 추출 (callAjax / fn_ajax 등)
  const ajaxFns = await page.evaluate(() => {
    const names = Object.getOwnPropertyNames(window).filter((n) => { try { return typeof window[n] === "function"; } catch { return false; } });
    const want = names.filter((n) => /ajax|callAct|fn_|comAjax|request|send/i.test(n));
    const out = {};
    for (const n of want) { try { const s = String(window[n]); if (/\.act|ajax|XMLHttp|fetch/i.test(s)) out[n] = s.replace(/\s+/g, " ").slice(0, 500); } catch {} }
    return out;
  });
  console.log("\n=== ajax 래퍼 후보 ===");
  for (const [n, s] of Object.entries(ajaxFns)) console.log(`\n• ${n}\n  ${s}`);

  // 3) 헤드리스 fetch 리플레이: CAR_COMBO_1 (기아) 직접 호출 가능?
  const replay = await page.evaluate(async () => {
    try {
      const res = await fetch("/SIT0001.act", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txGbCd: "CAR_COMBO_1", LS_WORK_KUBUN: "CF100006", BRAND_CD: "CA100002", PRE_ADC_YN: "N" }),
      });
      const txt = await res.text();
      return { status: res.status, body: txt.slice(0, 400) };
    } catch (e) { return { error: String(e) }; }
  });
  console.log("\n=== fetch 리플레이 (CAR_COMBO_1) ===");
  console.log(JSON.stringify(replay).slice(0, 600));

  // 4) 모델 그룹 렌더링 구조 (모델 선택 UI 방식 확인)
  await page.evaluate((c) => window.getBrandCd && window.getBrandCd(c), "CA100002");
  await sleep(2000);
  const modelHtml = await page.evaluate(() => {
    const groups = Array.from(document.querySelectorAll(".choose-group"));
    const g = groups.find((x) => /모델/.test(x.querySelector("h4,h3")?.textContent || ""));
    return g ? g.innerHTML.replace(/\s+/g, " ").slice(0, 1500) : "(모델 그룹 못 찾음)";
  });
  console.log("\n=== 모델 그룹 innerHTML (getBrandCd 후) ===");
  console.log(modelHtml);

  writeFileSync(join(tmpdir(), "orix-fns.json"), JSON.stringify({ fns, ajaxFns, replay }, null, 2), "utf8");
  console.log("\n저장:", join(tmpdir(), "orix-fns.json"));
} catch (e) {
  console.error("\n[실패]", e.message);
} finally {
  await browser.close().catch(() => null);
}
