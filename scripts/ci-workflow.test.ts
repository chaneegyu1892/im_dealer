import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { CANONICAL_SITE_URL } from "@/lib/site-config";

const WORKFLOW = readFileSync(resolve(process.cwd(), ".github/workflows/ci.yml"), "utf8");
const RETRY_SCRIPT = readFileSync(resolve(process.cwd(), ".github/scripts/retry.sh"), "utf8");

describe("CI 워크플로", () => {
  it("빌드에 주입하는 사이트 주소가 운영 도메인과 일치한다", () => {
    // Given NEXT_PUBLIC_ 값은 빌드 산출물에 그대로 박히므로 틀리면 잘못된 절대 URL 이 생긴다
    const injected = [...WORKFLOW.matchAll(/NEXT_PUBLIC_APP_URL:\s*(\S+)/g)].map((m) => m[1]);

    // When 워크플로가 주입하는 값들을 모으면
    // Then localhost(E2E 용) 아니면 운영 도메인뿐이다
    expect(injected.length).toBeGreaterThan(0);
    for (const value of injected) {
      if (value.startsWith("http://localhost")) continue;
      expect(value).toBe(CANONICAL_SITE_URL);
    }
  });

  it("네트워크 설치 명령을 재시도로 감싼다", () => {
    // Given apt 미러가 멈추면 잡 타임아웃까지 매달린다 (2026-08-19 E2E 2잡 소실)
    const fragile = WORKFLOW.split("\n").filter(
      (line) => /\bapt-get\b/.test(line) || /playwright install\b/.test(line)
    );

    // When 네트워크에 의존하는 설치 호출을 모으면
    // Then 전부 retry.sh 를 거친다
    expect(fragile.length).toBeGreaterThan(0);
    for (const line of fragile) {
      expect(line).toContain("retry.sh");
    }
  });

  it("설치 스텝에 시간 상한이 걸려 있다", () => {
    // Given 상한이 없으면 멈춘 스텝이 잡 예산을 통째로 먹는다
    const steps = WORKFLOW.split(/^      - /m).filter((s) => s.includes("retry.sh"));

    // When retry.sh 를 쓰는 스텝을 모으면
    // Then 각각 timeout-minutes 를 갖는다
    expect(steps.length).toBeGreaterThan(0);
    for (const step of steps) {
      expect(step).toMatch(/timeout-minutes:\s*\d+/);
    }
  });
});

describe("retry.sh", () => {
  it("명령 종료코드를 즉시 받아 전파한다", () => {
    // Given `if cmd; then ... fi` 뒤의 $? 는 조건이 아니라 if 문 자체의 상태(0)라,
    // 실패를 삼키고 성공으로 보고하게 된다. 실제로 처음 작성 때 이 버그가 났다.
    const lines = RETRY_SCRIPT.split("\n").map((l) => l.trim());
    const commandLine = lines.findIndex((l) => l.startsWith("timeout --kill-after"));

    // When 명령 실행 지점을 찾으면
    // Then 바로 다음 줄에서 종료코드를 붙잡는다
    expect(commandLine).toBeGreaterThan(-1);
    expect(lines[commandLine + 1]).toBe("status=$?");
    expect(RETRY_SCRIPT).toContain('exit "$status"');
  });
});
