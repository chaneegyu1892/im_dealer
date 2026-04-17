// AI 추천 4단계 선택지 데이터

export const INDUSTRY_OPTIONS = [
  { value: "법인", label: "법인", desc: "법인 명의 차량 등록", icon: "🏢" },
  { value: "개인사업자", label: "개인사업자", desc: "사업자등록증 보유", icon: "📋" },
  { value: "직장인", label: "직장인", desc: "급여 소득자", icon: "💼" },
  { value: "개인", label: "개인 (비사업자)", desc: "순수 개인 명의", icon: "👤" },
] as const;

export const PURPOSE_OPTIONS = [
  { value: "출퇴근", label: "출퇴근", desc: "매일 출퇴근 주요 이동수단", icon: "🚗" },
  { value: "영업·외근", label: "영업·외근", desc: "고객 미팅·현장 이동 잦음", icon: "📍" },
  { value: "가족", label: "가족용", desc: "가족 이동·장거리 여행", icon: "👨‍👩‍👧" },
  { value: "화물·배달", label: "화물·배달", desc: "물건 운반·배달 업무", icon: "📦" },
  { value: "기타", label: "기타 목적", desc: "위에 해당 없음", icon: "✳️" },
] as const;

export const BUDGET_RANGE_OPTIONS = [
  { value: "~30", label: "30만원 이하", budgetMin: 0, budgetMax: 300_000 },
  { value: "30~50", label: "30 – 50만원", budgetMin: 300_000, budgetMax: 500_000 },
  { value: "50~70", label: "50 – 70만원", budgetMin: 500_000, budgetMax: 700_000 },
  { value: "70~100", label: "70 – 100만원", budgetMin: 700_000, budgetMax: 1_000_000 },
  { value: "100~", label: "100만원 이상", budgetMin: 1_000_000, budgetMax: 99_999_999 },
] as const;

export const PAYMENT_STYLE_OPTIONS = [
  {
    value: "보수형" as const,
    label: "보수형",
    desc: "보증금 있음 · 월납입 낮게",
    detail: "초기 목돈이 있고 월 부담을 낮추고 싶을 때",
  },
  {
    value: "표준형" as const,
    label: "표준형",
    desc: "보증금 없음 · 균형 잡힌 조건",
    detail: "가장 일반적인 방식. 추천 기본값",
    recommended: true,
  },
  {
    value: "공격형" as const,
    label: "공격형",
    desc: "선납금 있음 · 월납입 최소화",
    detail: "목돈으로 선납 후 월 부담을 최대한 줄일 때",
  },
] as const;

export const MILEAGE_OPTIONS = [
  { value: 20_000, label: "연 2만km 이하", desc: "단거리 위주, 출퇴근만" },
  { value: 30_000, label: "연 2 – 3만km", desc: "평균적인 주행 패턴" },
  { value: 40_000, label: "연 3 – 4만km", desc: "장거리·영업 많음" },
  { value: 50_000, label: "연 4만km 이상", desc: "고주행, 화물·배달" },
] as const;

// 조건부 추가 질문 선택지

export const INDUSTRY_DETAIL_OPTIONS: Record<string, Array<{ value: string; label: string; desc?: string; icon?: string }>> = {
  법인: [
    { value: "1대", label: "1대", desc: "대표 차량 또는 단독 운용", icon: "🚗" },
    { value: "2~5대", label: "2~5대", desc: "소규모 fleet 관리", icon: "🚙" },
    { value: "6대 이상", label: "6대 이상", desc: "대규모 차량 운용", icon: "🏭" },
  ],
  개인사업자: [
    { value: "비용처리 중요", label: "비용처리가 중요해요", desc: "세금 절감 효과를 최대화하고 싶어요", icon: "💰" },
    { value: "상관없음", label: "크게 상관없어요", desc: "차량 조건이 더 우선이에요", icon: "👍" },
  ],
  직장인: [
    { value: "자가용 주요", label: "자가용이 주요 수단이에요", desc: "출퇴근 대부분을 차로 이동해요", icon: "🚗" },
    { value: "대중교통 병행", label: "대중교통을 병행해요", desc: "필요할 때만 차량을 이용해요", icon: "🚌" },
  ],
  개인: [
    { value: "혼자", label: "주로 혼자 타요", desc: "1인 사용이 대부분이에요", icon: "👤" },
    { value: "2~3명", label: "2~3명이 함께 타요", desc: "가끔 동승자가 있어요", icon: "👥" },
    { value: "4명 이상", label: "4명 이상 함께 타요", desc: "가족·단체 이동이 잦아요", icon: "👨‍👩‍👧‍👦" },
  ],
};

export const INDUSTRY_DETAIL_QUESTION: Record<string, { title: string; subtitle: string }> = {
  법인: { title: "법인 차량 운용 대수는요?", subtitle: "규모에 맞는 실용적인 차량을 추천해 드려요." },
  개인사업자: { title: "세금 비용처리가 중요한가요?", subtitle: "비용처리 여부에 따라 최적 견적 조건이 달라져요." },
  직장인: { title: "차량을 얼마나 자주 이용하실 건가요?", subtitle: "사용 패턴에 맞는 연비와 편의사양을 고려해요." },
  개인: { title: "주로 몇 명이 함께 탑승하나요?", subtitle: "동승 인원에 따라 적합한 차급이 달라져요." },
};

