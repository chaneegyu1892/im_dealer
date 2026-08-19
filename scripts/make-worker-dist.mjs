// 워커 배포 zip 생성 — 빌드 시 실행되어 worker-dist/worker.zip 을 만든다.
// /api/worker/update 가 이 zip 을 (워커 시크릿 인증 후) 내려주고,
// 담당자 PC 의 '수집 시작.bat'(run.ps1)이 버전 불일치 시 받아서 스스로 교체한다.
//
// ── 담는 범위 ──
//   scripts/scraper-worker/**  워커 소유 파일 전부. .ps1/.bat/README 처럼 import 로
//                              추적되지 않는 것들이 있어 통째로 담는다.
//   src/**                     워커 코드가 import 로 실제 도달하는 것만.
//   루트 설정                   package.json / pnpm-lock.yaml / tsconfig.json / schema.prisma
//
// src 를 통째로 담지 않는 이유: 이 zip 은 워커 시크릿만 있으면 받을 수 있다.
// 관리자 페이지·API 라우트처럼 워커와 무관한 소스까지 넣으면 노출 범위만 넓어진다.
// (통째로 담던 시절 1,067개 → 도달 추적 75개)
//
// 제외: .env* (접속 정보 — 담당자 PC 의 것을 보존해야 한다), node_modules 등.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";

const ROOT = process.cwd();
const OUT_DIR = join(ROOT, "worker-dist");
const WORKER_DIR = "scripts/scraper-worker";
const ROOT_FILES = ["package.json", "pnpm-lock.yaml", "tsconfig.json", "prisma/schema.prisma"];

// 접속 정보·로컬 산출물은 절대 담지 않는다. 폰트는 견적서 PDF 렌더링용 — 워커에 불필요한 최대 용량.
const EXCLUDE = /(^|[\\/])(\.env[^\\/]*|node_modules|\.next|worker-dist)([\\/]|$)|\.(ttf|woff2?)$/;
const CODE_FILE = /\.(ts|tsx|mts|cts|mjs|cjs|js|jsx)$/;

// import 지정자에 붙여볼 확장자. 확장자 없는 import 와 디렉터리 index 를 모두 커버한다.
const TRY_EXT = ["", ".ts", ".tsx", ".mts", ".cts", ".mjs", ".cjs", ".js", ".jsx", ".json"];
const TRY_INDEX = ["/index.ts", "/index.tsx", "/index.mts", "/index.mjs", "/index.js"];

// 정적 import 지정자 추출. 여러 줄에 걸친 named import, 부수효과 전용 import,
// 재수출, 문자열 리터럴 동적 import, require 를 모두 잡는다.
const SPEC_PATTERNS = [
  /(?:^|\n)\s*(?:import|export)\s[\s\S]*?\sfrom\s+["']([^"']+)["']/g,
  /(?:^|\n)\s*import\s+["']([^"']+)["']/g,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
];
// 변수를 받는 동적 import 는 정적 추적이 불가능하다. 조용히 빠지면 담당자 PC 가
// 업데이트 직후 죽으므로, 발견 즉시 빌드를 실패시킨다.
const NON_LITERAL_IMPORT = /\bimport\s*\(\s*(?!["'])/;

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (EXCLUDE.test(relative(ROOT, full))) continue;
    if (statSync(full).isDirectory()) walk(full, files);
    else files.push(relative(ROOT, full));
  }
  return files;
}

/** import 지정자를 실제 파일 경로로 해석. npm 패키지면 "external", 못 찾으면 null. */
function resolveSpec(spec, fromFile) {
  let base;
  if (spec.startsWith("@/")) base = join(ROOT, "src", spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(fromFile), spec);
  else return "external";

  // TS 소스가 "./foo.js" 로 쓴 경우 foo.ts 도 후보에 넣는다.
  const bases = base.endsWith(".js") ? [base, base.slice(0, -3)] : [base];
  for (const b of bases) {
    for (const suffix of [...TRY_EXT, ...TRY_INDEX]) {
      const candidate = b + suffix;
      if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
    }
  }
  return null;
}

/**
 * 워커 폴더의 모든 코드 파일에서 출발해 도달 가능한 src 파일을 모은다.
 * 진입점을 따로 지정하지 않고 폴더 전체를 출발점으로 삼는다 — 어느 파일이
 * 진입점인지 판단할 필요가 없고, 새 파일이 생겨도 자동으로 따라온다.
 */
function traceSrcDependencies(workerFiles) {
  const unresolved = [];
  const dynamic = [];
  const visited = new Set();
  const queue = workerFiles.filter((f) => CODE_FILE.test(f)).map((f) => join(ROOT, f));

  while (queue.length > 0) {
    const file = queue.pop();
    if (visited.has(file)) continue;
    visited.add(file);

    const source = readFileSync(file, "utf8");
    if (NON_LITERAL_IMPORT.test(source)) dynamic.push(relative(ROOT, file));

    for (const pattern of SPEC_PATTERNS) {
      for (const match of source.matchAll(pattern)) {
        const spec = match[1];
        const resolved = resolveSpec(spec, file);
        if (resolved === "external") continue;
        if (resolved === null) unresolved.push(`${relative(ROOT, file)} → ${spec}`);
        else queue.push(resolved);
      }
    }
  }

  if (dynamic.length > 0) {
    throw new Error(
      "워커 코드에 변수를 받는 동적 import 가 있어 zip 범위를 정적으로 계산할 수 없습니다.\n" +
        dynamic.map((f) => `  - ${f}`).join("\n") +
        "\n문자열 리터럴 import 로 바꾸거나, 이 스크립트에 수동 포함 목록을 추가하세요."
    );
  }
  if (unresolved.length > 0) {
    throw new Error(
      "import 를 해석하지 못했습니다. zip 에서 누락되면 담당자 PC 가 업데이트 직후 죽습니다.\n" +
        unresolved.map((u) => `  - ${u}`).join("\n")
    );
  }

  return [...visited]
    .map((f) => relative(ROOT, f))
    .filter((f) => f.split(sep).join("/").startsWith("src/"));
}

/** zip 에 담을 파일 목록(레포 루트 기준 상대경로). 테스트에서도 쓴다. */
export function collectWorkerFiles() {
  const workerFiles = walk(join(ROOT, WORKER_DIR));
  const srcFiles = traceSrcDependencies(workerFiles);

  if (srcFiles.length === 0) {
    throw new Error("워커가 도달하는 src 파일이 하나도 없습니다 — 추적이 깨졌습니다.");
  }
  for (const f of ROOT_FILES) {
    if (!existsSync(join(ROOT, f))) throw new Error(`필수 파일이 없습니다: ${f}`);
  }

  return [...new Set([...workerFiles, ...srcFiles, ...ROOT_FILES])]
    .map((f) => f.split(sep).join("/"))
    .sort();
}

function main() {
  const files = collectWorkerFiles();

  const entries = {};
  for (const rel of files) entries[rel] = readFileSync(join(ROOT, rel));

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

  const srcCount = files.filter((f) => f.startsWith("src/")).length;
  console.log(
    `[worker-dist] worker.zip 생성 — v${version}, 파일 ${files.length}개(src ${srcCount}개), ` +
      `${(zipped.length / 1024 / 1024).toFixed(2)}MB`
  );
}

// import 될 때(테스트)는 실행하지 않는다.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
