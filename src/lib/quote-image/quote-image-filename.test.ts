import { describe, expect, it } from "vitest";
import { buildQuoteImageFilename } from "./quote-image-filename";

const date = new Date("2026-08-05T12:00:00+09:00");

describe("buildQuoteImageFilename", () => {
  it("appends the customer name at the end when present", () => {
    const filename = buildQuoteImageFilename({
      vehicleName: "New Model Y",
      customerName: "김진규",
      idSuffix: "cmsfse",
      date,
    });

    expect(filename).toBe("아임딜러_견적서_New_Model_Y_20260805_cmsfse_김진규.png");
  });

  it("keeps the legacy filename when there is no customer name", () => {
    const filename = buildQuoteImageFilename({
      vehicleName: "New Model Y",
      customerName: null,
      idSuffix: "cmsfse",
      date,
    });

    expect(filename).toBe("아임딜러_견적서_New_Model_Y_20260805_cmsfse.png");
  });

  it("builds the member download filename without an id suffix", () => {
    const filename = buildQuoteImageFilename({
      vehicleName: "쏘렌토",
      customerName: "홍길동",
      date,
    });

    expect(filename).toBe("아임딜러_견적서_쏘렌토_20260805_홍길동.png");
  });

  it("sanitizes unsafe filename characters in vehicle and customer names", () => {
    const filename = buildQuoteImageFilename({
      vehicleName: "GV80 (5인승)",
      customerName: "김/진:규",
      date,
    });

    expect(filename).toBe("아임딜러_견적서_GV80__5인승__20260805_김_진_규.png");
  });

  it("omits a name that sanitizes down to nothing", () => {
    const filename = buildQuoteImageFilename({
      vehicleName: "쏘렌토",
      customerName: "  ··· ",
      date,
    });

    expect(filename).toBe("아임딜러_견적서_쏘렌토_20260805.png");
  });
});
