import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SETUP_SCRIPT = resolve(process.cwd(), "scripts/scraper-worker/setup.ps1");

describe("scraper worker setup script", () => {
  it("requires the minimum Node.js version supported by the pinned pnpm", async () => {
    // Given the PowerShell setup script used on worker PCs
    const source = await readFile(SETUP_SCRIPT, "utf8");

    // When its Node.js compatibility guard is inspected
    const nodeGuard = source.slice(source.indexOf("$nodeVersion"), source.indexOf("# ── 2."));

    // Then it compares the complete version against 22.13 and reports the same minimum
    expect(nodeGuard).toContain('[version]"22.13.0"');
    expect(nodeGuard).toMatch(/-lt\s+\$minimumNodeVersion/);
    expect(nodeGuard).toMatch(/22\.13/);
    expect(nodeGuard).not.toContain("$nodeMajor");
  });

  it("collects the worker id with server-matching validation and writes it to the env file", async () => {
    // Given the PowerShell setup script used on worker PCs
    const source = await readFile(SETUP_SCRIPT, "utf8");

    // Then it prompts for the worker id (doctor requires it), validates with the
    // same pattern as WORKER_ID_PATTERN, and persists it alongside the secrets
    expect(source).toContain("SCRAPER_WORKER_ID=$workerId");
    expect(source).toContain("'^[A-Za-z0-9가-힣_-]{1,32}$'");
    // And existing installs whose .env predates the worker-id prompt get asked too
    expect(source).toMatch(/\$keepExisting -and .*SCRAPER_WORKER_ID/);
  });

  it("masks both secrets and clears native plaintext buffers after writing the env file", async () => {
    // Given the PowerShell setup script used to collect worker credentials
    const source = await readFile(SETUP_SCRIPT, "utf8");

    // When its two secret prompts and env-writing block are inspected
    const secretPrompts = source
      .split("\n")
      .filter((line) => line.includes("워커 비밀키\"") || line.includes("암호화 키\""));

    // Then neither value is echoed and both native buffers are zeroed after conversion
    expect(secretPrompts).toHaveLength(2);
    expect(secretPrompts.every((line) => line.includes("-AsSecureString"))).toBe(true);
    expect(source).toContain("PtrToStringBSTR");
    // 확보한 BSTR 버퍼 수만큼 반드시 zero-free 한다 — 호출 횟수 자체는 구현 세부사항이다
    const bstrAllocs = source.match(/SecureStringToBSTR/g) ?? [];
    const bstrFrees = source.match(/ZeroFreeBSTR/g) ?? [];
    expect(bstrAllocs.length).toBeGreaterThanOrEqual(1);
    expect(bstrFrees).toHaveLength(bstrAllocs.length);
  });
});
