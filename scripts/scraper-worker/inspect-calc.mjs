import puppeteer from "puppeteer";
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { sanitizeCaptureRecord } from "./capture-policy.mjs";

/** 쏘렌토 1트림으로 탁송·계산 동작과 내부 POST 를 진단. */
const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, ".env") });
const USER = process.env.SCRAPER_TEST_USER, PASS = process.env.SCRAPER_TEST_PASS;
const EXE = process.env.PUPPETEER_EXECUTABLE_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!USER || !PASS) { console.error("자격증명 없음"); process.exit(1); }

const posts = [];
const browser = await puppeteer.launch({ headless: true, executablePath: EXE, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
try {
  const page = await browser.newPage();
  page.on("dialog", async (d) => { console.log(`  [dialog] ${d.type()}: ${d.message().slice(0, 80)}`); await d.accept().catch(() => {}); });
  page.on("requestfinished", async (req) => {
    try {
      if (req.method() !== "POST" || !/\.act/.test(req.url())) return;
      let resp = ""; try { const r = req.response(); resp = r ? (await r.text()).slice(0, 800) : ""; } catch {}
      const record = sanitizeCaptureRecord({
        path: req.url().replace(/^https?:\/\/[^/]+/, ""),
        payload: (req.postData() || "").slice(0, 300),
        resp,
      });
      if (record) posts.push(record);
    } catch {}
  });
  await page.goto("https://nf.orix.co.kr/com/login.frm", { waitUntil: "networkidle2", timeout: 45000 });
  await page.waitForSelector("#usrId"); await page.type("#usrId", USER, { delay: 40 }); await page.type("#usrPw", PASS, { delay: 40 });
  await Promise.all([page.click("#login"), page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => null)]);
  await sleep(1500);
  await page.evaluate(() => window.goPageMenu("/sit/sit0001.frm")); await sleep(3500);

  await page.evaluate(() => document.getElementById("CA100002")?.click()); // 기아
  await page.waitForSelector("#mdl .choose li").catch(() => null); await sleep(800);
  await page.evaluate(() => (document.querySelector('#mdl li[data-mdlcd="쏘렌토"]') || document.getElementById("쏘렌토"))?.click());
  await page.waitForSelector("#dtlMdl .swiper-slide").catch(() => null); await sleep(1200);
  await page.evaluate(() => document.querySelector("#dtlMdl .swiper-slide")?.click()); // 첫 세부차종
  await page.waitForSelector('#trim input[name="trim"]').catch(() => null); await sleep(1500);
  await page.evaluate(() => document.querySelector('#trim input[name="trim"]')?.click()); // 첫 트림
  await sleep(1200);
  await sleep(1500); // CAR_COMBO_4(색상) 로딩 대기

  // 색상 영역 구조 덤프 + 외장/내장 첫 색상 선택(인라인 onclick → in-page click 가능)
  const colorGroups = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".choose-group"))
      .map((g) => ({
        header: (g.querySelector("h4,h3")?.textContent || "").trim().slice(0, 12),
        items: Array.from(g.querySelectorAll("li, button"))
          .filter((e) => e.offsetParent !== null && (e.textContent || "").trim())
          .map((e) => ({ t: (e.textContent || "").replace(/\s+/g, " ").trim().slice(0, 18), oc: (e.getAttribute("onclick") || "").slice(0, 40), id: e.id || null }))
          .slice(0, 5),
      }))
      .filter((g) => /색상|외장|내장/.test(g.header))
  );
  console.log("색상 영역:", JSON.stringify(colorGroups).slice(0, 900));

  // 외장 → 내장 순서로 첫 색상 클릭
  for (const hdr of ["외장", "내장"]) {
    const picked = await page.evaluate((h) => {
      const g = Array.from(document.querySelectorAll(".choose-group")).find((x) => new RegExp(h).test(x.querySelector("h4,h3")?.textContent || ""));
      const first = g && Array.from(g.querySelectorAll("li, button")).find((e) => e.offsetParent !== null && (e.textContent || "").trim());
      if (first) { first.click(); return (first.textContent || "").replace(/\s+/g, " ").trim().slice(0, 20); }
      return null;
    }, hdr);
    console.log(`  ${hdr}색상 선택:`, picked);
    await sleep(1500);
  }

  await page.evaluate(() => { const b = document.getElementById("CA100002"); if (b && !b.classList.contains("on")) b.classList.add("on"); try { window.setCarInfo?.(); } catch {} });
  await sleep(1200);

  // 라디오 전수 덤프 + 보이는(visible) 항목 라벨 클릭
  const dumpRadios = (name) => {
    const fn = (nm) => Array.from(document.querySelectorAll(`input[name="${nm}"]`)).map((i) => {
      const lab = document.querySelector(`label[for="${i.id}"]`);
      return { id: i.id, checked: i.checked, visible: i.offsetParent !== null || (lab && lab.offsetParent !== null), label: (lab?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 16) };
    });
    return fn(name);
  };
  console.log("release 라디오들:", JSON.stringify(await page.evaluate(dumpRadios, "release")));
  console.log("client 라디오들:", JSON.stringify(await page.evaluate(dumpRadios, "client")));

  // puppeteer 진짜 클릭(trusted) — 라벨 좌표 클릭으로 실제 핸들러 발화
  for (const id of ["radio-3", "radio-2"]) { // 개인, 대리점출고
    await page.click(`label[for="${id}"]`).catch((e) => console.log(`  click ${id} 실패: ${e.message.slice(0, 40)}`));
    await sleep(800);
  }
  console.log("클릭 후 checked:", JSON.stringify(await page.evaluate(() => ({
    client: document.querySelector('input[name="client"]:checked')?.id ?? null,
    release: document.querySelector('input[name="release"]:checked')?.id ?? null,
  }))));
  await sleep(1200);
  console.log("SHIPMENT_KUBUN:", await page.evaluate(() => window.estmtCar?.get?.("SHIPMENT_KUBUN") ?? null));

  const before = await page.evaluate(() => {
    const opts = (sel) => { const el = document.querySelector(sel); return el ? Array.from(el.options).map((o) => `${o.value}:${o.textContent.trim()}`) : "(없음)"; };
    return {
      deliType: opts("#deliType"), fromArea: opts("#fromArea"), toArea: opts("#toArea"),
      release: document.querySelector('input[name="release"]:checked')?.id ?? null,
      shipmentKubun: window.estmtCar?.get?.("SHIPMENT_KUBUN") ?? null,
      impdom: window.estmtCar?.get?.("IMPDOM_KUBUN") ?? null,
      rvRate: Array.from(document.querySelectorAll('select[name="rvRate"] option')).map((o) => `${o.value}:${o.textContent.trim()}`),
    };
  });
  console.log("출고/탁송 초기:", JSON.stringify(before, null, 1).slice(0, 1200));

  // deliType 선택(page.select=trusted) 후 fromArea/toArea 재확인
  await page.select("#deliType", "CA880003").catch(() => null); // 제조사탁송
  await sleep(2500);
  const afterDeli = await page.evaluate(() => {
    const opts = (sel) => { const el = document.querySelector(sel); return el ? Array.from(el.options).map((o) => `${o.value}:${o.textContent.trim()}`) : "(없음)"; };
    return { deliTypeVal: document.querySelector("#deliType")?.value, fromArea: opts("#fromArea"), toArea: opts("#toArea") };
  });
  console.log("\ndeliType 선택 후:", JSON.stringify(afterDeli, null, 1).slice(0, 1000));

  // from/to 첫 실값 선택
  await page.evaluate(() => {
    ["fromArea", "toArea"].forEach((id) => { const el = document.getElementById(id); if (el) { const o = Array.from(el.options).find((x) => x.value); if (o) { el.value = o.value; el.dispatchEvent(new Event("change", { bubbles: true })); } } });
  });
  await sleep(1000);

  const clicked = await page.evaluate(() => {
    const b = document.querySelector("#calcPayment button, .grid-list-footer button")
      || Array.from(document.querySelectorAll("button")).find((x) => /계산하기/.test(x.textContent || ""));
    if (b) { b.click(); return true; }
    return false;
  });
  console.log("\n계산하기 클릭:", clicked);
  await sleep(5000);

  const after = await page.evaluate(() => {
    const t = (s) => (document.querySelector(s)?.textContent || "").replace(/\s+/g, " ").trim();
    // 화면에 보이는 안내/검증 메시지 탐색
    const msgs = Array.from(document.querySelectorAll(".message, .msg, [role=dialog], .layer-popup, .modal, .alert"))
      .filter((e) => e.offsetParent !== null).map((e) => (e.textContent || "").replace(/\s+/g, " ").trim().slice(0, 100)).filter(Boolean);
    return {
      calcPayment: t("#calcPayment"), gridFooterNum: t(".grid-list-footer .num"),
      residual: t(".residual"), monthlyAny: Array.from(document.querySelectorAll(".num")).map((n) => n.textContent.trim()).filter((x) => /[0-9]/.test(x)).slice(0, 10),
      visibleMsgs: msgs.slice(0, 5),
    };
  });
  console.log("\n계산 후:", JSON.stringify(after, null, 1).slice(0, 1500));

  writeFileSync(join(tmpdir(), "orix-calc-posts.json"), JSON.stringify(posts, null, 2), "utf8");
  console.log("\n=== 계산 관련 POST ===");
  for (const p of posts) console.log(`[${p.path}] ${p.payload.slice(0, 120)}\n   → ${p.resp.replace(/\s+/g, " ").slice(0, 220)}`);
} catch (e) { console.error("[실패]", e.message); }
finally { await browser.close().catch(() => null); }
