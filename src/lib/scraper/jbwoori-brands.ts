// JB우리캐피탈(JBWOORI) 브랜드 코드 — getVehicleList(makrNatCd=KR) 국산 제조사 (2026-07 확인).
// brandCd = 제조사코드(makrCd). makrSeqno 는 getVhclKncrLis 에서 "" 로 조회 가능하므로 불필요.
export interface JbwooriBrand {
  brandCd: string;
  name: string;
}

export const JBWOORI_BRANDS: JbwooriBrand[] = [
  { brandCd: "A0004", name: "현대자동차" },
  { brandCd: "A0006", name: "기아자동차" },
  { brandCd: "A0001", name: "한국GM(쉐보레)" },
  { brandCd: "A0005", name: "KG모빌리티" },
  { brandCd: "A0007", name: "르노코리아" },
];
