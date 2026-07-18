import { describe, expect, it } from "vitest";
import { buildBrowserLaunchArgs } from "./browser-launch";

describe("buildBrowserLaunchArgs", () => {
  it("keeps Chromium sandboxing enabled by default", () => {
    expect(buildBrowserLaunchArgs({ nodeEnv: "production", disableSandbox: false })).not.toContain("--no-sandbox");
    expect(buildBrowserLaunchArgs({ nodeEnv: "development", disableSandbox: false })).not.toContain("--disable-setuid-sandbox");
  });

  it("allows an explicit non-production opt-in", () => {
    expect(buildBrowserLaunchArgs({ nodeEnv: "development", disableSandbox: true })).toEqual(
      expect.arrayContaining(["--no-sandbox", "--disable-setuid-sandbox"])
    );
    expect(buildBrowserLaunchArgs({ nodeEnv: "production", disableSandbox: true })).not.toContain("--no-sandbox");
    expect(buildBrowserLaunchArgs({ nodeEnv: undefined, disableSandbox: true })).not.toContain("--no-sandbox");
  });
});
