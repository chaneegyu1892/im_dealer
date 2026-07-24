import puppeteer from "puppeteer";
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

/**
 * 견적 페이지에서 차량 선택 cascade(브랜드→모델→세부차종→트림→색상)를 단계별로 클릭하며
 * 각 단계의 클릭 가능한 요소와 발생하는 네트워크 POST(내부 API)를 캡처.
 *   node scripts/scraper-worker/inspect-cascade.mjs [브랜드명]
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, ".env") });

const BRAND = process.argv[2] || "기아";
const USER = process.env.SCRAPER_TEST_USER;
const PASS = process.env.SCRAPER_TEST_PASS;
const EXE = process.env.PUPPETEER_EXECUTABLE_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const HEADLESS = process.env.SCRAPER_TRY_AUTO === "1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 컨테이너(라벨 텍스트로 식별되는 차량선택 카드) 내 보이는 버튼/라디오 텍스트 덤프
function visibleChoices() {
  const visible = (el) => el.offsetParent !== null && (el.textContent || "").trim();
  const pickIn = (root) =>
    Array.from(root.querySelectorAll("button, [role=button], label, a"))
      .filter(visible)
      .map((el) => (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 30))
      .filter((t, i, arr) => t && arr.indexOf(t) === i)
      .slice(0, 40);
  // "차량 선택" 카드 추정: 헤더 텍스트로 찾기
  const cards = Array.from(document.querySelectorAll("section, div")).filter((d) =>
    /차량\s*선택/.test(d.querySelector("h2,h3,.tit,.title,strong")?.textContent || "")
  );
  const card = cards[0];
  return {
    rows: card
      ? Array.from(card.querySelectorAll("li, tr, .row, dl")).slice(0, 12).map((r) =>
          (r.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60)
        )
      : ["(차량선택 카드 못 찾음)"],
    buttons: pickIn(card || document.body),
  };
}

async function clickByText(page, text) {
  return page.evaluate((t) => {
    const els = Array.from(document.querySelectorAll("button, [role=button], label, a"));
    const el = els.find((e) => e.offsetParent !== null && (e.textContent || "").trim() === t);
    if (el) { el.click(); return true; }
    // 부분일치 fallback
    const el2 = els.find((e) => e.offsetParent !== null && (e.textContent || "").trim().startsWith(t));
    if (el2) { el2.click(); return true; }
    return false;
  }, text);
}

const browser = await puppeteer.launch({
  headless: HEADLESS,
  executablePath: EXE,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--start-maximized"],
  defaultViewport: null,
});
try {
  const page = await browser.newPage();

  const posts = [];
  page.on("requestfinished", (req) => {
    try {
      if (req.method() === "POST" && /orix\.co\.kr/.test(req.url())) {
        posts.push(`${req.method()} ${req.url().replace(/^https?:\/\/[^/]+/, "")}`);
      }
    } catch {}
  });

  await page.goto("https://nf.orix.co.kr/com/login.frm", { waitUntil: "networkidle2", timeout: 45000 });
  await page.waitForSelector("#usrId", { timeout: 15000 });
  await page.type("#usrId", USER, { delay: 40 });
  await page.type("#usrPw", PASS, { delay: 40 });
  await Promise.all([page.click("#login"), page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }).catch(() => null)]);
  await sleep(2000);
  await page.evaluate(() => window.goPageMenu && window.goPageMenu("/sit/sit0001.frm"));
  await sleep(3500);
  console.log("견적 페이지:", page.url());

  console.log("\n[0] 초기 차량선택 카드:");
  console.log(JSON.stringify(await page.evaluate(visibleChoices), null, 1));

  // 1) 브랜드 선택 — '브랜드' 행을 열어야 할 수도 있으니 먼저 '선택해 주세요' 클릭 시도 후 브랜드 클릭
  console.log(`\n[1] 브랜드 '${BRAND}' 클릭 시도...`);
  await clickByText(page, "선택해 주세요").catch(() => {});
  await sleep(800);
  const okBrand = await clickByText(page, BRAND);
  console.log("   브랜드 클릭:", okBrand);
  await sleep(2000);
  console.log("   이후 선택지:", JSON.stringify(await page.evaluate(visibleChoices), null, 1));

  // 2) 모델 — 첫 모델 클릭 (visibleChoices.buttons 중 브랜드 목록 제외한 첫 항목 추정은 어려우니 수동 관찰용 덤프만)
  const choices = await page.evaluate(visibleChoices);
  const candidate = choices.buttons.find(
    (b) => !["현대", "제네시스", "기아", "쉐보레", "르노코리아", "GMC", "KGM", "대창모터스", BRAND].includes(b)
  );
  if (candidate) {
    console.log(`\n[2] 모델 후보 '${candidate}' 클릭...`);
    await clickByText(page, candidate);
    await sleep(2000);
    console.log("   이후 선택지:", JSON.stringify(await page.evaluate(visibleChoices), null, 1));
  }

  console.log("\n=== 캡처된 내부 POST 호출 ===");
  for (const p of [...new Set(posts)]) console.log("  ", p);

  const shot = join(tmpdir(), "orix-cascade.png");
  await page.screenshot({ path: shot, fullPage: true });
  console.log("\n스크린샷:", shot);
  if (!HEADLESS) { console.log("\n25초 열어둠..."); await sleep(25000); }
} catch (e) {
  console.error("\n[실패]", e.message);
} finally {
  await browser.close().catch(() => null);
}