export const PURPOSE_DETAIL_OPTIONS: Record<string, Array<{ value: string; label: string; desc?: string; icon?: string }>> = {
  출퇴근: [
    { value: "10km 이하", label: "10km 이하", desc: "가까운 거리, 시내 위주", icon: "📍" },
    { value: "10~30km", label: "10~30km", desc: "평균적인 출퇴근 거리", icon: "🛣️" },
    { value: "30km 이상", label: "30km 이상", desc: "장거리 출퇴근, 연비가 중요해요", icon: "🛤️" },
  ],
  "영업·외근": [
    { value: "주 2~3회", label: "주 2~3회", desc: "간헐적으로 외근해요", icon: "📅" },
    { value: "매일", label: "매일 외근해요", desc: "일상적으로 이동이 많아요", icon: "🗓️" },
  ],
  가족: [
    { value: "영유아", label: "영유아가 있어요", desc: "카시트, 안전 기능이 중요해요", icon: "👶" },
    { value: "초등 이상", label: "초등 이상이에요", desc: "실내 공간·편의사양을 중시해요", icon: "🧒" },
    { value: "자녀 없음", label: "자녀가 없어요", desc: "부부 또는 성인 위주로 이용해요", icon: "💑" },
  ],
  "화물·배달": [
    { value: "소형 박스", label: "소형 박스·소화물", desc: "택배, 소형 물품 위주예요", icon: "📦" },
    { value: "대형 화물", label: "대형 화물·자재", desc: "적재 용량이 정말 중요해요", icon: "🏗️" },
  ],
  기타: [
    { value: "주말만", label: "주말·레저용이에요", desc: "주로 주말에만 운행해요", icon: "⛺" },
    { value: "평일 포함 자주", label: "평일 포함 자주 써요", desc: "일상적으로 자주 운행해요", icon: "🔄" },
  ],
};

export const PURPOSE_DETAIL_QUESTION: Record<string, { title: string; subtitle: string }> = {
  출퇴근: { title: "하루 편도 출퇴근 거리는요?", subtitle: "거리가 멀수록 연비 좋은 차량이 더 유리해요." },
  "영업·외근": { title: "외근 빈도는 어느 정도인가요?", subtitle: "자주 이동하실수록 승차감·편의사양이 중요해요." },
  가족: { title: "자녀 연령대는 어떻게 되나요?", subtitle: "연령에 맞는 안전·편의 기능을 우선으로 추천해요." },
  "화물·배달": { title: "주로 어떤 물량을 운반하시나요?", subtitle: "적재 용량에 맞는 차종을 추천해 드려요." },
  기타: { title: "차량을 얼마나 자주 이용하실 예정인가요?", subtitle: "사용 빈도에 따라 유지비 부담이 달라져요." },
};

export const BUDGET_DETAIL_OPTIONS: Record<string, Array<{ value: string; label: string; desc?: string; icon?: string }>> = {
  보수형: [
    { value: "100만원 이하", label: "100만원 이하", desc: "소액 보증금으로 시작해요", icon: "💵" },
    { value: "100~300만원", label: "100~300만원", desc: "적당한 초기 비용이에요", icon: "💰" },
    { value: "300만원 이상", label: "300만원 이상", desc: "초기 목돈으로 월납을 대폭 낮춰요", icon: "💎" },
  ],
  표준형: [
    { value: "예산 엄수", label: "예산은 꼭 지켜야 해요", desc: "정해진 예산을 초과하고 싶지 않아요", icon: "🎯" },
    { value: "조금 타협 가능", label: "조금 더 낼 수 있어요", desc: "좋은 차라면 약간 유연하게 생각해요", icon: "⚖️" },
  ],
  공격형: [
    { value: "100만원 이하", label: "100만원 이하", desc: "소액 선납으로 시작해요", icon: "💵" },
    { value: "100~300만원", label: "100~300만원", desc: "적당한 선납금이에요", icon: "💰" },
    { value: "300만원 이상", label: "300만원 이상", desc: "선납으로 월납을 최소화해요", icon: "💎" },
  ],
};

export const BUDGET_DETAIL_QUESTION: Record<string, { title: string; subtitle: string }> = {
  보수형: { title: "초기 보증금으로 얼마 정도 준비하셨나요?", subtitle: "보증금이 클수록 월 납입금을 더 낮출 수 있어요." },
  표준형: { title: "차량 선택 기준이 어떻게 되나요?", subtitle: "약간의 유연성이 있으면 더 좋은 차를 제안드려요." },
  공격형: { title: "선납금으로 얼마 정도 준비하셨나요?", subtitle: "선납금이 많을수록 월 납입금이 크게 줄어요." },
};

export const FUEL_PREFERENCE_OPTIONS = [
  { value: "상관없음", label: "상관없어요", desc: "연료 방식에 특별한 제한이 없어요", icon: "🔄" },
  { value: "전기차", label: "전기차 선호", desc: "충전 인프라 있음, 유지비 절감", icon: "⚡" },
  { value: "하이브리드", label: "하이브리드 선호", desc: "연비와 주행거리 모두 잡아요", icon: "🌿" },
  { value: "가솔린/디젤", label: "가솔린·디젤 선호", desc: "익숙한 내연기관이 편해요", icon: "⛽" },
] as const;

export const RETURN_TYPE_OPTIONS = [
  {
    value: "반납형" as const,
    label: "반납형",
    desc: "계약 종료 후 반납",
    detail: "차량 소유 불필요, 유지비 최소화",
  },
  {
    value: "인수형" as const,
    label: "인수형",
    desc: "계약 종료 후 내 차로",
    detail: "잔존가치로 차량을 최종 구매",
  },
  {
    value: "미정" as const,
    label: "아직 모르겠어요",
    desc: "AI가 조건별로 비교해 드려요",
    detail: "",
  },
] as const;
