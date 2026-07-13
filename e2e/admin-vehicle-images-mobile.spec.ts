import { expect, test } from "./fixtures/admin-vehicle-images";
import { attachVehicleImageObservers } from "./fixtures/vehicle-image-observers";

test("375px image management remains keyboard operable and horizontally contained", async ({ page, vehicleImages }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const observers = attachVehicleImageObservers(page);
  await page.goto(`/admin/vehicles/${vehicleImages.vehicleId}`);
  const basicTab = page.getByRole("tab", { name: "기본정보" });
  await basicTab.focus();
  for (let index = 0; index < 5; index += 1) await page.keyboard.press("ArrowRight");
  const imageTab = page.getByRole("tab", { name: "이미지" });
  await expect(imageTab).toBeFocused();
  await expect(imageTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "차량 이미지 관리" })).toBeVisible();

  const bodyOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(bodyOverflow).toBeLessThanOrEqual(1);
  const coverCard = page.getByTestId(`image-card-${vehicleImages.coverId}`);
  const mainCard = page.getByTestId(`image-card-${vehicleImages.mainId}`);
  const down = coverCard.getByRole("button", { name: "디자인 표지 아래로 이동" });
  await down.focus();
  await page.keyboard.press("Enter");
  await expect(coverCard.getByRole("button", { name: "디자인 표지 위로 이동" })).toBeEnabled();
  await expect(mainCard.getByRole("button", { name: "메인 이미지 아래로 이동" })).toBeEnabled();
  const interactive = page.getByTestId("vehicle-editor").locator([
    "[data-testid='vehicle-editor-header'] a[href]",
    "[role='tablist'] [role='tab']",
    "[role='tabpanel'] a[href]",
    "[role='tabpanel'] button",
  ].join(", "));
  const visibleControls = [];
  for (const control of await interactive.all()) {
    if (!await control.isVisible()) continue;
    visibleControls.push(control);
    await expect(control).toHaveAccessibleName(/\S/);
    const box = await control.boundingBox();
    expect(box, "visible admin control must have a box").not.toBeNull();
    expect(box?.height ?? 0, "visible admin control height").toBeGreaterThanOrEqual(44);
    expect(box?.width ?? 0, "visible admin control width").toBeGreaterThanOrEqual(44);
  }
  expect(visibleControls.length).toBeGreaterThan(0);
  await imageTab.evaluate((element) => element.scrollIntoView({ block: "nearest", inline: "center" }));
  await expect(imageTab).toBeVisible();
  await page.screenshot({ path: ".omo/evidence/carpan2-admin-image-management/task-9-mobile-admin.png", fullPage: true });

  await page.waitForLoadState("networkidle");
  await page.goto(`/cars/${vehicleImages.slug}`);
  await expect.poll(async () => page.locator("img").evaluateAll((images, expectedUrl) => images.some((image) => (
    [image.getAttribute("src") ?? "", image.getAttribute("srcset") ?? ""]
      .some((value) => decodeURIComponent(value).includes(expectedUrl))
  )), vehicleImages.coverUrl)).toBe(true);
  await page.waitForLoadState("networkidle");
  expect(observers.rscRequestCount()).toBe(0);
  await page.screenshot({ path: ".omo/evidence/carpan2-admin-image-management/task-9-mobile.png", fullPage: true });
  observers.assertClean();
});
