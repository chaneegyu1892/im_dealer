import puppeteer from "puppeteer";
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

/**
 * 오릭스 렌터카 월납입금 + 우리 회수율(=월납입금/차량가)을 트림×(기간·거리) 매트릭스로 수집.
 * CAL_LSRYOW 금액 공식은 build-calc-validate.mjs 로 그랜저 정답 재현 검증 완료.
 *   LIMIT_TRIM=2 node scripts/scraper-worker/scrape-monthly.mjs   # 데모(기본)
 *   LIMIT_TRIM=999 node ...                                       # 쏘렌토 전체
 * 가격무관 조건은 고정: 정비제외(0051)/개인/대리점출고(LI260002)/표준보험.
 */
const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, ".env") });
const USER = process.env.SCRAPER_TEST_USER, PASS = process.env.SCRAPER_TEST_PASS;
const EXE = process.env.PUPPETEER_EXECUTABLE_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ceil10 = (n) => Math.ceil(n / 10) * 10;
const LIMIT_TRIM = Number(process.env.LIMIT_TRIM ?? 2);

const LS_WORK = "CF100006", SHIPMENT = "LI260002", BRAND_KIA = "CA100002", MODEL = "쏘렌토";
const MT_DIST_CODE = { 10000: "LH120001", 20000: "LH120002", 30000: "LH120003" };
const KIKANS = [36, 48, 60], DISTS = [10000, 20000, 30000];
// CAL_LSRYOW 비-금액 상수(캡처 확정) — 표준 보험/상품 설정
const CONST = { CF_PRI_KUBUN: "DA110001", DRIVE_SPEC: "RT140026", INSU_SPEC_KUBUN: "N", SPC_KUBUN: "RT130004",
  LS_GOOD_CODE: "0051", LS_GOOD_CLASS: "CF200009", MT_CODE: "014", SHIPMENT_KUBUN: SHIPMENT,
  ADDON_TST_FEE: "2600", ADDON_EN_IMP_CHARGE: "0", ADDON_PARK: "0", JAGI_CAR_RANGE: "", PAYMENT_PER: "0", LS_WORK_KUBUN: LS_WORK };

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

  const subs = (await api({ txGbCd: "CAR_COMBO_2", LS_WORK_KUBUN: LS_WORK, BRAND_CD: BRAND_KIA, MDL_CD: MODEL, PRE_ADC_YN: "N" })).LIST || [];
  const out = { brand: "기아", model: MODEL, conditions: "정비제외/개인/대리점출고/색상0", scrapedAt: new Date().toISOString(), trims: [] };
  let count = 0;

  for (const sub of subs) {
    const trims = (await api({ txGbCd: "CAR_COMBO_3", LS_WORK_KUBUN: LS_WORK, BRAND_CD: BRAND_KIA, DT_MDL_CD: sub.DT_MDL_CD, PRE_ADC_YN: "N" })).LIST || [];
    for (const t of trims) {
      if (count++ >= LIMIT_TRIM) break;
      const carAmt = Number(t.MDEL_PRICE), carTotal = carAmt; // 기본색상(0원)
      // 차량 단위 금액(기간·거리 무관)
      const sup = await api({ txGbCd: "GET_SUPPLAYAMT", LS_GOOD_KUBUN: LS_WORK, MDEL_CD: t.MDEL_CD, SHIPMENT_KUBUN: SHIPMENT, CAR_AMT: String(carAmt), OPTION_AMT: "0", CAR_COR_AMT: "0", MAKER_TAK_AMT: "0", DIS_AMT_PER: "0", DIS_AMT: "0", KIRATE: t.KIRATE_2015, AMT_KUBUN: "1" });
      const LOAD_AMT = ceil10(Number(sup.LOAD_AMT));
      const SPECIFIC_TAX = Number((await api({ txGbCd: "SPECIFIC_TAX_CAL", SHIPMENT_KUBUN: SHIPMENT, MDEL_CD: t.MDEL_CD, LOAD_AMT: String(carTotal), DIS_PER: "0", DIS_AMT: "0", LS_WORK_KUBUN: LS_WORK, LS_GOOD_CODE: "0051" })).SPECIFIC_TAX);
      const GET_TAX = Number((await api({ txGbCd: "REG_TAX_CAL", LOAD_AMT: String(LOAD_AMT), MDEL_CD: t.MDEL_CD, SHIPMENT_KUBUN: SHIPMENT, MAKER_NO: "", LS_GOOD_CLASS: "CF200009", MAKER_TAK_AMT: "0" })).GET_TAX);
      const lsAmount = LOAD_AMT + GET_TAX + 65000;
      const rvRes = await api({ txGbCd: "SEL_RV_LIST", LS_WORK_KUBUN: LS_WORK, SHIPMENT_KUBUN: SHIPMENT, IMPDOM_KUBUN: t.IMPDOM_KUBUN, MDEL_CD: t.MDEL_CD, RV_RANK: t.RV_RANK, OPER_RV_KUBUN: t.OPER_RV_KUBUN, ADJ_RV_KUBUN: t.ADJ_RV_KUBUN, STD_RV_KUBUN: t.STD_RV_KUBUN });
      const rvBy = {}; for (const r of rvRes.LIST || []) rvBy[`${r.KIKAN}_${r.MT_DIST}`] = Number(r.RV_RATE);

      // 자동차세(영업용 승용): 배기량×(≤1600 ? 18 : 19)/12, 10원 올림. 두 차종 정답 일치.
      const disp = Number(t.DISPLACEMENT);
      const ADDON_CAR_TAX = ceil10((disp * (disp <= 1600 ? 18 : 19)) / 12);

      const monthly = {}, recovery = {};
      for (const K of KIKANS) for (const D of DISTS) {
        const rate = rvBy[`${K}_${D}`]; if (rate == null) continue;
        // notRvAmt = 공급가(총차량가/1.1) × 잔존율, 천원 올림(ceil)
        const notRvAmt = Math.ceil((carTotal / 1.1) * (rate / 100) / 1000) * 1000;
        const payload = { txGbCd: "CAL_LSRYOW", CAR_INSU_KUBUN: t.CAR_INSU_KUBUN, CAR_MT_KUBUN: t.CAR_MT_KUBUN, RT_MT_RATE: t.RT_MT_RATE, RT_SELF_CAR_RATE: t.RT_SELF_CAR_RATE, OPER_RV_KUBUN: t.OPER_RV_KUBUN, IMPDOM_KUBUN: t.IMPDOM_KUBUN, MDEL_CD: t.MDEL_CD, ...CONST,
          LEASE_KIKAN: String(K), MT_DIST: MT_DIST_CODE[D], LOAD_AMT: String(LOAD_AMT), lsAmount: String(lsAmount), notRvAmt: String(notRvAmt), NOT_WRNT_RV: String(rate), ADDON_SPEND_W: String(ceil10(SPECIFIC_TAX / K)), ADDON_CAR_TAX: String(ADDON_CAR_TAX) };
        const res = await api(payload);
        const ls = Number(res.LSRYO);
        if (ls > 0) { monthly[`${K}_${D}`] = ls; recovery[`${K}_${D}`] = Math.round((ls / carAmt) * 100000) / 100000; }
        await sleep(120);
      }
      out.trims.push({ trimName: t.MDEL_NAME2, carCd: t.CAR_CD, price: carAmt, monthly, recovery });
      const g = (k) => monthly[k] ? monthly[k].toLocaleString() : "-";
      console.log(`· ${t.MDEL_NAME2}  ${carAmt.toLocaleString()}원`);
      console.log(`    월납입금(2만km) 36→${g("36_20000")} 48→${g("48_20000")} 60→${g("60_20000")}  | 회수율 36→${recovery["36_20000"]}`);
    }
    if (count >= LIMIT_TRIM) break;
  }
  const file = join(tmpdir(), "orix-sorento-monthly.json");
  writeFileSync(file, JSON.stringify(out, null, 2), "utf8");
  console.log(`\n수집 트림 ${out.trims.length} | 저장: ${file}`);
} catch (e) { console.error("[실패]", e.message); }
finally { await browser.close().catch(() => null); }
