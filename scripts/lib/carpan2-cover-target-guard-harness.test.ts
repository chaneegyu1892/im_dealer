import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { verifyBackfillTargetGuard } from "./carpan2-cover-target-guard-harness";

describe("COVER backfill target guard CLI harness", () => {
  it("Given only target/apply configuration When probes run Then every unsafe endpoint is denied before Prisma", () => {
    // Given
    const root = resolve(import.meta.dirname, "../..");

    // When
    const action = (): unknown => verifyBackfillTargetGuard({
      root,
      cli: resolve(root, "scripts/backfill-carpan2-cover-thumbnails.ts"),
      testUrl: "postgresql://127.0.0.1:55432/test",
      productionUrl: "postgresql://prod-runtime.example/prod",
      environment: {
        ...process.env,
        NODE_ENV: "test",
        CARPAN2_COVER_TARGET: "test",
        CARPAN2_COVER_APPLY: "1",
      },
    });

    // Then
    expect(action).not.toThrow();
  });
});
