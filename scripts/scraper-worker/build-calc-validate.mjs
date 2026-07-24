import puppeteer from "puppeteer";
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";

/** 캡처된 그랜저 견적으로 '금액 공식'이 월납입금을 재현하는지 검증.
 *  비-금액 파라미터는 캡처 템플릿 사용, 금액(LOAD_AMT/lsAmount/notRvAmt/ADDON_SPEND_W/NOT_WRNT_RV)은
 *  공식+API 로 새로 계산해 덮어쓴 뒤 CAL_LSRYOW 결과를 캡처 정답과 대조. */
const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, ".env") });
const USER = process.env.SCRAPER_TEST_USER, PASS = process.env.SCRAPER_TEST_PASS;
const EXE = process.env.PUPPETEER_EXECUTABLE_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ceil10 = (n) => Math.ceil(n / 10) * 10;

const cap = readFileSync(join(tmpdir(), "orix-capture.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
const tmpl = JSON.parse(cap.find((r) => r.txGbCd === "CAL_LSRYOW").payload); // 그랜저 36개월 템플릿
const expected = {}; // 기간 → 정답 LSRYO
for (const r of cap.filter((r) => r.txGbCd === "CAL_LSRYOW")) { const p = JSON.parse(r.payload); expected[p.LEASE_KIKAN] = JSON.parse(r.resp).LSRYO; }

const CAR_AMT = 52490000, CAR_COR = 200000;
const CAR_TOTAL = CAR_AMT + CAR_COR; // 52,690,000
const MDEL_CD = "000025731";

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
  const api = (b) => page.evaluate(async (body) => { const r = await fetch("/SIT0001.act", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); return JSON.parse(await r.text()); }, b);

  // 1) LOAD_AMT (공급가 AMT_KUBUN=1 → 10원 올림)
  const sup = await api({ txGbCd: "GET_SUPPLAYAMT", LS_GOOD_KUBUN: "CF100006", MDEL_CD, SHIPMENT_KUBUN: "LI260002", CAR_AMT: String(CAR_AMT), OPTION_AMT: "0", CAR_COR_AMT: String(CAR_COR), MAKER_TAK_AMT: "0", DIS_AMT_PER: "0", DIS_AMT: "0", KIRATE: "1.15863", AMT_KUBUN: "1" });
  const LOAD_AMT = ceil10(Number(sup.LOAD_AMT));
  // 2) 개소세 / 취득세
  const spc = await api({ txGbCd: "SPECIFIC_TAX_CAL", SHIPMENT_KUBUN: "LI260002", MDEL_CD, LOAD_AMT: String(CAR_TOTAL), DIS_PER: "0", DIS_AMT: "0", LS_WORK_KUBUN: "CF100006", LS_GOOD_CODE: "0051" });
  const SPECIFIC_TAX = Number(spc.SPECIFIC_TAX);
  const reg = await api({ txGbCd: "REG_TAX_CAL", LOAD_AMT: String(LOAD_AMT), MDEL_CD, SHIPMENT_KUBUN: "LI260002", MAKER_NO: "", LS_GOOD_CLASS: "CF200009", MAKER_TAK_AMT: "0" });
  const GET_TAX = Number(reg.GET_TAX);
  // 3) 잔존율(2만km)
  const rv = await api({ txGbCd: "SEL_RV_LIST", LS_WORK_KUBUN: "CF100006", SHIPMENT_KUBUN: "LI260002", IMPDOM_KUBUN: "CK120002", MDEL_CD, RV_RANK: "2", OPER_RV_KUBUN: "WS200004", ADJ_RV_KUBUN: "WS200004", STD_RV_KUBUN: "RT200002" });
  const rvBy = {}; for (const r of rv.LIST) if (String(r.MT_DIST) === "20000") rvBy[r.KIKAN] = Number(r.RV_RATE);

  const lsAmount = LOAD_AMT + GET_TAX + 65000;
  console.log(`계산값: LOAD_AMT=${LOAD_AMT}(정답 45476130)  개소세=${SPECIFIC_TAX}(786710)  취득세=${GET_TAX}(1819040)  lsAmount=${lsAmount}(47360170)\n`);

  for (const K of [36, 48, 60]) {
    const rate = rvBy[K];
    const notRvAmt = Math.round((CAR_TOTAL / 1.1) * (rate / 100));
    const ADDON_SPEND_W = ceil10(SPECIFIC_TAX / K);
    const payload = { ...tmpl, LEASE_KIKAN: String(K), MT_DIST: "LH120002", LOAD_AMT: String(LOAD_AMT), lsAmount: String(lsAmount), notRvAmt: String(notRvAmt), NOT_WRNT_RV: String(rate), ADDON_SPEND_W: String(ADDON_SPEND_W) };
    const res = await api(payload);
    const got = res.LSRYO, exp = expected[K];
    console.log(`${K}개월 잔존율 ${rate}%  notRvAmt=${notRvAmt}  ADDON_SPEND_W=${ADDON_SPEND_W}  →  월납입금 ${got}  (정답 ${exp})  ${String(got) === String(exp) ? "✅" : "❌ 차이 " + (got - exp)}`);
    await sleep(300);
  }
} catch (e) { console.error("[실패]", e.message); }
finally { await browser.close().catch(() => null); }
