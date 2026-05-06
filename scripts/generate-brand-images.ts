import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

const FONT_PATH = path.join(process.cwd(), 'src/app/fonts/PretendardVariable.woff2');
const FONT_URL = `file:///${FONT_PATH.replace(/\\/g, '/')}`;
const OUTPUT_DIR = path.join(process.cwd(), 'public/images/brand');

// ─── Logo 400×400 ───────────────────────────────────────────────────────────
const LOGO_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @font-face {
      font-family: 'Pretendard';
      src: url('${FONT_URL}') format('woff2');
      font-weight: 100 900;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: 400px; height: 400px; overflow: hidden; background: transparent; }

    .logo {
      width: 400px;
      height: 400px;
      background: linear-gradient(145deg, #000666 0%, #1A1A6E 50%, #3333CC 100%);
      border-radius: 88px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 14px;
      position: relative;
      overflow: hidden;
    }

    /* 우측 상단 글로우 */
    .logo::before {
      content: '';
      position: absolute;
      top: -80px; right: -60px;
      width: 340px; height: 340px;
      background: radial-gradient(circle, rgba(102,102,221,0.28) 0%, transparent 65%);
    }
    /* 좌측 하단 글로우 */
    .logo::after {
      content: '';
      position: absolute;
      bottom: -60px; left: -40px;
      width: 240px; height: 240px;
      background: radial-gradient(circle, rgba(0,6,102,0.5) 0%, transparent 70%);
    }

    .icon { position: relative; z-index: 1; }

    .brand {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .brand-name {
      font-family: 'Pretendard', -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
      font-size: 56px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -2px;
      line-height: 1;
    }

    .tagline {
      font-family: 'Pretendard', -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
      font-size: 14px;
      font-weight: 400;
      color: rgba(255,255,255,0.48);
      letter-spacing: 0.12em;
    }
  </style>
</head>
<body>
  <div class="logo">
    <div class="icon">
      <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- outer sparkle -->
        <path d="M28 3L31.8 24.2L53 28L31.8 31.8L28 53L24.2 31.8L3 28L24.2 24.2L28 3Z"
              fill="white" opacity="0.90"/>
        <!-- inner cutout -->
        <path d="M28 15L30.2 25.8L41 28L30.2 30.2L28 41L25.8 30.2L15 28L25.8 25.8L28 15Z"
              fill="#1A1A6E" opacity="0.55"/>
      </svg>
    </div>
    <div class="brand">
      <div class="brand-name">아임딜러</div>
      <div class="tagline">AI 기반 진짜견적</div>
    </div>
  </div>
</body>
</html>`;

// ─── Cover 1500×500 ─────────────────────────────────────────────────────────
const COVER_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @font-face {
      font-family: 'Pretendard';
      src: url('${FONT_URL}') format('woff2');
      font-weight: 100 900;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: 1500px; height: 500px; overflow: hidden; }

    .cover {
      width: 1500px;
      height: 500px;
      background: linear-gradient(125deg, #000444 0%, #000666 30%, #1A1A6E 60%, #2828BB 85%, #3333CC 100%);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 110px;
      position: relative;
      overflow: hidden;
    }

    /* 상단 좌측 글로우 */
    .cover::before {
      content: '';
      position: absolute;
      top: -180px; left: 200px;
      width: 500px; height: 500px;
      background: radial-gradient(circle, rgba(80,80,200,0.22) 0%, transparent 65%);
    }

    /* 도트 그리드 */
    .cover::after {
      content: '';
      position: absolute;
      inset: 0;
      background-image: radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px);
      background-size: 44px 44px;
    }

    .left {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .badge {
      font-family: 'Pretendard', -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
      font-size: 13px;
      font-weight: 600;
      color: rgba(255,255,255,0.42);
      letter-spacing: 0.22em;
      text-transform: uppercase;
    }

    .brand-name {
      font-family: 'Pretendard', -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
      font-size: 96px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -4px;
      line-height: 0.95;
    }

    .divider {
      width: 52px;
      height: 2px;
      background: rgba(255,255,255,0.28);
      border-radius: 1px;
      margin-top: 4px;
    }

    .tagline {
      font-family: 'Pretendard', -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
      font-size: 24px;
      font-weight: 300;
      color: rgba(255,255,255,0.65);
      letter-spacing: 0.03em;
    }

    .right {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  </style>
</head>
<body>
  <div class="cover">
    <div class="left">
      <div class="badge">AI-Powered Auto Dealer</div>
      <div class="brand-name">아임딜러</div>
      <div class="divider"></div>
      <div class="tagline">허위견적 없는 장기렌트 · 리스</div>
    </div>

    <div class="right">
      <!-- 중첩 스파클 데코 -->
      <svg width="320" height="320" viewBox="0 0 320 320" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- 외곽 스파클 -->
        <path d="M160 18L175 145L302 160L175 175L160 302L145 175L18 160L145 145L160 18Z"
              fill="white" opacity="0.04"/>
        <!-- 중간 스파클 -->
        <path d="M160 58L172 148L262 160L172 172L160 262L148 172L58 160L148 148L160 58Z"
              fill="white" opacity="0.06"/>
        <!-- 내부 스파클 -->
        <path d="M160 98L168 152L222 160L168 168L160 222L152 168L98 160L152 152L160 98Z"
              fill="white" opacity="0.10"/>
        <!-- 중심 스파클 -->
        <path d="M160 124L165 155L196 160L165 165L160 196L155 165L124 160L155 155L160 124Z"
              fill="white" opacity="0.30"/>
        <!-- 위성 점들 -->
        <circle cx="252" cy="76"  r="7"  fill="white" opacity="0.12"/>
        <circle cx="68"  cy="236" r="5"  fill="white" opacity="0.08"/>
        <circle cx="240" cy="244" r="9"  fill="white" opacity="0.06"/>
        <circle cx="76"  cy="68"  r="6"  fill="white" opacity="0.10"/>
        <circle cx="276" cy="160" r="4"  fill="white" opacity="0.14"/>
        <circle cx="44"  cy="160" r="4"  fill="white" opacity="0.10"/>
      </svg>
    </div>
  </div>
</body>
</html>`;

// ─── Generate ────────────────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({ headless: true });

  try {
    // Logo
    process.stdout.write('로고 생성 중...');
    const logoPage = await browser.newPage();
    await logoPage.setViewport({ width: 400, height: 400, deviceScaleFactor: 2 });
    await logoPage.setContent(LOGO_HTML, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));
    await logoPage.screenshot({
      path: path.join(OUTPUT_DIR, 'channeltalk-logo.png') as `${string}.png`,
      clip: { x: 0, y: 0, width: 400, height: 400 },
    });
    console.log(' ✅ channeltalk-logo.png (400×400 @2x)');

    // Cover
    process.stdout.write('커버 생성 중...');
    const coverPage = await browser.newPage();
    await coverPage.setViewport({ width: 1500, height: 500, deviceScaleFactor: 2 });
    await coverPage.setContent(COVER_HTML, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));
    await coverPage.screenshot({
      path: path.join(OUTPUT_DIR, 'channeltalk-cover.png') as `${string}.png`,
      clip: { x: 0, y: 0, width: 1500, height: 500 },
    });
    console.log(' ✅ channeltalk-cover.png (1500×500 @2x)');

  } finally {
    await browser.close();
  }

  console.log(`\n📁 저장 위치: public/images/brand/`);
}

main().catch(err => { console.error(err); process.exit(1); });
