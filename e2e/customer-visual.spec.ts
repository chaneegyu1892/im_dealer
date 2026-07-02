import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

// Final screenshot run: E2E_BASE_URL=http://localhost:3000 pnpm exec playwright test e2e/customer-visual.spec.ts
const VISUAL_EVIDENCE_DIR = path.join(
  ".omo",
  "evidence",
  "toss-mobile-redesign",
  "task-5-qa-harness",
  "screenshots"
);

const VIEWPORTS = [
  { name: "mobile-375", width: 375, height: 812 },
  { name: "desktop-1280", width: 1280, height: 900 },
] as const;

const VISUAL_PROFILES = [
  { name: "light", colorScheme: "light", reducedMotion: "no-preference" },
  { name: "dark", colorScheme: "dark", reducedMotion: "no-preference" },
  { name: "reduced-motion", colorScheme: "light", reducedMotion: "reduce" },
] as const;

const STATIC_CUSTOMER_ROUTES = [
  { name: "home", route: "/" },
  { name: "cars", route: "/cars" },
  { name: "recommend", route: "/recommend" },
] as const;

const INVALID_VEHICLE_ROUTE = "/cars/this-slug-does-not-exist-12345";

type VisualContext = {
  readonly profile: (typeof VISUAL_PROFILES)[number];
  readonly viewport: (typeof VIEWPORTS)[number];
};

test.use({
  screenshot: "off",
  trace: "off",
  video: "off",
});

test.beforeAll(async () => {
  await mkdir(VISUAL_EVIDENCE_DIR, { recursive: true });
});

async function applyVisualContext(page: Page, context: VisualContext): Promise<void> {
  await page.setViewportSize({
    width: context.viewport.width,
    height: context.viewport.height,
  });
  await page.emulateMedia({
    colorScheme: context.profile.colorScheme,
    reducedMotion: context.profile.reducedMotion,
  });
  await page.addInitScript((colorScheme) => {
    const applyColorScheme = () => {
      document.documentElement.classList.toggle("dark", colorScheme === "dark");
    };

    if (document.documentElement === null) {
      document.addEventListener("DOMContentLoaded", applyColorScheme, { once: true });
      return;
    }

    applyColorScheme();
  }, context.profile.colorScheme);
}

async function waitForStableRoute(page: Page): Promise<void> {
  try {
    await page.waitForLoadState("networkidle", { timeout: 5_000 });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return;
    }
    throw error;
  }
}

async function captureRoute(
  page: Page,
  context: VisualContext,
  routeName: string,
  route: string
): Promise<void> {
  await page.goto(route, { waitUntil: "domcontentloaded" });
  await waitForStableRoute(page);
  await page.screenshot({
    path: path.join(
      VISUAL_EVIDENCE_DIR,
      `${context.profile.name}-${context.viewport.name}-${routeName}.png`
    ),
    fullPage: true,
  });
}

function extractVehicleSlug(href: string): string | null {
  const match = /^\/cars\/([a-z0-9-]+)(?:[?#].*)?$/.exec(href);
  return match?.[1] ?? null;
}

async function firstVehicleSlugFromCurrentPage(page: Page): Promise<string | null> {
  const hrefs = await page
    .locator('a[href^="/cars/"]:not([href="/cars"])')
    .evaluateAll((anchors) =>
      anchors
        .map((anchor) => anchor.getAttribute("href"))
        .filter((href): href is string => href !== null)
    );

  for (const href of hrefs) {
    const slug = extractVehicleSlug(href);
    if (slug !== null) {
      return slug;
    }
  }

  return null;
}

async function findVehicleSlug(page: Page): Promise<string | null> {
  for (const route of ["/", "/cars"] as const) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await waitForStableRoute(page);

    const slug = await firstVehicleSlugFromCurrentPage(page);
    if (slug !== null) {
      return slug;
    }
  }

  return null;
}

test.describe("customer visual QA route capture harness", () => {
  for (const profile of VISUAL_PROFILES) {
    for (const viewport of VIEWPORTS) {
      const context = { profile, viewport } satisfies VisualContext;

      test(`captures customer routes at ${profile.name} ${viewport.name}`, async ({ page }) => {
        await applyVisualContext(page, context);

        for (const route of STATIC_CUSTOMER_ROUTES) {
          await captureRoute(page, context, route.name, route.route);
        }
      });

      test(`captures quote route at ${profile.name} ${viewport.name}`, async ({
        page,
      }) => {
        await applyVisualContext(page, context);

        const vehicleSlug = await findVehicleSlug(page);
        if (vehicleSlug === null) {
          const reason =
            "No vehicle slug found on / or /cars; /quote?vehicle=<slug> visual capture skipped.";
          test.info().annotations.push({ type: "skip", description: reason });
          test.skip(true, reason);
          return;
        }

        await captureRoute(page, context, "quote", `/quote?vehicle=${vehicleSlug}`);
      });

      test(`captures invalid vehicle slug at ${profile.name} ${viewport.name}`, async ({
        page,
      }) => {
        const pageErrors: Error[] = [];
        page.on("pageerror", (error) => {
          pageErrors.push(error);
        });

        await applyVisualContext(page, context);
        await captureRoute(page, context, "invalid-vehicle-slug", INVALID_VEHICLE_ROUTE);

        const hasNotFoundHeading = await page
          .getByRole("heading", { name: /페이지를 찾을 수 없습니다|차량을 찾을 수 없습니다/ })
          .isVisible();

        if (!hasNotFoundHeading) {
          expect(
            pageErrors,
            "invalid slug should show the 404 heading or render without uncaught exceptions"
          ).toHaveLength(0);
        }
      });
    }
  }
});
