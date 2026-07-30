import puppeteer from "puppeteer";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * 일회성 진단 스크립트: 캐피탈사 로그인 페이지 DOM/프레임/키보드보안 흔적을 덤프.
 * 자격증명 불필요. 셀렉터를 알아내 어댑터를 작성하기 위한 관찰용.
 *   node scripts/scraper-worker/inspect-login.mjs <URL>
 */

const URL = process.argv[2] || "https://nf.orix.co.kr/com/login.frm";
const EXE =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const SECURITY_HINTS = [
  "TouchEn", "nProtect", "AhnLab", "ASTx", "KeySharp", "raonsecure", "raon",
  "veraport", "INISAFE", "delfino", "IPInside", "magicline", "wizvera",
  "keypad", "keyboard", "보안키패드", "키보드보안", "captcha", "recaptcha",
];

function describeInputs() {
  return Array.from(document.querySelectorAll("input, button, a[onclick], [type=submit]")).map((el) => ({
    tag: el.tagName.toLowerCase(),
    type: el.getAttribute("type"),
    id: el.id || null,
    name: el.getAttribute("name"),
    placeholder: el.getAttribute("placeholder"),
    text: (el.textContent || "").trim().slice(0, 30) || null,
    onclick: el.getAttribute("onclick")?.slice(0, 60) || null,
  }));
}

const browser = await puppeteer.launch({
  headless: true,
  executablePath: EXE,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
});
try {
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: "networkidle2", timeout: 45000 });
  console.log("URL:", page.url());
  console.log("TITLE:", await page.title());

  const frames = page.frames();
  console.log(`\n프레임 수: ${frames.length}`);
  for (const f of frames) {
    console.log(`  - frame: name="${f.name()}" url="${f.url()}"`);
  }

  // 메인 + 각 프레임의 입력 요소
  for (const f of frames) {
    let els = [];
    try {
      els = await f.evaluate(describeInputs);
    } catch {
      els = [];
    }
    if (els.length) {
      console.log(`\n[frame ${f.name() || "(main)"}] 입력/버튼 ${els.length}개:`);
      for (const e of els) console.log("   ", JSON.stringify(e));
    }
  }

  // 키보드보안/캡차 흔적 스캔 (전체 HTML + script src)
  const html = await page.content();
  const scripts = await page.evaluate(() =>
    Array.from(document.querySelectorAll("script[src]")).map((s) => s.getAttribute("src"))
  );
  const found = SECURITY_HINTS.filter(
    (h) => html.toLowerCase().includes(h.toLowerCase()) ||
           scripts.some((s) => (s || "").toLowerCase().includes(h.toLowerCase()))
  );
  console.log("\n보안 솔루션/캡차 힌트:", found.length ? found.join(", ") : "(감지 없음)");
  console.log("\n외부 script src:");
  for (const s of scripts) console.log("   ", s);

  const shot = join(tmpdir(), "orix-login.png");
  await page.screenshot({ path: shot, fullPage: true });
  console.log("\n스크린샷:", shot);
} finally {
  await browser.close();
}
