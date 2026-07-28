import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateContent: vi.fn(),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: mocks.generateContent };
  },
}));

import { generateStep02V3Reason } from "./llm-reason";

describe("generateStep02V3Reason", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("uses the approved v3 prompt without a character limit", async () => {
    vi.stubEnv("GOOGLE_GENAI_API_KEY", "test-key");
    mocks.generateContent.mockResolvedValue({ text: "가족 이동에 잘 맞는 선택입니다. 주행이 많은 조건도 함께 반영했습니다." });

    await generateStep02V3Reason({
      industry: "개인",
      industryDetail: "두 명에서 세 명",
      preferences: ["family-leisure", "가족"],
      stylePreference: "family-leisure",
      budgetRange: "lte-800k",
      annualMileage: 20_000,
      fuelPreference: "하이브리드",
      vehicleName: "더 뉴 쏘렌토 하이브리드",
      brand: "기아",
      category: "스포츠 유틸리티 차량",
      estimatedMonthly: 515_000,
      fallback: "조건 기반 추천 이유입니다.",
    });

    expect(mocks.generateContent).toHaveBeenCalledWith(expect.objectContaining({
      config: { maxOutputTokens: 220, temperature: 0.7 },
      contents: expect.stringContaining("월 예산: 월 80만원 이하"),
    }));
    const request = mocks.generateContent.mock.calls[0]?.[0] as { contents: string };
    expect(request.contents).toContain("자연스러운 한국어 2~3문장으로 작성해주세요.");
    expect(request.contents).toContain("더 뉴 쏘렌토 하이브리드의 장점을 연결할 것");
    expect(request.contents).toContain("전달된 차량 정보에서 확인되는 범위에서만 표현할 것");
    expect(request.contents).not.toContain("90자 이내");
  });
});
