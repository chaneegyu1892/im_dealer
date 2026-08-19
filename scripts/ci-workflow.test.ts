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

  it("네트워크 설치 명령이 무한정 매달리지 않는다", () => {
    // Given apt 미러가 멈추면 잡 타임아웃까지 매달린다 (2026-08-19 E2E 2잡 소실).
    // 재시도(retry.sh)든 단발 timeout 이든, 상한 없는 호출이 하나도 없어야 한다.
    // 주석과 echo 문구는 명령이 아니다 (경고 메시지에도 명령 이름이 들어간다).
    const fragile = WORKFLOW.split("\n")
      .map((line) => line.trim())
      .filter((line) => !line.startsWith("#") && !line.startsWith("echo "))
      .filter((line) => /\bapt-get\b/.test(line) || /playwright install\b/.test(line));

    // When 네트워크에 의존하는 설치 호출을 모으면
    // Then 전부 시간 상한을 갖는다
    expect(fragile.length).toBeGreaterThan(0);
    for (const line of fragile) {
      expect(line).toMatch(/retry\.sh|timeout --kill-after/);
    }
  });

  it("apt 재시도에 락 정리를 물려 둔다", () => {
    // Given 중단된 apt 가 락을 쥔 채 남으면 이후 재시도가 전부 lock 오류로 즉사한다.
    // 실제로 2026-08-19 에 재시도 2·3 회가 이렇게 무의미해졌다.
    const aptRetrySteps = WORKFLOW.split(/^      - /m).filter(
      (step) => step.includes("apt-get") && step.includes("retry.sh")
    );

    // When apt 를 재시도하는 스텝을 모으면
    // Then 정리 훅이 걸려 있다
    expect(aptRetrySteps.length).toBeGreaterThan(0);
    for (const step of aptRetrySteps) {
      expect(step).toContain("RETRY_CLEANUP");
    }
  });

  it("설치 스텝에 시간 상한이 걸려 있다", () => {
    // Given 상한이 없으면 멈춘 스텝이 잡 예산을 통째로 먹는다
    const steps = WORKFLOW.split(/^      - /m).filter(
      (step) => step.includes("retry.sh") || /playwright install\b/.test(step)
    );

    // When 네트워크 설치를 하는 스텝을 모으면
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
