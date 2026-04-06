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
