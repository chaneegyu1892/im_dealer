import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { CANONICAL_SITE_URL } from "@/lib/site-config";

const ROOT = resolve(process.cwd());
const SCAN_DIRS = [".github", "prisma", "scripts", "src"];
const SCAN_FILES = ["next.config.mjs", "package.json", "vercel.json"];
const SKIP = /(^|[\\/])(node_modules|\.next|\.git|dist|build)([\\/]|$)/;
const TEXT_FILE = /\.(ts|tsx|mts|cts|mjs|cjs|js|jsx|json|ya?ml|md|sh|ps1|bat|prisma)$/;

// 이 파일 자체는 오탐을 만들므로 뺀다 (틀린 도메인을 문자열로 들고 있다).
const SELF = relative(ROOT, __filename).split("\\").join("/");

// 운영 도메인은 imdealer.co.kr 이다. imdealers.com 은 존재하지 않는 도메인인데도
// CI 빌드 주입값·이미지 호스트·시드 관리자 이메일에 흩어져 있었다.
const WRONG_DOMAIN = "imdealers.com";

function walk(dir: string, found: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (SKIP.test(relative(ROOT, full))) continue;
    if (statSync(full).isDirectory()) walk(full, found);
    else if (TEXT_FILE.test(full)) found.push(full);
  }
  return found;
}

describe("운영 도메인 일관성", () => {
  const files = [
    ...SCAN_DIRS.flatMap((dir) => walk(join(ROOT, dir))),
    ...SCAN_FILES.map((file) => join(ROOT, file)),
  ].filter((file) => relative(ROOT, file).split("\\").join("/") !== SELF);

  it("존재하지 않는 도메인을 참조하지 않는다", () => {
    // Given 레포의 설정·소스 파일 전체
    const offenders = files
      .filter((file) => readFileSync(file, "utf8").includes(WRONG_DOMAIN))
      .map((file) => relative(ROOT, file));

    // When 잘못된 도메인을 찾으면
    // Then 한 곳도 없다
    expect(offenders).toEqual([]);
  });

  it("정본 도메인이 실제 운영 주소를 가리킨다", () => {
    // Given 메타데이터·canonical URL 이 이 값을 기준으로 생성된다
    // When 정본 상수를 확인하면
    // Then 운영 도메인이다
    expect(CANONICAL_SITE_URL).toBe("https://imdealer.co.kr");
  });
});
