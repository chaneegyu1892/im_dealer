import { expect, test } from "@playwright/test";

const CUSTOMER_ROUTES = [
  "/",
  "/cars",
  "/recommend",
  "/quote?vehicle=sonata",
] as const;

test("운영체제가 다크여도 고객 화면은 라이트 토큰을 유지한다", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });

  for (const route of CUSTOMER_ROUTES) {
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });

    expect(response?.status(), `${route} should load without a server error`).toBeLessThan(500);

    const themeState = await page.evaluate(() => {
      const root = document.documentElement;
      const rootStyle = getComputedStyle(root);
      const bodyStyle = getComputedStyle(document.body);

      return {
        hasDarkClass: root.classList.contains("dark"),
        inlineColorScheme: root.style.colorScheme,
        cssColorScheme: rootStyle.colorScheme,
        appBackground: rootStyle.getPropertyValue("--color-app-bg").trim().toLowerCase(),
        surface: rootStyle.getPropertyValue("--color-surface").trim().toLowerCase(),
        textStrong: rootStyle.getPropertyValue("--color-text-strong").trim().toLowerCase(),
        bodyBackground: bodyStyle.backgroundColor,
      };
    });

    expect(themeState, `${route} should ignore the OS dark preference`).toEqual({
      hasDarkClass: false,
      inlineColorScheme: "",
      cssColorScheme: "light",
      appBackground: "#f5f6fa",
      surface: "#fff",
      textStrong: "#191f28",
      bodyBackground: "rgb(245, 246, 250)",
    });
  }
});
