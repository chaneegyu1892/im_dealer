import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Primary (Deep Navy) ──────────────────
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
        // ── Secondary (Muted Slate Blue) ─────────
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
        // ── Tertiary (Deep Burgundy) ─────────────
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
        // ── Neutral ──────────────────────────────
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
        // ── Semantic ─────────────────────────────
        success: {
          bg: "#E5E5FA",
          text: "#000666",
        },
        error: {
          bg: "#FFEBEB",
          text: "#CC0000",
        },
        destructive: "#CC0000",
        // ── Typography text colors ────────────────
        ink: {
          DEFAULT: "#333333",
          body: "#404040",
          label: "#71749A",
          caption: "#A0A0A0",
        },
        // ── Special ──────────────────────────────
        "navy-dark": "#1A1A2E",
      },

      borderRadius: {
        card: "12px",
        btn: "8px",
        pill: "20px",
        tooltip: "8px",
        toast: "10px",
      },

      boxShadow: {
        card: "0 2px 8px rgba(0,0,0,0.06)",
        "card-hover": "0 8px 24px rgba(0,6,102,0.12)",
        "step-active": "0 0 0 4px rgba(0,6,102,0.15)",
      },

      fontFamily: {
        display: ["var(--font-pretendard)", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["var(--font-pretendard)", "ui-sans-serif", "system-ui", "sans-serif"],
      },

      fontSize: {
        "headline-lg": ["44px", { lineHeight: "1.15", fontWeight: "300" }],
        "headline-sm": ["30px", { lineHeight: "1.25", fontWeight: "300" }],
        "title-lg": ["24px", { lineHeight: "1.35", fontWeight: "500" }],
        "title-sm": ["18px", { lineHeight: "1.4", fontWeight: "500" }],
        body: ["16px", { lineHeight: "1.65", fontWeight: "400" }],
        "body-sm": ["15px", { lineHeight: "1.6", fontWeight: "400" }],
        label: ["13px", { lineHeight: "1.5", fontWeight: "400" }],
        caption: ["12px", { lineHeight: "1.5", fontWeight: "400" }],
        "caption-sm": ["11px", { lineHeight: "1.5", fontWeight: "400" }],
      },

      maxWidth: {
        content: "1200px",
      },

      spacing: {
        unit: "8px",
        "gap-component": "16px",
        "gap-section": "32px",
      },

      backgroundImage: {
        "hero-gradient":
          "linear-gradient(135deg, #000666 0%, #1A1A6E 60%, #3333CC 100%)",
        "skeleton-shimmer":
          "linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)",
      },

      backgroundSize: {
        "shimmer-200": "200% 100%",
      },

      transitionTimingFunction: {
        DEFAULT: "ease",
      },

      transitionDuration: {
        DEFAULT: "200ms",
      },

      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideDown: {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },

      animation: {
        shimmer: "shimmer 1.4s infinite linear",
        "fade-in": "fadeIn 0.2s ease",
        "slide-down": "slideDown 0.22s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
