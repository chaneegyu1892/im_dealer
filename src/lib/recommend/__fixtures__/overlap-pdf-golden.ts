export interface GoldenPdfPlacement {
  readonly axis: "industry" | "primaryPreference" | "additionalCondition" | "annualMileage" | "region";
  readonly answer: string;
  readonly level: "best" | "fit" | "support";
  readonly documentNames: readonly string[];
}

// PDF pp. 3-5를 소스 매니페스트와 별도로 전사한 검증용 픽스처다.
export const GOLDEN_PDF_PLACEMENTS: readonly GoldenPdfPlacement[] = [
  { axis: "industry", answer: "법인", level: "best", documentNames: ["디 올 뉴 G80 F/L", "더 뉴 그랜저 HEV", "The New K8 HEV"] },
  { axis: "industry", answer: "법인", level: "fit", documentNames: ["GV80 F/L", "신형 G90", "더 뉴 K9", "디 올 뉴 그랜저"] },
  { axis: "industry", answer: "법인", level: "support", documentNames: ["GV70", "쏘나타 디 엣지 HEV", "더 뉴 K5 HEV"] },
  { axis: "industry", answer: "개인사업자", level: "best", documentNames: ["더 뉴 쏘렌토 HEV", "디 올 뉴 싼타페 HEV", "더 뉴 카니발 HEV"] },
  { axis: "industry", answer: "개인사업자", level: "fit", documentNames: ["더 뉴 스타리아 HEV", "디 올 뉴 코나 HEV", "더 뉴 스포티지 HEV", "디 올 뉴 셀토스 HEV"] },
  { axis: "industry", answer: "개인사업자", level: "support", documentNames: ["더 뉴 쏘렌토", "디 올 뉴 싼타페", "더 뉴 카니발"] },
  { axis: "industry", answer: "개인", level: "best", documentNames: ["디 올 뉴 코나 HEV", "더 뉴 셀토스", "더 뉴 아반떼 HEV"] },
  { axis: "industry", answer: "개인", level: "fit", documentNames: ["더 뉴 스포티지 HEV", "더 뉴 캐스퍼", "더 뉴 K5 HEV", "디 올 뉴 니로 HEV"] },
  { axis: "industry", answer: "개인", level: "support", documentNames: ["베뉴", "더 뉴 모닝", "디 올 뉴 코나"] },
  { axis: "primaryPreference", answer: "안정감", level: "best", documentNames: ["GV80 F/L", "디 올 뉴 팰리세이드", "디 올 뉴 싼타페"] },
  { axis: "primaryPreference", answer: "안정감", level: "fit", documentNames: ["더 뉴 쏘렌토", "더 뉴 카니발", "GV70", "더 뉴 스타리아"] },
  { axis: "primaryPreference", answer: "안정감", level: "support", documentNames: ["더 뉴 스포티지", "더 뉴 투싼", "디 올 뉴 코나"] },
  { axis: "primaryPreference", answer: "주차편의", level: "best", documentNames: ["더 뉴 캐스퍼", "더 뉴 모닝", "베뉴"] },
  { axis: "primaryPreference", answer: "주차편의", level: "fit", documentNames: ["더 뉴 레이 PE", "디 올 뉴 코나", "더 뉴 셀토스", "디 올 뉴 셀토스"] },
  { axis: "primaryPreference", answer: "주차편의", level: "support", documentNames: ["더 뉴 아반떼", "더 뉴 K5", "더 EV3"] },
  { axis: "primaryPreference", answer: "경제성", level: "best", documentNames: ["더 뉴 아반떼 HEV", "디 올 뉴 코나 HEV", "디 올 뉴 니로 HEV"] },
  { axis: "primaryPreference", answer: "경제성", level: "fit", documentNames: ["더 뉴 K5 HEV", "쏘나타 디 엣지 HEV", "디 올 뉴 셀토스 HEV", "더 뉴 스포티지 HEV"] },
  { axis: "primaryPreference", answer: "경제성", level: "support", documentNames: ["더 뉴 아반떼", "디 올 뉴 코나", "더 뉴 셀토스"] },
  { axis: "primaryPreference", answer: "고급", level: "best", documentNames: ["신형 G90", "디 올 뉴 G80 F/L", "GV80 F/L"] },
  { axis: "primaryPreference", answer: "고급", level: "fit", documentNames: ["GV80 Coupe", "더 뉴 K9", "GV70", "Electrified G80 F/L"] },
  { axis: "primaryPreference", answer: "고급", level: "support", documentNames: ["The New K8", "더 뉴 그랜저", "G70 슈팅 브레이크"] },
  { axis: "additionalCondition", answer: "가족", level: "best", documentNames: ["더 뉴 카니발 HEV", "디 올 뉴 싼타페 HEV", "더 뉴 쏘렌토 HEV"] },
  { axis: "additionalCondition", answer: "가족", level: "fit", documentNames: ["디 올 뉴 팰리세이드", "더 뉴 스타리아 HEV", "더 뉴 카니발", "더 뉴 쏘렌토"] },
  { axis: "additionalCondition", answer: "가족", level: "support", documentNames: ["더 뉴 스포티지 HEV", "더 뉴 투싼 HEV", "GV70"] },
  { axis: "additionalCondition", answer: "화물", level: "best", documentNames: ["더 뉴 카니발", "더 뉴 스타리아", "디 올 뉴 팰리세이드"] },
  { axis: "additionalCondition", answer: "화물", level: "fit", documentNames: ["디 올 뉴 싼타페", "더 뉴 쏘렌토", "더 뉴 카니발 HEV", "더 뉴 스타리아 HEV"] },
  { axis: "additionalCondition", answer: "화물", level: "support", documentNames: ["GV80 F/L", "디 올 뉴 코나", "더 뉴 스포티지"] },
  { axis: "annualMileage", answer: "10000", level: "best", documentNames: ["더 뉴 아반떼 HEV", "디 올 뉴 코나 HEV", "디 올 뉴 니로 HEV"] },
  { axis: "annualMileage", answer: "10000", level: "fit", documentNames: ["더 뉴 셀토스", "더 뉴 캐스퍼", "디 올 뉴 코나", "더 뉴 아반떼"] },
  { axis: "annualMileage", answer: "10000", level: "support", documentNames: ["더 뉴 모닝", "베뉴", "더 EV3"] },
  { axis: "annualMileage", answer: "20000", level: "best", documentNames: ["디 올 뉴 싼타페 HEV", "더 뉴 쏘렌토 HEV", "쏘나타 디 엣지 HEV"] },
  { axis: "annualMileage", answer: "20000", level: "fit", documentNames: ["The New K8 HEV", "더 뉴 카니발 HEV", "더 뉴 그랜저 HEV", "더 뉴 스포티지 HEV"] },
  { axis: "annualMileage", answer: "20000", level: "support", documentNames: ["더 뉴 쏘렌토", "디 올 뉴 싼타페", "더 뉴 카니발"] },
  { axis: "annualMileage", answer: "30000", level: "best", documentNames: ["더 뉴 그랜저 HEV", "The New K8 HEV", "디 올 뉴 싼타페 HEV"] },
  { axis: "annualMileage", answer: "30000", level: "fit", documentNames: ["더 뉴 쏘렌토 HEV", "쏘나타 디 엣지 HEV", "더 뉴 카니발 HEV", "디 올 뉴 코나 HEV"] },
  { axis: "annualMileage", answer: "30000", level: "support", documentNames: ["더 뉴 그랜저", "The New K8", "디 올 뉴 싼타페"] },
  { axis: "region", answer: "일반", level: "best", documentNames: ["디 올 뉴 코나 HEV", "디 올 뉴 싼타페 HEV", "더 뉴 쏘렌토 HEV"] },
  { axis: "region", answer: "일반", level: "fit", documentNames: ["더 뉴 그랜저 HEV", "더 뉴 셀토스", "더 뉴 스포티지 HEV", "디 올 뉴 코나"] },
  { axis: "region", answer: "일반", level: "support", documentNames: ["더 뉴 아반떼 HEV", "더 뉴 K5 HEV", "더 EV3"] },
  { axis: "region", answer: "강원·산간", level: "best", documentNames: ["GV70", "GV80 F/L", "디 올 뉴 팰리세이드"] },
  { axis: "region", answer: "강원·산간", level: "fit", documentNames: ["디 올 뉴 싼타페", "더 뉴 쏘렌토", "더 뉴 스포티지", "더 뉴 투싼"] },
  { axis: "region", answer: "강원·산간", level: "support", documentNames: ["디 올 뉴 코나", "더 뉴 셀토스", "더 뉴 스타리아"] },
  { axis: "region", answer: "제주", level: "best", documentNames: ["더 뉴 아이오닉 5", "더 EV3", "더 뉴 EV6"] },
  { axis: "region", answer: "제주", level: "fit", documentNames: ["디 올 뉴 코나 EV", "아이오닉 9", "더 EV5", "디 올 뉴 니로 EV"] },
  { axis: "region", answer: "제주", level: "support", documentNames: ["캐스퍼 일렉트릭", "더 레이 EV", "GV60 F/L"] },
];

