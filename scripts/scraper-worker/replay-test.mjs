import puppeteer from "puppeteer";
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";

/** 캡처된 CAL_LSRYOW 페이로드를 그대로 재전송해 월납입금(LSRYO) 재현 여부 검증. */
const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, ".env") });
const USER = process.env.SCRAPER_TEST_USER, PASS = process.env.SCRAPER_TEST_PASS;
const EXE = process.env.PUPPETEER_EXECUTABLE_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const cap = readFileSync(join(tmpdir(), "orix-capture.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
const calcs = cap.filter((r) => r.txGbCd === "CAL_LSRYOW");
console.log(`캡처된 CAL_LSRYOW: ${calcs.length}건`);

const browser = await puppeteer.launch({ headless: true, executablePath: EXE, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
try {
  const page = await browser.newPage();
  await page.goto("https://nf.orix.co.kr/com/login.frm", { waitUntil: "networkidle2", timeout: 45000 });
  await page.waitForSelector("#usrId");
  await page.type("#usrId", USER, { delay: 40 });
  await page.type("#usrPw", PASS, { delay: 40 });
  await Promise.all([page.click("#login"), page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => null)]);
  await sleep(1200);
  await page.evaluate(() => window.goPageMenu && window.goPageMenu("/sit/sit0001.frm"));
  await sleep(2000);

  for (const c of calcs) {
    const payload = JSON.parse(c.payload);
    const expected = JSON.parse(c.resp).LSRYO;
    const got = await page.evaluate(async (body) => {
      const res = await fetch("/SIT0001.act", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      return JSON.parse(await res.text()).LSRYO;
    }, payload);
    const ok = String(got) === String(expected);
    console.log(`  ${payload.LEASE_KIKAN}개월 잔존율 ${payload.NOT_WRNT_RV}%  기대 ${expected}  →  리플레이 ${got}  ${ok ? "✅ 일치" : "❌ 불일치"}`);
    await sleep(400);
  }
} catch (e) { console.error("[실패]", e.message); }
finally { await browser.close().catch(() => null); }
