import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseKiaWorkbook } from "./parse-kia";
import { parseHyundaiWorkbook } from "./parse-hyundai";
import { parseRenaultWorkbook } from "./parse-renault";
import {
  detectImmediateDeliveryBrand,
  parseImmediateDeliveryWorkbook,
  snapshotDateFromFileName,
} from "./index";

// 실제 재고리스트(개인정보성 실데이터)는 커밋하지 않고, 관찰된 양식을 그대로 재현한 합성 픽스처로 검증한다.

const BANNER = ["현대 기아 르노 KGM 렌트리스"];

function wb(sheets: Record<string, unknown[][]>): XLSX.WorkBook {
  const book = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), name);
  }
  return book;
}

// ── 기아 픽스처 ──
const KIA_NORMAL = [
  BANNER,
  ["판매코드", "", "칼라코드", "", "재고", "차종", "옵션", "외/내장칼라", "", "가격"],
  ["", "", "", "", "", "", "", "", "", "", "한정", "전시", "감가"],
  ["KPHG99I38", "A1A", "ABP", "BSU", "2", "카니발 하이리무진 9인승", "무옵션", "오로라 블랙펄", "코튼베이지", "60210000", "1", "", ""],
  ["KPJG7AC38", "A2T", "SWP", "TPB", "", " ", "모니터", "스노우화이트펄", "토프", "46190000"], // 재고 0 → 스킵, 차종 carry
  ["KPJG7AC38", "A3O", "SWP", "BSU", "3", " ", "HUD", "스노우화이트펄", "코튼베이지", "47460000"], // 차종 carry-forward
  ["합계", "", "", "", "5"],
];
// 한정 변형 1: 생산번호 있음
const KIA_LIMITED_V1 = [
  BANNER,
  [" ", "구분", "판매코드", "", "칼라코드", "", "생산번호", "출하", "", "생산일", "판매조건계", "차종", "옵션", "내/외장 칼라", "", "가격"],
  ["0", "미배정", "KPJG7AD38", "A7B", "ABP", "TPB", "HSA 658962", "Y24", "충주", 46175, "500000", "자가용 7인승 가솔린", "BOSE사운드", "오로라 블랙펄", "토프", "51350000"],
];
// 한정 변형 2 (K5형): 생산번호 없음 + 기본조건 있음
const KIA_LIMITED_V2 = [
  BANNER,
  [" ", "구분", "판매코드", "", "칼라코드", "", "출하", "", "생산일", "판매조건계", "기본조건", "차종", "옵션", "내/외장 칼라", "", "가격"],
  ["0", "미배정", "DLHS46E37", "41J", "ABP", "WK", "Y13", "화성", 46185, "200000", "0", "장애인 LPi 2.0", "스마트커넥트", "오로라 블랙펄", "블랙", "31950000"],
];

describe("parseKiaWorkbook", () => {
  it("정상 시트: 재고 0 스킵, 차종 carry-forward, 합계행 스킵, 집계열은 extra에 담는다", () => {
    const r = parseKiaWorkbook(wb({ 카니발: KIA_NORMAL }));
    expect(r.warnings).toEqual([]);
    expect(r.rows).toHaveLength(2);
    const [a, b] = r.rows;
    expect(a).toMatchObject({
      model: "카니발", stockType: "NORMAL", salesCode: "KPHG99I38",
      trimName: "카니발 하이리무진 9인승", optionText: "무옵션",
      exteriorColor: "오로라 블랙펄", interiorColor: "코튼베이지",
      price: 60210000, quantity: 2,
    });
    expect(a.extra).toMatchObject({ specCode: "A1A", colorCode: "ABP/BSU", limitedCount: 1 });
    // 재고 빈 행은 스킵됐고, 다음 행이 직전 차종을 이어받는다
    expect(b.trimName).toBe("카니발 하이리무진 9인승");
    expect(b.quantity).toBe(3);
  });

  it("한정 시트: 헤더 변형(생산번호 유무/기본조건)을 모두 해석하고 1행=1대로 만든다", () => {
    const r = parseKiaWorkbook(wb({ "카니발(한정)": KIA_LIMITED_V1, "K5(한정)": KIA_LIMITED_V2 }));
    expect(r.warnings).toEqual([]);
    expect(r.rows).toHaveLength(2);
    const [v1, v2] = r.rows;
    expect(v1).toMatchObject({
      model: "카니발", stockType: "LIMITED", quantity: 1, discount: 500000,
      location: "충주", price: 51350000, exteriorColor: "오로라 블랙펄", interiorColor: "토프",
    });
    expect(v1.extra).toMatchObject({ productionNo: "HSA 658962", shipCode: "Y24", productionDate: "2026-06-02" });
    expect(v2).toMatchObject({ model: "K5", discount: 200000, location: "화성", trimName: "장애인 LPi 2.0" });
    expect(v2.extra).not.toHaveProperty("productionNo");
  });
});