export const GOLDEN_COUNTS = Object.freeze({
  levels: 45,
  placements: 150,
  vehicles: 51,
  evs: 11,
});

export const GOLDEN_DETAIL_EXPECTATIONS = [
  { documentName: "더 뉴 카니발 HEV", family: ["best", "best", "best", "best", "fit"] },
  { documentName: "디 올 뉴 싼타페 HEV", family: ["best", "best", "best", "best", "best"] },
  { documentName: "더 뉴 쏘렌토 HEV", family: ["best", "best", "best", "best", "best"] },
  { documentName: "디 올 뉴 팰리세이드", family: ["fit", "fit", "best", "best", "best"], cargo: ["best", "best", "best"] },
  { documentName: "더 뉴 스타리아 HEV", family: ["fit", "best", "best", "best", "support"], cargo: ["fit", "best", "best"] },
  { documentName: "더 뉴 카니발", family: ["fit", "best", "best", "best", "support"], cargo: ["best", "best", "best"] },
  { documentName: "더 뉴 쏘렌토", family: ["fit", "fit", "best", "best", "best"], cargo: ["fit", "fit", "best"] },
  { documentName: "더 뉴 스포티지 HEV", family: ["support", "support", "fit", "support", "fit"] },
  { documentName: "더 뉴 투싼 HEV", family: ["support", "support", "fit", "support", "fit"] },
  { documentName: "GV70", family: ["support", "support", "fit", "support", "fit"] },
  { documentName: "더 뉴 스타리아", cargo: ["best", "best", "best"] },
  { documentName: "디 올 뉴 싼타페", cargo: ["fit", "fit", "best"] },
  { documentName: "GV80 F/L", cargo: ["support", "support", "fit"] },
  { documentName: "디 올 뉴 코나", cargo: ["support", "support", "support"] },
  { documentName: "더 뉴 스포티지", cargo: ["support", "support", "support"] },
] satisfies readonly {
  readonly documentName: string;
  readonly family?: readonly string[];
  readonly cargo?: readonly string[];
}[];
