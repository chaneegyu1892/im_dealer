import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

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
    <html lang="ko">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
