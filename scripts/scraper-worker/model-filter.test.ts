import { describe, expect, it } from "vitest";
import { pickModels } from "./model-filter";

const MODELS = [{ cd: "A" }, { cd: "B" }, { cd: "C" }];
const codeOf = (m: { cd: string }) => m.cd;

describe("pickModels", () => {
  it("modelCds 가 없으면 전량 그대로", () => {
    expect(pickModels(MODELS, undefined, codeOf)).toEqual(MODELS);
  });

  it("빈 배열도 전량 — 차량 미선택 = 브랜드 전체", () => {
    expect(pickModels(MODELS, [], codeOf)).toEqual(MODELS);
  });

  it("선택한 모델만 남긴다", () => {
    expect(pickModels(MODELS, ["C", "A"], codeOf)).toEqual([{ cd: "A" }, { cd: "C" }]);
  });

  it("사이트에서 사라진 모델코드는 조용히 빠진다", () => {
    expect(pickModels(MODELS, ["B", "없는코드"], codeOf)).toEqual([{ cd: "B" }]);
  });
});
