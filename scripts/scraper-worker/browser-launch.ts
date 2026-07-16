const DEFAULT_ARGS = ["--disable-gpu", "--disable-dev-shm-usage"];

interface BrowserLaunchOptions {
  nodeEnv: string | undefined;
  disableSandbox: boolean;
}

export function buildBrowserLaunchArgs(options: BrowserLaunchOptions): string[] {
  const allowUnsafeDevelopmentSandboxOverride =
    options.nodeEnv === "development" && options.disableSandbox;
  return allowUnsafeDevelopmentSandboxOverride
    ? [...DEFAULT_ARGS, "--no-sandbox", "--disable-setuid-sandbox"]
    : [...DEFAULT_ARGS];
}
