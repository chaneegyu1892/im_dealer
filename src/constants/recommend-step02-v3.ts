export const STEP02_V3_STYLE_OPTIONS = [
  {
    value: "family-leisure",
    label: "가족·레저용으로 쓰기 좋은 차",
    desc: "가족 탑승, 여행, 차박, 짐 적재까지 넉넉한 차",
    icon: "👨‍👩‍👧",
  },
  {
    value: "city-compact",
    label: "경차·도심형으로 편하게 타는 차",
    desc: "주차가 편하고 일상에서 가볍게 타기 좋은 차",
    icon: "🅿️",
  },
  {
    value: "sedan-comfort",
    label: "세단 중심의 편안한 차",
    desc: "출퇴근, 장거리, 일상 주행에 두루 잘 맞는 차",
    icon: "🚗",
  },
  {
    value: "low-running-cost",
    label: "오래 타도 유지비 부담이 적은 차",
    desc: "주행이 많거나 경제성을 중요하게 보는 경우",
    icon: "⛽",
  },
  {
    value: "premium-formal",
    label: "격식 있고 고급스러운 차",
    desc: "비즈니스, 의전, 프리미엄 이미지를 원하는 경우",
    icon: "💼",
  },
  {
    value: "auto",
    label: "AI에게 맡길게요",
    desc: "아직 잘 모르겠다면 조건에 맞는 차량 자동 추천",
    icon: "🤖",
  },
] as const;

export type Step02V3Style = (typeof STEP02_V3_STYLE_OPTIONS)[number]["value"];

export const STEP02_V3_STYLE_LABELS = Object.fromEntries(
  STEP02_V3_STYLE_OPTIONS.map((option) => [option.value, option.label])
) as Readonly<Record<Step02V3Style, string>>;

export function isStep02V3Style(value: string): value is Step02V3Style {
  return STEP02_V3_STYLE_OPTIONS.some((option) => option.value === value);
}
