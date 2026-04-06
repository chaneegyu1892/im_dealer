// DESIGN.md 기반 디자인 토큰 상수
// Tailwind 클래스 대신 JS 값이 필요한 경우 사용 (canvas, chart 등)

export const COLORS = {
  primary: {
    DEFAULT: "#000666",
    900: "#000999",
    800: "#0010CC",
    700: "#3333CC",
    600: "#6666DD",
    400: "#9999EE",
    200: "#CCCCF5",
    100: "#E5E5FA",
  },
  secondary: {
    DEFAULT: "#71749A",
    900: "#4A4D70",
    800: "#5A5D80",
    600: "#8185AA",
    400: "#9196BB",
    300: "#B0B4CC",
    200: "#D0D3E5",
    100: "#E8EAF2",
  },
  tertiary: {
    DEFAULT: "#5C1800",
    900: "#7A2000",
    800: "#992800",
    700: "#BB3300",
    600: "#CC5533",
    400: "#DD8866",
    200: "#EEBBAA",
    100: "#F5DDD5",
  },
  neutral: {
    DEFAULT: "#F8F9FA",
    800: "#E0E0E0",
    600: "#C0C0C0",
    500: "#A0A0A0",
    400: "#606060",
    300: "#404040",
    200: "#202020",
    0: "#000000",
  },
  semantic: {
    successBg: "#E5E5FA",
    successText: "#000666",
    errorBg: "#FFEBEB",
    errorText: "#CC0000",
    destructive: "#CC0000",
  },
  ink: {
    DEFAULT: "#1A1A1A",
    body: "#404040",
    label: "#71749A",
    caption: "#A0A0A0",
  },
  navyDark: "#1A1A2E",
} as const;

export const GRADIENTS = {
  hero: "linear-gradient(135deg, #000666 0%, #1A1A6E 60%, #3333CC 100%)",
} as const;

export const SPACING = {
  unit: 8,
  componentGap: 16,
  sectionGap: 32,
} as const;

export const BORDER_RADIUS = {
  card: "12px",
  btn: "8px",
  pill: "20px",
  tooltip: "8px",
  toast: "10px",
} as const;

export const SHADOWS = {
  card: "0 2px 8px rgba(0,0,0,0.06)",
  cardHover: "0 8px 24px rgba(0,6,102,0.12)",
  stepActive: "0 0 0 4px rgba(0,6,102,0.15)",
} as const;

export const LAYOUT = {
  maxWidth: "1200px",
  mobileBreakpoint: 768,
} as const;
