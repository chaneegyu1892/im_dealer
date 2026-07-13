import type { Page } from "@playwright/test";
import { z } from "zod";
import { expect, readRecommendationBytes, test } from "./fixtures/admin-vehicle-images";
import { attachVehicleImageObservers, readVehicleImageStorageState } from "./fixtures/vehicle-image-observers";

const RecommendationResponseSchema = z.object({
  sessionId: z.string(),
  vehicles: z.array(z.object({
    vehicleId: z.string(),
    vehicle: z.object({ thumbnailUrl: z.string() }),
  }).passthrough()),
});

async function expectRepresentativeProjection(page: Page, expectedUrl: string): Promise<void> {
  await expect(page.getByText("E2E 차량", { exact: true }).first()).toBeVisible();
  await expect.poll(async () => page.locator("img").evaluateAll((images, projectedUrl) => images.some((image) => {
    const values = [image.getAttribute("src") ?? "", image.getAttribute("srcset") ?? ""];
    return values.some((value) => decodeURIComponent(value).includes(projectedUrl));
  }), expectedUrl)).toBe(true);
}

test("admin image lifecycle projects the current representative without mutating frozen recommendations", async ({ page, vehicleImages }) => {
  const observers = attachVehicleImageObservers(page);
    await page.goto(`/admin/vehicles/${vehicleImages.vehicleId}`);
    await page.getByRole("tab", { name: "이미지" }).click();
    await expect(page.getByRole("heading", { name: "차량 이미지 관리" })).toBeVisible();
    await expect(page.getByTestId(`image-card-${vehicleImages.coverId}`).getByText("대표 이미지", { exact: true })).toBeVisible();
    await expect(page.getByTestId(`trash-${vehicleImages.trashedId}`)).toBeVisible();

    await page.getByRole("heading", { name: "대표 및 주요 이미지" }).locator("xpath=ancestor::section").getByRole("button", { name: "이미지 추가" }).click();
    await page.getByLabel("이미지 파일").setInputFiles({ name: "admin-upload.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XhNnAAAAAElFTkSuQmCC", "base64") });
    await page.getByLabel("이미지 제목").fill("업로드 E2E");
    await page.getByRole("button", { name: "이미지 업로드" }).click();
    await expect(page.getByText("업로드 E2E", { exact: true })).toBeVisible();

    let uploadedCard = page.getByText("업로드 E2E", { exact: true }).locator("xpath=ancestor::article");
    await uploadedCard.getByRole("button", { name: "업로드 E2E 수정" }).click();
    await page.getByLabel("이미지 제목").fill("업로드 E2E 수정");
    await page.getByLabel("이미지 유형").selectOption("SPEC_EXTERIOR");
    await page.getByRole("button", { name: "변경사항 저장" }).click();
    await expect(page.getByText("업로드 E2E 수정", { exact: true })).toBeVisible();
    uploadedCard = page.getByText("업로드 E2E 수정", { exact: true }).locator("xpath=ancestor::article");

    await uploadedCard.getByRole("button", { name: "업로드 E2E 수정 대표로 지정" }).click();
    await expect(uploadedCard.getByText("대표 이미지", { exact: true })).toBeVisible();
    await page.getByTestId(`image-card-${vehicleImages.coverId}`).getByRole("button", { name: "디자인 표지 숨기기" }).click();
    await expect(page.getByTestId(`image-card-${vehicleImages.coverId}`).getByLabel("숨김")).toBeVisible();
    await uploadedCard.getByRole("button", { name: "업로드 E2E 수정 위로 이동" }).click();

    await page.getByTestId(`image-card-${vehicleImages.mainId}`).getByRole("button", { name: "메인 이미지 대표로 지정" }).click();
    await expect(page.getByTestId(`image-card-${vehicleImages.mainId}`).getByText("대표 이미지", { exact: true })).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await uploadedCard.getByRole("button", { name: "업로드 E2E 수정 휴지통으로 이동" }).click();
    let trash = page.getByText("업로드 E2E 수정", { exact: true }).locator("xpath=ancestor::article");
    await trash.getByRole("button", { name: "업로드 E2E 수정 복원" }).click();
    uploadedCard = page.getByText("업로드 E2E 수정", { exact: true }).locator("xpath=ancestor::article");
    page.once("dialog", (dialog) => dialog.accept());
    await uploadedCard.getByRole("button", { name: "업로드 E2E 수정 휴지통으로 이동" }).click();
    trash = page.getByText("업로드 E2E 수정", { exact: true }).locator("xpath=ancestor::article");
    page.once("dialog", (dialog) => dialog.accept());
    await trash.getByRole("button", { name: "업로드 E2E 수정 영구 삭제" }).click();
    await expect(page.getByText("업로드 E2E 수정", { exact: true })).toHaveCount(0);

    const storageState = await readVehicleImageStorageState(vehicleImages.vehicleId);
    expect(storageState.some((image) => image.id === vehicleImages.coverId && !image.isVisible)).toBe(true);
    expect(storageState.some((image) => image.adminStoragePath !== null)).toBe(false);
    await expect(page.getByTestId(`image-card-${vehicleImages.mainId}`).getByText("대표 이미지", { exact: true })).toBeVisible();
    await expect(page.getByTestId(`trash-${vehicleImages.trashedId}`)).toBeVisible();
    await page.getByRole("heading", { name: "차량 이미지 관리" }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: ".omo/evidence/carpan2-admin-image-management/task-9-desktop-admin.png", fullPage: true });
    await page.getByTestId(`trash-${vehicleImages.trashedId}`).scrollIntoViewIfNeeded();
    await page.screenshot({ path: ".omo/evidence/carpan2-admin-image-management/task-9-desktop-admin-trash.png", fullPage: true });

    for (const path of ["/", "/cars", `/cars/${vehicleImages.slug}`]) {
      await page.goto(path);
      await expectRepresentativeProjection(page, vehicleImages.mainUrl);
      await page.waitForLoadState("networkidle");
    }
    const quote = await page.request.get(`/quote?vehicle=${vehicleImages.slug}&customerType=individual`);
    expect(quote.ok()).toBe(true);
    expect(await quote.text()).toContain(vehicleImages.mainUrl);

    expect(await readRecommendationBytes(vehicleImages.frozenSessionId)).toBe(vehicleImages.frozenBytes);
    const recommendation = await page.request.post("/api/recommend", { data: {
      industry: "개인", industryDetail: "2~3명", preferences: ["안정감"], primaryPreference: "안정감",
      annualMileage: 20_000, fuelPreference: "가솔린/디젤", residenceRegion: "일반", returnType: "미정",
    } });
    expect(recommendation.ok()).toBe(true);
    const current = RecommendationResponseSchema.parse(await recommendation.json());
    expect(current.vehicles).toContainEqual(expect.objectContaining({
      vehicleId: vehicleImages.vehicleId,
      vehicle: expect.objectContaining({ thumbnailUrl: vehicleImages.mainUrl }),
    }));
    const currentBytes = await readRecommendationBytes(current.sessionId);
    expect(currentBytes).toContain(vehicleImages.mainUrl);
    expect(currentBytes).not.toBe(vehicleImages.frozenBytes);
    expect(await readRecommendationBytes(vehicleImages.frozenSessionId)).toBe(vehicleImages.frozenBytes);
    expect(observers.rscRequestCount()).toBe(0);
    await page.screenshot({ path: ".omo/evidence/carpan2-admin-image-management/task-9-desktop.png", fullPage: true });
  observers.assertClean();
});
