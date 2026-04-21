/**
 * 아임딜러 관리자 페이지 스크린샷 자동 캡처
 * 실행: node scripts/capture-admin-screenshots.mjs
 */

import puppeteer from 'puppeteer';
import { mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SCREENSHOTS_DIR = join(ROOT, 'docs', 'screenshots');
const BASE_URL = 'http://localhost:3000';

const EMAIL    = 'admin@imdealers.com';
const PASSWORD = 'admin123';

if (!existsSync(SCREENSHOTS_DIR)) mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const wait = ms => new Promise(r => setTimeout(r, ms));

async function shot(page, filename, fullPage = false) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await wait(400);
  await page.screenshot({ path: join(SCREENSHOTS_DIR, filename), fullPage });
  console.log(`   ✅ ${filename}`);
}

async function goto(page, path) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1800);
}

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 });

  // ── 로그인 페이지 캡처 ─────────────────────────────────────────────────
  console.log('\n📸 [1] 로그인 페이지');
  await goto(page, '/admin/login');
  await shot(page, '01_login.png');

  // ── 로그인 수행 (API fetch 방식) ────────────────────────────────────────
  console.log('\n🔐 로그인 중...');

  // React 폼 입력: 이메일
  await page.click('input[type="email"]', { clickCount: 3 });
  await page.type('input[type="email"]', EMAIL, { delay: 40 });

  // 비밀번호
  await page.click('input[type="password"]', { clickCount: 3 });
  await page.type('input[type="password"]', PASSWORD, { delay: 40 });

  // 로그인 버튼 클릭
  await page.click('button[type="submit"]');

  // router.replace('/admin') 클라이언트 내비게이션 대기
  try {
    await page.waitForFunction(
      () => window.location.pathname !== '/admin/login',
      { timeout: 10000 }
    );
  } catch {
    console.log('   ⚠️ URL 변화 감지 실패, 3초 대기 후 계속...');
    await wait(3000);
  }

  console.log(`   현재 URL: ${page.url()}`);

  // URL이 아직 login이면 직접 이동
  if (page.url().includes('/admin/login')) {
    console.log('   ⚠️ 로그인 실패 감지. 대시보드로 강제 이동 시도...');
    await goto(page, '/admin');
    console.log(`   현재 URL: ${page.url()}`);
  }

  await wait(1500);

  // ── 대시보드 ─────────────────────────────────────────────────────────
  console.log('\n📸 [2] 대시보드');
  await goto(page, '/admin');
  await shot(page, '02_dashboard.png');

  // ── 데이터 분석 ──────────────────────────────────────────────────────
  console.log('\n📸 [3] 데이터 분석');
  await goto(page, '/admin/analytics');
  await shot(page, '03_analytics.png');

  // ── 차량 관리 ─────────────────────────────────────────────────────────
  console.log('\n📸 [4] 차량 관리');
  await goto(page, '/admin/vehicles');
  await shot(page, '04_vehicles.png');

  // 첫 번째 차량 클릭 → 상세 패널
  try {
    const firstVehicle = await page.$('li, [class*="vehicle"], [class*="cursor-pointer"]');
    if (firstVehicle) {
      await firstVehicle.click();
      await wait(1000);
      await shot(page, '04b_vehicles_detail.png');
    }
  } catch {}

  // ── 견적 데이터 ──────────────────────────────────────────────────────
  console.log('\n📸 [5] 견적 데이터');
  await goto(page, '/admin/quotations');
  await shot(page, '05_quotations.png');

  // 첫 번째 행 클릭 → Drawer
  try {
    const firstRow = await page.$('tbody tr');
    if (firstRow) {
      await firstRow.click();
      await wait(800);
      await shot(page, '05b_quotations_drawer.png');
    }
  } catch {}

  // ── 사용자 관리 ──────────────────────────────────────────────────────
  console.log('\n📸 [6] 사용자 관리');
  await goto(page, '/admin/users');
  await shot(page, '06_users.png');

  // 첫 번째 사용자 클릭 → 상세 슬라이드
  try {
    const firstUser = await page.$('tbody tr');
    if (firstUser) {
      await firstUser.click();
      await wait(800);
      await shot(page, '06b_users_detail.png');
    }
  } catch {}

  // ── 재고 관리 ─────────────────────────────────────────────────────────
  console.log('\n📸 [7] 재고 관리');
  await goto(page, '/admin/inventory');
  await shot(page, '07_inventory.png');

  // ── 견적 산출 로직 관리 ───────────────────────────────────────────────
  console.log('\n📸 [8] 견적 산출 로직 관리');
  await goto(page, '/admin/finance');
  await shot(page, '08_finance.png');

  // 탭 2: 가산 정책
  try {
    const tabs = await page.$$('button');
    if (tabs[1]) { await tabs[1].click(); await wait(600); await shot(page, '08b_finance_surcharge.png'); }
    if (tabs[2]) { await tabs[2].click(); await wait(600); await shot(page, '08c_finance_rates.png'); }
  } catch {}

  // ── AI 관리 ───────────────────────────────────────────────────────────
  console.log('\n📸 [9] AI 관리');
  await goto(page, '/admin/ai');
  await shot(page, '09_ai.png');

  // ── 운영 메모 ─────────────────────────────────────────────────────────
  console.log('\n📸 [10] 운영 메모');
  await goto(page, '/admin/memo');
  await shot(page, '10_memo.png');

  // 새 메모 작성 Drawer 열기
  try {
    // "새 메모" 또는 "+ 작성" 버튼 텍스트로 찾기
    const allBtns = await page.$$('button');
    for (const btn of allBtns) {
      const txt = await page.evaluate(el => el.textContent, btn);
      if (txt && (txt.includes('메모') || txt.includes('작성') || txt.includes('+'))) {
        await btn.click();
        await wait(700);
        await shot(page, '10b_memo_drawer.png');
        break;
      }
    }
  } catch {}

  // ── 설정 ──────────────────────────────────────────────────────────────
  console.log('\n📸 [11] 설정');
  await goto(page, '/admin/settings');
  await shot(page, '11_settings.png');

  // ── 서류 확인 ─────────────────────────────────────────────────────────
  console.log('\n📸 [12] 서류 확인');
  await goto(page, '/admin/verifications');
  await shot(page, '12_verifications.png');

  // ── 회수율 설정 ───────────────────────────────────────────────────────
  console.log('\n📸 [13] 회수율 설정');
  await goto(page, '/admin/recovery-rates');
  await shot(page, '13_recovery.png');

  await browser.close();

  // 결과 출력
  const { readdirSync } = await import('fs');
  const files = readdirSync(SCREENSHOTS_DIR).filter(f => f.endsWith('.png')).sort();
  console.log(`\n✅ 완료 — ${files.length}개 스크린샷 저장됨:`);
  files.forEach(f => console.log(`  📷 docs/screenshots/${f}`));
}

main().catch(err => {
  console.error('\n❌ 오류:', err.message);
  process.exit(1);
});
