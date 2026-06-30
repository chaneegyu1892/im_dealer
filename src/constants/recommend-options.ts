// AI 추천 4단계 선택지 데이터

export const INDUSTRY_OPTIONS = [
  { value: "법인", label: "법인", desc: "법인 명의 차량 등록", icon: "🏢" },
  { value: "개인사업자", label: "개인사업자", desc: "사업자등록증 보유", icon: "📋" },
  { value: "개인", label: "개인", desc: "직장인·프리랜서·비사업자 모두 포함", icon: "👤" },
] as const;

// 호환용 전체 옵션 풀. 분기 매칭 실패 시 fallback으로 쓰이거나
// 어드민 분석 등에서 라벨 lookup 용도로 import 가능.
export const PURPOSE_OPTIONS = [
  { value: "출퇴근·업무용", label: "출퇴근·업무용", desc: "출퇴근·영업·외근 통합", icon: "🚗" },
  { value: "영업·외근", label: "영업·외근", desc: "외근·미팅 잦은 영업", icon: "🧳" },
  { value: "화물·배달", label: "화물·배달", desc: "물건 운반·배달 업무", icon: "📦" },
  { value: "임원용·의전", label: "임원용·의전", desc: "임원·VIP 의전 차량", icon: "🎖️" },
  { value: "가정용", label: "가정용", desc: "가족 이동·장거리 여행", icon: "👨‍👩‍👧" },
] as const;

// value 기반 안전 조회 헬퍼
const P = (v: typeof PURPOSE_OPTIONS[number]["value"]): typeof PURPOSE_OPTIONS[number] =>
  PURPOSE_OPTIONS.find((o) => o.value === v)!;

// 1단계 업종 선택값에 따라 2단계에서 노출할 목적.
// 매핑에 없는 업종이거나 industry가 빈 값일 때는 PURPOSE_OPTIONS 전체로 fallback.
export const PURPOSE_OPTIONS_BY_INDUSTRY: Record<string, ReadonlyArray<typeof PURPOSE_OPTIONS[number]>> = {
  법인:       [P("출퇴근·업무용"), P("영업·외근"), P("화물·배달"), P("임원용·의전")],
  개인사업자: [P("출퇴근·업무용"), P("영업·외근"), P("화물·배달"), P("가정용")],
  개인:       [P("출퇴근·업무용"), P("화물·배달"), P("가정용")],
};

export function getPurposeOptionsForIndustry(
  industry: string,
): ReadonlyArray<typeof PURPOSE_OPTIONS[number]> {
  return PURPOSE_OPTIONS_BY_INDUSTRY[industry] ?? PURPOSE_OPTIONS;
}

// ─────────────────────────────────────────────
// 「원하는 차」 선호 특징 — 목적 질문 대체 (복수 선택, 최대 2개)
// 느낌형 4(즉시 점수) + 상황형 2(상세질문 펼침). 상황형은 1개만 선택 가능.
// value 는 scoring-rules.ts 의 PREFERENCE_RULES / SCORING_PREFERENCES 와 1:1.
// ─────────────────────────────────────────────

export type PreferenceKind = "feel" | "situation";

export const PREFERENCE_OPTIONS = [
  { value: "안정감", label: "크고 안정감 있는 차", desc: "든든한 주행감", icon: "🚙", kind: "feel" },
  { value: "주차편의", label: "작고 주차 편한 차", desc: "좁은 길도 편하게", icon: "🅿️", kind: "feel" },
  { value: "경제성", label: "유지비 경제적인 차", desc: "연비·유류비 절감", icon: "🌿", kind: "feel" },
  { value: "고급", label: "품격 있는 고급차", desc: "임원·의전용", icon: "💎", kind: "feel" },
  { value: "가족", label: "아이와 함께 타요", desc: "가족·안전 우선", icon: "👨‍👩‍👧", kind: "situation" },
  { value: "화물", label: "짐을 많이 실어요", desc: "화물·적재 위주", icon: "📦", kind: "situation" },
] as const satisfies ReadonlyArray<{
  value: string;
  label: string;
  desc: string;
  icon: string;
  kind: PreferenceKind;
}>;

export const MAX_PREFERENCES = 2;

// 상황형 상세질문 선택지. value 는 CHILD_RULES / CARGO_RULES 키와 1:1 일치해야 한다.
export const PREFERENCE_DETAIL_OPTIONS: Record<
  string,
  Array<{ value: string; label: string; desc?: string; icon?: string }>
> = {
  가족: [
    { value: "영유아", label: "영유아 (0~3세)", desc: "유모차·카시트 환경", icon: "👶" },
    { value: "미취학", label: "미취학 (4~7세)", desc: "카시트 환경", icon: "🧒" },
    { value: "초등", label: "초등학생 (8~13세)", desc: "넉넉한 실내 공간", icon: "🎒" },
    { value: "중학생+", label: "중학생 이상 (14세~)", desc: "성인 위주 이용", icon: "🧑" },
  ],
  화물: [
    { value: "소형 박스", label: "소형 박스·소화물", desc: "택배, 소형 물품 위주예요", icon: "📦" },
    { value: "대형 화물", label: "대형 화물·자재", desc: "적재 용량이 정말 중요해요", icon: "🏗️" },
  ],
};

