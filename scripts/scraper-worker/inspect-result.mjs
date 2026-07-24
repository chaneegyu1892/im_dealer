import puppeteer from "puppeteer";
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

/**
 * 일회성 진단: 렌터카 견적 페이지의 차량선택 cascade + 계약조건 영역 구조와
 * cascade 클릭 시 발생하는 내부 POST(엔드포인트/페이로드)를 캡처한다.
 * 어댑터를 "UI 클릭" vs "내부 API 직접 호출" 중 어떤 방식으로 짤지 판단하기 위함.
 *   node scripts/scraper-worker/inspect-result.mjs [브랜드] [모델]
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, ".env") });

const BRAND = process.argv[2] || "기아";
const MODEL = process.argv[3] || null; // 없으면 첫 모델
const USER = process.env.SCRAPER_TEST_USER;
const PASS = process.env.SCRAPER_TEST_PASS;
const EXE = process.env.PUPPETEER_EXECUTABLE_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!USER || !PASS) {
  console.error("자격증명 없음: .env 의 SCRAPER_TEST_USER/PASS 확인.");
  process.exit(1);
}

const posts = [];

async function clickByText(page, selector, text) {
  return page.evaluate(
    (sel, t) => {
      const els = Array.from(document.querySelectorAll(sel));
      const el = els.find((e) => e.offsetParent !== null && (e.textContent || "").trim() === t)
        || els.find((e) => e.offsetParent !== null && (e.textContent || "").trim().includes(t));
      if (el) { el.click(); return (el.textContent || "").trim().slice(0, 40); }
      return null;
    },
    selector,
    text
  );
}

const browser = await puppeteer.launch({
  headless: true,
  executablePath: EXE,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
});
try {
  const page = await browser.newPage();

  page.on("requestfinished", async (req) => {
    try {
      if (req.method() !== "POST") return;
      if (!/orix\.co\.kr/.test(req.url())) return;
      const path = req.url().replace(/^https?:\/\/[^/]+/, "");
      let body = "";
      try {
        const res = req.response();
        const txt = res ? await res.text() : "";
        body = txt.slice(0, 600);
      } catch { /* ignore */ }
      posts.push({ path, payload: (req.postData() || "").slice(0, 400), resp: body });
    } catch { /* ignore */ }
  });

  // 로그인
  await page.goto("https://nf.orix.co.kr/com/login.frm", { waitUntil: "networkidle2", timeout: 45000 });
  await page.waitForSelector("#usrId", { timeout: 15000 });
  await page.type("#usrId", USER, { delay: 40 });
  await page.type("#usrPw", PASS, { delay: 40 });
  await Promise.all([page.click("#login"), page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }).catch(() => null)]);
  await sleep(1500);

  // 견적 페이지
  await page.evaluate(() => window.goPageMenu && window.goPageMenu("/sit/sit0001.frm"));
  await sleep(3500);
  console.log("견적 페이지:", page.url());

  // 차량선택 / 계약조건 영역 outerHTML 덤프 (구조·클래스·onclick 파악용)
  const regions = await page.evaluate(() => {
    const grab = (el) => (el ? el.outerHTML.replace(/\s+/g, " ").slice(0, 4000) : "(없음)");
    // 브랜드 버튼이 속한 가장 가까운 section/div 조상
    const brandUl = document.querySelector("#brandBtn");
    const carCard = brandUl ? brandUl.closest("section, .step, .box, div[class]") : null;
    const condSec = document.querySelector("#condition") || document.querySelector("section");
    // 트림 라디오 영역
    const trim = document.querySelector('input[name="trim"]');
    const trimCard = trim ? trim.closest("section, .step, .box, div[class]") : null;
    return {
      carCard: grab(carCard),
      trimCard: grab(trimCard),
      condition: grab(condSec),
    };
  });

  // 브랜드 클릭 → 모델 목록 등장 캡처
  const clickedBrand = await clickByText(page, "#brandBtn button", BRAND);
  console.log("\n브랜드 클릭:", clickedBrand);
  await sleep(2500);

  const afterBrand = await page.evaluate(() => {
    // 모델 버튼 목록 추정: 브랜드 ul 다음의 ul 들
    const uls = Array.from(document.querySelectorAll("ul"));
    const lists = uls
      .map((ul) => ({
        id: ul.id || null,
        items: Array.from(ul.querySelectorAll("button, a, li")).map((b) => (b.textContent || "").trim()).filter(Boolean).slice(0, 30),
      }))
      .filter((l) => l.items.length && l.items.length < 60);
    return lists;
  });
  console.log("\n브랜드 클릭 후 목록(ul)들:");
  console.log(JSON.stringify(afterBrand, null, 1).slice(0, 2500));

  writeFileSync(join(tmpdir(), "orix-regions.html"),
    `<!-- CAR CARD -->\n${regions.carCard}\n\n<!-- TRIM CARD -->\n${regions.trimCard}\n\n<!-- CONDITION -->\n${regions.condition}`,
    "utf8");
  console.log("\n영역 HTML 저장:", join(tmpdir(), "orix-regions.html"));

  console.log("\n=== 캡처된 내부 POST ===");
  for (const p of posts) {
    console.log(`\n[POST] ${p.path}`);
    if (p.payload) console.log("  payload:", p.payload);
    if (p.resp) console.log("  resp:", p.resp.replace(/\s+/g, " ").slice(0, 300));
  }
} catch (e) {
  console.error("\n[실패]", e.message);
} finally {
  await browser.close().catch(() => null);
}
