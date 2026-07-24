import puppeteer from "puppeteer";
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
loadEnv({ path: join(dirname(fileURLToPath(import.meta.url)), ".env") });
const USER = process.env.SCRAPER_TEST_USER, PASS = process.env.SCRAPER_TEST_PASS;
const EXE = process.env.PUPPETEER_EXECUTABLE_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TARGET = 45476130; // CAL_LSRYOW 의 LOAD_AMT

const browser = await puppeteer.launch({ headless: true, executablePath: EXE, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
try {
  const page = await browser.newPage();
  await page.goto("https://nf.orix.co.kr/com/login.frm", { waitUntil: "networkidle2", timeout: 45000 });
  await page.waitForSelector("#usrId");
  await page.type("#usrId", USER, { delay: 40 }); await page.type("#usrPw", PASS, { delay: 40 });
  await Promise.all([page.click("#login"), page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => null)]);
  await sleep(1200);
  await page.evaluate(() => window.goPageMenu && window.goPageMenu("/sit/sit0001.frm"));
  await sleep(2000);

  const api = (b) => page.evaluate(async (body) => {
    const r = await fetch("/SIT0001.act", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return JSON.parse(await r.text());
  }, b);

  const base = { txGbCd: "GET_SUPPLAYAMT", LS_GOOD_KUBUN: "CF100006", MDEL_CD: "000025731", SHIPMENT_KUBUN: "LI260002", CAR_AMT: "52490000", OPTION_AMT: "0", CAR_COR_AMT: "200000", MAKER_TAK_AMT: "0", DIS_AMT_PER: "0", DIS_AMT: "0", KIRATE: "1.15863" };
  console.log(`목표 LOAD_AMT = ${TARGET}\n`);
  for (const k of ["1", "2", "3", "4", "0"]) {
    const r = await api({ ...base, AMT_KUBUN: k });
    const hit = String(r.LOAD_AMT) === String(TARGET) || String(r.SUPPLAYAMT) === String(TARGET);
    console.log(`AMT_KUBUN=${k}  SUPPLAYAMT=${r.SUPPLAYAMT}  LOAD_AMT=${r.LOAD_AMT}  ${hit ? "★ 목표 일치!" : ""}`);
    await sleep(300);
  }
  // LS_GOOD_CODE 변형도(공급가가 상품코드 의존일 수 있음)
  const r2 = await api({ ...base, AMT_KUBUN: "2", LS_GOOD_CODE: "0051" });
  console.log(`\n(LS_GOOD_CODE=0051 추가) SUPPLAYAMT=${r2.SUPPLAYAMT} LOAD_AMT=${r2.LOAD_AMT}`);
} catch (e) { console.error("[실패]", e.message); }
finally { await browser.close().catch(() => null); }
