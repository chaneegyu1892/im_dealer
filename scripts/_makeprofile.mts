import { config } from "dotenv";
config({ path: "scripts/scraper-worker/.env" }); // PUPPETEER_EXECUTABLE_PATH
import puppeteer from "puppeteer";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const svg = readFileSync("public/images/brand/imdealer-kakao-profile.svg", "utf8");
const out = join(homedir(), "Downloads", "imdealer-kakao-profile.png");

const browser = await puppeteer.launch({
  headless: true,
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 640, height: 640, deviceScaleFactor: 2 }); // 1280x1280 출력(선명)
await page.setContent(`<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">${svg}</body></html>`, { waitUntil: "networkidle0" });
const el = await page.$("svg");
await el!.screenshot({ path: out, type: "png" });
await browser.close();
console.log("saved:", out);