export const PREFERENCE_DETAIL_QUESTION: Record<string, { title: string; subtitle: string }> = {
  가족: { title: "자녀 연령대는 어떻게 되나요?", subtitle: "연령에 맞는 안전·편의 기능을 우선으로 추천해요." },
  화물: { title: "주로 어떤 물량을 운반하시나요?", subtitle: "적재 용량에 맞는 차종을 추천해 드려요." },
};

export const BUDGET_RANGE_OPTIONS = [
  { value: "~50", label: "50만원 이하", budgetMin: 0, budgetMax: 500_000 },
  { value: "50~100", label: "50 – 100만원", budgetMin: 500_000, budgetMax: 1_000_000 },
  { value: "100~", label: "100만원 이상", budgetMin: 1_000_000, budgetMax: 99_999_999 },
] as const;

export const PAYMENT_STYLE_OPTIONS = [
  {
    value: "표준형" as const,
    label: "초기 비용 없이 가볍게 시작하고 싶어요",
    desc: "보증금·선납금 없이 시작",
    detail: "월 납입금 그대로 부담. 가장 일반적인 방식",
    recommended: true,
  },
  {
    value: "보수형" as const,
    label: "보증금·선납금을 넣고 월 비용을 낮추고 싶어요",
    desc: "초기 목돈으로 월 납입금 절감",
    detail: "초기 비용을 더 부담하더라도 매달 부담을 줄이고 싶을 때",
  },
] as const;

export const MILEAGE_OPTIONS = [
  { value: 10_000, label: "적게 타요 (연 1만km)", desc: "단거리 위주, 출퇴근만" },
  { value: 20_000, label: "적당히 타요 (연 2만km)", desc: "80% 고객이 선택하는 평균 주행 패턴", recommended: true },
  { value: 30_000, label: "정말 많이 타요 (연 3만km)", desc: "장거리·영업·고주행" },
] as const;

// 조건부 추가 질문 선택지

export const INDUSTRY_DETAIL_OPTIONS: Record<string, Array<{ value: string; label: string; desc?: string; icon?: string }>> = {
  법인: [
    { value: "없음", label: "없어요", desc: "처음 도입하는 법인 차량이에요", icon: "🆕" },
    { value: "1대", label: "1대", desc: "이미 1대를 운용 중이에요", icon: "🚗" },
    { value: "2대 이상", label: "2대 이상", desc: "다수 차량을 운용 중이에요", icon: "🏭" },
  ],
  개인사업자: [
    { value: "없음", label: "없어요", desc: "사업자 명의 렌트/리스 차량이 없어요", icon: "🆕" },
    { value: "1대", label: "1대 운용 중", desc: "이미 1대를 운용 중이에요", icon: "🚗" },
    { value: "2대 이상", label: "2대 이상 운용 중", desc: "2대 이상 운용 중이에요 (임직원 전용보험 필수)", icon: "⚠️" },
  ],
  개인: [
    { value: "혼자", label: "주로 혼자 타요", desc: "1인 사용이 대부분이에요", icon: "👤" },
    { value: "2~3명", label: "2~3명이 함께 타요", desc: "가끔 동승자가 있어요", icon: "👥" },
    { value: "4명 이상", label: "4명 이상 함께 타요", desc: "가족·단체 이동이 잦아요", icon: "👨‍👩‍👧‍👦" },
  ],
};

export const INDUSTRY_DETAIL_QUESTION: Record<string, { title: string; subtitle: string }> = {
  법인: { title: "현재 법인 차량 운용 대수는요?", subtitle: "규모에 맞는 실용적인 차량을 추천해 드려요." },
  개인사업자: { title: "현재 사업자 명의 렌트/리스 차량은요?", subtitle: "2대 이상 운용 시 임직원 전용보험이 필수예요." },
  개인: { title: "주로 몇 명이 함께 탑승하나요?", subtitle: "동승 인원에 따라 적합한 차급이 달라져요." },
};

