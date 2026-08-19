import { describe, expect, it } from "vitest";

import { collectWorkerFiles } from "./make-worker-dist.mjs";

// zip 은 워커 시크릿만 있으면 받을 수 있다. 범위가 넓어지면 그만큼 소스가 새어나가고,
// 반대로 좁아지면 담당자 PC 가 자동 업데이트 직후 죽는다. 양쪽을 다 막는다.
describe("워커 배포 zip 범위", () => {
  const files = collectWorkerFiles();

  it("워커 실행에 필요한 파일을 담는다", () => {
    // Given 워커가 담당자 PC 에서 실행되는 데 필요한 파일들
    const required = [
      "scripts/scraper-worker/index.ts", // 워커 본체
      "scripts/scraper-worker/doctor.ts", // 연결 점검
      "scripts/scraper-worker/load-env.ts", // 부수효과 전용 import — 추적에서 놓치기 쉽다
      "scripts/scraper-worker/run.ps1", // 자동 업데이트 로직이 여기 있다
      "scripts/scraper-worker/adapters/registry.ts",
      "src/lib/pii.ts", // 자격증명 복호화
      "src/lib/scraper/worker-version.ts", // 버전 비교 기준
      "package.json",
      "pnpm-lock.yaml",
      "tsconfig.json",
      "prisma/schema.prisma", // postinstall 의 prisma generate 가 읽는다
    ];

    // When zip 파일 목록을 만들면
    // Then 하나도 빠지지 않는다
    expect(files).toEqual(expect.arrayContaining(required));
  });

  it("워커 폴더의 한글 실행 파일을 담는다", () => {
    // Given 담당자가 더블클릭하는 두 파일 (import 로 추적되지 않는다)
    // When zip 파일 목록을 만들면
    // Then 둘 다 들어 있다
    expect(files).toContain("scripts/scraper-worker/설치하기.bat");
    expect(files).toContain("scripts/scraper-worker/수집 시작.bat");
  });

  it("워커와 무관한 앱 소스는 담지 않는다", () => {
    // Given 관리자 페이지·API 라우트·UI 컴포넌트처럼 워커가 실행하지 않는 영역
    const offLimits = ["src/app/", "src/components/", "src/hooks/"];

    // When zip 파일 목록을 만들면
    // Then 어느 것도 포함되지 않는다
    for (const prefix of offLimits) {
      expect(files.filter((f) => f.startsWith(prefix))).toEqual([]);
    }
  });

  it("접속 정보 파일은 절대 담지 않는다", () => {
    // Given 담당자 PC 의 .env 는 덮어쓰기에서 보존돼야 한다
    // When zip 파일 목록을 만들면
    // Then .env 계열이 하나도 없다
    expect(files.filter((f) => /(^|\/)\.env/.test(f))).toEqual([]);
  });

  it("범위가 다시 앱 전체로 넓어지지 않는다", () => {
    // Given src 를 통째로 담던 시절의 1,067개
    // When zip 파일 목록을 만들면
    // Then 워커 실행에 필요한 규모(현재 75개)를 크게 벗어나지 않는다
    expect(files.length).toBeLessThan(200);
    expect(files.filter((f) => f.startsWith("src/")).length).toBeLessThan(50);
  });
});