// ── 현대 픽스처 ──
const HYUNDAI_NORMAL = [
  BANNER,
  ["판매코드", "", "칼라코드", "", "재고", "차종", "옵션", "외/내장칼라", "", "가격", "울산출고", "", "", "", "칠곡출고", "", "", ""],
  ["", "", "", "", "", "", "", "", "", "", "정상", "조건", "전시", "판촉", "정상", "조건", "전시", "판촉"],
  ["MXJJ5TCT3", "A01", "A2B", "NNB", "6", "자가용 RV 5인승", "무옵션", "어비스블랙펄", "블랙원톤", "36570000", "1", "", "1", "", "4", "", "", ""],
  ["MXJJ5TFT3", "A11", "WW2", "NNB", "2", "자가용 RV 5인승", "빌트인캠2", "크리미 화이트 펄", "블랙원톤", "39970000", "", "", "", "", "", "", "", ""], // 센터 수량 없음 → 총재고 폴백
];
const HYUNDAI_LIMITED = [
  BANNER,
  ["구분", "판매코드", "", "칼라코드", "", "파츠코드", "출고", "판매조건계", "기본조건", "생산월조건", "특별조건", "한정조건", "한정재고", "계약번호", "출고예정일", "차종", "옵션", "내/외장 칼라", "", "가격", "비고"],
  ["미배정", "MXJJ5TCA3", "A01", "WW2", "NNB", " ", "옥천출고", "3000000", "0", "3000000", "0", "0", "0", "", "", "자가용 RV 5인승", "무옵션", "크리미 화이트 펄", "블랙원톤", "38880000", ""],
];
// 변형: "구분" 열 없는 조건 시트 (GV60/GV70E/쏘나타형)
const HYUNDAI_LIMITED_NO_STATUS = [
  BANNER,
  ["판매코드", "", "칼라코드", "", "파츠코드", "출고", "판매조건계", "기본조건", "생산월조건", "특별조건", "한정조건", "한정재고", "계약번호", "출고예정일", "차종", "옵션", "내/외장 칼라", "", "가격", "비고"],
  ["JWJC7VBT2", "A01", "UYH", "NNB", " ", "울산출고", "1000000", "0", "1000000", "0", "0", "0", "", "", "전기차 스탠다드", "무옵션", "화이트", "그레이", "60000000", ""],
];
const NO_STOCK = [BANNER, ["재고없음"]];

describe("parseHyundaiWorkbook", () => {
  it("정상 시트: 출고센터별로 행을 분해하고, 센터 수량이 없으면 총재고로 폴백한다", () => {
    const r = parseHyundaiWorkbook(wb({ 싼타페: HYUNDAI_NORMAL }));
    expect(r.warnings).toEqual([]);
    expect(r.rows).toHaveLength(3); // 울산 2 + 칠곡 4, 폴백 1행
    const ulsan = r.rows.find((x) => x.location === "울산출고")!;
    expect(ulsan.quantity).toBe(2);
    expect(ulsan.extra).toMatchObject({ breakdown: { 정상: 1, 전시: 1 } });
    expect(r.rows.find((x) => x.location === "칠곡출고")!.quantity).toBe(4);
    const fallback = r.rows.find((x) => x.salesCode === "MXJJ5TFT3")!;
    expect(fallback.location).toBeUndefined();
    expect(fallback.quantity).toBe(2);
  });

  it("조건 시트: 구분 열 유무 변형을 모두 해석하고 할인 세부를 extra에 담는다", () => {
    const r = parseHyundaiWorkbook(wb({ "싼타페(조건)": HYUNDAI_LIMITED, "GV60(조건)": HYUNDAI_LIMITED_NO_STATUS }));
    expect(r.warnings).toEqual([]);
    expect(r.rows).toHaveLength(2);
    const [a, b] = r.rows;
    expect(a).toMatchObject({
      model: "싼타페", stockType: "LIMITED", quantity: 1, discount: 3000000,
      location: "옥천출고", price: 38880000, exteriorColor: "크리미 화이트 펄", interiorColor: "블랙원톤",
    });
    expect(a.extra).toMatchObject({ status: "미배정", productionMonthCondition: 3000000 });
    expect(b).toMatchObject({ model: "GV60", salesCode: "JWJC7VBT2", discount: 1000000, location: "울산출고" });
  });

  it('"재고없음" 시트는 skippedSheets로 분리한다', () => {
    const r = parseHyundaiWorkbook(wb({ 투싼: NO_STOCK, "투싼(조건)": NO_STOCK }));
    expect(r.rows).toHaveLength(0);
    expect(r.skippedSheets).toEqual(["투싼", "투싼(조건)"]);
    expect(r.warnings).toEqual([]);
  });
});

