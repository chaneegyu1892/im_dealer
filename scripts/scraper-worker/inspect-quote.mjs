import puppeteer from "puppeteer";
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

/**
 * 로그인 후 견적 페이지로 이동해 폼/드롭다운/표/iframe 구조를 덤프.
 *   node scripts/scraper-worker/inspect-quote.mjs [메뉴경로]
 * 기본 메뉴경로: /sit/sit0001.frm (렌터카=장기렌트 견적내기)
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, ".env") });

const LOGIN_URL = "https://nf.orix.co.kr/com/login.frm";
const MENU = process.argv[2] || "/sit/sit0001.frm";
const USER = process.env.SCRAPER_TEST_USER;
const PASS = process.env.SCRAPER_TEST_PASS;
const EXE = process.env.PUPPETEER_EXECUTABLE_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const HEADLESS = process.env.SCRAPER_TRY_AUTO === "1";

if (!USER || !PASS) {
  console.error("자격증명 없음: .env 의 SCRAPER_TEST_USER/PASS 확인.");
  process.exit(1);
}

function dumpForm() {
  const labelFor = (el) => {
    if (el.id) {
      const l = document.querySelector(`label[for="${el.id}"]`);
      if (l) return l.textContent.trim().slice(0, 30);
    }
    return null;
  };
  const selects = Array.from(document.querySelectorAll("select")).map((s) => ({
    id: s.id || null,
    name: s.getAttribute("name"),
    label: labelFor(s),
    optionCount: s.options.length,
    sample: Array.from(s.options).slice(0, 6).map((o) => `${o.value}:${o.textContent.trim().slice(0, 20)}`),
  }));
  const inputs = Array.from(document.querySelectorAll("input:not([type=hidden])")).map((i) => ({
    id: i.id || null,
    name: i.getAttribute("name"),
    type: i.getAttribute("type"),
    placeholder: i.getAttribute("placeholder"),
    label: labelFor(i),
  }));
  const buttons = Array.from(document.querySelectorAll("button, a.btn, [class*=btn]"))
    .map((b) => ({
      tag: b.tagName.toLowerCase(),
      id: b.id || null,
      text: (b.textContent || "").trim().replace(/\s+/g, " ").slice(0, 24) || null,
      onclick: b.getAttribute("onclick")?.replace(/\s+/g, " ").slice(0, 60) || null,
    }))
    .filter((b) => b.text);
  const tables = Array.from(document.querySelectorAll("table")).map((t, i) => ({
    idx: i,
    id: t.id || null,
    className: t.className || null,
    rows: t.rows.length,
    headers: Array.from(t.querySelectorAll("th")).slice(0, 12).map((h) => h.textContent.trim().slice(0, 16)),
  }));
  return { selects, inputs, buttons, tables };
}

const browser = await puppeteer.launch({
  headless: HEADLESS,
  executablePath: EXE,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--start-maximized"],
  defaultViewport: null,
});
try {
  const page = await browser.newPage();
  await page.goto(LOGIN_URL, { waitUntil: "networkidle2", timeout: 45000 });
  await page.waitForSelector("#usrId", { timeout: 15000 });
  await page.type("#usrId", USER, { delay: 40 });
  await page.type("#usrPw", PASS, { delay: 40 });
  await Promise.all([
    page.click("#login"),
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }).catch(() => null),
  ]);
  await new Promise((r) => setTimeout(r, 2000));
  console.log("로그인 후:", page.url());

  // 실제 메뉴 함수로 이동 (사이트 내부 라우팅 사용)
  console.log(`견적 메뉴 이동: goPageMenu('${MENU}')`);
  await page.evaluate((m) => {
    if (typeof window.goPageMenu === "function") window.goPageMenu(m);
    else window.location.href = m;
  }, MENU);
  await new Promise((r) => setTimeout(r, 3500));
  console.log("현재 URL:", page.url());
  console.log("타이틀:", await page.title());

  const frames = page.frames();
  console.log(`\n프레임 수: ${frames.length}`);
  for (const f of frames) console.log(`  - "${f.name()}" ${f.url()}`);

  // 메인 + 프레임별 폼 구조
  for (const f of frames) {
    let data;
    try { data = await f.evaluate(dumpForm); } catch { continue; }
    if (!data) continue;
    const has = data.selects.length || data.inputs.length || data.tables.length;
    if (!has) continue;
    console.log(`\n========== [frame "${f.name() || "(main)"}"] ==========`);
    console.log(`\n-- SELECT (${data.selects.length}) --`);
    for (const s of data.selects) console.log("  ", JSON.stringify(s));
    console.log(`\n-- INPUT (${data.inputs.length}) --`);
    for (const i of data.inputs) console.log("  ", JSON.stringify(i));
    console.log(`\n-- BUTTON (${data.buttons.length}) --`);
    for (const b of data.buttons.slice(0, 30)) console.log("  ", JSON.stringify(b));
    console.log(`\n-- TABLE (${data.tables.length}) --`);
    for (const t of data.tables) console.log("  ", JSON.stringify(t));
  }

  const shot = join(tmpdir(), "orix-quote.png");
  await page.screenshot({ path: shot, fullPage: true });
  console.log("\n스크린샷:", shot);

  if (!HEADLESS) {
    console.log("\n브라우저를 20초간 열어 둡니다...");
    await new Promise((r) => setTimeout(r, 20000));
  }
} catch (e) {
  console.error("\n[실패]", e.message);
} finally {
  await browser.close().catch(() => null);
}
