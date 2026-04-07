import type { Metadata } from "next";
import { Outfit, Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  variable: "--font-noto",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "아임딜러 — AI 기반 진짜견적",
    template: "%s | 아임딜러",
  },
  description:
    "허위견적 없는 AI 기반 장기렌트·리스 견적 서비스. 고객이 먼저 탐색하고 이해하는 구조로 설계된 아임딜러입니다.",
  openGraph: {
    title: "아임딜러 — AI 기반 진짜견적",
    description: "허위견적 없는 AI 기반 장기렌트·리스 견적 서비스",
    locale: "ko_KR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${outfit.variable} ${notoSansKr.variable}`}>
      <body>{children}</body>
    </html>
  );
}
