import puppeteer from "puppeteer";
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

/**
 * 기아 쏘렌토 전체 데이터를 오릭스 내부 API(/SIT0001.act)로 직접 수집한다.
 * DOM 폼(다단계·커스텀 컨트롤) 대신 로그인 세션으로 JSON API 를 호출 → 안정적·완전.
 *
 *   node scripts/scraper-worker/scrape-sorento.mjs
 *
 * 수집: 세부차종(CAR_COMBO_2) → 트림+가격+잔존율파라미터(CAR_COMBO_3)
 *      → 색상(CAR_COMBO_4) → 잔존율 목록(SEL_RV_LIST).
 * (월 렌트료 계산은 별도 다단계 폼이 필요해 본 스크립트 범위 밖 — ORIX-NOTES.md 참고)
 */
const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, ".env") });
const USER = process.env.SCRAPER_TEST_USER, PASS = process.env.SCRAPER_TEST_PASS;
const EXE = process.env.PUPPETEER_EXECUTABLE_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!USER || !PASS) { console.error("자격증명 없음(.env)"); process.exit(1); }

const LS_WORK = "CF100006";      // 렌터카
const BRAND_KIA = "CA100002";
const MODEL = "쏘렌토";
const SHIPMENT = "LI260002";     // 대리점출고(잔존율 조회용, 가격무관 — 아무거나)
const won = (n) => Number(n || 0).toLocaleString();

const browser = await puppeteer.launch({ headless: true, executablePath: EXE, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
try {
  const page = await browser.newPage();
  // 로그인
  await page.goto("https://nf.orix.co.kr/com/login.frm", { waitUntil: "networkidle2", timeout: 45000 });
  await page.waitForSelector("#usrId");
  await page.type("#usrId", USER, { delay: 40 });
  await page.type("#usrPw", PASS, { delay: 40 });
  await Promise.all([page.click("#login"), page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => null)]);
  await sleep(1200);
  // 견적 페이지(세션/리퍼러 확보)
  await page.evaluate(() => window.goPageMenu && window.goPageMenu("/sit/sit0001.frm"));
  await sleep(2500);
  console.log("로그인·세션 준비 완료\n");

  // 내부 API 호출 헬퍼 (로그인 세션 쿠키로 직접 POST)
  const api = (body) => page.evaluate(async (b) => {
    const res = await fetch("/SIT0001.act", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
    const txt = await res.text();
    try { return JSON.parse(txt); } catch { return { _raw: txt.slice(0, 200) }; }
  }, body);

  // 1) 세부차종
  const subRes = await api({ txGbCd: "CAR_COMBO_2", LS_WORK_KUBUN: LS_WORK, BRAND_CD: BRAND_KIA, MDL_CD: MODEL, PRE_ADC_YN: "N" });
  const subs = subRes.LIST || [];
  console.log(`세부차종 ${subs.length}개: ${subs.map((s) => `${s.DT_MDL_NM}(${s.DT_MDL_CD})`).join(", ")}\n`);

  const out = { brand: "기아", model: MODEL, scrapedAt: new Date().toISOString(), subModels: [] };

  for (const sub of subs) {
    console.log(`=== ${sub.DT_MDL_NM} (${sub.DT_MDL_CD}) ===`);
    const trimRes = await api({ txGbCd: "CAR_COMBO_3", LS_WORK_KUBUN: LS_WORK, BRAND_CD: BRAND_KIA, DT_MDL_CD: sub.DT_MDL_CD, PRE_ADC_YN: "N" });
    const trims = trimRes.LIST || [];
    const subRec = { dtMdlCd: sub.DT_MDL_CD, name: sub.DT_MDL_NM, trims: [] };

    for (const t of trims) {
      // 색상
      let colors = [];
      if (t.NC_MODEL_ID) {
        const colRes = await api({ txGbCd: "CAR_COMBO_4", NC_MODEL_ID: t.NC_MODEL_ID });
        colors = (colRes.LIST || []).map((c) => ({ name: c.BCC_NAME, price: Number(c.BCC_PRICE || 0) }));
        await sleep(150);
      }
      // 잔존율(회수율) — 파라미터는 모두 CAR_COMBO_3 트림 레코드에서 온다(캡처로 확정).
      let rvGrid = {};
      const rvRes = await api({
        txGbCd: "SEL_RV_LIST", LS_WORK_KUBUN: LS_WORK, SHIPMENT_KUBUN: SHIPMENT,
        IMPDOM_KUBUN: t.IMPDOM_KUBUN, MDEL_CD: t.MDEL_CD, RV_RANK: t.RV_RANK,
        OPER_RV_KUBUN: t.OPER_RV_KUBUN, ADJ_RV_KUBUN: t.ADJ_RV_KUBUN, STD_RV_KUBUN: t.STD_RV_KUBUN,
      });
      if (Array.isArray(rvRes.LIST)) {
        for (const r of rvRes.LIST) {
          // RV_RATE = 적용 잔존율(%). 키: "기간_거리" (우리 모델과 동일 차원)
          rvGrid[`${r.KIKAN}_${r.MT_DIST}`] = Number(r.RV_RATE || r.STD_RV_RATE || 0);
        }
      }

      const rec = {
        trimName: t.MDEL_NAME2 || t.MDEL_NAME,
        carCd: t.CAR_CD,
        mdelCd: t.MDEL_CD,
        price: Number(t.MDEL_PRICE || 0),
        engine: t.ENGINE_TYPE_NM,
        year: t.MDEL_YEAR,
        rvRank: t.RV_RANK,
        colors,
        rvGrid, // "기간_거리" → 잔존율(%)
      };
      subRec.trims.push(rec);
      // 우리 매트릭스 셀(36/48/60 × 2만km) 잔존율을 한눈에
      const g = (k) => (rvGrid[k] != null ? `${rvGrid[k]}%` : "-");
      console.log(`  · ${rec.trimName}  ${won(rec.price)}원  [${rec.engine}]  색상 ${colors.length}  잔존율(2만km) 36→${g("36_20000")} 48→${g("48_20000")} 60→${g("60_20000")}`);
      await sleep(200);
    }
    out.subModels.push(subRec);
    console.log("");
  }

  const file = join(tmpdir(), "orix-sorento.json");
  writeFileSync(file, JSON.stringify(out, null, 2), "utf8");
  const totalTrims = out.subModels.reduce((a, s) => a + s.trims.length, 0);
  console.log(`수집 완료: 세부차종 ${out.subModels.length}, 트림 ${totalTrims}개`);
  console.log("전체 데이터 저장:", file);

  // 잔존율 전체 그리드 샘플 1건(기간×거리)
  const sample = out.subModels[0]?.trims.find((t) => Object.keys(t.rvGrid).length);
  if (sample) {
    console.log(`\n잔존율 전체 그리드 샘플 (${sample.trimName}):`);
    for (const km of [10000, 20000, 30000]) {
      const row = [36, 48, 60].map((m) => `${m}개월:${sample.rvGrid[`${m}_${km}`] ?? "-"}%`).join("  ");
      console.log(`  ${km / 10000}만km → ${row}`);
    }
  }
} catch (e) {
  console.error("[실패]", e.message);
} finally {
  await browser.close().catch(() => null);
}