// ── 르노 픽스처 ──
const RENAULT_HEADER = [
  BANNER,
  ["가용재고"],
  ["모델,Grand Koleos-AR"],
  ["모델", "연식", "차종", "옵션", "옵션명", "외장색", "내장색", "부산", "전시차", "합계"],
];
const RENAULT_NORMAL = [
  ...RENAULT_HEADER,
  ["Grand Koleos-AR1", "26MY", "가솔린 2.0 터보 iconic", "-----", "", "메탈릭 블랙", "퀼팅 브라운", "59", "1", "60"],
  ["Grand Koleos-AR1", "26MY", "가솔린 2.0 터보 iconic", "-----", "", " ", "다크 블루", "5", "", "5"], // 외장색 carry-forward
  ["", "", "", "", "", "", "", "", "", ""], // 빈 행
];
const RENAULT_LIMITED = [
  ...RENAULT_HEADER,
  ["Grand Koleos-AR1", "26MY", "가솔린 2.0 터보 esprit Alpine", "SAB--", "[기본] 메탈릭 블랙 루프", "새틴 화이트", "블랙 스웨이드", "1", "", "1"],
];

describe("parseRenaultWorkbook", () => {
  it("시트명에서 모델·연식·한정액을 읽고, 공백 셀은 직전 행 값을 이어받는다", () => {
    const r = parseRenaultWorkbook(
      wb({
        "그랑콜레오스 26MY 정상재고": RENAULT_NORMAL,
        "그랑콜레오스 26MY 한정재고(400만원)": RENAULT_LIMITED,
        "필랑트 27MY 한정재고(용품장착)": RENAULT_LIMITED,
      }),
    );
    expect(r.warnings).toEqual([]);
    expect(r.rows).toHaveLength(4);
    const [n1, n2, lim, goods] = r.rows;
    expect(n1).toMatchObject({
      model: "그랑콜레오스", stockType: "NORMAL", salesCode: "Grand Koleos-AR1",
      trimName: "가솔린 2.0 터보 iconic", exteriorColor: "메탈릭 블랙", quantity: 60,
    });
    expect(n1.price).toBeUndefined(); // 르노 양식에는 가격이 없다
    expect(n1.extra).toMatchObject({ modelYear: "26MY", busanCount: 59, displayCount: 1 });
    expect(n2.exteriorColor).toBe("메탈릭 블랙"); // carry-forward
    expect(n2.interiorColor).toBe("다크 블루");
    expect(lim).toMatchObject({ stockType: "LIMITED", discount: 4000000, quantity: 1 });
    expect(goods.discount).toBeUndefined(); // "용품장착"은 금액이 아님
    expect(goods.extra).toMatchObject({ limitedCondition: "용품장착" });
    expect(goods.model).toBe("필랑트");
  });

  it("해석할 수 없는 시트명은 경고로 남긴다", () => {
    const r = parseRenaultWorkbook(wb({ 이상한시트: [["x"]] }));
    expect(r.rows).toHaveLength(0);
    expect(r.warnings).toHaveLength(1);
  });
});

// ── 브랜드 감지 + 진입점 ──
describe("detectImmediateDeliveryBrand / parseImmediateDeliveryWorkbook", () => {
  const toBuf = (book: XLSX.WorkBook) => XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;

  it("시트명 규칙으로 3사를 감지한다", () => {
    expect(detectImmediateDeliveryBrand(wb({ "카니발(한정)": KIA_LIMITED_V1 }))).toBe("기아");
    expect(detectImmediateDeliveryBrand(wb({ "싼타페(조건)": HYUNDAI_LIMITED }))).toBe("현대");
    expect(detectImmediateDeliveryBrand(wb({ "필랑트 27MY 정상재고": RENAULT_NORMAL }))).toBe("르노");
  });

  it("시트명 접미가 없어도 헤더 구조(출고센터/감가)로 기아·현대를 구분한다", () => {
    expect(detectImmediateDeliveryBrand(wb({ 싼타페: HYUNDAI_NORMAL }))).toBe("현대");
    expect(detectImmediateDeliveryBrand(wb({ 카니발: KIA_NORMAL }))).toBe("기아");
  });

  it("버퍼를 받아 감지→파싱하고, brandHint로 강제할 수 있다", () => {
    const buf = toBuf(wb({ 카니발: KIA_NORMAL }));
    expect(parseImmediateDeliveryWorkbook(buf).brand).toBe("기아");
    expect(parseImmediateDeliveryWorkbook(buf, "기아").rows).toHaveLength(2);
  });

  it("감지 실패 시 지원 브랜드를 안내하며 throw한다", () => {
    expect(() => parseImmediateDeliveryWorkbook(toBuf(wb({ Sheet1: [["a"]] })))).toThrow(/브랜드를 감지하지/);
  });
});

describe("snapshotDateFromFileName", () => {
  it("파일명 선두의 YYMMDD를 날짜로 해석한다", () => {
    expect(snapshotDateFromFileName("260819_기아 정상 & 한정 재고리스트.xlsx")).toBe("2026-08-19");
    expect(snapshotDateFromFileName("재고리스트.xlsx")).toBeNull();
    expect(snapshotDateFromFileName("991231_x.xls")).toBe("2099-12-31");
  });
});
