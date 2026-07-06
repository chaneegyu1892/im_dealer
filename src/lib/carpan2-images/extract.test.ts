import { describe, expect, it } from "vitest";
import {
  extractCarpan2ImageCandidates,
  normalizeCarpan2ImageUrl,
} from "./extract";
import {
  CARPAN2_IMAGE_TYPES,
  type Carpan2ImageVehicle,
} from "./types";

describe("extractCarpan2ImageCandidates", () => {
  it("extracts representative, color, and filtered spec images", () => {
    const vehicle: Carpan2ImageVehicle = {
      modelId: "model-1",
      brandName: "브랜드",
      modelName: "테스트카",
      image: "model/main.png",
      imageLarge: "model/main-L.png",
      cover: "model/cover.png",
      catalogFiles: [],
      exteriorColors: [{ colorId: "c1", name: "화이트" }],
      interiorColors: [{ colorId: "i1", name: "블랙" }],
      modelItem: {
        item: {
          ext: { name: "헤드램프", photo: "f-ext" },
          seat: { name: "시트", photo: "f-seat" },
          safety: { name: "에어백", photo: "f-safety" },
        },
        model: {
          "model-1": {
            kExterior: "ext",
            kSeat: "seat",
            kSafety: "safety",
          },
        },
        kind: {
          kExterior: "외관",
          kSeat: "시트",
          kSafety: "안전",
        },
        files: {
          "f-ext": { image: "model/ext.jpg", title: "LED 헤드램프", linkItem: "ext" },
          "f-seat": { image: "model/seat.jpg", title: "나파 시트", linkItem: "seat" },
          "f-safety": { image: "model/airbag.jpg", title: "에어백", linkItem: "safety" },
        },
        option: {},
        colorExt: {
          body: {
            c1: { url: "colorExt/body/c1.png" },
          },
        },
        colorInt: {
          i1: [{ url: "model/interior.jpg", subject: "블랙 인테리어" }],
        },
      },
    };

    const candidates = extractCarpan2ImageCandidates(vehicle, { includeOptionImages: false });
    const types = candidates.map((candidate) => candidate.type);

    expect(types).toContain(CARPAN2_IMAGE_TYPES.MAIN);
    expect(types).toContain(CARPAN2_IMAGE_TYPES.COVER);
    expect(types).toContain(CARPAN2_IMAGE_TYPES.EXTERIOR_COLOR);
    expect(types).toContain(CARPAN2_IMAGE_TYPES.INTERIOR_COLOR);
    expect(types).toContain(CARPAN2_IMAGE_TYPES.SPEC_EXTERIOR);
    expect(types).toContain(CARPAN2_IMAGE_TYPES.SPEC_SEAT);
    expect(types).not.toContain(CARPAN2_IMAGE_TYPES.SPEC_OPTION);
    expect(candidates.some((candidate) => candidate.sourceUrl.endsWith("airbag.jpg"))).toBe(false);
  });
});

describe("normalizeCarpan2ImageUrl", () => {
  it("converts carpan relative image paths to absolute URLs", () => {
    expect(normalizeCarpan2ImageUrl("model/202508/153421.jpg")).toBe(
      "https://www.carpan.co.kr/img/model/202508/153421.jpg",
    );
  });
});
