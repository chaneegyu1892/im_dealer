import puppeteer from "puppeteer";
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

/**
 * 일회성 진단: 오릭스 로그인 후 화면 구조(메뉴/링크/프레임)를 덤프해 견적 경로를 파악.
 * 자격증명은 scripts/scraper-worker/.env 의 SCRAPER_TEST_USER / SCRAPER_TEST_PASS 사용.
 *   node scripts/scraper-worker/inspect-postlogin.mjs [로그인후이동URL]
 *
 * 기본 headful — 화면을 직접 보며 진행. SCRAPER_TRY_AUTO=1 이면 headless.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, ".env") });

const LOGIN_URL = "https://nf.orix.co.kr/com/login.frm";
const USER = process.env.SCRAPER_TEST_USER;
const PASS = process.env.SCRAPER_TEST_PASS;
const EXE = process.env.PUPPETEER_EXECUTABLE_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const HEADLESS = process.env.SCRAPER_TRY_AUTO === "1";

if (!USER || !PASS) {
  console.error("자격증명 없음: scripts/scraper-worker/.env 의 SCRAPER_TEST_USER / SCRAPER_TEST_PASS 를 채우세요.");
  process.exit(1);
}

function dumpNav() {
  const pick = (els) =>
    Array.from(els)
      .map((el) => ({
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40) || null,
        href: el.getAttribute("href") || null,
        onclick: el.getAttribute("onclick")?.replace(/\s+/g, " ").slice(0, 80) || null,
      }))
      .filter((e) => e.text || e.onclick || e.href);
  return {
    links: pick(document.querySelectorAll("a")),
    buttons: pick(document.querySelectorAll("button")),
    navText: (document.querySelector("nav, .gnb, .lnb, #menu, .menu")?.textContent || "")
      .replace(/\s+/g, " ")
      .slice(0, 500),
  };
}

const browser = await puppeteer.launch({
  headless: HEADLESS,
  executablePath: EXE,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--start-maximized"],
  defaultViewport: null,
});
try {
  const page = await browser.newPage();
  console.log("로그인 페이지 이동...");
  await page.goto(LOGIN_URL, { waitUntil: "networkidle2", timeout: 45000 });
  await page.waitForSelector("#usrId", { timeout: 15000 });
  await page.type("#usrId", USER, { delay: 40 });
  await page.type("#usrPw", PASS, { delay: 40 });
  console.log("로그인 클릭...");
  await Promise.all([
    page.click("#login"),
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }).catch(() => null),
  ]);
  // 로그인 후 안정화 대기
  await new Promise((r) => setTimeout(r, 2500));

  console.log("\n로그인 후 URL:", page.url());
  console.log("타이틀:", await page.title());

  if (/login/i.test(page.url())) {
    const msg = await page.evaluate(() => document.body.innerText.slice(0, 300));
    console.log("\n[주의] 아직 로그인 페이지입니다. 화면 메시지:\n", msg);
  }

  const optionalNav = process.argv[2];
  if (optionalNav) {
    console.log(`\n지정 URL 이동: ${optionalNav}`);
    await page.goto(optionalNav, { waitUntil: "networkidle2", timeout: 30000 }).catch((e) => console.log("이동 실패:", e.message));
    await new Promise((r) => setTimeout(r, 1500));
  }

  const frames = page.frames();
  console.log(`\n프레임 수: ${frames.length}`);
  for (const f of frames) console.log(`  - "${f.name()}" ${f.url()}`);

  const nav = await page.evaluate(dumpNav);
  console.log("\n=== 링크 (a) ===");
  for (const l of nav.links) console.log("  ", JSON.stringify(l));
  console.log("\n=== 버튼 ===");
  for (const b of nav.buttons) console.log("  ", JSON.stringify(b));
  if (nav.navText) console.log("\n=== 메뉴 텍스트 ===\n", nav.navText);

  const shot = join(tmpdir(), "orix-postlogin.png");
  await page.screenshot({ path: shot, fullPage: true });
  console.log("\n스크린샷:", shot);

  if (!HEADLESS) {
    console.log("\n브라우저를 15초간 열어 둡니다 (직접 둘러보세요)...");
    await new Promise((r) => setTimeout(r, 15000));
  }
} catch (e) {
  console.error("\n[실패]", e.message);
} finally {
  await browser.close().catch(() => null);
}
