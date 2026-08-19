// 워커 배포 zip 생성 — 빌드 시 실행되어 worker-dist/worker.zip 을 만든다.
// /api/worker/update 가 이 zip 을 (워커 시크릿 인증 후) 내려주고,
// 담당자 PC 의 '수집 시작.bat'(run.ps1)이 버전 불일치 시 받아서 스스로 교체한다.
//
// 포함: 워커 실행에 필요한 소스 전부(scripts/, src/, prisma/schema.prisma, 루트 설정).
// 제외: .env* (접속 정보 — 담당자 PC 의 것을 보존해야 한다), node_modules 등.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { zipSync } from "fflate";

const ROOT = process.cwd();
const OUT_DIR = join(ROOT, "worker-dist");

const INCLUDE_DIRS = ["scripts", "src"];
const INCLUDE_FILES = [
  "package.json",
  "pnpm-lock.yaml",
  "tsconfig.json",
  "prisma/schema.prisma",
];
// 접속 정보·로컬 산출물은 절대 담지 않는다. 폰트는 견적서 PDF 렌더링용 — 워커에 불필요한 최대 용량.
const EXCLUDE = /(^|[\\/])(\.env[^\\/]*|node_modules|\.next|worker-dist)([\\/]|$)|\.(ttf|woff2?)$/;

function collect(dir, files) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relative(ROOT, full);
    if (EXCLUDE.test(rel)) continue;
    const st = statSync(full);
    if (st.isDirectory()) collect(full, files);
    else files.push(rel);
  }
  return files;
}

const files = [];
for (const d of INCLUDE_DIRS) collect(join(ROOT, d), files);
for (const f of INCLUDE_FILES) files.push(f);

// zip 경로는 항상 / 구분자 (Windows 빌드에서도)
const entries = {};
for (const rel of files) {
  entries[rel.split(sep).join("/")] = readFileSync(join(ROOT, rel));
}

const version = readFileSync(join(ROOT, "src/lib/scraper/worker-version.ts"), "utf8")
  .match(/WORKER_PROTOCOL_VERSION = (\d+)/)?.[1];
if (!version) throw new Error("WORKER_PROTOCOL_VERSION 을 찾지 못했습니다.");

mkdirSync(OUT_DIR, { recursive: true });
const zipped = zipSync(entries, { level: 6 });
writeFileSync(join(OUT_DIR, "worker.zip"), zipped);
writeFileSync(
  join(OUT_DIR, "version.json"),
  JSON.stringify({ version: Number(version), files: files.length, builtAt: new Date().toISOString() })
);
console.log(`[worker-dist] worker.zip 생성 — v${version}, 파일 ${files.length}개, ${(zipped.length / 1024 / 1024).toFixed(1)}MB`);