export const PURPOSE_DETAIL_OPTIONS: Record<string, Array<{ value: string; label: string; desc?: string; icon?: string }>> = {
  "출퇴근·업무용": [
    { value: "10km 이하", label: "10km 이하", desc: "가까운 거리, 시내 위주", icon: "📍" },
    { value: "10~30km", label: "10~30km", desc: "평균적인 출퇴근 거리", icon: "🛣️" },
    { value: "30km 이상", label: "30km 이상", desc: "장거리, 연비가 중요해요", icon: "🛤️" },
  ],
  "영업·외근": [
    { value: "매일 외근", label: "매일 외근해요", desc: "하루 대부분 이동", icon: "🛣️" },
    { value: "가끔 외근", label: "가끔 외근해요", desc: "주 1~2회", icon: "📅" },
  ],
  "화물·배달": [
    { value: "소형 박스", label: "소형 박스·소화물", desc: "택배, 소형 물품 위주예요", icon: "📦" },
    { value: "대형 화물", label: "대형 화물·자재", desc: "적재 용량이 정말 중요해요", icon: "🏗️" },
  ],
  "임원용·의전": [
    { value: "직접 운전", label: "직접 운전해요", desc: "운전자와 탑승자가 같아요", icon: "🙋" },
    { value: "기사 운행", label: "기사가 운전해요", desc: "후석 편의·공간이 중요해요", icon: "🤵" },
  ],
  가정용: [
    { value: "영유아", label: "영유아 (0~3세)", desc: "유모차·카시트 환경", icon: "👶" },
    { value: "미취학", label: "미취학 (4~7세)", desc: "카시트 환경", icon: "🧒" },
    { value: "초등", label: "초등학생 (8~13세)", desc: "넉넉한 실내 공간", icon: "🎒" },
    { value: "중학생+", label: "중학생 이상 (14세~)", desc: "성인 위주 이용", icon: "🧑" },
  ],
};

export const PURPOSE_DETAIL_QUESTION: Record<string, { title: string; subtitle: string }> = {
  "출퇴근·업무용": { title: "하루 편도 이동 거리는요?", subtitle: "거리가 멀수록 연비 좋은 차량이 더 유리해요." },
  "영업·외근": { title: "외근 빈도는요?", subtitle: "이동량에 맞는 차량을 추천해 드려요." },
  "화물·배달": { title: "주로 어떤 물량을 운반하시나요?", subtitle: "적재 용량에 맞는 차종을 추천해 드려요." },
  "임원용·의전": { title: "운전은 어떻게 하시나요?", subtitle: "운전 방식에 따라 최적 사양을 달리 추천해 드려요." },
  가정용: { title: "자녀 연령대는 어떻게 되나요?", subtitle: "연령에 맞는 안전·편의 기능을 우선으로 추천해요." },
};

export const BUDGET_DETAIL_OPTIONS: Record<string, Array<{ value: string; label: string; desc?: string; icon?: string }>> = {
  표준형: [
    { value: "예산 엄수", label: "예산은 꼭 지켜야 해요", desc: "정해진 예산을 초과하고 싶지 않아요", icon: "🎯" },
    { value: "조금 타협 가능", label: "조금 더 낼 수 있어요", desc: "좋은 차라면 약간 유연하게 생각해요", icon: "⚖️" },
  ],
  보수형: [
    { value: "100만원 이하", label: "100만원 이하", desc: "소액 보증금/선납금으로 시작해요", icon: "💵" },
    { value: "100~300만원", label: "100~300만원", desc: "적당한 초기 비용이에요", icon: "💰" },
    { value: "300만원 이상", label: "300만원 이상", desc: "초기 목돈으로 월납을 대폭 낮춰요", icon: "💎" },
  ],
};

export const BUDGET_DETAIL_QUESTION: Record<string, { title: string; subtitle: string }> = {
  표준형: { title: "차량 선택 기준이 어떻게 되나요?", subtitle: "약간의 유연성이 있으면 더 좋은 차를 제안드려요." },
  보수형: { title: "초기 비용으로 얼마 정도 준비하셨나요?", subtitle: "보증금·선납금이 클수록 월 납입금을 더 낮출 수 있어요." },
};

export const FUEL_PREFERENCE_OPTIONS = [
  { value: "상관없음", label: "상관없음", desc: "연료 방식에 특별한 제한이 없어요", icon: "🔄" },
  { value: "가솔린/디젤", label: "내연기관", desc: "익숙한 가솔린·디젤이 편해요", icon: "⛽" },
  { value: "하이브리드", label: "하이브리드", desc: "연비와 주행거리 모두 잡아요", icon: "🌿" },
  { value: "전기차", label: "전기차", desc: "충전 인프라 있음, 유지비 절감", icon: "⚡" },
] as const;

// 전기차 선택 시 추가로 묻는 충전 환경 (3단계+없음)
export const CHARGING_OPTIONS = [
  { value: "자택", label: "자택 충전 가능", desc: "집에서 충전돼요", icon: "🏠" },
  { value: "직장", label: "직장 충전 가능", desc: "회사에서 충전돼요", icon: "🏢" },
  { value: "외부", label: "외부 충전만", desc: "공용 충전소 이용", icon: "🔌" },
  { value: "없음", label: "충전 환경 없어요", desc: "충전이 어려워요", icon: "🚫" },
] as const;

export const REGION_OPTIONS = [
  { value: "일반", label: "일반 지역", desc: "수도권·도심 등", icon: "🏙️" },
  { value: "강원·산간", label: "강원·산간", desc: "눈길·비포장 잦음", icon: "🏔️" },
  { value: "제주", label: "제주", desc: "전기차 인프라 우수", icon: "🌴" },
] as const;
