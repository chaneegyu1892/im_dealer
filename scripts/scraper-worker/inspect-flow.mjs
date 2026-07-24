import puppeteer from "puppeteer";
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

/**
 * 렌터카 cascade 전체 happy-path 를 cascade 함수(getBrandCd 등)로 구동하며
 * 각 단계의 다음 선택지 + onclick 함수를 덤프하고, 계산하기가 호출하는 내부 POST 를 캡처.
 *   node scripts/scraper-worker/inspect-flow.mjs
 */
const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, ".env") });

const USER = process.env.SCRAPER_TEST_USER;
const PASS = process.env.SCRAPER_TEST_PASS;
const EXE = process.env.PUPPETEER_EXECUTABLE_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BRAND_KIA = "CA100002";
if (!USER || !PASS) { console.error("자격증명 없음"); process.exit(1); }

// 화면에 보이는 cascade 단계 컨테이너들의 onclick 후보(get*) 덤프
function dumpStep() {
  const pick = (root) =>
    Array.from(root.querySelectorAll("li[onclick], button[onclick], a[onclick]"))
      .filter((el) => el.offsetParent !== null)
      .map((el) => ({
        text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 30),
        onclick: el.getAttribute("onclick").replace(/\s+/g, " ").slice(0, 60),
        id: el.id || null,
      }))
      .filter((e) => /get|select|fn|set/i.test(e.onclick))
      .slice(0, 25);
  const groups = Array.from(document.querySelectorAll(".choose-group")).map((g) => ({
    cls: g.className,
    header: (g.querySelector("h4,h3,.tit")?.textContent || "").trim().slice(0, 20),
    items: Array.from(g.querySelectorAll("li[onclick], li[id]"))
      .filter((el) => el.offsetParent !== null)
      .map((el) => ({ text: (el.textContent || "").trim().slice(0, 24), onclick: (el.getAttribute("onclick") || "").slice(0, 50) }))
      .slice(0, 20),
  }));
  const trims = Array.from(document.querySelectorAll('input[name="trim"]')).map((r) => ({
    id: r.id,
    label: (document.querySelector(`label[for="${r.id}"]`)?.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40),
  }));
  return { all: pick(document.body), groups, trims };
}

const posts = [];
const browser = await puppeteer.launch({
  headless: true, executablePath: EXE,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
});
try {
  const page = await browser.newPage();
  page.on("requestfinished", async (req) => {
    try {
      if (req.method() !== "POST" || !/orix\.co\.kr/.test(req.url())) return;
      let resp = "";
      try { const r = req.response(); resp = r ? (await r.text()).slice(0, 1500) : ""; } catch {}
      posts.push({ path: req.url().replace(/^https?:\/\/[^/]+/, ""), payload: (req.postData() || "").slice(0, 500), resp });
    } catch {}
  });

  await page.goto("https://nf.orix.co.kr/com/login.frm", { waitUntil: "networkidle2", timeout: 45000 });
  await page.waitForSelector("#usrId", { timeout: 15000 });
  await page.type("#usrId", USER, { delay: 40 });
  await page.type("#usrPw", PASS, { delay: 40 });
  await Promise.all([page.click("#login"), page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }).catch(() => null)]);
  await sleep(1500);
  await page.evaluate(() => window.goPageMenu && window.goPageMenu("/sit/sit0001.frm"));
  await sleep(3500);
  console.log("견적:", page.url());

  // 1) 브랜드: 기아
  await page.evaluate((c) => window.getBrandCd && window.getBrandCd(c), BRAND_KIA);
  await sleep(2500);
  let step = await page.evaluate(dumpStep);
  console.log("\n[브랜드 후] 모델 단계 groups:");
  console.log(JSON.stringify(step.groups, null, 1).slice(0, 2000));

  // 2) 첫 모델 onclick 실행
  const modelGroup = step.groups.find((g) => /모델/.test(g.header) && g.items.some((i) => i.onclick));
  const firstModel = modelGroup?.items.find((i) => i.onclick && i.text);
  console.log("\n첫 모델:", JSON.stringify(firstModel));
  if (firstModel?.onclick) {
    await page.evaluate((oc) => { /* eslint-disable no-eval */ window.eval(oc); }, firstModel.onclick);
    await sleep(2500);
    step = await page.evaluate(dumpStep);
    console.log("\n[모델 후] groups:");
    console.log(JSON.stringify(step.groups, null, 1).slice(0, 2000));
  }

  // 3) 세부차종 첫 항목
  let sub = step.groups.find((g) => /세부|차종/.test(g.header) && g.items.some((i) => i.onclick));
  let firstSub = sub?.items.find((i) => i.onclick && i.text);
  console.log("\n첫 세부차종:", JSON.stringify(firstSub));
  if (firstSub?.onclick) {
    await page.evaluate((oc) => window.eval(oc), firstSub.onclick);
    await sleep(2500);
    step = await page.evaluate(dumpStep);
    console.log("\n[세부차종 후] trims:", JSON.stringify(step.trims).slice(0, 600));
    console.log("[세부차종 후] groups:", JSON.stringify(step.groups, null, 1).slice(0, 1200));
  }

  // 4) 트림 첫 항목 선택
  if (step.trims.length) {
    await page.evaluate((id) => { const r = document.getElementById(id); if (r) { r.click(); } }, step.trims[0].id);
    await sleep(2500);
    // 외장/내장 색상이 필수면 첫 항목 자동 선택 시도
    await page.evaluate(() => {
      document.querySelectorAll(".choose-group.color li[onclick], .choose-group [id^='CA'] ").forEach(() => {});
    });
  }

  // 5) 계산하기
  const calcClicked = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) => /계산하기/.test(b.textContent || "") && b.offsetParent !== null);
    if (btn) { btn.click(); return true; }
    return false;
  });
  console.log("\n계산하기 클릭:", calcClicked);
  await sleep(4000);

  const result = await page.evaluate(() => {
    const t = (sel) => (document.querySelector(sel)?.textContent || "").trim().replace(/\s+/g, " ");
    return {
      monthly: t("#calcPayment .num"),
      residual: t(".residual .num"),
      rvRateOptions: Array.from(document.querySelectorAll('select[name="rvRate"] option')).map((o) => `${o.value}:${o.textContent.trim()}`).slice(0, 8),
      table1: Array.from(document.querySelectorAll("table")).map((tb, i) => `T${i}:${(tb.textContent || "").replace(/\s+/g, " ").slice(0, 200)}`),
    };
  });
  console.log("\n=== 결과 ===");
  console.log(JSON.stringify(result, null, 1).slice(0, 1800));

  writeFileSync(join(tmpdir(), "orix-posts.json"), JSON.stringify(posts, null, 2), "utf8");
  console.log("\nPOST 로그 저장:", join(tmpdir(), "orix-posts.json"), `(${posts.length}건)`);
  console.log("\n=== POST 경로 목록 ===");
  for (const p of posts) console.log("  ", p.path, p.payload ? `| ${p.payload.slice(0, 80)}` : "");
} catch (e) {
  console.error("\n[실패]", e.message, e.stack?.split("\n")[1]);
} finally {
  await browser.close().catch(() => null);
}
