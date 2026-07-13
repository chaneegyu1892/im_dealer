import { z } from "zod";
import {
  expect,
  readVehicleImageCleanupState,
  test,
  verifyForcedFailureCleanup,
} from "./fixtures/admin-vehicle-images";
import { attachVehicleImageObservers, readVehicleImageStorageState } from "./fixtures/vehicle-image-observers";

const ImageListSchema = z.object({
  data: z.object({
    imageRevision: z.number().int().nonnegative(),
    images: z.array(z.object({ id: z.string(), updatedAt: z.string() })),
  }),
});

const ImageMutationResponseSchema = z.object({
  data: z.object({
    image: z.object({ updatedAt: z.string().datetime({ offset: true }) }),
    imageRevision: z.number().int().nonnegative(),
  }),
});

const FailureResponseSchema = z.object({ error: z.string().optional(), code: z.string().optional() });

test("guarded failures reject invalid, stale, representative and unauthorized mutations without residue", async ({ page, vehicleImages, browser }) => {
  const observers = attachVehicleImageObservers(page);
    const badLogin = await page.request.post("/api/e2e/vehicle-image-admin-login", { data: { email: process.env.E2E_ADMIN_EMAIL, password: "wrong" } });
    expect(badLogin.status()).toBe(401);

    const outsider = await browser.newContext({ baseURL: process.env.E2E_BASE_URL });
    try {
      const unauthorized = await outsider.request.get(`/api/admin/vehicles/${vehicleImages.vehicleId}/images`);
      expect(unauthorized.status()).toBe(401);
    } finally {
      await outsider.close();
    }

    await page.goto(`/admin/vehicles/${vehicleImages.vehicleId}`);
    await page.getByRole("tab", { name: "이미지" }).click();
    await page.getByRole("heading", { name: "대표 및 주요 이미지" }).locator("xpath=ancestor::section").getByRole("button", { name: "이미지 추가" }).click();
    await page.getByLabel("이미지 파일").setInputFiles({ name: "bad.txt", mimeType: "text/plain", buffer: Buffer.from("not an image") });
    await page.getByLabel("이미지 제목").fill("잘못된 형식 업로드");
    const invalidToken = observers.expectFailureOnce({
      method: "POST", pathname: `/api/admin/vehicles/${vehicleImages.vehicleId}/images`, status: 400,
    });
    const invalidResponse = page.waitForResponse((response) => response.request().method() === "POST"
      && new URL(response.url()).pathname === `/api/admin/vehicles/${vehicleImages.vehicleId}/images`);
    await page.getByRole("button", { name: "이미지 업로드" }).click();
    const invalid = await invalidResponse;
    expect(invalid.status()).toBe(400);
    expect(FailureResponseSchema.parse(await invalid.json()).error).toBe("UNSUPPORTED_MIME");
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText("이미지 파일만 업로드");
    invalidToken.confirm();
    await page.screenshot({ path: ".omo/evidence/carpan2-admin-image-management/task-9-failure-invalid.png", fullPage: true });
    await page.getByRole("dialog").getByRole("button", { name: "닫기", exact: true }).click();

    const list = await page.request.get(`/api/admin/vehicles/${vehicleImages.vehicleId}/images`);
    expect(list.ok()).toBe(true);
    const body = ImageListSchema.parse(await list.json());
    const main = body.data.images.find((image) => image.id === vehicleImages.mainId);
    const cover = body.data.images.find((image) => image.id === vehicleImages.coverId);
    expect(main).toBeDefined();
    expect(cover).toBeDefined();
    if (!main || !cover) throw new Error("seeded image list is incomplete");
    await page.getByTestId(`image-card-${vehicleImages.mainId}`).getByRole("button", { name: "메인 이미지 수정" }).click();
    const first = await page.request.patch(`/api/admin/vehicles/${vehicleImages.vehicleId}/images/${vehicleImages.coverId}`, {
      data: {
        expectedUpdatedAt: cover.updatedAt,
        expectedImageRevision: body.data.imageRevision,
        title: "외부 수정 A",
        type: "COVER",
      },
    });
    expect(first.ok()).toBe(true);
    const firstBody = ImageMutationResponseSchema.parse(await first.json());
    expect(firstBody.data.imageRevision).toBe(body.data.imageRevision + 1);
    await page.getByLabel("이미지 제목").fill("오래된 수정 B");
    const staleToken = observers.expectFailureOnce({
      method: "PATCH", pathname: `/api/admin/vehicles/${vehicleImages.vehicleId}/images/${vehicleImages.mainId}`, status: 409,
    });
    const staleResponse = page.waitForResponse((response) => response.request().method() === "PATCH"
      && new URL(response.url()).pathname === `/api/admin/vehicles/${vehicleImages.vehicleId}/images/${vehicleImages.mainId}`);
    await page.getByRole("button", { name: "변경사항 저장" }).click();
    const stale = await staleResponse;
    expect(stale.status()).toBe(409);
    expect(FailureResponseSchema.parse(await stale.json()).code).toBe("STALE_IMAGE_REVISION");
    const staleAlert = page.getByRole("tabpanel").getByRole("alert");
    await expect(staleAlert).toContainText("최신");
    staleToken.confirm();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await staleAlert.scrollIntoViewIfNeeded();
    await page.screenshot({ path: ".omo/evidence/carpan2-admin-image-management/task-9-failure-stale.png", fullPage: true });
    await page.getByRole("button", { name: "최신 상태 다시 불러오기" }).click();
    await expect(page.getByTestId(`image-card-${vehicleImages.coverId}`).getByText("외부 수정 A", { exact: true })).toBeVisible();
    await expect(page.getByTestId(`image-card-${vehicleImages.mainId}`).getByText("메인 이미지", { exact: true })).toBeVisible();
    await expect(page.getByText("오래된 수정 B", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("tabpanel").getByRole("alert")).toHaveCount(0);
    await page.screenshot({ path: ".omo/evidence/carpan2-admin-image-management/task-9-failure-recovered.png", fullPage: true });
    await page.screenshot({ path: ".omo/evidence/carpan2-admin-image-management/task-9-failure.png", fullPage: true });

    const representativeDelete = await page.request.delete(`/api/admin/vehicles/${vehicleImages.vehicleId}/images/${vehicleImages.coverId}`, {
      data: {
        expectedUpdatedAt: firstBody.data.image.updatedAt,
        expectedImageRevision: firstBody.data.imageRevision,
      },
    });
    expect(representativeDelete.status()).toBe(409);
    const crossVehicle = await page.request.patch(`/api/admin/vehicles/${vehicleImages.prefix}-foreign/images/${vehicleImages.mainId}`, {
      data: {
        expectedUpdatedAt: main.updatedAt,
        expectedImageRevision: firstBody.data.imageRevision,
        title: "소유권 우회",
        type: "MAIN",
      },
    });
    expect([404, 409]).toContain(crossVehicle.status());

    await expect(page.getByText("외부 수정 A", { exact: true })).toBeVisible();
    expect((await readVehicleImageStorageState(vehicleImages.vehicleId)).some((image) => image.adminStoragePath !== null)).toBe(false);
    const cleanupReceipt = await verifyForcedFailureCleanup(vehicleImages.prefix, async (forcedFixture) => {
      const forcedUpload = await page.request.post(`/api/admin/vehicles/${forcedFixture.vehicleId}/images`, {
        multipart: {
          file: { name: "forced-residue.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XhNnAAAAAElFTkSuQmCC", "base64") },
          title: "강제 실패 업로드", type: "MAIN", isVisible: "true",
        },
      });
      expect(forcedUpload.status()).toBe(201);
      expect((await readVehicleImageStorageState(forcedFixture.vehicleId)).some((image) => image.adminStoragePath !== null && image.objectExists)).toBe(true);
    });
    expect(await readVehicleImageCleanupState(cleanupReceipt)).toEqual({
      databaseRows: 0,
      auditRows: 0,
      outboxRows: 0,
      storageObjects: 0,
      storageDirectoryExists: false,
    });
    expect(observers.rscRequestCount()).toBe(0);
  observers.assertClean();
});
